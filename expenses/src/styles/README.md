# SCSS Architecture Documentation

This document describes the new modular SCSS architecture for the expenses application.

## 📁 File Structure

```
src/
├── styles/
│   ├── _variables.scss      # Global SCSS variables
│   ├── _themes.scss         # Theme generation and utilities
│   ├── _base.scss           # Base HTML and global styles
│   └── README.md            # This documentation
├── components/
│   ├── Navbar/
│   │   └── Navbar.scss      # Navbar component styles
│   ├── TransactionsTable/
│   │   └── TransactionsTable.scss
│   ├── TransactionForm/
│   │   └── TransactionForm.scss
│   ├── Modal/
│   │   └── Modal.scss
│   ├── Filters/
│   │   └── Filters.scss
│   ├── Charts/
│   │   └── Charts.scss
│   ├── Calendar/
│   │   └── Calendar.scss
│   ├── Profile/
│   │   └── Profile.scss
│   ├── Notification/
│   │   └── Notification.scss
│   ├── Loan/
│   │   └── Loan.scss
│   ├── Home/
│   │   └── Home.scss
│   ├── DailyAverage/
│   │   └── DailyAverage.scss
│   └── Suggestions/
│       └── Suggestions.scss
└── App.scss                 # Main SCSS file that imports all styles
```

## 🎨 Design System

### Variables (`_variables.scss`)

The variables file contains all global design tokens:

- **Colors**: Theme color map and basic colors
- **Spacing**: Consistent spacing scale (xs, sm, md, lg, xl, xxl, xxxl)
- **Border Radius**: Standardized border radius values
- **Font Sizes**: Typography scale
- **Z-Index**: Layering system
- **Breakpoints**: Responsive design breakpoints
- **Transitions**: Animation timing functions

### Themes (`_themes.scss`)

Handles theme generation and CSS custom properties:

- Automatically generates theme classes from the color map
- Provides gradient accent utilities
- Manages theme-specific overrides

### Base Styles (`_base.scss`)

Contains foundational styles:

- HTML and body element styles
- Form element defaults
- Global animations and keyframes
- Utility classes

## 🧩 Component Styles

Each component has its own SCSS file that:

- Imports the variables file for access to design tokens
- Contains only styles specific to that component
- Uses BEM-like naming conventions
- Includes responsive design considerations
- Follows the established design system

### Component Style Guidelines

1. **Import Variables**: Always import the variables file at the top
2. **Scoped Styles**: Keep styles scoped to the component
3. **Responsive Design**: Include mobile-first responsive styles
4. **Consistent Naming**: Use kebab-case for class names
5. **CSS Custom Properties**: Use theme variables for colors and spacing

## 🔄 Import System

The main `App.scss` file uses a simple import system:

```scss
// Import base styles and variables
@import 'styles/variables';
@import 'styles/themes';
@import 'styles/base';

// Import component styles
@import 'components/Navbar/Navbar';
@import 'components/TransactionsTable/TransactionsTable';
// ... other component imports
```

## 🎯 Benefits of This Architecture

### Maintainability
- **Separation of Concerns**: Each component's styles are isolated
- **Easy to Find**: Styles are co-located with components
- **Reduced Conflicts**: No more CSS specificity wars

### Scalability
- **Modular Growth**: Easy to add new components
- **Consistent Design**: Shared variables ensure consistency
- **Theme Support**: Easy to add new themes

### Performance
- **Tree Shaking**: Unused styles can be eliminated
- **Caching**: Component styles can be cached independently
- **Build Optimization**: Parallel processing of style files

### Developer Experience
- **Clear Structure**: Easy to understand and navigate
- **Hot Reloading**: Faster development with component-scoped changes
- **Debugging**: Easier to identify style issues

## 🛠️ Usage Examples

### Adding a New Component

1. Create the component directory:
```bash
mkdir src/components/NewComponent
```

2. Create the SCSS file:
```scss
// src/components/NewComponent/NewComponent.scss
@import '../../styles/variables';

.new-component {
  padding: $spacing-md;
  background: var(--bg-color);
  border-radius: $border-radius-md;
  
  &__title {
    font-size: $font-size-lg;
    color: var(--text-color);
  }
  
  @media (max-width: $breakpoint-sm) {
    padding: $spacing-sm;
  }
}
```

3. Import in App.scss:
```scss
@import 'components/NewComponent/NewComponent';
```

### Adding a New Theme

1. Add to the color map in `_variables.scss`:
```scss
$color-map: (
  // ... existing themes
  new-theme: (
    accent-color: #ff6b6b,
    secondary-color: #4ecdc4,
    bg-color: #2c3e50,
    text-color: $white,
  ),
);
```

2. The theme will be automatically generated in `_themes.scss`

## 🔧 Best Practices

1. **Use Variables**: Always use design tokens instead of hardcoded values
2. **Mobile First**: Write responsive styles with mobile-first approach
3. **BEM Methodology**: Use consistent naming conventions
4. **Avoid Deep Nesting**: Keep SCSS nesting to a maximum of 3 levels
5. **Comment Complex Styles**: Add comments for complex CSS logic
6. **Test Responsive**: Always test on different screen sizes

## 🚀 Migration Notes

The refactoring maintains all existing functionality while providing:

- Better organization and maintainability
- Consistent design system
- Improved developer experience
- Future-proof architecture

All existing styles have been preserved and organized into their respective component files. 