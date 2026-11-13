import io from 'socket.io-client';
import { ENV } from '../config/env';

let socket;

export const initSocket = () => {
    if (!socket) {
        // CRITICAL: Use SOCKET_URL (base URL), NOT API_URL (which has /api path)
        const socketUrl = ENV.SOCKET_URL || ENV.API_URL.replace('/api', '');
        socket = io(socketUrl, {
            transports: ['websocket'],
            autoConnect: true,
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000
        });

        socket.on('connect', () => {
        });
        
        socket.on('disconnect', () => {
        });
    }
    return socket;
};

export const getSocket = () => {
    if (!socket) {
        return initSocket();
    }
    return socket;
};

export const disconnectSocket = () => {
    if (socket) {
        socket.disconnect();
        socket = null;
    }
};
