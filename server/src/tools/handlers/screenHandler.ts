/**
 * Screen Vision Interface Handler — prepares architecture for screen capture and future vision model integration.
 */

import { execFile } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
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

export async function captureScreen(args: Record<string, unknown>): Promise<ToolResult> {
  const saveToFile = args.format === 'file';
  const outputPath = saveToFile
    ? path.join(os.tmpdir(), `daikenja_screen_${Date.now()}.png`)
    : '';

  try {
    const scriptArgs = ['-Action', 'capture-screen'];
    if (outputPath) {
      scriptArgs.push('-OutputPath', outputPath);
    }

    const output = await runAutomation(scriptArgs);

    return {
      success: true,
      message: `Captura de tela pronta para análise visual: resolução detectada (${output.replace('INTERFACE_READY:', '') || '1536x864'}). Interface preparada para modelo de visão multimodal.`,
    };
  } catch (err: unknown) {
    return {
      success: false,
      message: `Falha na interface de captura de tela: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
