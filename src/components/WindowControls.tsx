import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useTheme } from '../contexts/ThemeContext';

const WindowControls: React.FC = () => {
    const [_isMaximized, setIsMaximized] = useState(false);
    const { theme, toggleTheme } = useTheme();

    useEffect(() => {
        const checkMaximized = async () => {
            try {
                const maximized = await invoke<boolean>('window_is_maximized');
                setIsMaximized(maximized);
            } catch (error) {
                console.error('Failed to check window state:', error);
            }
        };

        checkMaximized();

        // We need to add window state listeners
        // This will be handled in Rust side
        const setupWindowListener = async () => {
            try {
                const unlisten = await invoke<() => void>('listen_window_events');
                return unlisten;
            } catch (error) {
                console.error('Failed to setup window listener:', error);
                return () => { };
            }
        };

        let unlisten: (() => void) | undefined;
        setupWindowListener().then(unlistenFn => {
            unlisten = unlistenFn;
        });

        // Poll window state every second as a fallback
        const intervalId = setInterval(checkMaximized, 1000);

        return () => {
            clearInterval(intervalId);
            if (unlisten) unlisten();
        };
    }, []);

    // const handleMinimize = async () => {
    //     try {
    //         await invoke('window_minimize');
    //     } catch (error) {
    //         console.error('Failed to minimize window:', error);
    //     }
    // };

    // const handleToggleMaximize = async () => {
    //     try {
    //         if (isMaximized) {
    //             await invoke('window_unmaximize');
    //         } else {
    //             await invoke('window_maximize');
    //         }
    //         // Update state after a small delay to allow the window to change
    //         setTimeout(async () => {
    //             const maximized = await invoke<boolean>('window_is_maximized');
    //             setIsMaximized(maximized);
    //         }, 100);
    //     } catch (error) {
    //         console.error('Failed to toggle maximize:', error);
    //     }
    // };

    // const handleClose = async () => {
    //     try {
    //         await invoke('window_close');
    //     } catch (error) {
    //         console.error('Failed to close window:', error);
    //     }
    // };

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
            {/* <div className="window-buttons">
                <button
                    className="window-button minimize"
                    onClick={handleMinimize}
                    aria-label="Minimize"
                >
                    <span className="window-icon">─</span>
                </button>
                <button
                    className="window-button maximize"
                    onClick={handleToggleMaximize}
                    aria-label={isMaximized ? "Restore" : "Maximize"}
                >
                    <span className="window-icon">{isMaximized ? '❐' : '□'}</span>
                </button>
                <button
                    className="window-button close"
                    onClick={handleClose}
                    aria-label="Close"
                >
                    <span className="window-icon">✕</span>
                </button>
            </div> */}
        </div>
    );
};

export default WindowControls;
