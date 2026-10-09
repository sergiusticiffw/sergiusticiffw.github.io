# App Icon Design

## Overview
The app icon represents the core functionality of the Expenses PWA application - a simple and clean financial management tool.

## Design Elements

### **Dollar Sign ($)**
- Simple and recognizable symbol for expenses and financial management
- Green gradient (#50fa7b to #3dd66a) symbolizing money and positive financial flow
- Large, bold design for maximum visibility and clarity
- Centered on a dark gradient background (#282a36 to #1e1f29) matching the app theme

### **Color Scheme**
- **Background**: Dark gradient (#282a36 to #1e1f29) - matches app theme
- **Dollar Sign**: Green gradient (#50fa7b to #3dd66a) - money, financial flow

## Technical Details

- **Format**: SVG (source) → PNG (generated)
- **Base Size**: 512x512px
- **Generated Sizes**: All sizes required by manifest.json (16px to 1240px)
- **Platforms**: Android, Chrome, Firefox, Windows 10, MS Teams

## Regeneration

To regenerate all icons from the SVG source:

```bash
npm install sharp --save-dev
node scripts/generate-icons.js
```

This will generate all required PNG files in their respective directories.

## Design Philosophy

The icon is designed to be:
- **Simple**: Clean, minimalist design with a single, clear symbol
- **Recognizable**: Instantly recognizable as a financial management app
- **Modern**: Modern gradient colors and rounded corners
- **Versatile**: Works well at all sizes from 16px to 1240px
