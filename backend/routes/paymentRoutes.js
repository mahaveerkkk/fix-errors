const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { verifyToken } = require('../middleware/authMiddleware');

// PUBLIC — Razorpay key needed by frontend SDK initialization
router.get('/key', paymentController.getRazorpayKey);

// AUTHENTICATED — Payment operations require login
router.post('/create-order', verifyToken, paymentController.createSubscriptionOrder);
router.post('/verify-signature', verifyToken, paymentController.verifySubscriptionPayment);

module.exports = router;

