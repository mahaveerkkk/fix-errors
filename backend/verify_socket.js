const io = require('socket.io-client');

const SOCKET_URL = 'http://localhost:5000';

// Mock Data
const MOCK_SALON_ID = '67727c6e3b5e1b1234567890'; // Use a dummy ID if real one unknown, or fetch one first if needed.
// Better to simple use a random ID as our server joins any room.

console.log('🚀 Starting Socket Verification...');

// 1. Simulate Salon Owner Client
const ownerSocket = io(SOCKET_URL);

// 2. Simulate Customer Client
const userSocket = io(SOCKET_URL);

ownerSocket.on('connect', () => {
    console.log('✅ Owner Connected:', ownerSocket.id);
    ownerSocket.emit('joinRoom', MOCK_SALON_ID);
});

userSocket.on('connect', () => {
    console.log('✅ User Connected:', userSocket.id);
    userSocket.emit('joinRoom', MOCK_SALON_ID); // User joins same salon room

    // Test: User sends "On the way" status
    console.log('📤 User sending status update...');
    userSocket.emit('updateCustomerStatus', {
        salonId: MOCK_SALON_ID,
        message: 'I am 5 mins away',
        userId: 'user_123'
    });
});

// Verification Listeners

// Owner should receive customer status
ownerSocket.on('customerStatusUpdate', (data) => {
    console.log('🎉 VERIFIED: Owner received customer status!');
    console.log('   Data:', data);
    
    // Once verified, disconnect
    cleanup();
});

// Both should receive queue updates (Simulated)
// Note: We can't easily trigger a backend database update from here without calling the API.
// But we can verify the 'updateCustomerStatus' flow which relies on socket relay.

function cleanup() {
    console.log('🏁 Test Completed. Disconnecting...');
    ownerSocket.disconnect();
    userSocket.disconnect();
    process.exit(0);
}

// Timeout if no event received
setTimeout(() => {
    console.log('❌ Timeout: Did not receive expected events.');
    cleanup();
}, 5000);
