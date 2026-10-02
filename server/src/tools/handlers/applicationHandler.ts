/**
 * Application handler — opens whitelisted applications on Windows.
 */

import { exec } from 'node:child_process';
import { resolveAppCommand, getAllowedAppNames, sanitizeInput } from '../security.js';

export interface ToolResult {
  success: boolean;
  message: string;
}

export async function openApplication(args: Record<string, unknown>): Promise<ToolResult> {
  const rawName = String(args.name || '').trim();
  if (!rawName) {
    return { success: false, message: 'Nenhum nome de aplicativo foi fornecido.' };
  }

  const sanitized = sanitizeInput(rawName);
  const command = resolveAppCommand(sanitized);

  if (!command) {
    const allowed = getAllowedAppNames();
    return {
      success: false,
      message:
        `Aplicativo "${sanitized}" nao esta na lista de aplicativos permitidos. ` +
        `Aplicativos disponiveis: ${allowed.join(', ')}.`,
    };
  }

  return new Promise<ToolResult>((resolve) => {
    // Use 'start' command on Windows to launch the application
    const cmd = `start "" "${command}"`;

    exec(cmd, { shell: 'cmd.exe', timeout: 10_000 }, (error) => {
      if (error) {
        console.error(`[Tool:open_application] Erro ao abrir "${sanitized}":`, error.message);
        resolve({
          success: false,
          message: `Nao foi possivel abrir "${sanitized}". O aplicativo pode nao estar instalado ou disponivel no PATH.`,
        });
      } else {
        console.log(`[Tool:open_application] "${sanitized}" aberto com sucesso (comando: ${command}).`);
        resolve({
          success: true,
          message: `${sanitized} aberto com sucesso.`,
        });
      }
    });
  });
}
