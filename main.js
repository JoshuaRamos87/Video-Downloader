const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { exec } = require('youtube-dl-exec');
const fs = require('fs');

let win;

function createWindow() {
  win = new BrowserWindow({
    width: 1000,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    backgroundColor: '#121212',
  });

  const isDev = process.env.NODE_ENV === 'development';
  if (isDev) {
    win.loadURL('http://localhost:4200');
  } else {
    win.loadFile(path.join(__dirname, 'ui/dist/ui/browser/index.html'));
  }

  win.webContents.openDevTools();
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('select-directory', async () => {
  console.log('MAIN: Received select-directory request');
  const result = await dialog.showOpenDialog(win, {
    properties: ['openDirectory'],
    title: 'Select Download Folder'
  });
  
  if (result.canceled) {
    console.log('MAIN: Dialog canceled');
    return null;
  } else {
    console.log('MAIN: Selected:', result.filePaths[0]);
    return result.filePaths[0];
  }
});

ipcMain.handle('download-video', async (event, { url, outputPath }) => {
  console.log('MAIN: Starting download for:', url);
  try {
    const output = await exec(url, {
      output: path.join(outputPath, '%(title)s.%(ext)s'),
      format: 'best',
    });
    return { success: true, output };
  } catch (error) {
    console.error('MAIN: Download error:', error);
    return { success: false, error: error.message };
  }
});
