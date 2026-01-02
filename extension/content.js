// Scans the DOM for video and audio tags
function scanDOM() {
    const media = [];

    // Scan video tags
    document.querySelectorAll('video').forEach(video => {
        if (video.currentSrc) {
            media.push({
                url: video.currentSrc,
                type: 'video/mp4', // Guessing
                filename: 'video_' + Date.now() + '.mp4',
                source: 'dom'
            });
        }
        // Check sources inside video
        video.querySelectorAll('source').forEach(source => {
            if (source.src) {
                media.push({
                    url: source.src,
                    type: source.type || 'video/mp4',
                    filename: source.src.split('/').pop() || 'video.mp4',
                    source: 'dom'
                });
            }
        });
    });

    // Scan audio tags
    document.querySelectorAll('audio').forEach(audio => {
        if (audio.currentSrc) {
            media.push({
                url: audio.currentSrc,
                type: 'audio/mp3',
                filename: 'audio_' + Date.now() + '.mp3',
                source: 'dom'
            });
        }
    });

    // Send detected media to background
    media.forEach(m => {
        if (m.url && !m.url.startsWith('blob:')) { // Skip blob URLs for now as they are harder to download externally
            chrome.runtime.sendMessage({
                action: 'addMedia',
                media: m
            });
        }
    });
}

// Run scan initially and on DOM changes
scanDOM();
const observer = new MutationObserver(scanDOM);
observer.observe(document.body, { childList: true, subtree: true });
