import React, { useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Easing } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useNavigation, useRoute } from '@react-navigation/native';

const SalonBottomBar = ({ salon }) => {
    const navigation = useNavigation();
    const route = useRoute();
    const currentRoute = route.name;

    // Animation refs for each tab
    const homeScale = useRef(new Animated.Value(1)).current;
    const shopScale = useRef(new Animated.Value(1)).current;
    const settingsScale = useRef(new Animated.Value(1)).current;

    const animatePress = (scaleRef, callback) => {
        Animated.sequence([
            Animated.timing(scaleRef, {
                toValue: 0.9,
                duration: 100,
                easing: Easing.ease,
                useNativeDriver: true
            }),
            Animated.spring(scaleRef, {
                toValue: 1,
                friction: 4,
                tension: 100,
                useNativeDriver: true
            })
        ]).start();

        setTimeout(callback, 50);
    };

    const navigateTo = (screen, params = {}) => {
        navigation.navigate(screen, { salon, ...params });
    };

    const isHomeActive = currentRoute === 'SalonDashboard';
    const isSettingsActive = currentRoute.includes('Manage') ||
        currentRoute === 'ServiceManagement' ||
        currentRoute === 'SalonProfile' ||
        currentRoute === 'SalonManageMenu';

    return (
        <View style={styles.bottomBar}>
            {/* Decorative blur/glow effect */}
            <View style={styles.glowEffect} />

            {/* Home Tab */}
            <Animated.View style={{ transform: [{ scale: homeScale }] }}>
                <TouchableOpacity
                    style={styles.navItem}
                    activeOpacity={0.7}
                    onPress={() => animatePress(homeScale, () => navigateTo('SalonDashboard'))}
                >
                    <View style={[styles.iconContainer, isHomeActive && styles.activeIconContainer]}>
                        <Ionicons
                            name={isHomeActive ? "grid" : "grid-outline"}
                            size={22}
                            color={isHomeActive ? "#4CAF50" : "#9CA3AF"}
                        />
                    </View>
                    <Text style={[styles.navLabel, isHomeActive && styles.navLabelActive]}>Home</Text>
                </TouchableOpacity>
            </Animated.View>

            {/* Main Prominent 'Open Shop' FAB Button */}
            <Animated.View style={[styles.fabContainer, { transform: [{ scale: shopScale }] }]}>
                <TouchableOpacity
                    style={styles.openShopBtn}
                    activeOpacity={0.85}
                    onPress={() => animatePress(shopScale, () => navigateTo('SalonLiveMode', { salonId: salon?._id || salon, salon }))}
                >
                    <View style={styles.fabGlow} />
                    <View style={styles.openShopIcon}>
                        <Ionicons name="storefront" size={26} color="#FFF" />
                    </View>
                </TouchableOpacity>
                <Text style={styles.openShopText}>Open Shop</Text>
            </Animated.View>

            {/* Settings Tab */}
            <Animated.View style={{ transform: [{ scale: settingsScale }] }}>
                <TouchableOpacity
                    style={styles.navItem}
                    activeOpacity={0.7}
                    onPress={() => animatePress(settingsScale, () => navigateTo('SalonManageMenu'))}
                >
                    <View style={[styles.iconContainer, isSettingsActive && styles.activeIconContainer]}>
                        <Ionicons
                            name={isSettingsActive ? "settings" : "settings-outline"}
                            size={22}
                            color={isSettingsActive ? "#4CAF50" : "#9CA3AF"}
                        />
                    </View>
                    <Text style={[styles.navLabel, isSettingsActive && styles.navLabelActive]}>Settings</Text>
                </TouchableOpacity>
            </Animated.View>
        </View>
    );
};

const styles = StyleSheet.create({
    bottomBar: {
        position: 'absolute',
        bottom: 20,
        left: 20,
        right: 20,
        backgroundColor: '#FFFFFF',
        borderRadius: 28,
        height: 72,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-around',
        paddingHorizontal: 8,
        // Enhanced shadow
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 24,
        elevation: 12,
        zIndex: 100,
        // Subtle border
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.04)'
    },
    glowEffect: {
        position: 'absolute',
        top: -2,
        left: 20,
        right: 20,
        height: 4,
        backgroundColor: 'rgba(76, 175, 80, 0.1)',
        borderRadius: 2
    },
    navItem: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 8,
        paddingHorizontal: 16,
        minWidth: 70
    },
    iconContainer: {
        width: 40,
        height: 40,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'transparent'
    },
    activeIconContainer: {
        backgroundColor: 'rgba(76, 175, 80, 0.12)'
    },
    navLabel: {
        color: '#9CA3AF',
        fontSize: 11,
        fontWeight: '600',
        marginTop: 4,
        letterSpacing: 0.3
    },
    navLabelActive: {
        color: '#4CAF50',
        fontWeight: '700'
    },
    fabContainer: {
        alignItems: 'center',
        marginTop: -35,
        zIndex: 101
    },
    openShopBtn: {
        position: 'relative',
        alignItems: 'center',
        justifyContent: 'center'
    },
    fabGlow: {
        position: 'absolute',
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: 'rgba(76, 175, 80, 0.25)',
        transform: [{ scale: 1.1 }]
    },
    openShopIcon: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: '#4CAF50',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 4,
        borderColor: '#FFFFFF',
        // Enhanced shadow for FAB
        shadowColor: "#4CAF50",
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
        elevation: 10
    },
    openShopText: {
        color: '#4CAF50',
        fontSize: 11,
        fontWeight: '700',
        marginTop: 6,
        letterSpacing: 0.3
    }
});

export default SalonBottomBar;
