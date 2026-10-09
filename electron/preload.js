// ──────────────────────────────────────────────────────────────
//  Daikenja — Grande Sábio · Electron Preload Script
// ──────────────────────────────────────────────────────────────

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  /** Save API configuration (used by setup.html) */
  saveConfig: (config) => ipcRenderer.send('save-config', config),

  /** Get desktop screens and windows */
  getDesktopSources: () => ipcRenderer.invoke('get-desktop-sources'),

  /** Save recorded screen blob / base64 to disk */
  saveRecording: (payload) => ipcRenderer.invoke('save-recording', payload),
});
