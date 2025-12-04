
import React from 'react';
import { Product } from '../types';
import { Video, CheckSquare, Square, Loader2, AlertCircle, CheckCircle, AlertTriangle } from 'lucide-react';
import { isVideo } from '../utils';

interface ProductCardProps {
  product: Product;
  isSelected: boolean;
  onSelect: (product: Product) => void;
  onToggleSelection: (id: string) => void;
}

const ProductCard: React.FC<ProductCardProps> = ({ product, isSelected, onSelect, onToggleSelection }) => {
  const isProcessing = product.processingStatus === 'identifying' || product.processingStatus === 'analyzing';
  const progress = product.progress || 0;
  const hasError = !!product.error;

  return (
    <div className="flex flex-col isolate">
      <div
        className={`
          group relative bg-white rounded-xl border border-slate-200 
          overflow-hidden transition-all z-0 shadow-sm
          ${isProcessing ? 'cursor-wait opacity-90' : 'hover:shadow-md hover:border-blue-200'}
          ${isSelected ? 'ring-2 ring-blue-500 border-blue-500 bg-blue-50/10' : ''}
        `}
      >
        {/* Image Section */}
        <div 
          className="relative h-48 w-full bg-slate-100 flex items-center justify-center overflow-hidden cursor-pointer"
          onClick={() => !isProcessing && onSelect(product)}
        >
          {isVideo(product.mainImage) ? (
            <>
              <video src={product.mainImage} className="w-full h-full object-cover" muted playsInline />
              <div className="absolute inset-0 flex items-center justify-center bg-black/10">
                <Video className="text-white w-8 h-8 drop-shadow-md opacity-90" />
              </div>
            </>
          ) : (
            <img src={product.mainImage} alt={product.details.name} className="w-full h-full object-cover" />
          )}

          {/* Selection Checkbox */}
          <div 
             onClick={(e) => { 
               e.stopPropagation(); 
               e.nativeEvent.stopImmediatePropagation();
               onToggleSelection(product.id); 
             }}
             className="absolute top-2 left-2 z-30 cursor-pointer p-2 hover:scale-110 transition-transform"
          >
             {isSelected ? (
                <div className="bg-blue-600 text-white rounded shadow-sm">
                   <CheckSquare size={24} className="fill-blue-600 text-white" />
                </div>
             ) : (
                <div className="bg-white/90 text-slate-400 rounded shadow-sm backdrop-blur-sm hover:text-blue-600">
                   <Square size={24} />
                </div>
             )}
          </div>

          {/* Processing Overlay */}
          {isProcessing && (
            <div className="absolute inset-0 bg-white/90 z-20 flex flex-col items-center justify-center p-4">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-2" />
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                {product.processingStatus === 'identifying' ? 'Identifying...' : 'Inspecting...'}
              </span>
              <div className="w-full max-w-[120px] h-1.5 bg-slate-200 rounded-full mt-3 overflow-hidden">
                <div 
                  className="h-full bg-blue-600 rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}
        </div>
        
        {/* Content Section */}
        <div 
          className="p-4 cursor-pointer"
          onClick={() => !isProcessing && onSelect(product)}
        >
          <h3 className="font-semibold text-slate-900 line-clamp-1 mb-1" title={product.details.name}>
            {product.details.name}
          </h3>
          <div className="flex justify-between items-center mt-2">
             <p className="text-xs text-slate-500 font-mono">SKU: {product.details.sku}</p>
             
             {hasError ? (
               <div className="flex items-center gap-1 text-red-600">
                 <AlertCircle size={14} />
                 <span className="text-xs font-bold">Error</span>
               </div>
             ) : product.qcReports.length > 0 ? (
                <div className="flex items-center gap-1">
                  {product.qcReports[0].status === 'PASS' ? <CheckCircle size={14} className="text-emerald-500" /> :
                   product.qcReports[0].status === 'FAIL' ? <AlertTriangle size={14} className="text-red-500" /> :
                   <AlertTriangle size={14} className="text-amber-500" />}
                  <span className={`text-xs font-bold ${
                    product.qcReports[0].status === 'PASS' ? 'text-emerald-600' : 
                    product.qcReports[0].status === 'FAIL' ? 'text-red-600' : 'text-amber-600'
                  }`}>
                    {product.qcReports[0].status}
                  </span>
                </div>
             ) : (
                <span className="text-xs text-slate-400 italic">Pending QC</span>
             )}
          </div>
          
          {product.error && (
            <p className="text-xs text-red-500 mt-2 truncate font-medium bg-red-50 p-1 rounded">
              {product.error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProductCard;
