const { app, BrowserWindow } = require("electron");
const isDev = require("electron-is-dev");
const path = require("path");

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    show: false,
    webPreferences: {
      nodeIntegration: true,
      enableRemoteModule: true,
      nodeIntegrationInWorker: true,
      contextIsolation: false,
      webSecurity: false
    }
  });
  const startURL = isDev
    ? "http://localhost:3000"
    : `file://${path.join(__dirname, "../index.html")}`;

  mainWindow.loadURL(startURL);

  mainWindow.once("ready-to-show", () => mainWindow.show());
  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  mainWindow.webContents.openDevTools();
}

app.on("ready", createWindow);
