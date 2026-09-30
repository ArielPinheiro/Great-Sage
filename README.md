# Daikenja | Grande Sabio

Assistente de IA com a personalidade analitica, precisa e leal do Grande Sabio de Tensei Shitara Slime Datta Ken.

## Stack Tecnologica

| Camada | Tecnologia |
|--------|------------|
| Frontend | React + Vite + TypeScript |
| 3D / Consciencia | React Three Fiber + drei + postprocessing |
| Animacoes | Framer Motion + GSAP + maath |
| Estado | Zustand |
| Debug & Tuner | Leva (ativo em desenvolvimento) |
| Backend | Node.js + Express + TypeScript |
| LLM | Formato compativel com OpenAI API (OpenAI, Groq, OpenRouter, Ollama) |

## Como Configurar e Rodar

### 1. Clonar e configurar ambiente

```bash
git clone <repo-url> great-sage
cd great-sage
cp .env.example .env
```

Edite o arquivo `.env` na raiz com as credenciais da sua API de LLM:

```env
LLM_API_KEY=sua-chave-aqui
LLM_BASE_URL=https://api.openai.com/v1
LLM_MODEL=gpt-4o
PORT=3001
CLIENT_ORIGIN=http://localhost:5173
```

### 2. Instalar dependencias

Execute o comando na raiz para instalar as dependencias da raiz, do servidor e do cliente:

```bash
npm run install:all
```

Ou instale manualmente em cada pasta:

```bash
# Na raiz
npm install

# No servidor
npm install --prefix server

# No cliente
npm install --prefix client
```

### 3. Rodar o projeto completo

A partir da raiz do projeto, execute um unico comando:

```bash
npm run dev
```

Este comando utiliza `concurrently` para inicializar simultaneamente:
- Servidor Express em `http://localhost:3001`
- Aplicacao Vite Frontend em `http://localhost:5173`

Acesse no navegador: **http://localhost:5173**

## Estrutura do Repositorio

```
great-sage/
├── package.json         # Scripts unificados de execucao (dev, build, install:all)
├── .env.example         # Modelo de configuracao das variaveis de ambiente
├── .gitignore
├── README.md
├── client/              # Frontend React + R3F + Vite + TypeScript
│   ├── src/
│   │   ├── components/
│   │   │   ├── orb/     # Consciencia 3D viva (nucleo, rede neural, arcos, fragmentos)
│   │   │   ├── hud/     # Moldura e telemetria futurista de sistema
│   │   │   └── ui/
│   │   └── App.tsx
│   ├── vite.config.ts   # Proxy /api direcionado ao Express (:3001)
│   └── package.json
└── server/              # Backend Node.js + Express + TypeScript
    ├── src/
    │   ├── index.ts     # Ponto de entrada, CORS, health check
    │   ├── routes/      # Endpoints (/api/chat)
    │   └── prompts/     # System prompt do Grande Sabio
    └── package.json
```

## Licenca

MIT
# Great-Sage
