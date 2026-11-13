import React from 'react';
import { View, Text, StyleSheet, Modal as RNModal, TouchableOpacity, TouchableWithoutFeedback } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../../context/ThemeContext';
import { getTheme } from '../../theme/theme';

const Modal = ({ visible, onClose, onApply, title, children, footer }) => {
    const { isDarkMode } = useTheme();
    const theme = getTheme(isDarkMode);

    return (
        <RNModal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={onClose}
        >
            <TouchableWithoutFeedback onPress={onClose}>
                <View style={[styles.overlay, { backgroundColor: theme.colors.backdrop }]}>
                    <TouchableWithoutFeedback>
                        <View style={[styles.container, { backgroundColor: theme.colors.background, borderTopLeftRadius: theme.borderRadius.xl, borderTopRightRadius: theme.borderRadius.xl }]}>
                            <View style={[styles.header, { borderBottomColor: theme.colors.divider }]}>
                                <Text style={[styles.title, { color: theme.colors.text, fontSize: theme.typography.size.lg }]}>{title}</Text>
                                {onApply ? (
                                    <TouchableOpacity onPress={onApply} style={styles.applyBtn}>
                                        <Text style={[styles.applyText, { color: theme.colors.primary }]}>Apply</Text>
                                    </TouchableOpacity>
                                ) : (
                                    <TouchableOpacity onPress={onClose}>
                                        <Ionicons name="close" size={24} color={theme.colors.text} />
                                    </TouchableOpacity>
                                )}
                            </View>
                            <View style={styles.content}>
                                {children}
                            </View>
                            {footer && (
                                <View style={[styles.footer, { borderTopColor: theme.colors.divider }]}>
                                    {footer}
                                </View>
                            )}
                        </View>
                    </TouchableWithoutFeedback>
                </View>
            </TouchableWithoutFeedback>
        </RNModal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    container: {
        maxHeight: '80%',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 24,
        borderBottomWidth: 1,
    },
    title: {
        fontWeight: 'bold',
    },
    content: {
        padding: 24,
    },
    footer: {
        padding: 24,
        borderTopWidth: 1,
    },
    applyBtn: {
        paddingHorizontal: 16,
        paddingVertical: 6,
        borderRadius: 8,
    },
    applyText: {
        fontWeight: '700',
        fontSize: 16,
    }
});

export default Modal;
