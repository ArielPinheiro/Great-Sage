/**
 * Security layer for Desktop Control Agent.
 *
 * Whitelists allowed applications and safe filesystem paths.
 * Blocks access to system directories, registry tools, and admin utilities.
 * Sanitizes all user-provided inputs against shell injection.
 */

import path from 'node:path';
import os from 'node:os';

// ─── Allowed Applications ───────────────────────────────────────────────────
// Maps normalized friendly names to the Windows command used to launch them.

export const ALLOWED_APPS: Record<string, string> = {
  // Browsers
  'chrome': 'chrome',
  'google chrome': 'chrome',
  'firefox': 'firefox',
  'edge': 'msedge',
  'microsoft edge': 'msedge',
  'brave': 'brave',
  'opera': 'opera',

  // Development
  'vscode': 'code',
  'vs code': 'code',
  'visual studio code': 'code',
  'sublime': 'subl',
  'sublime text': 'subl',
  'git bash': 'git-bash',

  // System utilities
  'notepad': 'notepad',
  'bloco de notas': 'notepad',
  'calculadora': 'calc',
  'calculator': 'calc',
  'calc': 'calc',
  'explorer': 'explorer',
  'explorador': 'explorer',
  'explorador de arquivos': 'explorer',
  'paint': 'mspaint',
  'snipping tool': 'snippingtool',
  'ferramenta de recorte': 'snippingtool',
  'task manager': 'taskmgr',
  'gerenciador de tarefas': 'taskmgr',

  // Terminal
  'terminal': 'wt',
  'windows terminal': 'wt',
  'powershell': 'powershell',
  'cmd': 'cmd',
  'prompt de comando': 'cmd',

  // Office
  'word': 'winword',
  'excel': 'excel',
  'powerpoint': 'powerpnt',
  'outlook': 'outlook',

  // Communication
  'spotify': 'spotify',
  'discord': 'discord',
  'teams': 'teams',
  'microsoft teams': 'teams',
  'slack': 'slack',
  'telegram': 'telegram',
  'whatsapp': 'whatsapp',
};

// ─── Blocked Paths ──────────────────────────────────────────────────────────
// Absolute paths that must never be accessed or modified.

const BLOCKED_PATH_PATTERNS = [
  /^[a-z]:\\windows\\system32/i,
  /^[a-z]:\\windows\\syswow64/i,
  /^[a-z]:\\windows\\winsxs/i,
  /^[a-z]:\\program files.*\\windowsapps/i,
  /^[a-z]:\\programdata\\microsoft/i,
  /^[a-z]:\\\$recycle\.bin/i,
  /\\\.git\\/i,
  /\\node_modules\\/i,
];

const BLOCKED_EXTENSIONS = [
  '.exe', '.bat', '.cmd', '.ps1', '.vbs', '.wsf', '.msi',
  '.reg', '.scr', '.com', '.pif', '.hta',
];

// ─── Safe Base Directories ──────────────────────────────────────────────────
// Only allow filesystem operations within these roots.

function getSafeRoots(): string[] {
  const home = os.homedir();
  return [
    path.join(home, 'Desktop'),
    path.join(home, 'Documents'),
    path.join(home, 'Documentos'),
    path.join(home, 'Downloads'),
    path.join(home, 'Pictures'),
    path.join(home, 'Imagens'),
    path.join(home, 'Music'),
    path.join(home, 'Videos'),
    home, // allow home root for listing
  ];
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Resolves a friendly application name to its Windows command.
 * Returns null if the application is not in the whitelist.
 */
export function resolveAppCommand(name: string): string | null {
  const normalized = name.trim().toLowerCase();
  return ALLOWED_APPS[normalized] ?? null;
}

/**
 * Returns a sorted list of all allowed application names.
 */
export function getAllowedAppNames(): string[] {
  // Deduplicate by command, keep the shortest name per command
  const byCommand = new Map<string, string>();
  for (const [name, cmd] of Object.entries(ALLOWED_APPS)) {
    const existing = byCommand.get(cmd);
    if (!existing || name.length < existing.length) {
      byCommand.set(cmd, name);
    }
  }
  return Array.from(byCommand.values()).sort();
}

/**
 * Validates that a filesystem path is within safe boundaries.
 * Returns the normalized absolute path if safe, or null if blocked.
 */
export function validatePath(rawPath: string): string | null {
  if (!rawPath || typeof rawPath !== 'string') return null;

  // Resolve to absolute path
  let resolved: string;
  try {
    // Expand ~ to home directory
    const expanded = rawPath.replace(/^~/, os.homedir());
    resolved = path.resolve(expanded);
  } catch {
    return null;
  }

  // Check against blocked patterns
  for (const pattern of BLOCKED_PATH_PATTERNS) {
    if (pattern.test(resolved)) {
      return null;
    }
  }

  // Check against blocked extensions (for file operations)
  const ext = path.extname(resolved).toLowerCase();
  if (BLOCKED_EXTENSIONS.includes(ext)) {
    return null;
  }

  // Check if within a safe root
  const safeRoots = getSafeRoots();
  const isWithinSafe = safeRoots.some((root) => {
    const normalizedResolved = resolved.toLowerCase();
    const normalizedRoot = root.toLowerCase();
    return normalizedResolved.startsWith(normalizedRoot);
  });

  if (!isWithinSafe) {
    return null;
  }

  return resolved;
}

/**
 * Sanitizes a string to prevent shell injection.
 * Removes dangerous characters while preserving meaningful content.
 */
export function sanitizeInput(input: string): string {
  if (!input || typeof input !== 'string') return '';

  return input
    .replace(/[;&|`$(){}[\]!<>]/g, '') // Remove shell metacharacters
    .replace(/\.\.\//g, '')            // Remove path traversal
    .replace(/\.\.\\/g, '')            // Remove Windows path traversal
    .trim();
}

/**
 * Validates that a URL is safe to open (http/https only).
 */
export function validateUrl(rawUrl: string): string | null {
  if (!rawUrl || typeof rawUrl !== 'string') return null;

  try {
    const url = new URL(rawUrl);
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      return url.toString();
    }
  } catch {
    // Try prepending https:// for bare domains
    try {
      const url = new URL(`https://${rawUrl}`);
      if (url.protocol === 'https:') {
        return url.toString();
      }
    } catch {
      // Invalid URL
    }
  }

  return null;
}

/**
 * Checks if a requested tool action is potentially destructive or sensitive,
 * requiring explicit user confirmation before proceeding.
 */
export function checkDestructiveAction(toolName: string, args: Record<string, unknown>): {
  isDestructive: boolean;
  warningMessage?: string;
} {
  const normalizedName = toolName.toLowerCase();

  // Pattern detection for destructive terms in paths or names
  const targetStr = JSON.stringify(args).toLowerCase();
  const destructiveKeywords = ['delete', 'remove', 'rmdir', 'del ', 'format', 'unlink', 'kill', 'shutdown', 'restart', 'reboot'];

  for (const kw of destructiveKeywords) {
    if (targetStr.includes(kw)) {
      return {
        isDestructive: true,
        warningMessage: `Esta ação envolve termos destrutivos ("${kw}") que podem modificar ou excluir dados do computador. Confirmação explícita necessária.`,
      };
    }
  }

  // Any explicit file deletion or script execution requests
  if (normalizedName.includes('delete') || normalizedName.includes('remove') || normalizedName.includes('execute_script')) {
    return {
      isDestructive: true,
      warningMessage: `A ação "${toolName}" pode modificar arquivos ou configurações do computador. Deseja continuar?`,
    };
  }

  return { isDestructive: false };
}

