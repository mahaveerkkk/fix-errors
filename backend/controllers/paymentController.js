const Razorpay = require('razorpay');
const crypto = require('crypto');
const Salon = require('../models/Salon');
const SubscriptionPlan = require('../models/SubscriptionPlan');
const { processReferralReward, getSalonReferralDiscount } = require('./referralController');

// Initialize Razorpay
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

exports.createSubscriptionOrder = async (req, res) => {
    try {
        const { planId, salonId } = req.body;
        
        const plan = await SubscriptionPlan.findById(planId);
        if (!plan) return res.status(404).json({ error: 'Plan not found' });

        // Check for referral discount (10% off first month)
        let finalPrice = plan.price;
        let discountApplied = false;
        let discountAmount = 0;

        const discountInfo = await getSalonReferralDiscount(salonId);
        if (discountInfo.hasDiscount) {
            discountAmount = Math.floor(plan.price * (discountInfo.discountPercentage / 100));
            finalPrice = plan.price - discountAmount;
            discountApplied = true;
        }

        // Create Razorpay Order
        const options = {
            amount: finalPrice * 100, // Amount in paise
            currency: "INR",
            receipt: `receipt_order_${Date.now()}`,
            notes: {
                salonId,
                planId: planId,
                originalPrice: plan.price,
                discountApplied: discountApplied ? 'yes' : 'no',
                discountAmount
            }
        };

        const order = await razorpay.orders.create(options);
        res.status(200).json({
            ...order,
            originalPrice: plan.price,
            finalPrice,
            discountApplied,
            discountAmount
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.verifySubscriptionPayment = async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, salonId, planId } = req.body;

        // Verify Signature
        const body = razorpay_order_id + "|" + razorpay_payment_id;
        const expectedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(body.toString())
            .digest('hex');

        if (expectedSignature === razorpay_signature) {
            // Payment Success: Activate Salon
            const plan = await SubscriptionPlan.findById(planId);
            
            // Calculate End Date (Simplistic for now)
            const endDate = new Date();
            if (plan.interval === 'monthly') endDate.setMonth(endDate.getMonth() + 1);
            else if (plan.interval === 'yearly') endDate.setFullYear(endDate.getFullYear() + 1);
            else endDate.setFullYear(endDate.getFullYear() + 100); // Lifetime

            await Salon.findByIdAndUpdate(salonId, {
                isPaymentActive: true,
                currentPlanId: planId,
                subscriptionEndDate: endDate
            });

            // Process referral reward (50% of plan price to referrer's wallet)
            const referralResult = await processReferralReward(salonId, planId, plan.price);

            res.status(200).json({
                message: 'Subscription Activated',
                success: true,
                referralReward: referralResult || null
            });
        } else {
            res.status(400).json({ error: 'Invalid Signature', success: false });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }

};

exports.getRazorpayKey = (req, res) => {
    res.status(200).json({ key: process.env.RAZORPAY_KEY_ID });
};
