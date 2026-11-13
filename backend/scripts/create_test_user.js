const { admin } = require('./config/firebaseConfig');

async function createTestUser() {
    try {
        const email = 'test@example.com';
        const password = 'password123';

        // Check if exists
        try {
            const user = await admin.auth().getUserByEmail(email);
            console.log('User already exists:', user.uid);
            return;
        } catch (e) {
            // Not found, create
        }

        const userRecord = await admin.auth().createUser({
            email: email,
            emailVerified: true,
            password: password,
            displayName: 'Test User',
            disabled: false
        });

        console.log('✅ Successfully created new user:', userRecord.uid);
        console.log('Email:', email);
        console.log('Password:', password);
    } catch (error) {
        console.error('Error creating new user:', error);
    } finally {
        process.exit(0);
    }
}

createTestUser();
