import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { getTheme } from '../../theme/theme';

const Badge = ({ label, color, textColor, size = 'md' }) => {
    const { isDarkMode } = useTheme();
    const theme = getTheme(isDarkMode);

    const defaultColor = theme.colors.primary;
    const defaultTextColor = theme.colors.textInverse;

    return (
        <View style={[styles.container, { backgroundColor: color || defaultColor, borderRadius: theme.borderRadius.round }]}>
            <Text style={[styles.text, { color: textColor || defaultTextColor, fontSize: size === 'sm' ? 10 : 12 }]}>
                {label}
            </Text>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        alignSelf: 'flex-start',
    },
    text: {
        fontWeight: 'bold',
        textTransform: 'uppercase',
    }
});

export default Badge;
