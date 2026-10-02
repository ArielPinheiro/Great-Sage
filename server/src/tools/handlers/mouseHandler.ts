/**
 * Mouse Automation Handler — moves, clicks, double clicks, and scrolls the mouse cursor.
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

export interface MouseMoveArgs {
  x: number;
  y: number;
}

export interface MouseClickArgs {
  x?: number;
  y?: number;
  button?: 'left' | 'right' | 'middle';
}

export interface MouseDoubleClickArgs {
  x?: number;
  y?: number;
}

export interface MouseScrollArgs {
  amount: number;
  direction?: 'up' | 'down';
}

export async function mouseMove(args: Record<string, unknown>): Promise<ToolResult> {
  const x = Math.round(Number(args.x));
  const y = Math.round(Number(args.y));

  if (isNaN(x) || isNaN(y) || x < 0 || y < 0) {
    return {
      success: false,
      message: `Coordenadas inválidas para mouse_move: (${args.x}, ${args.y}). Devem ser números positivos.`,
    };
  }

  try {
    await runAutomation(['-Action', 'mouse-move', '-X', String(x), '-Y', String(y)]);
    return {
      success: true,
      message: `Cursor movido para (${x}, ${y}).`,
    };
  } catch (err: unknown) {
    return {
      success: false,
      message: `Falha ao mover cursor: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

export async function mouseClick(args: Record<string, unknown>): Promise<ToolResult> {
  const button = (typeof args.button === 'string' ? args.button.toLowerCase() : 'left') as
    | 'left'
    | 'right'
    | 'middle';

  const scriptArgs = ['-Action', 'mouse-click', '-Button', button];

  if (args.x !== undefined && args.y !== undefined) {
    const x = Math.round(Number(args.x));
    const y = Math.round(Number(args.y));
    if (!isNaN(x) && !isNaN(y) && x >= 0 && y >= 0) {
      scriptArgs.push('-X', String(x), '-Y', String(y));
    }
  }

  try {
    await runAutomation(scriptArgs);
    const loc = args.x !== undefined ? ` em (${args.x}, ${args.y})` : '';
    return {
      success: true,
      message: `Clique (${button})${loc} executado com sucesso.`,
    };
  } catch (err: unknown) {
    return {
      success: false,
      message: `Falha ao executar clique: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

export async function mouseDoubleClick(args: Record<string, unknown>): Promise<ToolResult> {
  const scriptArgs = ['-Action', 'mouse-double-click'];

  if (args.x !== undefined && args.y !== undefined) {
    const x = Math.round(Number(args.x));
    const y = Math.round(Number(args.y));
    if (!isNaN(x) && !isNaN(y) && x >= 0 && y >= 0) {
      scriptArgs.push('-X', String(x), '-Y', String(y));
    }
  }

  try {
    await runAutomation(scriptArgs);
    const loc = args.x !== undefined ? ` em (${args.x}, ${args.y})` : '';
    return {
      success: true,
      message: `Duplo clique${loc} executado com sucesso.`,
    };
  } catch (err: unknown) {
    return {
      success: false,
      message: `Falha ao executar duplo clique: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

export async function mouseScroll(args: Record<string, unknown>): Promise<ToolResult> {
  let amount = Math.round(Number(args.amount) || 120);
  const direction = typeof args.direction === 'string' ? args.direction.toLowerCase() : 'down';

  if (direction === 'down' && amount > 0) {
    amount = -amount;
  } else if (direction === 'up' && amount < 0) {
    amount = Math.abs(amount);
  }

  try {
    await runAutomation(['-Action', 'mouse-scroll', '-Amount', String(amount)]);
    return {
      success: true,
      message: `Rolagem do mouse executada (${direction}, ${Math.abs(amount)} unidades).`,
    };
  } catch (err: unknown) {
    return {
      success: false,
      message: `Falha ao rolar mouse: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
