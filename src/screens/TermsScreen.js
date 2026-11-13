import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { getTheme } from '../theme/theme';
import ScreenWrapper from '../components/common/ScreenWrapper';
import Header from '../components/common/Header';

const TermsScreen = ({ navigation }) => {
    const { isDarkMode } = useTheme();
    const theme = getTheme(isDarkMode);

    const sections = [
        {
            title: '1. Acceptance of Terms',
            content: 'By accessing and using the StyleQ application, you agree to be bound by these Terms of Service. If you do not agree with any part of these terms, you may not use our services.'
        },
        {
            title: '2. Description of Service',
            content: 'StyleQ is a salon booking and queue management platform that connects users with nearby salons. Our services include online booking, real-time queue tracking, and salon management tools.'
        },
        {
            title: '3. User Accounts',
            content: 'You must create an account to use our services. You are responsible for maintaining the confidentiality of your account credentials. You must provide accurate and complete information during registration.'
        },
        {
            title: '4. Booking & Cancellation',
            content: 'Bookings are subject to salon availability and confirmation. Cancellations must be made before your turn arrives. Repeated no-shows may result in account restrictions. Salon owners have the right to accept or reject bookings.'
        },
        {
            title: '5. Payments',
            content: 'All payments are processed through secure third-party payment gateways. Prices displayed are set by individual salons. StyleQ is not responsible for pricing discrepancies. Refunds are subject to salon policies.'
        },
        {
            title: '6. User Conduct',
            content: 'Users must not misuse the platform, post false reviews, create multiple accounts, or engage in any fraudulent activity. Violation may result in immediate account suspension.'
        },
        {
            title: '7. Reviews & Ratings',
            content: 'Users can rate and review salons after service completion. Reviews must be honest and based on actual experience. StyleQ reserves the right to remove reviews that violate our community guidelines.'
        },
        {
            title: '8. Salon Owner Responsibilities',
            content: 'Salon owners must maintain accurate service listings, pricing, and availability. They must provide services as described and maintain hygiene and safety standards.'
        },
        {
            title: '9. Limitation of Liability',
            content: 'StyleQ acts as an intermediary platform and is not liable for the quality of services provided by salons. We are not responsible for any disputes between users and salon owners.'
        },
        {
            title: '10. Changes to Terms',
            content: 'We reserve the right to update these terms at any time. Continued use of the app after changes constitutes acceptance of the new terms. Users will be notified of significant changes.'
        },
        {
            title: '11. Contact',
            content: 'For questions about these Terms of Service, contact us at support@styleq.app'
        }
    ];

    return (
        <ScreenWrapper>
            <Header title="Terms of Service" showBack />
            <ScrollView contentContainerStyle={styles.content}>
                <Text style={[styles.lastUpdated, { color: theme.colors.textLight }]}>
                    Last Updated: February 2026
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
        marginBottom: 20,
        fontStyle: 'italic',
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

export default TermsScreen;
