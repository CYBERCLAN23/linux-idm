// Stores detected media: { tabId: [ { url, type, size, filename } ] }
let detectedMedia = {};

// Clean up old keywords to avoid downloading ads
const AD_KEYWORDS = ['/ad/', '/ads/', 'pre-roll', 'mid-roll', 'ads.', 'ads-analytics', 'doubleclick', 'amazon-adsystem', 'googlesyndication'];

// Listen for network requests to detect media files
chrome.webRequest.onHeadersReceived.addListener(
    (details) => {
        if (details.type === 'media' || details.type === 'xmlhttprequest') {
            const headers = details.responseHeaders;
            const contentTypeHeader = headers.find(h => h.name.toLowerCase() === 'content-type');
            const contentLengthHeader = headers.find(h => h.name.toLowerCase() === 'content-length');

            if (contentTypeHeader) {
                const type = contentTypeHeader.value.toLowerCase();
                const size = contentLengthHeader ? parseInt(contentLengthHeader.value) : 0;
                const url = details.url.toLowerCase();

                // 1. Detect Media Types
                const isVideo = type.startsWith('video/');
                const isAudio = type.startsWith('audio/');
                const isHLS = type.includes('mpegurl') || url.includes('.m3u8');

                if (isVideo || isAudio || isHLS) {
                    const tabId = details.tabId;

                    // 2. Intelligent Filtering
                    // Skip tiny files that are likely buffers or icons
                    if (size > 0 && size < 100000 && !isHLS) return;

                    // Skip obvious ad URLs
                    if (AD_KEYWORDS.some(keyword => url.includes(keyword))) {
                        console.log('Filtered ad:', url);
                        return;
                    }

                    if (!detectedMedia[tabId]) detectedMedia[tabId] = [];

                    if (!detectedMedia[tabId].some(m => m.url === details.url)) {
                        let filename = 'media_file';
                        try {
                            const urlObj = new URL(details.url);
                            const pathPart = urlObj.pathname.split('/').pop();
                            if (pathPart && pathPart.includes('.')) {
                                filename = pathPart;
                            } else {
                                filename = `media_${Date.now()}.${type.split('/')[1].split(';')[0] || 'mp4'}`;
                            }
                        } catch (e) { }

                        const mediaItem = {
                            url: details.url,
                            type: type,
                            size: size,
                            filename: filename,
                            source: 'network',
                            timestamp: Date.now()
                        };

                        detectedMedia[tabId].push(mediaItem);

                        // 3. Selective Notification
                        // Only trigger automatic pop-up for files > 3MB OR HLS playlists
                        // This prevents ad-clips from constantly popping up
                        if (size > 3 * 1024 * 1024 || isHLS || isVideo) {
                            chrome.tabs.sendMessage(tabId, {
                                action: 'showDetectionNotify',
                                media: mediaItem
                            }).catch(() => { });
                        }

                        chrome.action.setBadgeText({ text: detectedMedia[tabId].length.toString(), tabId: tabId });
                        chrome.action.setBadgeBackgroundColor({ color: '#667eea', tabId: tabId });
                    }
                }
            }
        }
    },
    { urls: ["<all_urls>"] },
    ["responseHeaders"]
);

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getMedia') {
        const tabId = request.tabId;
        // Sort by size (descending) so the largest (main video) is first
        const sortedMedia = (detectedMedia[tabId] || []).sort((a, b) => b.size - a.size);
        sendResponse({ media: sortedMedia });
    } else if (request.action === 'addMedia') {
        const tabId = sender.tab.id;
        if (!detectedMedia[tabId]) detectedMedia[tabId] = [];

        const mediaItem = request.media;
        if (!detectedMedia[tabId].some(m => m.url === mediaItem.url)) {
            detectedMedia[tabId].push(mediaItem);

            // For DOM detection, we notify if it looks significant
            chrome.tabs.sendMessage(tabId, {
                action: 'showDetectionNotify',
                media: mediaItem
            }).catch(() => { });

            chrome.action.setBadgeText({ text: detectedMedia[tabId].length.toString(), tabId: tabId });
            chrome.action.setBadgeBackgroundColor({ color: '#667eea', tabId: tabId });
        }
    } else if (request.action === 'clearMedia') {
        const tabId = request.tabId;
        if (detectedMedia[tabId]) {
            detectedMedia[tabId] = [];
            chrome.action.setBadgeText({ text: '', tabId: tabId });
        }
        sendResponse({ success: true });
    }
});

chrome.tabs.onRemoved.addListener((tabId) => {
    if (detectedMedia[tabId]) delete detectedMedia[tabId];
});
