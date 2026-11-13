import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../../context/ThemeContext';
import { getTheme } from '../../theme/theme';

const Rating = ({ rating, count, showCount = true, size = 14 }) => {
    const { isDarkMode } = useTheme();
    const theme = getTheme(isDarkMode);

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.surface }]}>
            <Ionicons name="star" size={size} color="#FFD700" />
            <Text style={[styles.rating, { fontSize: size, color: theme.colors.text }]}>{rating}</Text>
            {showCount && <Text style={[styles.count, { color: theme.colors.textLight }]}>({count})</Text>}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        alignSelf: 'flex-start',
    },
    rating: {
        fontWeight: 'bold',
        marginLeft: 4,
    },
    count: {
        marginLeft: 4,
        fontSize: 12,
    }
});

export default Rating;
