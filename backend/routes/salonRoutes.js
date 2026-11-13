const express = require('express');
const router = express.Router();
const salonController = require('../controllers/salonController');
const { verifyToken, isOwner, isAdmin, verifySalonOwnership } = require('../middleware/authMiddleware');

// ============================================
// PUBLIC ROUTES — No auth required
// ============================================
router.get('/nearby', salonController.getNearbySalons);
router.get('/reviews/:salonId', salonController.getReviews);
router.get('/available-slots/:salonId', salonController.getAvailableSlots);
router.get('/queue/:salonId', salonController.getSalonQueue);


// Specific owner GET endpoints (Must be declared before /:salonId)
router.get('/earnings', verifyToken, isOwner, salonController.getEarnings);
router.get('/analytics', verifyToken, isOwner, salonController.getAnalytics);

// Public single salon details by ID
router.get('/:salonId', salonController.getSalonById);

// ============================================
// AUTHENTICATED ROUTES — Login required (any role)
// ============================================
router.use(verifyToken); // All routes below require valid Firebase token

// User booking & interaction
router.post('/book', salonController.bookService);
router.post('/book-appointment', salonController.bookAppointment);
router.post('/cancel-by-user', salonController.cancelBookingByUser);
router.post('/review', salonController.addReview);
router.get('/can-review', salonController.canReview);
router.get('/pending-review', salonController.getPendingReview);
router.post('/like-review', salonController.likeReview);
router.get('/user-bookings/:userId', salonController.getUserBookings);
router.post('/booking/status', salonController.updateCustomerStatus);
router.post('/:salonId/customer-status', salonController.customerStatus);

// ============================================
// OWNER ROUTES — Login + Owner role required
// ============================================
router.post('/register', isOwner, salonController.registerSalon);
router.post('/toggle-status', isOwner, salonController.toggleStatus);
router.post('/toggle-break', isOwner, salonController.toggleBreak);
router.post('/update-queue', isOwner, salonController.updateQueue);
router.post('/respond-booking', isOwner, salonController.respondToBooking);
router.get('/history/:salonId', isOwner, salonController.getSalonHistory);
router.post('/booking/complete', isOwner, salonController.completeBooking);
router.post('/walk-in', isOwner, salonController.addWalkIn);
router.post('/quick-walk-in', isOwner, salonController.quickAddWalkIn);
router.post('/send-status-to-customer', isOwner, salonController.sendStatusToNextCustomer);
router.get('/upcoming-appointments/:salonId', isOwner, salonController.getUpcomingAppointments);

// Service Management (Owner only)
router.post('/services/add', isOwner, salonController.addService);
router.put('/services/:salonId/:serviceName', isOwner, salonController.updateService);
router.delete('/services/:salonId/:serviceName', isOwner, salonController.deleteService);

// Staff Management (Owner only)
router.post('/staff/add', isOwner, salonController.addStaff);
router.delete('/staff/:salonId/:staffId', isOwner, salonController.removeStaff);
router.put('/staff/:salonId/:staffId', isOwner, salonController.updateStaff);

// Customer Analytics (Owner only)
router.get('/customer-profile/:salonId/:userId', isOwner, salonController.getCustomerProfile);
router.post('/customer-note', isOwner, salonController.saveCustomerNote);

// Salon Profile Update (Owner only)
router.put('/:salonId', isOwner, salonController.updateSalon);

// Salon Profile Visitors Today (Owner only)
router.get('/:id/visitors', isOwner, salonController.getTodayVisitors);

// ============================================
// ADMIN ROUTES — Login + Admin role required
// ============================================
router.get('/admin/all', isAdmin, salonController.getAllSalons);
router.post('/admin/block/:salonId', isAdmin, salonController.toggleSalonBlock);

module.exports = router;

