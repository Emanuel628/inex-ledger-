const electron = require("electron");
console.log("electron module keys", Object.keys(electron));
console.log("electron.app", electron.app, "BrowserWindow", electron.BrowserWindow);
console.log("process.argv[0]", process.argv[0]);
console.log("process.versions", process.versions);
const { app, BrowserWindow } = electron;
const path = require("path");

const createWindow = () => {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    autoHideMenuBar: true,
    title: "Financial Snapshot",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  });

  const indexPath = path.join(__dirname, "../dist/index.html");
  win.loadFile(indexPath);
};

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
