import React, { useState } from 'react';
import { FaPalette, FaCheck } from 'react-icons/fa';
import './ThemeSelector.scss';

interface Theme {
  name: string;
  class: string;
  preview: string;
  description: string;
}

const themes: Theme[] = [
  {
    name: 'Modern Purple',
    class: 'modern-purple',
    preview: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    description: 'Elegant purple gradient theme',
  },
  {
    name: 'Ocean Blue',
    class: 'modern-cyan',
    preview: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    description: 'Fresh ocean blue theme',
  },
  {
    name: 'Bondi Blue',
    class: 'bondi-blue',
    preview: '#00a8ad',
    description: 'Classic teal theme',
  },
  {
    name: 'Sunset Orange',
    class: 'carrot-orange',
    preview: '#ef9528',
    description: 'Warm orange theme',
  },
  {
    name: 'Rose Pink',
    class: 'indian-red',
    preview: '#db5463',
    description: 'Soft pink theme',
  },
  {
    name: 'Emerald Green',
    class: 'maximum-green-yellow',
    preview: '#cdf05d',
    description: 'Vibrant green theme',
  },
  {
    name: 'Golden Yellow',
    class: 'saffron',
    preview: '#e9c12f',
    description: 'Bright yellow theme',
  },
  {
    name: 'Neon Green',
    class: 'inchworm',
    preview: '#99de5d',
    description: 'Neon green theme',
  },
  {
    name: 'Steel Blue',
    class: 'cadetblue',
    preview: 'cadetblue',
    description: 'Professional blue theme',
  },
  {
    name: 'Cosmic Purple',
    class: 'blue-pink-gradient',
    preview: 'linear-gradient(90deg, rgba(108, 108, 244, 1) 0%, rgba(255, 107, 250, 1) 100%)',
    description: 'Cosmic gradient theme',
  },
  {
    name: 'Aqua Pearl',
    class: 'pearl-aqua',
    preview: '#7bd0c9',
    description: 'Soft aqua theme',
  },
  {
    name: 'Navy Blue',
    class: 'navy-blue',
    preview: '#40739e',
    description: 'Deep navy theme',
  },
  {
    name: 'Forest Green',
    class: 'cambridge-blue',
    preview: '#a6c5a7',
    description: 'Natural green theme',
  },
];

const ThemeSelector: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentTheme, setCurrentTheme] = useState('modern-purple');

  const handleThemeChange = (themeClass: string) => {
    // Remove all theme classes from body
    document.body.classList.remove(...themes.map(t => t.class));
    
    // Add new theme class
    document.body.classList.add(themeClass);
    setCurrentTheme(themeClass);
    
    // Close the selector
    setIsOpen(false);
  };

  const getCurrentTheme = () => {
    return themes.find(theme => theme.class === currentTheme) || themes[0];
  };

  return (
    <div className="theme-selector">
      <button
        className="theme-toggle glass-button"
        onClick={() => setIsOpen(!isOpen)}
        title="Change theme"
      >
        <FaPalette />
        <span>Theme</span>
      </button>

      {isOpen && (
        <div className="theme-dropdown glass-card">
          <div className="theme-header">
            <h3>Choose Theme</h3>
            <p>Select your preferred color scheme</p>
          </div>

          <div className="themes-grid">
            {themes.map((theme) => (
              <button
                key={theme.class}
                className={`theme-option ${currentTheme === theme.class ? 'active' : ''}`}
                onClick={() => handleThemeChange(theme.class)}
                title={theme.description}
              >
                <div className="theme-preview">
                  <div
                    className="theme-color"
                    style={{ background: theme.preview }}
                  />
                  {currentTheme === theme.class && (
                    <div className="theme-check">
                      <FaCheck />
                    </div>
                  )}
                </div>
                <div className="theme-info">
                  <span className="theme-name">{theme.name}</span>
                  <span className="theme-description">{theme.description}</span>
                </div>
              </button>
            ))}
          </div>

          <div className="theme-footer">
            <button
              className="close-button glass-button"
              onClick={() => setIsOpen(false)}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ThemeSelector;