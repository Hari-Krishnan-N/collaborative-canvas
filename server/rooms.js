/**
 * Room Management Module
 * Handles room creation, user management, and room state
 */

/**
 * Room class - manages users and drawing history for isolated drawing sessions
 */
export class Room {
    constructor(roomId) {
        this.roomId = roomId;
        this.users = new Map(); // userId -> user data
        this.drawingHistory = []; // All drawing operations in order
        this.maxHistorySize = 1000; // Prevent memory overflow
        this.createdAt = Date.now();
    }

    addUser(userId, userData) {
        this.users.set(userId, userData);
    }

    removeUser(userId) {
        this.users.delete(userId);
    }

    getUsers() {
        return Array.from(this.users.values());
    }

    addDrawingOperation(operations) {
        operations.forEach(op => {
            this.drawingHistory.push({ ...op, timestamp: Date.now() });
        });

        if (this.drawingHistory.length > this.maxHistorySize) {
            this.drawingHistory = this.drawingHistory.slice(-this.maxHistorySize);
        }
    }

    getDrawingHistory() {
        return this.drawingHistory;
    }

    clearHistory() {
        this.drawingHistory = [];
    }
}

// Global rooms registry
const rooms = new Map(); // roomId -> Room instance

export function getOrCreateRoom(roomId = 'default') {
    if (!rooms.has(roomId)) {
        rooms.set(roomId, new Room(roomId));
    }
    return rooms.get(roomId);
}

export function getRooms() {
    return rooms;
}

export function deleteRoom(roomId) {
    rooms.delete(roomId);
}
