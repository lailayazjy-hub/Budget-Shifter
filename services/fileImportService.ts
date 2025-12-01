import * as XLSX from 'xlsx';
import { BudgetLine, ImportResult, ValidationError } from '../types';

// Heuristics for automatic column recognition
const COLUMN_KEYWORDS = {
  category: ['category', 'categorie', 'afdeling', 'department', 'kostenplaats', 'hoofdgroep', 'groep'],
  description: ['description', 'omschrijving', 'desc', 'toelichting', 'naam', 'post', 'detail'],
  amount: ['amount', 'bedrag', 'budget', 'kosten', 'waarde', 'value', 'totaal', 'eur', 'euro']
};

const findColumnIndex = (headers: string[], keywords: string[]): number => {
  const lowerHeaders = headers.map(h => String(h).toLowerCase().trim());
  return lowerHeaders.findIndex(h => keywords.some(k => h.includes(k)));
};

const generateId = () => Math.random().toString(36).substr(2, 9);

export const generateTemplate = () => {
  const wb = XLSX.utils.book_new();
  const headers = [['Categorie', 'Omschrijving', 'Bedrag']];
  const ws = XLSX.utils.aoa_to_sheet(headers);
  
  // Add some column widths for better UX
  ws['!cols'] = [{ wch: 20 }, { wch: 40 }, { wch: 15 }];
  
  XLSX.utils.book_append_sheet(wb, ws, "Budget Template");
  XLSX.writeFile(wb, "BudgetFlow_Template.xlsx");
};

export const parseFile = async (file: File, decimalPrecision: number = 2): Promise<ImportResult> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        
        // Assume first sheet for now, or merge all. Let's take the first sheet.
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Convert to JSON array of arrays to handle headers manually
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

        if (jsonData.length < 2) {
            resolve({ data: [], errors: [{ row: 0, message: "Bestand lijkt leeg of heeft geen data." }], fileName: file.name });
            return;
        }

        // 1. Identify Headers (usually row 0)
        const headers = jsonData[0] as string[];
        
        // 2. Map Columns
        const categoryIdx = findColumnIndex(headers, COLUMN_KEYWORDS.category);
        const descriptionIdx = findColumnIndex(headers, COLUMN_KEYWORDS.description);
        const amountIdx = findColumnIndex(headers, COLUMN_KEYWORDS.amount);

        const errors: ValidationError[] = [];
        const validLines: BudgetLine[] = [];

        // Check if essential columns are found
        if (amountIdx === -1) {
             resolve({ 
                 data: [], 
                 errors: [{ row: 0, message: "Kon geen kolom voor 'Bedrag' of 'Budget' vinden. Controleer de kolomnamen." }],
                 fileName: file.name
             });
             return;
        }

        // Rounding Factor
        const factor = Math.pow(10, decimalPrecision);

        // 3. Process Rows
        for (let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i];
          
          // Skip completely empty rows
          if (row.length === 0 || row.every(cell => !cell)) continue;

          const rawAmount = row[amountIdx];
          const description = descriptionIdx !== -1 ? row[descriptionIdx] : (categoryIdx !== -1 ? row[categoryIdx] : `Regel ${i + 1}`);
          const category = categoryIdx !== -1 ? row[categoryIdx] : 'Algemeen';

          // Validation: Amount must be numeric
          let amount = 0;
          if (typeof rawAmount === 'number') {
            amount = rawAmount;
          } else if (typeof rawAmount === 'string') {
             // Try parsing "1.000,00" or "1000.00"
             const cleanStr = rawAmount.replace(/[^0-9.,-]/g, '').replace(',', '.');
             amount = parseFloat(cleanStr);
          }

          if (isNaN(amount)) {
            errors.push({
              row: i + 1,
              message: `Ongeldige waarde voor bedrag: "${rawAmount}".`,
              rawData: row
            });
            continue;
          }

          // Apply precision rounding
          amount = Math.round(amount * factor) / factor;

          // Create BudgetLine
          validLines.push({
            id: generateId(),
            category: String(category || 'Onbekend').trim(),
            description: String(description || '').trim(),
            originalAmount: amount,
            adjustment: 0,
            isBuffer: String(category).toLowerCase().includes('buffer'),
            comments: [],
            sourceFile: file.name
          });
        }

        resolve({
          data: validLines,
          errors: errors,
          fileName: file.name
        });

      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = (err) => reject(err);
    reader.readAsBinaryString(file);
  });
};