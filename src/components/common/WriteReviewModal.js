import React, { useState } from 'react';
import {
    View,
    Text,
    Modal,
    StyleSheet,
    TouchableOpacity,
    TextInput,
    ActivityIndicator,
    Dimensions
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../../context/ThemeContext';
import { getTheme } from '../../theme/theme';
import { addReview } from '../../services/api';

const { width } = Dimensions.get('window');

const WriteReviewModal = ({ visible, onClose, salonId, userId, salonName, onSuccess }) => {
    const { isDarkMode } = useTheme();
    const theme = getTheme(isDarkMode);

    const [rating, setRating] = useState(0);
    const [comment, setComment] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [nextDate, setNextDate] = useState(null);

    const handleSubmit = async () => {
        if (rating === 0) {
            setError('Please select a rating');
            return;
        }

        setLoading(true);
        setError('');

        try {
            await addReview(salonId, userId, rating, comment);
            setRating(0);
            setComment('');
            onSuccess?.();
            onClose();
        } catch (err) {
            setError(err.message || 'Failed to submit review');
            if (err.data && err.data.nextReviewDate) {
                setNextDate(new Date(err.data.nextReviewDate));
            }
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        setRating(0);
        setComment('');
        setError('');
        setNextDate(null);
        onClose();
    };

    const renderStars = () => {
        const stars = [];
        for (let i = 1; i <= 5; i++) {
            stars.push(
                <TouchableOpacity
                    key={i}
                    onPress={() => setRating(i)}
                    style={styles.starButton}
                >
                    <Ionicons
                        name={i <= rating ? 'star' : 'star-outline'}
                        size={40}
                        color={i <= rating ? '#FFD700' : theme.colors.textLight}
                    />
                </TouchableOpacity>
            );
        }
        return stars;
    };

    const getRatingText = () => {
        switch (rating) {
            case 1: return '😞 Poor';
            case 2: return '😐 Fair';
            case 3: return '🙂 Good';
            case 4: return '😊 Very Good';
            case 5: return '🤩 Excellent!';
            default: return 'Tap to Rate';
        }
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={handleClose}
        >
            <View style={styles.overlay}>
                <View style={[styles.container, { backgroundColor: theme.colors.surface }]}>
                    {/* Header */}
                    <View style={styles.header}>
                        <Text style={[styles.title, { color: theme.colors.text }]}>
                            Rate Your Experience
                        </Text>
                        <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
                            <Ionicons name="close" size={24} color={theme.colors.textLight} />
                        </TouchableOpacity>
                    </View>

                    {/* Salon Name */}
                    <Text style={[styles.salonName, { color: theme.colors.textSecondary }]}>
                        {salonName || 'Salon'}
                    </Text>

                    {/* Star Rating */}
                    <View style={styles.starsContainer}>
                        {renderStars()}
                    </View>
                    <Text style={[styles.ratingText, { color: theme.colors.primary }]}>
                        {getRatingText()}
                    </Text>

                    {/* Comment Input */}
                    <TextInput
                        style={[
                            styles.commentInput,
                            {
                                backgroundColor: theme.colors.background,
                                color: theme.colors.text,
                                borderColor: theme.colors.border
                            }
                        ]}
                        placeholder="Share your experience... (Optional)"
                        placeholderTextColor={theme.colors.textLight}
                        multiline
                        numberOfLines={4}
                        value={comment}
                        onChangeText={setComment}
                        textAlignVertical="top"
                    />

                    {/* Error Message */}
                    {error ? (
                        <View style={[
                            styles.errorBox,
                            nextDate ? styles.infoBox : null,
                            { backgroundColor: nextDate ? (isDarkMode ? '#1A237E' : '#E8EAF6') : (isDarkMode ? '#311B1B' : '#FFEBEE') }
                        ]}>
                            <Ionicons
                                name={nextDate ? "calendar" : "alert-circle"}
                                size={20}
                                color={nextDate ? "#3F51B5" : "#D32F2F"}
                            />
                            <View style={styles.errorTextContainer}>
                                <Text style={[styles.errorTitle, { color: nextDate ? "#3F51B5" : "#D32F2F" }]}>
                                    {nextDate ? "Limit Reached" : "Error"}
                                </Text>
                                <Text style={[styles.errorDesc, { color: theme.colors.text }]}>
                                    {error}
                                    {nextDate && `\n\nAap agla review `}
                                    {nextDate && (
                                        <Text style={{ fontWeight: 'bold' }}>
                                            {nextDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                                        </Text>
                                    )}
                                    {nextDate && ` ke baad de sakte hain.`}
                                </Text>
                            </View>
                        </View>
                    ) : null}

                    {/* Submit Button */}
                    <TouchableOpacity
                        style={[
                            styles.submitBtn,
                            { backgroundColor: rating > 0 ? theme.colors.primary : theme.colors.border }
                        ]}
                        onPress={handleSubmit}
                        disabled={loading || rating === 0}
                    >
                        {loading ? (
                            <ActivityIndicator color="#FFF" />
                        ) : (
                            <>
                                <Ionicons name="send" size={18} color="#FFF" />
                                <Text style={styles.submitText}>Submit Review</Text>
                            </>
                        )}
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'flex-end'
    },
    container: {
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 24,
        paddingBottom: 40
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold'
    },
    closeBtn: {
        padding: 4
    },
    salonName: {
        fontSize: 14,
        marginBottom: 24
    },
    starsContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginBottom: 8
    },
    starButton: {
        padding: 8
    },
    ratingText: {
        fontSize: 16,
        fontWeight: '600',
        textAlign: 'center',
        marginBottom: 24
    },
    commentInput: {
        borderWidth: 1,
        borderRadius: 12,
        padding: 16,
        fontSize: 15,
        minHeight: 100,
        marginBottom: 16
    },
    errorContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
        paddingHorizontal: 8
    },
    errorText: {
        color: '#FF5252',
        marginLeft: 8,
        fontSize: 13
    },
    submitBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        borderRadius: 12
    },
    submitText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: 'bold',
        marginLeft: 8
    },
    errorBox: {
        flexDirection: 'row',
        padding: 16,
        borderRadius: 16,
        marginBottom: 20,
        alignItems: 'flex-start',
    },
    infoBox: {
        borderWidth: 1,
        borderColor: '#3F51B5',
    },
    errorTextContainer: {
        marginLeft: 12,
        flex: 1,
    },
    errorTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    errorDesc: {
        fontSize: 13,
        lineHeight: 18,
    }
});

export default WriteReviewModal;
