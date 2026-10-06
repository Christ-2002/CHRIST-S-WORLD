const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    autoHideMenuBar: true,
    title: "CHRIST'S WORLD",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  // 直接加载本地 index.html，站内相对链接（首页 / 游戏分类 / 各游戏）均可正常跳转
  win.loadFile(path.join(__dirname, 'index.html'));
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
