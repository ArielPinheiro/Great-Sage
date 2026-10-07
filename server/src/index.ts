import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

// Load environment variables before any service initialization
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Only load .env files when NOT running inside Electron packaged app
if (!process.env.ELECTRON_RUN_AS_NODE) {
  dotenv.config({ path: path.resolve(__dirname, '../../.env') });
  dotenv.config({ path: path.resolve(__dirname, '../.env') });
  dotenv.config();
}

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

// ── Static file serving (Electron production mode) ───────────
const STATIC_DIR = process.env.STATIC_DIR;
if (STATIC_DIR && fs.existsSync(STATIC_DIR)) {
  // Serve built client files
  app.use(express.static(STATIC_DIR));

  // SPA catch-all: any non-API route returns index.html (Express 5 syntax)
  app.get('{*path}', (_req, res) => {
    const indexPath = path.join(STATIC_DIR, 'index.html');
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(404).send('index.html não encontrado.');
    }
  });
}

const server = app.listen(PORT, () => {
  const config = getLLMConfigStatus();
  console.log(`\n======================================================`);
  console.log(`  DAIKENJA SERVER — GRANDE SÁBIO`);
  console.log(`  Provedor de IA: Google Gemini`);
  console.log(`  Porta: ${PORT}`);
  console.log(`  Health: http://localhost:${PORT}/api/health`);
  console.log(`  GEMINI_API_KEY detectada: ${config.hasKey ? 'SIM (presente)' : 'NÃO (usando modo simulado)'}`);
  console.log(`  Modelo configurado: ${config.model}`);
  console.log(`  Modo ativo: ${config.hasKey ? 'GOOGLE GEMINI (real)' : 'SIMULADO (mock)'}`);
  if (STATIC_DIR) {
    console.log(`  Servindo frontend de: ${STATIC_DIR}`);
  }
  console.log(`======================================================\n`);
});

// Handle port already in use
server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n❌ ERRO: A porta ${PORT} já está em uso.`);
    console.error(`   Encerre o processo que está usando essa porta ou escolha outra.\n`);
  } else {
    console.error(`\n❌ ERRO ao iniciar servidor:`, err.message);
  }
  process.exit(1);
});
