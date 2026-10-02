/**
 * Browser handler — opens URLs in the default web browser.
 */

import { exec } from 'node:child_process';
import { validateUrl } from '../security.js';
import type { ToolResult } from './applicationHandler.js';

export async function openUrl(args: Record<string, unknown>): Promise<ToolResult> {
  const rawUrl = String(args.url || '').trim();
  if (!rawUrl) {
    return { success: false, message: 'Nenhuma URL foi fornecida.' };
  }

  const safeUrl = validateUrl(rawUrl);
  if (!safeUrl) {
    return {
      success: false,
      message: `URL "${rawUrl}" nao e valida ou nao utiliza protocolo seguro (http/https).`,
    };
  }

  return new Promise<ToolResult>((resolve) => {
    // Use 'start' to open URL in the default browser on Windows
    const cmd = `start "" "${safeUrl}"`;

    exec(cmd, { shell: 'cmd.exe', timeout: 10_000 }, (error) => {
      if (error) {
        console.error(`[Tool:open_url] Erro ao abrir "${safeUrl}":`, error.message);
        resolve({
          success: false,
          message: `Nao foi possivel abrir a URL "${safeUrl}".`,
        });
      } else {
        console.log(`[Tool:open_url] URL aberta: ${safeUrl}`);
        resolve({
          success: true,
          message: `URL aberta no navegador: ${safeUrl}`,
        });
      }
    });
  });
}
