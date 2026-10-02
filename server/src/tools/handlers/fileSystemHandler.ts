/**
 * File system handler — open folders, open files, create folders.
 * All operations are constrained to safe directories via the security layer.
 */

import { exec } from 'node:child_process';
import fs from 'node:fs/promises';
import { validatePath } from '../security.js';
import type { ToolResult } from './applicationHandler.js';

/**
 * Opens a folder in Windows File Explorer.
 */
export async function openFolder(args: Record<string, unknown>): Promise<ToolResult> {
  const rawPath = String(args.path || '').trim();
  if (!rawPath) {
    return { success: false, message: 'Nenhum caminho de pasta foi fornecido.' };
  }

  const safePath = validatePath(rawPath);
  if (!safePath) {
    return {
      success: false,
      message: `O caminho "${rawPath}" nao e permitido ou esta fora dos diretorios seguros.`,
    };
  }

  // Verify the path exists and is a directory
  try {
    const stat = await fs.stat(safePath);
    if (!stat.isDirectory()) {
      return {
        success: false,
        message: `"${safePath}" nao e uma pasta. Use open_file para abrir arquivos.`,
      };
    }
  } catch {
    return {
      success: false,
      message: `A pasta "${safePath}" nao foi encontrada.`,
    };
  }

  return new Promise<ToolResult>((resolve) => {
    exec(`explorer "${safePath}"`, { shell: 'cmd.exe', timeout: 10_000 }, (error) => {
      if (error) {
        // explorer.exe returns exit code 1 even on success in some cases
        if (error.code === 1) {
          console.log(`[Tool:open_folder] Pasta aberta (exit code 1, normal para explorer): ${safePath}`);
          resolve({ success: true, message: `Pasta aberta: ${safePath}` });
        } else {
          console.error(`[Tool:open_folder] Erro ao abrir pasta:`, error.message);
          resolve({ success: false, message: `Nao foi possivel abrir a pasta "${safePath}".` });
        }
      } else {
        console.log(`[Tool:open_folder] Pasta aberta: ${safePath}`);
        resolve({ success: true, message: `Pasta aberta: ${safePath}` });
      }
    });
  });
}

/**
 * Opens a file with its default associated program.
 */
export async function openFile(args: Record<string, unknown>): Promise<ToolResult> {
  const rawPath = String(args.path || '').trim();
  if (!rawPath) {
    return { success: false, message: 'Nenhum caminho de arquivo foi fornecido.' };
  }

  const safePath = validatePath(rawPath);
  if (!safePath) {
    return {
      success: false,
      message: `O caminho "${rawPath}" nao e permitido ou o tipo de arquivo esta bloqueado por seguranca.`,
    };
  }

  // Verify the file exists
  try {
    const stat = await fs.stat(safePath);
    if (!stat.isFile()) {
      return {
        success: false,
        message: `"${safePath}" nao e um arquivo. Use open_folder para abrir pastas.`,
      };
    }
  } catch {
    return {
      success: false,
      message: `O arquivo "${safePath}" nao foi encontrado.`,
    };
  }

  return new Promise<ToolResult>((resolve) => {
    const cmd = `start "" "${safePath}"`;

    exec(cmd, { shell: 'cmd.exe', timeout: 10_000 }, (error) => {
      if (error) {
        console.error(`[Tool:open_file] Erro ao abrir arquivo:`, error.message);
        resolve({ success: false, message: `Nao foi possivel abrir o arquivo "${safePath}".` });
      } else {
        console.log(`[Tool:open_file] Arquivo aberto: ${safePath}`);
        resolve({ success: true, message: `Arquivo aberto: ${safePath}` });
      }
    });
  });
}

/**
 * Creates a new folder at the specified path.
 */
export async function createFolder(args: Record<string, unknown>): Promise<ToolResult> {
  const rawPath = String(args.path || '').trim();
  if (!rawPath) {
    return { success: false, message: 'Nenhum caminho foi fornecido para criar a pasta.' };
  }

  const safePath = validatePath(rawPath);
  if (!safePath) {
    return {
      success: false,
      message: `O caminho "${rawPath}" nao e permitido ou esta fora dos diretorios seguros.`,
    };
  }

  // Check if already exists
  try {
    await fs.access(safePath);
    return {
      success: false,
      message: `Ja existe um arquivo ou pasta em "${safePath}".`,
    };
  } catch {
    // Expected — path doesn't exist yet
  }

  try {
    await fs.mkdir(safePath, { recursive: true });
    console.log(`[Tool:create_folder] Pasta criada: ${safePath}`);
    return {
      success: true,
      message: `Pasta criada com sucesso: ${safePath}`,
    };
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error(`[Tool:create_folder] Erro ao criar pasta:`, errMsg);
    return {
      success: false,
      message: `Nao foi possivel criar a pasta "${safePath}": ${errMsg}`,
    };
  }
}
