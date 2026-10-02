/**
 * Process handler — lists currently running applications with visible windows.
 */

import { exec } from 'node:child_process';
import type { ToolResult } from './applicationHandler.js';

interface RunningProcess {
  name: string;
  title: string;
}

/**
 * Lists running processes that have a visible window title.
 * Uses PowerShell to filter only user-facing applications.
 */
export async function listRunningProcesses(): Promise<ToolResult> {
  return new Promise<ToolResult>((resolve) => {
    const psCommand = `powershell -NoProfile -Command "Get-Process | Where-Object { $_.MainWindowTitle -ne '' } | Select-Object @{N='name';E={$_.ProcessName}}, @{N='title';E={$_.MainWindowTitle}} | ConvertTo-Json -Compress"`;

    exec(psCommand, { timeout: 15_000 }, (error, stdout) => {
      if (error) {
        console.error('[Tool:list_running_processes] Erro:', error.message);
        resolve({
          success: false,
          message: 'Nao foi possivel obter a lista de processos em execucao.',
        });
        return;
      }

      try {
        const raw = stdout.trim();
        if (!raw) {
          resolve({
            success: true,
            message: 'Nenhum aplicativo com janela visivel encontrado.',
          });
          return;
        }

        // PowerShell returns a single object (not array) when there's only one result
        const parsed = JSON.parse(raw);
        const processes: RunningProcess[] = Array.isArray(parsed) ? parsed : [parsed];

        // Deduplicate by process name, keep distinct titles
        const grouped = new Map<string, Set<string>>();
        for (const proc of processes) {
          if (!proc.name || !proc.title) continue;
          if (!grouped.has(proc.name)) {
            grouped.set(proc.name, new Set());
          }
          grouped.get(proc.name)!.add(proc.title);
        }

        const lines: string[] = [];
        for (const [name, titles] of grouped) {
          const titleList = Array.from(titles);
          if (titleList.length === 1) {
            lines.push(`- ${name}: ${titleList[0]}`);
          } else {
            lines.push(`- ${name} (${titleList.length} janelas):`);
            for (const t of titleList) {
              lines.push(`  - ${t}`);
            }
          }
        }

        const count = grouped.size;
        const summary = `${count} aplicativo${count !== 1 ? 's' : ''} com janela visivel:\n${lines.join('\n')}`;

        console.log(`[Tool:list_running_processes] ${count} aplicativos encontrados.`);
        resolve({ success: true, message: summary });
      } catch (parseErr) {
        console.error('[Tool:list_running_processes] Erro no parse:', parseErr);
        resolve({
          success: true,
          message: `Processos em execucao (formato bruto):\n${stdout.trim()}`,
        });
      }
    });
  });
}
