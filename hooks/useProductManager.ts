
import { useState, useEffect, useCallback } from 'react';
import { Product, ViewState, AiMode } from '../types';
import { identifyProductFromMedia, performQualityControl, fileToBase64 } from '../services/geminiService';
import { supabase } from '../lib/supabaseClient';
import { generateUUID } from '../utils';

export const useProductManager = (userId: string | undefined, apiKey: string | null) => {
  const [view, setView] = useState<ViewState>('dashboard');
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [aiMode, setAiMode] = useState<AiMode>('detailed');
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());

  // Fetch Products & Rehydrate Images from Supabase
  useEffect(() => {
    if (!userId) {
      setProducts([]);
      return;
    }

    const fetchProducts = async () => {
      // 1. Fetch the lightweight product metadata (JSON)
      const { data: productRows, error: productError } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false });

      if (productError) {
        console.error("Error fetching products:", productError);
        return;
      }

      if (!productRows || productRows.length === 0) {
        setProducts([]);
        return;
      }

      // 2. Fetch all images associated with these products
      const productIds = productRows.map((r: any) => r.id);
      const { data: imageRows, error: imageError } = await supabase
        .from('product_images')
        .select('product_id, report_id, image_index, image_data')
        .in('product_id', productIds);

      if (imageError) {
        console.error("Error fetching images:", imageError);
      }

      // 3. Create a lookup map for images: [productId][reportId] -> Map<index, data>
      // Structure: images[productId][reportId][index] = base64String
      const imageMap: Record<string, Record<string, string[]>> = {};

      if (imageRows) {
        imageRows.forEach((img: any) => {
          if (!imageMap[img.product_id]) imageMap[img.product_id] = {};
          if (!imageMap[img.product_id][img.report_id]) imageMap[img.product_id][img.report_id] = [];
          
          imageMap[img.product_id][img.report_id][img.image_index] = img.image_data;
        });
      }

      // 4. Reassemble the full Product objects
      const loadedProducts = productRows.map((row: any) => {
        const product = row.content as Product;
        product.id = row.id; // Ensure ID matches DB

        // Rehydrate Main Image
        // 'main' is the reserved report_id for the product cover image
        const mainImages = imageMap[product.id]?.['main'];
        if (mainImages && mainImages[0]) {
          product.mainImage = mainImages[0];
        }

        // Rehydrate QC Report Images
        if (product.qcReports) {
          product.qcReports = product.qcReports.map(report => {
            const reportImages = imageMap[product.id]?.[report.id];
            if (reportImages) {
              // Filter out empty slots if any gaps exist, ensuring a clean array
              return { ...report, images: reportImages.filter(Boolean) };
            }
            return report;
          });
        }

        return product;
      });

      setProducts(loadedProducts);
    };

    fetchProducts();
  }, [userId]);

  const saveProductToDb = async (product: Product) => {
    if (!userId) return;

    try {
      // 1. Prepare the Image Rows for the separate table
      const imageRows: any[] = [];
      const timestamp = new Date().toISOString();

      // Main Image
      // Only save if it's actual data (Base64) and not a placeholder or empty
      if (product.mainImage && product.mainImage.length > 100) {
        imageRows.push({
          user_id: userId,
          product_id: product.id,
          report_id: 'main',
          image_index: 0,
          image_data: product.mainImage,
          updated_at: timestamp
        });
      }

      // QC Images
      product.qcReports.forEach(report => {
        if (report.images && report.images.length > 0) {
          report.images.forEach((img, idx) => {
            if (img && img.length > 100) {
               imageRows.push({
                user_id: userId,
                product_id: product.id,
                report_id: report.id,
                image_index: idx,
                image_data: img,
                updated_at: timestamp
               });
            }
          });
        }
      });

      // 2. Prepare the Lightweight Product JSON (strip heavy images)
      const cleanProduct = { ...product };
      // Replace images with placeholders in the JSON blob to keep it small
      cleanProduct.mainImage = "stored_in_product_images"; 
      cleanProduct.qcReports = product.qcReports.map(r => ({
        ...r,
        images: [] // Images are stored in relation table
      }));

      // 3. Save the Product Metadata
      const { error: productError } = await supabase
        .from('products')
        .upsert({
          id: product.id,
          user_id: userId,
          content: cleanProduct,
          created_at: new Date(product.createdAt).toISOString()
        });

      if (productError) throw productError;

      // 4. Upsert the Images
      // We use upsert to overwrite existing images at the same index
      // The unique constraint (product_id, report_id, image_index) handles conflicts
      if (imageRows.length > 0) {
        const { error: imagesError } = await supabase
          .from('product_images')
          .upsert(imageRows, { onConflict: 'product_id, report_id, image_index' });
        
        if (imagesError) throw imagesError;
      }

    } catch (error: any) {
      console.error("Error saving product:", error);
      // Don't alert on unique violations if they happen harmlessly
      if (error.code !== '23505') {
        alert("Failed to save to cloud: " + error.message);
      }
    }
  };

  const deleteProductsFromDb = async (ids: string[]) => {
    if (!userId) return;
    const { error } = await supabase
      .from('products')
      .delete()
      .in('id', ids);

    if (error) console.error("Error deleting products:", error);
    // Images are deleted automatically via CASCADE constraint in SQL
  };

  const selectedProduct = products.find(p => p.id === selectedProductId) || null;

  const updateProduct = (id: string, updates: Partial<Product>) => {
    setProducts(prev => {
      const next = prev.map(p => {
        if (p.id === id) {
          const updated = { ...p, ...updates };
          // Fire and forget save to DB
          saveProductToDb(updated);
          return updated;
        }
        return p;
      });
      return next;
    });
  };

  const handleToggleSelection = (id: string) => {
    const newSet = new Set(selectedProductIds);
    if (newSet.has(id)) {
        newSet.delete(id);
    } else {
        newSet.add(id);
    }
    setSelectedProductIds(newSet);
  };

  const handleDeleteSelected = async (idsToDelete: Set<string>) => {
    if (idsToDelete.size === 0) return;
    
    // Optimistic Update
    setProducts(prev => prev.filter(p => !idsToDelete.has(p.id)));
    setSelectedProductIds(new Set());

    // Sync to DB
    await deleteProductsFromDb(Array.from(idsToDelete));
  };

  const simulateProgress = (productId: string) => {
    let current = 10;
    const interval = setInterval(() => {
      current += Math.random() * 10;
      if (current > 90) {
        current = 90; 
        clearInterval(interval);
      }
      setProducts(prev => {
        const p = prev.find(item => item.id === productId);
        if (p && (p.processingStatus === 'identifying' || p.processingStatus === 'analyzing')) {
          return prev.map(item => item.id === productId ? { ...item, progress: Math.round(current) } : item);
        }
        clearInterval(interval);
        return prev;
      });
    }, 800);
  };

  const handleStartIdentification = async (file: File | null, url: string | null) => {
    if (!apiKey) {
      alert("API Key is missing. Please save your key first.");
      return;
    }

    const tempId = generateUUID();
    let base64Image = '';
    const rawUrl = url || '';

    if (file) {
      try {
        base64Image = await fileToBase64(file);
      } catch (e) {
        alert("Failed to process image file.");
        return;
      }
    } else if (url) {
      // Temporary SVG placeholder while identification runs
      base64Image = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIiB2aWV3Qm94PSIwIDAgMTAwIDEwMCI+PHJlY3Qgd2lkdGg9IjEwMCIgaGVpZ2h0PSIxMDAiIGZpbGw9IiNmMmYyZjIiLz48dGV4dCB4PSI1MCIgeT0iNTAiIGZvbnQtZmFtaWx5PSJhcmlhbCIgZm9udC1zaXplPSIxNCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0iIzkwOTA5MCI+V1JCPC90ZXh0Pjwvc3ZnPg==';
    }

    const newProduct: Product = {
      id: tempId,
      mainImage: base64Image,
      details: {
        sku: 'PENDING...',
        name: 'Identifying Product...',
        material: '...',
        estimatedCost: '...',
        retailer: '...',
        description: 'Analysis in progress...',
        category: 'Processing',
        productUrl: rawUrl
      },
      qcReports: [],
      createdAt: Date.now(),
      processingStatus: 'identifying',
      progress: 10
    };

    // Optimistic Add
    setProducts(prev => [newProduct, ...prev]);
    saveProductToDb(newProduct);
    setView('dashboard');

    simulateProgress(tempId);

    try {
      const input = file ? base64Image : rawUrl;
      const isUrlMode = !file && !!url;
      
      const details = await identifyProductFromMedia(apiKey, input, isUrlMode, aiMode);
      
      const updates: Partial<Product> = {
        details, 
        processingStatus: 'idle',
        progress: 100 
      };

      if (isUrlMode && details.imageUrl) {
        updates.mainImage = details.imageUrl;
      }

      updateProduct(tempId, updates);
    } catch (err: any) {
      console.error("Background ID Error:", err);
      updateProduct(tempId, { 
        processingStatus: 'error', 
        error: "Failed to identify product. " + (err.message || ''),
        details: {
           ...newProduct.details,
           name: "Identification Failed",
           sku: "ERROR"
        }
      });
    }
  };

  const handleStartQC = async (product: Product, files: File[], isExpertMode: boolean = false) => {
    if (!apiKey) {
      alert("API Key is missing.");
      return;
    }

    updateProduct(product.id, { 
      processingStatus: 'analyzing',
      progress: 5 
    });

    simulateProgress(product.id);

    try {
      const newMediaBase64 = await Promise.all(files.map(f => fileToBase64(f)));
      
      const report = await performQualityControl(
        apiKey,
        product.details,
        product.mainImage,
        product.qcReports,
        newMediaBase64,
        aiMode,
        isExpertMode
      );

      setProducts(prev => {
        const next = prev.map(p => {
          if (p.id === product.id) {
            const updated = {
              ...p,
              qcReports: [report, ...p.qcReports],
              processingStatus: 'idle' as const,
              progress: 100
            };
            saveProductToDb(updated);
            return updated;
          }
          return p;
        });
        return next;
      });

    } catch (err: any) {
      console.error("Background QC Error:", err);
      updateProduct(product.id, { 
        processingStatus: 'error',
        error: "QC Inspection Failed: " + (err.message || '')
      });
    }
  };

  return {
    view, setView,
    products,
    selectedProductId, setSelectedProductId,
    selectedProduct,
    aiMode, setAiMode,
    selectedProductIds,
    handleToggleSelection,
    handleDeleteSelected,
    handleStartIdentification,
    handleStartQC
  };
};
