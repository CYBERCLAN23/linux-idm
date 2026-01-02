#!/bin/bash

echo "📦 Building Linux IDM packages..."
echo ""

# Check if electron-builder is installed
if ! npm list electron-builder &> /dev/null; then
    echo "Installing electron-builder..."
    npm install --save-dev electron-builder
fi

echo "🔨 Building packages for Linux..."
echo ""
echo "This will create:"
echo "  • AppImage (universal Linux)"
echo "  • .deb (Debian/Ubuntu)"
echo "  • .rpm (Fedora/RHEL)"
echo ""

npm run build:linux

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Build completed successfully!"
    echo ""
    echo "📦 Packages are in the dist/ folder:"
    ls -lh dist/*.{AppImage,deb,rpm} 2>/dev/null
    echo ""
    echo "To install:"
    echo "  • AppImage: chmod +x dist/*.AppImage && ./dist/*.AppImage"
    echo "  • .deb: sudo dpkg -i dist/*.deb"
    echo "  • .rpm: sudo rpm -i dist/*.rpm"
else
    echo ""
    echo "❌ Build failed. Check the errors above."
    exit 1
fi
