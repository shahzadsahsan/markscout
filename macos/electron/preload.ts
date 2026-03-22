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
});
