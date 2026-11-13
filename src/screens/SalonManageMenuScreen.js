import React, { useRef, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    SafeAreaView,
    StatusBar,
    Animated,
    Dimensions,
    Image
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../context/ThemeContext';
import { getTheme } from '../theme/theme';

const { width } = Dimensions.get('window');

const SalonManageMenuScreen = ({ navigation, route }) => {
    const { isDarkMode } = useTheme();
    const theme = getTheme(isDarkMode);
    const { salon } = route.params || {};

    // Subtle Animation
    const fadeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true
        }).start();
    }, []);

    const menuItems = [
        {
            id: 'services',
            title: 'Services',
            icon: 'cut',
            color: '#7C4DFF',
            screen: 'ServiceManagement',
            bgColor: isDarkMode ? 'rgba(124, 77, 255, 0.2)' : '#F3E5F5'
        },
        {
            id: 'staff',
            title: 'Staff',
            icon: 'people',
            color: '#4CAF50',
            screen: 'ServiceManagement',
            params: { initialTab: 'Staff' },
            bgColor: isDarkMode ? 'rgba(76, 175, 80, 0.2)' : '#E8F5E9'
        },
        {
            id: 'facilities',
            title: 'Facilities',
            icon: 'business',
            color: '#FF9800',
            screen: 'Facilities',
            bgColor: isDarkMode ? 'rgba(255, 152, 0, 0.2)' : '#FFF3E0'
        },
        {
            id: 'customers',
            title: 'Customers & CRM',
            icon: 'people-circle-outline',
            color: '#0D9488',
            screen: 'CustomerList',
            bgColor: isDarkMode ? 'rgba(13, 148, 136, 0.2)' : '#CCFBF1'
        }
    ];

    const renderMenuTile = (item, index) => (
        <TouchableOpacity
            key={item.id}
            style={[styles.tileCard, { backgroundColor: theme.colors.surface }]}
            onPress={() => navigation.navigate(item.screen, { salon, ...(item.params || {}) })}
            activeOpacity={0.8}
        >
            <View style={[styles.iconBubble, { backgroundColor: item.bgColor }]}>
                <Ionicons name={item.icon} size={28} color={item.color} />
            </View>
            <Text style={[styles.tileTitle, { color: theme.colors.text }]}>{item.title}</Text>
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} backgroundColor={theme.colors.background} />

            {/* Simple Header */}
            <View style={[styles.header, { backgroundColor: theme.colors.background }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backBtn, { backgroundColor: theme.colors.surface }]}>
                    <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Manage Salon</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Salon Info Summary */}
                <View style={[styles.profileSummary, { backgroundColor: theme.colors.surface }]}>
                    <Image
                        source={{ uri: salon?.images?.[0] || 'https://ui-avatars.com/api/?name=Salon' }}
                        style={styles.avatar}
                    />
                    <View style={{ marginLeft: 12 }}>
                        <Text style={[styles.salonName, { color: theme.colors.text }]}>{salon?.name || 'My Salon'}</Text>
                        <Text style={[styles.salonSubtitle, { color: theme.colors.textSecondary }]}>{salon?.address || 'Manage your business'}</Text>
                    </View>
                </View>

                <Animated.View style={[styles.gridContainer, { opacity: fadeAnim }]}>
                    {menuItems.map(renderMenuTile)}
                </Animated.View>

            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 16,
    },
    backBtn: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 20,
        elevation: 2
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    scrollContent: {
        padding: 20,
    },
    profileSummary: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 20,
        marginBottom: 24,
        elevation: 2
    },
    avatar: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: '#EEE'
    },
    salonName: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    salonSubtitle: {
        fontSize: 12,
        marginTop: 2
    },
    gridContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        marginBottom: 24
    },
    tileCard: {
        width: '48%',
        borderRadius: 20,
        padding: 20,
        marginBottom: 16,
        alignItems: 'center',
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4
    },
    iconBubble: {
        width: 50,
        height: 50,
        borderRadius: 25,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12
    },
    tileTitle: {
        fontSize: 14,
        fontWeight: 'bold',
    },
    supportSection: {
        marginTop: 10
    },
    sectionHeader: {
        fontSize: 12,
        fontWeight: 'bold',
        marginBottom: 10,
        marginLeft: 4
    },
    supportRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 16,
        borderBottomWidth: 1,
        paddingHorizontal: 4
    },
    supportText: {
        fontSize: 15,
        fontWeight: '500'
    }
});

export default SalonManageMenuScreen;
