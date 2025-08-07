# FinanceFlow - Modern Finance Tracker

A beautiful and modern finance tracking application built with React, TypeScript, and Framer Motion. Track your income, expenses, and loans with an intuitive dark-themed interface.

## Features

### 💰 Financial Overview Dashboard
- Real-time statistics with animated cards
- Income vs Expenses area chart
- Expense categories pie chart
- Recent transactions list
- Monthly financial summary

### 📊 Transaction Management
- Add, view, and filter transactions
- Categorize income and expenses
- Search functionality
- Monthly filtering
- Recurring transaction support

### 💳 Loan Management
- Track loans given and taken
- Progress visualization
- Interest rate calculations
- Monthly payment tracking
- Loan status monitoring (Active, Paid, Overdue)

### 🎨 Modern UI/UX
- Beautiful dark theme
- Smooth animations with Framer Motion
- Responsive design for all devices
- Interactive charts with Recharts
- Gradient accents and glassmorphism effects

## Tech Stack

- **React** - UI framework
- **TypeScript** - Type safety
- **Framer Motion** - Animations
- **React Router** - Navigation
- **Recharts** - Data visualization
- **date-fns** - Date formatting
- **React Icons** - Icon library

## Getting Started

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/finance-tracker.git
cd finance-tracker
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm start
```

The app will open at [http://localhost:3000](http://localhost:3000)

## Available Scripts

- `npm start` - Runs the app in development mode
- `npm test` - Launches the test runner
- `npm run build` - Builds the app for production
- `npm run eject` - Ejects from Create React App (one-way operation)

## Project Structure

```
finance-tracker/
├── src/
│   ├── components/
│   │   ├── Dashboard/
│   │   ├── Sidebar/
│   │   ├── Transactions/
│   │   ├── Loans/
│   │   ├── Analytics/
│   │   └── Settings/
│   ├── types/
│   │   └── index.ts
│   ├── App.tsx
│   ├── App.css
│   └── index.tsx
├── public/
├── package.json
└── README.md
```

## Design Features

### Color Palette
- Primary: #6366f1 (Indigo)
- Success: #10b981 (Emerald)
- Warning: #f59e0b (Amber)
- Danger: #ef4444 (Red)
- Dark Background: #0f172a
- Dark Surface: #1e293b

### Gradients
- Gradient 1: Purple to Violet
- Gradient 2: Pink to Red
- Gradient 3: Blue to Cyan
- Gradient 4: Green to Teal

## Future Enhancements

- [ ] Data persistence with backend integration
- [ ] Export financial reports
- [ ] Budget planning features
- [ ] Bill reminders
- [ ] Multi-currency support
- [ ] Financial goals tracking
- [ ] Investment portfolio tracking

## License

This project is licensed under the MIT License.

## Acknowledgments

- Design inspired by modern fintech applications
- Icons from Feather Icons via react-icons
- Charts powered by Recharts
