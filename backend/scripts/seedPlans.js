/**
 * Seed Subscription Plans into MongoDB
 * Run: node scripts/seedPlans.js
 *
 * Plans:
 *  - Test    → ₹10   (1 month)   — for testing only
 *  - Basic   → ₹29   (1 month)
 *  - Standard→ ₹59   (1 month)
 *  - Premium → ₹199  (1 month)
 */

require('dotenv').config({ path: '../.env' });
const mongoose = require('mongoose');
const SubscriptionPlan = require('../models/SubscriptionPlan');

const PLANS = [
    {
        name: 'Test',
        price: 10,
        interval: 'monthly',
        isActive: true,
        features: [
            'All features unlocked',
            'Testing plan — ₹10 only',
            'Valid for 30 days',
        ],
    },
    {
        name: 'Basic',
        price: 29,
        interval: 'monthly',
        isActive: true,
        features: [
            'Live Queue Management',
            'Walk-in Customer',
            'Basic Analytics',
            'Valid for 30 days',
        ],
    },
    {
        name: 'Standard',
        price: 59,
        interval: 'monthly',
        isActive: true,
        features: [
            'All Basic features',
            'Appointment Booking',
            'QR Payment',
            'Customer CRM',
            'Valid for 30 days',
        ],
    },
    {
        name: 'Premium',
        price: 199,
        interval: 'monthly',
        isActive: true,
        features: [
            'All Standard features',
            'Priority Support',
            'Advanced Analytics',
            'Unlimited Staff',
            'Valid for 30 days',
        ],
    },
];

async function seedPlans() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB');

        // Delete old plans
        await SubscriptionPlan.deleteMany({});
        console.log('🗑️  Old plans cleared');

        // Insert new plans
        const inserted = await SubscriptionPlan.insertMany(PLANS);
        console.log(`✅ ${inserted.length} plans inserted:`);
        inserted.forEach(p => console.log(`   • ${p.name} — ₹${p.price}/month  [ID: ${p._id}]`));

        await mongoose.disconnect();
        console.log('\n✅ Done! Plans ready in DB.');
        process.exit(0);
    } catch (err) {
        console.error('❌ Error:', err.message);
        process.exit(1);
    }
}

seedPlans();
