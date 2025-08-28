import React, { createContext, useContext, useState, useEffect } from 'react';

// Theme types
export type ThemeType = 'light' | 'dark' | 'system';

// Theme colors for each theme
export const themes = {
    light: {
        primary: '#2563eb', // Blue 600
        primaryDark: '#1d4ed8', // Blue 700
        secondary: '#4f46e5', // Indigo 600
        background: '#ffffff',
        surface: '#f9fafb', // Gray 50
        border: '#e5e7eb', // Gray 200
        text: '#1f2937', // Gray 800
        textSecondary: '#6b7280', // Gray 500
        error: '#dc2626', // Red 600
        success: '#16a34a', // Green 600
        warning: '#d97706', // Amber 600
        info: '#0284c7', // Sky 600
    },
    dark: {
        primary: '#3b82f6', // Blue 500
        primaryDark: '#2563eb', // Blue 600
        secondary: '#6366f1', // Indigo 500
        background: '#111827', // Gray 900
        surface: '#1f2937', // Gray 800
        border: '#374151', // Gray 700
        text: '#f9fafb', // Gray 50
        textSecondary: '#d1d5db', // Gray 300
        error: '#ef4444', // Red 500
        success: '#22c55e', // Green 500
        warning: '#f59e0b', // Amber 500
        info: '#0ea5e9', // Sky 500
    },
};

interface ThemeContextType {
    theme: ThemeType;
    currentTheme: typeof themes.light;
    setTheme: (theme: ThemeType) => void;
    toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

// Check system preference
const getSystemTheme = (): 'light' | 'dark' => {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return 'dark';
    }
    return 'light';
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    // Get saved theme from localStorage or default to system
    const savedTheme = localStorage.getItem('crewcast-theme') as ThemeType;
    const [theme, setThemeState] = useState<ThemeType>(savedTheme || 'system');

    // Calculate the actual theme colors based on the selected theme
    const getActualTheme = () => {
        if (theme === 'system') {
            return getSystemTheme() === 'dark' ? themes.dark : themes.light;
        }
        return theme === 'dark' ? themes.dark : themes.light;
    };

    const [currentTheme, setCurrentTheme] = useState(getActualTheme());

    // Listen for system theme changes
    useEffect(() => {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

        const handleChange = () => {
            if (theme === 'system') {
                setCurrentTheme(getSystemTheme() === 'dark' ? themes.dark : themes.light);
            }
        };

        mediaQuery.addEventListener('change', handleChange);
        return () => mediaQuery.removeEventListener('change', handleChange);
    }, [theme]);

    // Update theme when it changes
    useEffect(() => {
        setCurrentTheme(getActualTheme());
        localStorage.setItem('crewcast-theme', theme);

        // Update CSS variables
        const root = document.documentElement;
        const themeColors = getActualTheme();

        Object.entries(themeColors).forEach(([key, value]) => {
            root.style.setProperty(`--${key}`, value);
        });

        // Set the data-theme attribute for potential CSS selectors
        document.documentElement.setAttribute('data-theme', theme === 'system' ? getSystemTheme() : theme);
    }, [theme]);

    const setTheme = (newTheme: ThemeType) => {
        setThemeState(newTheme);
    };

    const toggleTheme = () => {
        if (theme === 'light') setThemeState('dark');
        else if (theme === 'dark') setThemeState('system');
        else setThemeState('light');
    };

    return (
        <ThemeContext.Provider value={{ theme, currentTheme, setTheme, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
};
