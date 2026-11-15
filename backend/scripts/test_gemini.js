require('dotenv').config();
const { GoogleGenAI } = require('@google/genai');

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.log('No GEMINI_API_KEY in environment.');
    return;
  }
  console.log('Found GEMINI_API_KEY (prefix:', apiKey.substring(0, 6) + '...)');

  const ai = new GoogleGenAI({ apiKey });
  const modelsToTry = [
    process.env.GEMINI_MODEL,
    'gemini-2.5-flash',
    'gemini-1.5-flash',
    'gemini-2.0-flash',
    'gemini-3.8-flash'
  ].filter(Boolean);

  for (const model of modelsToTry) {
    try {
      console.log('Attempting model:', model);
      const res = await ai.models.generateContent({
        model,
        contents: 'Ping test. Output JSON: {"status":"ready"}',
        config: {
          responseMimeType: 'application/json'
        }
      });
      console.log('SUCCESS with model:', model, 'Output:', res.text);
      return model;
    } catch (err) {
      console.log('Failed with model:', model, 'Error:', err.message);
    }
  }
}

main().catch(console.error);
