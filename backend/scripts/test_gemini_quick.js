require('dotenv').config();
const { GoogleGenAI } = require('@google/genai');

async function test() {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  console.log('Sending request to gemini-3.8-flash...');
  try {
    const res = await Promise.race([
      ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: 'Return JSON: {"hello":"world"}',
        config: { responseMimeType: 'application/json' }
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT_5S')), 5000))
    ]);
    console.log('Gemini 3.8 Flash Success:', res.text);
  } catch (err) {
    console.log('Error:', err.message);
  }
}

test();
