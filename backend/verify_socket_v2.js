const io = require('socket.io-client');
const fs = require('fs');

const SOCKET_URL = 'http://localhost:5000';
const MOCK_SALON_ID = '67727c6e3b5e1b1234567890';
const LOG_FILE = 'verify_result.txt';

function log(msg) {
    fs.appendFileSync(LOG_FILE, msg + '\n');
    console.log(msg);
}

// Clear log file
if (fs.existsSync(LOG_FILE)) fs.unlinkSync(LOG_FILE);

log('🚀 Starting Socket Verification V2...');

const ownerSocket = io(SOCKET_URL);
const userSocket = io(SOCKET_URL);

let verified = false;

ownerSocket.on('connect', () => {
    log(`✅ Owner Connected: ${ownerSocket.id}`);
    ownerSocket.emit('joinRoom', MOCK_SALON_ID);
});

userSocket.on('connect', () => {
    log(`✅ User Connected: ${userSocket.id}`);
    userSocket.emit('joinRoom', MOCK_SALON_ID);

    setTimeout(() => {
        log('📤 User sending status update...');
        userSocket.emit('updateCustomerStatus', {
            salonId: MOCK_SALON_ID,
            message: 'Testing Message',
            userId: 'test_user'
        });
    }, 1000);
});

ownerSocket.on('customerStatusUpdate', (data) => {
    log('🎉 VERIFIED: Owner received customer status!');
    log('   Data: ' + JSON.stringify(data));
    verified = true;
    cleanup();
});

function cleanup() {
    if (verified) {
        log('🏁 SUCCESS');
    } else {
        log('❌ FAILED/TIMEOUT');
    }
    ownerSocket.disconnect();
    userSocket.disconnect();
    // process.exit(0); // Don't exit immediately to let file flush?
}

setTimeout(() => {
    if (!verified) {
        log('⏰ Timeout reached');
        cleanup();
    }
}, 5000);
