import React, { useState } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine, Cell 
} from 'recharts';
import { BudgetLine, ThemePalette } from '../types';
import { ArrowRightLeft, BarChart3 } from 'lucide-react';

interface ChartsProps {
  data: BudgetLine[];
  showInThousands: boolean;
  theme: ThemePalette;
  decimalPrecision: number;
}

export const SimulationChart: React.FC<ChartsProps> = ({ data, showInThousands, theme, decimalPrecision }) => {
  // Default to 'totals' as requested ("mutatie view als laatste")
  const [viewMode, setViewMode] = useState<'totals' | 'deltas'>('totals');

  // Helper for strict rounding to avoid floating point math errors during aggregation
  const round = (val: number) => {
    const factor = Math.pow(10, decimalPrecision);
    return Math.round(val * factor) / factor;
  };

  // 1. Prepare Data
  // We aggregate by category to avoid duplicate bars if multiple lines have same category name
  const aggregatedData = data.reduce((acc, curr) => {
    const existing = acc.find(item => item.name === curr.category);
    
    // Ensure row level calc is precise
    const lineFinal = round(curr.originalAmount + curr.adjustment);
    
    if (existing) {
      existing.original = round(existing.original + curr.originalAmount);
      existing.final = round(existing.final + lineFinal);
      existing.adjustment = round(existing.adjustment + curr.adjustment);
    } else {
      acc.push({
        name: curr.category,
        original: round(curr.originalAmount),
        final: lineFinal,
        adjustment: round(curr.adjustment)
      });
    }
    return acc;
  }, [] as { name: string, original: number, final: number, adjustment: number }[]);

  // 2. Filter Logic based on view
  // For Delta view, we mostly care about things that CHANGED, or we show all if list is short.
  // Let's sort by absolute adjustment impact for the Delta view.
  const deltaData = [...aggregatedData]
    .filter(d => Math.abs(d.adjustment) > 0) // Only show active shifts
    .sort((a, b) => b.adjustment - a.adjustment); // Positive on top, negative on bottom

  // For Totals view, sort by Final Amount size
  const totalData = [...aggregatedData].sort((a, b) => b.final - a.final);

  const formatValue = (val: number) => {
    if (val === 0) return '0';
    if (showInThousands) return `${(val / 1000).toFixed(1)}k`;
    // For large numbers on axis, keep it short
    if (Math.abs(val) >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
    if (Math.abs(val) >= 1000) return `${(val / 1000).toFixed(0)}k`;
    return val.toString();
  };

  const formatTooltipValue = (value: number) => {
    return new Intl.NumberFormat('nl-NL', { 
      style: 'currency', 
      currency: 'EUR',
      minimumFractionDigits: decimalPrecision,
      maximumFractionDigits: decimalPrecision
    }).format(value);
  };

  // Custom Tooltip Component
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload;
      
      return (
        <div className="bg-white p-3 border border-slate-200 rounded shadow-lg text-sm z-50 min-w-[200px]">
          <p className="font-bold mb-2 text-slate-800 border-b border-slate-100 pb-1">{item.name}</p>
          
          {viewMode === 'totals' ? (
            <div className="space-y-1.5">
               <div className="flex justify-between gap-4">
                  <span className="text-slate-500">Origineel:</span>
                  <span className="font-mono text-slate-700">{formatTooltipValue(item.original)}</span>
               </div>
               <div className="flex justify-between gap-4">
                  <span className="text-slate-500">Nieuw:</span>
                  <span className="font-mono font-bold" style={{ color: theme.primary }}>
                    {formatTooltipValue(item.final)}
                  </span>
               </div>
               <div className="flex justify-between gap-4 border-t border-slate-100 pt-1 mt-1">
                  <span className="text-slate-500">Verschil:</span>
                  <span className="font-mono font-medium" style={{ color: item.adjustment > 0 ? theme.primary : item.adjustment < 0 ? theme.highRisk : theme.text }}>
                    {item.adjustment > 0 ? '+' : ''}{formatTooltipValue(item.adjustment)}
                  </span>
               </div>
            </div>
          ) : (
            <div className="flex justify-between gap-4">
               <span className="text-slate-500">Verschuiving:</span>
               <span className="font-mono font-medium" style={{ color: item.adjustment > 0 ? theme.primary : theme.highRisk }}>
                 {item.adjustment > 0 ? '+' : ''}{formatTooltipValue(item.adjustment)}
               </span>
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 h-[500px] flex flex-col">
      
      {/* Header & Controls - Swapped Order */}
      <div className="flex flex-wrap items-center justify-between mb-4 gap-4">
        <div className="flex space-x-2 bg-slate-100 p-1 rounded-md">
          <button
            onClick={() => setViewMode('totals')}
            className={`flex items-center px-3 py-1.5 text-sm font-medium rounded transition-all ${viewMode === 'totals' ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <BarChart3 size={16} className="mr-2" />
            Totaal Budget
          </button>
          <button
            onClick={() => setViewMode('deltas')}
            className={`flex items-center px-3 py-1.5 text-sm font-medium rounded transition-all ${viewMode === 'deltas' ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <ArrowRightLeft size={16} className="mr-2" />
            Mutaties (Verschuiving)
          </button>
        </div>
      </div>

      {/* Chart Area */}
      <div className="flex-1 w-full min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          {viewMode === 'deltas' ? (
            /* DELTA / VARIANCE CHART (Horizontal) */
            <BarChart
              layout="vertical"
              data={deltaData.length > 0 ? deltaData : [{name: 'Geen wijzigingen', adjustment: 0}]}
              margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
              <XAxis 
                type="number" 
                tickFormatter={formatValue}
                stroke={theme.text}
                fontSize={12}
              />
              <YAxis 
                dataKey="name" 
                type="category" 
                width={120} 
                tick={{fill: theme.text, fontSize: 11}} 
                interval={0}
              />
              <Tooltip 
                content={<CustomTooltip />}
                cursor={{fill: '#f1f5f9'}}
              />
              <ReferenceLine x={0} stroke="#94a3b8" />
              <Bar dataKey="adjustment" name="Verschuiving" barSize={20} radius={[0, 4, 4, 0]}>
                {deltaData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={entry.adjustment > 0 ? theme.primary : theme.highRisk} 
                  />
                ))}
              </Bar>
            </BarChart>
          ) : (
            /* TOTALS CHART (Horizontal) - Linear Scale */
            <BarChart
              layout="vertical"
              data={totalData}
              margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
              <XAxis 
                type="number" 
                tickFormatter={formatValue}
                stroke={theme.text}
                fontSize={12}
              />
              <YAxis 
                dataKey="name" 
                type="category" 
                width={120} 
                tick={{fill: theme.text, fontSize: 11}} 
                interval={0}
              />
              <Tooltip 
                content={<CustomTooltip />}
                cursor={{fill: '#f1f5f9'}}
              />
              <Legend wrapperStyle={{fontSize: '12px', paddingTop: '10px'}} />
              <Bar dataKey="original" fill="#94a3b8" name="Oud Budget" radius={[0, 4, 4, 0]} barSize={10} />
              <Bar dataKey="final" fill={theme.primary} name="Nieuw Budget" radius={[0, 4, 4, 0]} barSize={10} />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
      
      {viewMode === 'deltas' && deltaData.length === 0 && (
         <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-slate-400 bg-white/80 px-4 py-2 rounded">Nog geen budgetverschuivingen gedaan.</p>
         </div>
      )}
    </div>
  );
};