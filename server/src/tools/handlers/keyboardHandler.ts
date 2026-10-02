/**
 * Keyboard Automation Handler — types text and sends special key presses.
 * Uses native Windows automation via PowerShell helper.
 */

import { execFile } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ToolResult } from './applicationHandler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SCRIPT_PATH = path.resolve(__dirname, '../scripts/winAutomation.ps1');

function runAutomation(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      'powershell',
      ['-ExecutionPolicy', 'Bypass', '-File', SCRIPT_PATH, ...args],
      { timeout: 8000, windowsHide: true },
      (err, stdout, stderr) => {
        if (err) {
          reject(new Error(stderr || err.message));
        } else {
          resolve(stdout.trim());
        }
      },
    );
  });
}

const ALLOWED_KEYS = new Set([
  'ENTER',
  'RETURN',
  'TAB',
  'ESCAPE',
  'ESC',
  'BACKSPACE',
  'DELETE',
  'SPACE',
  'UP',
  'DOWN',
  'LEFT',
  'RIGHT',
  'HOME',
  'END',
  'PAGEUP',
  'PAGEDOWN',
  'F1',
  'F2',
  'F3',
  'F4',
  'F5',
  'F6',
  'F7',
  'F8',
  'F9',
  'F10',
  'F11',
  'F12',
]);

export async function keyboardType(args: Record<string, unknown>): Promise<ToolResult> {
  const text = typeof args.text === 'string' ? args.text : '';

  if (!text) {
    return {
      success: false,
      message: 'Nenhum texto informado para digitação (parâmetro "text" vazio).',
    };
  }

  // Length limit for safety
  if (text.length > 500) {
    return {
      success: false,
      message: 'Texto excede o limite máximo permitido de 500 caracteres por operação.',
    };
  }

  try {
    await runAutomation(['-Action', 'keyboard-type', '-Text', text]);
    const preview = text.length > 30 ? text.slice(0, 30) + '...' : text;
    return {
      success: true,
      message: `Texto digitado com sucesso: "${preview}".`,
    };
  } catch (err: unknown) {
    return {
      success: false,
      message: `Falha ao digitar texto: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

export async function keyboardPress(args: Record<string, unknown>): Promise<ToolResult> {
  const rawKey = typeof args.key === 'string' ? args.key.trim().toUpperCase() : '';

  if (!rawKey) {
    return {
      success: false,
      message: 'Nenhuma tecla informada para acionamento (parâmetro "key" vazio).',
    };
  }

  if (!ALLOWED_KEYS.has(rawKey)) {
    return {
      success: false,
      message: `Tecla "${rawKey}" não permitida ou desconhecida. Teclas válidas: ${Array.from(ALLOWED_KEYS).slice(0, 10).join(', ')}, etc.`,
    };
  }

  try {
    await runAutomation(['-Action', 'keyboard-press', '-Key', rawKey]);
    return {
      success: true,
      message: `Tecla "${rawKey}" acionada com sucesso.`,
    };
  } catch (err: unknown) {
    return {
      success: false,
      message: `Falha ao acionar tecla "${rawKey}": ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
