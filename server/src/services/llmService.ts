/**
 * Unified LLM Dispatcher.
 * Delegates directly to the Google Gemini Service.
 * Preserves existing architecture and contracts across the application.
 */

export {
  createGeminiStream as createChatStream,
  isGeminiConfigured as isLLMConfigured,
  getGeminiConfigStatus as getLLMConfigStatus,
  type ChatMessage,
  type ChatMode,
} from './geminiService.js';
