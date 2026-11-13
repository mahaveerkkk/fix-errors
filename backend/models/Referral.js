const mongoose = require('mongoose');

const installmentSchema = new mongoose.Schema({
    amount: { type: Number, required: true },
    subscriptionPlanId: { type: mongoose.Schema.Types.ObjectId, ref: 'SubscriptionPlan' },
    subscriptionPlanName: { type: String },
    paymentDate: { type: Date, default: Date.now },
    createdAt: { type: Date, default: Date.now }
});

const referralSchema = new mongoose.Schema({
    // Who referred (the user who shared the code)
    referrerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    referrerCode: { type: String, required: true },

    // Who was referred (salon owner)
    referredUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    referredSalonId: { type: mongoose.Schema.Types.ObjectId, ref: 'Salon', index: true },

    // Status tracking
    // pending       → code applied, salon not created yet
    // salon_created → salon created, no subscription yet
    // subscribed    → salon subscribed, rewards being paid
    // completed     → ₹200 cap reached, no more rewards
    // expired       → code expired (30 days unused)
    // fraud_blocked → blocked due to fraud detection
    status: {
        type: String,
        enum: ['pending', 'salon_created', 'subscribed', 'completed', 'expired', 'fraud_blocked'],
        default: 'pending'
    },

    // Reward config
    referrerPercentage: { type: Number, default: 50 },     // 50% of plan price
    maxReward: { type: Number, default: 200 },              // ₹200 cap per referral
    salonDiscountPercentage: { type: Number, default: 10 }, // 10% off first month for salon
    salonDiscountUsed: { type: Boolean, default: false },   // Track if discount was used

    // Reward tracking
    totalRewardEarned: { type: Number, default: 0 },   // Amount already credited to wallet
    totalRewardPending: { type: Number, default: 200 }, // Amount remaining to be earned
    rewardCapped: { type: Boolean, default: false },    // True when ₹200 cap reached

    // Installment history — each salon subscription payment creates one
    installments: [installmentSchema],

    // Fraud prevention
    referredPhone: { type: String },

    createdAt: { type: Date, default: Date.now },
    expiresAt: { type: Date } // 30 day expiry for unused codes
});

// Index for fast lookups
referralSchema.index({ referredSalonId: 1, status: 1 });
referralSchema.index({ referredUserId: 1, status: 1 });

module.exports = mongoose.model('Referral', referralSchema);
