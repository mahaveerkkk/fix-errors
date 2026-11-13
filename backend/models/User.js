const mongoose = require('mongoose');
const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    firebaseUid: { type: String, required: true, unique: true },
    phone: { type: String },
    role: { type: String, enum: ['user', 'owner', 'admin'], default: 'user' },
    isPaymentActive: { type: Boolean, default: false },
    fcmToken: { type: String }, // For Push Notifications
    profilePhoto: { type: String }, // URL from Firebase or Upload
    location: {
        lat: { type: Number },
        lng: { type: Number }
    },
    favorites: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Salon' }],
    salonSetupCompleted: { type: Boolean, default: false },

    // Refer & Earn
    referralCode: { type: String, unique: true, sparse: true }, // Unique code like "RAHU1234"
    referralStats: {
        totalReferred: { type: Number, default: 0 },     // Total salons referred
        totalEarned: { type: Number, default: 0 },        // Total ₹ earned from referrals
        activeReferrals: { type: Number, default: 0 }     // Currently earning referrals
    },

    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', userSchema);
