// Stores detected media: { tabId: [ { url, type, size, filename } ] }
let detectedMedia = {};

// Listen for network requests to detect media files
chrome.webRequest.onHeadersReceived.addListener(
    (details) => {
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

                    if (size > 0 && size < 50000 && !url.includes('.m3u8')) return;

                    if (!detectedMedia[tabId]) detectedMedia[tabId] = [];

                    if (!detectedMedia[tabId].some(m => m.url === url)) {
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

                        const mediaItem = {
                            url: url,
                            type: type,
                            size: size,
                            filename: filename,
                            source: 'network'
                        };

                        detectedMedia[tabId].push(mediaItem);

                        // Notify content script about detection
                        chrome.tabs.sendMessage(tabId, {
                            action: 'showDetectionNotify',
                            media: mediaItem
                        }).catch(() => { }); // Ignore errors for tabs without content scripts

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
        sendResponse({ media: detectedMedia[tabId] || [] });
    } else if (request.action === 'addMedia') {
        const tabId = sender.tab.id;
        if (!detectedMedia[tabId]) detectedMedia[tabId] = [];

        const mediaItem = request.media;
        if (!detectedMedia[tabId].some(m => m.url === mediaItem.url)) {
            detectedMedia[tabId].push(mediaItem);

            // Notify content script (DOM detection)
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
