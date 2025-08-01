import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import Highcharts from 'highcharts';
import Highstock from 'highcharts/highstock';
import BrandDark from 'highcharts/themes/brand-dark';

interface HighchartsContextType {
  updateHighchartsConfig: () => void;
  useChartsBackgroundColor: boolean;
  setUseChartsBackgroundColor: (value: boolean) => void;
}

const HighchartsContext = createContext<HighchartsContextType | undefined>(undefined);

export const useHighchartsContext = () => {
  const context = useContext(HighchartsContext);
  if (!context) {
    throw new Error('useHighchartsContext must be used within a HighchartsProvider');
  }
  return context;
};

interface HighchartsProviderProps {
  children: ReactNode;
}

export const HighchartsProvider: React.FC<HighchartsProviderProps> = ({ children }) => {
  const [useChartsBackgroundColor, setUseChartsBackgroundColor] = useState(() => {
    const stored = localStorage.getItem('useChartsBackgroundColor');
    return stored ? JSON.parse(stored) : false;
  });

  const updateHighchartsConfig = () => {
    // Set default theme
    Highcharts.setOptions(BrandDark.theme);
    Highstock.setOptions(BrandDark.theme);

    // Theme-specific background colors
    const bgColors: Record<string, string> = {
      'carrot-orange': '#102433',
      inchworm: '#201f1e',
    };

    // Get user preferences
    const theme = localStorage.getItem('theme') || 'blue-pink-gradient';
    const currentUseChartsBackgroundColor = localStorage.getItem('useChartsBackgroundColor');

    // Configure theme
    const chartTheme = {
      tooltip: {
        style: {
          fontSize: '15px',
        },
      },
      ...(currentUseChartsBackgroundColor !== 'true' && {
        chart: {
          backgroundColor: theme ? bgColors[theme] : '#282a36',
        },
      }),
    };

    // Apply theme
    Highcharts.setOptions(chartTheme);
    Highstock.setOptions(chartTheme);

    // Performance optimizations
    const performanceOptions = {
      plotOptions: {
        series: {
          animation: false,
          boostThreshold: 4000,
        },
      },
    };

    Highcharts.setOptions(performanceOptions);
    Highstock.setOptions(performanceOptions);
  };

  // Listen for localStorage changes and custom events
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'useChartsBackgroundColor' || e.key === 'theme') {
        updateHighchartsConfig();
      }
    };

    const handleCustomStorageChange = (e: CustomEvent) => {
      if (e.detail?.key === 'useChartsBackgroundColor' || e.detail?.key === 'theme') {
        updateHighchartsConfig();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('localStorageChange', handleCustomStorageChange as EventListener);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('localStorageChange', handleCustomStorageChange as EventListener);
    };
  }, []);

  // Update config when useChartsBackgroundColor changes
  useEffect(() => {
    updateHighchartsConfig();
  }, [useChartsBackgroundColor]);

  // Initial configuration
  useEffect(() => {
    updateHighchartsConfig();
  }, []);

  const handleSetUseChartsBackgroundColor = (value: boolean) => {
    setUseChartsBackgroundColor(value);
    localStorage.setItem('useChartsBackgroundColor', JSON.stringify(value));
    updateHighchartsConfig();
  };

  const value: HighchartsContextType = {
    updateHighchartsConfig,
    useChartsBackgroundColor,
    setUseChartsBackgroundColor: handleSetUseChartsBackgroundColor,
  };

  return (
    <HighchartsContext.Provider value={value}>
      {children}
    </HighchartsContext.Provider>
  );
}; 