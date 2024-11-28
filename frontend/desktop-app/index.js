require('v8-compile-cache');  // Add this as the first line
const { app, BrowserWindow, ipcMain, Tray, Menu } = require('electron');
const path = require('path');

let mainWindow;
let floatingNotes = new Map(); // Replace floatingNoteWindow with a Map
let tray;

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false, // Hide window until ready
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadFile('index.html');

  mainWindow.once('ready-to-show', () => {
    mainWindow.show(); // Show window when content is ready
  });

  // Update close behavior to minimize to tray instead
  mainWindow.on('close', function(event) {
    if (!app.isQuitting) {
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
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      preload: path.join(__dirname, 'preload.js'),
      devTools: !app.isPackaged
    }
  });

  const windowId = floatingWindow.id;
  floatingNotes.set(windowId, floatingWindow);

  floatingWindow.once('ready-to-show', () => {
    floatingWindow.show();
  });

  floatingWindow.loadFile('floating-note.html');
  
  floatingWindow.on('blur', () => {
    floatingWindow.webContents.send('window-blur');
  });

  floatingWindow.on('focus', () => {
    floatingWindow.webContents.send('window-focus');
  });

  floatingWindow.webContents.on('did-finish-load', () => {
    if (noteData) {
      floatingWindow.webContents.send('load-note', noteData);
    }
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
        app.isQuitting = true;
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

app.whenReady().then(() => {
  createMainWindow();
  createTray();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow();
  }
  mainWindow.show();
});

// Update quit handling
app.on('before-quit', () => {
  app.isQuitting = true;
});