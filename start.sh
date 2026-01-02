#!/bin/bash

echo "🚀 Starting Linux IDM..."
echo ""
echo "Checking Node.js installation..."

if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed!"
    echo "Please install Node.js first: https://nodejs.org/"
    exit 1
fi

echo "✅ Node.js found: $(node --version)"
echo ""

if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

echo "🎨 Launching Linux IDM..."
npm start
