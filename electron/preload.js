// ──────────────────────────────────────────────────────────────
//  Daikenja — Grande Sábio · Electron Preload Script
// ──────────────────────────────────────────────────────────────

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  /** Save API configuration (used by setup.html) */
  saveConfig: (config) => ipcRenderer.send('save-config', config),
});
