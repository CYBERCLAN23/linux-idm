const express = require('express');
const axios = require('axios');
const ytdl = require('@distube/ytdl-core');
const fs = require('fs');
const path = require('path');
const http = require('http');
const WebSocket = require('ws');
const os = require('os');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = 3000;
const downloads = new Map();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'src/renderer')));

// Request Logger
app.use((req, res, next) => {
    console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`);
    next();
});

// WebSocket for real-time updates
wss.on('connection', (ws) => {
    console.log('Client connected');

    ws.on('message', (message) => {
        console.log('Received:', message);
    });

    ws.on('close', () => {
        console.log('Client disconnected');
    });
});

// Broadcast to all connected clients
function broadcast(data) {
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(data));
        }
    });
}

// Routes
app.get('/api/downloads', (req, res) => {
    const downloadList = Array.from(downloads.values());
    res.json(downloadList);
});

app.post('/api/download', async (req, res) => {
    const { url, filename, savePath, chunks = 4 } = req.body;

    const downloadId = Date.now().toString();
    const download = {
        id: downloadId,
        url,
        filename,
        savePath: savePath || path.join(os.homedir(), 'Downloads'),
        progress: 0,
        speed: 0,
        status: 'downloading',
        totalSize: 0,
        downloadedSize: 0,
        chunks,
        createdAt: new Date().toISOString()
    };

    downloads.set(downloadId, download);

    // Start download
    startDownload(download);

    res.json(download);
});

app.post('/api/download/:id/pause', (req, res) => {
    const download = downloads.get(req.params.id);
    if (download) {
        download.status = 'paused';
        download.cancelToken?.cancel('Download paused by user');
        broadcast({ type: 'download-update', download });
        res.json(download);
    } else {
        res.status(404).json({ error: 'Download not found' });
    }
});

app.post('/api/download/:id/resume', (req, res) => {
    const download = downloads.get(req.params.id);
    if (download) {
        download.status = 'downloading';
        startDownload(download);
        broadcast({ type: 'download-update', download });
        res.json(download);
    } else {
        res.status(404).json({ error: 'Download not found' });
    }
});

app.delete('/api/download/:id', (req, res) => {
    const download = downloads.get(req.params.id);
    if (download) {
        download.cancelToken?.cancel('Download cancelled by user');
        const filePath = path.join(download.savePath, download.filename);

        if (fs.existsSync(filePath)) {
            try {
                fs.unlinkSync(filePath);
            } catch (err) {
                console.error('Error deleting file:', err);
            }
        }

        downloads.delete(req.params.id);
        broadcast({ type: 'download-deleted', id: req.params.id });
        res.json({ success: true });
    } else {
        res.status(404).json({ error: 'Download not found' });
    }
});

// Download function
async function startDownload(download) {
    const isYouTube = ytdl.validateURL(download.url);

    if (isYouTube) {
        return handleYouTubeDownload(download);
    }

    try {
        const cancelTokenSource = axios.CancelToken.source();
        download.cancelToken = cancelTokenSource;

        const startTime = Date.now();
        let lastLoaded = 0;
        let lastTime = startTime;

        const response = await axios({
            method: 'GET',
            url: download.url,
            responseType: 'stream',
            cancelToken: cancelTokenSource.token,
            onDownloadProgress: (progressEvent) => {
                const currentDownload = downloads.get(download.id);

                if (currentDownload && currentDownload.status === 'downloading') {
                    const currentTime = Date.now();
                    const timeDiff = (currentTime - lastTime) / 1000; // seconds
                    const loadedDiff = progressEvent.loaded - lastLoaded;

                    // Calculate speed in KB/s
                    const speed = timeDiff > 0 ? (loadedDiff / 1024) / timeDiff : 0;

                    currentDownload.downloadedSize = progressEvent.loaded;
                    currentDownload.totalSize = progressEvent.total || progressEvent.loaded;
                    currentDownload.progress = progressEvent.total
                        ? Math.round((progressEvent.loaded / progressEvent.total) * 100)
                        : 0;
                    currentDownload.speed = Math.round(speed);

                    lastLoaded = progressEvent.loaded;
                    lastTime = currentTime;

                    // Broadcast progress
                    broadcast({ type: 'download-progress', download: currentDownload });
                }
            }
        });

        // Ensure directory exists
        const downloadDir = download.savePath;
        if (!fs.existsSync(downloadDir)) {
            fs.mkdirSync(downloadDir, { recursive: true });
        }

        const filePath = path.join(downloadDir, download.filename);
        const writer = fs.createWriteStream(filePath);

        response.data.pipe(writer);

        writer.on('finish', () => {
            const currentDownload = downloads.get(download.id);
            if (currentDownload) {
                currentDownload.status = 'completed';
                currentDownload.progress = 100;
                currentDownload.speed = 0;
                broadcast({ type: 'download-complete', download: currentDownload });
            }
        });

        writer.on('error', (error) => {
            const currentDownload = downloads.get(download.id);
            if (currentDownload) {
                currentDownload.status = 'error';
                currentDownload.error = error.message;
                currentDownload.speed = 0;
                broadcast({ type: 'download-error', download: currentDownload });
            }
        });

    } catch (error) {
        if (!axios.isCancel(error)) {
            const currentDownload = downloads.get(download.id);
            if (currentDownload) {
                currentDownload.status = 'error';
                currentDownload.error = error.message;
                currentDownload.speed = 0;
                broadcast({ type: 'download-error', download: currentDownload });
            }
        }
    }
}

const { spawn } = require('child_process');

async function handleYouTubeDownload(download) {
    try {
        // 1. Get info first to get the title asynchronously
        let titleData = 'youtube_video';
        try {
            titleData = await new Promise((resolve, reject) => {
                const titleProcess = spawn('yt-dlp', [
                    '--get-title',
                    '--no-check-certificate',
                    '--extractor-args', 'youtube:player-client=web,ios',
                    download.url
                ]);
                let result = '';
                const timeout = setTimeout(() => {
                    titleProcess.kill();
                    resolve('youtube_video');
                }, 15000); // 15s timeout

                titleProcess.stdout.on('data', (data) => { result += data.toString(); });
                titleProcess.on('close', (code) => {
                    clearTimeout(timeout);
                    if (code === 0 && result.trim()) resolve(result.trim());
                    else resolve('youtube_video');
                });
            });
        } catch (e) {
            console.warn('Title fetch failed, using fallback.');
        }
        download.filename = `${titleData.replace(/[^a-z0-9]/gi, '_')}.mp4`;
        console.log(`📂 Prepared filename: ${download.filename}`);

        const downloadDir = download.savePath;
        if (!fs.existsSync(downloadDir)) fs.mkdirSync(downloadDir, { recursive: true });
        const filePath = path.join(downloadDir, download.filename);

        // 2. Start the process with Turbo Mode (Aria2c + Multithreading)
        // Added extractor-args to fix Signature Extraction failures
        const process = spawn('yt-dlp', [
            '-f', 'bv*[ext=mp4]+ba[ext=m4a]/b[ext=mp4] / bv*+ba/b',
            '--newline',
            '--no-playlist',
            '--no-check-certificate',
            '--extractor-args', 'youtube:player-client=web,ios',
            '--user-agent', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
            '--external-downloader', 'aria2c',
            '--external-downloader-args', 'aria2c:-x 8 -s 8 -k 1M --file-allocation=none',
            '--buffer-size', '1M',
            '--concurrent-fragments', '4',
            '--progress-template', 'IDM:%(progress._percent_str)s|%(progress._speed_str)s|%(progress._total_bytes_estimate_str)s',
            '-o', filePath,
            download.url
        ]);

        let lastProgressLog = -1;

        process.stdout.on('data', (data) => {
            const line = data.toString();
            if (line.includes('IDM:')) {
                const parts = line.split('IDM:')[1].split('|');
                const percentStr = parts[0].replace('%', '').trim();
                const percent = parseFloat(percentStr);
                const speedStr = parts[1];
                const totalSizeStr = parts[2];

                download.progress = Math.round(percent);
                download.status = 'downloading';

                if (speedStr.includes('k')) download.speed = parseFloat(speedStr);
                else if (speedStr.includes('M')) download.speed = parseFloat(speedStr) * 1024;

                broadcast({ type: 'download-progress', download });

                // Log every 10%
                if (Math.floor(percent / 10) > lastProgressLog) {
                    lastProgressLog = Math.floor(percent / 10);
                    console.log(`⏳ Download progress [${download.id}]: ${download.progress}% @ ${speedStr}`);
                }
            }
        });

        process.stderr.on('data', (data) => {
            const msg = data.toString();
            if (msg.includes('ERROR')) {
                console.error(`❌ YT-DLP ERROR [${download.id}]:`, msg.trim());
            } else {
                // Warnings/Progress logs
                if (!msg.includes('%')) console.log(`⚠️ YT-DLP Info [${download.id}]:`, msg.trim());
            }
        });

        process.on('close', (code) => {
            if (code === 0) {
                console.log(`✅ Download completed successfully [${download.id}]: ${download.filename}`);
                download.status = 'completed';
                download.progress = 100;
                download.speed = 0;
                broadcast({ type: 'download-complete', download });
            } else {
                console.error(`❌ YT-DLP process exited with code ${code} [${download.id}]`);
                download.status = 'error';
                download.error = `yt-dlp exited with code ${code}. YouTube might be blocking the request.`;
                broadcast({ type: 'download-error', download });
            }
        });

    } catch (err) {
        console.error('YouTube/YT-DLP Error:', err);
        download.status = 'error';
        download.error = `Download failed: ${err.message}`;
        broadcast({ type: 'download-error', download });
    }
}

// Start server
server.listen(PORT, () => {
    console.log('\n🚀 Linux IDM Web Server Started!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`\n✅ Server running at: http://localhost:${PORT}`);
    console.log(`\n📂 Default download location: ${path.join(os.homedir(), 'Downloads')}`);
    console.log('\n💡 Open your browser and navigate to the URL above');
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Try to open browser automatically (skip if running in background)
    const isBackground = process.argv.includes('--background');
    if (!isBackground) {
        const open = require('child_process').exec;
        const url = `http://localhost:${PORT}`;

        const start = process.platform === 'darwin' ? 'open' :
            process.platform === 'win32' ? 'start' : 'xdg-open';

        setTimeout(() => {
            open(`${start} ${url}`, (error) => {
                if (error) {
                    console.log('💡 Please manually open: http://localhost:3000');
                }
            });
        }, 1000);
    }
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n\n👋 Shutting down Linux IDM...');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});
