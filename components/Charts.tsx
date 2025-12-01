import React, { useState } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine, Cell, Treemap
} from 'recharts';
import { BudgetLine, ThemePalette } from '../types';
import { LayoutGrid, BarChart2, TrendingUp, HelpCircle } from 'lucide-react';

interface ChartsProps {
  data: BudgetLine[];
  showInThousands: boolean;
  theme: ThemePalette;
  decimalPrecision: number;
  newInvestment?: number;
}

type ChartView = 'treemap' | 'stacked' | 'waterfall';

export const SimulationChart: React.FC<ChartsProps> = ({ data, showInThousands, theme, decimalPrecision, newInvestment = 0 }) => {
  const [activeView, setActiveView] = useState<ChartView>('treemap');

  // --- HELPER FUNCTIONS ---

  const round = (val: number) => {
    const factor = Math.pow(10, decimalPrecision);
    return Math.round(val * factor) / factor;
  };

  const formatValue = (val: number) => {
    if (val === 0) return '0';
    if (showInThousands) return `${(val / 1000).toFixed(1)}k`;
    if (Math.abs(val) >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
    if (Math.abs(val) >= 1000) return `${(val / 1000).toFixed(0)}k`;
    return val.toString();
  };

  const formatTooltipCurrency = (value: number) => {
    return new Intl.NumberFormat('nl-NL', { 
      style: 'currency', 
      currency: 'EUR',
      minimumFractionDigits: decimalPrecision,
      maximumFractionDigits: decimalPrecision
    }).format(value);
  };

  // --- DATA PREPARATION ---

  // 1. Aggregate Data by Category (Common base)
  const aggregatedData = data.reduce((acc, curr) => {
    const existing = acc.find(item => item.name === curr.category);
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

  // 2. Inject "New Investment" if exists (handled as a synthetic item)
  if (newInvestment && newInvestment > 0) {
      aggregatedData.push({
          name: 'Nieuwe Investering',
          original: 0,
          final: round(newInvestment),
          adjustment: round(newInvestment)
      });
  }

  // Sort large to small for better visibility in most charts
  aggregatedData.sort((a, b) => b.final - a.final);

  // --- CHART SPECIFIC DATA BUILDERS ---

  // A. TREEMAP DATA
  // Filters out negative/zero finals to prevent render crashes
  const treemapData = aggregatedData
    .filter(d => d.final > 0)
    .map(d => ({ ...d, size: d.final })); // Recharts treemap uses 'size' or dataKey

  // B. STACKED BAR DATA (100% Normalized)
  // We need two objects: one for "Origineel", one for "Nieuw"
  // Keys are the category names.
  const getStackedData = () => {
    const originalBar: any = { name: 'Origineel Budget' };
    const finalBar: any = { name: 'Nieuw Budget' };
    
    aggregatedData.forEach(item => {
      if (item.original > 0) originalBar[item.name] = item.original;
      if (item.final > 0) finalBar[item.name] = item.final;
    });

    return [originalBar, finalBar];
  };

  // C. WATERFALL DATA
  // Start -> Steps (Deltas) -> End
  const getWaterfallData = () => {
    const points: any[] = [];
    
    // 1. Total Start (Sum of existing lines only, excluding synthetic investment which has 0 original)
    const totalOriginal = round(aggregatedData.reduce((acc, cur) => acc + cur.original, 0));
    points.push({
      name: 'Start (Origineel)',
      uv: totalOriginal, // 'uv' used for total column height
      type: 'total',
      fill: '#94a3b8' // Slate-400
    });

    let runningTotal = totalOriginal;

    // 2. Steps (Only non-zero adjustments)
    // Sort steps: positive first, then negative (conventional waterfall flow)
    const steps = aggregatedData.filter(d => d.adjustment !== 0)
        .sort((a, b) => b.adjustment - a.adjustment);

    steps.forEach(step => {
      const prevTotal = runningTotal;
      runningTotal = round(runningTotal + step.adjustment);
      
      // For a floating bar in Recharts, we provide [min, max] array as value
      // If adjustment is positive: [prev, current]
      // If adjustment is negative: [current, prev] (Recharts expects [min, max])
      const range = [Math.min(prevTotal, runningTotal), Math.max(prevTotal, runningTotal)];
      
      // Determine color
      let fillColor = step.adjustment > 0 ? theme.highRisk : theme.lowRisk;
      if (step.name === 'Nieuwe Investering') {
          fillColor = theme.text; // Distinct color for investment
      }

      points.push({
        name: step.name,
        range: range,
        adjustment: step.adjustment,
        type: 'step',
        fill: fillColor
      });
    });

    // 3. Total End
    points.push({
      name: 'Eind (Nieuw)',
      uv: runningTotal,
      type: 'total',
      fill: theme.primary
    });

    return points;
  };


  // --- RENDERERS ---

  // Custom Content for Treemap
  const TreemapContent = (props: any) => {
    const { x, y, width, height, name, value, depth } = props;
    const item = aggregatedData.find(d => d.name === name);
    
    // Color Logic: 
    // Neutral base. 
    // If adjusted up -> High Risk color mix
    // If adjusted down -> Low Risk color mix
    let fillColor = theme.primary; // Default
    
    if (name === 'Nieuwe Investering') {
        fillColor = theme.text; // Distinct
    } else if (item && item.adjustment > 0) {
        fillColor = theme.highRisk;
    } else if (item && item.adjustment < 0) {
        fillColor = theme.lowRisk;
    }

    return (
      <g>
        <rect
          x={x}
          y={y}
          width={width}
          height={height}
          style={{
            fill: fillColor,
            stroke: '#fff',
            strokeWidth: 2 / (depth + 1e-10),
            strokeOpacity: 1,
          }}
        />
        {width > 60 && height > 30 && (
          <foreignObject x={x} y={y} width={width} height={height}>
             <div className="flex flex-col items-center justify-center h-full p-1 text-center overflow-hidden">
                <span className="text-white font-bold text-xs truncate w-full px-1 drop-shadow-md">{name}</span>
                <span className="text-white/90 text-[10px] font-mono drop-shadow-md">{formatValue(value)}</span>
                {item && item.adjustment !== 0 && (
                   <span className="text-white font-bold text-[10px] bg-black/20 rounded px-1 mt-0.5">
                      {item.adjustment > 0 ? '+' : ''}{formatValue(item.adjustment)}
                   </span>
                )}
             </div>
          </foreignObject>
        )}
      </g>
    );
  };

  // Common Tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;

    if (activeView === 'treemap') {
      const dataItem = payload[0].payload;
      // Recharts treemap payload structure varies, ensure we have data
      const item = aggregatedData.find(d => d.name === dataItem.name);
      if (!item) return null;
      
      const isInvestment = item.name === 'Nieuwe Investering';

      return (
        <div className="bg-white p-3 border border-slate-200 rounded shadow-lg text-sm z-50 min-w-[200px]">
          <p className="font-bold mb-2 text-slate-800 border-b border-slate-100 pb-1">{item.name}</p>
          <div className="space-y-1">
             {!isInvestment && <div className="flex justify-between gap-4"><span className="text-slate-500">Origineel:</span> <span className="font-mono text-slate-700">{formatTooltipCurrency(item.original)}</span></div>}
             <div className="flex justify-between gap-4"><span className="text-slate-500">Nieuw:</span> <span className="font-mono font-bold" style={{color: theme.primary}}>{formatTooltipCurrency(item.final)}</span></div>
             <div className="flex justify-between gap-4 border-t pt-1 mt-1">
                <span className="text-slate-500">Verschil:</span>
                <span className="font-mono font-medium" style={{color: item.adjustment > 0 ? theme.highRisk : (item.adjustment < 0 ? theme.lowRisk : theme.text)}}>
                  {item.adjustment > 0 ? '+' : ''}{formatTooltipCurrency(item.adjustment)}
                </span>
             </div>
          </div>
        </div>
      );
    }

    if (activeView === 'waterfall') {
      const pt = payload[0].payload;
      const isStep = pt.type === 'step';
      // For steps, value is a range [min, max]. We want the magnitude (adjustment).
      // For totals, value is 'uv'.
      
      const val = isStep ? pt.adjustment : pt.uv;
      
      return (
         <div className="bg-white p-3 border border-slate-200 rounded shadow-lg text-sm z-50">
            <p className="font-bold mb-1 text-slate-800">{pt.name}</p>
            <div className="flex justify-between gap-4">
              <span className="text-slate-500">Waarde:</span>
              <span className="font-mono font-bold" style={{color: pt.fill}}>
                 {isStep && val > 0 ? '+' : ''}{formatTooltipCurrency(val)}
              </span>
            </div>
         </div>
      );
    }

    if (activeView === 'stacked') {
      // Stacked tooltip needs to show the breakdown
      return (
        <div className="bg-white p-3 border border-slate-200 rounded shadow-lg text-sm z-50">
          <p className="font-bold mb-2 text-slate-800">{label}</p>
          {payload.map((entry: any, index: number) => (
             <div key={index} className="flex justify-between gap-4 items-center">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{backgroundColor: entry.color}}></div>
                  <span className="text-slate-600 text-xs">{entry.name}:</span>
                </div>
                <span className="font-mono text-xs">{formatTooltipCurrency(entry.value)}</span>
             </div>
          ))}
        </div>
      );
    }

    return null;
  };

  // Color generator for Stacked Bar (needs distinct colors)
  const getCategoryColor = (name: string, index: number) => {
    if (name === 'Nieuwe Investering') return theme.text;

    // Simple palette rotation based on theme
    const palette = [
      theme.primary, theme.mediumRisk, theme.lowRisk, theme.highRisk,
      '#64748b', '#94a3b8', '#334155', '#475569'
    ];
    return palette[index % palette.length];
  };

  return (
    <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 h-[500px] flex flex-col">
      
      {/* View Switcher */}
      <div className="flex items-center justify-center mb-4">
         <div className="bg-slate-100 p-1 rounded-lg flex space-x-1">
            <button
               onClick={() => setActiveView('treemap')}
               className={`flex items-center px-4 py-2 text-sm font-medium rounded-md transition-all ${
                 activeView === 'treemap' ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'
               }`}
            >
               <LayoutGrid size={16} className="mr-2" />
               Treemap
            </button>
            <button
               onClick={() => setActiveView('stacked')}
               className={`flex items-center px-4 py-2 text-sm font-medium rounded-md transition-all ${
                 activeView === 'stacked' ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'
               }`}
            >
               <BarChart2 size={16} className="mr-2" />
               100% Stacked
            </button>
            <button
               onClick={() => setActiveView('waterfall')}
               className={`flex items-center px-4 py-2 text-sm font-medium rounded-md transition-all ${
                 activeView === 'waterfall' ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'
               }`}
            >
               <TrendingUp size={16} className="mr-2" />
               Waterfall
            </button>
         </div>
      </div>

      {/* Chart Render Area */}
      <div className="flex-1 w-full min-h-0">
         <ResponsiveContainer width="100%" height="100%">
            {activeView === 'treemap' ? (
               <Treemap
                  data={treemapData}
                  dataKey="size"
                  aspectRatio={4 / 3}
                  stroke="#fff"
                  content={<TreemapContent />}
               >
                  <Tooltip content={<CustomTooltip />} />
               </Treemap>
            ) : activeView === 'stacked' ? (
               <BarChart
                  data={getStackedData()}
                  stackOffset="expand" // This makes it 100% stacked
                  margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
               >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" stroke={theme.text} fontSize={12} tickLine={false} />
                  <YAxis tickFormatter={(val) => `${(val * 100).toFixed(0)}%`} stroke={theme.text} fontSize={12} />
                  <Tooltip content={<CustomTooltip />} />
                  {/* Generate Bars for each category */}
                  {aggregatedData.map((cat, index) => (
                     <Bar 
                        key={cat.name} 
                        dataKey={cat.name} 
                        stackId="a" 
                        fill={getCategoryColor(cat.name, index)} 
                     />
                  ))}
               </BarChart>
            ) : (
               /* WATERFALL */
               <BarChart
                  data={getWaterfallData()}
                  margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
               >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" stroke={theme.text} fontSize={10} interval={0} tick={{width: 50}} />
                  <YAxis tickFormatter={formatValue} stroke={theme.text} fontSize={12} />
                  <Tooltip content={<CustomTooltip />} />
                  <ReferenceLine y={0} stroke="#000" />
                  
                  {/* Totals (Start/End) */}
                  <Bar dataKey="uv" stackId="a" barSize={40}>
                     {getWaterfallData().map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                     ))}
                  </Bar>
                  
                  {/* Floating Steps */}
                  <Bar dataKey="range" stackId="a" barSize={40}>
                     {getWaterfallData().map((entry, index) => (
                        <Cell key={`range-${index}`} fill={entry.fill} />
                     ))}
                  </Bar>
               </BarChart>
            )}
         </ResponsiveContainer>
      </div>
    </div>
  );
};