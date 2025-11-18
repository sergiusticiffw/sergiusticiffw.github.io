# Icon Generation Guide

Modern SVG icons have been created. To convert them to PNG:

## Option 1: Using ImageMagick (if available)
```bash
for size in 32 48 72 96 144 192 512; do
  convert public/favicon.svg -resize ${size}x${size} public/android/android-launchericon-${size}-${size}.png
done
```

## Option 2: Using Online Tools
1. Visit https://cloudconvert.com/svg-to-png
2. Upload each SVG file
3. Set the size and download

## Option 3: Using Node.js with sharp (install: npm install sharp)
```javascript
const sharp = require('sharp');
const sizes = [32, 48, 72, 96, 144, 192, 512];
sizes.forEach(size => {
  sharp('public/favicon.svg')
    .resize(size, size)
    .png()
    .toFile(`public/android/android-launchericon-${size}-${size}.png`);
});
```

## Current Status
- SVG icons created: ✓
- PNG icons: Need conversion (see options above)
