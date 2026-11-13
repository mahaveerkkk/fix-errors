import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { useColorScheme } from 'react-native';

// Defensive import for AsyncStorage to handle cases where native module is missing (needs rebuild)
let AsyncStorage: any = null;
try {
    AsyncStorage = require('@react-native-async-storage/async-storage').default;
} catch (e) {
    console.warn('AsyncStorage native module not found. Theme preference will not persist until app is rebuilt.');
}

interface ThemeContextType {
    isDarkMode: boolean;
    toggleTheme: () => Promise<void>;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const systemColorScheme = useColorScheme();
    const [isDarkMode, setIsDarkMode] = useState(systemColorScheme === 'dark');

    useEffect(() => {
        const loadTheme = async () => {
            if (!AsyncStorage) return;
            try {
                const savedTheme = await AsyncStorage.getItem('userTheme');
                if (savedTheme !== null) {
                    setIsDarkMode(savedTheme === 'dark');
                }
            } catch (error) {
                console.log('Failed to load theme preference', error);
            }
        };
        loadTheme();
    }, []);

    const toggleTheme = async () => {
        const newMode = !isDarkMode;
        setIsDarkMode(newMode);
        if (AsyncStorage) {
            try {
                await AsyncStorage.setItem('userTheme', newMode ? 'dark' : 'light');
            } catch (error) {
                console.log('Failed to save theme preference', error);
            }
        }
    };

    return (
        <ThemeContext.Provider value={{ isDarkMode, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (context === undefined) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
};
