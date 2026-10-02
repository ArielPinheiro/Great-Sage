import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

// Load environment variables before any service initialization
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

import express from 'express';
import cors from 'cors';
import { chatRouter } from './routes/chat.js';
import { rateLimitMiddleware } from './middleware/rateLimit.js';
import { isLLMConfigured, getLLMConfigStatus } from './services/llmService.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(
  cors({
    origin: (origin, callback) => {
      callback(null, true);
    },
    credentials: true,
  }),
);

// Limit JSON request body size to 256kb
app.use(express.json({ limit: '256kb' }));

// Health check endpoint
app.get('/api/health', (_req, res) => {
  const mode = isLLMConfigured() ? 'real' : 'mock';
  res.json({
    status: 'ok',
    agent: 'Daikenja — Grande Sabio',
    provider: 'Google Gemini',
    mode,
    timestamp: new Date().toISOString(),
  });
});

// Rate limit on chat endpoint
app.use('/api/chat', rateLimitMiddleware);

// Chat routes
app.use('/api', chatRouter);

app.listen(PORT, () => {
  const config = getLLMConfigStatus();
  console.log(`\n======================================================`);
  console.log(`  DAIKENJA SERVER — GRANDE SÁBIO`);
  console.log(`  Provedor de IA: Google Gemini`);
  console.log(`  Porta: ${PORT}`);
  console.log(`  Health: http://localhost:${PORT}/api/health`);
  console.log(`  GEMINI_API_KEY detectada: ${config.hasKey ? 'SIM (presente)' : 'NÃO (usando modo simulado)'}`);
  console.log(`  Modelo configurado: ${config.model}`);
  console.log(`  Modo ativo: ${config.hasKey ? 'GOOGLE GEMINI (real)' : 'SIMULADO (mock)'}`);
  console.log(`======================================================\n`);
});


