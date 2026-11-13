import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../context/ThemeContext';
import { getTheme } from '../../theme/theme';

const Header = ({ title, showBack = false, rightComponent }) => {
    const navigation = useNavigation();
    const { isDarkMode } = useTheme();
    const theme = getTheme(isDarkMode);

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.background, borderBottomColor: theme.colors.divider }]}>
            <View style={styles.leftContainer}>
                {showBack && (
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                        <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
                    </TouchableOpacity>
                )}
                <Text style={[styles.title, { color: theme.colors.text, fontSize: theme.typography.size.xl }]}>{title}</Text>
            </View>
            <View style={styles.rightContainer}>
                {rightComponent}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 24,
        paddingVertical: 16,
        borderBottomWidth: 1,
    },
    leftContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    backButton: {
        marginRight: 16,
    },
    title: {
        fontWeight: 'bold',
    },
    rightContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    }
});

export default Header;
