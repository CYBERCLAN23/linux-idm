// Scans the DOM for video and audio tags
function scanDOM() {
    const media = [];
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

    media.forEach(m => {
        chrome.runtime.sendMessage({ action: 'addMedia', media: m });
    });
}

// Listen for messages from background
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'showDetectionNotify') {
        renderDetectionPanel(request.media);
    }
});

let panelElement = null;
let detectedItems = [];

function renderDetectionPanel(newMedia) {
    // Add to our local list and filter duplicates
    if (!detectedItems.some(m => m.url === newMedia.url)) {
        detectedItems.push(newMedia);
        // Sort: HLS/Playlists first, then by size (descending)
        detectedItems.sort((a, b) => {
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

    updatePanelContent();
}

function updatePanelContent() {
    const mainMedia = detectedItems[0]; // The "best" guess is at the top
    const otherCount = detectedItems.length - 1;

    // Attempt to detect resolution from URL or filename
    const resMatch = mainMedia.url.match(/(1080|720|480|360)p/i);
    const resolution = resMatch ? resMatch[0] : (mainMedia.url.includes('master.m3u8') ? 'Auto (HLS)' : 'Original');

    const sizeStr = mainMedia.size > 0
        ? (mainMedia.size / (1024 * 1024)).toFixed(2) + ' MB'
        : (mainMedia.url.includes('.m3u8') ? 'Adaptive Stream' : 'Calculating...');

    panelElement.innerHTML = `
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 14px; display: flex; align-items: center; justify-content: space-between;">
            <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 18px;">🚀</span>
                <span style="font-weight: 700; font-size: 14px; letter-spacing: 0.5px;">LINUX IDM DETECTOR</span>
            </div>
            <button id="idm-close" style="background: none; border: none; color: white; cursor: pointer; font-size: 22px; line-height: 1;">&times;</button>
        </div>
        <div style="padding: 18px;">
            <div style="font-size: 14px; font-weight: 600; margin-bottom: 8px; color: #fff; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;" title="${document.title}">
                ${document.title}
            </div>
            
            <div style="display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 20px;">
                <div style="background: #1a1a2e; padding: 4px 10px; border-radius: 6px; border: 1px solid #2d2d42; font-size: 11px;">
                    <span style="color: #a0a0b8; margin-right: 4px;">RES</span><b>${resolution}</b>
                </div>
                <div style="background: #1a1a2e; padding: 4px 10px; border-radius: 6px; border: 1px solid #2d2d42; font-size: 11px;">
                    <span style="color: #a0a0b8; margin-right: 4px;">SIZE</span><b>${sizeStr}</b>
                </div>
                ${otherCount > 0 ? `<div style="background: #252538; padding: 4px 10px; border-radius: 6px; border: 1px dashed #667eea; font-size: 11px; color: #667eea;">+${otherCount} more streams</div>` : ''}
            </div>

            <button id="idm-download-now" style="width: 100%; background: #667eea; color: white; border: none; padding: 12px; border-radius: 8px; font-weight: 700; font-size: 13px; cursor: pointer; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);">
                Download Main Video
            </button>
            <div style="text-align: center; margin-top: 12px;">
                <a href="#" id="idm-show-all" style="color: #a0a0b8; font-size: 11px; text-decoration: none; hover: color: #fff;">View all detected files</a>
            </div>
        </div>
        <style>
            @keyframes idmSlideIn { from { transform: translateY(100px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
            #idm-download-now:hover { background: #764ba2; transform: translateY(-2px); box-shadow: 0 6px 15px rgba(102, 126, 234, 0.4); }
            #idm-download-now:active { transform: translateY(0); }
        </style>
    `;

    document.getElementById('idm-close').onclick = () => {
        panelElement.style.display = 'none';
    };

    document.getElementById('idm-download-now').onclick = async function () {
        this.textContent = '🛰️ Sending to IDM...';
        this.style.background = '#252538';
        this.disabled = true;

        try {
            const response = await fetch('http://localhost:3000/api/download', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    url: mainMedia.url,
                    filename: (document.title || 'download').replace(/[^a-z0-9]/gi, '_').substring(0, 80) + '.' + (mainMedia.type.split('/')[1] || 'mp4').split(';')[0],
                    savePath: '',
                    chunks: 8
                })
            });

            if (response.ok) {
                this.textContent = 'Success! Check IDM App ✅';
                this.style.background = '#10b981';
                setTimeout(() => { if (panelElement) panelElement.remove(); panelElement = null; }, 3000);
            } else { throw new Error(); }
        } catch (e) {
            this.textContent = '❌ Error: IDM Not Running';
            this.style.background = '#ef4444';
            setTimeout(() => {
                this.textContent = 'Download Main Video';
                this.disabled = false;
                this.style.background = '#667eea';
            }, 3000);
        }
    };

    document.getElementById('idm-show-all').onclick = (e) => {
        e.preventDefault();
        // Since we don't have a complex internal UI for "View All" in content script yet, 
        // we just alert or tell them to click the extension icon.
        alert('Check the Linux IDM extension icon in your browser toolbar to see all ' + detectedItems.length + ' detected files!');
    };
}

// Global scope initialization
scanDOM();
const observer = new MutationObserver(scanDOM);
observer.observe(document.body, { childList: true, subtree: true });
