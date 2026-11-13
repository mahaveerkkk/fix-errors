import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { getTheme } from '../../theme/theme';

const Card = ({ children, style, onPress, variant = 'elevated' }) => {
    const { isDarkMode } = useTheme();
    const theme = getTheme(isDarkMode);
    const Container = onPress ? TouchableOpacity : View;

    return (
        <Container
            style={[
                styles.container,
                { backgroundColor: theme.colors.background, borderRadius: theme.borderRadius.lg, padding: theme.spacing.md, marginBottom: theme.spacing.md },
                variant === 'elevated' && theme.shadows.sm,
                variant === 'outlined' && { borderWidth: 1, borderColor: theme.colors.border, elevation: 0, shadowOpacity: 0 },
                style
            ]}
            onPress={onPress}
            activeOpacity={onPress ? 0.7 : 1}
        >
            {children}
        </Container>
    );
};

const styles = StyleSheet.create({
    container: {
        // Base styles that don't depend on theme can stay here if needed
    }
});

export default Card;
