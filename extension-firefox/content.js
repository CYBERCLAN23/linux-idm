// Scans the DOM for video and audio tags
function scanDOM() {
    // Safety check: if extension was updated/reloaded, the context is invalidated.
    if (!chrome.runtime?.id) {
        observer.disconnect();
        return;
    }

    const media = [];

    // 1. YouTube Specific Detection
    if (window.location.hostname.includes('youtube.com') && window.location.pathname === '/watch') {
        media.push({
            url: window.location.href,
            type: 'video/youtube',
            filename: document.title.replace(' - YouTube', ''),
            title: document.title.replace(' - YouTube', ''),
            size: 0,
            source: 'youtube'
        });
    }

    // 2. Generic Video Scans
    document.querySelectorAll('video').forEach(video => {
        if (video.currentSrc && !video.currentSrc.startsWith('blob:')) {
            media.push({
                url: video.currentSrc,
                type: 'video/mp4',
                filename: document.title || 'video',
                title: document.title,
                size: 0,
                source: 'dom'
            });
        }
    });

    // 3. Look for custom data attributes
    document.querySelectorAll('[data-video-src]').forEach(el => {
        const src = el.getAttribute('data-video-src');
        if (src && src.startsWith('http')) {
            media.push({
                url: src,
                type: 'video/stream',
                filename: document.title || 'stream',
                title: document.title,
                size: 0,
                source: 'dom_extra'
            });
        }
    });

    media.forEach(m => {
        try {
            chrome.runtime.sendMessage({ action: 'addMedia', media: m });
        } catch (e) {
            // Context likely invalidated
            if (observer) observer.disconnect();
        }
    });
}

// Global scope initialization
scanDOM();
let lastUrl = location.href;
const observer = new MutationObserver(() => {
    if (location.href !== lastUrl) {
        lastUrl = location.href;
    }
    scanDOM();
});
observer.observe(document.body, { childList: true, subtree: true });

// Listen for messages from background
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'showDetectionNotify') {
        // Only show the HUD in the main window to avoid cluttered iframes
        if (window.top === window) {
            renderDetectionPanel(request.media);
        }
    }
});

let panelElement = null;
let detectedItems = [];

function renderDetectionPanel(newMedia) {
    if (!detectedItems.some(m => m.url === newMedia.url)) {
        detectedItems.push(newMedia);
        detectedItems.sort((a, b) => {
            if (a.source === 'youtube') return -1;
            if (b.source === 'youtube') return 1;
            if (a.url.includes('.m3u8')) return -1;
            if (b.url.includes('.m3u8')) return 1;
            return b.size - a.size;
        });
    }

    if (!panelElement) {
        panelElement = document.createElement('div');
        panelElement.id = 'linux-idm-hud';
        panelElement.style.cssText = `
            position: fixed; bottom: 20px; right: 20px; width: 340px; 
            background: #0f0f23; color: white; border-radius: 14px; 
            box-shadow: 0 12px 40px rgba(0,0,0,0.6); border: 1px solid #667eea; 
            z-index: 9999999; font-family: 'Inter', system-ui, -apple-system, sans-serif; 
            overflow: hidden; animation: idmSlideIn 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        `;
        document.body.appendChild(panelElement);
    }

    panelElement.style.display = 'block';
    updatePanelContent();
}

function updatePanelContent() {
    if (!panelElement || detectedItems.length === 0) return;

    const mainMedia = detectedItems[0];
    const otherCount = detectedItems.length - 1;

    let resolution = 'Original';
    if (mainMedia.source === 'youtube') {
        resolution = 'Highest (ytdl)';
    } else {
        const resMatch = mainMedia.url.match(/(1080|720|480|360)p/i);
        resolution = resMatch ? resMatch[0] : (mainMedia.url.includes('mpegurl') || mainMedia.url.includes('.m3u8') ? 'Auto (HLS)' : 'Original');
    }

    let sizeStr = 'Calculating...';
    if (mainMedia.source === 'youtube') {
        sizeStr = 'YouTube Stream';
    } else if (mainMedia.size > 0) {
        sizeStr = (mainMedia.size / (1024 * 1024)).toFixed(2) + ' MB';
    } else if (mainMedia.url.includes('.m3u8') || mainMedia.url.includes('.mpd')) {
        sizeStr = 'Adaptive Stream';
    }

    panelElement.innerHTML = `
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 14px; display: flex; align-items: center; justify-content: space-between;">
            <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 18px;">🚀</span>
                <span style="font-weight: 700; font-size: 14px; letter-spacing: 0.5px;">LINUX IDM DETECTOR</span>
            </div>
            <button id="idm-close-btn" style="background: rgba(255,255,255,0.2); border: none; color: white; cursor: pointer; font-size: 20px; line-height: 1; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; transition: background 0.2s; z-index: 10000000;">&times;</button>
        </div>
        <div style="padding: 18px;">
            <div style="font-size: 14px; font-weight: 600; margin-bottom: 8px; color: #fff; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;" title="${mainMedia.title}">
                ${mainMedia.title}
            </div>
            
            <div style="display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 20px;">
                <div style="background: #1a1a2e; padding: 4px 10px; border-radius: 6px; border: 1px solid #2d2d42; font-size: 11px;">
                    <span style="color: #a0a0b8; margin-right: 4px;">RES</span><b>${resolution}</b>
                </div>
                <div style="background: #1a1a2e; padding: 4px 10px; border-radius: 6px; border: 1px solid #2d2d42; font-size: 11px;">
                    <span style="color: #a0a0b8; margin-right: 4px;">SOURCE</span><b>${mainMedia.source.toUpperCase()}</b>
                </div>
                ${otherCount > 0 ? `<div style="background: #252538; padding: 4px 10px; border-radius: 6px; border: 1px dashed #667eea; font-size: 11px; color: #667eea;">+${otherCount} more</div>` : ''}
            </div>

            <button id="idm-download-now" style="width: 100%; background: #667eea; color: white; border: none; padding: 12px; border-radius: 8px; font-weight: 700; font-size: 13px; cursor: pointer; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);">
                Download with Linux IDM
            </button>
            <div style="text-align: center; margin-top: 12px;">
                <a href="#" id="idm-show-all" style="color: #a0a0b8; font-size: 11px; text-decoration: none;">View all detected files</a>
            </div>
        </div>
        <style>
            @keyframes idmSlideIn { from { transform: translateY(100px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
            #idm-close-btn:hover { background: rgba(255,255,255,0.4) !important; }
            #idm-download-now:hover { background: #764ba2; transform: translateY(-2px); box-shadow: 0 6px 15px rgba(102, 126, 234, 0.4); }
        </style>
    `;

    const closeBtn = document.getElementById('idm-close-btn');
    if (closeBtn) {
        closeBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            panelElement.style.display = 'none';
        };
    }

    const dlBtn = document.getElementById('idm-download-now');
    if (dlBtn) {
        dlBtn.onclick = async function () {
            this.textContent = '🛰️ Sending to IDM...';
            this.style.background = '#252538';
            this.disabled = true;

            try {
                const response = await fetch('http://localhost:3000/api/download', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        url: mainMedia.url,
                        filename: mainMedia.filename.replace(/[^a-z0-9]/gi, '_').substring(0, 80) + '.mp4',
                        savePath: '',
                        chunks: 8
                    })
                });

                if (response.ok) {
                    this.textContent = 'Success! Opening IDM... ✅';
                    this.style.background = '#10b981';
                    window.open('http://localhost:3000', '_blank');
                    setTimeout(() => { if (panelElement) panelElement.remove(); panelElement = null; }, 2000);
                } else { throw new Error(); }
            } catch (e) {
                this.textContent = '❌ Error: IDM Not Running';
                this.style.background = '#ef4444';
                setTimeout(() => {
                    this.textContent = 'Download with Linux IDM';
                    this.disabled = false;
                    this.style.background = '#667eea';
                }, 3000);
            }
        };
    }

    const showAllBtn = document.getElementById('idm-show-all');
    if (showAllBtn) {
        showAllBtn.onclick = (e) => {
            e.preventDefault();
            alert('Check the Linux IDM extension icon in your toolbar to see all ' + detectedItems.length + ' detected files!');
        };
    }
}
