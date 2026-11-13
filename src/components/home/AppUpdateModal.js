import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Linking, Image } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../../context/ThemeContext';
import { getTheme } from '../../theme/theme';
import Button from '../common/Button';
import { getAppConfig } from '../../services/api';

// For this demo, let's assume the current app version is 0.0.1
const CURRENT_VERSION = "0.0.1";

const AppUpdateModal = () => {
    const { isDarkMode } = useTheme();
    const theme = getTheme(isDarkMode);

    const [visible, setVisible] = useState(false);
    const [config, setConfig] = useState(null);

    useEffect(() => {
        const fetchConfig = async () => {
            try {
                const response = await getAppConfig();
                if (response?.data) {
                    setConfig(response.data);
                    // Compare versions - simplistic string check for demo
                    // In a real app, use a semver library or precise comparison
                    if (response.data.latestVersion !== CURRENT_VERSION) {
                        // User request: Keeping logic intact for future Admin Panel,
                        // but HIDING the UI for now until we are ready
                        // setVisible(true);
                    }
                }
            } catch (error) {
            }
        };

        fetchConfig();
    }, []);

    const handleUpdate = () => {
        if (config?.updateUrl) {
            Linking.openURL(config.updateUrl).catch(() => { });
        }
    };

    const handleClose = () => {
        if (!config?.forceUpdate) {
            setVisible(false);
        }
    };

    if (!visible || !config) return null;

    return (
        <Modal
            transparent
            visible={visible}
            animationType="fade"
            onRequestClose={handleClose}
        >
            <View style={styles.overlay}>
                <View style={[styles.modalContainer, { backgroundColor: theme.colors.surface }]}>

                    {/* Header Image or Icon representing Update */}
                    <View style={styles.iconContainer}>
                        <View style={[styles.iconCircle, { backgroundColor: theme.colors.primary + '15' }]}>
                            <Ionicons name="rocket" size={40} color={theme.colors.primary} />
                        </View>
                    </View>

                    <Text style={[styles.title, { color: theme.colors.text }]}>Update Available!</Text>

                    <Text style={[styles.message, { color: theme.colors.textSecondary }]}>
                        {config.updateMessage || `A new version (${config.latestVersion}) is available. Please update to enjoy the latest features and improvements.`}
                    </Text>

                    <View style={styles.buttonContainer}>
                        <Button
                            title="Update Now"
                            onPress={handleUpdate}
                            style={styles.updateButton}
                        />

                        {!config.forceUpdate && (
                            <TouchableOpacity onPress={handleClose} style={styles.laterButton}>
                                <Text style={[styles.laterText, { color: theme.colors.textLight }]}>Maybe Later</Text>
                            </TouchableOpacity>
                        )}
                    </View>

                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    modalContainer: {
        width: '100%',
        borderRadius: 24,
        padding: 24,
        alignItems: 'center',
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
    },
    iconContainer: {
        alignItems: 'center',
        marginBottom: 20,
        marginTop: 10,
    },
    iconCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    title: {
        fontSize: 22,
        fontWeight: 'bold',
        marginBottom: 12,
        textAlign: 'center',
    },
    message: {
        fontSize: 15,
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 24,
    },
    buttonContainer: {
        width: '100%',
        gap: 12,
    },
    updateButton: {
        width: '100%',
        paddingVertical: 16,
        borderRadius: 16,
    },
    laterButton: {
        paddingVertical: 12,
        alignItems: 'center',
    },
    laterText: {
        fontSize: 15,
        fontWeight: '600',
    }
});

export default AppUpdateModal;
