# 🌐 Linux IDM Browser Extension

This extension integrates your browser with Linux IDM, allowing you to grab videos and audio from any website.

## 📦 Compatibility
This extension works on ALL Linux distributions (Ubuntu, Fedora, Arch, etc.) using any **Chromium-based browser**:
- Google Chrome
- Chromium
- Brave
- Microsoft Edge
- Vivaldi
- Opera

*(Firefox support is possible but requires a slightly different manifest format. This version is optimized for Chromium browsers.)*

- Opera

This package also includes a **Firefox Version** (`linux-idm-firefox.zip`).

## 📥 How to Install

### Option A: Chrome / Brave / Edge

1. **Locate the ZIP file**:
   Use `linux-idm-extension.zip`.
   
2. **Extract the ZIP**:
   Extract it to a folder.
   
3. **Open Browser Extensions Page**:
   - Go to `chrome://extensions`
   
4. **Enable Developer Mode**:
   Look for a toggle switch (usually in the top right corner) named "Developer mode" and **turn it ON**.

5. **Load the Extension**:
   - Click the **"Load unpacked"** button.
   - Select the extracted folder.

### Option B: Mozilla Firefox

1. **Locate the ZIP file**:
   Use `linux-idm-firefox.zip`.

2. **Open Debugging Page**:
   - Type `about:debugging` in the address bar.
   - Click on **"This Firefox"** (on the left sidebar).

3. **Load Temporary Add-on**:
   - Click **"Load Temporary Add-on..."**.
   - Navigate to the `linux-idm-firefox.zip` file (or the manifest inside it).
   - *Note: Firefox removes temporary extensions when you restart the browser. To keep it permanently, you would need to sign it via Mozilla Add-ons, but for personal use, loading it this way is the quickest method.*

6. **Pin the Extension**:
   Click the "Puzzle piece" icon in your browser toolbar and pin "Linux IDM Integration" so it's always visible.

## 🚀 How to Use

1. **Start the Linux IDM App**:
   Make sure your download manager is running!
   ```bash
   cd /home/psycho/Desktop/idm
   ./start-web.sh
   # OR ./start.sh if using the native app
   ```

2. **Visit a Website**:
   Go to YouTube, Vimeo, or any site with media.

3. **Play the Media**:
   Start playing the video or audio. This is crucial as the extension "sniffs" the network traffic to find the file.

4. **Click the Extension Icon**:
   The icon badge will show a number (e.g., "1", "2") indicating detected media streams.
   Click the icon to see the list.

5. **Download**:
   Click **"Download with IDM"** next to the file you want.
   
   🎉 **Success!** Requires no copy-pasting. The download starts immediately in your Linux IDM app.

## 🔧 Troubleshooting

- **"IDM Disconnected"**: 
  - Ensure Linux IDM is running locally (`./start-web.sh`).
  - check if `http://localhost:3000` is accessible in your browser.

- **No Media Detected**:
  - Refresh the webpage.
  - Make sure to press **Play** on the video player.
  - Some encrypted streams (DRM like Netflix/Spotify) cannot be downloaded due to legal protections.

