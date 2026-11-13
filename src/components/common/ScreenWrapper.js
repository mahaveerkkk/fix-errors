import React from 'react';
import { SafeAreaView, StatusBar, StyleSheet, View, Platform } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { getTheme } from '../../theme/theme';

const ScreenWrapper = ({ children, style, backgroundColor }) => {
    const { isDarkMode } = useTheme();
    const theme = getTheme(isDarkMode);

    return (
        <SafeAreaView style={[
            styles.container,
            { backgroundColor: backgroundColor || theme.colors.background },
            style
        ]}>
            <StatusBar
                barStyle={isDarkMode ? 'light-content' : 'dark-content'}
                backgroundColor={backgroundColor || theme.colors.background}
            />
            <View style={[styles.content, style]}>
                {children}
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        // Android SafeAreaView doesn't respect status bar — add padding manually
        paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) / 2 : 0,
    },
    content: {
        flex: 1,
    }
});

export default ScreenWrapper;
