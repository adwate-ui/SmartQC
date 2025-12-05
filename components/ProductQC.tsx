import React, { useState } from 'react';
import { Product } from '../types';
import { fileToBase64 } from '../utils';
import { Upload, X, Loader2, Camera, ExternalLink, ChevronLeft, Star, Info } from 'lucide-react';
import { isVideo, safeLink } from '../utils';
import QCReportCard from './QCReportCard';
import Tooltip from './Tooltip';

interface ProductQCProps {
  product: Product;
  onStartQC: (files: File[], isExpertMode: boolean) => void;
  onBack: () => void;
}

const ProductQC: React.FC<ProductQCProps> = ({ product, onStartQC, onBack }) => {
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [viewMedia, setViewMedia] = useState<string | null>(null);
  const [isExpertMode, setIsExpertMode] = useState(false);

  const isProcessing = product.processingStatus === 'analyzing';
  const progress = product.progress || 0;

  const processFiles = async (newFiles: File[]) => {
    setFiles(prev => [...prev, ...newFiles]);
    const newPreviews = await Promise.all(newFiles.map(f => fileToBase64(f)));
    setPreviews(prev => [...prev, ...newPreviews]);
  };

  const handleFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      await processFiles(Array.from(e.target.files));
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const droppedFiles = (Array.from(e.dataTransfer.files) as File[]).filter(f => f.type.startsWith('image/') || f.type.startsWith('video/'));
    if (droppedFiles.length > 0) await processFiles(droppedFiles);
  };

  const handleRunQC = () => {
    if (files.length > 0) {
      onStartQC(files, isExpertMode);
      setFiles([]);
      setPreviews([]);
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
    setPreviews(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pb-10">
      {viewMedia && (
        <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-4" onClick={() => setViewMedia(null)}>
          <button className="absolute top-4 right-4 text-white p-2"><X size={32} /></button>
          <div className="max-w-full max-h-full overflow-auto flex items-center justify-center" onClick={e => e.stopPropagation()}>
            {isVideo(viewMedia) ? <video src={viewMedia} controls autoPlay className="max-w-full max-h-[90vh]" /> : <img src={viewMedia} alt="Full" className="max-w-full max-h-[90vh] object-contain" />}
          </div>
        </div>
      )}

      {/* Sidebar */}
      <div className="lg:col-span-4 relative">
        <div className="sticky top-24 space-y-6 max-h-[calc(100vh-8rem)] overflow-y-auto pr-1 pb-4 scrollbar-hide">
          <button onClick={onBack} className="flex items-center text-slate-500 hover:text-slate-800 mb-2">
            <ChevronLeft size={16} /> Back to Dashboard
          </button>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="relative h-56 bg-slate-100 cursor-pointer" onClick={() => setViewMedia(product.mainImage)}>
              {isVideo(product.mainImage) ? <video src={product.mainImage} className="w-full h-full object-cover" muted autoPlay loop /> : <img src={product.mainImage} alt={product.details.name} className="w-full h-full object-cover" />}
              <div className="absolute top-2 left-2 bg-black/60 text-white px-2 py-1 rounded text-xs">Reference</div>
            </div>
            <div className="p-5">
              <h2 className="text-xl font-bold text-slate-800 mb-1">{product.details.name}</h2>
              <p className="text-slate-500 font-mono text-sm mb-4 bg-slate-100 inline-block px-2 rounded">{product.details.sku}</p>
              
              <div className="divide-y divide-slate-100 border-t border-slate-100 mt-3">
                 <div className="flex py-3"><span className="text-slate-400 text-sm w-20 shrink-0">Category</span><span className="font-medium text-slate-800 text-sm text-right flex-1">{product.details.category}</span></div>
                 <div className="flex py-3"><span className="text-slate-400 text-sm w-20 shrink-0">Material</span><span className="font-medium text-slate-800 text-sm text-right flex-1">{product.details.material}</span></div>
                 <div className="flex py-3"><span className="text-slate-400 text-sm w-20 shrink-0">Est. Cost</span><span className="font-medium text-slate-800 text-sm text-right flex-1">{product.details.estimatedCost}</span></div>
                 {product.details.productUrl && (
                   <div className="py-3">
                     <a 
                       href={safeLink(product.details.productUrl)} 
                       target="_blank" 
                       rel="noreferrer" 
                       className="flex items-center gap-1 text-blue-600 hover:underline text-sm font-medium"
                     >
                       <ExternalLink size={14} /> Product Details
                     </a>
                   </div>
                 )}
              </div>
            </div>
          </div>

          {/* Inspection Card with Progress Bar */}
          <div 
            className={`bg-white p-5 rounded-xl border shadow-sm ring-1 transition-all relative overflow-hidden ${isDragging ? 'border-blue-500 ring-4 ring-blue-200 bg-blue-50' : 'border-blue-200 ring-blue-100'}`}
            onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
          >
            {isProcessing && (
              <div className="absolute inset-0 bg-white/95 z-20 flex flex-col items-center justify-center p-6 text-center">
                <Loader2 className="animate-spin text-blue-600 mb-3" size={40} />
                <span className="text-sm font-bold text-slate-800">Inspection Running...</span>
                <div className="w-full h-2 bg-slate-200 rounded-full mt-4 overflow-hidden">
                  <div className="h-full bg-blue-600 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
                </div>
                <span className="text-xs text-slate-500 mt-2">You can leave this page.</span>
              </div>
            )}

            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                   <h3 className="font-bold text-slate-800 flex items-center gap-2">
                       <Camera size={20} className="text-blue-600" /> Perform Inspection
                   </h3>
                   <Tooltip content="Upload photos/videos of the current item condition to compare against the reference.">
                     <Info size={14} className="text-slate-400 cursor-help" />
                   </Tooltip>
                </div>
                
                {/* Expert Mode Toggle */}
                <Tooltip content="Switch to a strict, world-class expert persona. Results will be more critical and detailed." position="left">
                    <button
                        onClick={() => setIsExpertMode(!isExpertMode)}
                        className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-bold transition-all ${isExpertMode ? 'bg-amber-100 text-amber-700 ring-1 ring-amber-200' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                    >
                        <Star size={12} className={isExpertMode ? "fill-current" : ""} />
                        {isExpertMode ? "Expert Mode" : "Normal Mode"}
                    </button>
                </Tooltip>
            </div>
            
            <div className="space-y-4">
              <label className="block w-full cursor-pointer">
                <input type="file" multiple accept="image/*,video/*" onChange={handleFiles} className="hidden" />
                <div className="border-2 border-dashed border-blue-300 bg-blue-50/50 rounded-lg p-6 flex flex-col items-center justify-center text-slate-600 hover:bg-blue-50 transition-colors">
                  <Upload size={24} className="text-blue-400 mb-2" />
                  <span className="text-sm font-bold text-blue-700">Upload Media</span>
                </div>
              </label>

              {previews.length > 0 && (
                <div className="grid grid-cols-4 gap-2">
                  {previews.map((src, idx) => (
                    <div key={idx} className="relative aspect-square rounded bg-black">
                       {isVideo(src) ? <video src={src} className="w-full h-full object-cover opacity-70"/> : <img src={src} className="w-full h-full object-cover"/>}
                       <button onClick={() => removeFile(idx)} className="absolute top-0 right-0 bg-red-500 text-white p-0.5 rounded-bl"><X size={12}/></button>
                    </div>
                  ))}
                </div>
              )}

              <button
                onClick={handleRunQC}
                disabled={isProcessing || previews.length === 0}
                className={`w-full py-3 text-white rounded-lg font-bold disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors ${isExpertMode ? 'bg-amber-600 hover:bg-amber-700' : 'bg-blue-600 hover:bg-blue-700'}`}
              >
                {isExpertMode ? "Start Expert Inspection" : "Start Inspection"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Reports */}
      <div className="lg:col-span-8 space-y-8">
        <div className="flex items-center justify-between">
          <h3 className="text-2xl font-bold text-slate-800">Inspection History</h3>
          <span className="text-sm text-slate-500">{product.qcReports.length} reports</span>
        </div>
        
        {product.qcReports.map((report) => (
          <QCReportCard key={report.id} report={report} onViewMedia={setViewMedia} />
        ))}
      </div>
    </div>
  );
};

export default ProductQC;