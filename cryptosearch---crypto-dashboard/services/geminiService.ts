import { GoogleGenAI } from "@google/genai";
import { TickerData } from '../types';

export const getCoinAnalysis = async (symbol: string, tickerData: TickerData): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const prompt = `
      Act as a senior crypto market analyst.
      Analyze the cryptocurrency: ${symbol.toUpperCase()}.
      
      Current 24h Data:
      - Price: $${parseFloat(tickerData.lastPrice).toFixed(2)}
      - Change: ${tickerData.priceChangePercent}%
      - High: $${tickerData.highPrice}
      - Low: $${tickerData.lowPrice}
      
      Provide a concise summary (max 3-4 sentences) in Ukrainian language.
      Focus on the market sentiment (bullish/bearish) based on the price change and give a very brief explanation of what this project does if it's a major coin.
      Do not give financial advice. Keep the tone professional and informative, like a Google Knowledge Graph snippet.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text || "Не вдалося отримати аналіз.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Інформація тимчасово недоступна.";
  }
};