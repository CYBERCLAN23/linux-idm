// Stores detected media: { tabId: [ { url, type, size, filename } ] }
let detectedMedia = {};

// Listen for network requests to detect media files
chrome.webRequest.onHeadersReceived.addListener(
    (details) => {
        // We only care about main_frame, sub_frame, or other resource types that triggered a download or display
        if (details.type === 'media' || details.type === 'xmlhttprequest') {
            const headers = details.responseHeaders;
            const contentTypeHeader = headers.find(h => h.name.toLowerCase() === 'content-type');
            const contentLengthHeader = headers.find(h => h.name.toLowerCase() === 'content-length');

            if (contentTypeHeader) {
                const type = contentTypeHeader.value;
                const size = contentLengthHeader ? parseInt(contentLengthHeader.value) : 0;

                // Check if it's video or audio
                if (type.startsWith('video/') || type.startsWith('audio/') || type === 'application/x-mpegurl' || type === 'application/vnd.apple.mpegurl') {

                    const tabId = details.tabId;
                    const url = details.url;

                    // Filter out tiny files (likely icons or buffer segments)
                    if (size > 0 && size < 50000 && !url.includes('.m3u8')) return;

                    // Initialize array for tab if not exists
                    if (!detectedMedia[tabId]) {
                        detectedMedia[tabId] = [];
                    }

                    // Avoid duplicates
                    if (!detectedMedia[tabId].some(m => m.url === url)) {
                        // Try to guess filename
                        let filename = 'media_file';
                        try {
                            const urlObj = new URL(url);
                            const pathPart = urlObj.pathname.split('/').pop();
                            if (pathPart && pathPart.includes('.')) {
                                filename = pathPart;
                            } else {
                                filename = `media_${Date.now()}.${type.split('/')[1].split(';')[0]}`;
                            }
                        } catch (e) { }

                        detectedMedia[tabId].push({
                            url: url,
                            type: type,
                            size: size,
                            filename: filename,
                            source: 'network' // Detected via network sniffing
                        });

                        // Update badge text
                        chrome.action.setBadgeText({ text: detectedMedia[tabId].length.toString(), tabId: tabId });
                        chrome.action.setBadgeBackgroundColor({ color: '#667eea', tabId: tabId });
                    }
                }
            }
        }
    },
    { urls: ["<all_urls>"] },
    ["responseHeaders"] // V3 doesn't support blocking in this listener easily, but we just need sniffing
);

// Listen for messages from content script or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getMedia') {
        const tabId = request.tabId;
        sendResponse({ media: detectedMedia[tabId] || [] });
    } else if (request.action === 'addMedia') {
        // Message from Content Script finding DOM elements
        const tabId = sender.tab.id;
        if (!detectedMedia[tabId]) detectedMedia[tabId] = [];

        const mediaItem = request.media;
        if (!detectedMedia[tabId].some(m => m.url === mediaItem.url)) {
            detectedMedia[tabId].push(mediaItem);
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

// Clean up when tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
    if (detectedMedia[tabId]) {
        delete detectedMedia[tabId];
    }
});
