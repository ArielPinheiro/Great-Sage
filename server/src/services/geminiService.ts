/**
 * Google Gemini AI Service — with Desktop Control & Function Calling support.
 *
 * Official SDK: @google/genai
 * Free tier compatible (gemini-3.5-flash-lite, gemini-3.8-flash).
 * Supports desktop tools via Gemini Function Calling.
 * Gracefully falls back to mockService on missing key, auth error, rate limit, or service unavailability.
 */

import { GoogleGenAI, type Content } from '@google/genai';
import { GREAT_SAGE_CHAT, GREAT_SAGE_ANALYSIS } from '../prompts/greatSage.js';
import { createMockStream } from './mockService.js';
import { TOOL_DECLARATIONS } from '../tools/definitions.js';
import { executeTools, type FunctionCall } from '../tools/executor.js';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export type ChatMode = 'chat' | 'analysis';

// Limits
const MAX_MESSAGES = 40;
const MAX_TOTAL_CHARS = 24_000;
const MAX_TOOL_ROUNDS = 8;

/**
 * Returns true if GEMINI_API_KEY is configured and valid.
 * Never logs or exposes the key value.
 */
export function isGeminiConfigured(): boolean {
  const key = process.env.GEMINI_API_KEY?.trim() || process.env.LLM_API_KEY?.trim();
  return Boolean(
    key &&
      key.length > 0 &&
      key !== 'your-gemini-key-here' &&
      key !== 'your-api-key-here',
  );
}

/**
 * Gets a sanitized status description of the Gemini configuration for logging.
 */
export function getGeminiConfigStatus(): {
  hasKey: boolean;
  model: string;
} {
  return {
    hasKey: isGeminiConfigured(),
    model: process.env.GEMINI_MODEL || process.env.LLM_MODEL || 'gemini-3.5-flash-lite',
  };
}

/**
 * Trims message history to satisfy limits, retaining the most recent items.
 */
export function pruneHistory(messages: ChatMessage[]): ChatMessage[] {
  let trimmed = messages.slice(-MAX_MESSAGES);
  let totalChars = trimmed.reduce((sum, m) => sum + m.content.length, 0);

  while (trimmed.length > 1 && totalChars > MAX_TOTAL_CHARS) {
    const removed = trimmed.shift();
    if (removed) {
      totalChars -= removed.content.length;
    }
  }

  return trimmed;
}

/**
 * Sanitizes error messages to ensure no API key is ever leaked to logs.
 */
function sanitizeErrorMessage(msg: string): string {
  return msg
    .replace(/AIza[0-9A-Za-z-_]{35}/g, '[REDACTED_GEMINI_KEY]')
    .replace(/sk-[a-zA-Z0-9_\-]{10,}/g, '[REDACTED_API_KEY]')
    .replace(/AQ\.[0-9A-Za-z-_]{20,}/g, '[REDACTED_KEY]');
}

/**
 * Identifies known Gemini error categories for clean diagnostic logging.
 */
function categorizeGeminiError(errMsg: string): string {
  const lower = errMsg.toLowerCase();
  if (lower.includes('429') || lower.includes('resource_exhausted') || lower.includes('quota')) {
    return 'Limite de requisicoes / cota da API gratuita atingido (Rate Limit)';
  }
  if (lower.includes('api_key_invalid') || lower.includes('400') || lower.includes('403') || lower.includes('unregistered')) {
    return 'Chave de API do Gemini invalida ou nao autorizada';
  }
  if (lower.includes('503') || lower.includes('unavailable') || lower.includes('overloaded')) {
    return 'Servico do Google Gemini temporariamente indisponivel ou sobrecarregado (503)';
  }
  if (lower.includes('abort') || lower.includes('cancelled')) {
    return 'Requisicao cancelada pelo cliente';
  }
  return 'Erro de comunicacao com a API do Gemini';
}

/**
 * Helper to retry asynchronous calls on transient 503 (high demand) errors.
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  signal?: AbortSignal,
  retries = 2,
  delayMs = 1200,
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }
    try {
      return await fn();
    } catch (err: unknown) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      if (
        (msg.includes('503') || msg.includes('UNAVAILABLE') || msg.includes('high demand')) &&
        attempt < retries
      ) {
        console.warn(`[Gemini] API com alta demanda (503). Retentando (${attempt + 1}/${retries}) em ${delayMs}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

/**
 * Streams text to the client with smooth chunking.
 */
async function* streamText(text: string, signal?: AbortSignal): AsyncGenerator<string> {
  // Split into chunks of tokens/words for a natural typing cadence
  const chunks = text.match(/[\s\S]{1,6}/g) || [text];
  for (const chunk of chunks) {
    if (signal?.aborted) return;
    yield `data: ${JSON.stringify({ content: chunk })}\n\n`;
    // Slight pause to make stream feel natural in UI
    await new Promise((r) => setTimeout(r, 15));
  }
}

/**
 * Generates user-friendly status descriptions for task progress events.
 */
function getActionDescription(name: string, args: Record<string, unknown>): string {
  switch (name) {
    case 'open_application':
      return `Abrindo ${args.name || 'aplicativo'}`;
    case 'open_url':
      return `Acessando ${args.url || 'endereço'}`;
    case 'open_folder':
      return `Abrindo pasta: ${args.path || ''}`;
    case 'open_file':
      return `Abrindo arquivo: ${args.path || ''}`;
    case 'list_running_processes':
      return 'Listando aplicativos ativos';
    case 'create_folder':
      return `Criando pasta: ${args.path || ''}`;
    case 'mouse_move':
      return `Movendo cursor para (${args.x}, ${args.y})`;
    case 'mouse_click':
      return `Clicando (${args.button || 'esquerdo'})`;
    case 'mouse_double_click':
      return 'Executando duplo clique';
    case 'mouse_scroll':
      return `Rolando mouse (${args.direction || 'baixo'})`;
    case 'keyboard_type':
      return `Digitando: "${String(args.text || '').slice(0, 30)}"`;
    case 'keyboard_press':
      return `Pressionando tecla [${args.key || ''}]`;
    case 'capture_screen':
      return 'Analisando tela do computador';
    default:
      return `Executando etapa: ${name}`;
  }
}

/**
 * Creates an async generator streaming SSE formatted chunks from Gemini.
 * Supports function calling: detects tool invocations, executes them on Windows,
 * sends results back to the model, and streams the final response.
 *
 * Seamlessly falls back to simulated mode on error or missing key.
 */
export async function* createGeminiStream(
  rawMessages: ChatMessage[],
  mode: ChatMode = 'chat',
  signal?: AbortSignal,
): AsyncGenerator<string> {
  const messages = pruneHistory(rawMessages);
  const lastUserMsg =
    [...messages].reverse().find((m) => m.role === 'user')?.content || '';

  // 1. Check if Gemini key is present
  if (!isGeminiConfigured()) {
    console.log(
      `[Gemini] GEMINI_API_KEY nao configurada. Ativando modo simulado (modo: ${mode}).`,
    );
    yield* createMockStream(lastUserMsg, mode, signal);
    return;
  }

  const apiKey = (process.env.GEMINI_API_KEY?.trim() || process.env.LLM_API_KEY?.trim())!;
  const model = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';

  console.log(`[Gemini] GEMINI_API_KEY detectada: SIM [presente, comprimento: ${apiKey.length}]`);
  console.log(`[Gemini] Modelo configurado: ${model}`);

  const systemInstruction =
    mode === 'analysis' ? GREAT_SAGE_ANALYSIS : GREAT_SAGE_CHAT;

  try {
    const ai = new GoogleGenAI({ apiKey });

    // Build chat history: all messages prior to the last user message
    const history: Content[] = [];
    const priorMessages = messages.slice(0, -1);
    for (const msg of priorMessages) {
      history.push({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }],
      });
    }

    // Configure tools only in chat mode
    const toolConfig =
      mode === 'chat'
        ? [{ functionDeclarations: TOOL_DECLARATIONS }]
        : undefined;

    const chat = ai.chats.create({
      model,
      history,
      config: {
        systemInstruction,
        tools: toolConfig,
      },
    });

    if (signal?.aborted) return;

    // In analysis mode, stream response directly
    if (mode === 'analysis') {
      console.log(`[Gemini] Modo analise ativado. Iniciando stream direto...`);
      const streamRes = await withRetry(
        () => chat.sendMessageStream({ message: lastUserMsg }),
        signal,
      );

      for await (const chunk of streamRes) {
        if (signal?.aborted) return;
        if (chunk.text) {
          yield `data: ${JSON.stringify({ content: chunk.text })}\n\n`;
        }
      }
      if (!signal?.aborted) {
        yield 'data: [DONE]\n\n';
      }
      return;
    }

    // ── Chat Mode with Tool Calling Support ─────────────────────────
    console.log(`[Gemini] Enviando mensagem do usuario: "${lastUserMsg}"`);

    // First call to check for tool calls
    let response = await withRetry(
      () => chat.sendMessage({ message: lastUserMsg }),
      signal,
    );

    // Function calling loop
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      if (signal?.aborted) return;

      const fcs = response.functionCalls as FunctionCall[] | undefined;

      // If model requests tools:
      if (fcs && fcs.length > 0) {
        console.log(
          `[Gemini] Round ${round + 1}: Modelo solicitou ${fcs.length} ferramenta(s): ${fcs.map((fc) => fc.name).join(', ')}`,
        );

        // Notify client about task progress (running)
        for (const fc of fcs) {
          yield `data: ${JSON.stringify({
            taskProgress: {
              step: round + 1,
              action: fc.name,
              description: getActionDescription(fc.name, fc.args),
              status: 'running',
            },
            toolCall: [{ name: fc.name, args: fc.args }],
          })}\n\n`;
        }

        // Execute all requested tools
        const toolResults = await executeTools(fcs);

        // Notify client about task progress (done)
        for (const tr of toolResults) {
          yield `data: ${JSON.stringify({
            taskProgress: {
              step: round + 1,
              action: tr.name,
              description: tr.response.result,
              status: 'done',
            },
          })}\n\n`;
        }

        // Prepare functionResponse payloads
        const toolMessages = toolResults.map((tr) => ({
          functionResponse: {
            id: tr.id,
            name: tr.name,
            response: tr.response,
          },
        }));

        if (signal?.aborted) return;

        // Ask model for next step in plan or final conclusion
        console.log(`[Gemini] Etapa ${round + 1} concluída. Consultando próximo passo do plano...`);
        response = await withRetry(
          () => chat.sendMessage({ message: toolMessages }),
          signal,
        );
        continue;
      }

      // No tools called, or returned text:
      const finalReply = response.text || '';
      console.log(`[Gemini] Modelo respondeu (${finalReply.length} caracteres). Transmitindo...`);
      yield* streamText(finalReply, signal);

      if (!signal?.aborted) {
        yield 'data: [DONE]\n\n';
      }
      return;
    }

    // Round limit reached
    yield `data: ${JSON.stringify({ content: 'Limite de execuções de ferramentas atingido.' })}\n\n`;
    yield 'data: [DONE]\n\n';

  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      console.log('[Gemini] Transmissao cancelada pelo cliente.');
      return;
    }

    const rawError = err instanceof Error ? err.message : String(err);
    const safeError = sanitizeErrorMessage(rawError);
    const category = categorizeGeminiError(safeError);

    console.warn(`[Gemini] Falha na chamada da API: ${safeError}`);
    console.warn(`[Gemini] Diagnostico: ${category}`);
    console.log(`[Gemini] Ativando fallback para o modo simulado sem interromper o servico.`);

    // Gracefully stream simulated response as fallback
    yield* createMockStream(lastUserMsg, mode, signal);
  }
}
