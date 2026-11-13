import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, FlatList } from 'react-native';
import RazorpayCheckout from 'react-native-razorpay';
import { getPlans, createOrder, verifyPayment, getRazorpayKey } from '../services/api';
import { useTheme } from '../context/ThemeContext';
import { getTheme } from '../theme/theme';

const SubscriptionScreen = ({ navigation, route }) => {
    const { salonId, user } = route.params;
    const { isDarkMode } = useTheme();
    const theme = getTheme(isDarkMode);
    const [plans, setPlans] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchPlans();
    }, []);

    const fetchPlans = async () => {
        try {
            const data = await getPlans();
            setPlans(data);
        } catch (error) {
            Alert.alert('Error', 'Failed to load plans');
        } finally {
            setLoading(false);
        }
    };

    const handlePayment = async (plan) => {
        try {
            // Get Razorpay Key from backend dynamically, fallback to test key
            let razorpayKey = 'rzp_test_SvFIhTF7eJoyzM';
            try {
                const key = await getRazorpayKey();
                if (key) razorpayKey = key;
            } catch (e) {
                console.log('Using fallback Razorpay key');
            }

            // 1. Create Order
            const order = await createOrder({ planId: plan._id, salonId });

            // 2. Open Razorpay
            const options = {
                description: `Subscription for ${plan.name}`,
                image: 'https://your-logo-url.com/logo.png', // Replace with your logo
                currency: 'INR',
                key: razorpayKey,
                amount: order.amount,
                name: 'Smart Salon',
                order_id: order.id,
                prefill: {
                    email: user.email,
                    contact: user.phone,
                    name: user.name
                },
                theme: { color: theme.colors.primary }
            };

            RazorpayCheckout.open(options).then(async (data) => {
                // 3. Verify Payment
                await verifyPayment({
                    ...data,
                    salonId,
                    planId: plan._id
                });
                Alert.alert('Success', 'Subscription Activated! 🎉');
                navigation.replace('SalonDashboard', { user, salon: { ...route.params.salon, isPaymentActive: true } });
            }).catch((error) => {
                Alert.alert('Payment Cancelled', error.message);
            });

        } catch (error) {
            Alert.alert('Error', 'Payment Initialization Failed');
        }
    };

    const renderPlan = ({ item }) => (
        <TouchableOpacity 
            style={[styles.card, { backgroundColor: theme.colors.surface }]}
            onPress={() => handlePayment(item)}
        >
            <Text style={[styles.planName, { color: theme.colors.text }]}>{item.name}</Text>
            <Text style={[styles.price, { color: theme.colors.primary }]}>₹{item.price}</Text>
            <Text style={[styles.duration, { color: theme.colors.textSecondary }]}>per {item.interval}</Text>
            <View style={styles.features}>
                {item.features && item.features.map((feature, index) => (
                    <Text key={index} style={[styles.feature, { color: theme.colors.textLight }]}>• {feature}</Text>
                ))}
            </View>
            <View style={[styles.btn, { backgroundColor: theme.colors.primary }]}>
                <Text style={styles.btnText}>Select Plan</Text>
            </View>
        </TouchableOpacity>
    );

    if (loading) return <ActivityIndicator size="large" color={theme.colors.primary} style={{ flex: 1 }} />;

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <Text style={[styles.title, { color: theme.colors.text }]}>Choose Business Plan</Text>
            <FlatList
                data={plans}
                renderItem={renderPlan}
                keyExtractor={item => item._id}
                contentContainerStyle={styles.list}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, padding: 20 },
    title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
    list: { paddingBottom: 20 },
    card: {
        borderRadius: 16,
        padding: 20,
        marginBottom: 16,
        elevation: 4,
    },
    planName: { fontSize: 22, fontWeight: 'bold', marginBottom: 8 },
    price: { fontSize: 28, fontWeight: 'bold', marginBottom: 4 },
    duration: { fontSize: 14, marginBottom: 16 },
    features: { marginBottom: 20 },
    feature: { fontSize: 14, marginBottom: 4 },
    btn: {
        paddingVertical: 12,
        borderRadius: 8,
        alignItems: 'center'
    },
    btnText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 }
});

export default SubscriptionScreen;
