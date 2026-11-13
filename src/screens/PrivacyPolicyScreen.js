import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { getTheme } from '../theme/theme';
import ScreenWrapper from '../components/common/ScreenWrapper';
import Header from '../components/common/Header';

const PrivacyPolicyScreen = ({ navigation }) => {
    const { isDarkMode } = useTheme();
    const theme = getTheme(isDarkMode);

    const sections = [
        {
            title: '1. Information We Collect',
            content: 'We collect information you provide directly: name, email, phone number, profile photo, and location data. We also collect usage data including booking history, search queries, and app interactions to improve our services.'
        },
        {
            title: '2. How We Use Your Information',
            content: 'Your information is used to:\n• Provide and improve our services\n• Process bookings and payments\n• Send notifications about your appointments\n• Show nearby salons based on your location\n• Personalize your experience\n• Communicate important updates'
        },
        {
            title: '3. Location Data',
            content: 'We collect your device location to show nearby salons and calculate distances. Location access can be disabled in your device settings, but this may limit app functionality.'
        },
        {
            title: '4. Data Sharing',
            content: 'We share your basic information (name, phone) with salons when you make a booking. We do not sell your personal data to third parties. We may share anonymized data for analytics purposes.'
        },
        {
            title: '5. Firebase & Push Notifications',
            content: 'We use Firebase Cloud Messaging for push notifications about bookings, queue updates, and promotional offers. You can manage notification preferences in your device settings.'
        },
        {
            title: '6. Data Storage & Security',
            content: 'Your data is stored securely on MongoDB Atlas cloud servers with encryption at rest and in transit. We implement industry-standard security measures to protect your information. Passwords are hashed and never stored in plain text.'
        },
        {
            title: '7. Payment Information',
            content: 'Payment processing is handled by Razorpay. We do not store your credit/debit card details. All payment transactions are encrypted and processed through secure payment gateways.'
        },
        {
            title: '8. Your Rights',
            content: 'You have the right to:\n• Access your personal data\n• Update or correct your information\n• Delete your account and associated data\n• Opt out of marketing communications\n• Request data export'
        },
        {
            title: '9. Cookies & Tracking',
            content: 'Our mobile app does not use browser cookies. However, we may use analytics tools to understand app usage patterns and improve performance.'
        },
        {
            title: '10. Children\'s Privacy',
            content: 'StyleQ is not intended for children under 13 years of age. We do not knowingly collect personal information from children. If we discover such data, it will be deleted immediately.'
        },
        {
            title: '11. Changes to Privacy Policy',
            content: 'We may update this policy periodically. Users will be notified of significant changes via push notification or in-app message. Continued use after changes constitutes acceptance.'
        },
        {
            title: '12. Contact Us',
            content: 'For privacy-related queries or concerns:\nEmail: privacy@styleq.app\nSupport: Use the Help & Support section in the app'
        }
    ];

    return (
        <ScreenWrapper>
            <Header title="Privacy Policy" showBack />
            <ScrollView contentContainerStyle={styles.content}>
                <Text style={[styles.lastUpdated, { color: theme.colors.textLight }]}>
                    Last Updated: February 2026
                </Text>

                <Text style={[styles.intro, { color: theme.colors.textSecondary }]}>
                    At StyleQ, we are committed to protecting your privacy and ensuring the security of your personal information. This Privacy Policy explains how we collect, use, and safeguard your data.
                </Text>

                {sections.map((section, index) => (
                    <View key={index} style={styles.section}>
                        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                            {section.title}
                        </Text>
                        <Text style={[styles.sectionContent, { color: theme.colors.textSecondary }]}>
                            {section.content}
                        </Text>
                    </View>
                ))}

                <Text style={[styles.footer, { color: theme.colors.textLight }]}>
                    © 2026 StyleQ. All rights reserved.
                </Text>
            </ScrollView>
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    content: {
        padding: 20,
        paddingBottom: 40,
    },
    lastUpdated: {
        fontSize: 12,
        marginBottom: 12,
        fontStyle: 'italic',
    },
    intro: {
        fontSize: 14,
        lineHeight: 22,
        marginBottom: 24,
    },
    section: {
        marginBottom: 20,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '700',
        marginBottom: 8,
    },
    sectionContent: {
        fontSize: 14,
        lineHeight: 22,
    },
    footer: {
        marginTop: 20,
        fontSize: 12,
        textAlign: 'center',
    },
});

export default PrivacyPolicyScreen;
