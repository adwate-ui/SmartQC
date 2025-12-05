import React, { useState } from 'react';
import { Key, ShieldCheck, Info } from 'lucide-react';
import Tooltip from './Tooltip';

interface ApiKeyModalProps {
  onSave: (key: string) => void;
}

const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ onSave }) => {
  const [inputKey, setInputKey] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputKey.trim().length > 10) {
      onSave(inputKey.trim());
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 animate-fade-in">
        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-amber-100 rounded-full flex items-center justify-center text-amber-600 mx-auto mb-4">
            <Key size={28} />
          </div>
          <h2 className="text-xl font-bold text-slate-900">Enter Gemini API Key</h2>
          <p className="text-slate-500 mt-2 text-sm">
            To power the AI features for your account, please provide your personal Google Gemini API key.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1">
               <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">API Key</label>
               <Tooltip content="Your key is stored ONLY in your browser's Local Storage. We do not transmit it to any backend server." position="left">
                 <Info size={12} className="text-slate-400 cursor-help" />
               </Tooltip>
            </div>
            <input 
              type="password" 
              value={inputKey}
              onChange={(e) => setInputKey(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none font-mono text-sm"
              placeholder="AIzaSy..."
              autoFocus
            />
          </div>

          <button 
            type="submit"
            disabled={inputKey.length < 10}
            className="w-full bg-amber-500 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-3 rounded-xl transition-all shadow-md active:scale-95 flex items-center justify-center gap-2"
          >
            <ShieldCheck size={18} /> Save & Continue
          </button>
        </form>
        
        <div className="mt-6 text-center">
            <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-blue-600 text-sm hover:underline">
                Get an API key here
            </a>
        </div>
      </div>
    </div>
  );
};

export default ApiKeyModal;