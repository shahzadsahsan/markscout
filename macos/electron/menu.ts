import { app, Menu, shell, BrowserWindow, MenuItemConstructorOptions } from 'electron';
import * as path from 'path';
import * as os from 'os';

const STATE_DIR = path.join(os.homedir(), '.markreader');
const STATE_FILE = path.join(STATE_DIR, 'state.json');

const WATCHED_DIRS = [
  path.join(os.homedir(), 'Vibe Coding'),
  path.join(os.homedir(), '.claude'),
];

export function buildMenu(): Menu {
  const template: MenuItemConstructorOptions[] = [
    {
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'File',
      submenu: [
        {
          label: 'Add Folder...',
          accelerator: 'CmdOrCtrl+Shift+O',
          click: () => {
            const win = BrowserWindow.getFocusedWindow();
            if (win) win.webContents.send('trigger-add-folder');
          },
        },
        { type: 'separator' },
        {
          label: 'Reveal State File in Finder',
          click: () => shell.showItemInFolder(STATE_FILE),
        },
        { type: 'separator' },
        ...WATCHED_DIRS.map((dir) => ({
          label: `Open ${path.basename(dir)}/`,
          click: () => shell.openPath(dir),
        })),
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'copy' as const },
        { role: 'selectAll' as const },
        { type: 'separator' as const },
        {
          label: 'Find',
          accelerator: 'CmdOrCtrl+F',
          click: () => {
            const win = BrowserWindow.getFocusedWindow();
            if (win) {
              // Send keyboard event to trigger the app's built-in search
              win.webContents.sendInputEvent({
                type: 'keyDown',
                keyCode: '/',
              });
            }
          },
        },
      ],
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Recents',
          accelerator: 'CmdOrCtrl+1',
          click: () => sendViewSwitch('recents'),
        },
        {
          label: 'Folders',
          accelerator: 'CmdOrCtrl+2',
          click: () => sendViewSwitch('folders'),
        },
        {
          label: 'Favorites',
          accelerator: 'CmdOrCtrl+3',
          click: () => sendViewSwitch('favorites'),
        },
        {
          label: 'History',
          accelerator: 'CmdOrCtrl+4',
          click: () => sendViewSwitch('history'),
        },
        { type: 'separator' },
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        { type: 'separator' },
        { role: 'close' },
      ],
    },
  ];

  return Menu.buildFromTemplate(template);
}

function sendViewSwitch(view: string): void {
  const win = BrowserWindow.getFocusedWindow();
  if (win) {
    // Execute JS in the renderer to switch views via the app's keyboard shortcuts
    win.webContents.executeJavaScript(`
      document.dispatchEvent(new KeyboardEvent('keydown', { key: '${viewToKey(view)}' }));
    `).catch(() => {});
  }
}

function viewToKey(view: string): string {
  switch (view) {
    case 'recents': return '1';
    case 'folders': return '2';
    case 'favorites': return '3';
    case 'history': return '4';
    default: return '1';
  }
}
