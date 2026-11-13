const mongoose = require('mongoose');

const scratchCardSchema = new mongoose.Schema({
    amount: { type: Number, required: true },
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking' },
    isScratched: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
});

const transactionSchema = new mongoose.Schema({
    type: {
        type: String,
        enum: ['cashback_first', 'cashback_regular', 'referral', 'debit', 'credit', 'add_money', 'qr_payment_sent', 'qr_payment_received', 'subscription_payment', 'booking_payment'],
        required: true
    },
    amount: { type: Number, required: true },
    description: { type: String },
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking' },
    relatedUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    relatedSalonId: { type: mongoose.Schema.Types.ObjectId, ref: 'Salon' },
    createdAt: { type: Date, default: Date.now }
});

const walletSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    salonId: { type: mongoose.Schema.Types.ObjectId, ref: 'Salon', index: true },
    walletType: { type: String, enum: ['user', 'salon'], default: 'user' },
    walletPin: { type: String, default: null }, // Hashed 4-digit PIN
    balance: { type: Number, default: 0 },
    totalCashbackEarned: { type: Number, default: 0 },
    totalAdded: { type: Number, default: 0 },
    totalSpent: { type: Number, default: 0 },
    scratchCards: [scratchCardSchema],
    transactions: [transactionSchema]
}, { timestamps: true });

module.exports = mongoose.model('Wallet', walletSchema);
