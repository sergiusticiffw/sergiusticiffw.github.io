# App Icon Design

## Overview
The app icon represents the core functionality of the Expenses PWA application - a comprehensive financial management tool for tracking expenses, income, and loans.

## Design Elements

### 1. **Credit Card / Wallet** (Bottom)
- Represents financial transactions and payment management
- Green gradient (#50fa7b to #3dd66a) symbolizing money and positive financial flow
- Dollar sign ($) prominently displayed
- Card chip and lines for authenticity

### 2. **Chart / Graph** (Top)
- Bar chart showing financial data visualization
- Purple gradient (#bd93f9 to #8b5cf6) for analytics and insights
- Trend line in green (#50fa7b) showing upward financial growth
- Represents the charts and statistics features

### 3. **Decorative Elements**
- **Plus sign** (green circle) - represents income/adding money
- **Minus sign** (red circle) - represents expenses/spending
- Positioned on the sides for visual balance

### 4. **Color Scheme**
- **Background**: Dark gradient (#282a36 to #1e1f29) - matches app theme
- **Card**: Green gradient - money, positive flow
- **Chart**: Purple gradient - analytics, insights
- **Trend**: Green - growth, success

## Technical Details

- **Format**: SVG (source) → PNG (generated)
- **Base Size**: 512x512px
- **Generated Sizes**: All sizes required by manifest.json (16px to 2480px)
- **Platforms**: Android, Chrome, Firefox, Windows 10, MS Teams

## Regeneration

To regenerate all icons from the SVG source:

```bash
npm install sharp --save-dev
node scripts/generate-icons.js
```

This will generate all required PNG files in their respective directories.

## Design Philosophy

The icon combines:
- **Practicality**: Credit card represents real-world financial transactions
- **Analytics**: Chart shows data-driven financial insights
- **Balance**: Plus/minus symbols represent income and expenses
- **Modern**: Clean, minimalist design with gradient colors
- **Recognition**: Instantly recognizable as a financial management app

