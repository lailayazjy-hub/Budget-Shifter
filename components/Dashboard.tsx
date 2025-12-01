import React, { useState, useRef } from 'react';
import { BudgetLine, AppSettings, UploadedFile, Theme, ValidationError } from '../types';
import { BudgetRow } from './BudgetRow';
import { SimulationChart } from './Charts';
import { Button } from './ui/Button';
import { Toggle } from './ui/Toggle';
import { WoodpeckerLogo } from './ui/Logo';
import { analyzeBudgetShift, suggestOptimizations } from '../services/geminiService';
import { parseFile, generateTemplate } from '../services/fileImportService';
import { Download, Upload, Cpu, BrainCircuit, FileSpreadsheet, Settings, X, Target, ArrowRightLeft, AlertTriangle, CheckCircle, FileDown, PlayCircle, Percent, Scale, TrendingDown, PlusCircle } from 'lucide-react';

// --- THEME DEFINITIONS ---
const THEMES: Theme[] = [
  {
    id: 'terraCotta',
    name: 'Terra Cotta Landscape',
    colors: { highRisk: '#D66D6B', mediumRisk: '#F3B0A9', lowRisk: '#BDD7C6', primary: '#52939D', text: '#242F4D' }
  },
  {
    id: 'forestGreen',
    name: 'Forest Green',
    colors: { highRisk: '#9A6C5A', mediumRisk: '#E4F46A', lowRisk: '#2E7B57', primary: '#2E7B57', text: '#14242E' }
  },
  {
    id: 'autumnLeaves',
    name: 'Autumn Leaves',
    colors: { highRisk: '#2E2421', mediumRisk: '#B49269', lowRisk: '#B1782F', primary: '#B1782F', text: '#8B8F92' }
  },
  {
    id: 'citrusGarden',
    name: 'Citrus Garden',
    colors: { highRisk: '#F8B24A', mediumRisk: '#FDD268', lowRisk: '#8FAB56', primary: '#4D7B41', text: '#242F4D' }
  }
];

// Initial mock data is only used UNTIL a file is uploaded
const MOCK_DATA: BudgetLine[] = [
  { id: '1', category: 'General Buffer', description: 'Centrale onvoorziene kosten', originalAmount: 250000, adjustment: 0, isBuffer: true, comments: [], sourceFile: 'Voorbeeld Data' },
  { id: '2', category: 'Marketing', description: 'Q3 Campagne', originalAmount: 45000, adjustment: 0, isBuffer: false, comments: [], sourceFile: 'Voorbeeld Data' },
  { id: '3', category: 'IT', description: 'Licenties & Hardware', originalAmount: 120000, adjustment: 0, isBuffer: false, comments: [], sourceFile: 'Voorbeeld Data' },
  { id: '4', category: 'HR', description: 'Werving & Selectie', originalAmount: 35000, adjustment: 0, isBuffer: false, comments: [], sourceFile: 'Voorbeeld Data' },
  { id: '5', category: 'Sales', description: 'Reiskosten buitenland', originalAmount: 15000, adjustment: 0, isBuffer: false, comments: [], sourceFile: 'Voorbeeld Data' },
  { id: '6', category: 'Office', description: 'Kantine benodigdheden', originalAmount: 45, adjustment: 0, isBuffer: false, comments: [], sourceFile: 'Voorbeeld Data' }, 
];

export const Dashboard: React.FC = () => {
  // Start with empty data, as per requirement
  const [budgetLines, setBudgetLines] = useState<BudgetLine[]>([]);
  const [hasUploadedData, setHasUploadedData] = useState(false);
  
  const [settings, setSettings] = useState<AppSettings>({
    appName: "BudgetFlow Pro",
    themeId: 'terraCotta',
    showInThousands: false,
    hideSmallAmounts: false, // Default disabled as per requirements
    smallAmountThreshold: 50,
    showAiAnalysis: false,
    showMachineLearning: false,
    decimalPrecision: 2, // Default standard financial precision
  });
  
  const [activeTab, setActiveTab] = useState<string>('simulation');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [isProcessingFile, setIsProcessingFile] = useState(false);

  // Shortage Mode State
  // User enters POSITIVE amount they are short (e.g. 50000).
  const [shortageInput, setShortageInput] = useState<number>(0);

  const [aiAnalysis, setAiAnalysis] = useState<string>("");
  const [mlSuggestion, setMlSuggestion] = useState<string>("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Get Active Theme
  const activeTheme = THEMES.find(t => t.id === settings.themeId) || THEMES[0];
  const { colors } = activeTheme;

  const handlePrecisionChange = (newPrecision: number) => {
    // Re-calculate/round all adjustments when precision changes
    const factor = Math.pow(10, newPrecision);
    
    setBudgetLines(prev => prev.map(line => ({
      ...line,
      originalAmount: Math.round(line.originalAmount * factor) / factor,
      adjustment: Math.round(line.adjustment * factor) / factor
    })));
    
    setSettings(s => ({...s, decimalPrecision: newPrecision as 0|1|2 }));
  };

  // Computed state for filtered lines
  const filteredLines = budgetLines.filter(line => {
    if (settings.hideSmallAmounts && line.originalAmount < settings.smallAmountThreshold) return false;
    // If we have uploaded files, respect their visibility toggle
    if (hasUploadedData) {
       const file = uploadedFiles.find(f => f.name === line.sourceFile);
       return file ? file.isVisible : true;
    }
    return true;
  });

  // Calculate totals to be used in validation
  const totalAdjustment = filteredLines.reduce((acc, l) => acc + l.adjustment, 0);
  const totalOriginal = filteredLines.reduce((acc, l) => acc + l.originalAmount, 0);

  // LOGIC CHANGE: 
  // The 'ShortageInput' acts as an "Unbudgeted New Item" (Positive Cost).
  // The 'TotalFinal' = Original Lines (Adjusted) + New Item.
  // The Goal is for TotalFinal == TotalOriginal.
  // This means Sum(Adjustments) + ShortageInput must be 0.
  // So Sum(Adjustments) must be = -ShortageInput.
  
  const totalFinal = totalOriginal + totalAdjustment + shortageInput;
  
  // The "Gap" is how much more we need to cut to balance the books.
  // Gap = (Adjustments + Shortage). We want this to be 0.
  // If Shortage is 50k, and Adjustments are 0, Gap is 50k (Positive = Bad, need to cut).
  // If Adjustments are -50k, Gap is 0.
  const currentGap = shortageInput + totalAdjustment;
  
  // Precision check for zero
  const precisionEpsilon = 1 / Math.pow(10, settings.decimalPrecision + 1);
  const isBalanced = Math.abs(totalFinal - totalOriginal) < precisionEpsilon;

  const handleUpdateAdjustment = (id: string, newAdjustment: number) => {
    // Round the input adjustment to the setting precision to avoid floating point drift
    const factor = Math.pow(10, settings.decimalPrecision);
    const roundedAdj = Math.round(newAdjustment * factor) / factor;
    
    setBudgetLines(prev => prev.map(line => 
      line.id === id ? { ...line, adjustment: roundedAdj } : line
    ));
  };

  const handleAddComment = (id: string, text: string) => {
    const newComment = {
      id: Date.now().toString(),
      author: "Fin. Controller",
      text,
      timestamp: new Date()
    };
    setBudgetLines(prev => prev.map(line => 
      line.id === id ? { ...line, comments: [...line.comments, newComment] } : line
    ));
  };

  const applyDistributeGap = () => {
    if (totalOriginal === 0 || isBalanced) return;

    // We want to eliminate the GAP.
    // Gap = 50k. We need to apply -50k.
    // Ratio = -Gap / TotalOriginal.
    
    const ratio = -currentGap / totalOriginal;
    const factor = Math.pow(10, settings.decimalPrecision);

    const newLines = budgetLines.map(line => {
      // Calculate share of the gap for this line
      const delta = line.originalAmount * ratio;
      // Add to existing adjustment
      const newAdjRaw = line.adjustment + delta;
      const roundedAdj = Math.round(newAdjRaw * factor) / factor;
      return { ...line, adjustment: roundedAdj };
    });

    setBudgetLines(newLines);
  };

  const handleLoadDemo = () => {
    setBudgetLines(MOCK_DATA);
    setHasUploadedData(false); 
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingFile(true);
    setValidationErrors([]);
    
    try {
      const result = await parseFile(file, settings.decimalPrecision);
      
      if (result.errors.length > 0 && result.data.length === 0) {
        setValidationErrors(result.errors);
        setIsProcessingFile(false);
        return;
      }

      if (result.errors.length > 0) {
        setValidationErrors(result.errors);
      }

      const newFileEntry: UploadedFile = {
        id: result.fileName, 
        name: result.fileName,
        data: result.data,
        isVisible: true
      };

      setUploadedFiles(prev => {
        const isFirstRealUpload = !hasUploadedData;
        if (isFirstRealUpload) {
          return [newFileEntry];
        }
        return [...prev, newFileEntry];
      });

      setBudgetLines(prev => {
        if (!hasUploadedData) {
          setHasUploadedData(true);
          return result.data;
        }
        return [...prev, ...result.data];
      });

    } catch (error) {
      console.error(error);
      setValidationErrors([{ row: 0, message: "Onverwachte fout bij inlezen bestand." }]);
    } finally {
      setIsProcessingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const runAiAnalysis = async () => {
    if (!hasUploadedData) {
        setAiAnalysis("Upload eerst uw eigen data om een AI analyse te starten.");
        return;
    }
    setIsAnalyzing(true);
    const analysis = await analyzeBudgetShift(filteredLines);
    setAiAnalysis(analysis);
    if (settings.showMachineLearning) {
        const suggestion = await suggestOptimizations(filteredLines);
        setMlSuggestion(suggestion);
    }
    setIsAnalyzing(false);
  };

  const toggleFileVisibility = (fileName: string) => {
    setUploadedFiles(prev => prev.map(f => 
      f.name === fileName ? { ...f, isVisible: !f.isVisible } : f
    ));
  };

  let statusLabel = "Budget Neutraal";
  let statusColor = colors.lowRisk; // Greenish by default
  
  // Logic check:
  // If totalFinal > totalOriginal -> BAD (Over budget)
  // If totalFinal < totalOriginal -> GOOD (Savings)
  // If totalFinal == totalOriginal -> NEUTRAL (Balanced)

  if (totalFinal > totalOriginal + precisionEpsilon) {
      statusLabel = "Nog te compenseren";
      statusColor = colors.highRisk;
  } else if (totalFinal < totalOriginal - precisionEpsilon) {
      statusLabel = "Besparing gerealiseerd";
      statusColor = colors.primary;
  }
  
  // Calculate what % of the remaining gap represents vs total
  const gapPercentage = totalOriginal > 0 ? (currentGap / totalOriginal) * 100 : 0;

  const exportToCSV = () => {
    const headers = ["Categorie", "Omschrijving", "Bronbestand", "Origineel", "Aanpassing", "Nieuw Budget", "Opmerkingen"];
    const rows = filteredLines.map(l => [
      l.category,
      l.description,
      l.sourceFile || '',
      l.originalAmount,
      l.adjustment,
      l.originalAmount + l.adjustment,
      l.comments.map(c => c.text).join('; ')
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${settings.appName}_export.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 relative overflow-hidden">
      
      {/* WOODPECKER WATERMARK */}
      <div className="absolute bottom-[-20px] right-[-20px] pointer-events-none z-0 opacity-5">
         <WoodpeckerLogo className="w-[400px] h-[400px]" />
      </div>

      {/* Top Toolbar */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center space-x-6">
           <div className="flex items-center gap-3">
              <WoodpeckerLogo className="w-8 h-8 opacity-90" />
              <h1 className="text-xl font-bold tracking-tight" style={{ color: colors.text }}>
                {settings.appName}
              </h1>
           </div>
           
           <div className="h-6 w-px bg-slate-200 mx-2"></div>
           
           <div className="flex space-x-4">
              <Toggle 
                label="Toon in 'k'" 
                checked={settings.showInThousands} 
                onChange={(v) => setSettings(s => ({...s, showInThousands: v}))}
                activeColor={colors.primary}
              />
              <Toggle 
                label={`Verberg < €${settings.smallAmountThreshold}`}
                checked={settings.hideSmallAmounts} 
                onChange={(v) => setSettings(s => ({...s, hideSmallAmounts: v}))} 
                activeColor={colors.primary}
              />
           </div>
        </div>

        <div className="flex space-x-3">
           <button 
             onClick={() => setSettings(s => ({...s, showAiAnalysis: !s.showAiAnalysis}))}
             className={`p-2 rounded hover:bg-slate-100 transition-colors`}
             style={{ color: settings.showAiAnalysis ? colors.primary : '#94a3b8' }}
             title="Toggle AI Features"
           >
             <BrainCircuit size={20} />
           </button>
            <button 
             onClick={() => setSettings(s => ({...s, showMachineLearning: !s.showMachineLearning}))}
             className={`p-2 rounded hover:bg-slate-100 transition-colors`}
             style={{ color: settings.showMachineLearning ? colors.primary : '#94a3b8' }}
             title="Toggle ML Features"
           >
             <Cpu size={20} />
           </button>

           <Button variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()} disabled={isProcessingFile}>
              {isProcessingFile ? (
                 <span className="flex items-center"><div className="animate-spin h-3 w-3 mr-2 border-2 border-slate-500 rounded-full border-t-transparent"></div> Laden...</span>
              ) : (
                 <><Upload size={16} className="mr-2" /> Upload Excel</>
              )}
           </Button>
           <input 
             type="file" 
             ref={fileInputRef}
             className="hidden" 
             accept=".csv,.xlsx,.xls" 
             onChange={handleFileUpload}
           />
           
           <Button variant="primary" size="sm" onClick={exportToCSV} themeColor={colors.primary}>
              <Download size={16} className="mr-2" /> Export
           </Button>

           <button 
             onClick={() => setIsSettingsOpen(true)}
             className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded"
           >
             <Settings size={20} />
           </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden z-10">
        
        {/* Sidebar */}
        <div className="w-64 bg-slate-100 border-r border-slate-200 flex flex-col">
          <div className="p-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: colors.text, opacity: 0.6 }}>Workspaces</h2>
            <nav className="space-y-1">
              <button 
                onClick={() => setActiveTab('simulation')}
                className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium flex items-center transition-colors`}
                style={activeTab === 'simulation' 
                  ? { backgroundColor: 'white', color: colors.primary, boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.05)' } 
                  : { color: '#475569' }
                }
              >
                <FileSpreadsheet size={16} className="mr-2" />
                Simulatie & Analyse
              </button>
            </nav>
          </div>

          <div className="p-4 border-t border-slate-200 flex-1 overflow-y-auto">
             <div className="flex items-center justify-between mb-3">
               <h2 className="text-xs font-semibold uppercase tracking-wider" style={{ color: colors.text, opacity: 0.6 }}>Bronbestanden</h2>
               {!hasUploadedData && budgetLines.length > 0 && <span className="text-[10px] bg-amber-100 text-amber-800 px-1 rounded">Demo</span>}
             </div>
             
             {hasUploadedData || budgetLines.length > 0 ? (
                 <div className="space-y-2">
                    {hasUploadedData ? uploadedFiles.map(file => (
                      <div key={file.id} className="flex items-center justify-between group">
                        <label className="flex items-center space-x-2 text-sm text-slate-700 cursor-pointer w-full">
                          <input 
                            type="checkbox" 
                            checked={file.isVisible} 
                            onChange={() => toggleFileVisibility(file.name)}
                            className="rounded border-slate-300 focus:ring-opacity-50"
                            style={{ color: colors.primary, borderColor: '#cbd5e1' }}
                          />
                          <span className="truncate flex-1" title={file.name}>{file.name}</span>
                        </label>
                      </div>
                    )) : (
                      <div className="text-sm text-slate-600 italic px-2">Demo Data Actief</div>
                    )}
                 </div>
             ) : (
                <div className="text-xs text-slate-400 italic">
                   Nog geen data ingeladen.
                </div>
             )}
          </div>
        </div>

        {/* Workspace */}
        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin relative">

          {/* Validation Errors Panel */}
          {validationErrors.length > 0 && (
            <div className="mb-6 bg-red-50 border-l-4 border-red-500 p-4 rounded shadow-sm">
              <div className="flex items-center mb-2">
                <AlertTriangle className="text-red-500 mr-2" size={20} />
                <h3 className="text-red-800 font-semibold">Datakwaliteit Waarschuwing</h3>
              </div>
              <p className="text-sm text-red-700 mb-2">Er zijn problemen gevonden in het geüploade bestand:</p>
              <ul className="list-disc list-inside text-xs text-red-600 space-y-1 max-h-32 overflow-y-auto">
                {validationErrors.map((err, idx) => (
                   <li key={idx}>Regel {err.row}: {err.message}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Empty State Prompt */}
          {budgetLines.length === 0 && validationErrors.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full pb-20">
                  <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200 max-w-lg w-full text-center">
                      <div className="bg-slate-100 p-4 rounded-full inline-block mb-4">
                          <Upload size={32} className="text-slate-500" />
                      </div>
                      <h2 className="text-xl font-bold mb-2" style={{ color: colors.text }}>Start met uw Budget</h2>
                      <p className="text-slate-500 mb-8 text-sm">
                          Upload een Excel of CSV bestand om te beginnen met simuleren.
                          <br />Of gebruik de demo data om de app te verkennen.
                      </p>
                      
                      <div className="space-y-3">
                        <Button 
                          variant="primary" 
                          size="lg" 
                          className="w-full"
                          themeColor={colors.primary}
                          onClick={() => fileInputRef.current?.click()}
                        >
                          <Upload size={18} className="mr-2" /> Upload Eigen Bestand
                        </Button>
                        
                        <div className="flex gap-3">
                           <Button 
                              variant="secondary" 
                              size="md" 
                              className="flex-1"
                              onClick={generateTemplate}
                            >
                              <FileDown size={16} className="mr-2" /> Download Template
                            </Button>
                            <Button 
                              variant="secondary" 
                              size="md" 
                              className="flex-1"
                              onClick={handleLoadDemo}
                            >
                              <PlayCircle size={16} className="mr-2" /> Start Demo
                            </Button>
                        </div>
                      </div>
                  </div>
              </div>
          )}
          
          {/* Main Dashboard (Only shown if data exists) */}
          {budgetLines.length > 0 && activeTab === 'simulation' && (
            <div className="max-w-6xl mx-auto space-y-6">
              
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* 1. Original Budget */}
                <div className="bg-white p-5 rounded-lg shadow-sm border border-slate-200">
                  <p className="text-sm text-slate-500 mb-1">Huidig Budget Totaal</p>
                  <p className="text-2xl font-bold" style={{ color: colors.text }}>
                    {new Intl.NumberFormat('nl-NL', { 
                        style: 'currency', 
                        currency: 'EUR', 
                        maximumFractionDigits: settings.decimalPrecision,
                        minimumFractionDigits: settings.decimalPrecision
                    }).format(totalOriginal)}
                  </p>
                  {hasUploadedData && (
                     <div className="flex items-center mt-2 text-xs text-green-600">
                        <CheckCircle size={12} className="mr-1" />
                        Gebaseerd op upload
                     </div>
                  )}
                </div>

                {/* 2. New Investment & Coverage (Central Hub) */}
                <div 
                  className={`bg-white p-5 rounded-lg shadow-sm border transition-all duration-300 relative overflow-hidden`}
                  style={{ 
                    borderColor: statusColor,
                    borderWidth: '2px'
                  }}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                      <PlusCircle size={20} style={{ color: statusColor }} />
                      <p className="text-sm font-medium" style={{ color: colors.text }}>
                         Nieuwe Investering & Dekking
                      </p>
                    </div>
                    {/* Shortage Input (Positive Cost) */}
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-400 uppercase font-bold">Benodigd</span>
                      <div className="flex items-center border-b border-dashed" style={{ borderColor: colors.primary }}>
                        <span className="text-xs mr-1 text-slate-400">€</span>
                        <input 
                          type="number" 
                          value={shortageInput}
                          onChange={(e) => setShortageInput(Math.max(0, parseFloat(e.target.value) || 0))}
                          className="w-20 text-right text-sm font-bold bg-transparent focus:outline-none"
                          style={{ color: colors.highRisk }}
                          placeholder="0"
                          title="Vul hier het bedrag van de nieuwe uitgave in"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Dynamic Status Display */}
                  <div className="space-y-1">
                      <div className="flex items-baseline gap-2">
                        <p className="text-2xl font-bold" style={{ color: statusColor }}>
                          {isBalanced ? (
                             <span className="flex items-center gap-2">Gedekt / In Balans <CheckCircle size={20} /></span>
                          ) : (
                             new Intl.NumberFormat('nl-NL', { 
                                style: 'currency', 
                                currency: 'EUR', 
                                maximumFractionDigits: settings.decimalPrecision,
                                minimumFractionDigits: settings.decimalPrecision
                             }).format(Math.abs(currentGap))
                          )}
                        </p>
                      </div>
                      
                      {!isBalanced && (
                        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: statusColor }}>
                           {statusLabel}
                        </p>
                      )}
                      
                      {/* Kaasschaaf Shortcut if there is a remaining gap */}
                      {!isBalanced && (
                         <div className="pt-2">
                            <button
                               onClick={applyDistributeGap}
                               className="text-[10px] underline decoration-dashed hover:text-slate-900 transition-colors flex items-center"
                               style={{ color: colors.text, opacity: 0.7 }}
                            >
                               <Percent size={10} className="mr-1" />
                               Verdeel {currentGap > 0 ? 'kosten' : 'besparing'} over regels ({Math.abs(gapPercentage).toFixed(2)}%)
                            </button>
                         </div>
                       )}
                  </div>
                </div>

                {/* 3. New Budget */}
                <div className="bg-white p-5 rounded-lg shadow-sm border border-slate-200">
                  <p className="text-sm text-slate-500 mb-1">Nieuw Budget Totaal</p>
                  <div className="flex items-baseline gap-2">
                    <p className="text-2xl font-bold" style={{ color: isBalanced ? colors.lowRisk : colors.highRisk }}>
                       {new Intl.NumberFormat('nl-NL', { 
                          style: 'currency', 
                          currency: 'EUR', 
                          maximumFractionDigits: settings.decimalPrecision,
                          minimumFractionDigits: settings.decimalPrecision
                      }).format(totalFinal)}
                    </p>
                  </div>
                  
                  {/* Difference Indicator */}
                  <div className="flex items-center mt-1 text-xs gap-1">
                      {isBalanced ? (
                         <span className="text-green-600 flex items-center">
                            <CheckCircle size={10} className="mr-1" /> Gelijk aan origineel (Budget Neutraal)
                         </span>
                      ) : (
                         <span className="flex items-center" style={{ color: colors.highRisk }}>
                            <AlertTriangle size={10} className="mr-1" />
                            Overschrijding: {new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', minimumFractionDigits: settings.decimalPrecision, maximumFractionDigits: settings.decimalPrecision }).format(totalFinal - totalOriginal)}
                         </span>
                      )}
                  </div>
                </div>
              </div>

              {/* AI Analysis Section */}
              {settings.showAiAnalysis && (
                <div className="rounded-lg p-4 border" style={{ backgroundColor: `${colors.primary}05`, borderColor: `${colors.primary}30` }}>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold flex items-center" style={{ color: colors.text }}>
                      <BrainCircuit size={18} className="mr-2" style={{ color: colors.primary }} /> 
                      AI Budget Analyse
                    </h3>
                    <Button variant="secondary" size="sm" onClick={runAiAnalysis} disabled={isAnalyzing || !hasUploadedData}>
                      {isAnalyzing ? 'Analyseren...' : 'Genereer Analyse'}
                    </Button>
                  </div>
                  {aiAnalysis && (
                    <div className="bg-white/60 p-3 rounded text-sm font-medium" style={{ color: colors.text }}>
                      "{aiAnalysis}"
                    </div>
                  )}
                  {settings.showMachineLearning && mlSuggestion && (
                     <div className="mt-2 p-3 rounded text-sm flex items-start" style={{ backgroundColor: `${colors.lowRisk}20`, color: colors.text }}>
                        <Cpu size={16} className="mt-0.5 mr-2 flex-shrink-0" />
                        <span><strong>ML Suggestie:</strong> {mlSuggestion}</span>
                     </div>
                  )}
                  {!hasUploadedData && !aiAnalysis && (
                      <div className="text-xs text-slate-500 italic mt-2">
                          AI-analyse is pas beschikbaar na het uploaden van uw eigen dataset.
                      </div>
                  )}
                </div>
              )}

              {/* Visualization */}
              <SimulationChart data={filteredLines} showInThousands={settings.showInThousands} theme={colors} decimalPrecision={settings.decimalPrecision} />

              {/* Data Table */}
              <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 grid grid-cols-12 gap-4 text-xs font-semibold uppercase tracking-wider" style={{ color: colors.text, opacity: 0.7 }}>
                  <div className="col-span-3">Categorie / Post</div>
                  <div className="col-span-2 text-right">Origineel</div>
                  <div className="col-span-4 text-center">Compensatie / Mutatie</div>
                  <div className="col-span-2 text-right">Nieuw Totaal</div>
                  <div className="col-span-1"></div>
                </div>
                
                <div className="divide-y divide-slate-100">
                  {filteredLines.map(item => (
                    <BudgetRow 
                      key={item.id} 
                      item={item} 
                      onUpdate={handleUpdateAdjustment}
                      onAddComment={handleAddComment}
                      showInThousands={settings.showInThousands}
                      decimalPrecision={settings.decimalPrecision}
                      theme={colors}
                    />
                  ))}
                  {filteredLines.length === 0 && (
                    <div className="p-8 text-center text-slate-500">
                       {hasUploadedData 
                         ? "Geen regels zichtbaar. Controleer of de filters 'klein grut' te streng staan." 
                         : "Geen data beschikbaar."}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab !== 'simulation' && (
             <div className="bg-white p-8 rounded-lg shadow-sm text-center">
                <h3 className="text-lg font-medium" style={{ color: colors.text }}>Bestand Weergave</h3>
                <p className="text-slate-500 mt-2">Hier wordt de ruwe data getoond van geüploade bestanden.</p>
             </div>
          )}

        </div>
      </div>

      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6 relative max-h-[90vh] overflow-y-auto">
            <button 
              onClick={() => setIsSettingsOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
            >
              <X size={20} />
            </button>
            
            <h2 className="text-xl font-bold mb-6" style={{ color: colors.text }}>Instellingen</h2>
            
            <div className="space-y-6">
              {/* App Name */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Applicatie Naam</label>
                <input 
                  type="text" 
                  value={settings.appName}
                  onChange={(e) => setSettings({...settings, appName: e.target.value})}
                  className="w-full border border-slate-300 rounded-md px-3 py-2 focus:ring-2 focus:outline-none"
                  style={{ focusRingColor: colors.primary }}
                />
              </div>

              {/* Threshold Setting */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Grens voor "Klein Grut" (€)</label>
                <input 
                  type="number" 
                  value={settings.smallAmountThreshold}
                  onChange={(e) => setSettings({...settings, smallAmountThreshold: parseFloat(e.target.value) || 0})}
                  className="w-full border border-slate-300 rounded-md px-3 py-2 focus:ring-2 focus:outline-none"
                  style={{ focusRingColor: colors.primary }}
                />
                <p className="text-xs text-slate-500 mt-1">Bedragen onder deze grens worden verborgen als de filter actief is.</p>
              </div>

              {/* Decimal Precision Setting */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Afronding (Decimalen)</label>
                <select 
                   value={settings.decimalPrecision}
                   onChange={(e) => handlePrecisionChange(parseInt(e.target.value))}
                   className="w-full border border-slate-300 rounded-md px-3 py-2 focus:ring-2 focus:outline-none"
                >
                  <option value={0}>0 Decimalen (Gehele getallen)</option>
                  <option value={1}>1 Decimaal</option>
                  <option value={2}>2 Decimalen (Standaard)</option>
                </select>
                <p className="text-xs text-slate-500 mt-1">Deze instelling wordt toegepast bij nieuwe uploads en in de weergave.</p>
              </div>

              {/* Theme Selection */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-3">Thema & Kleurenpalet</label>
                <div className="grid grid-cols-2 gap-3">
                  {THEMES.map(theme => (
                    <button
                      key={theme.id}
                      onClick={() => setSettings({...settings, themeId: theme.id})}
                      className={`flex items-center p-2 rounded-lg border-2 transition-all ${settings.themeId === theme.id ? 'border-current bg-slate-50' : 'border-transparent hover:bg-slate-50'}`}
                      style={{ borderColor: settings.themeId === theme.id ? theme.colors.primary : 'transparent' }}
                    >
                      <div className="flex gap-1 mr-3">
                        <div className="w-4 h-4 rounded-full" style={{ backgroundColor: theme.colors.highRisk }}></div>
                        <div className="w-4 h-4 rounded-full" style={{ backgroundColor: theme.colors.primary }}></div>
                        <div className="w-4 h-4 rounded-full" style={{ backgroundColor: theme.colors.text }}></div>
                      </div>
                      <span className="text-sm font-medium text-slate-700">{theme.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-8 flex justify-end">
              <Button onClick={() => setIsSettingsOpen(false)} themeColor={colors.primary}>
                Opslaan & Sluiten
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};