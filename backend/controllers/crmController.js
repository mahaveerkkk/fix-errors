const Booking = require('../models/Booking');
const mongoose = require('mongoose');
const Salon = require('../models/Salon');
const SalonView = require('../models/SalonView');

// ============ MAIN CRM ENDPOINT ============
exports.getSalonCustomers = async (req, res) => {
    try {
        const { salonId } = req.params;
        const { filter } = req.query; // 'all', 'vip', 'regular', 'new', 'one_time', 'at_risk', 'lost', 'birthdays', 'top_spenders', 'viewers'

        // Ensure user is the owner of this salon
        const salon = await Salon.findById(salonId);
        if (!salon) return res.status(404).json({ message: 'Salon not found' });

        if (salon.ownerId.toString() !== req.user.mongoId?.toString() && req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Unauthorized. Only salon owner can view CRM data.' });
        }

        const today = new Date();
        const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
        const fortyFiveDaysAgo = new Date(today.getTime() - 45 * 24 * 60 * 60 * 1000);

        // ====== VIEWERS FILTER (Special — from SalonView, not Bookings) ======
        if (filter === 'viewers') {
            return await getViewersData(salonId, res);
        }

        // ====== AGGREGATE BOOKINGS BY USER ======
        let customerData = await Booking.aggregate([
            { $match: { salonId: new mongoose.Types.ObjectId(salonId), userId: { $exists: true, $ne: null } } },
            { $group: {
                _id: "$userId",
                totalVisits: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } },
                totalBookings: { $sum: 1 },
                lifetimeSpend: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, "$totalAmount", 0] } },
                lastVisitDate: { $max: "$createdAt" },
                firstVisitDate: { $min: "$createdAt" },
                services: { $push: "$services" }
            }},
            { $lookup: {
                from: "users",
                localField: "_id",
                foreignField: "_id",
                as: "user"
            }},
            { $unwind: "$user" },
            { $project: {
                _id: 1,
                totalVisits: 1,
                totalBookings: 1,
                lifetimeSpend: 1,
                lastVisitDate: 1,
                firstVisitDate: 1,
                name: "$user.name",
                phone: "$user.phone",
                profilePhoto: "$user.profilePhoto",
                dob: "$user.dob",
                gender: "$user.gender"
            }},
            { $sort: { lastVisitDate: -1 } }
        ]);

        // ====== APPLY FILTERS ======
        let result = customerData;

        switch (filter) {
            case 'vip':
                result = customerData.filter(c => c.totalVisits >= 10 || c.lifetimeSpend >= 5000);
                break;

            case 'regular':
                result = customerData.filter(c =>
                    c.totalVisits >= 3 && c.totalVisits < 10 &&
                    new Date(c.lastVisitDate) >= thirtyDaysAgo
                );
                break;

            case 'new':
                result = customerData.filter(c =>
                    new Date(c.firstVisitDate) >= thirtyDaysAgo
                );
                break;

            case 'one_time':
                result = customerData.filter(c => c.totalVisits === 1);
                break;

            case 'at_risk':
                result = customerData.filter(c => {
                    const lastVisit = new Date(c.lastVisitDate);
                    return lastVisit < thirtyDaysAgo && lastVisit >= fortyFiveDaysAgo;
                });
                break;

            case 'lost':
                result = customerData.filter(c =>
                    new Date(c.lastVisitDate) < fortyFiveDaysAgo
                );
                break;

            case 'birthdays':
                const currentMonth = today.getMonth();
                result = customerData.filter(c => {
                    if (!c.dob) return false;
                    return new Date(c.dob).getMonth() === currentMonth;
                });
                break;

            case 'top_spenders':
                const sorted = [...customerData].sort((a, b) => b.lifetimeSpend - a.lifetimeSpend);
                const topCount = Math.max(10, Math.ceil(sorted.length * 0.2));
                result = sorted.slice(0, topCount);
                break;

            case 'gained': {
                const gainedCandidates = customerData.filter(c =>
                    new Date(c.firstVisitDate) >= thirtyDaysAgo
                );
                const gainedResults = [];
                for (const cust of gainedCandidates) {
                    const priorBookingsAtOthers = await Booking.countDocuments({
                        userId: cust._id,
                        salonId: { $ne: new mongoose.Types.ObjectId(salonId) },
                        createdAt: { $lt: cust.firstVisitDate },
                        status: 'completed'
                    });
                    if (priorBookingsAtOthers > 0) {
                        gainedResults.push({ ...cust, previousSalonVisits: priorBookingsAtOthers });
                    }
                }
                result = gainedResults;
                break;
            }

            case 'lost_to_others': {
                const lostCandidates = customerData.filter(c =>
                    new Date(c.lastVisitDate) < thirtyDaysAgo && c.totalVisits >= 2
                );
                const lostResults = [];
                for (const cust of lostCandidates) {
                    const recentBookingsElsewhere = await Booking.countDocuments({
                        userId: cust._id,
                        salonId: { $ne: new mongoose.Types.ObjectId(salonId) },
                        createdAt: { $gte: thirtyDaysAgo },
                        status: { $in: ['completed', 'accepted', 'pending'] }
                    });
                    if (recentBookingsElsewhere > 0) {
                        lostResults.push({ ...cust, bookingsElsewhere: recentBookingsElsewhere });
                    }
                }
                result = lostResults;
                break;
            }

            default: // 'all'
                result = customerData;
                break;
        }

        // ====== COMPUTE SUMMARY STATS ======
        const totalCustomers = customerData.length;
        const vipCount = customerData.filter(c => c.totalVisits >= 10 || c.lifetimeSpend >= 5000).length;
        const regularCount = customerData.filter(c => c.totalVisits >= 3 && c.totalVisits < 10 && new Date(c.lastVisitDate) >= thirtyDaysAgo).length;
        const newCount = customerData.filter(c => new Date(c.firstVisitDate) >= thirtyDaysAgo).length;
        const oneTimeCount = customerData.filter(c => c.totalVisits === 1).length;
        const atRiskCount = customerData.filter(c => {
            const lv = new Date(c.lastVisitDate);
            return lv < thirtyDaysAgo && lv >= fortyFiveDaysAgo;
        }).length;
        const lostCount = customerData.filter(c => new Date(c.lastVisitDate) < fortyFiveDaysAgo).length;
        const birthdayMonth = today.getMonth();
        const birthdayCount = customerData.filter(c => c.dob && new Date(c.dob).getMonth() === birthdayMonth).length;

        // Salon View Stats (last 30 days)
        const viewStats = await getSalonViewStats(salonId, thirtyDaysAgo);

        res.json({
            summary: {
                totalCustomers,
                vipCount,
                regularCount,
                newCount,
                oneTimeCount,
                atRiskCount,
                lostCount,
                birthdayCount,
                gainedCount: filter === 'gained' ? result.length : undefined,
                lostToOthersCount: filter === 'lost_to_others' ? result.length : undefined,
                totalViews: viewStats.totalViews,
                uniqueViewers: viewStats.uniqueViewers,
                viewersNotBooked: viewStats.viewersNotBooked,
            },
            customers: result
        });

    } catch (error) {
        console.error('CRM Fetch Error:', error);
        res.status(500).json({ message: 'Error fetching CRM data' });
    }
};

// ============ SALON VIEW STATS (Helper) ============
async function getSalonViewStats(salonId, since) {
    try {
        const salonObjId = new mongoose.Types.ObjectId(salonId);

        const totalViews = await SalonView.countDocuments({
            salonId: salonObjId,
            viewedAt: { $gte: since }
        });

        const uniqueViewersAgg = await SalonView.aggregate([
            { $match: { salonId: salonObjId, viewedAt: { $gte: since } } },
            { $group: { _id: "$userId" } },
            { $count: "count" }
        ]);
        const uniqueViewers = uniqueViewersAgg[0]?.count || 0;

        const viewerIds = await SalonView.distinct('userId', {
            salonId: salonObjId,
            viewedAt: { $gte: since }
        });

        const bookerIds = await Booking.distinct('userId', {
            salonId: salonObjId,
            createdAt: { $gte: since }
        });

        const bookerIdSet = new Set(bookerIds.map(id => id.toString()));
        const viewersNotBooked = viewerIds.filter(id => !bookerIdSet.has(id.toString())).length;

        return { totalViews, uniqueViewers, viewersNotBooked };
    } catch (err) {
        console.error('View stats error:', err);
        return { totalViews: 0, uniqueViewers: 0, viewersNotBooked: 0 };
    }
}

// ============ VIEWERS DATA ============
async function getViewersData(salonId, res) {
    try {
        const salonObjId = new mongoose.Types.ObjectId(salonId);
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

        const viewers = await SalonView.aggregate([
            { $match: { salonId: salonObjId, viewedAt: { $gte: thirtyDaysAgo } } },
            { $sort: { viewedAt: -1 } },
            { $group: {
                _id: "$userId",
                lastViewed: { $first: "$viewedAt" },
                viewCount: { $sum: 1 }
            }},
            { $lookup: {
                from: "users",
                localField: "_id",
                foreignField: "_id",
                as: "user"
            }},
            { $unwind: "$user" },
            { $project: {
                _id: 1,
                lastViewed: 1,
                viewCount: 1,
                name: "$user.name",
                phone: "$user.phone",
                profilePhoto: "$user.profilePhoto",
                dob: "$user.dob",
                gender: "$user.gender"
            }},
            { $sort: { lastViewed: -1 } }
        ]);

        const bookerIds = await Booking.distinct('userId', {
            salonId: salonObjId,
            createdAt: { $gte: thirtyDaysAgo }
        });
        const bookerIdSet = new Set(bookerIds.map(id => id.toString()));

        const result = viewers.map(v => ({
            ...v,
            didBook: bookerIdSet.has(v._id.toString()),
            totalVisits: v.viewCount,
            lifetimeSpend: 0,
            lastVisitDate: v.lastViewed,
        }));

        res.json({
            summary: {
                totalCustomers: viewers.length,
                viewersNotBooked: result.filter(v => !v.didBook).length,
            },
            customers: result
        });
    } catch (error) {
        console.error('Viewers fetch error:', error);
        res.status(500).json({ message: 'Error fetching viewers data' });
    }
}

// ============ LOG SALON VIEW ============
exports.logSalonView = async (req, res) => {
    try {
        const { salonId } = req.params;
        const userId = req.user.mongoId;

        if (!userId) return res.status(200).json({ logged: false });

        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        const recentView = await SalonView.findOne({
            userId,
            salonId,
            viewedAt: { $gte: oneHourAgo }
        });

        if (!recentView) {
            await SalonView.create({ userId, salonId, viewedAt: new Date() });
        }

        res.status(200).json({ logged: true });
    } catch (error) {
        console.error('Log view error:', error);
        res.status(200).json({ logged: false });
    }
};
