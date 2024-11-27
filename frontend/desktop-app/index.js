const { app, BrowserWindow, ipcMain, Tray, Menu } = require('electron');
const path = require('path');

let mainWindow;
let floatingNoteWindow;
let tray;

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  mainWindow.loadFile('index.html');

  // Prevent window from being closed directly
  mainWindow.on('close', function(event) {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
    return false;
  });
}

function createFloatingNote(event, noteData) {
  if (floatingNoteWindow) {
    floatingNoteWindow.focus();
    if (noteData) {
      floatingNoteWindow.webContents.send('load-note', noteData);
    }
    return;
  }

  floatingNoteWindow = new BrowserWindow({
    width: 300,
    height: 400,
    frame: false,
    transparent: false,
    alwaysOnTop: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  floatingNoteWindow.loadFile('floating-note.html');
  
  floatingNoteWindow.webContents.on('did-finish-load', () => {
    if (noteData) {
      floatingNoteWindow.webContents.send('load-note', noteData);
    }
  });

  floatingNoteWindow.on('closed', () => {
    floatingNoteWindow = null;
  });
}

function createTray() {
  tray = new Tray(path.join(__dirname, 'assets', 'tray-icon.png'));
  
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show App',
      click: () => {
        mainWindow.show();
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

  tray.on('click', () => {
    mainWindow.show();
  });
}

ipcMain.on('create-floating-note', createFloatingNote);
ipcMain.on('close-floating-note', () => {
  if (floatingNoteWindow) floatingNoteWindow.close();
});
ipcMain.on('minimize-floating-note', () => {
  if (floatingNoteWindow) floatingNoteWindow.minimize();
});

ipcMain.on('note-saved', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('note-saved');
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