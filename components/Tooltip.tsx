import React from 'react';

interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
}

const Tooltip: React.FC<TooltipProps> = ({ content, children, position = 'top', className = '' }) => {
  return (
    <div className={`group relative flex items-center justify-center ${className}`}>
      {children}
      <div className={`
        absolute z-[999] pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-200
        bg-slate-800 text-white text-xs font-medium rounded px-3 py-2 max-w-[200px] w-max text-center shadow-xl
        ${position === 'top' ? 'bottom-full mb-2' : ''}
        ${position === 'bottom' ? 'top-full mt-2' : ''}
        ${position === 'left' ? 'right-full mr-2' : ''}
        ${position === 'right' ? 'left-full ml-2' : ''}
      `}>
        {content}
        {/* Arrow */}
        <div className={`
          absolute w-0 h-0 border-4 border-transparent
          ${position === 'top' ? 'border-t-slate-800 top-full left-1/2 -translate-x-1/2' : ''}
          ${position === 'bottom' ? 'border-b-slate-800 bottom-full left-1/2 -translate-x-1/2' : ''}
          ${position === 'left' ? 'border-l-slate-800 left-full top-1/2 -translate-y-1/2' : ''}
          ${position === 'right' ? 'border-r-slate-800 right-full top-1/2 -translate-y-1/2' : ''}
        `}></div>
      </div>
    </div>
  );
};

export default Tooltip;