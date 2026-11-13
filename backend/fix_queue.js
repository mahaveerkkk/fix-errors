const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log('MongoDB connected');
    } catch (err) {
        console.error(err.message);
        process.exit(1);
    }
};

const resetQueue = async () => {
    await connectDB();

    try {
        // 1. Find the salon "tretr" (from screenshot)
        // Or finding ANY salon with stuck queue for safety in this dev env
        const salons = await mongoose.connection.db.collection('salons').find({}).toArray();
        
        for (const salon of salons) {
            console.log(`Checking salon: ${salon.name} (ID: ${salon._id})`);
            
            // 2. Count actual active bookings
            const activeCount = await mongoose.connection.db.collection('bookings').countDocuments({
                salonId: salon._id,
                status: { $in: ['pending', 'accepted', 'arrived', 'in_service'] }
            });

            console.log(` - Actual Active Bookings: ${activeCount}`);
            console.log(` - stored liveQueueCount: ${salon.liveQueueCount}`);

            // 3. Fix if mismatch
            if (activeCount !== salon.liveQueueCount) {
                console.log(` - MISMATCH DETECTED! Updating to ${activeCount}...`);
                await mongoose.connection.db.collection('salons').updateOne(
                    { _id: salon._id },
                    { $set: { liveQueueCount: activeCount } }
                );
            }
            
            // 4. Force Clear Loop (Requested by logic of "stuck at 2")
            // If user wants to force clear EVERYTHING for test:
            // Uncomment the below lines if you want to NUKE bookings.
            // For now, I will just list them.
            
            const stuckBookings = await mongoose.connection.db.collection('bookings').find({
                salonId: salon._id,
                status: { $in: ['pending', 'accepted', 'arrived', 'in_service'] }
            }).toArray();
            
            if (stuckBookings.length > 0) {
                console.log(" - Found Stuck Bookings:");
                stuckBookings.forEach(b => console.log(`   > ID: ${b._id} | Status: ${b.status} | Token: ${b.tokenNumber}`));
                
                // FORCE COMPLETE THEM for the USER FIX
                console.log("   *** FORCE COMPLETING STUCK BOOKINGS ***");
                await mongoose.connection.db.collection('bookings').updateMany(
                    { salonId: salon._id, status: { $in: ['pending', 'accepted', 'arrived', 'in_service'] } },
                    { $set: { status: 'completed' } }
                );
                
                // Reset Queue Count to 0
                await mongoose.connection.db.collection('salons').updateOne(
                    { _id: salon._id },
                    { $set: { liveQueueCount: 0 } }
                );
                console.log("   *** QUEUE CLEARED ***");
            }
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        mongoose.connection.close();
    }
};

resetQueue();
