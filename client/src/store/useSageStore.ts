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
  imageBase64?: string;
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

  // Screen Vision, Recording and Monitoring States
  isRecording: boolean;
  isMonitoring: boolean;
  mediaRecorder: MediaRecorder | null;
  recordedChunks: Blob[];
  activeStream: MediaStream | null;
  monitoringIntervalId: any | null;

  // API quota management & metrics
  apiCallCount: number;
  apiLimit: number;
  setApiLimit: (limit: number) => void;
  resetApiCallCount: () => void;

  // Actions
  setStatus: (status: SageStatus) => void;
  setChatOpen: (open: boolean) => void;
  setRadialMenuOpen: (open: boolean) => void;
  checkServerHealth: () => void;
  sendMessage: (content: string, mode?: 'chat' | 'analysis', imageBase64?: string, customModel?: string) => Promise<void>;
  stopStreaming: () => void;
  clearConversation: () => void;

  // Screen actions
  captureScreenImage: (maxWidth?: number, quality?: number) => Promise<string | null>;
  startScreenRecording: () => Promise<boolean>;
  stopScreenRecording: () => Promise<string | null>;
  startMonitoring: (criteria?: string) => Promise<boolean>;
  stopMonitoring: () => void;
}

const STORAGE_KEY = 'great_sage_chat_history_v1';

// ── Frame Comparison Helpers (Quota Optimization) ───────────────
async function createLowResThumbnail(dataUrl: string, width = 64, height = 36): Promise<Uint8ClampedArray | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(null);
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      const imgData = ctx.getImageData(0, 0, width, height);
      resolve(imgData.data);
    };
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

function computePixelDifferenceRatio(prev: Uint8ClampedArray, current: Uint8ClampedArray, pixelThreshold = 25): number {
  if (prev.length !== current.length || prev.length === 0) return 1.0;
  let changedPixels = 0;
  const totalPixels = prev.length / 4;

  for (let i = 0; i < prev.length; i += 4) {
    const dr = Math.abs(prev[i] - current[i]);
    const dg = Math.abs(prev[i + 1] - current[i + 1]);
    const db = Math.abs(prev[i + 2] - current[i + 2]);
    // If RGB difference exceeds per-pixel threshold
    if ((dr + dg + db) / 3 > pixelThreshold) {
      changedPixels++;
    }
  }

  return changedPixels / totalPixels;
}

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

  isRecording: false,
  isMonitoring: false,
  mediaRecorder: null,
  recordedChunks: [],
  activeStream: null,
  monitoringIntervalId: null,

  apiCallCount: 0,
  apiLimit: 50,
  setApiLimit: (limit: number) => set({ apiLimit: limit }),
  resetApiCallCount: () => set({ apiCallCount: 0 }),

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

  sendMessage: async (content: string, mode: 'chat' | 'analysis' = 'chat', imageBase64?: string, customModel?: string) => {
    const trimmed = content.trim();
    if (!trimmed || get().isStreaming) return;

    // Intelligent command detection
    const normalized = trimmed.toLowerCase();
    if (normalized.includes('começar a gravar') || normalized.includes('comecar a gravar') || normalized.includes('iniciar gravação')) {
      const ok = await get().startScreenRecording();
      if (ok) return;
    }
    if (normalized.includes('parar de gravar') || normalized.includes('encerrar gravação') || normalized.includes('parar gravação')) {
      await get().stopScreenRecording();
      return;
    }
    if (normalized.includes('monitore minha tela') || normalized.includes('iniciar monitoramento')) {
      await get().startMonitoring(trimmed);
      return;
    }
    if (normalized.includes('parar monitoramento') || normalized.includes('encerrar monitoramento')) {
      get().stopMonitoring();
      return;
    }
    if (normalized.includes('analise minha tela') || normalized.includes('olhe minha tela') || normalized.includes('o que você vê na minha tela') || normalized.includes('veja minha tela')) {
      if (!imageBase64) {
        // High resolution for direct user command
        const capturedImg = await get().captureScreenImage(1920, 0.9);
        if (capturedImg) {
          return get().sendMessage(trimmed, mode, capturedImg);
        }
      }
    }

    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      role: 'user',
      content: trimmed,
      timestamp: Date.now(),
      imageBase64,
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
      apiCallCount: get().apiCallCount + 1,
    });

    // Prepare payload (only user and assistant roles)
    const apiMessages = newMessages.map((m) => ({
      role: m.role,
      content: m.content,
      imageBase64: m.imageBase64,
    }));

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages, mode, model: customModel }),
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

  // ── Screen Capture & Vision ────────────────────────────────────
  captureScreenImage: async (maxWidth: number = 1920, quality: number = 0.85) => {
    try {
      let rawDataUrl: string | null = null;

      // 1. In Electron desktop app environment
      if (typeof window !== 'undefined' && (window as any).electronAPI?.getDesktopSources) {
        const sources = await (window as any).electronAPI.getDesktopSources();
        if (sources && sources.length > 0) {
          const primary = sources.find((s: any) => s.name?.includes('Entire Screen') || s.name?.includes('Tela inteira')) || sources[0];
          rawDataUrl = primary?.thumbnailUrl || null;
        }
      }

      // 2. In browser / displayMedia environment fallback
      if (!rawDataUrl && navigator.mediaDevices?.getDisplayMedia) {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: { width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });
        const video = document.createElement('video');
        video.srcObject = stream;
        await video.play();

        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth || 1920;
        canvas.height = video.videoHeight || 1080;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          rawDataUrl = canvas.toDataURL('image/jpeg', 0.9);
        }
        stream.getTracks().forEach((track) => track.stop());
      }

      if (!rawDataUrl) return null;

      // Resize and compress if maxWidth or custom quality requested
      return new Promise<string>((resolve) => {
        const img = new Image();
        img.onload = () => {
          let targetWidth = img.width;
          let targetHeight = img.height;

          if (targetWidth > maxWidth) {
            targetHeight = Math.round((targetHeight * maxWidth) / targetWidth);
            targetWidth = maxWidth;
          }

          const canvas = document.createElement('canvas');
          canvas.width = targetWidth;
          canvas.height = targetHeight;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(rawDataUrl!);
            return;
          }

          ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = () => resolve(rawDataUrl!);
        img.src = rawDataUrl!;
      });
    } catch (err) {
      console.warn('[ScreenCapture] Falha ao capturar imagem da tela:', err);
      return null;
    }
  },

  // ── Screen Recording ───────────────────────────────────────────
  startScreenRecording: async () => {
    try {
      if (get().isRecording) {
        const assistantMessage: ChatMessage = {
          id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          role: 'assistant',
          content: 'A gravação de tela já está em andamento.',
          timestamp: Date.now(),
        };
        const msgs = [...get().messages, assistantMessage];
        persistMessages(msgs);
        set({ messages: msgs });
        return true;
      }

      let stream: MediaStream;

      // In Electron environment, get stream from screen source
      if (typeof window !== 'undefined' && (window as any).electronAPI?.getDesktopSources) {
        const sources = await (window as any).electronAPI.getDesktopSources();
        const primary = sources.find((s: any) => s.name?.includes('Entire Screen') || s.name?.includes('Tela inteira')) || sources[0];
        if (primary) {
          stream = await (navigator.mediaDevices as any).getUserMedia({
            audio: false,
            video: {
              mandatory: {
                chromeMediaSource: 'desktop',
                chromeMediaSourceId: primary.id,
                minWidth: 1280,
                maxWidth: 1920,
                minHeight: 720,
                maxHeight: 1080,
              },
            },
          });
        } else {
          stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        }
      } else {
        stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      }

      const chunks: Blob[] = [];
      const mimeType = MediaRecorder.isTypeSupported('video/webm; codecs=vp9')
        ? 'video/webm; codecs=vp9'
        : 'video/webm';

      const recorder = new MediaRecorder(stream, { mimeType });

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      recorder.start(1000); // 1-second chunks

      set({
        isRecording: true,
        mediaRecorder: recorder,
        recordedChunks: chunks,
        activeStream: stream,
      });

      const confirmMessage: ChatMessage = {
        id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        role: 'assistant',
        content: 'Gravação iniciada.',
        timestamp: Date.now(),
      };
      const newMsgs = [...get().messages, confirmMessage];
      persistMessages(newMsgs);
      set({ messages: newMsgs });
      return true;
    } catch (err: any) {
      console.error('[Recording] Erro ao iniciar gravação:', err);
      const failMessage: ChatMessage = {
        id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        role: 'assistant',
        content: `Não foi possível iniciar a gravação: ${err.message || 'permissão negada'}.`,
        timestamp: Date.now(),
      };
      const newMsgs = [...get().messages, failMessage];
      persistMessages(newMsgs);
      set({ messages: newMsgs });
      return false;
    }
  },

  stopScreenRecording: async () => {
    const { mediaRecorder, activeStream, recordedChunks, isRecording } = get();
    if (!isRecording || !mediaRecorder) {
      const notRecMessage: ChatMessage = {
        id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        role: 'assistant',
        content: 'Nenhuma gravação de tela ativa no momento.',
        timestamp: Date.now(),
      };
      const msgs = [...get().messages, notRecMessage];
      persistMessages(msgs);
      set({ messages: msgs });
      return null;
    }

    return new Promise((resolve) => {
      mediaRecorder.onstop = async () => {
        if (activeStream) {
          activeStream.getTracks().forEach((track) => track.stop());
        }

        const completeBlob = new Blob(recordedChunks, { type: 'video/webm' });

        // Save via Electron if available
        let savedPath = '';
        if (typeof window !== 'undefined' && (window as any).electronAPI?.saveRecording) {
          const reader = new FileReader();
          reader.readAsDataURL(completeBlob);
          reader.onloadend = async () => {
            const base64data = (reader.result as string).split(',')[1];
            const res = await (window as any).electronAPI.saveRecording({
              base64Data: base64data,
              extension: 'webm',
            });
            if (res.success) {
              savedPath = res.filePath;
            } else {
              savedPath = 'Downloads/Daikenja_Recordings (salvo via navegador)';
            }

            const stoppedMessage: ChatMessage = {
              id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              role: 'assistant',
              content: `Gravação finalizada e salva com sucesso.\n**Local do arquivo:** \`${savedPath}\``,
              timestamp: Date.now(),
            };
            const updated = [...get().messages, stoppedMessage];
            persistMessages(updated);
            set({
              messages: updated,
              isRecording: false,
              mediaRecorder: null,
              activeStream: null,
              recordedChunks: [],
            });
            resolve(savedPath);
          };
          return;
        }

        // Web fallback: Trigger download
        const url = URL.createObjectURL(completeBlob);
        const a = document.createElement('a');
        const filename = `gravacao_tela_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '_')}.webm`;
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);

        savedPath = `Downloads/${filename}`;
        const stoppedMessage: ChatMessage = {
          id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          role: 'assistant',
          content: `Gravação finalizada e salva com sucesso.\n**Local do arquivo:** \`${savedPath}\``,
          timestamp: Date.now(),
        };
        const updated = [...get().messages, stoppedMessage];
        persistMessages(updated);
        set({
          messages: updated,
          isRecording: false,
          mediaRecorder: null,
          activeStream: null,
          recordedChunks: [],
        });
        resolve(savedPath);
      };

      mediaRecorder.stop();
    });
  },

  // ── Continuous Screen Monitoring (Optimized for API Quota) ────
  startMonitoring: async (criteria: string = 'monitore minha tela') => {
    if (get().isMonitoring) {
      const activeNotice: ChatMessage = {
        id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        role: 'assistant',
        content: 'Monitoramento ativo',
        timestamp: Date.now(),
      };
      const msgs = [...get().messages, activeNotice];
      persistMessages(msgs);
      set({ messages: msgs });
      return true;
    }

    const startNotice: ChatMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      role: 'assistant',
      content: 'Monitoramento ativo',
      timestamp: Date.now(),
    };
    const msgs = [...get().messages, startNotice];
    persistMessages(msgs);
    set({ messages: msgs, isMonitoring: true });

    let lastLowResThumb: Uint8ClampedArray | null = null;
    let unchangedCount = 0;
    let currentInterval = 8000; // 8s adaptive default
    let isProcessing = false;
    let lastSummary = '';

    // State holder for cancellation
    const monitorState = {
      active: true,
      timerId: null as any,
    };

    const scheduleNextCheck = (delayMs: number) => {
      if (!monitorState.active) return;
      monitorState.timerId = setTimeout(runCheckCycle, delayMs);
      set({ monitoringIntervalId: monitorState });
    };

    const runCheckCycle = async () => {
      if (!get().isMonitoring || !monitorState.active || isProcessing) return;

      // 7. Check quota limit
      const { apiCallCount, apiLimit } = get();
      if (apiCallCount >= apiLimit) {
        const quotaWarning: ChatMessage = {
          id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          role: 'assistant',
          content: `⚠️ **Limite de chamadas atingido na sessão (${apiCallCount}/${apiLimit}):** O monitoramento foi pausado automaticamente para economizar sua cota.`,
          timestamp: Date.now(),
        };
        const updated = [...get().messages, quotaWarning];
        persistMessages(updated);
        set({ messages: updated, isMonitoring: false });
        get().stopMonitoring();
        return;
      }

      isProcessing = true;

      try {
        // 4. Capture downscaled image (max 1280px, quality 0.75)
        const frameDataUrl = await get().captureScreenImage(1280, 0.75);
        if (!frameDataUrl) {
          isProcessing = false;
          scheduleNextCheck(currentInterval);
          return;
        }

        // 1. Compare low-res 64x36 thumbnail locally
        const currentThumb = await createLowResThumbnail(frameDataUrl, 64, 36);
        if (currentThumb && lastLowResThumb) {
          const diffRatio = computePixelDifferenceRatio(lastLowResThumb, currentThumb, 25);

          // Threshold: 4% of pixels changed
          if (diffRatio < 0.04) {
            unchangedCount++;
            // 3. Adaptive interval: after 5 consecutive unchanged checks -> 15s, then 30s
            if (unchangedCount >= 10) {
              currentInterval = 30000;
            } else if (unchangedCount >= 5) {
              currentInterval = 15000;
            } else {
              currentInterval = 8000;
            }

            isProcessing = false;
            scheduleNextCheck(currentInterval);
            return;
          }
        }

        // Change detected!
        unchangedCount = 0;
        currentInterval = 8000; // Reset to 8s

        // 2. Wait 1.5s stability delay to let screen finish updating (animations, typing)
        await new Promise((r) => setTimeout(r, 1500));
        if (!get().isMonitoring || !monitorState.active) {
          isProcessing = false;
          return;
        }

        // Re-capture post-stabilization frame (1280px, 0.75 quality)
        const stabilizedFrame = await get().captureScreenImage(1280, 0.75);
        const frameToSend = stabilizedFrame || frameDataUrl;

        // Update last reference thumbnail
        lastLowResThumb = await createLowResThumbnail(frameToSend, 64, 36);

        // 5. Use lightweight model (Flash-Lite / Flash) for background monitoring
        const lightweightModel = 'gemini-3.5-flash-lite';
        const prompt = `[MODO MONITORAMENTO CONTÍNUO]\nCritério do usuário: "${criteria}". Observe a tela. SE E SOMENTE SE houver algo relevante ao critério pedido, ou um erro evidente no código/terminal/compilação, relate em NO MÁXIMO 1 OU 2 FRASES. Se estiver tudo normal ou sem problemas, responda estritamente "TUDO_NORMAL". Seja objetivo.`;

        // 6. Exponential backoff on rate limit (429)
        let retryCount = 0;
        const maxRetries = 3;
        let success = false;

        while (retryCount <= maxRetries && !success && get().isMonitoring) {
          try {
            // Count API Call
            set({ apiCallCount: get().apiCallCount + 1 });

            const response = await fetch('/api/chat', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                messages: [{ role: 'user', content: prompt, imageBase64: frameToSend }],
                mode: 'chat',
                model: lightweightModel,
              }),
            });

            if (response.status === 429) {
              throw new Error('RATE_LIMIT_429');
            }

            if (!response.ok || !response.body) {
              throw new Error(`HTTP_${response.status}`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let reply = '';
            let received429Error = false;

            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              const chunk = decoder.decode(value);
              const lines = chunk.split('\n');
              for (const line of lines) {
                if (line.startsWith('data: ') && !line.includes('[DONE]')) {
                  try {
                    const parsed = JSON.parse(line.slice(6));
                    if (parsed.error === 'RATE_LIMIT_EXCEEDED' || parsed.statusCode === 429) {
                      received429Error = true;
                    }
                    if (parsed.content) reply += parsed.content;
                  } catch {}
                }
              }
            }

            if (received429Error) {
              throw new Error('RATE_LIMIT_429');
            }

            success = true;
            const cleanReply = reply.trim();
            if (cleanReply && !cleanReply.includes('TUDO_NORMAL') && cleanReply !== lastSummary) {
              lastSummary = cleanReply;
              const alertMsg: ChatMessage = {
                id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                role: 'assistant',
                content: `👁️ **Alerta de Monitoramento:**\n${cleanReply}`,
                timestamp: Date.now(),
              };
              const current = [...get().messages, alertMsg];
              persistMessages(current);
              set({ messages: current });
            }
          } catch (err: any) {
            if (err?.message === 'RATE_LIMIT_429') {
              retryCount++;
              const backoffTimeMs = Math.min(2000 * Math.pow(2, retryCount), 16000);
              console.warn(`[Monitoring] Rate limit 429 atingido. Backoff exponencial (${retryCount}/${maxRetries}): aguardando ${backoffTimeMs}ms...`);

              if (retryCount >= maxRetries) {
                const rateLimitNotice: ChatMessage = {
                  id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                  role: 'assistant',
                  content: '⚠️ **Aviso de Cota:** Limite de requisições por minuto da API (Rate Limit 429) atingido. O monitoramento foi desacelerado temporariamente.',
                  timestamp: Date.now(),
                };
                const updated = [...get().messages, rateLimitNotice];
                persistMessages(updated);
                set({ messages: updated });
                currentInterval = 20000; // Slower interval
              } else {
                await new Promise((r) => setTimeout(r, backoffTimeMs));
              }
            } else {
              // Other transient network error
              break;
            }
          }
        }
      } catch (err) {
        console.warn('[Monitoring] Erro no ciclo de monitoramento:', err);
      } finally {
        isProcessing = false;
        scheduleNextCheck(currentInterval);
      }
    };

    // First cycle after initial 3s
    scheduleNextCheck(3000);
    return true;
  },

  stopMonitoring: () => {
    const { monitoringIntervalId, isMonitoring } = get();
    if (monitoringIntervalId) {
      if (typeof monitoringIntervalId === 'object' && monitoringIntervalId.active !== undefined) {
        monitoringIntervalId.active = false;
        if (monitoringIntervalId.timerId) clearTimeout(monitoringIntervalId.timerId);
      } else {
        clearInterval(monitoringIntervalId);
      }
    }

    if (isMonitoring) {
      const stopNotice: ChatMessage = {
        id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        role: 'assistant',
        content: 'Monitoramento encerrado',
        timestamp: Date.now(),
      };
      const msgs = [...get().messages, stopNotice];
      persistMessages(msgs);
      set({ messages: msgs, isMonitoring: false, monitoringIntervalId: null });
    } else {
      set({ isMonitoring: false, monitoringIntervalId: null });
    }
  },
}));
