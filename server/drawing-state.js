/**
 * Drawing State Management Module
 * Handles canvas state synchronization and drawing operations
 */

// User connections registry
const userConnections = new Map(); // userId -> { ws, userData, roomId }

export function addUserConnection(userId, connectionData) {
    userConnections.set(userId, connectionData);
}

export function removeUserConnection(userId) {
    userConnections.delete(userId);
}

export function getUserConnection(userId) {
    return userConnections.get(userId);
}

export function getUserConnections() {
    return userConnections;
}

/**
 * Get all connected WebSocket clients in a room (readyState === 1)
 */
export function getRoomClients(roomId, wss) {
    const clients = [];

    for (const client of wss.clients) {
        const userData = userConnections.get(client.userId);
        if (userData && userData.roomId === roomId && client.readyState === 1) {
            clients.push(client);
        }
    }

    return clients;
}

/**
 * Broadcast message to all clients in room (excluding sender if specified)
 */
export function broadcastToRoom(roomId, message, wss, excludeUserId = null) {
    const clients = getRoomClients(roomId, wss);

    clients.forEach(client => {
        if (excludeUserId === null || client.userId !== excludeUserId) {
            if (client.readyState === 1) {
                client.send(JSON.stringify(message));
            }
        }
    });
}
