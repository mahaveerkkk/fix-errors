const mongoose = require('mongoose');
const dns = require('dns');

// Force IPv4 and use Google DNS to fix SRV lookup issues on Windows
dns.setDefaultResultOrder('ipv4first');
dns.setServers(['8.8.8.8', '8.8.4.4']);

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/smartsalon', {
            family: 4,  // Force IPv4
            serverSelectionTimeoutMS: 10000,
        });
        console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
        console.log(`📂 Database Name: ${conn.connection.name}`);

        // Count documents for diagnostic
        const User = require('../models/User');
        const Salon = require('../models/Salon');
        const userCount = await User.countDocuments();
        const salonCount = await Salon.countDocuments();
        console.log(`📊 Stats: ${userCount} Users, ${salonCount} Salons in this database.`);
    } catch (error) {
        console.error(`Error: ${error.message}`);
        console.error('❌ MongoDB Connection Failed. Please check your MONGO_URI.');
        process.exit(1); // Exit process with failure
    }
};

module.exports = connectDB;
