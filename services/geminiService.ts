import { GoogleGenAI } from "@google/genai";
import { BudgetLine } from "../types";

const getClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({ apiKey });
};

export const analyzeBudgetShift = async (
  lines: BudgetLine[]
): Promise<string> => {
  const client = getClient();
  if (!client) return "AI API Key ontbreekt. Configureer de API sleutel.";

  // Filter only lines with adjustments to save tokens and focus context
  const activeShifts = lines.filter(l => l.adjustment !== 0);
  
  if (activeShifts.length === 0) {
    return "Geen verschuivingen gedetecteerd om te analyseren.";
  }

  const prompt = `
    Je bent een strikte, professionele financiële controller assistent.
    Analyseer de volgende budgetverschuivingen.
    Geef een zakelijke, feitelijke samenvatting van de impact.
    Regels:
    1. Maximaal twee zinnen.
    2. Maximaal vijftien woorden per zin.
    3. Focus op de grootste materiële impact.
    
    Data:
    ${activeShifts.map(l => `${l.category}: ${l.adjustment > 0 ? '+' : ''}${l.adjustment}`).join(', ')}
  `;

  try {
    const response = await client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    return response.text.trim();
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Kon analyse niet uitvoeren.";
  }
};

export const suggestOptimizations = async (
  lines: BudgetLine[]
): Promise<string> => {
  const client = getClient();
  if (!client) return "";

  const prompt = `
    Bekijk deze budgetregels. Identificeer patronen voor potentiële besparingen of herallocatie op basis van "Machine Learning" logica (simulatie).
    Geef 1 concrete suggestie voor het afboeken van oude posten of buffers.
    Houd het kort en zakelijk.

    Data:
    ${lines.slice(0, 20).map(l => `${l.category} (${l.description}): ${l.originalAmount}`).join('\n')}
  `;

  try {
    const response = await client.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
    });
    return response.text.trim();
  } catch (error) {
    return "";
  }
};