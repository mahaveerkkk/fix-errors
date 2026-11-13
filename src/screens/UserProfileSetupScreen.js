import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    SafeAreaView,
    Alert,
    ActivityIndicator,
    StatusBar,
    Image,
    ScrollView
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from '../theme/colors';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { updateUserProfile } from '../services/api';

const UserProfileSetupScreen = ({ route, navigation }) => {
    const { user } = route.params;

    const [name, setName] = useState(user.name || '');
    const [phone, setPhone] = useState(user.phone || '');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async () => {
        // Validation
        if (!name || name.length < 3) {
            Alert.alert('Invalid Name', 'Name must be at least 3 characters.');
            return;
        }
        if (!phone || phone.length !== 10) {
            Alert.alert('Invalid Phone', 'Please enter a valid 10-digit phone number.');
            return;
        }

        setLoading(true);
        try {
            // Call API to update user
            await updateUserProfile(user._id || user.id, {
                name,
                phone
            });

            // Cache updated user data for offline login
            const updatedUser = { ...user, name, phone };
            try {
                await AsyncStorage.setItem('cachedUser', JSON.stringify(updatedUser));
            } catch (cacheErr) { /* ignore cache errors */ }

            // Navigate to Home
            navigation.replace('UserHome', { user: updatedUser });

        } catch (error) {
            Alert.alert('Update Failed', error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#f8f9fa" />

            <ScrollView contentContainerStyle={styles.content}>

                <View style={styles.header}>
                    <Text style={styles.title}>Welcome, {name.split(' ')[0]}! 👋</Text>
                    <Text style={styles.subtitle}>Let's finish setting up your profile.</Text>
                </View>

                {/* Profile Photo */}
                <View style={styles.avatarContainer}>
                    {user.profilePhoto ? (
                        <Image source={{ uri: user.profilePhoto }} style={styles.avatar} />
                    ) : (
                        <View style={[styles.avatar, styles.placeholderAvatar]}>
                            <Text style={styles.avatarText}>{name.charAt(0)}</Text>
                        </View>
                    )}
                    <View style={styles.editBadge}>
                        <Ionicons name="camera" size={14} color="#fff" />
                    </View>
                </View>

                <View style={styles.formCard}>

                    {/* Name Input */}
                    <Text style={styles.label}>Full Name</Text>
                    <TextInput
                        style={styles.input}
                        value={name}
                        onChangeText={setName}
                        placeholder="Your Name"
                    />

                    {/* Phone Input */}
                    <Text style={styles.label}>Phone Number</Text>
                    <TextInput
                        style={styles.input}
                        value={phone}
                        onChangeText={setPhone}
                        placeholder="10-digit Mobile Number"
                        keyboardType="phone-pad"
                        maxLength={10}
                    />

                    {/* Submit Button */}
                    <TouchableOpacity style={styles.submitButton} onPress={handleSubmit} disabled={loading}>
                        {loading ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={styles.submitButtonText}>Continue to App 🚀</Text>
                        )}
                    </TouchableOpacity>

                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8f9fa',
    },
    content: {
        flexGrow: 1,
        padding: 24,
        alignItems: 'center'
    },
    header: {
        marginTop: 40,
        marginBottom: 30,
        alignItems: 'center'
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 8
    },
    subtitle: {
        fontSize: 16,
        color: '#666'
    },
    avatarContainer: {
        marginBottom: 30,
        position: 'relative'
    },
    avatar: {
        width: 100,
        height: 100,
        borderRadius: 50,
        borderWidth: 3,
        borderColor: '#fff',
    },
    placeholderAvatar: {
        backgroundColor: colors.primary,
        justifyContent: 'center',
        alignItems: 'center'
    },
    avatarText: {
        fontSize: 36,
        color: '#fff',
        fontWeight: 'bold'
    },
    editBadge: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        backgroundColor: '#333',
        width: 30,
        height: 30,
        borderRadius: 15,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#fff'
    },
    formCard: {
        width: '100%',
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 24,
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: '#333',
        marginBottom: 8,
        marginTop: 12
    },
    input: {
        backgroundColor: '#f8f9fa',
        borderWidth: 1,
        borderColor: '#e0e0e0',
        borderRadius: 12,
        padding: 14,
        fontSize: 16,
        color: '#333'
    },
    submitButton: {
        backgroundColor: colors.primary,
        padding: 16,
        borderRadius: 16,
        alignItems: 'center',
        marginTop: 30,
        elevation: 3
    },
    submitButtonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold'
    }
});

export default UserProfileSetupScreen;
