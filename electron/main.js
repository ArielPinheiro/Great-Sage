// ──────────────────────────────────────────────────────────────
//  Daikenja — Grande Sábio · Electron Main Process
// ──────────────────────────────────────────────────────────────

const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path   = require('path');
const fs     = require('fs');
const net    = require('net');
const http   = require('http');
const { spawn } = require('child_process');

// ── Paths ────────────────────────────────────────────────────
const IS_PACKAGED = app.isPackaged;

function getServerEntry() {
  if (IS_PACKAGED) {
    return path.join(process.resourcesPath, 'server', 'dist', 'index.js');
  }
  return path.join(__dirname, '..', 'server', 'dist', 'index.js');
}

function getClientDir() {
  if (IS_PACKAGED) {
    return path.join(process.resourcesPath, 'client', 'dist');
  }
  return path.join(__dirname, '..', 'client', 'dist');
}

function getEnvPath() {
  return path.join(__dirname, '..', '.env');
}

function getConfigPath() {
  return path.join(app.getPath('userData'), 'config.json');
}

// ── Logger ───────────────────────────────────────────────────
function log(...args) {
  const line = `[${new Date().toISOString()}] ${args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')}\n`;
  try {
    const logFile = path.join(app.getPath('userData'), 'app.log');
    fs.appendFileSync(logFile, line);
  } catch {}
  console.log(...args);
}

// ── Single instance lock ─────────────────────────────────────
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  log('[Electron] Já existe outra instância em execução. Encerrando.');
  app.quit();
  process.exit(0);
}

// ── State ────────────────────────────────────────────────────
let mainWindow   = null;
let serverProcess = null;
let serverPort    = null;

// ── Helpers ──────────────────────────────────────────────────

/** Finds a free TCP port by binding to port 0. */
function findFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, '127.0.0.1', () => {
      const port = srv.address().port;
      srv.close(() => resolve(port));
    });
    srv.on('error', reject);
  });
}

/** Polls GET /api/health until a 200 response or timeout. */
function waitForServer(port, timeoutMs = 30000) {
  const startTime = Date.now();
  return new Promise((resolve, reject) => {
    const attempt = () => {
      if (Date.now() - startTime > timeoutMs) {
        return reject(new Error(`Servidor não respondeu em ${timeoutMs / 1000}s.`));
      }
      const req = http.get(`http://127.0.0.1:${port}/api/health`, (res) => {
        if (res.statusCode === 200) {
          resolve();
        } else {
          setTimeout(attempt, 250);
        }
      });
      req.on('error', () => setTimeout(attempt, 250));
      req.setTimeout(2000, () => { req.destroy(); setTimeout(attempt, 250); });
    };
    attempt();
  });
}

/** Reads config from userData/config.json. Returns {} if not found. */
function readConfig() {
  try {
    const raw = fs.readFileSync(getConfigPath(), 'utf-8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

/** Writes config to userData/config.json. */
function writeConfig(cfg) {
  const dir = path.dirname(getConfigPath());
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(getConfigPath(), JSON.stringify(cfg, null, 2), 'utf-8');
}

/** Reads the .env file and returns an object with key-value pairs. */
function readDotEnv(envPath) {
  const result = {};
  try {
    const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const key = trimmed.substring(0, eqIdx).trim();
      const val = trimmed.substring(eqIdx + 1).trim();
      result[key] = val;
    }
  } catch {
    // .env not found — that's fine in production
  }
  return result;
}

/** Resolves API key and model. Dev = .env, Production = userData/config.json */
function resolveApiConfig() {
  if (!IS_PACKAGED) {
    const env = readDotEnv(getEnvPath());
    return {
      apiKey:  env.GEMINI_API_KEY || '',
      model:   env.GEMINI_MODEL   || 'gemini-3.5-flash-lite',
    };
  }
  const cfg = readConfig();
  return {
    apiKey:  cfg.GEMINI_API_KEY || '',
    model:   cfg.GEMINI_MODEL   || 'gemini-3.5-flash-lite',
  };
}

// ── Server Process ───────────────────────────────────────────

function startServer(port, apiConfig) {
  return new Promise((resolve, reject) => {
    const serverEntry = getServerEntry();

    if (!fs.existsSync(serverEntry)) {
      return reject(new Error(
        `Arquivo do servidor não encontrado:\n${serverEntry}\n\n` +
        `Execute "npm run build:server" primeiro.`
      ));
    }

    const clientDir = getClientDir();
    const serverNodeModules = IS_PACKAGED
      ? path.join(process.resourcesPath, 'server', 'node_modules')
      : path.join(__dirname, '..', 'server', 'node_modules');

    const env = {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      PORT: String(port),
      GEMINI_API_KEY: apiConfig.apiKey,
      GEMINI_MODEL:   apiConfig.model,
      CLIENT_ORIGIN:  `http://127.0.0.1:${port}`,
      STATIC_DIR:     clientDir,
      NODE_ENV:       IS_PACKAGED ? 'production' : 'development',
      NODE_PATH:      serverNodeModules,
    };

    serverProcess = spawn(process.execPath, [serverEntry], {
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });

    let stderrOutput = '';

    serverProcess.stdout.on('data', (data) => {
      log(`[Server] ${data}`);
    });

    serverProcess.stderr.on('data', (data) => {
      stderrOutput += data.toString();
      log(`[Server ERR] ${data}`);
    });

    serverProcess.on('error', (err) => {
      log(`[Server spawn error] ${err.message}`);
      reject(new Error(`Falha ao iniciar o processo do servidor: ${err.message}`));
    });

    serverProcess.on('exit', (code) => {
      log(`[Server exit] code: ${code}`);
      if (code !== null && code !== 0 && mainWindow) {
        const msg = stderrOutput.slice(-500) || `Código de saída: ${code}`;
        showErrorWindow(
          'Servidor encerrou inesperadamente',
          `O servidor encerrou com código ${code}.\n\n${msg}`
        );
      }
      serverProcess = null;
    });

    // Wait for health endpoint
    waitForServer(port)
      .then(() => resolve())
      .catch((err) => {
        killServer();
        reject(new Error(
          `Servidor iniciou mas não respondeu ao health check.\n${err.message}\n\n` +
          (stderrOutput ? `Saída de erro:\n${stderrOutput.slice(-500)}` : '')
        ));
      });
  });
}

function killServer() {
  if (serverProcess) {
    serverProcess.kill('SIGTERM');
    // Force kill after 3 seconds
    setTimeout(() => {
      if (serverProcess) {
        try { serverProcess.kill('SIGKILL'); } catch {}
      }
    }, 3000);
    serverProcess = null;
  }
}

// ── Windows ──────────────────────────────────────────────────

function createMainWindow(port) {
  log(`[Electron] Criando mainWindow para http://127.0.0.1:${port}`);
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'Daikenja — Grande Sábio',
    icon: path.join(__dirname, 'icon.ico'),
    autoHideMenuBar: true,
    show: true,
    backgroundColor: '#0a0a12',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  mainWindow.loadURL(`http://127.0.0.1:${port}`);

  mainWindow.webContents.on('did-finish-load', () => {
    log('[Electron] mainWindow did-finish-load');
  });

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
    log(`[Electron] mainWindow did-fail-load: ${errorCode} - ${errorDescription}`);
  });

  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    log(`[Electron] render-process-gone: ${JSON.stringify(details)}`);
  });

  mainWindow.on('close', () => {
    log('[Electron] mainWindow close event');
  });

  mainWindow.on('closed', () => {
    log('[Electron] mainWindow closed event');
    mainWindow = null;
  });
}

function showSetupWindow() {
  return new Promise((resolve) => {
    let finished = false;
    const finish = (result) => {
      if (!finished) {
        finished = true;
        ipcMain.removeListener('save-config', onSave);
        resolve(result);
      }
    };

    const setupWin = new BrowserWindow({
      width: 520,
      height: 480,
      resizable: false,
      title: 'Daikenja — Configuração',
      icon: path.join(__dirname, 'icon.ico'),
      autoHideMenuBar: true,
      backgroundColor: '#0a0a12',
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        preload: path.join(__dirname, 'preload.js'),
      },
    });

    setupWin.loadFile(path.join(__dirname, 'setup.html'));

    const onSave = (_event, config) => {
      writeConfig({
        GEMINI_API_KEY: config.apiKey,
        GEMINI_MODEL:   config.model || 'gemini-3.5-flash-lite',
      });
      setupWin.close();
      finish({
        apiKey: config.apiKey,
        model:  config.model || 'gemini-3.5-flash-lite',
      });
    };

    ipcMain.on('save-config', onSave);

    setupWin.on('closed', () => {
      finish(resolveApiConfig());
    });
  });
}

function showErrorWindow(title, message) {
  dialog.showErrorBox(title, message);
}

// ── App Lifecycle ────────────────────────────────────

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app.whenReady().then(async () => {
  try {
    log('[Electron] App ready, iniciando setup...');
    // 1. Resolve API config
    let apiConfig = resolveApiConfig();

    // 2. In production, if no API key, show setup screen
    if (IS_PACKAGED && !apiConfig.apiKey) {
      log('[Electron] Nenhuma chave encontrada em produção. Exibindo tela de setup.');
      apiConfig = await showSetupWindow();
    }

    // 3. Find a free port
    serverPort = await findFreePort();
    log(`[Electron] Porta livre encontrada: ${serverPort}`);

    // 4. Start server
    log(`[Electron] Iniciando servidor em: ${getServerEntry()}`);
    await startServer(serverPort, apiConfig);
    log(`[Electron] Servidor pronto na porta ${serverPort}`);

    // 5. Create main window
    createMainWindow(serverPort);

  } catch (err) {
    log('[Electron] Erro fatal:', err.message, err.stack);
    showErrorWindow(
      'Erro ao iniciar o Daikenja',
      `Não foi possível iniciar o aplicativo.\n\n${err.message}\n\n` +
      `Verifique se as dependências estão instaladas e tente novamente.`
    );
    app.quit();
  }
});

app.on('window-all-closed', () => {
  log('[Electron] window-all-closed event recebido. Encerrando app.');
  killServer();
  app.quit();
});

app.on('before-quit', () => {
  log('[Electron] before-quit event recebido.');
  killServer();
});
