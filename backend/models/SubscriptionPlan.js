const mongoose = require('mongoose');

const subscriptionPlanSchema = new mongoose.Schema({
    name: { type: String, required: true }, // e.g., "Silver", "Gold", "Free"
    price: { type: Number, required: true }, // Amount in INR
    interval: { type: String, enum: ['monthly', 'yearly', 'lifetime'], default: 'monthly' },
    features: [{ type: String }], // List of features enabled
    isActive: { type: Boolean, default: true },
    razorpayPlanId: { type: String } // Optional: If syncing with Razorpay Subscriptions
}, { timestamps: true });

module.exports = mongoose.model('SubscriptionPlan', subscriptionPlanSchema);
