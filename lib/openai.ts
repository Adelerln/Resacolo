import OpenAI from 'openai';

export function createOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY manquant. Veuillez le définir dans votre fichier .env.');
  }

  return new OpenAI({ apiKey });
}
