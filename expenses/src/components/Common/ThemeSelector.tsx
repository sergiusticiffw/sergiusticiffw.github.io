import React, { useState } from 'react';
import { FaPalette, FaCheck } from 'react-icons/fa';
import './ThemeSelector.scss';

interface Theme {
  id: string;
  name: string;
  className: string;
  description: string;
  preview: string[];
}

const themes: Theme[] = [
  {
    id: 'cosmic',
    name: 'Cosmic Glass',
    className: 'cosmic-glass',
    description: 'Deep space vibes with purple gradients',
    preview: ['#8b5cf6', '#667eea', '#764ba2']
  },
  {
    id: 'aurora',
    name: 'Aurora Glass',
    className: 'aurora-glass',
    description: 'Northern lights inspired design',
    preview: ['#06ffa5', '#00d4ff', '#7c3aed']
  },
  {
    id: 'sunset',
    name: 'Sunset Glass',
    className: 'sunset-glass',
    description: 'Warm sunset colors and gradients',
    preview: ['#ff6b6b', '#feca57', '#ff9ff3']
  },
  {
    id: 'ocean',
    name: 'Ocean Glass',
    className: 'ocean-glass',
    description: 'Deep ocean blues and aqua tones',
    preview: ['#00d4ff', '#667eea', '#4ecdc4']
  },
  {
    id: 'forest',
    name: 'Forest Glass',
    className: 'forest-glass',
    description: 'Natural greens and earth tones',
    preview: ['#4ecdc4', '#44a08d', '#2dd4bf']
  }
];

const ThemeSelector: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentTheme, setCurrentTheme] = useState('cosmic');

  const handleThemeChange = (theme: Theme) => {
    // Remove all theme classes
    const appContainer = document.querySelector('.app-container');
    if (appContainer) {
      themes.forEach(t => appContainer.classList.remove(t.className));
      appContainer.classList.add(theme.className);
    }
    
    setCurrentTheme(theme.id);
    setIsOpen(false);
  };

  const currentThemeData = themes.find(t => t.id === currentTheme) || themes[0];

  return (
    <div className="theme-selector">
      <button 
        className="theme-selector__trigger glass-morphism glow-effect"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Theme Selector"
      >
        <FaPalette />
        <span className="theme-selector__current-name">
          {currentThemeData.name}
        </span>
      </button>

      {isOpen && (
        <div className="theme-selector__dropdown glass-morphism">
          <div className="theme-selector__header">
            <h3 className="gradient-text">Choose Your Theme</h3>
            <p>Select a glassmorphism theme that matches your style</p>
          </div>
          
          <div className="theme-selector__grid">
            {themes.map((theme) => (
              <button
                key={theme.id}
                className={`theme-option ${currentTheme === theme.id ? 'active' : ''}`}
                onClick={() => handleThemeChange(theme)}
              >
                <div className="theme-option__preview">
                  {theme.preview.map((color, index) => (
                    <div
                      key={index}
                      className="theme-option__color"
                      style={{ backgroundColor: color }}
                    />
                  ))}
                  {currentTheme === theme.id && (
                    <div className="theme-option__check">
                      <FaCheck />
                    </div>
                  )}
                </div>
                
                <div className="theme-option__info">
                  <h4>{theme.name}</h4>
                  <p>{theme.description}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
      
      {isOpen && (
        <div 
          className="theme-selector__overlay"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
};

export default ThemeSelector;