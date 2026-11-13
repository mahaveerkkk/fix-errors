require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

const promoteToOwner = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB.');

        const email = 'test@example.com';
        const user = await User.findOne({ email });

        if (!user) {
            console.log('User not found!');
            process.exit(1);
        }

        user.role = 'owner';
        user.isPaymentActive = true; // Required to register salon
        await user.save();

        console.log(`✅ User ${user.name} promoted to OWNER.`);
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
};

promoteToOwner();
