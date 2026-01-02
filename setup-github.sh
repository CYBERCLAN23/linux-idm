#!/bin/bash

echo "🚀 Preparing Linux IDM for GitHub..."
echo ""

if [ ! -d ".git" ]; then
    echo "Initializing Git repository..."
    git init
fi

git add .
git commit -m "Initial commit: Linux IDM v1.0.0 Public Release"

echo ""
echo "✅ Local repository prepared!"
echo ""
echo "Next steps to make it public on GitHub:"
echo "1. Create a new repository on GitHub named 'linux-idm'"
echo "2. Run the following commands:"
echo ""
echo "   git remote add origin https://github.com/YOUR_USERNAME/linux-idm.git"
echo "   git branch -M main"
echo "   git push -u origin main"
echo ""
echo "3. To trigger a release build, create a tag:"
echo ""
echo "   git tag -a v1.0.0 -m 'Release v1.0.0'"
echo "   git push origin v1.0.0"
echo ""
echo "The GitHub Action will automatically build and publish your downloads!"
