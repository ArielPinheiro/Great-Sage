/**
 * Tool Executor — routes function calls from Gemini to the appropriate handler.
 *
 * Acts as a single dispatch point for all tool invocations.
 * Logs every execution with duration and status without exposing sensitive data.
 * Enforces destructive action confirmation guards.
 */

import { openApplication, type ToolResult } from './handlers/applicationHandler.js';
import { openUrl } from './handlers/browserHandler.js';
import { openFolder, openFile, createFolder } from './handlers/fileSystemHandler.js';
import { listRunningProcesses } from './handlers/processHandler.js';
import { mouseMove, mouseClick, mouseDoubleClick, mouseScroll } from './handlers/mouseHandler.js';
import { keyboardType, keyboardPress } from './handlers/keyboardHandler.js';
import { captureScreen } from './handlers/screenHandler.js';
import { checkDestructiveAction } from './security.js';

export interface FunctionCall {
  id?: string;
  name: string;
  args: Record<string, unknown>;
}

export interface FunctionResponse {
  id?: string;
  name: string;
  response: { result: string; requiresConfirmation?: boolean };
}

const TOOL_HANDLERS: Record<string, (args: Record<string, unknown>) => Promise<ToolResult>> = {
  // Desktop Base Controls
  open_application: openApplication,
  open_url: openUrl,
  open_folder: openFolder,
  open_file: openFile,
  list_running_processes: (_args) => listRunningProcesses(),
  create_folder: createFolder,

  // Desktop UI Automation (Mouse, Keyboard, Screen)
  mouse_move: mouseMove,
  mouse_click: mouseClick,
  mouse_double_click: mouseDoubleClick,
  mouse_scroll: mouseScroll,
  keyboard_type: keyboardType,
  keyboard_press: keyboardPress,
  capture_screen: captureScreen,
};

/**
 * Executes a single tool call with security checks, duration tracking, and diagnostics.
 */
export async function executeTool(call: FunctionCall): Promise<FunctionResponse> {
  const handler = TOOL_HANDLERS[call.name];

  if (!handler) {
    console.warn(`[Executor] Ferramenta desconhecida: "${call.name}". Ignorada.`);
    return {
      id: call.id,
      name: call.name,
      response: { result: `Ferramenta "${call.name}" não existe ou não está disponível.` },
    };
  }

  // Check for potentially destructive operations
  const destructiveCheck = checkDestructiveAction(call.name, call.args);
  if (destructiveCheck.isDestructive) {
    console.warn(`[Executor] [CONFIRMAÇÃO EXIGIDA] Ação ${call.name} interceptada pela camada de segurança.`);
    return {
      id: call.id,
      name: call.name,
      response: {
        result: `[AÇÃO REQUER CONFIRMAÇÃO DO USUÁRIO]: ${destructiveCheck.warningMessage} Por motivos de segurança, você deve solicitar a autorização explícita do usuário antes de prosseguir.`,
        requiresConfirmation: true,
      },
    };
  }

  const startTime = Date.now();
  console.log(`[Executor] Início da etapa: ${call.name}(${JSON.stringify(call.args)})`);

  try {
    const result = await handler(call.args);
    const duration = Date.now() - startTime;
    console.log(
      `[Executor] Conclusão de ${call.name} em ${duration}ms: ${result.success ? 'OK' : 'FALHA'} — ${result.message}`,
    );

    return {
      id: call.id,
      name: call.name,
      response: { result: result.message },
    };
  } catch (err: unknown) {
    const duration = Date.now() - startTime;
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[Executor] Falha na etapa ${call.name} após ${duration}ms:`, msg);

    return {
      id: call.id,
      name: call.name,
      response: { result: `Erro ao executar "${call.name}": ${msg}` },
    };
  }
}

/**
 * Executes multiple tool calls sequentially or in parallel and returns all results.
 */
export async function executeTools(calls: FunctionCall[]): Promise<FunctionResponse[]> {
  const results: FunctionResponse[] = [];
  for (const call of calls) {
    const res = await executeTool(call);
    results.push(res);
  }
  return results;
}
