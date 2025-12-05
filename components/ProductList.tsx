
import React, { useMemo, useState } from 'react';
import { Product, AiMode, QCStatus } from '../types';
import { Plus, Package, Zap, BrainCircuit, Trash2, Tag, ArrowRight, Info, Filter, XCircle } from 'lucide-react';
import ProductCard from './ProductCard';
import ConfirmationModal from './ConfirmationModal';
import Tooltip from './Tooltip';

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
  const [filterCategory, setFilterCategory] = useState<string>('All');
  const [filterStatus, setFilterStatus] = useState<string>('All');

  // Derive unique categories for the filter dropdown
  const allCategories = useMemo(() => {
    const cats = new Set(products.map(p => p.details.category || 'Uncategorized'));
    return ['All', ...Array.from(cats).sort()];
  }, [products]);

  const groupedProducts = useMemo(() => {
    // 1. Filter Products
    const filtered = products.filter(p => {
      const matchesCategory = filterCategory === 'All' || (p.details.category || 'Uncategorized') === filterCategory;
      
      let matchesStatus = true;
      if (filterStatus !== 'All') {
        const status = p.qcReports && p.qcReports.length > 0 ? p.qcReports[0].status : 'Pending';
        matchesStatus = status === filterStatus;
      }
      
      return matchesCategory && matchesStatus;
    });

    // 2. Group Filtered Products
    const groups: Record<string, Product[]> = {};
    filtered.forEach(p => {
      const cat = p.details.category || 'Uncategorized';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(p);
    });
    return groups;
  }, [products, filterCategory, filterStatus]);

  const categories = Object.keys(groupedProducts).sort();

  const handleConfirmDelete = () => {
    onDeleteSelected(selectedIds);
    setShowDeleteConfirm(false);
  };

  const clearFilters = () => {
    setFilterCategory('All');
    setFilterStatus('All');
  };

  const hasActiveFilters = filterCategory !== 'All' || filterStatus !== 'All';

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

      <div className="flex flex-col gap-6">
        {/* Header Row: Title & AI Toggles */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                 <h2 className="text-2xl font-bold text-slate-800">Inventory</h2>
                 <Tooltip content="Your complete collection of identified products. Grouped by category.">
                    <Info size={16} className="text-slate-400 cursor-help" />
                 </Tooltip>
              </div>
              
              <div className="bg-slate-200 p-1 rounded-lg flex items-center">
                  <Tooltip content="Gemini 2.5 Flash: Fast responses, good for quick checks.">
                    <button 
                      onClick={() => onToggleAiMode('fast')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${aiMode === 'fast' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <Zap size={12} className={aiMode === 'fast' ? "fill-current" : ""} /> Fast
                    </button>
                  </Tooltip>
                  <Tooltip content="Gemini 3.0 Pro (Thinking): Deep reasoning mode. Slower (45s+) but highly accurate.">
                    <button 
                      onClick={() => onToggleAiMode('detailed')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${aiMode === 'detailed' ? 'bg-white text-purple-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <BrainCircuit size={12} /> Detailed
                    </button>
                  </Tooltip>
              </div>
          </div>

          <div className="flex gap-3 w-full sm:w-auto">
            {selectedIds.size > 0 && (
              <Tooltip content="Permanently remove selected items and their reports." position="left">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-red-100 hover:bg-red-200 text-red-700 px-4 py-2 rounded-lg font-medium transition-colors cursor-pointer z-10 border border-red-200 active:scale-95"
                >
                  <Trash2 size={18} className="pointer-events-none" />
                  <span>Delete ({selectedIds.size})</span>
                </button>
              </Tooltip>
            )}

            <Tooltip content="Identify a new product via Image Upload or URL." position="left">
              <button
                onClick={onAddNew}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-md hover:shadow-lg active:scale-95"
              >
                <Plus size={18} className="pointer-events-none" />
                <span>New Product</span>
              </button>
            </Tooltip>
          </div>
        </div>

        {/* Filters Row */}
        <div className="flex flex-wrap items-center gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
           <div className="flex items-center gap-2 text-slate-500 text-sm font-medium mr-2">
             <Filter size={16} /> Filters:
           </div>
           
           <select 
             value={filterCategory}
             onChange={(e) => setFilterCategory(e.target.value)}
             className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
           >
             {allCategories.map(cat => (
               <option key={cat} value={cat}>{cat === 'All' ? 'All Categories' : cat}</option>
             ))}
           </select>

           <select 
             value={filterStatus}
             onChange={(e) => setFilterStatus(e.target.value)}
             className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
           >
             <option value="All">All Statuses</option>
             <option value="Pending">Pending QC</option>
             <option value={QCStatus.PASS}>Pass</option>
             <option value={QCStatus.FAIL}>Fail</option>
             <option value={QCStatus.WARNING}>Warning</option>
           </select>

           {hasActiveFilters && (
             <button 
               onClick={clearFilters}
               className="flex items-center gap-1 text-xs font-medium text-red-500 hover:text-red-700 ml-auto sm:ml-2 px-2 py-1 rounded hover:bg-red-50"
             >
               <XCircle size={14} /> Clear
             </button>
           )}
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
      ) : categories.length === 0 && hasActiveFilters ? (
         <div className="flex flex-col items-center justify-center py-12 text-center bg-white rounded-xl border border-slate-200">
            <p className="text-slate-500">No products match your filters.</p>
            <button onClick={clearFilters} className="mt-2 text-blue-600 text-sm font-medium hover:underline">Clear Filters</button>
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
