# Daikenja | Grande Sábio — Desktop App

Assistente de IA com a personalidade analítica, precisa e leal do Grande Sábio de Tensei Shitara Slime Datta Ken.

## Stack Tecnológica

| Camada | Tecnologia |
|--------|------------|
| Frontend | React + Vite + TypeScript |
| 3D / Consciência | React Three Fiber + drei + postprocessing |
| Animações | Framer Motion + GSAP + maath |
| Estado | Zustand |
| Backend | Node.js + Express + TypeScript |
| LLM | Google Gemini API |
| Desktop | Electron + electron-builder |

---

## Como Rodar em Desenvolvimento

### 1. Instalar dependências

```bash
npm run install:all
```

### 2. Configurar a chave de API

Copie o arquivo de exemplo e edite com sua chave:

```bash
cp .env.example .env
```

Edite o `.env`:

```env
GEMINI_API_KEY=sua-chave-aqui
GEMINI_MODEL=gemini-3.5-flash-lite
PORT=3001
CLIENT_ORIGIN=http://localhost:5173
```

### 3. Modo web (navegador)

```bash
npm run dev
```

Acesse: **http://localhost:5173**

### 4. Modo desktop (Electron)

```bash
npm start
```

Este comando compila o servidor e o cliente, e abre o app na janela do Electron.

---

## Como Gerar o Instalador (.exe)

```bash
npm run dist
```

O instalador será gerado em:

```
dist-electron/Daikenja - Grande Sábio Setup 1.0.0.exe
```

A versão descompactada (portátil) fica em:

```
dist-electron/win-unpacked/Daikenja.exe
```

### Configuração no app instalado

Na primeira execução do app instalado (ou se não houver chave de API configurada), uma tela de configuração será exibida pedindo a `GEMINI_API_KEY`.

A chave é salva em:

```
%APPDATA%\great-sage\config.json
```

> **⚠️ O arquivo `.env` NÃO é incluído no instalador.** A chave de API nunca fica embutida no executável.

---

## Arquitetura do Desktop App

```
┌──────────────────────────────────────────┐
│          Electron Main Process           │
│  (electron/main.js)                      │
│                                          │
│  1. Encontra porta livre automaticamente │
│  2. Inicia servidor Express via          │
│     ELECTRON_RUN_AS_NODE=1               │
│  3. Espera /api/health responder         │
│  4. Abre BrowserWindow                   │
│  5. Encerra servidor ao fechar           │
└──────────────────────────────────────────┘
         │                    │
         ▼                    ▼
┌─────────────────┐  ┌─────────────────────┐
│  Express Server │  │   BrowserWindow     │
│  (server/dist/) │  │   (client/dist/)    │
│  - /api/chat    │  │   - React + R3F     │
│  - /api/health  │  │   - Zustand         │
│  - Static files │  │   - Framer Motion   │
└─────────────────┘  └─────────────────────┘
```

### Segurança

- `contextIsolation: true` — processo renderer isolado
- `nodeIntegration: false` — sem acesso ao Node.js no renderer
- Preload mínimo — expõe apenas `saveConfig()` via IPC
- Chave de API lida do `userData`, nunca do código fonte

---

## Estrutura de Arquivos

```
great-sage/
├── package.json              # Scripts e config do electron-builder
├── .env.example              # Modelo de variáveis de ambiente
├── .gitignore
├── README.md
│
├── electron/                 # Processo principal do Electron
│   ├── main.js               # Entry point — spawn do servidor, janela
│   ├── preload.js            # Preload seguro com contextBridge
│   ├── setup.html            # Tela de configuração da API key
│   └── icon.ico              # Ícone do app
│
├── client/                   # Frontend React + R3F + Vite + TypeScript
│   ├── src/
│   ├── dist/                 # Build de produção (vite build)
│   ├── vite.config.ts
│   └── package.json
│
├── server/                   # Backend Node.js + Express + TypeScript
│   ├── src/
│   ├── dist/                 # Build de produção (tsc)
│   └── package.json
│
└── dist-electron/            # Saída do electron-builder
    ├── win-unpacked/         # Versão portátil
    │   └── Daikenja.exe
    └── Daikenja - Grande Sábio Setup 1.0.0.exe  # Instalador NSIS
```

---

## Scripts Disponíveis

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Inicia servidor + cliente para desenvolvimento web |
| `npm start` | Compila tudo e abre no Electron (modo desktop dev) |
| `npm run dist` | Gera o instalador `.exe` para Windows |
| `npm run build:all` | Compila servidor e cliente sem abrir nada |
| `npm run install:all` | Instala deps de raiz, servidor e cliente |

---

## Resolução de Problemas

### O app abre mas fica com tela escura

- Aguarde alguns segundos — o React Three Fiber pode demorar para renderizar a cena 3D.
- Verifique se o driver da placa de vídeo está atualizado (WebGL é necessário).

### Erro "porta já em uso"

O app escolhe uma porta livre automaticamente. Se mesmo assim ocorrer erro, encerre processos Node.js pendentes:

```bash
taskkill /F /IM node.exe
```

### Chave de API não funciona

- Verifique se a chave é válida em [aistudio.google.com/apikey](https://aistudio.google.com/apikey)
- **Em desenvolvimento:** edite o arquivo `.env` na raiz do projeto.
- **No app instalado:** delete `%APPDATA%\great-sage\config.json` e reabra o app para inserir uma nova chave.

### O app funciona em modo simulado (mock)

Isso significa que a `GEMINI_API_KEY` não foi detectada. O app continua funcionando com respostas simuladas. Configure a chave para usar o Gemini real.

### Logs de diagnóstico

O app salva logs em:

```
%APPDATA%\great-sage\app.log
```

---

## Licença

MIT
