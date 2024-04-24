import { app, shell, BrowserWindow, ipcMain, WebContentsView, BaseWindow } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import windowStateKeeper from 'electron-window-state'

const RENDERER_PRELOAD_PATH = join(__dirname, '../preload/index.js')
const MAIN_WINDOW_DEFAULT_WIDTH = 1280
const MAIN_WINDOW_DEFAULT_HEIGHT = 768
const MAIN_WINDOW_MINIMUM_WIDTH = 1024
const MAIN_WINDOW_MINIMUM_HEIGHT = 768

function createWindow(): void {
  const mainWindowState = windowStateKeeper({
    defaultWidth: MAIN_WINDOW_DEFAULT_WIDTH,
    defaultHeight: MAIN_WINDOW_DEFAULT_HEIGHT
  })

  const baseWindow = new BaseWindow({
    backgroundColor: '#FFF',
    x: mainWindowState.x,
    y: mainWindowState.y,
    width: mainWindowState.width,
    height: mainWindowState.height,
    minWidth: MAIN_WINDOW_MINIMUM_WIDTH,
    minHeight: MAIN_WINDOW_MINIMUM_HEIGHT,
    show: true,
    frame: process.platform !== 'win32',
    autoHideMenuBar: true,
    titleBarStyle: 'hidden'
  })

  if (process.platform === 'win32') {
    baseWindow.setTitleBarOverlay({
      height: 38 // height: 38, // 40px - 2px safety boundary to ensure buttons don't overlay app bar
    })
  }

  // outdated library.
  mainWindowState.manage(baseWindow as BrowserWindow)

  const webContentsView = new WebContentsView({
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: true,
      webSecurity: process.env.NODE_ENV === 'production',
      preload: RENDERER_PRELOAD_PATH
    }
  })

  webContentsView.setBounds({
    x: 0,
    y: 0,
    width: mainWindowState.width,
    height: mainWindowState.height
  })
  /**
   * Listener payload: event, newBounds, details.
   * Bug: newBounds always return underfined. We use setBounds instead.
   */
  baseWindow.on('resize', () => {
    const baseWindowBounds = baseWindow.getBounds()
    webContentsView.setBounds({
      x: 0,
      y: 0,
      width: baseWindowBounds.width,
      height: baseWindowBounds.height
    })
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    webContentsView.webContents.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    webContentsView.webContents.loadFile(join(__dirname, '../renderer/index.html'))
  }

  webContentsView.webContents.on('dom-ready', () => {
    webContentsView.setVisible(true)
  })

  webContentsView.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  baseWindow.contentView.addChildView(webContentsView)

  webContentsView.webContents.openDevTools()
}

const initBaseWindow = (): void => {
  if (BaseWindow.getAllWindows().length === 0) {
    createWindow()
  }
  app.show()
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  initBaseWindow()

  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC test
  ipcMain.on('ping', () => console.log('pong'))

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    initBaseWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app"s specific main process
// code. You can also put them in separate files and require them here.
