# 🚀 Quick Start Guide - Linux IDM (Public Version)

Welcome to the public release of Linux IDM! This guide will help you set up and distribute the application.

## 📦 For Users

### 1. Installation
The easiest way to install Linux IDM is by using the pre-built packages:
- Download the `.deb` or `.rpm` for your system.
- Or use the `AppImage` for a portable experience.

### 2. Registering Desktop Icons
If you've cloned the repository, run the following command to add Linux IDM to your application menu:
```bash
./install-desktop.sh
```

---

## 🛠️ For Developers

### 1. Prerequisites
- **Node.js** (v18 or higher)
- **NPM**

### 2. Development Setup
```bash
git clone https://github.com/XYBERCLAN/linux-idm.git
cd linux-idm
npm install
npm run dev
```

### 3. Building for Distribution
You can build packages for Linux using:
```bash
./build.sh
```
This will generate files in the `dist/` directory.

---

## 🌐 Browser Extensions

Don't forget to install the browser extensions for a seamless experience:
1. Go to the extension settings in your browser (e.g., `chrome://extensions`).
2. Enable "Developer Mode".
3. Load the unpacked extension from the `extension/` (Chrome) or `extension-firefox/` folder.

Detailed instructions can be found in [EXTENSION_MANUAL.md](EXTENSION_MANUAL.md).

---

## 🌍 Making it Public (GitHub)

If you have forked this project and want to release your own version:

1. Use `./setup-github.sh` to initialize your repo.
2. Push your code to GitHub.
3. Push a tag (e.g., `v1.0.0`) to trigger the automatic release build via GitHub Actions.

The GitHub Action will:
- Build the `.deb`, `.rpm`, and `AppImage`.
- Package the Chrome and Firefox extensions.
- Create a GitHub Release with all these files attached.

---

## 🛑 Stopping the Web Server
If you are running in Web Mode (`./start-web.sh`), you can stop the server by pressing `Ctrl+C` in the terminal.

---

Made with ❤️ by XYBERCLAN
