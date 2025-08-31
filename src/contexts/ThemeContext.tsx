import React, { createContext, useContext, useState, useEffect } from 'react';

// Theme types
export type ThemeType = 'light' | 'dark' | 'system';

// Tailwind class-based theme configurations
export const themes = {
    light: {
        bg: 'bg-gray-50',
        card: 'bg-white',
        cardHover: 'hover:bg-gray-100',
        sidebar: 'bg-white',
        text: 'text-gray-900',
        textSecondary: 'text-gray-600',
        textMuted: 'text-gray-500',
        border: 'border-gray-200',
        input: 'bg-white border-gray-300',
        button: 'bg-blue-500 hover:bg-blue-600',
    },
    dark: {
        bg: 'bg-gray-900',
        card: 'bg-gray-800',
        cardHover: 'hover:bg-gray-700',
        sidebar: 'bg-gray-800',
        text: 'text-white',
        textSecondary: 'text-gray-300',
        textMuted: 'text-gray-400',
        border: 'border-gray-700',
        input: 'bg-gray-700 border-gray-600',
        button: 'bg-blue-600 hover:bg-blue-700',
    },
};

// Also keep CSS variables for compatibility
export const cssVariables = {
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
    currentCssVariables: typeof cssVariables.light;
    setTheme: (theme: ThemeType) => void;
    toggleTheme: () => void;
    isDark: boolean;
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

    const getActualCssVariables = () => {
        if (theme === 'system') {
            return getSystemTheme() === 'dark' ? cssVariables.dark : cssVariables.light;
        }
        return theme === 'dark' ? cssVariables.dark : cssVariables.light;
    };

    const isDark = () => {
        if (theme === 'system') {
            return getSystemTheme() === 'dark';
        }
        return theme === 'dark';
    };

    const [currentTheme, setCurrentTheme] = useState(getActualTheme());
    const [currentCssVariables, setCurrentCssVariables] = useState(getActualCssVariables());

    // Listen for system theme changes
    useEffect(() => {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

        const handleChange = () => {
            if (theme === 'system') {
                setCurrentTheme(getSystemTheme() === 'dark' ? themes.dark : themes.light);
                setCurrentCssVariables(getSystemTheme() === 'dark' ? cssVariables.dark : cssVariables.light);
            }
        };

        mediaQuery.addEventListener('change', handleChange);
        return () => mediaQuery.removeEventListener('change', handleChange);
    }, [theme]);

    // Update theme when it changes
    useEffect(() => {
        setCurrentTheme(getActualTheme());
        setCurrentCssVariables(getActualCssVariables());
        localStorage.setItem('crewcast-theme', theme);

        // Update CSS variables
        const root = document.documentElement;
        const themeColors = getActualCssVariables();

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
        <ThemeContext.Provider 
            value={{ 
                theme, 
                currentTheme, 
                currentCssVariables,
                setTheme, 
                toggleTheme,
                isDark: isDark()
            }}
        >
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
