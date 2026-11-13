const socketIo = require('socket.io');

let io;

const initSocket = (server) => {
    io = socketIo(server, {
        cors: {
            origin: "*", // Allow all origins for MVP
            methods: ["GET", "POST"]
        }
    });

    io.on('connection', (socket) => {
        console.log('New Client Connected:', socket.id);

        socket.on('joinSalon', (salonId) => {
            socket.join(salonId);
            console.log(`Socket ${socket.id} joined salon ${salonId}`);
        });

        // Alias for joinSalon (Frontend uses joinRoom)
        socket.on('joinRoom', (salonId) => {
            socket.join(salonId);
            console.log(`Socket ${socket.id} joined room ${salonId}`);
        });

        // Relay Customer Status (User -> Salon)
        socket.on('updateCustomerStatus', (data) => {
            console.log('Customer Status Update:', data);
            // Broadcast to the salon room so the Owner receives it
            io.to(data.salonId).emit('customerStatusUpdate', data);
        });

        socket.on('disconnect', () => {
            console.log('Client Disconnected:', socket.id);
        });
    });

    return io;
};

const getIo = () => {
    if (!io) {
        throw new Error('Socket.io not initialized!');
    }
    return io;
};

module.exports = { initSocket, getIo };
