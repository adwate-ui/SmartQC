
import React from 'react';
import { QCReport } from '../types';
import { FileText, HelpCircle } from 'lucide-react';
import { isVideo } from '../utils';

interface QCReportCardProps {
  report: QCReport;
  onViewMedia: (src: string) => void;
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'PASS': return 'text-emerald-700 bg-emerald-50 border-emerald-200';
    case 'FAIL': return 'text-red-700 bg-red-50 border-red-200';
    case 'WARNING': return 'text-amber-700 bg-amber-50 border-amber-200';
    default: return 'text-slate-700 bg-slate-50 border-slate-200';
  }
};

const getSectionColor = (status: string) => {
   switch (status) {
    case 'PASS': return 'border-emerald-500 bg-emerald-50/30';
    case 'FAIL': return 'border-red-500 bg-red-50/30';
    case 'WARNING': return 'border-amber-500 bg-amber-50/30';
    default: return 'border-slate-200 bg-slate-50';
  }
};

const getSectionBadge = (status: string) => {
  switch (status) {
    case 'PASS': return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 uppercase">Pass</span>;
    case 'FAIL': return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-800 uppercase">Fail</span>;
    case 'WARNING': return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 uppercase">Caution</span>;
    default: return null;
  }
}

const QCReportCard: React.FC<QCReportCardProps> = ({ report, onViewMedia }) => {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="bg-slate-50 border-b border-slate-100 p-4 flex flex-wrap gap-2 justify-between items-center">
         <div className="flex items-center gap-2">
           <span className={`px-3 py-1 rounded-full font-bold text-xs uppercase border ${getStatusColor(report.status)}`}>
             {report.status}
           </span>
           <span className="text-slate-400 text-xs">ID: {report.id.slice(-6)}</span>
         </div>
         <span className="text-slate-500 text-xs">{new Date(report.timestamp).toLocaleString()}</span>
      </div>

      <div className="p-6">
        {/* Media Gallery */}
        {report.images?.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-4 mb-4 scrollbar-thin">
            {report.images.map((img, i) => (
              <div key={i} onClick={() => onViewMedia(img)} className="w-20 h-20 shrink-0 rounded-lg bg-slate-100 border border-slate-200 cursor-pointer overflow-hidden hover:opacity-90 transition-opacity">
                 {isVideo(img) ? <video src={img} className="w-full h-full object-cover"/> : <img src={img} className="w-full h-full object-cover"/>}
              </div>
            ))}
          </div>
        )}

        {/* Summary */}
        <div className="mb-6 bg-blue-50/50 p-4 rounded-lg border border-blue-100">
          <h4 className="font-bold text-sm mb-2 text-blue-900 flex items-center gap-2">
            <FileText size={16}/> Executive Summary
          </h4>
          <p className="text-sm text-slate-700 leading-relaxed">{report.summary}</p>
        </div>

        {/* Sections */}
        {report.sections && (
          <div className="grid sm:grid-cols-2 gap-4 mb-6">
            {report.sections.map((section, idx) => (
              <div key={idx} className={`rounded p-4 border-l-4 border-t border-r border-b ${getSectionColor(section.status)}`}>
                <div className="flex justify-between items-center mb-3">
                   <div className="flex items-center gap-2 flex-1 pr-4 min-w-0">
                     <h5 className="font-bold text-sm text-slate-900 truncate">{section.title}</h5>
                     {getSectionBadge(section.status)}
                   </div>
                   <span className="shrink-0 text-xs font-bold bg-white px-1.5 py-0.5 rounded border border-slate-200">{section.score}/100</span>
                </div>
                
                <div className="w-full bg-black/5 h-1 rounded-full mb-3">
                   <div className={`h-full rounded-full ${section.score > 80 ? 'bg-emerald-500' : section.score > 50 ? 'bg-amber-500' : 'bg-red-500'}`} style={{width: `${section.score}%`}}/>
                </div>
                
                <ul className="list-disc pl-4 space-y-1.5">
                  {Array.isArray(section.details) && section.details.map((d, i) => (
                    <li key={i} className="text-xs text-slate-700 leading-relaxed">{d}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}

        {/* Follow Up Requirements */}
        {report.followUp && report.followUp.required && (
           <div className="mt-4 border border-amber-200 bg-amber-50 rounded-lg p-4">
              <h4 className="flex items-center gap-2 text-sm font-bold text-amber-800 mb-2">
                <HelpCircle size={16} /> Additional Information Needed
              </h4>
              <p className="text-xs text-amber-900 mb-3">{report.followUp.missingInfo}</p>
              {report.followUp.suggestedAngles && report.followUp.suggestedAngles.length > 0 && (
                <div className="space-y-1">
                  <span className="text-xs font-bold text-amber-800">Suggested Angles:</span>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {report.followUp.suggestedAngles.map((angle, i) => (
                      <span key={i} className="text-xs bg-white border border-amber-200 text-amber-900 px-2 py-1 rounded-md">
                        {angle}
                      </span>
                    ))}
                  </div>
                </div>
              )}
           </div>
        )}
      </div>
    </div>
  );
};

export default QCReportCard;
