
import React from 'react';
import { ViewState } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  currentView: ViewState;
  setView: (view: ViewState) => void;
}

const Layout: React.FC<LayoutProps> = ({ children, currentView, setView }) => {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <header className="sticky top-0 z-50 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div 
            onClick={() => setView('dashboard')}
            className="flex items-center gap-2 cursor-pointer"
          >
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold">
              Q
            </div>
            <h1 className="text-xl font-bold text-slate-800 tracking-tight">SmartQC</h1>
          </div>
          
          {currentView !== 'dashboard' && (
             <button 
               onClick={() => setView('dashboard')}
               className="text-sm font-medium text-slate-500 hover:text-slate-800"
             >
               Back to List
             </button>
          )}
        </div>
      </header>
      
      <main className="flex-1 w-full max-w-7xl mx-auto p-4 md:p-6">
        {children}
      </main>

      <footer className="py-6 text-center text-slate-400 text-sm">
        <p>Powered by Gemini 2.5 Flash & 3.0 Pro</p>
      </footer>
    </div>
  );
};

export default Layout;
