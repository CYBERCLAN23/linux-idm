#!/bin/bash

# Linux IDM - Easy Installation Script
# Designed for all Linux distributions

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Get absolute path of the current directory
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"

clear
echo -e "${PURPLE}"
echo "  _      _                      _____ _____  __  __ "
echo " | |    (_)                    |_   _|  __ \|  \/  |"
echo " | |     _ _ __  _   ___  __     | | | |  | | \  / |"
echo " | |    | | '_ \| | | \ \/ /     | | | |  | | |\/| |"
echo " | |____| | | | | |_| |>  <     _| |_| |__| | |  | |"
echo " |______|_|_| |_|\__,_/_/\_\   |_____|_____/|_|  |_|"
echo -e "${NC}"
echo -e "${BLUE}Welcome to the Linux IDM Auto-Installer!${NC}"
echo "-------------------------------------------------------"

# Check dependencies
echo -e "\n🔍 Checking system requirements..."

if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed.${NC}"
    echo "Please install Node.js first:"
    echo "Ubuntu/Debian: sudo apt install nodejs npm"
    echo "Fedora: sudo dnf install nodejs npm"
    echo "Arch: sudo pacman -S nodejs npm"
    exit 1
fi

echo -e "${GREEN}✅ Node.js found: $(node -v)${NC}"

# Install packages
echo -e "\n📦 Installing application dependencies..."
npm install express ws open axios ytdl-core @distube/ytdl-core cors --no-save

# Install desktop entries
echo -e "\n🖥️ Setting up application menu shortcuts..."
chmod +x install-desktop.sh
./install-desktop.sh

# Add alias for easier CLI usage
if ! grep -q "alias idm=" ~/.bashrc; then
    echo -e "\n⌨️  Adding 'idm' command to your shell..."
    # Correctly handle quotes in the alias
    echo "alias idm='$DIR/start-web.sh'" >> ~/.bashrc
    echo -e "You can now just type ${BLUE}'idm'${NC} in any terminal to start!"
fi

# Enable Background Autostart
echo -e "\n⚙️ Setting up background autostart (systemd)..."
mkdir -p ~/.config/systemd/user/
cp $DIR/linux-idm.service ~/.config/systemd/user/linux-idm.service
# Update paths in service file dynamically
sed -i "s|WorkingDirectory=.*|WorkingDirectory=$DIR|" ~/.config/systemd/user/linux-idm.service
sed -i "s|ExecStart=.*|ExecStart=$(which node) $DIR/server.js --background|" ~/.config/systemd/user/linux-idm.service

systemctl --user daemon-reload
systemctl --user enable linux-idm.service
systemctl --user restart linux-idm.service

echo -e "${GREEN}✅ Background service enabled! IDM will start on every reboot.${NC}"

# Finalizing
echo -e "\n✨ ${GREEN}Installation Complete!${NC}"
echo "-------------------------------------------------------"
echo -e "🚀 ${BLUE}HOW TO START:${NC}"
echo -e "1. Search for ${PURPLE}'Linux IDM (Web)'${NC} in your app menu."
echo -e "2. Or type ${BLUE}'idm'${NC} in a NEW terminal."
echo -e "3. Or run: ${BLUE}./start-web.sh${NC} in this folder."
echo ""
echo -e "🌐 ${BLUE}HOW TO ADD TO BROWSER:${NC}"
echo -e "• ${GREEN}Chrome/Brave:${NC} Open chrome://extensions, enable Developer Mode, 'Load Unpacked', select the 'extension' folder."
echo -e "• ${GREEN}Firefox:${NC} Open about:debugging, 'This Firefox', 'Load Temporary Add-on', select 'linux-idm-firefox.zip'."
echo "-------------------------------------------------------"
echo -e "${PURPLE}Happy Downloading!${NC}"
