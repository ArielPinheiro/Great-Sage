/**
 * Tool definitions for Gemini Function Calling.
 *
 * Includes:
 * 1. Base desktop control tools (applications, URLs, folders, files, processes).
 * 2. Desktop UI Automation tools (mouse move/click/scroll, keyboard type/press, screen capture).
 */

import { Type, type FunctionDeclaration } from '@google/genai';

export const TOOL_DECLARATIONS: FunctionDeclaration[] = [
  // ── Existing Desktop Control Tools ───────────────────────────────
  {
    name: 'open_application',
    description:
      'Opens an application on the user\'s Windows computer. ' +
      'Use this when the user asks to open, launch, or start a specific program or app. ' +
      'Examples: "Abra o Chrome", "Abre o VS Code", "Abre a calculadora".',
    parameters: {
      type: Type.OBJECT,
      properties: {
        name: {
          type: Type.STRING,
          description:
            'The name of the application to open. ' +
            'Use common names like: chrome, firefox, edge, vscode, notepad, calc, calculator, calculadora, ' +
            'explorer, paint, terminal, powershell, cmd, word, excel, spotify, discord.',
        },
      },
      required: ['name'],
    },
  },
  {
    name: 'open_url',
    description:
      'Opens a URL in the user\'s default web browser. ' +
      'Use this when the user asks to access a website or web page. ' +
      'Examples: "Acesse o Google", "Abra o YouTube", "Vai pro GitHub".',
    parameters: {
      type: Type.OBJECT,
      properties: {
        url: {
          type: Type.STRING,
          description:
            'The URL to open. Include the protocol (https://) when possible. ' +
            'For well-known sites, use their full URL (e.g., https://www.google.com).',
        },
      },
      required: ['url'],
    },
  },
  {
    name: 'open_folder',
    description:
      'Opens a folder in Windows File Explorer. ' +
      'Use this when the user asks to open, show, or navigate to a directory. ' +
      'Examples: "Abra minha pasta Downloads", "Mostra meus documentos", "Abra a pasta Desktop".',
    parameters: {
      type: Type.OBJECT,
      properties: {
        path: {
          type: Type.STRING,
          description:
            'The path to the folder. Use common paths like ~/Desktop, ~/Downloads, ~/Documents. ' +
            'The ~ symbol represents the user\'s home directory.',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'open_file',
    description:
      'Opens a file with its default associated program. ' +
      'Use this when the user asks to open a specific file. ' +
      'Examples: "Abra o arquivo relatorio.pdf", "Abre a planilha notas.xlsx".',
    parameters: {
      type: Type.OBJECT,
      properties: {
        path: {
          type: Type.STRING,
          description:
            'The full path or relative path to the file. ' +
            'The ~ symbol represents the user\'s home directory.',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'list_running_processes',
    description:
      'Lists the applications currently open and running on the user\'s computer. ' +
      'Use this when the user asks what programs or apps are open, running, or active. ' +
      'Examples: "Quais aplicativos estão abertos?", "O que está rodando?", "Lista os programas abertos".',
    parameters: {
      type: Type.OBJECT,
      properties: {},
    },
  },
  {
    name: 'create_folder',
    description:
      'Creates a new folder/directory on the user\'s computer. ' +
      'Use this when the user asks to create, make, or add a new folder or directory. ' +
      'Examples: "Crie uma pasta chamada Projetos nos meus documentos", "Cria a pasta Backup no Desktop".',
    parameters: {
      type: Type.OBJECT,
      properties: {
        path: {
          type: Type.STRING,
          description:
            'The full path where the folder should be created, including the new folder name. ' +
            'The ~ symbol represents the user\'s home directory. ' +
            'Example: ~/Documents/Projetos',
        },
      },
      required: ['path'],
    },
  },

  // ── Desktop UI Automation Tools (Mouse, Keyboard, Screen) ────────
  {
    name: 'mouse_move',
    description:
      'Moves the mouse cursor to specific screen coordinates (X, Y). ' +
      'Coordinates start at (0,0) at the top-left of the screen.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        x: {
          type: Type.INTEGER,
          description: 'The horizontal pixel coordinate (e.g., 500).',
        },
        y: {
          type: Type.INTEGER,
          description: 'The vertical pixel coordinate (e.g., 300).',
        },
      },
      required: ['x', 'y'],
    },
  },
  {
    name: 'mouse_click',
    description:
      'Performs a mouse click with the left, right, or middle button. ' +
      'Can optionally move to coordinates (X, Y) before clicking.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        button: {
          type: Type.STRING,
          description: 'The mouse button to click: "left", "right", or "middle". Defaults to "left".',
        },
        x: {
          type: Type.INTEGER,
          description: 'Optional horizontal coordinate to move before clicking.',
        },
        y: {
          type: Type.INTEGER,
          description: 'Optional vertical coordinate to move before clicking.',
        },
      },
    },
  },
  {
    name: 'mouse_double_click',
    description:
      'Performs a mouse double click with the primary (left) button. ' +
      'Can optionally move to coordinates (X, Y) before double clicking.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        x: {
          type: Type.INTEGER,
          description: 'Optional horizontal coordinate to move before double clicking.',
        },
        y: {
          type: Type.INTEGER,
          description: 'Optional vertical coordinate to move before double clicking.',
        },
      },
    },
  },
  {
    name: 'mouse_scroll',
    description:
      'Scrolls the mouse wheel up or down by a given amount. ' +
      'Positive numbers or "up" direction scroll up; negative or "down" scroll down.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        amount: {
          type: Type.INTEGER,
          description: 'The amount to scroll in units (e.g. 120 or 240).',
        },
        direction: {
          type: Type.STRING,
          description: '"up" or "down". Defaults to "down".',
        },
      },
      required: ['amount'],
    },
  },
  {
    name: 'keyboard_type',
    description:
      'Types a sequence of characters on the active window, just as if typed on the physical keyboard. ' +
      'Use this to fill in search inputs, form fields, text editors, or URLs.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        text: {
          type: Type.STRING,
          description: 'The string of text to type.',
        },
      },
      required: ['text'],
    },
  },
  {
    name: 'keyboard_press',
    description:
      'Presses a special keyboard key on the active window. ' +
      'Supported keys: "ENTER", "TAB", "ESCAPE", "BACKSPACE", "DELETE", "SPACE", "UP", "DOWN", "LEFT", "RIGHT", "HOME", "END", "PAGEUP", "PAGEDOWN".',
    parameters: {
      type: Type.OBJECT,
      properties: {
        key: {
          type: Type.STRING,
          description: 'The key name to press (e.g., "ENTER", "TAB", "ESCAPE", "BACKSPACE").',
        },
      },
      required: ['key'],
    },
  },
  {
    name: 'capture_screen',
    description:
      'Captures the current desktop screen for visual inspection and returns resolution and readiness for vision models.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        format: {
          type: Type.STRING,
          description: '"base64" or "file". Defaults to "base64".',
        },
      },
    },
  },
];
