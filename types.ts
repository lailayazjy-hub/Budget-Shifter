export interface Comment {
  id: string;
  author: string;
  text: string;
  timestamp: Date;
}

export interface BudgetLine {
  id: string;
  category: string; // e.g., "Buffer", "Marketing", "HR"
  description: string;
  originalAmount: number;
  adjustment: number; // The delta (+ or -)
  isBuffer: boolean; // Helps identify the source
  comments: Comment[];
  sourceFile?: string; // Which uploaded file/tab this came from
}

export interface UploadedFile {
  id: string;
  name: string;
  data: BudgetLine[];
  isVisible: boolean;
}

export interface ThemePalette {
  highRisk: string;
  mediumRisk: string;
  lowRisk: string;
  primary: string;
  text: string;
  accents?: string[];
}

export interface Theme {
  id: string;
  name: string;
  colors: ThemePalette;
}

export interface AppSettings {
  appName: string;
  themeId: string;
  showInThousands: boolean;
  hideSmallAmounts: boolean; // < 50
  smallAmountThreshold: number;
  showAiAnalysis: boolean;
  showMachineLearning: boolean;
  decimalPrecision: number; // 0, 1, or 2
}

export type TabType = 'simulation' | 'source-file';

export interface ValidationError {
  row: number;
  message: string;
  rawData?: any;
}

export interface ImportResult {
  data: BudgetLine[];
  errors: ValidationError[];
  fileName: string;
}