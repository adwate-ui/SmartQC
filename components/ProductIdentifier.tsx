
import React, { useState, useEffect } from 'react';
import { Camera, Upload, Video, Link as LinkIcon, Image as ImageIcon } from 'lucide-react';
import Tooltip from './Tooltip';

interface ProductIdentifierProps {
  onStartIdentification: (file: File | null, url: string | null) => void;
  onCancel: () => void;
}

type Mode = 'upload' | 'url';

const ProductIdentifier: React.FC<ProductIdentifierProps> = ({ onStartIdentification, onCancel }) => {
  const [mode, setMode] = useState<Mode>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState<string>('');
  const [preview, setPreview] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      setFile(selected);
      setPreview(URL.createObjectURL(selected));
    }
  };

  const handleSubmit = () => {
    if (mode === 'upload' && file) {
      onStartIdentification(file, null);
    } else if (mode === 'url' && url) {
      onStartIdentification(null, url);
    }
  };

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      // CRITICAL FIX: Ignore paste events originating from input fields
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return;
      }

      // Handle File Paste
      const items = e.clipboardData?.items;
      if (items) {
        for (let i = 0; i < items.length; i++) {
          if (items[i].kind === 'file') {
            const f = items[i].getAsFile();
            if (f && (f.type.startsWith('image/') || f.type.startsWith('video/'))) {
              setMode('upload');
              setFile(f);
              setPreview(URL.createObjectURL(f));
              return;
            }
          }
        }
      }
      
      // Handle Text/URL Paste if in URL mode or no file present
      const text = e.clipboardData?.getData('text');
      if (text && (text.startsWith('http') || mode === 'url')) {
        setMode('url');
        setUrl(text);
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [mode]);

  const isVideo = file?.type.startsWith('video/');

  return (
    <div className="max-w-xl mx-auto space-y-6 animate-fade-in">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-slate-900">Identify New Product</h2>
        <p className="text-slate-500">Upload a photo or enter a product URL.</p>
      </div>

      {/* Tabs */}
      <div className="flex bg-slate-100 p-1 rounded-lg">
        <div className="flex-1">
          <Tooltip content="Upload an image or video file directly from your device.">
            <button
              onClick={() => setMode('upload')}
              className={`w-full flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-md transition-all ${
                mode === 'upload' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <ImageIcon size={16} /> Upload Image
            </button>
          </Tooltip>
        </div>
        <div className="flex-1">
          <Tooltip content="Enter a direct link to the product page (e.g., Brand site, Amazon).">
            <button
              onClick={() => setMode('url')}
              className={`w-full flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-md transition-all ${
                mode === 'url' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <LinkIcon size={16} /> Product URL
            </button>
          </Tooltip>
        </div>
      </div>

      <div className="relative min-h-[250px]">
        {mode === 'upload' ? (
          !preview ? (
            <label className="flex flex-col items-center justify-center w-full h-64 border-2 border-dashed border-slate-300 rounded-2xl bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer group">
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <div className="flex gap-2 mb-3 text-slate-400 group-hover:text-blue-500 transition-colors">
                  <Camera className="w-10 h-10" />
                  <Video className="w-10 h-10" />
                </div>
                <p className="mb-2 text-sm text-slate-600"><span className="font-semibold">Click to upload</span> or paste</p>
              </div>
              <input type="file" className="hidden" accept="image/*,video/*" onChange={handleFileChange} />
            </label>
          ) : (
            <div className="relative w-full rounded-2xl overflow-hidden bg-black aspect-video shadow-lg">
               {isVideo ? (
                 <video src={preview || ''} controls className="w-full h-full object-contain" />
               ) : (
                 <img src={preview || ''} alt="Preview" className="w-full h-full object-contain" />
               )}
               
               <div className="absolute top-4 right-4 z-10">
                  <button 
                    onClick={() => { setFile(null); setPreview(null); }}
                    className="bg-black/50 text-white px-3 py-1.5 rounded-full text-sm hover:bg-black/70"
                  >
                    Change
                  </button>
               </div>
            </div>
          )
        ) : (
          <div className="flex flex-col gap-4">
             <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Product Page URL
                </label>
                <div className="relative">
                  <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type="url" 
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://brand.com/product/..."
                    className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  />
                </div>
                <p className="text-xs text-slate-500 mt-3">
                  Paste the direct link to the product page on the brand or retailer's website.
                </p>
             </div>
          </div>
        )}
      </div>

      <div className="flex gap-3 justify-end pt-4">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-slate-600 font-medium hover:text-slate-800"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={mode === 'upload' ? !file : !url}
          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-2 rounded-lg font-medium shadow-sm transition-transform active:scale-95"
        >
          Identify Product
        </button>
      </div>
    </div>
  );
};

export default ProductIdentifier;
