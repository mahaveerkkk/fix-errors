const mongoose = require('mongoose');
const { admin } = require('../config/firebaseConfig');
require('dotenv').config();

const runTest = async () => {
    console.log('--- STARTING AUTH & DB VERIFICATION ---');

    // 1. Check Env Vars
    console.log('\n1. Checking Environment Variables...');
    if (!process.env.MONGO_URI) console.error('❌ MONGO_URI is missing');
    else console.log('✅ MONGO_URI found');

    if (!process.env.CLOUDINARY_CLOUD_NAME) console.warn('⚠️ CLOUDINARY_CLOUD_NAME is missing (Uploads wont work)');
    else console.log('✅ Cloudinary Config found');

    // 2. Check Firebase
    console.log('\n2. Verifying Firebase Admin...');
    try {
        if (admin.apps.length > 0) {
            console.log('✅ Firebase Admin Initialized Successfully');
            console.log('   Project ID:', admin.app().options.credential.projectId);
        } else {
            console.error('❌ Firebase Admin NOT Initialized');
        }
    } catch (e) {
        console.error('❌ Firebase Error:', e.message);
    }

    // 3. Check MongoDB
    console.log('\n3. Connecting to MongoDB...');
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ MongoDB Connected Successfully');
        console.log('   DB Name:', mongoose.connection.name);
        console.log('   Host:', mongoose.connection.host);
    } catch (e) {
        console.error('❌ MongoDB Connection Failed:', e.message);
    }

    console.log('\n--- VERIFICATION COMPLETE ---');
    process.exit(0);
};

runTest();
