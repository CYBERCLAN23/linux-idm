const { app, BrowserWindow, ipcMain, Tray, Menu, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const Store = require('electron-store');
const ytdl = require('ytdl-core');

const store = new Store();
let mainWindow;
let tray;

// Initialize downloads storage
if (!store.get('downloads')) {
    store.set('downloads', []);
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 900,
        minHeight: 600,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            enableRemoteModule: true
        },
        frame: true,
        icon: path.join(__dirname, '../assets/icon.png'),
        backgroundColor: '#0f0f23',
        show: false
    });

    mainWindow.loadFile(path.join(__dirname, 'renderer/index.html'));

    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });

    mainWindow.on('close', (event) => {
        if (!app.isQuitting) {
            event.preventDefault();
            mainWindow.hide();
        }
        return false;
    });
}

function createTray() {
    tray = new Tray(path.join(__dirname, '../assets/tray-icon.png'));
    const contextMenu = Menu.buildFromTemplate([
        {
            label: 'Show App',
            click: () => {
                mainWindow.show();
            }
        },
        {
            label: 'New Download',
            click: () => {
                mainWindow.show();
                mainWindow.webContents.send('show-add-download');
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

    tray.setToolTip('Linux IDM');
    tray.setContextMenu(contextMenu);

    tray.on('click', () => {
        mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
    });
}

app.whenReady().then(() => {
    createWindow();
    createTray();

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

// IPC Handlers
ipcMain.handle('select-download-path', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory']
    });
    return result.filePaths[0];
});

ipcMain.handle('get-downloads', () => {
    return store.get('downloads', []);
});

ipcMain.handle('add-download', async (event, downloadInfo) => {
    const { url, filename, savePath, chunks = 4 } = downloadInfo;

    const download = {
        id: Date.now().toString(),
        url,
        filename,
        savePath,
        progress: 0,
        speed: 0,
        status: 'downloading',
        totalSize: 0,
        downloadedSize: 0,
        chunks,
        createdAt: new Date().toISOString()
    };

    const downloads = store.get('downloads', []);
    downloads.unshift(download);
    store.set('downloads', downloads);

    // Start download
    startDownload(download);

    return download;
});

ipcMain.handle('pause-download', (event, downloadId) => {
    const downloads = store.get('downloads', []);
    const download = downloads.find(d => d.id === downloadId);

    if (download) {
        download.status = 'paused';
        store.set('downloads', downloads);
    }

    return download;
});

ipcMain.handle('resume-download', (event, downloadId) => {
    const downloads = store.get('downloads', []);
    const download = downloads.find(d => d.id === downloadId);

    if (download) {
        download.status = 'downloading';
        store.set('downloads', downloads);
        startDownload(download);
    }

    return download;
});

ipcMain.handle('cancel-download', (event, downloadId) => {
    const downloads = store.get('downloads', []);
    const index = downloads.findIndex(d => d.id === downloadId);

    if (index !== -1) {
        downloads.splice(index, 1);
        store.set('downloads', downloads);
    }

    return true;
});

ipcMain.handle('delete-download', (event, downloadId) => {
    const downloads = store.get('downloads', []);
    const index = downloads.findIndex(d => d.id === downloadId);

    if (index !== -1) {
        const download = downloads[index];
        const filePath = path.join(download.savePath, download.filename);

        // Delete file if exists
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        downloads.splice(index, 1);
        store.set('downloads', downloads);
    }

    return true;
});

ipcMain.handle('check-youtube-url', async (event, url) => {
    try {
        if (ytdl.validateURL(url)) {
            const info = await ytdl.getInfo(url);
            return {
                valid: true,
                title: info.videoDetails.title,
                formats: info.formats.filter(f => f.hasVideo && f.hasAudio)
                    .map(f => ({
                        quality: f.qualityLabel,
                        container: f.container,
                        size: f.contentLength
                    }))
            };
        }
        return { valid: false };
    } catch (error) {
        return { valid: false, error: error.message };
    }
});

async function startDownload(download) {
    try {
        const response = await axios({
            method: 'GET',
            url: download.url,
            responseType: 'stream',
            onDownloadProgress: (progressEvent) => {
                const downloads = store.get('downloads', []);
                const currentDownload = downloads.find(d => d.id === download.id);

                if (currentDownload && currentDownload.status === 'downloading') {
                    currentDownload.downloadedSize = progressEvent.loaded;
                    currentDownload.totalSize = progressEvent.total || progressEvent.loaded;
                    currentDownload.progress = progressEvent.total
                        ? Math.round((progressEvent.loaded / progressEvent.total) * 100)
                        : 0;

                    store.set('downloads', downloads);
                    mainWindow.webContents.send('download-progress', currentDownload);
                }
            }
        });

        const filePath = path.join(download.savePath, download.filename);
        const writer = fs.createWriteStream(filePath);

        response.data.pipe(writer);

        writer.on('finish', () => {
            const downloads = store.get('downloads', []);
            const currentDownload = downloads.find(d => d.id === download.id);

            if (currentDownload) {
                currentDownload.status = 'completed';
                currentDownload.progress = 100;
                store.set('downloads', downloads);
                mainWindow.webContents.send('download-complete', currentDownload);
            }
        });

        writer.on('error', (error) => {
            const downloads = store.get('downloads', []);
            const currentDownload = downloads.find(d => d.id === download.id);

            if (currentDownload) {
                currentDownload.status = 'error';
                currentDownload.error = error.message;
                store.set('downloads', downloads);
                mainWindow.webContents.send('download-error', currentDownload);
            }
        });

    } catch (error) {
        const downloads = store.get('downloads', []);
        const currentDownload = downloads.find(d => d.id === download.id);

        if (currentDownload) {
            currentDownload.status = 'error';
            currentDownload.error = error.message;
            store.set('downloads', downloads);
            mainWindow.webContents.send('download-error', currentDownload);
        }
    }
}
