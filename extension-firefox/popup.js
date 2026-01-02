document.addEventListener('DOMContentLoaded', async () => {
    const list = document.getElementById('media-list');
    const serverDot = document.getElementById('server-dot');
    const serverText = document.getElementById('server-text');
    const clearBtn = document.getElementById('clear-btn');

    let isConnected = false;
    const IDM_API_URL = 'http://127.0.0.1:3000/api/download';

    // Check IDM Connection via background
    async function checkConnection() {
        chrome.runtime.sendMessage({ action: 'pingIDM' }, (response) => {
            isConnected = response && response.connected;
            if (isConnected) {
                serverDot.classList.add('connected');
                serverText.textContent = 'IDM Connected';
            } else {
                serverDot.classList.remove('connected');
                serverText.textContent = 'IDM Disconnected (Check Console)';
            }
        });
    }
    checkConnection();
    setInterval(checkConnection, 3000);

    // Get current tab ID
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    // Fetch detected media from background
    chrome.runtime.sendMessage({ action: 'getMedia', tabId: tab.id }, (response) => {
        const media = response ? (response.media || []) : [];
        renderMedia(media);
    });

    clearBtn.addEventListener('click', () => {
        chrome.runtime.sendMessage({ action: 'clearMedia', tabId: tab.id }, () => {
            renderMedia([]);
        });
    });

    function renderMedia(mediaItems) {
        list.innerHTML = '';

        if (mediaItems.length === 0) {
            list.innerHTML = `
                <div class="empty-state">
                    <h3>No Media Detected</h3>
                    <p>Play a video or audio to detect streams.</p>
                </div>
            `;
            return;
        }

        mediaItems.forEach((item, index) => {
            const sizeStr = item.size > 0
                ? (item.size / (1024 * 1024)).toFixed(2) + ' MB'
                : 'Size Unknown';

            const el = document.createElement('div');
            el.className = 'media-item';
            el.innerHTML = `
                <div class="media-info">
                    <div class="media-icon">
                        ${getIcon(item.type)}
                    </div>
                    <div class="media-details">
                        <div class="media-name" title="${item.url}">${item.filename}</div>
                        <div class="media-meta">
                            <span>${item.type.split(';')[0]}</span>
                            <span>•</span>
                            <span>${sizeStr}</span>
                        </div>
                    </div>
                </div>
                <button class="download-btn" data-index="${index}">
                    Download with IDM
                </button>
            `;

            const btn = el.querySelector('.download-btn');
            btn.addEventListener('click', () => startDownload(item, btn));

            list.appendChild(el);
        });
    }

    async function startDownload(item, btn) {
        if (!isConnected) {
            alert('Linux IDM is not running! Please start the app first (./start.sh)');
            return;
        }

        const originalText = btn.textContent;
        btn.textContent = '📡 Sending...';
        btn.disabled = true;

        chrome.runtime.sendMessage({
            action: 'startDownload',
            data: {
                url: item.url,
                filename: item.filename,
                savePath: '',
                chunks: 8
            }
        }, (response) => {
            if (response && response.success) {
                btn.textContent = 'Sent Correctly! 🚀';
                btn.style.background = '#10b981';
                setTimeout(() => {
                    btn.textContent = originalText;
                    btn.style.background = '';
                    btn.disabled = false;
                }, 2000);
            } else {
                btn.textContent = 'Error! ❌';
                btn.style.background = '#ef4444';
                setTimeout(() => {
                    btn.textContent = originalText;
                    btn.style.background = '';
                    btn.disabled = false;
                }, 2000);
            }
        });
    }

    function getIcon(type) {
        // Simple SVG icons
        if (type.includes('audio')) {
            return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>`;
        } else {
            return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="2" y1="7" x2="7" y2="7"/><line x1="2" y1="17" x2="7" y2="17"/><line x1="17" y1="17" x2="22" y2="17"/><line x1="17" y1="7" x2="22" y2="7"/></svg>`;
        }
    }
});
