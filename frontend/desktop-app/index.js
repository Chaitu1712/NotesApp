require('v8-compile-cache');
const { app, BrowserWindow, ipcMain, Tray, Menu } = require('electron');
const path = require('path');

// Pre-initialize variables
let mainWindow;
let floatingNotes = new Map();
let tray;
let isQuitting = false;

// Optimize app startup
app.commandLine.appendSwitch('disable-http-cache');
app.commandLine.appendSwitch('js-flags', '--max-old-space-size=4096');

// Add production flags
if (process.env.NODE_ENV === 'production') {
  app.commandLine.appendSwitch('disable-gpu-vsync');
  app.commandLine.appendSwitch('disable-gpu-sandbox');
  Menu.setApplicationMenu(null); // Remove menu bar in production
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    autoHideMenuBar: true, // Hide menu bar by default
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      devTools: process.env.NODE_ENV !== 'production' // Disable devTools in production
    }
  });

  mainWindow.loadFile('index.html');

  mainWindow.once('ready-to-show', () => {
    mainWindow.show(); // Show window when content is ready
  });

  // Update close behavior to minimize to tray instead
  mainWindow.on('close', function(event) {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
      return false;
    }
  });
}

function createFloatingNote(event, noteData) {
  const floatingWindow = new BrowserWindow({
    width: 300,
    height: 400,
    frame: false,
    transparent: true,
    show: false,
    alwaysOnTop: true,
    autoHideMenuBar: true, // Hide menu bar by default
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      devTools: process.env.NODE_ENV !== 'production' // Disable devTools in production
    }
  });

  // Ensure the floating window remains always on top
  floatingWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  floatingWindow.setAlwaysOnTop(true, 'screen-saver');

  const windowId = floatingWindow.id;
  floatingNotes.set(windowId, floatingWindow);

  floatingWindow.loadFile('floating-note.html');
  
  floatingWindow.webContents.on('did-finish-load', () => {
    if (noteData) {
      floatingWindow.webContents.send('load-note', noteData);
    }
  });

  floatingWindow.once('ready-to-show', () => {
    floatingWindow.show();
  });

  floatingWindow.on('blur', () => {
    floatingWindow.webContents.send('window-blur');
  });

  floatingWindow.on('focus', () => {
    floatingWindow.webContents.send('window-focus');
  });

  floatingWindow.on('closed', () => {
    floatingNotes.delete(windowId);
  });
}

function createTray() {
  tray = new Tray(path.join(__dirname, 'assets', 'tray-icon.png'));
  
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show Window',
      click: () => {
        if (mainWindow.isVisible()) {
          mainWindow.hide();
        } else {
          mainWindow.show();
        }
      }
    },
    {
      label: 'New Floating Note',
      click: () => {
        createFloatingNote();
      }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        isQuitting = true;
        app.quit();
      }
    }
  ]);

  tray.setToolTip('Notes App');
  tray.setContextMenu(contextMenu);

  // Update tray click to toggle window visibility
  tray.on('click', () => {
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

ipcMain.on('create-floating-note', createFloatingNote);
ipcMain.on('close-floating-note', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) win.close();
});

ipcMain.on('minimize-floating-note', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) win.minimize();
});

ipcMain.on('note-saved', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('note-saved');
  }
});

ipcMain.on('move-to-main', (event, noteData) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.show();
    mainWindow.focus();
    mainWindow.webContents.send('open-note', noteData);
  }
});

// Optimize app lifecycle
app.whenReady().then(() => {
  createMainWindow();
  createTray();
}).catch(console.error);

// Optimize app quit
app.on('before-quit', () => {
  isQuitting = true;
  floatingNotes.clear();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (!mainWindow) {
    createMainWindow();
  } else {
    mainWindow.show();
  }
});