import { useTheme } from '../contexts/ThemeContext';

const WindowControls: React.FC = () => {
    const { theme, toggleTheme } = useTheme();

    // Display the current theme icon based on theme state
    const getThemeIcon = () => {
        if (theme === 'light') return '☀️';
        if (theme === 'dark') return '🌙';
        return '🔄'; // system
    };

    return (
        <div className="window-controls">
            <button
                className="theme-toggle"
                onClick={toggleTheme}
                aria-label="Toggle theme"
            >
                {getThemeIcon()}
            </button>
        </div>
    );
};

export default WindowControls;
