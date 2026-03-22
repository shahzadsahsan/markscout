import { app, BrowserWindow, Menu, shell, ipcMain, dialog } from 'electron';
import { ChildProcess, spawn } from 'child_process';
import * as path from 'path';
import * as net from 'net';
import * as http from 'http';
import * as fs from 'fs';
import * as os from 'os';
import { buildMenu } from './menu';

// ── Paths ──────────────────────────────────────────────────────────────────────

const isDev = !app.isPackaged;

// In dev: __dirname is macos/dist-electron/, so ../.. = markreader/
// In production: the app bundle can't contain the full Next.js project,
// so we hardcode the source path for this personal-use local app.
const PROJECT_ROOT = isDev
  ? path.resolve(__dirname, '..', '..')
  : path.join(os.homedir(), 'Vibe Coding', 'markreader');
const STATE_DIR = path.join(os.homedir(), '.markreader');
const WINDOW_STATE_FILE = path.join(STATE_DIR, 'window-state.json');

// ── Window State Persistence ───────────────────────────────────────────────────

interface WindowState {
  x?: number;
  y?: number;
  width: number;
  height: number;
  isMaximized?: boolean;
}

const DEFAULT_STATE: WindowState = { width: 1200, height: 800 };

function loadWindowState(): WindowState {
  try {
    if (fs.existsSync(WINDOW_STATE_FILE)) {
      const data = fs.readFileSync(WINDOW_STATE_FILE, 'utf-8');
      return { ...DEFAULT_STATE, ...JSON.parse(data) };
    }
  } catch {
    // Ignore corrupt state file
  }
  return DEFAULT_STATE;
}

function saveWindowState(win: BrowserWindow): void {
  try {
    const bounds = win.getBounds();
    const state: WindowState = {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      isMaximized: win.isMaximized(),
    };
    fs.mkdirSync(STATE_DIR, { recursive: true });
    const tmp = WINDOW_STATE_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
    fs.renameSync(tmp, WINDOW_STATE_FILE);
  } catch {
    // Non-critical — ignore write failures
  }
}

// ── Port Discovery ─────────────────────────────────────────────────────────────

function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      if (addr && typeof addr === 'object') {
        const port = addr.port;
        server.close(() => resolve(port));
      } else {
        reject(new Error('Could not find free port'));
      }
    });
    server.on('error', reject);
  });
}

// ── Wait for Next.js Server ────────────────────────────────────────────────────

function waitForServer(port: number, maxAttempts = 60): Promise<void> {
  return new Promise((resolve, reject) => {
    let attempts = 0;

    const check = () => {
      attempts++;
      if (attempts > maxAttempts) {
        reject(new Error(`Next.js server did not start after ${maxAttempts} attempts`));
        return;
      }

      const req = http.get(`http://127.0.0.1:${port}`, (res) => {
        res.resume();
        resolve();
      });

      req.on('error', () => {
        setTimeout(check, 500);
      });

      req.setTimeout(2000, () => {
        req.destroy();
        setTimeout(check, 500);
      });
    };

    check();
  });
}

// ── Check for Existing Server ──────────────────────────────────────────────────

function checkExistingServer(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${port}`, (res) => {
      res.resume();
      resolve(true);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(1000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

// ── Next.js Server Management ──────────────────────────────────────────────────

let nextProcess: ChildProcess | null = null;
let serverPort: number = 0;
let usingExternalServer = false;

async function startNextServer(): Promise<number> {
  // In dev mode, check if an existing Next.js dev server is already running
  if (isDev) {
    const DEFAULT_DEV_PORT = 3000;
    const existing = await checkExistingServer(DEFAULT_DEV_PORT);
    if (existing) {
      console.log(`Reusing existing Next.js dev server on port ${DEFAULT_DEV_PORT}`);
      serverPort = DEFAULT_DEV_PORT;
      usingExternalServer = true;
      return DEFAULT_DEV_PORT;
    }
  }

  const port = await findFreePort();
  serverPort = port;

  const command = isDev ? 'dev' : 'start';

  // Use the next binary directly from the project's node_modules.
  // macOS GUI apps don't inherit shell PATH, so npx/node may not be found.
  const nextBin = path.join(PROJECT_ROOT, 'node_modules', '.bin', 'next');

  // Ensure PATH includes common node install locations for child processes
  const shellPath = [
    '/opt/homebrew/bin',
    '/usr/local/bin',
    '/usr/bin',
    process.env.PATH || '',
  ].join(':');

  nextProcess = spawn(nextBin, [command, '-p', String(port), '-H', '127.0.0.1'], {
    cwd: PROJECT_ROOT,
    env: {
      ...process.env,
      PATH: shellPath,
      NODE_ENV: isDev ? 'development' : 'production',
      PORT: String(port),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  if (isDev) {
    nextProcess.stdout?.on('data', (data: Buffer) => {
      process.stdout.write(`[next] ${data.toString()}`);
    });
    nextProcess.stderr?.on('data', (data: Buffer) => {
      process.stderr.write(`[next:err] ${data.toString()}`);
    });
  }

  nextProcess.on('exit', (code) => {
    if (code !== null && code !== 0) {
      console.error(`Next.js process exited with code ${code}`);
    }
    nextProcess = null;
  });

  await waitForServer(port);
  return port;
}

function stopNextServer(): Promise<void> {
  return new Promise((resolve) => {
    if (!nextProcess || usingExternalServer) {
      resolve();
      return;
    }

    nextProcess.on('exit', () => {
      nextProcess = null;
      resolve();
    });

    nextProcess.kill('SIGTERM');

    setTimeout(() => {
      if (nextProcess) {
        nextProcess.kill('SIGKILL');
        nextProcess = null;
        resolve();
      }
    }, 5000);
  });
}

// ── IPC Handlers ───────────────────────────────────────────────────────────────

function registerIpcHandlers(): void {
  ipcMain.handle('reveal-in-finder', (_event, filePath: string) => {
    if (typeof filePath === 'string' && filePath.length > 0) {
      shell.showItemInFolder(filePath);
    }
  });

  ipcMain.handle('open-folder', (_event, folderPath: string) => {
    if (typeof folderPath === 'string' && folderPath.length > 0) {
      shell.openPath(folderPath);
    }
  });

  ipcMain.handle('dialog:selectFolder', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: 'Select a folder to watch',
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });
}

// ── Loading Screen ─────────────────────────────────────────────────────────────

const LOADING_HTML = `
<!DOCTYPE html>
<html>
<head>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: #0d0d0d;
      color: #e0e0e0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100vh;
      -webkit-app-region: drag;
    }
    .loader {
      text-align: center;
    }
    .spinner {
      width: 32px;
      height: 32px;
      border: 2px solid #2a2a2a;
      border-top-color: #d4a04a;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin: 0 auto 16px;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    .title {
      font-size: 18px;
      font-weight: 500;
      color: #888;
      letter-spacing: 0.5px;
    }
  </style>
</head>
<body>
  <div class="loader">
    <div class="spinner"></div>
    <div class="title">MarkReader</div>
  </div>
</body>
</html>
`;

// ── Window ─────────────────────────────────────────────────────────────────────

let mainWindow: BrowserWindow | null = null;
let saveStateTimer: ReturnType<typeof setTimeout> | null = null;

function createWindow(port: number): void {
  const savedState = loadWindowState();

  mainWindow = new BrowserWindow({
    ...savedState,
    minWidth: 800,
    minHeight: 600,
    titleBarStyle: 'default',
    backgroundColor: '#0d0d0d',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
  });

  if (savedState.isMaximized) {
    mainWindow.maximize();
  }

  // Show loading screen immediately, then swap to the app
  mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(LOADING_HTML)}`);
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  // Once visible, navigate to the actual app
  setTimeout(() => {
    mainWindow?.loadURL(`http://127.0.0.1:${port}`);
  }, 100);

  if (isDev) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  // ── Security: restrict navigation ──

  mainWindow.webContents.on('will-navigate', (event, url) => {
    try {
      const parsed = new URL(url);
      if (parsed.hostname !== '127.0.0.1' || parsed.port !== String(port)) {
        event.preventDefault();
        shell.openExternal(url);
      }
    } catch {
      event.preventDefault();
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // ── Window state persistence (debounced) ──

  const debouncedSave = () => {
    if (saveStateTimer) clearTimeout(saveStateTimer);
    saveStateTimer = setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        saveWindowState(mainWindow);
      }
    }, 500);
  };

  mainWindow.on('resize', debouncedSave);
  mainWindow.on('move', debouncedSave);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ── App Lifecycle ──────────────────────────────────────────────────────────────

app.on('ready', async () => {
  // Set up native menu
  Menu.setApplicationMenu(buildMenu());

  // Register IPC handlers for preload bridge
  registerIpcHandlers();

  try {
    console.log(`Starting Next.js server (project: ${PROJECT_ROOT})...`);
    const port = await startNextServer();
    console.log(`Next.js ready on port ${port}`);
    createWindow(port);
  } catch (err) {
    console.error('Failed to start:', err);
    // Show error dialog instead of silently dying
    dialog.showErrorBox(
      'MarkReader failed to start',
      `Could not start the Next.js server.\n\nMake sure you've run "npm run build" in:\n${PROJECT_ROOT}\n\nError: ${err}`
    );
    app.quit();
  }
});

app.on('window-all-closed', () => {
  app.quit();
});

app.on('before-quit', () => {
  // Save window state before quitting
  if (mainWindow && !mainWindow.isDestroyed()) {
    saveWindowState(mainWindow);
  }
  // Fire-and-forget — don't block quit
  stopNextServer().catch(() => {});
});

// macOS: re-create window when dock icon clicked
app.on('activate', () => {
  if (mainWindow === null && serverPort > 0) {
    createWindow(serverPort);
  }
});
