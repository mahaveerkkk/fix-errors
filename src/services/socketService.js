import io from 'socket.io-client';
import { ENV } from '../config/env';

const SOCKET_URL = ENV.API_URL.replace('/api', '');

class SocketService {
    constructor() {
        this.socket = null;
        this.isConnected = false;
    }

    // Initialize Socket Connection
    connect() {
        if (this.socket) return this.socket;

        this.socket = io(SOCKET_URL, {
            transports: ['websocket'],
            jsonp: false
        });

        this.socket.on('connect', () => {
            this.isConnected = true;
        });

        this.socket.on('disconnect', () => {
            this.isConnected = false;
        });
        
        this.socket.on('connect_error', (err) => {
        });

        return this.socket;
    }

    // Join a specific Salon Room
    joinRoom(salonId) {
        if (this.socket && salonId) {
            this.socket.emit('joinRoom', salonId);
            // Also join the 'salon_{salonId}' specifically if backend expects different rooms
            // But based on backend/socket.js it just listens to 'joinSalon'
            this.socket.emit('joinSalon', salonId); 
        }
    }

    // Leave Room
    leaveRoom(salonId) {
        if (this.socket && salonId) {
            this.socket.emit('leaveRoom', salonId);
        }
    }

    // Listen for events
    on(event, callback) {
        if (this.socket) {
            this.socket.on(event, callback);
        }
    }

    // Remove listener
    off(event) {
        if (this.socket) {
            this.socket.off(event);
        }
    }

    // Emit event
    emit(event, data) {
        if (this.socket) {
            this.socket.emit(event, data);
        }
    }

    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
    }
}

// Export as Singleton
const socketService = new SocketService();
export default socketService;
