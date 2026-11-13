require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

const listUsers = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB.');

        const users = await User.find({});
        const fs = require('fs');
        let output = `Found ${users.length} users in MongoDB:\n`;
        users.forEach(u => {
            output += `- Name: ${u.name}, Email: ${u.email}, UID: ${u.firebaseUid}, Role: ${u.role}\n`;
        });
        fs.writeFileSync('users.txt', output);
        console.log('User list saved to users.txt');

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
};

listUsers();
