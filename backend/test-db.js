require('dotenv').config();
const mongoose = require('mongoose');

async function testConnection() {
    try {
        console.log('Testing URI:', process.env.MONGO_URI ? 'URI set' : 'URI NOT FOUND');
        const conn = await mongoose.connect(process.env.MONGO_URI);
        console.log('SUCCESS: Connected to', conn.connection.host);
        console.log('Database Name:', conn.connection.name);
        await mongoose.disconnect();
    } catch (err) {
        console.error('FAILURE:', err.message);
    }
}

testConnection();
