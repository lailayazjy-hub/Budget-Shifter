import React, { useState } from 'react';
import { BudgetLine, ThemePalette } from '../types';
import { MessageSquare, Plus, Minus } from 'lucide-react';

interface BudgetRowProps {
  item: BudgetLine;
  onUpdate: (id: string, adjustment: number) => void;
  onAddComment: (id: string, text: string) => void;
  showInThousands: boolean;
  decimalPrecision: number;
  theme: ThemePalette;
}

export const BudgetRow: React.FC<BudgetRowProps> = ({ 
  item, 
  onUpdate, 
  onAddComment,
  showInThousands,
  decimalPrecision,
  theme
}) => {
  const [isCommentsOpen, setCommentsOpen] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [isEditingTotal, setIsEditingTotal] = useState(false);

  const formatMoney = (amount: number) => {
    if (showInThousands) {
      return `€ ${(amount / 1000).toFixed(1)}k`;
    }
    return new Intl.NumberFormat('nl-NL', { 
      style: 'currency', 
      currency: 'EUR',
      minimumFractionDigits: decimalPrecision,
      maximumFractionDigits: decimalPrecision
    }).format(amount);
  };

  const finalAmount = item.originalAmount + item.adjustment;
  const isNegative = finalAmount < 0;

  // Handlers for direct adjustment changes
  const handleAdjustmentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    if (!isNaN(val)) {
      onUpdate(item.id, val);
    } else if (e.target.value === '' || e.target.value === '-') {
       onUpdate(item.id, 0); 
    }
  };

  const handleTotalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    if (!isNaN(val)) {
      onUpdate(item.id, val - item.originalAmount);
    }
  };

  const handleStep = (step: number) => {
    onUpdate(item.id, item.adjustment + step);
  };

  const handleCommentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newComment.trim()) {
      onAddComment(item.id, newComment);
      setNewComment("");
    }
  };

  return (
    <div className={`group border-b border-slate-100 hover:bg-slate-50 transition-colors`}>
      <div className="grid grid-cols-12 gap-4 p-4 items-center">
        {/* Info */}
        <div className="col-span-3">
          <div className="flex items-center space-x-2">
            <span className="font-medium" style={{ color: item.isBuffer ? theme.primary : theme.text }}>
              {item.category}
            </span>
            {item.isBuffer && (
              <span 
                className="text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wide"
                style={{ backgroundColor: `${theme.lowRisk}40`, color: theme.primary }}
              >
                Buffer
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 truncate">{item.description}</p>
        </div>

        {/* Original */}
        <div className="col-span-2 text-right text-slate-500 font-mono text-sm">
          {formatMoney(item.originalAmount)}
        </div>

        {/* Controls (Step & Direct Adjustment) */}
        <div className="col-span-4 px-2 flex items-center justify-center space-x-2">
           <button 
             onClick={() => handleStep(-100)}
             className="p-1 rounded hover:bg-slate-200 text-slate-400"
             title="-100"
           >
             <Minus size={14} />
           </button>
           
           <div className="relative">
             <input 
                type="number"
                step={Math.pow(10, -decimalPrecision)}
                className="w-24 text-center bg-white border border-slate-200 rounded px-2 py-1 text-sm font-semibold focus:outline-none focus:ring-1"
                style={{ 
                  color: item.adjustment !== 0 ? (item.adjustment > 0 ? theme.primary : theme.highRisk) : theme.text,
                  borderColor: item.adjustment !== 0 ? (item.adjustment > 0 ? theme.primary : theme.highRisk) : '#e2e8f0' 
                }}
                value={item.adjustment === 0 ? '' : item.adjustment}
                placeholder="0"
                onChange={handleAdjustmentChange}
             />
           </div>

           <button 
             onClick={() => handleStep(100)}
             className="p-1 rounded hover:bg-slate-200 text-slate-400"
             title="+100"
           >
             <Plus size={14} />
           </button>
        </div>

        {/* Final Result - Formatted matches Original, Click to Edit */}
        <div className="col-span-2 text-right font-mono text-sm font-semibold">
           {isEditingTotal && !showInThousands ? (
              <input 
                autoFocus
                type="number"
                step={Math.pow(10, -decimalPrecision)}
                className="w-full text-right bg-white border border-slate-300 rounded px-1 focus:outline-none focus:ring-2"
                style={{ color: isNegative ? theme.highRisk : theme.text }}
                value={finalAmount}
                onChange={handleTotalChange}
                onBlur={() => setIsEditingTotal(false)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') setIsEditingTotal(false);
                }}
              />
           ) : (
              <span 
                className="cursor-pointer hover:underline decoration-dashed decoration-slate-300"
                style={{ color: isNegative ? theme.highRisk : theme.text }}
                onClick={() => !showInThousands && setIsEditingTotal(true)}
                title="Klik om aan te passen"
              >
                {formatMoney(finalAmount)}
              </span>
           )}
        </div>

        {/* Actions */}
        <div className="col-span-1 flex justify-end">
          <button 
            onClick={() => setCommentsOpen(!isCommentsOpen)}
            className={`p-2 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-600 relative`}
            style={{ color: item.comments.length > 0 ? theme.primary : undefined }}
          >
            <MessageSquare size={16} />
            {item.comments.length > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full" style={{ backgroundColor: theme.highRisk }}></span>
            )}
          </button>
        </div>
      </div>

      {/* Expanded Details/Comments */}
      {isCommentsOpen && (
        <div className="bg-slate-50 p-4 border-t border-slate-100 ml-4 border-l-2" style={{ borderColor: theme.mediumRisk }}>
           <div className="space-y-3 mb-4">
             {item.comments.length === 0 ? (
               <p className="text-xs text-slate-400 italic">Geen opmerkingen.</p>
             ) : (
               item.comments.map(c => (
                 <div key={c.id} className="text-sm">
                    <div className="flex justify-between text-xs text-slate-500 mb-0.5">
                      <span className="font-semibold" style={{ color: theme.primary }}>{c.author}</span>
                      <span>{c.timestamp.toLocaleString('nl-NL')}</span>
                    </div>
                    <p className="bg-white p-2 rounded shadow-sm border border-slate-100" style={{ color: theme.text }}>{c.text}</p>
                 </div>
               ))
             )}
           </div>
           
           <form onSubmit={handleCommentSubmit} className="flex gap-2">
             <input 
               type="text" 
               className="flex-1 text-sm border border-slate-300 rounded px-3 py-1.5 focus:outline-none focus:ring-1"
               style={{ caretColor: theme.primary }}
               placeholder="Voeg een management opmerking toe..."
               value={newComment}
               onChange={(e) => setNewComment(e.target.value)}
             />
             <button 
               type="submit" 
               className="text-xs text-white px-3 py-1.5 rounded hover:opacity-90"
               style={{ backgroundColor: theme.text }}
             >
               Plaatsen
             </button>
           </form>
        </div>
      )}
    </div>
  );
};