
import React, { useMemo, useState } from 'react';
import { Product, AiMode } from '../types';
import { Plus, Package, Zap, BrainCircuit, Trash2, Tag, ArrowRight } from 'lucide-react';
import ProductCard from './ProductCard';
import ConfirmationModal from './ConfirmationModal';

interface ProductListProps {
  products: Product[];
  onSelectProduct: (product: Product) => void;
  onAddNew: () => void;
  aiMode: AiMode;
  onToggleAiMode: (mode: AiMode) => void;
  selectedIds: Set<string>;
  onToggleSelection: (id: string) => void;
  onDeleteSelected: (ids: Set<string>) => void;
}

const ProductList: React.FC<ProductListProps> = ({ 
  products, 
  onSelectProduct, 
  onAddNew,
  aiMode,
  onToggleAiMode,
  selectedIds,
  onToggleSelection,
  onDeleteSelected
}) => {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const groupedProducts = useMemo(() => {
    const groups: Record<string, Product[]> = {};
    products.forEach(p => {
      const cat = p.details.category || 'Uncategorized';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(p);
    });
    return groups;
  }, [products]);

  const categories = Object.keys(groupedProducts).sort();

  const handleConfirmDelete = () => {
    onDeleteSelected(selectedIds);
    setShowDeleteConfirm(false);
  };

  return (
    <div className="space-y-8 pb-20 relative">
      <ConfirmationModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleConfirmDelete}
        title="Delete Products?"
        message={<span>Are you sure you want to delete <span className="font-bold text-slate-800">{selectedIds.size}</span> selected products? This action cannot be undone.</span>}
        confirmText="Delete"
      />

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
            <h2 className="text-2xl font-bold text-slate-800">Inventory</h2>
            
            <div className="bg-slate-200 p-1 rounded-lg flex items-center">
                <button 
                  onClick={() => onToggleAiMode('fast')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${aiMode === 'fast' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    <Zap size={12} className={aiMode === 'fast' ? "fill-current" : ""} /> Fast
                </button>
                <button 
                  onClick={() => onToggleAiMode('detailed')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${aiMode === 'detailed' ? 'bg-white text-purple-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    <BrainCircuit size={12} /> Detailed
                </button>
            </div>
        </div>

        <div className="flex gap-3 w-full sm:w-auto">
          {selectedIds.size > 0 && (
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-red-100 hover:bg-red-200 text-red-700 px-4 py-2 rounded-lg font-medium transition-colors cursor-pointer z-10 border border-red-200 active:scale-95"
            >
              <Trash2 size={18} className="pointer-events-none" />
              <span>Delete ({selectedIds.size})</span>
            </button>
          )}

          <button
            onClick={onAddNew}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-md hover:shadow-lg active:scale-95"
          >
            <Plus size={18} className="pointer-events-none" />
            <span>New Product</span>
          </button>
        </div>
      </div>

      {products.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center bg-white rounded-2xl border border-dashed border-slate-300">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4 text-slate-400">
            <Package size={32} />
          </div>
          <h3 className="text-lg font-medium text-slate-700">No products yet</h3>
          <p className="text-slate-500 max-w-xs mt-2">
            Upload a product image or enter a URL to start.
          </p>
          <button
            onClick={onAddNew}
            className="mt-6 text-blue-600 font-medium hover:underline flex items-center gap-2 mx-auto"
          >
            Start identification <ArrowRight size={16} />
          </button>
        </div>
      ) : (
        <div className="space-y-8">
          {categories.map(category => (
            <div key={category} className="space-y-4">
              <div className="flex items-center gap-2 text-slate-500 border-b border-slate-200 pb-2">
                <Tag size={16} />
                <h3 className="font-bold text-sm uppercase tracking-wider">{category}</h3>
                <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-xs font-mono">
                  {groupedProducts[category].length}
                </span>
              </div>
              
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {groupedProducts[category].map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    isSelected={selectedIds.has(product.id)}
                    onSelect={onSelectProduct}
                    onToggleSelection={onToggleSelection}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ProductList;
