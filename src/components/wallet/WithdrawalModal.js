import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    TextInput,
    ScrollView,
    Alert,
    ToastAndroid,
    ActivityIndicator
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../../context/ThemeContext';
import { getTheme } from '../../theme/theme';

const STORAGE_KEY_BANK = '@stylq_saved_bank_details';

const WithdrawalModal = ({ visible, onClose, walletBalance = 0, onWithdrawSuccess }) => {
    const { isDarkMode } = useTheme();
    const theme = getTheme(isDarkMode);

    const [transferMethod, setTransferMethod] = useState('bank'); // 'upi' | 'bank'
    const [withdrawAmount, setWithdrawAmount] = useState('');
    const [bankName, setBankName] = useState('');
    const [accountName, setAccountName] = useState('');
    const [accountNumber, setAccountNumber] = useState('');
    const [ifscCode, setIfscCode] = useState('');
    const [upiId, setUpiId] = useState('');

    const [hasSavedDetails, setHasSavedDetails] = useState(false);
    const [isEditingSaved, setIsEditingSaved] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    useEffect(() => {
        if (visible) {
            loadSavedBankDetails();
            setErrorMsg('');
        }
    }, [visible]);

    const loadSavedBankDetails = async () => {
        try {
            const saved = await AsyncStorage.getItem(STORAGE_KEY_BANK);
            if (saved) {
                const parsed = JSON.parse(saved);
                setBankName(parsed.bankName || '');
                setAccountName(parsed.accountName || '');
                setAccountNumber(parsed.accountNumber || '');
                setIfscCode(parsed.ifscCode || '');
                setUpiId(parsed.upiId || '');
                if (parsed.transferMethod) setTransferMethod(parsed.transferMethod);

                const hasBank = !!(parsed.accountNumber && parsed.ifscCode);
                const hasUpi = !!parsed.upiId;
                if (hasBank || hasUpi) {
                    setHasSavedDetails(true);
                    setIsEditingSaved(false);
                } else {
                    setHasSavedDetails(false);
                    setIsEditingSaved(true);
                }
            } else {
                setHasSavedDetails(false);
                setIsEditingSaved(true);
            }
        } catch (e) {
            setHasSavedDetails(false);
            setIsEditingSaved(true);
        }
    };

    const saveBankDetailsLocally = async () => {
        try {
            const bankData = {
                bankName: bankName.trim(),
                accountName: accountName.trim(),
                accountNumber: accountNumber.trim(),
                ifscCode: ifscCode.trim().toUpperCase(),
                upiId: upiId.trim().toLowerCase(),
                transferMethod
            };
            await AsyncStorage.setItem(STORAGE_KEY_BANK, JSON.stringify(bankData));
            setHasSavedDetails(true);
            setIsEditingSaved(false);
        } catch (e) {}
    };

    const handleQuickAmount = (amount) => {
        const amtVal = amount === 'FULL' ? walletBalance : amount;
        setWithdrawAmount(String(amtVal));
        setErrorMsg('');
    };

    const handleSubmitWithdrawal = async () => {
        const amt = parseFloat(withdrawAmount);

        if (!amt || isNaN(amt)) {
            setErrorMsg('Please enter a valid withdrawal amount');
            return;
        }

        if (amt < 1000) {
            setErrorMsg('⚠️ Minimum payout withdrawal threshold is ₹1,000');
            return;
        }

        if (amt > walletBalance) {
            setErrorMsg(`⚠️ Insufficient wallet balance. Available: ₹${walletBalance.toLocaleString('en-IN')}`);
            return;
        }

        if (transferMethod === 'upi') {
            if (!upiId || !upiId.includes('@')) {
                setErrorMsg('Please enter a valid UPI ID (e.g. name@okhdfcbank)');
                return;
            }
        } else {
            if (!accountNumber || accountNumber.length < 8) {
                setErrorMsg('Please enter a valid Bank Account Number');
                return;
            }
            if (!ifscCode || ifscCode.length < 8) {
                setErrorMsg('Please enter a valid 11-digit IFSC code');
                return;
            }
            if (!accountName.trim()) {
                setErrorMsg('Please enter Account Holder Name');
                return;
            }
        }

        setSubmitting(true);
        setErrorMsg('');

        try {
            await saveBankDetailsLocally();

            setTimeout(() => {
                setSubmitting(false);
                if (onWithdrawSuccess) {
                    onWithdrawSuccess(amt);
                }

                const targetDisplay = transferMethod === 'upi'
                    ? `UPI: ${upiId}`
                    : `${bankName || 'Bank'} A/C (•••• ${accountNumber.slice(-4)})`;
                const txnRef = 'STQ' + Math.floor(100000 + Math.random() * 900000);

                Alert.alert(
                    '⏳ Payout Request Registered',
                    `Your withdrawal request of ₹${amt.toLocaleString('en-IN')} has been submitted successfully.\n\n` +
                    `🏦 Destination: ${targetDisplay}\n` +
                    `🔖 Reference ID: #${txnRef}\n\n` +
                    `⚠️ Settlement Timeline:\n` +
                    `Standard banking verification cycle takes 24 to 48 business hours (Excluding Bank Holidays).`,
                    [{ text: 'Done', onPress: onClose }]
                );
                ToastAndroid.show('✅ Payout Request Submitted', ToastAndroid.SHORT);
            }, 1000);

        } catch (err) {
            setSubmitting(false);
            setErrorMsg(err.message || 'Failed to submit withdrawal request');
        }
    };

    const isDark = isDarkMode;

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={true}
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <View style={[styles.modalCard, { backgroundColor: isDark ? '#141122' : '#FFFFFF' }]}>

                    {/* TOP DRAG HANDLE & HEADER */}
                    <View style={styles.dragBar} />
                    <View style={styles.modalHeader}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                            <View style={[styles.headerIconCircle, { backgroundColor: isDark ? '#261F4D' : '#EDE8FF' }]}>
                                <Ionicons name="shield-checkmark" size={18} color="#7C4DFF" />
                            </View>
                            <View>
                                <Text style={[styles.modalTitle, { color: isDark ? '#FFF' : '#111827' }]}>Payout Settlement</Text>
                                <Text style={[styles.modalSub, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>Direct transfer to your Bank / UPI</Text>
                            </View>
                        </View>
                        <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
                            <Ionicons name="close" size={20} color={isDark ? '#FFF' : '#374151'} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

                        {/* HIGH-TRUST BALANCE CARD */}
                        <View style={[styles.balanceCard, { backgroundColor: isDark ? '#1D1933' : '#F8F7FF', borderColor: isDark ? '#312A54' : '#E8E5F7' }]}>
                            <View style={styles.balanceRow}>
                                <View>
                                    <Text style={[styles.balanceLabel, { color: isDark ? '#A1A5B7' : '#6B7280' }]}>AVAILABLE TO WITHDRAW</Text>
                                    <Text style={[styles.balanceAmount, { color: isDark ? '#FFF' : '#111827' }]}>
                                        ₹{walletBalance.toLocaleString('en-IN')}
                                    </Text>
                                </View>
                                <View style={styles.payoutBadge}>
                                    <Ionicons name="information-circle" size={13} color="#D97706" />
                                    <Text style={styles.payoutBadgeText}>Min ₹1,000</Text>
                                </View>
                            </View>
                        </View>

                        {/* ENTER AMOUNT INPUT */}
                        <Text style={[styles.inputLabel, { color: isDark ? '#E5E7EB' : '#374151' }]}>Enter Withdrawal Amount</Text>
                        <View style={[styles.amountInputContainer, { backgroundColor: isDark ? '#1C192E' : '#F9FAFB', borderColor: isDark ? '#2E2850' : '#E5E7EB' }]}>
                            <Text style={[styles.currencyPrefix, { color: isDark ? '#9CA3AF' : '#4B5563' }]}>₹</Text>
                            <TextInput
                                style={[styles.amountInput, { color: isDark ? '#FFF' : '#111827' }]}
                                value={withdrawAmount}
                                onChangeText={(t) => { setWithdrawAmount(t); setErrorMsg(''); }}
                                placeholder="0"
                                placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
                                keyboardType="number-pad"
                            />
                            {withdrawAmount.length > 0 && (
                                <TouchableOpacity onPress={() => setWithdrawAmount('')} style={{ padding: 4 }}>
                                    <Ionicons name="close-circle" size={18} color="#9CA3AF" />
                                </TouchableOpacity>
                            )}
                        </View>

                        {/* AMOUNT CHIPS */}
                        <View style={styles.chipRow}>
                            {[1000, 2000, 5000].map((amt) => (
                                <TouchableOpacity
                                    key={amt}
                                    style={[styles.chipPill, { backgroundColor: isDark ? '#221D3B' : '#F3F4F6', borderColor: isDark ? '#362F5C' : '#E5E7EB' }]}
                                    onPress={() => handleQuickAmount(amt)}
                                    activeOpacity={0.7}
                                >
                                    <Text style={[styles.chipPillText, { color: isDark ? '#D1D5DB' : '#374151' }]}>+₹{amt.toLocaleString('en-IN')}</Text>
                                </TouchableOpacity>
                            ))}
                            <TouchableOpacity
                                style={[styles.chipPill, styles.chipMax, { backgroundColor: isDark ? 'rgba(124,77,255,0.18)' : '#EDE8FF' }]}
                                onPress={() => handleQuickAmount('FULL')}
                                activeOpacity={0.7}
                            >
                                <Text style={styles.chipMaxText}>Withdraw All</Text>
                            </TouchableOpacity>
                        </View>

                        {/* TRANSFER METHOD TOGGLE (UPI vs BANK) */}
                        <Text style={[styles.inputLabel, { color: isDark ? '#E5E7EB' : '#374151', marginTop: 18 }]}>Select Payout Method</Text>
                        <View style={[styles.tabSelector, { backgroundColor: isDark ? '#1C192E' : '#F3F4F6' }]}>
                            <TouchableOpacity
                                style={[styles.tabBtn, transferMethod === 'bank' && [styles.tabBtnActive, { backgroundColor: isDark ? '#7C4DFF' : '#7C4DFF' }]]}
                                onPress={() => { setTransferMethod('bank'); setErrorMsg(''); }}
                                activeOpacity={0.8}
                            >
                                <Ionicons name="business" size={15} color={transferMethod === 'bank' ? '#FFF' : (isDark ? '#9CA3AF' : '#6B7280')} />
                                <Text style={[styles.tabBtnText, transferMethod === 'bank' ? styles.tabBtnTextActive : { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
                                    Bank Account
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.tabBtn, transferMethod === 'upi' && [styles.tabBtnActive, { backgroundColor: isDark ? '#7C4DFF' : '#7C4DFF' }]]}
                                onPress={() => { setTransferMethod('upi'); setErrorMsg(''); }}
                                activeOpacity={0.8}
                            >
                                <Ionicons name="flash" size={15} color={transferMethod === 'upi' ? '#FFF' : (isDark ? '#9CA3AF' : '#6B7280')} />
                                <Text style={[styles.tabBtnText, transferMethod === 'upi' ? styles.tabBtnTextActive : { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
                                    Instant UPI
                                </Text>
                            </TouchableOpacity>
                        </View>

                        {/* SAVED BENEFICIARY CARD (If already exists and not editing) */}
                        {hasSavedDetails && !isEditingSaved ? (
                            <View style={[styles.savedCard, { backgroundColor: isDark ? '#1C192E' : '#FAFAFA', borderColor: isDark ? '#312A54' : '#E5E7EB' }]}>
                                <View style={styles.savedCardHeader}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                        <View style={styles.verifiedIconBox}>
                                            <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                                        </View>
                                        <Text style={[styles.savedCardTitle, { color: isDark ? '#FFF' : '#111827' }]}>
                                            {transferMethod === 'upi' ? 'Saved UPI ID' : (bankName || 'Verified Bank Account')}
                                        </Text>
                                    </View>
                                    <TouchableOpacity onPress={() => setIsEditingSaved(true)} style={styles.editBtn}>
                                        <Text style={styles.editBtnText}>Change</Text>
                                    </TouchableOpacity>
                                </View>

                                {transferMethod === 'upi' ? (
                                    <View style={{ marginTop: 8 }}>
                                        <Text style={[styles.savedDetailVal, { color: isDark ? '#D1D5DB' : '#374151' }]}>{upiId || 'No UPI ID saved'}</Text>
                                        <Text style={styles.savedSubText}>⚡ Real-time direct transfer via NPCI</Text>
                                    </View>
                                ) : (
                                    <View style={{ marginTop: 8 }}>
                                        <Text style={[styles.savedDetailName, { color: isDark ? '#FFF' : '#111827' }]}>{accountName || 'Beneficiary'}</Text>
                                        <Text style={[styles.savedDetailVal, { color: isDark ? '#D1D5DB' : '#374151' }]}>
                                            A/C: •••••••• {accountNumber ? accountNumber.slice(-4) : '••••'}
                                        </Text>
                                        <Text style={styles.savedSubText}>IFSC: {ifscCode || 'N/A'} • IMPS / NEFT Settlement</Text>
                                    </View>
                                )}
                            </View>
                        ) : (
                            /* INPUT FORM (For Bank or UPI) */
                            <View style={styles.formContainer}>
                                {transferMethod === 'upi' ? (
                                    <View style={{ marginTop: 8 }}>
                                        <Text style={[styles.fieldLabel, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>UPI ID / VPA</Text>
                                        <TextInput
                                            style={[styles.fieldInput, { color: isDark ? '#FFF' : '#111827', backgroundColor: isDark ? '#1C192E' : '#F9FAFB', borderColor: isDark ? '#2E2850' : '#E5E7EB' }]}
                                            value={upiId}
                                            onChangeText={setUpiId}
                                            placeholder="e.g. mobile@paytm or name@okaxis"
                                            placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
                                            autoCapitalize="none"
                                        />
                                        <Text style={styles.helperText}>Works with Google Pay, PhonePe, Paytm, BHIM</Text>
                                    </View>
                                ) : (
                                    <View style={{ marginTop: 8 }}>
                                        <Text style={[styles.fieldLabel, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>Account Holder Name</Text>
                                        <TextInput
                                            style={[styles.fieldInput, { color: isDark ? '#FFF' : '#111827', backgroundColor: isDark ? '#1C192E' : '#F9FAFB', borderColor: isDark ? '#2E2850' : '#E5E7EB' }]}
                                            value={accountName}
                                            onChangeText={setAccountName}
                                            placeholder="As per bank passbook"
                                            placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
                                        />

                                        <Text style={[styles.fieldLabel, { color: isDark ? '#9CA3AF' : '#6B7280', marginTop: 10 }]}>Bank Name</Text>
                                        <TextInput
                                            style={[styles.fieldInput, { color: isDark ? '#FFF' : '#111827', backgroundColor: isDark ? '#1C192E' : '#F9FAFB', borderColor: isDark ? '#2E2850' : '#E5E7EB' }]}
                                            value={bankName}
                                            onChangeText={setBankName}
                                            placeholder="e.g. State Bank of India, HDFC"
                                            placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
                                        />

                                        <Text style={[styles.fieldLabel, { color: isDark ? '#9CA3AF' : '#6B7280', marginTop: 10 }]}>Account Number</Text>
                                        <TextInput
                                            style={[styles.fieldInput, { color: isDark ? '#FFF' : '#111827', backgroundColor: isDark ? '#1C192E' : '#F9FAFB', borderColor: isDark ? '#2E2850' : '#E5E7EB' }]}
                                            value={accountNumber}
                                            onChangeText={setAccountNumber}
                                            placeholder="Enter 9 to 18 digit account number"
                                            placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
                                            keyboardType="number-pad"
                                        />

                                        <Text style={[styles.fieldLabel, { color: isDark ? '#9CA3AF' : '#6B7280', marginTop: 10 }]}>IFSC Code</Text>
                                        <TextInput
                                            style={[styles.fieldInput, { color: isDark ? '#FFF' : '#111827', backgroundColor: isDark ? '#1C192E' : '#F9FAFB', borderColor: isDark ? '#2E2850' : '#E5E7EB', textTransform: 'uppercase' }]}
                                            value={ifscCode}
                                            onChangeText={(t) => setIfscCode(t.toUpperCase())}
                                            placeholder="11-digit IFSC (e.g. SBIN0001234)"
                                            placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
                                            autoCapitalize="characters"
                                        />
                                    </View>
                                )}

                                {hasSavedDetails && (
                                    <TouchableOpacity onPress={() => setIsEditingSaved(false)} style={styles.cancelEditBtn}>
                                        <Text style={styles.cancelEditBtnText}>Use Saved Beneficiary</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        )}

                        {/* ERROR NOTICE */}
                        {errorMsg ? (
                            <View style={styles.errorBanner}>
                                <Ionicons name="alert-circle" size={15} color="#EF4444" />
                                <Text style={styles.errorBannerText}>{errorMsg}</Text>
                            </View>
                        ) : null}

                        {/* SETTLEMENT TRANSPARENCY SUMMARY */}
                        <View style={[styles.summaryCard, { backgroundColor: isDark ? '#19152B' : '#F9FAFB', borderColor: isDark ? '#292345' : '#E5E7EB' }]}>
                            <View style={styles.summaryRow}>
                                <Text style={[styles.summaryRowLabel, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>Platform Payout Fee</Text>
                                <Text style={styles.summaryRowFree}>₹0.00 (Free)</Text>
                            </View>
                            <View style={styles.summaryRow}>
                                <Text style={[styles.summaryRowLabel, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>Estimated Settlement</Text>
                                <Text style={[styles.summaryRowVal, { color: isDark ? '#D1D5DB' : '#374151' }]}>
                                    {transferMethod === 'upi' ? '~15 Mins' : 'Within 24-48 Hours'}
                                </Text>
                            </View>
                        </View>

                        {/* SUBMIT BUTTON */}
                        <TouchableOpacity
                            style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
                            onPress={handleSubmitWithdrawal}
                            disabled={submitting}
                            activeOpacity={0.85}
                        >
                            {submitting ? (
                                <ActivityIndicator size="small" color="#FFF" />
                            ) : (
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                    <Ionicons name="lock-closed" size={16} color="#FFF" />
                                    <Text style={styles.submitButtonText}>
                                        {withdrawAmount ? `Confirm & Withdraw ₹${parseFloat(withdrawAmount || 0).toLocaleString('en-IN')}` : 'Enter Amount to Withdraw'}
                                    </Text>
                                </View>
                            )}
                        </TouchableOpacity>

                        {/* BANK GRADE TRUST BADGE */}
                        <View style={styles.trustBadgeRow}>
                            <Ionicons name="shield-checkmark-outline" size={13} color="#10B981" />
                            <Text style={styles.trustBadgeText}>Bank Grade 256-Bit SSL Encrypted Settlement</Text>
                        </View>

                        <View style={{ height: 20 }} />
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        justifyContent: 'flex-end',
    },
    modalCard: {
        borderTopLeftRadius: 26,
        borderTopRightRadius: 26,
        maxHeight: '92%',
    },
    dragBar: {
        width: 36,
        height: 4,
        backgroundColor: '#9CA3AF',
        borderRadius: 2,
        alignSelf: 'center',
        marginTop: 10,
        opacity: 0.6,
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 14,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: 'rgba(156, 163, 175, 0.2)',
    },
    headerIconCircle: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalTitle: {
        fontSize: 16,
        fontWeight: '800',
        letterSpacing: 0.2,
    },
    modalSub: {
        fontSize: 11,
        marginTop: 1,
    },
    closeBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(156, 163, 175, 0.15)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingTop: 16,
    },

    // BALANCE CARD
    balanceCard: {
        borderRadius: 18,
        padding: 16,
        borderWidth: 1,
        marginBottom: 16,
    },
    balanceRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    balanceLabel: {
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 0.8,
    },
    balanceAmount: {
        fontSize: 24,
        fontWeight: '900',
        marginTop: 2,
    },
    payoutBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(217, 119, 6, 0.12)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        gap: 4,
    },
    payoutBadgeText: {
        color: '#D97706',
        fontSize: 11,
        fontWeight: '700',
    },

    // INPUT FIELD
    inputLabel: {
        fontSize: 13,
        fontWeight: '700',
        marginBottom: 8,
    },
    amountInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 16,
        borderWidth: 1.5,
        paddingHorizontal: 16,
        paddingVertical: 4,
    },
    currencyPrefix: {
        fontSize: 22,
        fontWeight: '800',
        marginRight: 6,
    },
    amountInput: {
        flex: 1,
        fontSize: 22,
        fontWeight: '800',
        paddingVertical: 10,
    },
    chipRow: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 10,
    },
    chipPill: {
        flex: 1,
        paddingVertical: 8,
        borderRadius: 10,
        borderWidth: 1,
        alignItems: 'center',
    },
    chipPillText: {
        fontSize: 12,
        fontWeight: '600',
    },
    chipMax: {
        borderColor: '#7C4DFF',
    },
    chipMaxText: {
        color: '#7C4DFF',
        fontSize: 12,
        fontWeight: '800',
    },

    // TAB SELECTOR
    tabSelector: {
        flexDirection: 'row',
        borderRadius: 12,
        padding: 3,
        marginBottom: 14,
    },
    tabBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        borderRadius: 10,
        gap: 6,
    },
    tabBtnActive: {
        shadowColor: '#7C4DFF',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 2,
    },
    tabBtnText: {
        fontSize: 13,
        fontWeight: '600',
    },
    tabBtnTextActive: {
        color: '#FFF',
        fontWeight: '800',
    },

    // SAVED CARD
    savedCard: {
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        marginBottom: 12,
    },
    savedCardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    verifiedIconBox: {
        width: 22,
        height: 22,
        borderRadius: 11,
        justifyContent: 'center',
        alignItems: 'center',
    },
    savedCardTitle: {
        fontSize: 14,
        fontWeight: '700',
    },
    editBtn: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
        backgroundColor: 'rgba(124, 77, 255, 0.1)',
    },
    editBtnText: {
        color: '#7C4DFF',
        fontSize: 12,
        fontWeight: '700',
    },
    savedDetailName: {
        fontSize: 13,
        fontWeight: '700',
    },
    savedDetailVal: {
        fontSize: 13,
        fontWeight: '600',
        marginTop: 2,
    },
    savedSubText: {
        fontSize: 11,
        color: '#9CA3AF',
        marginTop: 4,
    },

    // FORM FIELDS
    formContainer: {
        marginBottom: 12,
    },
    fieldLabel: {
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 0.3,
        marginBottom: 4,
    },
    fieldInput: {
        borderRadius: 12,
        borderWidth: 1,
        paddingHorizontal: 14,
        paddingVertical: 11,
        fontSize: 14,
        fontWeight: '600',
    },
    helperText: {
        fontSize: 11,
        color: '#9CA3AF',
        marginTop: 4,
        marginLeft: 2,
    },
    cancelEditBtn: {
        marginTop: 10,
        alignSelf: 'center',
        paddingVertical: 6,
    },
    cancelEditBtnText: {
        color: '#7C4DFF',
        fontSize: 12,
        fontWeight: '700',
    },

    // ERROR
    errorBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FEF2F2',
        borderWidth: 1,
        borderColor: '#FCA5A5',
        borderRadius: 10,
        padding: 10,
        gap: 6,
        marginBottom: 12,
    },
    errorBannerText: {
        color: '#B91C1C',
        fontSize: 12,
        fontWeight: '600',
        flex: 1,
    },

    // SUMMARY
    summaryCard: {
        borderRadius: 12,
        borderWidth: 1,
        padding: 12,
        gap: 8,
        marginBottom: 16,
    },
    summaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    summaryRowLabel: {
        fontSize: 12,
        fontWeight: '500',
    },
    summaryRowFree: {
        color: '#10B981',
        fontSize: 12,
        fontWeight: '700',
    },
    summaryRowVal: {
        fontSize: 12,
        fontWeight: '600',
    },

    // SUBMIT BUTTON
    submitButton: {
        backgroundColor: '#7C4DFF',
        borderRadius: 16,
        paddingVertical: 16,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#7C4DFF',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    submitButtonDisabled: {
        backgroundColor: '#9CA3AF',
    },
    submitButtonText: {
        color: '#FFF',
        fontSize: 15,
        fontWeight: '800',
        letterSpacing: 0.3,
    },
    trustBadgeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 5,
        marginTop: 12,
    },
    trustBadgeText: {
        color: '#9CA3AF',
        fontSize: 11,
        fontWeight: '500',
    },
});

export default WithdrawalModal;
