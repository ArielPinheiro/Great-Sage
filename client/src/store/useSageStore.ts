import { create } from 'zustand';
import type { SageStatus } from '../components/orb/types';

export interface TaskStep {
  step: number;
  action: string;
  description: string;
  status: 'running' | 'done' | 'failed';
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  taskSteps?: TaskStep[];
}

export type ServerMode = 'real' | 'mock' | 'unknown';

interface SageStoreState {
  status: SageStatus;
  serverMode: ServerMode;
  isChatOpen: boolean;
  isRadialMenuOpen: boolean;
  messages: ChatMessage[];
  taskSteps: TaskStep[];
  isStreaming: boolean;
  streamingContent: string;
  abortController: AbortController | null;

  // Actions
  setStatus: (status: SageStatus) => void;
  setChatOpen: (open: boolean) => void;
  setRadialMenuOpen: (open: boolean) => void;
  checkServerHealth: () => void;
  sendMessage: (content: string, mode?: 'chat' | 'analysis') => Promise<void>;
  stopStreaming: () => void;
  clearConversation: () => void;
}

const STORAGE_KEY = 'great_sage_chat_history_v1';

function loadPersistedMessages(): ChatMessage[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // Ignore corrupt storage
  }
  return [];
}

function persistMessages(messages: ChatMessage[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  } catch {
    // Ignore quota errors
  }
}

export const useSageStore = create<SageStoreState>((set, get) => ({
  status: 'idle',
  serverMode: 'unknown',
  isChatOpen: false,
  isRadialMenuOpen: false,
  messages: loadPersistedMessages(),
  taskSteps: [],
  isStreaming: false,
  streamingContent: '',
  abortController: null,

  setStatus: (status) => set({ status }),
  setChatOpen: (open) => set({ isChatOpen: open }),
  setRadialMenuOpen: (open) => set({ isRadialMenuOpen: open }),

  checkServerHealth: () => {
    fetch('/api/health')
      .then((res) => res.json())
      .then((data) => {
        if (data && (data.mode === 'real' || data.mode === 'mock')) {
          set({ serverMode: data.mode });
        }
      })
      .catch(() => {
        // Server might be offline or initializing
      });
  },

  sendMessage: async (content: string, mode: 'chat' | 'analysis' = 'chat') => {
    const trimmed = content.trim();
    if (!trimmed || get().isStreaming) return;

    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      role: 'user',
      content: trimmed,
      timestamp: Date.now(),
    };

    const newMessages = [...get().messages, userMessage];
    persistMessages(newMessages);

    const abortController = new AbortController();

    set({
      messages: newMessages,
      taskSteps: [],
      isStreaming: true,
      streamingContent: '',
      status: 'thinking',
      abortController,
    });

    // Prepare payload (only user and assistant roles)
    const apiMessages = newMessages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages, mode }),
        signal: abortController.signal,
      });

      if (!response.ok) {
        let errMessage = 'Erro na comunicação com o Grande Sábio.';
        try {
          const errData = await response.json();
          if (errData?.message) errMessage = errData.message;
        } catch {
          // ignore
        }
        throw new Error(errMessage);
      }

      if (!response.body) {
        throw new Error('Servidor não retornou dados de transmissão.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';
      let isFirstChunk = true;
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const rawLine of lines) {
          const line = rawLine.trim();
          if (!line.startsWith('data: ')) continue;
          const dataStr = line.slice(6);
          if (dataStr === '[DONE]') continue;

          try {
            const parsed = JSON.parse(dataStr);
            if (parsed.error) {
              throw new Error(parsed.message || 'Erro durante a transmissão.');
            }
            if (parsed.taskProgress) {
              const p = parsed.taskProgress as TaskStep;
              const current = [...get().taskSteps];
              const idx = current.findIndex((s) => s.step === p.step && s.action === p.action);
              if (idx >= 0) {
                current[idx] = { ...current[idx], ...p };
              } else {
                current.push(p);
              }
              set({ taskSteps: current, status: 'responding' });
            }

            if (parsed.content) {
              if (isFirstChunk) {
                isFirstChunk = false;
                set({ status: 'responding' });
              }
              accumulated += parsed.content;
              set({ streamingContent: accumulated });
            }
          } catch (e: unknown) {
            if ((e as Error).name === 'Error') throw e;
          }
        }
      }

      // Finalize assistant message
      if (accumulated.trim().length > 0 || get().taskSteps.length > 0) {
        const assistantMessage: ChatMessage = {
          id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          role: 'assistant',
          content: accumulated,
          taskSteps: get().taskSteps.length > 0 ? get().taskSteps : undefined,
          timestamp: Date.now(),
        };
        const finalMessages = [...get().messages, assistantMessage];
        persistMessages(finalMessages);
        set({
          messages: finalMessages,
          streamingContent: '',
          taskSteps: [],
          isStreaming: false,
          status: 'idle',
          abortController: null,
        });
      } else {
        set({
          streamingContent: '',
          taskSteps: [],
          isStreaming: false,
          status: 'idle',
          abortController: null,
        });
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        // Manually stopped by user
        const currentStreaming = get().streamingContent;
        if (currentStreaming.trim().length > 0) {
          const partialMessage: ChatMessage = {
            id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            role: 'assistant',
            content: `${currentStreaming}\n\n*[Resposta interrompida pelo usuário]*`,
            timestamp: Date.now(),
          };
          const stoppedMessages = [...get().messages, partialMessage];
          persistMessages(stoppedMessages);
          set({ messages: stoppedMessages });
        }
        set({
          streamingContent: '',
          isStreaming: false,
          status: 'idle',
          abortController: null,
        });
        return;
      }

      // Real error occurred
      const errorMessage =
        err instanceof Error ? err.message : 'Falha na resposta do sistema.';

      const errBotMessage: ChatMessage = {
        id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        role: 'assistant',
        content: `**Anomalia de comunicação detectada:**\n${errorMessage}`,
        timestamp: Date.now(),
      };

      const withErrorMessages = [...get().messages, errBotMessage];
      persistMessages(withErrorMessages);

      set({
        messages: withErrorMessages,
        streamingContent: '',
        isStreaming: false,
        status: 'error',
        abortController: null,
      });

      // Smoothly return to idle after brief error alert
      setTimeout(() => {
        if (get().status === 'error') {
          set({ status: 'idle' });
        }
      }, 3500);
    }
  },

  stopStreaming: () => {
    const { abortController } = get();
    if (abortController) {
      abortController.abort();
    }
  },

  clearConversation: () => {
    get().stopStreaming();
    persistMessages([]);
    set({ messages: [], streamingContent: '' });
  },
}));
