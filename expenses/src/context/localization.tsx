import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from 'react';

export type Language = 'en' | 'ro';

interface LocalizationContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LocalizationContext = createContext<LocalizationContextType | undefined>(
  undefined
);

// Translation data
const translations = {
  en: {
    // Common
    'common.loading': 'Loading...',
    'common.save': 'Save',
    'common.cancel': 'Cancel',
    'common.clearFilters': 'Clear Filters',
    'common.delete': 'Delete',
    'common.edit': 'Edit',
    'common.add': 'Add',
    'common.close': 'Close',
    'transactionForm.addTransaction': 'Add Transaction',
    'transactionForm.editTransaction': 'Edit Transaction',
    'transaction.deleteTransaction': 'Delete Transaction',
    'common.yes': 'Yes',
    'common.no': 'No',
    'common.confirm': 'Confirm',
    'common.back': 'Back',
    'common.next': 'Next',
    'common.tryAgain': 'Try again',
    'common.income': 'Income',
    'common.previous': 'Previous',
    'common.search': 'Search',
    'common.filter': 'Filter',
    'common.clear': 'Clear',
    'common.actions': 'Actions',
    'common.status': 'Status',
    'common.date': 'Date',
    'common.amount': 'Amount',
    'common.description': 'Description',
    'common.category': 'Category',
    'common.total': 'Total',
    'common.average': 'Average',
    'common.profit': 'Profit',
    'common.active': 'Active',
    'common.completed': 'Completed',
    'common.pending': 'Pending',
    'common.loadMore': 'Load More',
    'common.remaining': 'remaining',
    'common.showing': 'Showing',
    'common.transaction': 'transaction',
    'common.transactions': 'transactions',

    // Months
    'months.january': 'January',
    'months.february': 'February',
    'months.march': 'March',
    'months.april': 'April',
    'months.may': 'May',
    'months.june': 'June',
    'months.july': 'July',
    'months.august': 'August',
    'months.september': 'September',
    'months.october': 'October',
    'months.november': 'November',
    'months.december': 'December',

    // Navigation
    'nav.home': 'Home',
    'nav.expenses': 'Expenses',
    'nav.income': 'Income',
    'nav.charts': 'Charts',
    'nav.loans': 'Loans',
    'nav.profile': 'Profile',

    // Offline
    'offline.message': 'No internet connection',
    'syncStatus.syncing': 'Syncing...',
    'syncStatus.synced': 'Synced',
    'syncStatus.pending': 'pending',

    // Home Page
    'home.title': 'Expenses',
    'home.noData': 'No transaction records found.',
    'home.noDataDesc':
      'Start tracking your expenses by adding your first transaction.',
    'home.noTransactionsFound': 'No transactions found',
    'home.tryDifferentFilters':
      "Try adjusting your search or filters to find what you're looking for.",
    'home.addFirstTransaction': 'Add your first transaction to get started!',
    'home.monthlyStats': 'Monthly Statistics',
    'home.dailyAverage': 'Daily Average',
    'home.monthlyAverage': 'Monthly Average',
    'home.last60Days': 'Last 60 Days Average',
    'home.last60DaysDesc': 'Average spending for the last 60 days:',
    'home.perDay': '/ day',
    'home.allTimeSpendings': 'All Time Spendings',
    'home.hoverToSeeDetails': 'Hover to see details',
    'home.mostExpensiveItem': 'The most expensive item',
    'home.dailyAveragePerCategory': 'Daily Average Per Category',
    'home.monthlyAveragePerCategory': 'Monthly Average Per Category',
    'home.averageSpendingLast60Days': 'Average spending for the last 60 days',
    'home.day': 'day',
    'home.month': 'month',

    // Income Page
    'income.title': 'Income Management',
    'income.subtitle': 'Track and manage your income sources',
    'income.addIncome': 'Add New Income',
    'income.deleteIncome': 'Delete Income',
    'income.totalIncome': 'Total Income',
    'income.averageIncome': 'Average Income',
    'income.monthlyIncome': 'Monthly Income',
    'income.yearlyIncome': 'Yearly Income',
    'income.noIncome': 'No income records found',
    'income.noIncomeDesc':
      'No income available. Add your first income to get started!',
    'income.addFirstIncome': 'Add Your First Income',
    'income.incomeRecord': 'income record',
    'income.incomeRecords': 'Income Records',
    'income.manageAndTrackIncome': 'Manage and track your income sources',
    'income.totalIncomePerYear': 'Total Income Per Year',
    'income.year': 'Year',
    'income.spent': 'Spent',
    'income.savings': 'Savings',
    'income.manageIncome': 'Manage and track your income',
    'income.source': 'Source',
    'income.amount': 'Amount',
    'income.date': 'Date',
    'income.notes': 'Notes',

    // Profile Page
    'profile.title': 'Profile',
    'profile.subtitle': 'Manage your account settings',
    'profile.personalInfo': 'Personal Information',
    'profile.language': 'Language',
    'profile.currency': 'Currency',
    'profile.theme': 'Theme',
    'profile.darkMode': 'Dark Mode',
    'profile.lightMode': 'Light Mode',
    'profile.autoMode': 'Auto Mode',
    'profile.saveChanges': 'Save Changes',
    'profile.changesSaved': 'Changes saved successfully!',
    'profile.english': 'English',
    'profile.romanian': 'Romanian',
    'profile.budgetSettings': 'Budget Settings',
    'profile.weeklyBudget': 'Weekly Budget',
    'profile.enterWeeklyBudget': 'Enter weekly budget',
    'profile.monthlyBudget': 'Monthly Budget',
    'profile.enterMonthlyBudget': 'Enter monthly budget',
    'profile.chartsSettings': 'Charts Settings',
    'profile.useChartsBackgroundColor': 'Use Charts Background Color',
    'profile.chartsVisibility': 'Charts Visibility',
    'profile.account': 'Account',
    'profile.signOut': 'Sign Out',

    // Login
    'login.pleaseLogin':
      'Please login using Google in order to access app functionality.',
    'login.errors': 'We have some errors',
    'login.signingIn': 'Signing in...',
    'login.signInWithGoogle': 'Sign in with Google',

    // Charts Page
    'charts.title': 'Analytics & Charts',
    'charts.subtitle': 'Visualize your financial data',
    'charts.last30DaysSpendings': 'Last 30 days spendings',
    'charts.yearsInReview': 'Years in review',
    'charts.monthlyComparisonAcrossYears': 'Monthly Comparison Across Years',
    'charts.monthlySavingsAcrossYears': 'Monthly Savings Across Years',
    'charts.savings': 'Savings',
    'charts.savingsHistory': 'Savings History',
    'charts.dailyAverageTrend': 'Daily Average Trend',
    'charts.monthlyAverageTrend': 'Monthly Average Trend',
    'charts.monthlyComparison': 'Monthly Comparison',
    'charts.monthlySavings': 'Monthly Savings',
    'charts.yearAverage': 'Year Average Trend',
    'charts.incomeTrend': 'Income Trend',
    'charts.totalSpentPerYear': 'Total spent per year',
    'charts.totalSpent': 'Total Spent',
    'charts.totalDays': 'Total Days',
    'charts.days': 'days',
    'charts.totalMonths': 'Total Months',
    'charts.months': 'months',
    'charts.totalItems': 'Total Items',
    'charts.items': 'items',
    'charts.monthly': 'Monthly',
    'charts.monthlyAverage': 'Monthly Average',
    'charts.dailyExpenses': 'Daily expenses',
    'charts.dailyIncomes': 'Daily incomes',
    'charts.dailyAverage': 'Daily average',
    'charts.dailyAverageTrends': 'Daily average trends',
    'charts.monthlyAverageTrends': 'Monthly Average Trends',
    'charts.monthlyTotals': 'Monthly Totals',

    // Forms
    'form.required': 'This field is required',
    'form.invalidAmount': 'Please enter a valid amount',
    'form.invalidDate': 'Please enter a valid date',
    'form.invalidEmail': 'Please enter a valid email address',
    'form.passwordMismatch': 'Passwords do not match',
    'form.minLength': 'Must be at least {min} characters',
    'form.amountPlaceholder': '0.00',
    'form.selectCategory': 'Select a category...',
    'form.maxLength': 'Must be no more than {max} characters',

    // Categories
    'category.food': 'Food',
    'category.transport': 'Transport',
    'category.entertainment': 'Entertainment',
    'category.shopping': 'Shopping',
    'category.health': 'Health',
    'category.education': 'Education',
    'category.bills': 'Bills',
    'category.other': 'Other',
    'category.clothing': 'Clothing',
    'category.gifts': 'Gifts',
    'category.household': 'Household Items/Supplies',
    'category.housing': 'Housing',
    'category.personal': 'Personal',
    'category.family': 'Family',
    'category.travel': 'Travel',
    'category.investment': 'Investment',
    'category.utilities': 'Utilities',

    // Suggestions
    'suggestions.clothing.haine': 'clothes',
    'suggestions.clothing.incaltaminte': 'shoes',
    'suggestions.clothing.pantaloni': 'pants',
    'suggestions.clothing.tricouri': 't-shirts',
    'suggestions.entertainment.happyHour': 'happy hour',
    'suggestions.entertainment.benzinarie': 'gas station',
    'suggestions.entertainment.ceaiCafea': 'tea/coffee',
    'suggestions.entertainment.restaurant': 'restaurant',
    'suggestions.entertainment.ingetata': 'ice cream',
    'suggestions.entertainment.parc': 'park',
    'suggestions.food.market': 'market',
    'suggestions.food.apa': 'water',
    'suggestions.food.lunch': 'lunch',
    'suggestions.food.inghetata': 'ice cream',
    'suggestions.food.strausGlovo': 'straus/glovo food',
    'suggestions.gifts.flori': 'flowers',
    'suggestions.gifts.ziDeNastere': 'birthday',
    'suggestions.household.igiena': 'hygiene/cleaning',
    'suggestions.household.scutece': 'diapers',
    'suggestions.housing.house': 'house',
    'suggestions.housing.rataJakala': 'jakala/ffw rate',
    'suggestions.housing.rataIpoteca': 'mortgage rate',
    'suggestions.housing.rataCredConsum': 'consumer credit rate',
    'suggestions.housing.apartmentRent': 'apartment rent',
    'suggestions.health.farmacie': 'pharmacy',
    'suggestions.health.stomatolog': 'dentist',
    'suggestions.health.pediatru': 'pediatrician',
    'suggestions.health.sport': 'sport',
    'suggestions.health.asigurare': 'insurance',
    'suggestions.personal.haircut': 'haircut',
    'suggestions.personal.nails': 'nails',
    'suggestions.transport.benzina': 'gasoline',
    'suggestions.transport.motorina': 'diesel',
    'suggestions.transport.carService': 'car service',
    'suggestions.transport.lichidParbriz': 'windshield fluid',
    'suggestions.transport.carWash': 'car wash',
    'suggestions.transport.taxi': 'taxi',
    'suggestions.transport.parcare': 'parking',
    'suggestions.transport.troleibus': 'trolleybus',
    'suggestions.utilities.gaz': 'gas',
    'suggestions.utilities.lumina': 'electricity',
    'suggestions.utilities.bloc': 'building',
    'suggestions.family.gradinita': 'kindergarten',
    'suggestions.family.jucarii': 'toys',
    'suggestions.family.terenJoaca': 'playground',
    'suggestions.alcohol.vin': 'wine',
    'suggestions.alcohol.bere': 'beer',
    'suggestions.alcohol.whiskey': 'whiskey',
    'suggestions.alcohol.cognac': 'cognac',
    'suggestions.alcohol.gin': 'gin',
    'suggestions.alcohol.cocktails': 'cocktails',

    // Notifications
    'notification.success': 'Success',
    'notification.error': 'Error',
    'notification.warning': 'Warning',
    'notification.info': 'Information',
    'notification.savedOffline': 'Saved offline - will sync when online',
    'notification.transactionAdded': 'Transaction added successfully!',
    'notification.transactionUpdated': 'Transaction updated successfully!',
    'notification.transactionDeleted': 'Transaction deleted successfully!',
    'notification.incomeAdded': 'Income added successfully!',
    'notification.incomeUpdated': 'Income updated successfully!',
    'notification.incomeDeleted': 'Income deleted successfully!',
    'notification.loanAdded': 'Loan added successfully!',
    'notification.loanUpdated': 'Loan updated successfully!',
    'notification.loanDeleted': 'Loan deleted successfully!',
    'notification.paymentAdded': 'Payment added successfully!',
    'notification.paymentUpdated': 'Payment updated successfully!',
    'notification.paymentDeleted': 'Payment deleted successfully!',
    'notification.profileUpdated': 'Profile updated successfully!',

    // Loan
    'loan.addLoan': 'Add Loan',
    'loan.editLoan': 'Edit Loan',
    'loan.deleteLoan': 'Delete Loan',
    'loan.addPayment': 'Add Payment',
    'loan.principal': 'Principal',
    'loan.paid': 'Paid',
    'loan.remaining': 'Remaining',
    'loan.paymentProgress': 'Payment Progress',
    'loan.paymentHistory': 'Payment History',
    'loan.amortizationSchedule': 'Amortization Schedule',
    'loan.loanCostBreakdown': 'Loan Cost Breakdown',
    'loan.interests': 'Interests',
    'loan.installments': 'Installments',
    'loan.noAmortizationData': 'No amortization schedule data available.',
    'loan.debugInfo': 'Debug info',
    'loan.monthsPassed': 'Months Passed',
    'loan.daysRemaining': 'Days Remaining',
    'loan.notStarted': 'Not started',
    'loan.currentInterest': 'Interest Paid',
    'loan.interestSavings': 'Interest Saved',
    'loan.principalPaid': 'Principal Paid',
    'loan.remainingPrincipal': 'Remaining Principal',

    // Loans Page
    'loans.title': 'Loans',
    'loans.addLoan': 'Add New Loan',
    'loans.active': 'Active',
    'loans.pending': 'Pending',
    'loans.noLoans': 'No loans found',
    'loans.noLoansDesc':
      'No loans available. Add your first loan to get started!',
    'loans.noLoansWithStatus': 'No loans with status',
    'loans.showAllLoans': 'Show All Loans',
    'loans.allStatuses': 'All Statuses',
    'loans.loanRecords': 'Loan Records',
    'loans.manageLoans': 'Manage and track your loans',
    'loans.loanTitle': 'Title',
    'loans.principal': 'Principal',
    'loans.status': 'Status',
    'loans.deleteLoan': 'Delete Loan',
    'loans.loan': 'loan',
    'loans.loans': 'loans',

    // Amortization
    'amortization.total': 'Total',
    'amortization.date': 'Date',
    'amortization.rate': 'Rate',
    'amortization.days': 'Days',
    'amortization.installment': 'Installment',
    'amortization.reduction': 'Reduction',
    'amortization.interest': 'Interest',
    'amortization.principal': 'Principal',
    'amortization.fee': 'Fee',

    // Modals
    'modal.deleteTitle': 'Delete Confirmation',
    'modal.deleteMessage':
      'Are you sure you want to delete this item? This action cannot be undone.',
    'modal.deleteTransaction':
      'Are you sure you want to delete this transaction?',
    'modal.deleteIncome': 'Are you sure you want to delete this income?',
    'modal.deleteLoan':
      'Are you sure you want to delete this loan? This action cannot be undone and will also delete all associated payments.',
    'modal.deleteLoanTitle': 'Are you sure you want to delete this loan?',
    'modal.deleteLoanMessage':
      'This action cannot be undone and will also delete all associated payments.',
    'modal.deletePayment': 'Are you sure you want to delete this payment?',

    // Errors
    'error.network': 'Network error. Please check your connection.',
    'error.unauthorized': 'Unauthorized. Please log in again.',
    'error.server': 'Server error. Please try again later.',
    'error.unknown': 'An unknown error occurred.',
    'error.boundary.title': 'Something went wrong',
    'error.boundary.message':
      'We encountered an unexpected error. Please try refreshing the page or contact support if the problem persists.',
    'error.boundary.details': 'Error Details (Development Only)',
    'error.boundary.tryAgain': 'Try Again',
    'error.boundary.reload': 'Reload Page',
    'error.validation': 'Please check your input and try again.',

    // Transaction Form
    'transactionForm.title': 'Add Transaction',
    'transactionForm.editTitle': 'Edit Transaction',
    'transactionForm.amount': 'Amount',
    'transactionForm.category': 'Category',
    'transactionForm.description': 'Description',
    'transactionForm.date': 'Date',
    'transactionForm.submit': 'Submit',
    'transactionForm.cancel': 'Cancel',

    // Loan Form
    'loanForm.title': 'Loan Form',
    'loanForm.addLoan': 'Add Loan',
    'loanForm.editLoan': 'Edit Loan',
    'loanForm.loanTitle': 'Loan Title',
    'loanForm.enterLoanTitle': 'Enter loan title',
    'loanForm.principalAmount': 'Principal Amount',
    'loanForm.interestRate': 'Interest Rate (%)',
    'loanForm.startDate': 'Start Date',
    'loanForm.endDate': 'End Date',
    'loanForm.initialFee': 'Initial Fee (Optional)',
    'loanForm.firstPaymentDate': 'First Payment Date',
    'loanForm.paymentDayOfMonth': 'Payment Day of Month',
    'loanForm.loanStatus': 'Loan Status',
    'loanForm.updateLoan': 'Update Loan',
    'loanForm.endDateMustBeAfterStartDate': 'End date must be after start date',
    'loanForm.firstPaymentDateMustBeBetweenStartAndEnd':
      'First payment date must be between start and end date',

    // Payment
    'payment.simulated': 'Simulated',
    'payment.editPayment': 'Edit Payment',
    'payment.deletePayment': 'Delete Payment',
    'payment.noPaymentsYet': 'No Payments Yet',
    'payment.noPaymentsDesc':
      'Start by adding your first payment to track your loan progress.',
    'payment.showingPayments': 'Showing',
    'payment.of': 'of',
    'payment.payments': 'payments',
    'payment.title': 'Title',
    'payment.installment': 'Installment',
    'payment.addNewPayment': 'Add New Payment',

    // Payment Form
    'paymentForm.addPayment': 'Add Payment',
    'paymentForm.editPayment': 'Edit Payment',
    'paymentForm.paymentTitle': 'Payment Title',
    'paymentForm.enterPaymentTitle': 'Enter payment title',
    'paymentForm.paymentDate': 'Payment Date',
    'paymentForm.newInterestRate': 'New Interest Rate (%)',
    'paymentForm.installmentPayment': 'Installment Payment',
    'paymentForm.newRecurringAmount': 'New Recurring Amount',
    'paymentForm.individualFee': 'Individual Fee',
    'paymentForm.simulatedPayment': 'Simulated payment (debug loan)',
    'paymentForm.updatePayment': 'Update Payment',

    // Income Form
    'incomeForm.addIncome': 'Add Income',
    'incomeForm.editIncome': 'Edit Income',
    'incomeForm.amount': 'Amount',
    'incomeForm.enterAmount': 'Enter amount...',
    'incomeForm.date': 'Date',
    'incomeForm.description': 'Description',
    'incomeForm.enterDescription': 'Enter description...',
    'incomeForm.updateIncome': 'Update Income',
    'incomeForm.tags': 'Income Tags',

    // Income Intelligence
    'income.incomeIntelligence': 'Income Intelligence',
    'income.incomeBySource': 'Income by Source',
    'income.incomeEvolutionBySource': 'Income Evolution by Source',
    'income.noIncomeDataAvailable':
      'No income data available. Add income entries with tags like #salary, #freelance, #bonus, #interest, or #gift.',

    // Filters
    'filters.search': 'Search transactions...',
    'filters.searchInMonth': 'Search in month...',
    'filters.searchInMonthCategory': 'Search in month/category...',
    'filters.searchInCategory': 'Search in category...',
    'filters.clearAll': 'Clear all filters',
    'filters.selectMonth': 'Select month',
    'filters.category': 'All Categories',
    'filters.categories': 'Categories',
    'filters.months': 'Months',
    'filters.tags': 'Tags',
    'filters.all': 'All',
    'filters.dateRange': 'Date Range',
    'filters.clear': 'Clear Filters',

    // Calendar
    'calendar.title': 'Calendar View',
    'calendar.previous': 'Previous',
    'calendar.next': 'Next',
    'calendar.today': 'Today',
    'calendar.noEvents': 'No events for this day',
    'calendar.addEvent': 'Add Event',

    // Suggestions Component
    'suggestions.title': 'Suggestions',
    'suggestions.noSuggestions': 'No suggestions available',
    'suggestions.selectCategory': 'Select a category to see suggestions',

    // Receipt Scanner
    'receipt.scanTitle': 'Scan Receipt',
    'receipt.takePhoto': 'Take Photo',
    'receipt.uploadImage': 'Upload Image',
    'receipt.hint': 'Take a photo or upload an image of your receipt',
    'receipt.extractedData': 'Extracted Data',
    'receipt.amount': 'Amount',
    'receipt.date': 'Date',
    'receipt.merchant': 'Merchant',
    'receipt.description': 'Description',
    'receipt.useData': 'Use This Data',
    'receipt.scanAnother': 'Scan Another',
    'receipt.scanReceipt': 'Scan Receipt',
  },
  ro: {
    // Common
    'common.loading': 'Se încarcă...',
    'common.save': 'Salvează',
    'common.cancel': 'Anulează',
    'common.clearFilters': 'Șterge Filtrele',
    'common.delete': 'Șterge',
    'common.edit': 'Editează',
    'common.add': 'Adaugă',
    'common.close': 'Închide',
    'transactionForm.addTransaction': 'Adaugă Tranzacție',
    'transactionForm.editTransaction': 'Editează Tranzacție',
    'transaction.deleteTransaction': 'Șterge Tranzacția',
    'common.yes': 'Da',
    'common.no': 'Nu',
    'common.confirm': 'Confirmă',
    'common.back': 'Înapoi',
    'common.next': 'Următorul',
    'common.tryAgain': 'Încearcă din nou',
    'common.income': 'Venit',
    'common.previous': 'Anteriorul',
    'common.search': 'Caută',
    'common.filter': 'Filtrează',
    'common.clear': 'Curăță',
    'common.actions': 'Acțiuni',
    'common.status': 'Status',
    'common.date': 'Data',
    'common.amount': 'Suma',
    'common.description': 'Descriere',
    'common.category': 'Categorie',
    'common.total': 'Total',
    'common.average': 'Medie',
    'common.profit': 'Profit',
    'common.active': 'Activ',
    'common.completed': 'Completat',
    'common.pending': 'În așteptare',
    'common.loadMore': 'Încarcă Mai Multe',
    'common.remaining': 'rămase',
    'common.showing': 'Se afișează',
    'common.transaction': 'tranzacție',
    'common.transactions': 'tranzacții',

    // Months
    'months.january': 'Ianuarie',
    'months.february': 'Februarie',
    'months.march': 'Martie',
    'months.april': 'Aprilie',
    'months.may': 'Mai',
    'months.june': 'Iunie',
    'months.july': 'Iulie',
    'months.august': 'August',
    'months.september': 'Septembrie',
    'months.october': 'Octombrie',
    'months.november': 'Noiembrie',
    'months.december': 'Decembrie',

    // Navigation
    'nav.home': 'Acasă',
    'nav.expenses': 'Cheltuieli',
    'nav.income': 'Venituri',
    'nav.charts': 'Grafice',
    'nav.loans': 'Împrumuturi',
    'nav.profile': 'Profil',

    // Offline
    'offline.message': 'Nu ai conexiune la internet',
    'syncStatus.syncing': 'Se sincronizează...',
    'syncStatus.synced': 'Sincronizat',
    'syncStatus.pending': 'în așteptare',

    // Home Page
    'home.title': 'Cheltuieli',
    'home.noData': 'Nu s-au găsit înregistrări de tranzacții.',
    'home.noDataDesc':
      'Începe să îți urmărești cheltuielile adăugând prima ta tranzacție.',
    'home.noTransactionsFound': 'Nu s-au găsit tranzacții',
    'home.tryDifferentFilters':
      'Încearcă să ajustezi căutarea sau filtrele pentru a găsi ce cauți.',
    'home.addFirstTransaction': 'Adaugă prima ta tranzacție pentru a începe!',
    'home.monthlyStats': 'Statistici Lunare',
    'home.dailyAverage': 'Media Zilnică',
    'home.monthlyAverage': 'Media Lunară',
    'home.last60Days': 'Media Ultimelor 60 de Zile',
    'home.last60DaysDesc': 'Cheltuielile medii pentru ultimele 60 de zile:',
    'home.perDay': '/ zi',
    'home.allTimeSpendings': 'Cheltuieli Totale',
    'home.hoverToSeeDetails': 'Trece cu mouse-ul pentru detalii',
    'home.mostExpensiveItem': 'Cel mai scump articol',
    'home.dailyAveragePerCategory': 'Media Zilnică pe Categorie',
    'home.monthlyAveragePerCategory': 'Media Lunară pe Categorie',
    'home.averageSpendingLast60Days':
      'Cheltuielile medii pentru ultimele 60 de zile',
    'home.day': 'zi',
    'home.month': 'lună',

    // Income Page
    'income.title': 'Gestionarea Veniturilor',
    'income.subtitle': 'Urmărește și gestionează sursele tale de venit',
    'income.addIncome': 'Adaugă Venit Nou',
    'income.deleteIncome': 'Șterge Venitul',
    'income.totalIncome': 'Venit Total',
    'income.averageIncome': 'Venit Mediu',
    'income.monthlyIncome': 'Venit Lunar',
    'income.yearlyIncome': 'Venit Anual',
    'income.noIncome': 'Nu s-au găsit înregistrări de venit',
    'income.noIncomeDesc':
      'Nu sunt venituri disponibile. Adaugă primul tău venit pentru a începe!',
    'income.incomeRecord': 'înregistrare de venit',
    'income.incomeRecords': 'Înregistrări de Venituri',
    'income.manageAndTrackIncome':
      'Gestionează și urmărește sursele tale de venit',
    'income.totalIncomePerYear': 'Total Venituri pe An',
    'income.year': 'An',
    'income.spent': 'Cheltuit',
    'income.savings': 'Economii',
    'income.addFirstIncome': 'Adaugă Primul Tău Venit',
    'income.manageIncome': 'Gestionează și urmărește veniturile tale',
    'income.source': 'Sursă',
    'income.amount': 'Suma',
    'income.date': 'Data',
    'income.notes': 'Note',

    // Profile Page
    'profile.title': 'Profil',
    'profile.subtitle': 'Gestionează setările contului tău',
    'profile.personalInfo': 'Informații Personale',
    'profile.language': 'Limbă',
    'profile.currency': 'Monedă',
    'profile.theme': 'Temă',
    'profile.darkMode': 'Mod Întunecat',
    'profile.lightMode': 'Mod Luminos',
    'profile.autoMode': 'Mod Automat',
    'profile.saveChanges': 'Salvează Modificările',
    'profile.changesSaved': 'Modificările au fost salvate cu succes!',
    'profile.english': 'Engleză',
    'profile.romanian': 'Română',
    'profile.budgetSettings': 'Setări Buget',
    'profile.weeklyBudget': 'Buget Săptămânal',
    'profile.enterWeeklyBudget': 'Introdu bugetul săptămânal',
    'profile.monthlyBudget': 'Buget Lunar',
    'profile.enterMonthlyBudget': 'Introdu bugetul lunar',
    'profile.chartsSettings': 'Setări Grafice',
    'profile.useChartsBackgroundColor':
      'Folosește Culoarea de Fundal pentru Grafice',
    'profile.chartsVisibility': 'Vizibilitatea Graficelor',
    'profile.account': 'Cont',
    'profile.signOut': 'Deconectare',

    // Login
    'login.pleaseLogin':
      'Te rog să te conectezi folosind Google pentru a accesa funcționalitatea aplicației.',
    'login.errors': 'Avem câteva erori',
    'login.signingIn': 'Se conectează...',
    'login.signInWithGoogle': 'Conectare cu Google',

    // Charts Page
    'charts.title': 'Analize și Grafice',
    'charts.subtitle': 'Vizualizează datele tale financiare',
    'charts.last30DaysSpendings': 'Cheltuielile ultimelor 30 de zile',
    'charts.yearsInReview': 'Anii în revistă',
    'charts.monthlyComparisonAcrossYears': 'Comparația Lunară pe Ani',
    'charts.monthlySavingsAcrossYears': 'Economiile Lunare pe Ani',
    'charts.savings': 'Economii',
    'charts.savingsHistory': 'Istoricul Economiilor',
    'charts.monthlySavings': 'Economiile Lunare',
    'charts.yearAverage': 'Tendința Mediei Anuale',
    'charts.incomeTrend': 'Tendința Veniturilor',
    'charts.totalSpentPerYear': 'Total cheltuit pe an',
    'charts.totalSpent': 'Total Cheltuit',
    'charts.totalDays': 'Total Zile',
    'charts.days': 'zile',
    'charts.totalMonths': 'Total Luni',
    'charts.months': 'luni',
    'charts.totalItems': 'Total Articole',
    'charts.items': 'articole',
    'charts.monthly': 'Lunar',
    'charts.monthlyAverage': 'Media Lunară',
    'charts.dailyExpenses': 'Cheltuieli zilnice',
    'charts.dailyIncomes': 'Venituri zilnice',
    'charts.dailyAverage': 'Media zilnică',
    'charts.dailyAverageTrends': 'Tendințele mediei zilnice',
    'charts.monthlyAverageTrends': 'Tendințele Mediei Lunare',
    'charts.dailyAverageTrend': 'Tendința Mediei Zilnice',
    'charts.monthlyAverageTrend': 'Tendința Mediei Lunare',
    'charts.monthlyComparison': 'Comparația Lunară',
    'charts.monthlyTotals': 'Totaluri Lunare',

    // Forms
    'form.required': 'Acest câmp este obligatoriu',
    'form.invalidAmount': 'Te rog să introduci o sumă validă',
    'form.invalidDate': 'Te rog să introduci o dată validă',
    'form.invalidEmail': 'Te rog să introduci o adresă de email validă',
    'form.passwordMismatch': 'Parolele nu se potrivesc',
    'form.minLength': 'Trebuie să aibă cel puțin {min} caractere',
    'form.amountPlaceholder': '0,00',
    'form.selectCategory': 'Selectează o categorie...',
    'form.maxLength': 'Nu poate avea mai mult de {max} caractere',

    // Categories
    'category.food': 'Mâncare',
    'category.transport': 'Transport',
    'category.entertainment': 'Divertisment',
    'category.shopping': 'Cumpărături',
    'category.health': 'Sănătate',
    'category.education': 'Educație',
    'category.bills': 'Facturi',
    'category.other': 'Altele',
    'category.clothing': 'Îmbrăcăminte',
    'category.gifts': 'Cadouri',
    'category.household': 'Articole Casnice/Provizii',
    'category.housing': 'Locuință',
    'category.personal': 'Personal',
    'category.family': 'Familie',
    'category.travel': 'Călătorii',
    'category.investment': 'Investiții',
    'category.utilities': 'Utilități',

    // Suggestions
    'suggestions.clothing.haine': 'haine',
    'suggestions.clothing.incaltaminte': 'încălțăminte',
    'suggestions.clothing.pantaloni': 'pantaloni',
    'suggestions.clothing.tricouri': 'tricouri',
    'suggestions.entertainment.happyHour': 'happy hour',
    'suggestions.entertainment.benzinarie': 'benzinărie',
    'suggestions.entertainment.ceaiCafea': 'ceai/cafea',
    'suggestions.entertainment.restaurant': 'restaurant',
    'suggestions.entertainment.ingetata': 'înghețată',
    'suggestions.entertainment.parc': 'parc',
    'suggestions.food.market': 'market',
    'suggestions.food.apa': 'apă',
    'suggestions.food.lunch': 'lunch',
    'suggestions.food.inghetata': 'înghețată',
    'suggestions.food.strausGlovo': 'straus/glovo food',
    'suggestions.gifts.flori': 'flori',
    'suggestions.gifts.ziDeNastere': 'zi de naștere',
    'suggestions.household.igiena': 'igienă/curățenie',
    'suggestions.household.scutece': 'scutec',
    'suggestions.housing.house': 'house',
    'suggestions.housing.rataJakala': 'rată la jakala/ffw',
    'suggestions.housing.rataIpoteca': 'rată la ipotecă',
    'suggestions.housing.rataCredConsum': 'rată la cred de consum',
    'suggestions.housing.apartmentRent': 'apartment rent',
    'suggestions.health.farmacie': 'farmacie',
    'suggestions.health.stomatolog': 'stomatolog',
    'suggestions.health.pediatru': 'pediatru',
    'suggestions.health.sport': 'sport',
    'suggestions.health.asigurare': 'asigurare',
    'suggestions.personal.haircut': 'haircut',
    'suggestions.personal.nails': 'nails',
    'suggestions.transport.benzina': 'benzină',
    'suggestions.transport.motorina': 'motorină',
    'suggestions.transport.carService': 'car service',
    'suggestions.transport.lichidParbriz': 'lichid parbriz',
    'suggestions.transport.carWash': 'car wash',
    'suggestions.transport.taxi': 'taxi',
    'suggestions.transport.parcare': 'parcare',
    'suggestions.transport.troleibus': 'troleibus',
    'suggestions.utilities.gaz': 'gaz',
    'suggestions.utilities.lumina': 'lumină',
    'suggestions.utilities.bloc': 'bloc',
    'suggestions.family.gradinita': 'grădiniță',
    'suggestions.family.jucarii': 'jucării',
    'suggestions.family.terenJoaca': 'teren de joacă',
    'suggestions.alcohol.vin': 'vin',
    'suggestions.alcohol.bere': 'bere',
    'suggestions.alcohol.whiskey': 'whiskey',
    'suggestions.alcohol.cognac': 'cognac',
    'suggestions.alcohol.gin': 'gin',
    'suggestions.alcohol.cocktails': 'cocktails',

    // Notifications
    'notification.success': 'Succes',
    'notification.error': 'Eroare',
    'notification.warning': 'Avertisment',
    'notification.info': 'Informație',
    'notification.transactionAdded': 'Tranzacția a fost adăugată cu succes!',
    'notification.transactionUpdated':
      'Tranzacția a fost actualizată cu succes!',
    'notification.transactionDeleted': 'Tranzacția a fost ștearsă cu succes!',
    'notification.incomeAdded': 'Venitul a fost adăugat cu succes!',
    'notification.incomeUpdated': 'Venitul a fost actualizat cu succes!',
    'notification.incomeDeleted': 'Venitul a fost șters cu succes!',
    'notification.savedOffline':
      'Salvat offline - se va sincroniza când vei fi online',
    'notification.loanAdded': 'Împrumutul a fost adăugat cu succes!',
    'notification.loanUpdated': 'Împrumutul a fost actualizat cu succes!',
    'notification.loanDeleted': 'Împrumutul a fost șters cu succes!',
    'notification.paymentAdded': 'Plata a fost adăugată cu succes!',
    'notification.paymentUpdated': 'Plata a fost actualizată cu succes!',
    'notification.paymentDeleted': 'Plata a fost ștearsă cu succes!',
    'notification.profileUpdated': 'Profilul a fost actualizat cu succes!',

    // Loan
    'loan.addLoan': 'Adaugă Împrumut',
    'loan.editLoan': 'Editează Împrumutul',
    'loan.deleteLoan': 'Șterge Împrumutul',
    'loan.addPayment': 'Adaugă Plata',
    'loan.principal': 'Principal',
    'loan.paid': 'Plătit',
    'loan.remaining': 'Rămas',
    'loan.paymentProgress': 'Progresul Plății',
    'loan.paymentHistory': 'Istoricul Plăților',
    'loan.amortizationSchedule': 'Programul de Amortizare',
    'loan.loanCostBreakdown': 'Detalierea Costului Împrumutului',
    'loan.interests': 'Dobânzi',
    'loan.installments': 'Rate',
    'loan.noAmortizationData':
      'Nu sunt disponibile date pentru programul de amortizare.',
    'loan.debugInfo': 'Informații de debug',
    'loan.monthsPassed': 'Luni Trecute',
    'loan.daysRemaining': 'Zile Rămase',
    'loan.notStarted': 'Nu a început',
    'loan.currentInterest': 'Dobândă Achitată',
    'loan.interestSavings': 'Dobândă Economisită',
    'loan.principalPaid': 'Principal Achitat',
    'loan.remainingPrincipal': 'Principal Rămas',

    // Loans Page
    'loans.title': 'Împrumuturi',
    'loans.addLoan': 'Adaugă Împrumut Nou',
    'loans.active': 'Activ',
    'loans.pending': 'În Așteptare',
    'loans.noLoans': 'Nu s-au găsit împrumuturi',
    'loans.noLoansDesc':
      'Nu sunt împrumuturi disponibile. Adaugă primul tău împrumut pentru a începe!',
    'loans.noLoansWithStatus': 'Nu s-au găsit împrumuturi cu statusul',
    'loans.showAllLoans': 'Arată Toate Împrumuturile',
    'loans.allStatuses': 'Toate Statusurile',
    'loans.loanRecords': 'Înregistrări de Împrumut',
    'loans.manageLoans': 'Gestionează și urmărește împrumuturile tale',
    'loans.loanTitle': 'Titlu',
    'loans.principal': 'Principal',
    'loans.status': 'Status',
    'loans.deleteLoan': 'Șterge Împrumutul',
    'loans.loan': 'împrumut',
    'loans.loans': 'împrumuturi',

    // Amortization
    'amortization.total': 'Total',
    'amortization.date': 'Data',
    'amortization.rate': 'Dobanda anuală',
    'amortization.days': 'Zile',
    'amortization.installment': 'Plata lunară',
    'amortization.reduction': 'Credit de plată',
    'amortization.interest': 'Dobanda de plată',
    'amortization.principal': 'Sold Credit',
    'amortization.fee': 'Comision',

    // Modals
    'modal.deleteTitle': 'Confirmare Ștergere',
    'modal.deleteMessage':
      'Ești sigur că vrei să ștergi acest element? Această acțiune nu poate fi anulată.',
    'modal.deleteTransaction':
      'Ești sigur că vrei să ștergi această tranzacție?',
    'modal.deleteIncome': 'Ești sigur că vrei să ștergi acest venit?',
    'modal.deleteLoan':
      'Ești sigur că vrei să ștergi acest împrumut? Această acțiune nu poate fi anulată și va șterge și toate plățile asociate.',
    'modal.deleteLoanTitle': 'Ești sigur că vrei să ștergi acest împrumut?',
    'modal.deleteLoanMessage':
      'Această acțiune nu poate fi anulată și va șterge și toate plățile asociate.',
    'modal.deletePayment': 'Ești sigur că vrei să ștergi această plată?',

    // Errors
    'error.network': 'Eroare de rețea. Te rog să verifici conexiunea.',
    'error.unauthorized': 'Neautorizat. Te rog să te conectezi din nou.',
    'error.server': 'Eroare de server. Te rog să încerci din nou mai târziu.',
    'error.unknown': 'A apărut o eroare necunoscută.',
    'error.boundary.title': 'Ceva nu a mers bine',
    'error.boundary.message':
      'Am întâmpinat o eroare neașteptată. Te rugăm să reîncarci pagina sau să contactezi suportul dacă problema persistă.',
    'error.boundary.details': 'Detalii Eroare (Doar în Development)',
    'error.boundary.tryAgain': 'Încearcă din nou',
    'error.boundary.reload': 'Reîncarcă Pagina',
    'error.validation':
      'Te rog să verifici datele introduse și să încerci din nou.',

    // Transaction Form
    'transactionForm.title': 'Adaugă Tranzacție',
    'transactionForm.editTitle': 'Editează Tranzacția',
    'transactionForm.amount': 'Suma',
    'transactionForm.category': 'Categorie',
    'transactionForm.description': 'Descriere',
    'transactionForm.date': 'Data',
    'transactionForm.submit': 'Trimite',
    'transactionForm.cancel': 'Anulează',

    // Loan Form
    'loanForm.title': 'Formular Împrumut',
    'loanForm.addLoan': 'Adaugă Împrumut',
    'loanForm.editLoan': 'Editează Împrumutul',
    'loanForm.loanTitle': 'Titlul Împrumutului',
    'loanForm.enterLoanTitle': 'Introdu titlul împrumutului',
    'loanForm.principalAmount': 'Suma Principală',
    'loanForm.interestRate': 'Rata de Dobândă (%)',
    'loanForm.startDate': 'Data de Început',
    'loanForm.endDate': 'Data de Sfârșit',
    'loanForm.initialFee': 'Taxa Inițială (Opțional)',
    'loanForm.firstPaymentDate': 'Data Primei Plăți',
    'loanForm.paymentDayOfMonth': 'Ziua Plății din Lună',
    'loanForm.loanStatus': 'Statusul Împrumutului',
    'loanForm.updateLoan': 'Actualizează Împrumutul',
    'loanForm.endDateMustBeAfterStartDate':
      'Data de sfârșit trebuie să fie după data de început',
    'loanForm.firstPaymentDateMustBeBetweenStartAndEnd':
      'Data primei plăți trebuie să fie între data de început și data de sfârșit',

    // Payment
    'payment.simulated': 'Simulat',
    'payment.editPayment': 'Editează Plata',
    'payment.deletePayment': 'Șterge Plata',
    'payment.noPaymentsYet': 'Încă Nu Sunt Plăți',
    'payment.noPaymentsDesc':
      'Începe prin adăugarea primei tale plăți pentru a urmări progresul împrumutului.',
    'payment.showingPayments': 'Se afișează',
    'payment.of': 'din',
    'payment.payments': 'plăți',
    'payment.title': 'Titlu',
    'payment.installment': 'Rata',
    'payment.addNewPayment': 'Adaugă Plată Nouă',

    // Payment Form
    'paymentForm.addPayment': 'Adaugă Plata',
    'paymentForm.editPayment': 'Editează Plata',
    'paymentForm.paymentTitle': 'Titlul Plății',
    'paymentForm.enterPaymentTitle': 'Introdu titlul plății',
    'paymentForm.paymentDate': 'Data Plății',
    'paymentForm.newInterestRate': 'Noua Rată de Dobândă (%)',
    'paymentForm.installmentPayment': 'Plata Ratei',
    'paymentForm.newRecurringAmount': 'Noua Sumă Recurentă',
    'paymentForm.individualFee': 'Taxa Individuală',
    'paymentForm.simulatedPayment': 'Plată simulată (debug împrumut)',
    'paymentForm.updatePayment': 'Actualizează Plata',

    // Income Form
    'incomeForm.addIncome': 'Adaugă Venit',
    'incomeForm.editIncome': 'Editează Venitul',
    'incomeForm.amount': 'Suma',
    'incomeForm.enterAmount': 'Introdu suma...',
    'incomeForm.date': 'Data',
    'incomeForm.description': 'Descriere',
    'incomeForm.enterDescription': 'Introdu descrierea...',
    'incomeForm.updateIncome': 'Actualizează Venitul',
    'incomeForm.tags': 'Etichete Venit',

    // Income Intelligence
    'income.incomeIntelligence': 'Inteligența Veniturilor',
    'income.incomeBySource': 'Venituri pe Sursă',
    'income.incomeEvolutionBySource': 'Evoluția Veniturilor pe Sursă',
    'income.noIncomeDataAvailable':
      'Nu sunt date de venit disponibile. Adaugă intrări de venit cu etichete precum #salary, #freelance, #bonus, #interest sau #gift.',

    // Filters
    'filters.search': 'Caută tranzacții...',
    'filters.searchInMonth': 'Caută în lună...',
    'filters.searchInMonthCategory': 'Caută în lună/categorie...',
    'filters.searchInCategory': 'Caută în categorie...',
    'filters.clearAll': 'Curăță toate filtrele',
    'filters.selectMonth': 'Selectează luna',
    'filters.category': 'Toate Categoriile',
    'filters.categories': 'Categorii',
    'filters.tags': 'Etichete',
    'filters.all': 'Toate',
    'filters.months': 'Luni',
    'filters.dateRange': 'Interval de Date',
    'filters.clear': 'Curăță Filtrele',

    // Calendar
    'calendar.title': 'Vizualizare Calendar',
    'calendar.previous': 'Anterior',
    'calendar.next': 'Următor',
    'calendar.today': 'Astăzi',
    'calendar.noEvents': 'Nu sunt evenimente pentru această zi',
    'calendar.addEvent': 'Adaugă Eveniment',

    // Suggestions Component
    'suggestions.title': 'Sugestii',
    'suggestions.noSuggestions': 'Nu sunt sugestii disponibile',
    'suggestions.selectCategory':
      'Selectează o categorie pentru a vedea sugestiile',

    // Receipt Scanner
    'receipt.scanTitle': 'Scanează Chitanța',
    'receipt.takePhoto': 'Fă o Fotografie',
    'receipt.uploadImage': 'Încarcă Imagine',
    'receipt.hint': 'Fă o fotografie sau încarcă o imagine a chitanței tale',
    'receipt.extractedData': 'Date Extrase',
    'receipt.amount': 'Suma',
    'receipt.date': 'Data',
    'receipt.merchant': 'Comerciant',
    'receipt.description': 'Descriere',
    'receipt.useData': 'Folosește Aceste Date',
    'receipt.scanAnother': 'Scanează Altă Chitanță',
    'receipt.scanReceipt': 'Scanează Chitanța',
  },
};

export const useLocalization = () => {
  const context = useContext(LocalizationContext);
  if (context === undefined) {
    throw new Error(
      'useLocalization must be used within a LocalizationProvider'
    );
  }
  return context;
};

interface LocalizationProviderProps {
  children: ReactNode;
}

export const LocalizationProvider: React.FC<LocalizationProviderProps> = ({
  children,
}) => {
  const [language, setLanguageState] = useState<Language>(() => {
    // Get language from localStorage or default to English
    const savedLanguage = localStorage.getItem('language') as Language;
    return savedLanguage && ['en', 'ro'].includes(savedLanguage)
      ? savedLanguage
      : 'en';
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('language', lang);
  };

  const t = (key: string): string => {
    const currentTranslations = translations[language];
    return currentTranslations[key] || key;
  };

  useEffect(() => {
    // Update document language attribute
    document.documentElement.lang = language;
  }, [language]);

  const value: LocalizationContextType = {
    language,
    setLanguage,
    t,
  };

  return (
    <LocalizationContext.Provider value={value}>
      {children}
    </LocalizationContext.Provider>
  );
};
