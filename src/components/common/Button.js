import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { getTheme } from '../../theme/theme';

const Button = ({
    title,
    onPress,
    variant = 'primary', // primary, secondary, outline, text
    size = 'md', // sm, md, lg
    disabled = false,
    loading = false,
    style,
    textStyle,
    icon
}) => {
    const { isDarkMode } = useTheme();
    const theme = getTheme(isDarkMode);

    const getBackgroundColor = () => {
        if (disabled) return theme.colors.surfaceHighlight;
        switch (variant) {
            case 'primary': return theme.colors.primary;
            case 'secondary': return theme.colors.secondary;
            case 'outline': return 'transparent';
            case 'text': return 'transparent';
            default: return theme.colors.primary;
        }
    };

    const getTextColor = () => {
        if (disabled) return theme.colors.textLight;
        switch (variant) {
            case 'primary': return theme.colors.textInverse;
            case 'secondary': return theme.colors.textInverse;
            case 'outline': return theme.colors.primary;
            case 'text': return theme.colors.primary;
            default: return theme.colors.textInverse;
        }
    };

    const getBorder = () => {
        if (variant === 'outline') return { borderWidth: 1, borderColor: theme.colors.primary };
        return {};
    };

    const getPadding = () => {
        switch (size) {
            case 'sm': return { paddingVertical: 8, paddingHorizontal: 16 };
            case 'md': return { paddingVertical: 12, paddingHorizontal: 24 };
            case 'lg': return { paddingVertical: 16, paddingHorizontal: 32 };
            default: return { paddingVertical: 12, paddingHorizontal: 24 };
        }
    };

    const getFontSize = () => {
        switch (size) {
            case 'sm': return theme.typography.size.sm;
            case 'md': return theme.typography.size.md;
            case 'lg': return theme.typography.size.lg;
            default: return theme.typography.size.md;
        }
    };

    return (
        <TouchableOpacity
            onPress={onPress}
            disabled={disabled || loading}
            style={[
                styles.container,
                { backgroundColor: getBackgroundColor(), borderRadius: theme.borderRadius.md },
                getBorder(),
                getPadding(),
                style
            ]}
        >
            {loading ? (
                <ActivityIndicator color={getTextColor()} />
            ) : (
                <>
                    {icon && icon}
                    <Text style={[
                        styles.text,
                        { color: getTextColor(), fontSize: getFontSize() },
                        icon && { marginLeft: 8 },
                        textStyle
                    ]}>
                        {title}
                    </Text>
                </>
            )}
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
    },
    text: {
        fontWeight: '600',
        letterSpacing: 0.5,
    }
});

export default Button;
