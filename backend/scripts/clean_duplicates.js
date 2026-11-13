const mongoose = require('mongoose');
require('dotenv').config();
const User = require('../models/User');
const Salon = require('../models/Salon');

async function cleanDuplicates() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        const users = await User.find().sort({ createdAt: 1 });
        const emailMap = new Map();

        for (const user of users) {
            if (!emailMap.has(user.email)) {
                emailMap.set(user.email, [user]);
            } else {
                emailMap.get(user.email).push(user);
            }
        }

        for (const [email, userList] of emailMap) {
            if (userList.length > 1) {
                console.log(`Found ${userList.length} duplicates for ${email}`);

                // Prioritize user with salon
                let keeper = null;
                for (const u of userList) {
                    const salon = await Salon.findOne({ ownerId: u._id });
                    if (salon) {
                        keeper = u;
                        break;
                    }
                }

                // If no salon, keep the latest one (or earliest? User said "login into existing one", usually earliest is better, but let's keep the one with most info)
                // Let's keep the earliest one as the "original" account
                if (!keeper) {
                    keeper = userList[0];
                }

                console.log(`Keeping user ${keeper._id} (${keeper.email})`);

                for (const u of userList) {
                    if (u._id.toString() !== keeper._id.toString()) {
                        console.log(`Deleting duplicate ${u._id}`);
                        await User.findByIdAndDelete(u._id);
                    }
                }
            }
        }

        console.log('Cleanup Complete');
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

cleanDuplicates();
