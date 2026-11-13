const Wallet = require('../models/Wallet');
const Booking = require('../models/Booking');
const Salon = require('../models/Salon');
const User = require('../models/User');
const Razorpay = require('razorpay');
const SubscriptionPlan = require('../models/SubscriptionPlan');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const { processReferralReward, getSalonReferralDiscount } = require('./referralController');


// ============================================
// CASHBACK CONFIG
// ============================================
const FIRST_BOOKING_CASHBACK = 5;  // ₹5 for first completed booking
const REGULAR_CASHBACK = 1;         // ₹1 for every subsequent booking

// Initialize Razorpay
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

// ============================================
// GET WALLET — Balance, Scratch Cards, Transactions
// ============================================
exports.getWallet = async (req, res) => {
    try {
        const { userId } = req.params;

        let wallet = await Wallet.findOne({ userId });

        // Auto-create wallet if doesn't exist
        if (!wallet) {
            wallet = await Wallet.create({ userId, balance: 0, totalCashbackEarned: 0, scratchCards: [], transactions: [] });
        }

        // Sort transactions newest first
        const sortedTransactions = [...wallet.transactions].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        // Get unscratched cards
        const unscratchedCards = wallet.scratchCards.filter(card => !card.isScratched);

        res.status(200).json({
            balance: wallet.balance,
            totalCashbackEarned: wallet.totalCashbackEarned,
            totalAdded: wallet.totalAdded || 0,
            totalSpent: wallet.totalSpent || 0,
            walletType: wallet.walletType || 'user',
            unscratchedCards,
            transactions: sortedTransactions.slice(0, 50), // Last 50 transactions
            totalUnscratchedCount: unscratchedCards.length,
            hasPin: !!wallet.walletPin
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch wallet: ' + error.message });
    }
};

// ============================================
// SCRATCH CARD — Reveal & Credit to Wallet
// ============================================
exports.scratchCard = async (req, res) => {
    try {
        const { userId, cardId } = req.params;

        const wallet = await Wallet.findOne({ userId });
        if (!wallet) return res.status(404).json({ error: 'Wallet not found' });

        // Find the scratch card
        const cardIndex = wallet.scratchCards.findIndex(c => c._id.toString() === cardId);
        if (cardIndex === -1) return res.status(404).json({ error: 'Scratch card not found' });

        const card = wallet.scratchCards[cardIndex];
        if (card.isScratched) {
            return res.status(400).json({ error: 'Card already scratched', amount: card.amount });
        }

        // Mark as scratched
        wallet.scratchCards[cardIndex].isScratched = true;

        // Credit amount to wallet
        wallet.balance += card.amount;
        wallet.totalCashbackEarned += card.amount;

        // Add transaction
        wallet.transactions.push({
            type: card.amount >= FIRST_BOOKING_CASHBACK ? 'cashback_first' : 'cashback_regular',
            amount: card.amount,
            description: card.amount >= FIRST_BOOKING_CASHBACK
                ? '🎉 First booking cashback reward!'
                : '💰 Booking cashback reward',
            bookingId: card.bookingId,
            createdAt: new Date()
        });

        await wallet.save();
        res.status(200).json({
            message: 'Card scratched successfully!',
            amount: card.amount,
            newBalance: wallet.balance,
            totalCashbackEarned: wallet.totalCashbackEarned
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to scratch card: ' + error.message });
    }
};

// ============================================
// CREATE SCRATCH CARD — Called internally after booking completion
// ============================================
exports.createScratchCard = async (userId, bookingId) => {
    try {
        // Count user's completed bookings (including current one)
        const completedCount = await Booking.countDocuments({
            userId,
            status: 'completed'
        });

        // First completed booking = ₹5, rest = ₹1
        const cashbackAmount = completedCount <= 1 ? FIRST_BOOKING_CASHBACK : REGULAR_CASHBACK;

        // Find or create wallet
        let wallet = await Wallet.findOne({ userId });
        if (!wallet) {
            wallet = await Wallet.create({ userId, balance: 0, totalCashbackEarned: 0, scratchCards: [], transactions: [] });
        }

        // Check if scratch card already exists for this booking (prevent duplicates)
        const existingCard = wallet.scratchCards.find(c => c.bookingId && c.bookingId.toString() === bookingId.toString());
        if (existingCard) {
            return existingCard;
        }

        // Add scratch card
        wallet.scratchCards.push({
            amount: cashbackAmount,
            bookingId,
            isScratched: false,
            createdAt: new Date()
        });

        await wallet.save();
        return { amount: cashbackAmount, isFirst: completedCount <= 1 };
    } catch (error) {
        return null; // Don't break booking completion if wallet fails
    }
};

// ============================================
// ADD MONEY — Create Razorpay order for wallet top-up
// ============================================
exports.addMoneyCreateOrder = async (req, res) => {
    try {
        console.log('addMoneyCreateOrder body:', req.body);
        const { userId, amount } = req.body;

        if (!amount || amount < 10) {
            return res.status(400).json({ error: 'Minimum amount is ₹10' });
        }

        if (amount > 10000) {
            return res.status(400).json({ error: 'Maximum amount is ₹10,000' });
        }

        const options = {
            amount: amount * 100, // Razorpay uses paise
            currency: 'INR',
            receipt: `w_${userId.slice(-8)}_${Date.now()}`,
            notes: {
                userId,
                purpose: 'wallet_topup'
            }
        };

        const order = await razorpay.orders.create(options);
        res.status(200).json(order);
    } catch (error) {
        console.error('addMoneyCreateOrder error:', error);
        res.status(500).json({ error: 'Failed to create order: ' + (error.message || error.description || JSON.stringify(error)) });
    }
};

// ============================================
// ADD MONEY — Verify payment & credit wallet
// ============================================
exports.addMoneyVerify = async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, userId, amount } = req.body;

        // Verify signature
        const body = razorpay_order_id + '|' + razorpay_payment_id;
        const expectedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(body.toString())
            .digest('hex');

        if (expectedSignature !== razorpay_signature) {
            return res.status(400).json({ error: 'Payment verification failed', success: false });
        }

        // Credit wallet
        let wallet = await Wallet.findOne({ userId });
        if (!wallet) {
            wallet = await Wallet.create({ userId, balance: 0, totalCashbackEarned: 0, totalAdded: 0, totalSpent: 0, scratchCards: [], transactions: [] });
        }

        wallet.balance += amount;
        wallet.totalAdded = (wallet.totalAdded || 0) + amount;

        wallet.transactions.push({
            type: 'add_money',
            amount: amount,
            description: `💳 Added ₹${amount} to wallet`,
            createdAt: new Date()
        });

        await wallet.save();

        res.status(200).json({
            success: true,
            message: `₹${amount} added to wallet`,
            newBalance: wallet.balance
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to add money: ' + error.message });
    }
};

// ============================================
// PAY SALON VIA QR — User pays salon from wallet (Transactional & Secure)
// ============================================
exports.paySalon = async (req, res) => {
    let session = null;
    try {
        session = await mongoose.startSession();
        session.startTransaction();
    } catch (e) {
        // Standalone MongoDB local database doesn't support replica set transactions
        session = null;
    }

    try {
        const { userId, salonId, amount } = req.body;

        if (!amount || amount <= 0) {
            if (session) {
                await session.abortTransaction();
                session.endSession();
            }
            return res.status(400).json({ error: 'Invalid amount' });
        }

        // Get user wallet
        const userWallet = session 
            ? await Wallet.findOne({ userId }).session(session)
            : await Wallet.findOne({ userId });
            
        if (!userWallet) {
            if (session) {
                await session.abortTransaction();
                session.endSession();
            }
            return res.status(404).json({ error: 'Wallet not found' });
        }

        if (userWallet.balance < amount) {
            if (session) {
                await session.abortTransaction();
                session.endSession();
            }
            return res.status(400).json({ error: 'Insufficient balance', balance: userWallet.balance });
        }

        // Get salon info — supports both full _id and 8-char short code
        let salon;
        if (salonId.length === 24) {
            salon = await Salon.findById(salonId).populate('ownerId', 'name profilePhoto');
        } else {
            const allSalons = await Salon.find({}).populate('ownerId', 'name profilePhoto').lean();
            salon = allSalons.find(s => s._id.toString().slice(-8).toUpperCase() === salonId.toUpperCase());
        }
        if (!salon) {
            if (session) {
                await session.abortTransaction();
                session.endSession();
            }
            return res.status(404).json({ error: 'Salon not found' });
        }

        // Get or create salon owner wallet
        let salonWallet = session
            ? await Wallet.findOne({ userId: salon.ownerId._id }).session(session)
            : await Wallet.findOne({ userId: salon.ownerId._id });
            
        if (!salonWallet) {
            salonWallet = new Wallet({
                userId: salon.ownerId._id,
                salonId: salon._id,
                walletType: 'salon',
                balance: 0,
                totalCashbackEarned: 0,
                totalAdded: 0,
                totalSpent: 0,
                scratchCards: [],
                transactions: []
            });
        }

        // Debit user wallet
        userWallet.balance -= amount;
        userWallet.totalSpent = (userWallet.totalSpent || 0) + amount;
        userWallet.transactions.push({
            type: 'qr_payment_sent',
            amount: amount,
            description: `💸 Paid ₹${amount} to ${salon.name}`,
            relatedSalonId: salon._id,
            createdAt: new Date()
        });

        // Credit salon wallet
        salonWallet.balance += amount;
        salonWallet.totalAdded = (salonWallet.totalAdded || 0) + amount;
        salonWallet.transactions.push({
            type: 'qr_payment_received',
            amount: amount,
            description: `💰 Received ₹${amount} via QR payment`,
            relatedUserId: userId,
            createdAt: new Date()
        });

        if (session) {
            await userWallet.save({ session });
            await salonWallet.save({ session });
            await session.commitTransaction();
            session.endSession();
        } else {
            await userWallet.save();
            await salonWallet.save();
        }

        res.status(200).json({
            success: true,
            message: `₹${amount} paid to ${salon.name}`,
            newBalance: userWallet.balance,
            salonName: salon.name
        });
    } catch (error) {
        if (session) {
            await session.abortTransaction();
            session.endSession();
        }
        res.status(500).json({ error: 'Payment failed: ' + error.message });
    }
};

// ============================================
// GET SALON WALLET — For salon owner
// ============================================
exports.getSalonWallet = async (req, res) => {
    try {
        const { salonId } = req.params;

        const salon = await Salon.findById(salonId).populate('ownerId', 'name profilePhoto');
        if (!salon) return res.status(404).json({ error: 'Salon not found' });

        let wallet = await Wallet.findOne({ userId: salon.ownerId._id });
        if (!wallet) {
            wallet = await Wallet.create({
                userId: salon.ownerId._id,
                salonId: salon._id,
                walletType: 'salon',
                balance: 0,
                totalCashbackEarned: 0,
                totalAdded: 0,
                totalSpent: 0,
                scratchCards: [],
                transactions: []
            });
        }

        // Sort transactions newest first
        const sortedTransactions = [...wallet.transactions].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        res.status(200).json({
            balance: wallet.balance,
            totalAdded: wallet.totalAdded || 0,
            totalSpent: wallet.totalSpent || 0,
            walletType: 'salon',
            salonName: salon.name,
            subscriptionActive: salon.isPaymentActive || false,
            subscriptionEndDate: salon.subscriptionEndDate || null,
            currentPlanId: salon.currentPlanId || null,
            transactions: sortedTransactions.slice(0, 50)
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch salon wallet: ' + error.message });
    }
};

// ============================================
// PAY SUBSCRIPTION FROM WALLET — Salon uses wallet balance
// ============================================
exports.paySubscription = async (req, res) => {
    try {
        const { salonId, planId } = req.body;

        const salon = await Salon.findById(salonId).populate('ownerId');
        if (!salon) return res.status(404).json({ error: 'Salon not found' });

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

        // Get salon owner wallet
        let wallet = await Wallet.findOne({ userId: salon.ownerId._id });
        if (!wallet) return res.status(404).json({ error: 'Wallet not found' });

        if (wallet.balance < finalPrice) {
            return res.status(400).json({
                error: 'Insufficient balance',
                balance: wallet.balance,
                required: finalPrice,
                originalPrice: plan.price,
                discountApplied,
                discountAmount
            });
        }

        // Deduct from wallet (discounted price)
        wallet.balance -= finalPrice;
        wallet.totalSpent = (wallet.totalSpent || 0) + finalPrice;
        wallet.transactions.push({
            type: 'subscription_payment',
            amount: finalPrice,
            description: discountApplied
                ? `💎 Subscription: ${plan.name} plan (${discountInfo.discountPercentage}% referral discount applied!)`
                : `💎 Subscription: ${plan.name} plan`,
            relatedSalonId: salon._id,
            createdAt: new Date()
        });

        await wallet.save();

        // Activate subscription
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
            success: true,
            message: `${plan.name} plan activated!`,
            newBalance: wallet.balance,
            subscriptionEndDate: endDate,
            discountApplied,
            discountAmount,
            referralReward: referralResult || null
        });
    } catch (error) {
        res.status(500).json({ error: 'Subscription payment failed: ' + error.message });
    }
};

// ============================================
// GET SALON INFO FOR QR SCAN — Public endpoint
// Supports both full MongoDB _id and 8-char short code
// ============================================
exports.getSalonForQR = async (req, res) => {
    try {
        const { salonId } = req.params;
        let salon;

        if (salonId.length === 24) {
            // Full MongoDB ObjectId
            salon = await Salon.findById(salonId).populate('ownerId', 'name profilePhoto');
        } else {
            // Short code (last 8 chars of _id) — search by matching
            const allSalons = await Salon.find({}).populate('ownerId', 'name profilePhoto').lean();
            salon = allSalons.find(s => s._id.toString().slice(-8).toUpperCase() === salonId.toUpperCase());
        }

        if (!salon) return res.status(404).json({ error: 'Salon not found' });

        res.status(200).json({
            salonId: salon._id,
            salonName: salon.name,
            ownerName: salon.ownerName || salon.ownerId?.name || 'Owner',
            ownerPhoto: salon.ownerId?.profilePhoto || null,
            salonImage: salon.images?.[0] || null,
            rating: salon.rating || 0,
            address: salon.address || '',
            isVerified: salon.isPaymentActive || false,
            isOpen: salon.status === 'open' || salon.status === 'active' || !salon.status
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get salon info: ' + error.message });
    }
};

// ============================================
// SET WALLET PIN (Create or Update)
// ============================================
exports.setPin = async (req, res) => {
    try {
        const { userId, pin } = req.body;

        if (!pin || pin.length !== 4) {
            return res.status(400).json({ error: 'PIN must be 4 digits long' });
        }

        const wallet = await Wallet.findOne({ userId });
        if (!wallet) return res.status(404).json({ error: 'Wallet not found' });

        const salt = await bcrypt.genSalt(10);
        const hashedPin = await bcrypt.hash(pin.toString(), salt);

        wallet.walletPin = hashedPin;
        await wallet.save();

        res.status(200).json({ message: 'Wallet PIN set successfully', success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to set PIN: ' + error.message });
    }
};

// ============================================
// VERIFY WALLET PIN
// ============================================
exports.verifyPin = async (req, res) => {
    try {
        const { userId, pin } = req.body;

        if (!pin) {
            return res.status(400).json({ error: 'PIN is required' });
        }

        const wallet = await Wallet.findOne({ userId });
        if (!wallet) return res.status(404).json({ error: 'Wallet not found' });

        if (!wallet.walletPin) {
            return res.status(400).json({ error: 'PIN not set' });
        }

        const isMatch = await bcrypt.compare(pin.toString(), wallet.walletPin);

        if (!isMatch) {
            return res.status(400).json({ error: 'Incorrect PIN', success: false });
        }

        res.status(200).json({ message: 'PIN verified', success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to verify PIN: ' + error.message });
    }
};
