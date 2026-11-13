const express = require('express');
const router = express.Router();
const walletController = require('../controllers/walletController');
const { verifyToken, isOwner } = require('../middleware/authMiddleware');

// ============================================
// PUBLIC ROUTES — No auth required
// ============================================
// Get salon info for QR scan result (public — scanned by any user)
router.get('/scan/:salonId', walletController.getSalonForQR);

// ============================================
// AUTHENTICATED ROUTES — Login required
// ============================================
router.use(verifyToken);

// Get wallet info (balance, scratch cards, transactions)
router.get('/:userId', walletController.getWallet);

// Scratch a card (reveal & credit)
router.post('/scratch/:userId/:cardId', walletController.scratchCard);

// Add money — create Razorpay order
router.post('/add-money/create-order', walletController.addMoneyCreateOrder);

// Add money — verify payment & credit
router.post('/add-money/verify', walletController.addMoneyVerify);

// Pay salon via QR scan
router.post('/pay-salon', walletController.paySalon);

// PIN Management
router.post('/set-pin', walletController.setPin);
router.post('/verify-pin', walletController.verifyPin);

// ============================================
// OWNER ROUTES — Login + Owner role required
// ============================================
// Get salon wallet (for salon owner)
router.get('/salon/:salonId', isOwner, walletController.getSalonWallet);

// Pay subscription from wallet balance
router.post('/pay-subscription', isOwner, walletController.paySubscription);

module.exports = router;

