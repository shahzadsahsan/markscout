import { contextBridge, ipcRenderer } from 'electron';

// Expose minimal desktop APIs to the renderer
contextBridge.exposeInMainWorld('electron', {
  // Let the UI know it's running in Electron
  isElectron: true,
  platform: process.platform,

  // Desktop actions
  revealInFinder: (filePath: string) => ipcRenderer.invoke('reveal-in-finder', filePath),
  openFolder: (folderPath: string) => ipcRenderer.invoke('open-folder', folderPath),
  selectFolder: () => ipcRenderer.invoke('dialog:selectFolder'),

  // Menu-triggered events
  onTriggerAddFolder: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on('trigger-add-folder', handler);
    return () => { ipcRenderer.removeListener('trigger-add-folder', handler); };
  },

  // Update system
  appVersion: (() => {
    try { return require('../../package.json').version; } catch { return '0.0.0'; }
  })(),
  checkForUpdate: () => ipcRenderer.invoke('check-for-update'),
  openExternal: (url: string) => ipcRenderer.invoke('open-external', url),
  downloadUpdate: (dmgUrl: string) => ipcRenderer.invoke('download-update', dmgUrl),
  onUpdateAvailable: (callback: (info: unknown) => void) => {
    const handler = (_event: unknown, info: unknown) => callback(info);
    ipcRenderer.on('update-available', handler);
    return () => { ipcRenderer.removeListener('update-available', handler); };
  },
});
