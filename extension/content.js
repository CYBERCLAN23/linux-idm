// Scans the DOM for video and audio tags
function scanDOM() {
    const media = [];

    // Scan video tags
    document.querySelectorAll('video').forEach(video => {
        if (video.currentSrc) {
            media.push({
                url: video.currentSrc,
                type: 'video/mp4',
                filename: document.title || 'video',
                title: document.title,
                source: 'dom'
            });
        }
    });

    // Send detected media to background
    media.forEach(m => {
        if (m.url && !m.url.startsWith('blob:')) {
            chrome.runtime.sendMessage({
                action: 'addMedia',
                media: m
            });
        }
    });
}

// Listen for messages from background about network-detected media
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'showDetectionNotify') {
        showNotify(request.media);
    }
});

function showNotify(media) {
    // Prevent multiple popups for the same URL
    if (document.getElementById('idm-notify-' + btoa(media.url).substring(0, 16))) return;

    const notify = document.createElement('div');
    const id = 'idm-notify-' + btoa(media.url).substring(0, 16);
    notify.id = id;

    const sizeStr = media.size > 0
        ? (media.size / (1024 * 1024)).toFixed(2) + ' MB'
        : 'Weight: Unknown';

    notify.innerHTML = `
        <div style="position: fixed; bottom: 20px; right: 20px; width: 320px; background: #0f0f23; color: white; border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); border: 1px solid #667eea; z-index: 999999; font-family: 'Inter', sans-serif; overflow: hidden; animation: slideIn 0.5s ease-out;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 12px; display: flex; align-items: center; justify-content: space-between;">
                <span style="font-weight: bold; font-size: 14px;">🎥 Video Detected!</span>
                <button id="close-${id}" style="background: none; border: none; color: white; cursor: pointer; font-size: 18px;">&times;</button>
            </div>
            <div style="padding: 15px;">
                <div style="font-size: 13px; font-weight: 600; margin-bottom: 5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${document.title}">${document.title}</div>
                <div style="font-size: 11px; color: #a0a0b8; margin-bottom: 12px;">
                    <span>${media.type.split(';')[0]}</span> • <span>${sizeStr}</span>
                </div>
                <button id="dl-${id}" style="width: 100%; background: #667eea; color: white; border: none; padding: 10px; border-radius: 6px; font-weight: bold; cursor: pointer; transition: 0.2s;">
                    Download with Linux IDM
                </button>
            </div>
        </div>
        <style>
            @keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        </style>
    `;

    document.body.appendChild(notify);

    document.getElementById('close-' + id).onclick = () => notify.remove();

    const dlBtn = document.getElementById('dl-' + id);
    dlBtn.onclick = async () => {
        dlBtn.textContent = 'Sending...';
        dlBtn.disabled = true;

        try {
            const response = await fetch('http://localhost:3000/api/download', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    url: media.url,
                    filename: (document.title || 'download').replace(/[^a-z0-9]/gi, '_').substring(0, 50) + '.' + (media.type.split('/')[1] || 'mp4').split(';')[0],
                    savePath: '',
                    chunks: 8
                })
            });

            if (response.ok) {
                dlBtn.textContent = 'Ready! 🚀';
                dlBtn.style.background = '#10b981';
                setTimeout(() => notify.remove(), 2000);
            } else {
                throw new Error('Server not running');
            }
        } catch (e) {
            dlBtn.textContent = 'Error: IDM App Offline';
            dlBtn.style.background = '#ef4444';
            setTimeout(() => {
                dlBtn.textContent = 'Download with Linux IDM';
                dlBtn.disabled = false;
                dlBtn.style.background = '#667eea';
            }, 3000);
        }
    };

    // Auto-remove after 15 seconds
    setTimeout(() => { if (document.getElementById(id)) document.getElementById(id).remove(); }, 15000);
}

// Run scan initially and on DOM changes
scanDOM();
const observer = new MutationObserver(scanDOM);
observer.observe(document.body, { childList: true, subtree: true });
