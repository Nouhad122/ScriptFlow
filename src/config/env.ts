import dotenv from 'dotenv';

dotenv.config();

export const env = {
  port: parseInt(process.env.PORT ?? '3001', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  geminiApiKey: process.env.GEMINI_API_KEY ?? '',
  openrouterApiKey: process.env.OPENROUTER_API_KEY ?? '',
  databasePath: process.env.DATABASE_PATH ?? './data/scriptflow.db',
};
