#!/bin/bash
echo "🚀 Starting Linux IDM (Web Mode)..."
echo "This will launch a local server and open your browser."
echo ""

if [ ! -d "node_modules/cors" ]; then
    echo "📦 Dependencies not found. Installing..."
    npm install express ws open axios @distube/ytdl-core cors --no-save
fi

echo "✅ Launching..."
echo "Use Ctrl+C to stop the server."
echo ""
node server.js
