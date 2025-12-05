
import { useState, useEffect } from 'react';
import { Product, ViewState, AiMode } from '../types';
import { identifyProductFromMedia, performQualityControl, fileToBase64 } from '../services/geminiService';

export const useProductManager = (userId: string | undefined, apiKey: string | null) => {
  const [view, setView] = useState<ViewState>('dashboard');
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [aiMode, setAiMode] = useState<AiMode>('detailed');
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());

  const storageKey = userId ? `smartqc_products_${userId}` : null;

  // Load from LocalStorage specific to user
  useEffect(() => {
    if (storageKey) {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        try {
          setProducts(JSON.parse(saved));
        } catch (e) {
          console.error("Failed to parse saved products", e);
          setProducts([]);
        }
      } else {
        setProducts([]);
      }
    } else {
      setProducts([]);
    }
  }, [storageKey]);

  // Save to LocalStorage specific to user
  useEffect(() => {
    if (storageKey) {
      localStorage.setItem(storageKey, JSON.stringify(products));
    }
  }, [products, storageKey]);

  const selectedProduct = products.find(p => p.id === selectedProductId) || null;

  const updateProduct = (id: string, updates: Partial<Product>) => {
    setProducts(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
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

  const handleDeleteSelected = (idsToDelete: Set<string>) => {
    if (idsToDelete.size === 0) return;
    setProducts(prev => prev.filter(p => !idsToDelete.has(p.id)));
    setSelectedProductIds(new Set());
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

    const tempId = crypto.randomUUID();
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

    setProducts(prev => [newProduct, ...prev]);
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

      setProducts(prev => prev.map(p => {
        if (p.id === product.id) {
          return {
            ...p,
            qcReports: [report, ...p.qcReports],
            processingStatus: 'idle',
            progress: 100
          };
        }
        return p;
      }));

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
