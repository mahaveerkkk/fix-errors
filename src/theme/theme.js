const lightColors = {
    primary: '#1A1A1A',
    secondary: '#D4AF37',
    background: '#FFFFFF',
    surface: '#F8F9FA',
    surfaceHighlight: '#F0F0F0',
    text: '#1A1A1A',
    textSecondary: '#666666',
    textLight: '#999999',
    textInverse: '#FFFFFF',
    success: '#2E7D32',
    error: '#C62828',
    warning: '#F9A825',
    info: '#1565C0',
    border: '#E0E0E0',
    divider: '#EEEEEE',
    backdrop: 'rgba(0, 0, 0, 0.5)',
};

const darkColors = {
    primary: '#D4AF37', // Gold becomes more prominent in dark mode
    secondary: '#1A1A1A',
    background: '#121212',
    surface: '#1E1E1E',
    surfaceHighlight: '#2C2C2C',
    text: '#FFFFFF',
    textSecondary: '#B0B0B0',
    textLight: '#808080',
    textInverse: '#121212',
    success: '#4CAF50',
    error: '#EF5350',
    warning: '#FFCA28',
    info: '#42A5F5',
    border: '#333333',
    divider: '#2C2C2C',
    backdrop: 'rgba(0, 0, 0, 0.7)',
};

export const getTheme = (isDarkMode) => ({
    colors: isDarkMode ? darkColors : lightColors,
    typography: {
        fontFamily: {
            regular: 'System',
            medium: 'System',
            bold: 'System',
        },
        size: {
            xs: 10,
            sm: 12,
            md: 14,
            lg: 16,
            xl: 18,
            xxl: 24,
            xxxl: 32,
        },
    },
    spacing: {
        xs: 4,
        sm: 8,
        md: 16,
        lg: 24,
        xl: 32,
        xxl: 48,
    },
    borderRadius: {
        sm: 8,
        md: 12,
        lg: 16,
        xl: 24,
        round: 9999,
    },
    shadows: {
        sm: {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: isDarkMode ? 0.3 : 0.05,
            shadowRadius: 2,
            elevation: 2,
        },
        md: {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: isDarkMode ? 0.4 : 0.1,
            shadowRadius: 4,
            elevation: 4,
        },
        lg: {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: isDarkMode ? 0.5 : 0.15,
            shadowRadius: 8,
            elevation: 8,
        },
    }
});

// For backward compatibility while refactoring
export const theme = getTheme(false);
