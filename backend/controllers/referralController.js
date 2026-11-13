const Referral = require('../models/Referral');
const User = require('../models/User');
const Wallet = require('../models/Wallet');
const Salon = require('../models/Salon');
const SubscriptionPlan = require('../models/SubscriptionPlan');

// ============================================
// CONFIG — Referral Reward Settings
// ============================================
const REFERRER_PERCENTAGE = 50;         // 50% of plan price goes to referrer
const MAX_REWARD_PER_REFERRAL = 200;    // ₹200 cap per referral
const SALON_DISCOUNT_PERCENTAGE = 10;   // 10% off first month for salon

// ============================================
// HELPER — Generate Referral Code (NAME + 4 digits)
// ============================================
function generateReferralCode(name) {
    const clean = (name || 'USER').replace(/[^a-zA-Z]/g, '');
    const prefix = clean.substring(0, 4).toUpperCase() || 'USER';
    const suffix = Math.floor(1000 + Math.random() * 9000);
    return prefix + suffix;
}

// ============================================
// HELPER — Get Referral Stats for a User
// ============================================
async function getReferralStatsHelper(userId) {
    const referrals = await Referral.find({ referrerId: userId })
        .populate('referredSalonId', 'name images')
        .populate('referredUserId', 'name profilePhoto')
        .sort({ createdAt: -1 });

    const totalEarned = referrals.reduce((sum, r) => sum + r.totalRewardEarned, 0);
    const totalPending = referrals.reduce((sum, r) => sum + r.totalRewardPending, 0);
    const activeCount = referrals.filter(r => ['pending', 'salon_created', 'subscribed'].includes(r.status)).length;
    const completedCount = referrals.filter(r => r.status === 'completed').length;

    return {
        totalEarned,
        totalPending,
        totalReferred: referrals.length,
        activeReferrals: activeCount,
        completedReferrals: completedCount,
        referrals: referrals.map(r => ({
            _id: r._id,
            salonName: r.referredSalonId?.name || 'Pending',
            salonImage: r.referredSalonId?.images?.[0] || null,
            ownerName: r.referredUserId?.name || 'Unknown',
            ownerPhoto: r.referredUserId?.profilePhoto || null,
            status: r.status,
            totalRewardEarned: r.totalRewardEarned,
            totalRewardPending: r.totalRewardPending,
            maxReward: r.maxReward,
            rewardCapped: r.rewardCapped,
            installments: r.installments,
            createdAt: r.createdAt
        }))
    };
}

// ============================================
// GET / GENERATE MY REFERRAL CODE
// ============================================
exports.getMyReferralCode = async (req, res) => {
    try {
        const { userId } = req.params;

        let user = await User.findById(userId);
        if (!user) return res.status(404).json({ error: 'User not found' });

        // If user already has a code, return it with stats
        if (user.referralCode) {
            const stats = await getReferralStatsHelper(userId);
            return res.status(200).json({
                referralCode: user.referralCode,
                ...stats
            });
        }

        // Generate unique code
        let code;
        let isUnique = false;
        let attempts = 0;

        while (!isUnique && attempts < 10) {
            code = generateReferralCode(user.name);
            const existing = await User.findOne({ referralCode: code });
            if (!existing) isUnique = true;
            attempts++;
        }

        // Fallback: ObjectId-based code
        if (!isUnique) {
            code = 'STQ' + userId.slice(-5).toUpperCase();
        }

        user.referralCode = code;
        await user.save();

        const stats = await getReferralStatsHelper(userId);

        res.status(200).json({
            referralCode: code,
            ...stats
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get referral code: ' + error.message });
    }
};

// ============================================
// VALIDATE REFERRAL CODE — Check if code is valid
// ============================================
exports.validateCode = async (req, res) => {
    try {
        const { code } = req.body;

        if (!code || code.length < 4) {
            return res.status(400).json({ valid: false, error: 'Invalid code format' });
        }

        const referrer = await User.findOne({ referralCode: code.toUpperCase() });
        if (!referrer) {
            return res.status(404).json({ valid: false, error: 'Referral code not found' });
        }

        res.status(200).json({
            valid: true,
            referrerName: referrer.name,
            referrerPhoto: referrer.profilePhoto || null
        });
    } catch (error) {
        res.status(500).json({ error: 'Validation failed: ' + error.message });
    }
};

// ============================================
// APPLY REFERRAL CODE — Salon owner applies during/after signup
// ============================================
exports.applyReferralCode = async (req, res) => {
    try {
        const { code, salonOwnerId, salonId, phone } = req.body;

        if (!code || !salonOwnerId) {
            return res.status(400).json({ error: 'Code and salonOwnerId are required' });
        }

        // Find referrer by code
        const referrer = await User.findOne({ referralCode: code.toUpperCase() });
        if (!referrer) {
            return res.status(404).json({ error: 'Invalid referral code' });
        }

        // ---- Anti-Fraud Checks ----

        // 1. Can't refer yourself
        if (referrer._id.toString() === salonOwnerId) {
            return res.status(400).json({ error: 'You cannot use your own referral code' });
        }

        // 2. Check if this salon already has a referral
        if (salonId) {
            const existingSalonRef = await Referral.findOne({
                referredSalonId: salonId,
                status: { $nin: ['expired', 'fraud_blocked'] }
            });
            if (existingSalonRef) {
                return res.status(400).json({ error: 'This salon already has a referral applied' });
            }
        }

        // 3. Check if this user was already referred
        const existingUserRef = await Referral.findOne({
            referredUserId: salonOwnerId,
            status: { $nin: ['expired', 'fraud_blocked'] }
        });
        if (existingUserRef) {
            return res.status(400).json({ error: 'You have already used a referral code' });
        }

        // 4. Same phone check
        if (phone && referrer.phone && referrer.phone === phone) {
            return res.status(400).json({ error: 'Cannot use referral code with the same phone number' });
        }

        // Create referral record
        const referral = await Referral.create({
            referrerId: referrer._id,
            referrerCode: code.toUpperCase(),
            referredUserId: salonOwnerId,
            referredSalonId: salonId || null,
            status: salonId ? 'salon_created' : 'pending',
            referrerPercentage: REFERRER_PERCENTAGE,
            maxReward: MAX_REWARD_PER_REFERRAL,
            salonDiscountPercentage: SALON_DISCOUNT_PERCENTAGE,
            totalRewardPending: MAX_REWARD_PER_REFERRAL,
            referredPhone: phone || null,
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
        });

        // Update referrer stats
        await User.findByIdAndUpdate(referrer._id, {
            $inc: {
                'referralStats.totalReferred': 1,
                'referralStats.activeReferrals': 1
            }
        });

        res.status(200).json({
            success: true,
            message: `Referral code applied! You'll get ${SALON_DISCOUNT_PERCENTAGE}% off on your first subscription.`,
            referralId: referral._id,
            referrerName: referrer.name,
            discount: SALON_DISCOUNT_PERCENTAGE
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to apply code: ' + error.message });
    }
};

// ============================================
// GET REFERRAL STATS — User's referral dashboard
// ============================================
exports.getReferralStats = async (req, res) => {
    try {
        const { userId } = req.params;

        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ error: 'User not found' });

        const stats = await getReferralStatsHelper(userId);

        res.status(200).json({
            referralCode: user.referralCode || null,
            ...stats
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get stats: ' + error.message });
    }
};

// ============================================
// GET REFERRAL HISTORY — Detailed list with installments
// ============================================
exports.getReferralHistory = async (req, res) => {
    try {
        const { userId } = req.params;

        const referrals = await Referral.find({ referrerId: userId })
            .populate('referredSalonId', 'name images address')
            .populate('referredUserId', 'name profilePhoto phone')
            .sort({ createdAt: -1 });

        res.status(200).json({
            count: referrals.length,
            referrals: referrals.map(r => ({
                _id: r._id,
                salon: r.referredSalonId ? {
                    name: r.referredSalonId.name,
                    image: r.referredSalonId.images?.[0] || null,
                    address: r.referredSalonId.address
                } : null,
                owner: r.referredUserId ? {
                    name: r.referredUserId.name,
                    photo: r.referredUserId.profilePhoto || null
                } : null,
                status: r.status,
                totalRewardEarned: r.totalRewardEarned,
                totalRewardPending: r.totalRewardPending,
                maxReward: r.maxReward,
                rewardCapped: r.rewardCapped,
                installments: r.installments,
                createdAt: r.createdAt
            }))
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get history: ' + error.message });
    }
};

// ============================================
// CHECK SALON REFERRAL — For showing discount info in UI
// ============================================
exports.checkSalonReferral = async (req, res) => {
    try {
        const { salonId } = req.params;

        const referral = await Referral.findOne({
            referredSalonId: salonId,
            status: { $nin: ['expired', 'fraud_blocked'] }
        }).populate('referrerId', 'name profilePhoto');

        if (!referral) {
            return res.status(200).json({ hasReferral: false });
        }

        res.status(200).json({
            hasReferral: true,
            referrerName: referral.referrerId?.name || 'Someone',
            discount: referral.salonDiscountPercentage,
            discountUsed: referral.salonDiscountUsed,
            status: referral.status
        });
    } catch (error) {
        res.status(500).json({ error: 'Check failed: ' + error.message });
    }
};

// ============================================
// GET SALON REFERRAL DISCOUNT — Internal helper
// Called by payment controller to check discount before creating order
// ============================================
exports.getSalonReferralDiscount = async (salonId) => {
    try {
        const referral = await Referral.findOne({
            referredSalonId: salonId,
            salonDiscountUsed: false,
            status: { $in: ['pending', 'salon_created'] }
        });

        if (!referral) return { hasDiscount: false, discountPercentage: 0 };

        return {
            hasDiscount: true,
            discountPercentage: referral.salonDiscountPercentage,
            referralId: referral._id
        };
    } catch (error) {
        return { hasDiscount: false, discountPercentage: 0 };
    }
};

// ============================================
// PROCESS REFERRAL REWARD — Called internally after subscription payment
// This is the CORE function — credits wallet, updates referral record
// ============================================
exports.processReferralReward = async (salonId, planId, paidAmount) => {
    try {
        // Find active referral for this salon
        const referral = await Referral.findOne({
            referredSalonId: salonId,
            status: { $in: ['salon_created', 'subscribed'] },
            rewardCapped: false
        });

        if (!referral) return null; // No active referral for this salon

        // Calculate reward: 50% of paid amount, capped by remaining limit
        const rawReward = Math.floor(paidAmount * (referral.referrerPercentage / 100));
        const remainingCap = referral.maxReward - referral.totalRewardEarned;
        const rewardAmount = Math.min(rawReward, remainingCap);

        if (rewardAmount <= 0) {
            // Cap already reached
            referral.rewardCapped = true;
            referral.status = 'completed';
            referral.totalRewardPending = 0;
            await referral.save();
            return null;
        }

        // Mark salon discount as used on first subscription
        if (!referral.salonDiscountUsed) {
            referral.salonDiscountUsed = true;
        }

        // Credit reward to referrer's wallet
        let wallet = await Wallet.findOne({ userId: referral.referrerId });
        if (!wallet) {
            wallet = await Wallet.create({
                userId: referral.referrerId,
                balance: 0,
                totalCashbackEarned: 0,
                totalAdded: 0,
                totalSpent: 0,
                scratchCards: [],
                transactions: []
            });
        }

        wallet.balance += rewardAmount;
        wallet.totalCashbackEarned = (wallet.totalCashbackEarned || 0) + rewardAmount;
        wallet.transactions.push({
            type: 'referral',
            amount: rewardAmount,
            description: `🎉 Referral reward! Salon subscription earned you ₹${rewardAmount}`,
            relatedSalonId: salonId,
            createdAt: new Date()
        });
        await wallet.save();

        // Update referral record
        referral.totalRewardEarned += rewardAmount;
        referral.totalRewardPending = Math.max(0, referral.maxReward - referral.totalRewardEarned);
        referral.status = 'subscribed';

        if (referral.totalRewardEarned >= referral.maxReward) {
            referral.rewardCapped = true;
            referral.status = 'completed';
            referral.totalRewardPending = 0;

            // Decrement active referrals count on referrer
            await User.findByIdAndUpdate(referral.referrerId, {
                $inc: { 'referralStats.activeReferrals': -1 }
            });
        }

        // Get plan name for installment record
        const plan = await SubscriptionPlan.findById(planId);

        referral.installments.push({
            amount: rewardAmount,
            subscriptionPlanId: planId,
            subscriptionPlanName: plan?.name || 'Unknown',
            paymentDate: new Date()
        });

        await referral.save();

        // Update referrer's total earned in User model
        await User.findByIdAndUpdate(referral.referrerId, {
            $inc: { 'referralStats.totalEarned': rewardAmount }
        });

        console.log(`[REFERRAL] ₹${rewardAmount} credited to referrer ${referral.referrerId} for salon ${salonId}`);

        return {
            rewardAmount,
            referrerId: referral.referrerId,
            totalEarned: referral.totalRewardEarned,
            totalPending: referral.totalRewardPending,
            rewardCapped: referral.rewardCapped
        };
    } catch (error) {
        console.error('[REFERRAL] Reward processing error:', error.message);
        return null; // Don't break the subscription flow
    }
};

// ============================================
// UPDATE SALON ID ON REFERRAL — When salon is created after code was applied
// Called from salon registration flow
// ============================================
exports.updateReferralSalonId = async (salonOwnerId, salonId) => {
    try {
        const referral = await Referral.findOne({
            referredUserId: salonOwnerId,
            status: 'pending'
        });

        if (referral) {
            referral.referredSalonId = salonId;
            referral.status = 'salon_created';
            await referral.save();
            console.log(`[REFERRAL] Linked salon ${salonId} to referral ${referral._id}`);
        }
    } catch (error) {
        console.error('[REFERRAL] Update salon ID error:', error.message);
    }
};
