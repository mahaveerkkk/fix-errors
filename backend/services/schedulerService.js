const cron = require('node-cron');
const Booking = require('../models/Booking');
const Salon = require('../models/Salon');
const User = require('../models/User');
const { sendNotification } = require('./notificationService');

// Track which bookings have already been reminded (avoid duplicate notifications)
const remindedBookings = new Set();

// Clean up old reminded bookings every hour to prevent memory leak
setInterval(() => {
    remindedBookings.clear();
}, 60 * 60 * 1000); // Clear every hour

/**
 * NOTIFICATION 1: 30-Minute Appointment Reminder
 * Runs every 5 minutes
 * Checks queue for each salon and estimates when each user's turn will come
 * Sends notification when a user's turn is approximately 30 minutes away
 */
const startQueueReminderJob = () => {
    // Run every 5 minutes
    cron.schedule('*/5 * * * *', async () => {
        try {
            // Get all salons that are open
            const salons = await Salon.find({ status: { $in: ['open', 'active'] } });

            for (const salon of salons) {
                // Get all active bookings for this salon, sorted by token
                const activeBookings = await Booking.find({
                    salonId: salon._id,
                    status: { $in: ['accepted'] }
                }).sort({ tokenNumber: 1 });

                if (activeBookings.length < 2) continue; // No one waiting

                // First booking is currently being served
                const currentlyServing = activeBookings[0];
                const currentStartTime = currentlyServing.serviceStartTime || currentlyServing.updatedAt;
                const currentDuration = currentlyServing.estimatedDuration || 30;

                // Calculate remaining time for current service
                const now = new Date();
                const elapsedMins = (now - new Date(currentStartTime)) / (1000 * 60);
                let remainingForCurrent = Math.max(0, currentDuration - elapsedMins);

                // For each waiting person, calculate their estimated wait time
                let cumulativeWait = remainingForCurrent;

                for (let i = 1; i < activeBookings.length; i++) {
                    const booking = activeBookings[i];
                    const bookingId = booking._id.toString();

                    // Check if wait time is approximately 25-35 minutes (30 min window)
                    if (cumulativeWait >= 25 && cumulativeWait <= 35 && !remindedBookings.has(bookingId)) {
                        remindedBookings.add(bookingId);

                        // Notify User
                        if (booking.userId) {
                            const user = await User.findById(booking.userId);
                            if (user && user.fcmToken) {
                                await sendNotification(
                                    user.fcmToken,
                                    '⏰ Appointment Reminder',
                                    `Your turn at ${salon.name} is in ~${Math.round(cumulativeWait)} mins! Please start heading there.`
                                );
                            }
                        }

                        // Notify Salon Owner
                        const owner = await User.findById(salon.ownerId);
                        if (owner && owner.fcmToken) {
                            const userName = booking.userId
                                ? (await User.findById(booking.userId))?.name || 'A customer'
                                : booking.walkInName || 'Walk-in';
                            await sendNotification(
                                owner.fcmToken,
                                '⏰ Upcoming Customer Reminder',
                                `${userName} (Token #${booking.tokenNumber}) will be next in ~${Math.round(cumulativeWait)} mins.`
                            );
                        }
                    }

                    // Add this person's estimated duration to cumulative wait
                    cumulativeWait += (booking.estimatedDuration || 30);
                }
            }
        } catch (error) {
        }
    });
};

/**
 * NOTIFICATION 2: Daily Summary for Salon Owners
 * Runs every day at 9:00 PM IST (15:30 UTC)
 * Sends a summary of the day's activity: customers served, revenue earned
 */
const startDailySummaryJob = () => {
    // Run at 9:00 PM IST every day (IST = UTC+5:30, so 9 PM IST = 3:30 PM UTC)
    // Cron: minute hour * * * → 30 15 * * * (UTC) = 9:00 PM IST
    cron.schedule('30 15 * * *', async () => {
        try {
            // Get today's date range (IST)
            const now = new Date();
            const todayStart = new Date(now);
            todayStart.setHours(0, 0, 0, 0);
            const todayEnd = new Date(now);
            todayEnd.setHours(23, 59, 59, 999);

            // Get all active salons
            const salons = await Salon.find({ status: { $in: ['open', 'active', 'closed'] } });

            for (const salon of salons) {
                // Count completed bookings today
                const completedToday = await Booking.find({
                    salonId: salon._id,
                    status: 'completed',
                    updatedAt: { $gte: todayStart, $lte: todayEnd }
                });

                const customersServed = completedToday.length;
                const totalRevenue = completedToday.reduce((sum, b) => sum + (b.totalAmount || 0), 0);

                // Count cancelled bookings today
                const cancelledToday = await Booking.countDocuments({
                    salonId: salon._id,
                    status: 'cancelled',
                    updatedAt: { $gte: todayStart, $lte: todayEnd }
                });

                // Only send if there was activity today
                if (customersServed === 0 && cancelledToday === 0) continue;

                // Get salon owner
                const owner = await User.findById(salon.ownerId);
                if (!owner || !owner.fcmToken) continue;

                // Build summary message
                let body = `${customersServed} customer${customersServed !== 1 ? 's' : ''} served`;
                if (totalRevenue > 0) {
                    body += `. Revenue: ₹${totalRevenue.toLocaleString('en-IN')}`;
                }
                if (cancelledToday > 0) {
                    body += `. ${cancelledToday} cancelled`;
                }
                body += '. Great job! 💪';

                await sendNotification(
                    owner.fcmToken,
                    `📊 Today's Summary — ${salon.name}`,
                    body
                );
            }
        } catch (error) {
        }
    });
};

/**
 * CRON JOB 3: Daily 2 AM Salon Visitor Cleanup & Reset
 * Runs every day at 2:00 AM IST (20:30 UTC)
 * Deletes SalonView entries older than 24 hours to prevent DB storage bloat
 */
const startDailyVisitorCleanupJob = () => {
    // 2:00 AM IST = 8:30 PM UTC previous day (30 20 * * *)
    cron.schedule('30 20 * * *', async () => {
        try {
            const SalonView = require('../models/SalonView');
            const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

            const result = await SalonView.deleteMany({ viewedAt: { $lt: twentyFourHoursAgo } });
            console.log(`[CRON 2 AM RESET] Cleaned up ${result.deletedCount} old SalonView entries. DB storage optimized!`);
        } catch (error) {
            console.error('[CRON 2 AM RESET ERROR]:', error.message);
        }
    });
};

/**
 * CRON JOB 4: Daily 11:59 PM Midnight Queue Reset & Walk-in Cleanup
 * Runs every day at 11:59 PM IST (18:29 UTC)
 * Auto-cancels unserved walk-in tokens and stale queue bookings, resetting queues to 0 for next morning.
 */
const startMidnightQueueResetJob = () => {
    // 11:59 PM IST = 6:29 PM UTC (29 18 * * *)
    cron.schedule('29 18 * * *', async () => {
        try {
            console.log('[CRON 11:59 PM RESET] Starting daily end-of-day queue cleanup...');
            const endOfToday = new Date();
            endOfToday.setHours(23, 59, 59, 999);

            // 1. Auto-cancel all unserved walk-ins and stale queue bookings created on or before today
            const cancelResult = await Booking.updateMany(
                {
                    status: { $in: ['pending', 'accepted', 'arrived', 'in_service'] },
                    $or: [
                        { isWalkIn: true },
                        { bookingType: 'queue' },
                        { appointmentDate: { $lte: endOfToday } },
                        { createdAt: { $lte: endOfToday } }
                    ]
                },
                {
                    $set: {
                        status: 'cancelled',
                        cancellationReason: 'Auto-expired at end of day (unserved queue/walk-in)',
                        cancelledBy: 'salon'
                    }
                }
            );

            console.log(`[CRON 11:59 PM RESET] Cancelled ${cancelResult.modifiedCount} stale queue/walk-in bookings.`);

            // 2. Synchronize liveQueueCount to real active count (or 0) for all salons
            const allSalons = await Salon.find({});
            for (const salon of allSalons) {
                const remainingActive = await Booking.countDocuments({
                    salonId: salon._id,
                    status: { $in: ['pending', 'accepted', 'arrived', 'in_service'] }
                });

                salon.liveQueueCount = remainingActive;

                // Also reset any expired break
                if (salon.breakInfo?.isOnBreak) {
                    salon.breakInfo.isOnBreak = false;
                    salon.breakInfo.breakEndTime = null;
                }

                // Reset staff queue counts
                if (salon.staff && salon.staff.length > 0) {
                    salon.staff.forEach(s => {
                        s.liveQueueCount = 0;
                    });
                }

                await salon.save();
            }

            // 3. Broadcast socket update so connected clients refresh
            try {
                const { getIo } = require('../socket');
                const io = getIo();
                io.emit('queueUpdate', { action: 'midnight_reset', message: 'Daily queue cleared for a fresh start.' });
            } catch (socketErr) { }

            console.log('[CRON 11:59 PM RESET] All salon queues synchronized for tomorrow.');
        } catch (error) {
            console.error('[CRON 11:59 PM RESET ERROR]:', error.message);
        }
    });
};

/**
 * Initialize all scheduled jobs
 */
const initScheduler = () => {
    startQueueReminderJob();
    startDailySummaryJob();
    startDailyVisitorCleanupJob();
    startMidnightQueueResetJob();
};

module.exports = { initScheduler };
