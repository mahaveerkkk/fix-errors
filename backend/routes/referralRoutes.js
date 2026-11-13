const express = require('express');
const router = express.Router();
const referralController = require('../controllers/referralController');
const { verifyToken } = require('../middleware/authMiddleware');

// PUBLIC — Validate a referral code (needed during signup before login)
router.post('/validate-code', referralController.validateCode);

// Check if a salon has a referral (for showing discount in UI)
router.get('/check-salon/:salonId', referralController.checkSalonReferral);

// ============================================
// AUTHENTICATED ROUTES — Login required
// ============================================
router.use(verifyToken);

// Get/Generate my referral code + stats
router.get('/my-code/:userId', referralController.getMyReferralCode);

// Apply referral code — salon owner uses during/after signup
router.post('/apply', referralController.applyReferralCode);

// Get referral stats (dashboard data)
router.get('/stats/:userId', referralController.getReferralStats);

// Get detailed referral history with installments
router.get('/history/:userId', referralController.getReferralHistory);

module.exports = router;

