import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { theme } from '../theme/theme';
import ScreenWrapper from '../components/common/ScreenWrapper';
import Header from '../components/common/Header';
import Card from '../components/common/Card';

const PaymentHistoryScreen = ({ navigation }) => {
    const [transactions, setTransactions] = useState([
        { id: '1', date: 'Today, 2:30 PM', amount: '850', customer: 'Anjali Singh', status: 'Settled', method: 'UPI' },
        { id: '2', date: 'Yesterday, 5:00 PM', amount: '450', customer: 'Rahul Sharma', status: 'Settled', method: 'Cash' },
        { id: '3', date: 'Yesterday, 11:00 AM', amount: '1200', customer: 'Priya Patel', status: 'Pending', method: 'Card' },
    ]);

    const renderTransactionItem = ({ item }) => (
        <Card style={styles.transactionCard}>
            <View style={styles.row}>
                <View style={[styles.iconBox, item.method === 'Cash' ? styles.cashIcon : styles.onlineIcon]}>
                    <Ionicons
                        name={item.method === 'Cash' ? 'cash-outline' : 'card-outline'}
                        size={24}
                        color={item.method === 'Cash' ? '#2E7D32' : '#1565C0'}
                    />
                </View>
                <View style={styles.info}>
                    <Text style={styles.customerName}>{item.customer}</Text>
                    <Text style={styles.dateText}>{item.date}</Text>
                </View>
                <View style={styles.amountContainer}>
                    <Text style={styles.amountText}>+ ₹{item.amount}</Text>
                    <Text style={[styles.statusText, item.status === 'Pending' ? styles.pending : styles.settled]}>
                        {item.status}
                    </Text>
                </View>
            </View>
        </Card>
    );

    return (
        <ScreenWrapper>
            <Header title="Payments & Settlements" showBack />

            <View style={styles.summaryContainer}>
                <View style={styles.summaryCard}>
                    <Text style={styles.summaryLabel}>Total Earnings</Text>
                    <Text style={styles.summaryValue}>₹45,200</Text>
                </View>
                <View style={styles.summaryCard}>
                    <Text style={styles.summaryLabel}>Pending Settlement</Text>
                    <Text style={[styles.summaryValue, { color: '#F57C00' }]}>₹1,200</Text>
                </View>
            </View>

            <Text style={styles.sectionTitle}>Recent Transactions</Text>

            <FlatList
                data={transactions}
                renderItem={renderTransactionItem}
                keyExtractor={item => item.id}
                contentContainerStyle={styles.listContent}
            />
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    summaryContainer: {
        flexDirection: 'row',
        padding: 16,
        justifyContent: 'space-between',
    },
    summaryCard: {
        width: '48%',
        backgroundColor: theme.colors.primary,
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
    },
    summaryLabel: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: 12,
        marginBottom: 4,
    },
    summaryValue: {
        color: '#FFF',
        fontSize: 20,
        fontWeight: 'bold',
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: theme.colors.text,
        marginLeft: 16,
        marginBottom: 12,
    },
    listContent: {
        paddingHorizontal: 16,
        paddingBottom: 20,
    },
    transactionCard: {
        marginBottom: 12,
        padding: 16,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    iconBox: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    cashIcon: {
        backgroundColor: '#E8F5E9',
    },
    onlineIcon: {
        backgroundColor: '#E3F2FD',
    },
    info: {
        flex: 1,
    },
    customerName: {
        fontSize: 16,
        fontWeight: 'bold',
        color: theme.colors.text,
        marginBottom: 4,
    },
    dateText: {
        fontSize: 12,
        color: theme.colors.textSecondary,
    },
    amountContainer: {
        alignItems: 'flex-end',
    },
    amountText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: theme.colors.success,
        marginBottom: 4,
    },
    statusText: {
        fontSize: 10,
        fontWeight: 'bold',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        overflow: 'hidden',
    },
    settled: {
        backgroundColor: '#E8F5E9',
        color: '#2E7D32',
    },
    pending: {
        backgroundColor: '#FFF3E0',
        color: '#F57C00',
    }
});

export default PaymentHistoryScreen;
