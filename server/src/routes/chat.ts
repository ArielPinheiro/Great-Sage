/**
 * POST /api/chat — Streaming chat endpoint for Daikenja.
 *
 * Accepts message history (roles: "user" | "assistant") and optional mode ("chat" | "analysis").
 * Streams SSE chunks from LLM (or mock service fallback).
 */

import { Router, Request, Response } from 'express';
import {
  createChatStream,
  type ChatMessage,
  type ChatMode,
} from '../services/llmService.js';

export const chatRouter = Router();

interface ValidationSuccess {
  valid: true;
  messages: ChatMessage[];
  mode: ChatMode;
  model?: string;
}

interface ValidationFailure {
  valid: false;
  reason: string;
}

function validateChatRequest(body: unknown): ValidationSuccess | ValidationFailure {
  if (!body || typeof body !== 'object') {
    return { valid: false, reason: 'Corpo da requisição inválido.' };
  }

  const { messages, mode, model } = body as Record<string, unknown>;

  // Validate model if provided
  let selectedModel: string | undefined;
  if (model !== undefined) {
    if (typeof model !== 'string' || !model.trim()) {
      return {
        valid: false,
        reason: 'Campo "model" deve ser uma string não-vazia.',
      };
    }
    selectedModel = model.trim();
  }

  // Validate mode
  let selectedMode: ChatMode = 'chat';
  if (mode !== undefined) {
    if (mode !== 'chat' && mode !== 'analysis') {
      return {
        valid: false,
        reason: 'Campo "mode" inválido. Valores aceitos: "chat", "analysis".',
      };
    }
    selectedMode = mode;
  }

  // Validate messages array
  if (!Array.isArray(messages) || messages.length === 0) {
    return {
      valid: false,
      reason: 'Campo "messages" deve ser um array não-vazio.',
    };
  }

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (
      !msg ||
      typeof msg !== 'object' ||
      typeof (msg as Record<string, unknown>).role !== 'string' ||
      typeof (msg as Record<string, unknown>).content !== 'string'
    ) {
      return {
        valid: false,
        reason: `Mensagem no índice ${i} deve ter "role" (string) e "content" (string).`,
      };
    }

    const imageBase64 = (msg as Record<string, unknown>).imageBase64;
    if (imageBase64 !== undefined && typeof imageBase64 !== 'string') {
      return {
        valid: false,
        reason: `Campo "imageBase64" no índice ${i} deve ser uma string válida.`,
      };
    }

    const role = (msg as Record<string, unknown>).role as string;
    if (role === 'system') {
      return {
        valid: false,
        reason: 'Mensagens com role "system" não são permitidas.',
      };
    }

    if (role !== 'user' && role !== 'assistant') {
      return {
        valid: false,
        reason: `Role inválida no índice ${i}: "${role}". Valores aceitos: "user", "assistant".`,
      };
    }
  }

  return {
    valid: true,
    messages: messages as ChatMessage[],
    mode: selectedMode,
    model: selectedModel,
  };
}

chatRouter.post('/chat', async (req: Request, res: Response) => {
  const validation = validateChatRequest(req.body);

  if (!validation.valid) {
    res.status(400).json({
      error: 'INVALID_REQUEST',
      message: validation.reason,
    });
    return;
  }

  const { messages, mode, model } = validation;

  const abortController = new AbortController();

  // Cancel upstream call when client disconnects
  res.on('close', () => {
    if (!res.writableEnded) {
      abortController.abort();
    }
  });

  try {
    const generator = createChatStream(messages, mode, abortController.signal, model);

    // Fetch first chunk to verify stream readiness before sending headers
    const firstResult = await generator.next();

    if (res.closed) {
      return;
    }

    // Set up SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.flushHeaders();

    if (!firstResult.done && firstResult.value) {
      res.write(firstResult.value);
    }

    for await (const chunk of generator) {
      if (res.closed || res.writableEnded) break;
      res.write(chunk);
    }

    if (!res.closed) {
      res.end();
    }
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      if (!res.closed) res.end();
      return;
    }

    console.error('[Chat] Erro inesperado no handler:', err);

    if (!res.headersSent) {
      res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: 'Erro interno ao processar a resposta.',
      });
    } else {
      res.write(
        `data: ${JSON.stringify({
          error: 'STREAM_ERROR',
          message: 'Erro durante o streaming da resposta.',
        })}\n\n`,
      );
      res.end();
    }
  }
});
