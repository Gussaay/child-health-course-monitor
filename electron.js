const { app, BrowserWindow } = require('electron');
const path = require('node:path');
const { autoUpdater } = require('electron-updater'); // Import electron-updater

// Use an async import for electron-is-dev
const loadIsDev = async () => {
  const { default: isDev } = await import('electron-is-dev');
  return isDev;
};

function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js')
    }
  });

  loadIsDev().then(isDev => {
    if (isDev) {
      // In development, load from the Vite dev server
      win.loadURL('http://localhost:5173');
      win.webContents.openDevTools(); // Open DevTools in dev mode
    } else {
      // In production, load the built index.html file
      // THIS IS THE CRUCIAL CHANGE FOR THE BUILT APP
      win.loadFile(path.join(__dirname, 'dist', 'index.html'));
    }
  });
}

app.whenReady().then(() => {
  createWindow();

  // --- NEW: Check for Electron app updates ---
  // We check for updates *after* the window is created.
  // This will check, download, and notify the user when an update is ready.
  autoUpdater.checkForUpdatesAndNotify();
  // --- End new code ---

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// --- NEW: Optional logging for the updater ---
autoUpdater.on('update-available', () => {
  console.log('Update available.');
});

autoUpdater.on('update-downloaded', () => {
  console.log('Update downloaded; will install on quit.');
});

autoUpdater.on('error', (err) => {
  console.error('Error in auto-updater:', err);
});