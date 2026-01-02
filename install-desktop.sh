#!/bin/bash

# Get the absolute path of the current directory
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"

echo "🔧 Installing Desktop Entries for Linux IDM..."

# Create local applications directory if it doesn't exist
mkdir -p ~/.local/share/applications

# Function to create desktop file
create_desktop_file() {
    local name=$1
    local comment=$2
    local exec_script=$3
    local icon_path=$4
    local output_file=$5

    cat <<EOF > "$output_file"
[Desktop Entry]
Version=1.0
Type=Application
Name=$name
Comment=$comment
Exec=$DIR/$exec_script
Icon=$DIR/$icon_path
Terminal=false
Categories=Network;FileTransfer;
Keywords=download;manager;idm;internet;
StartupNotify=true
EOF
    chmod +x "$output_file"
}

# Install Native App Entry
create_desktop_file "Linux IDM" "Internet Download Manager for Linux" "start.sh" "assets/icon.png" "$HOME/.local/share/applications/linux-idm.desktop"

# Install Web Mode Entry
create_desktop_file "Linux IDM (Web)" "Internet Download Manager (Web Mode)" "start-web.sh" "assets/icon.png" "$HOME/.local/share/applications/linux-idm-web.desktop"

echo "✅ Desktop entries installed to ~/.local/share/applications/"
echo "🚀 You can now find Linux IDM in your application menu!"
