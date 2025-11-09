/**
 * Collaborative Drawing Canvas - WebSocket Server
 * Handles real-time drawing sync, user management, and room-based collaboration
 */

import express from 'express';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { getOrCreateRoom, getRooms } from './rooms.js';
import {
    addUserConnection,
    removeUserConnection,
    getUserConnections,
    broadcastToRoom
} from './drawing-state.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });
const PORT = process.env.PORT || 8080;

// Serve static files from client directory
app.use(express.static(join(__dirname, '../client')));

// WebSocket connection handler
wss.on('connection', (ws) => {
    console.log('New WebSocket connection');

    let roomId = 'default';
    let userId = null;
    let userData = null;

    ws.on('message', (data) => {
        try {
            const message = JSON.parse(data.toString());

            switch (message.type) {
                case 'user_join':
                    handleUserJoin(ws, message, roomId);
                    break;
                case 'drawing':
                    handleDrawing(ws, message, roomId);
                    break;
                case 'cursor_move':
                    handleCursorMove(ws, message, roomId);
                    break;
                case 'ping':
                    handlePing(ws);
                    break;
                case 'canvas_sync':
                    handleCanvasSync(ws, message, roomId);
                    break;
                default:
                    console.warn('Unknown message type:', message.type);
            }
        } catch (error) {
            console.error('Message handling error:', error);
        }
    });

    ws.on('close', () => {
        if (userId) {
            const room = getOrCreateRoom(roomId);
            room.removeUser(userId);

            broadcastToRoom(roomId, {
                type: 'user_left',
                userId: userId,
                userName: userData?.userName || 'Unknown'
            }, wss);

            removeUserConnection(userId);
            console.log(`User ${userId} disconnected`);
        }
    });

    function handleUserJoin(ws, message, room) {
        userId = message.userId;
        userData = {
            userId: userId,
            userName: message.userName,
            userColor: message.userColor,
            joinedAt: Date.now()
        };

        const room_ = getOrCreateRoom(room);
        room_.addUser(userId, userData);

        addUserConnection(userId, {
            ws: ws,
            userId: userId,
            userData: userData,
            roomId: room
        });

        ws.userId = userId;

        ws.send(JSON.stringify({
            type: 'user_list',
            users: room_.getUsers()
        }));

        const drawingHistory = room_.getDrawingHistory();
        if (drawingHistory.length > 0) {
            ws.send(JSON.stringify({
                type: 'drawing_history',
                operations: drawingHistory
            }));
        }

        ws.send(JSON.stringify({
            type: 'sync_complete',
            historySize: drawingHistory.length
        }));

        broadcastToRoom(room, {
            type: 'user_joined',
            userId: userId,
            userName: userData.userName,
            userColor: userData.userColor
        }, wss, userId);

        console.log(`User ${userData.userName} (${userId}) joined room ${room} - sent ${drawingHistory.length} drawing operations`);
    }

    function handleDrawing(ws, message, room) {
        if (!userId) return;

        const room_ = getOrCreateRoom(room);

        if (message.operations && Array.isArray(message.operations)) {
            room_.addDrawingOperation(message.operations);

            broadcastToRoom(room, {
                type: 'drawing',
                userId: userId,
                operations: message.operations,
                timestamp: message.timestamp
            }, wss, userId);
        }
    }

    function handleCursorMove(ws, message, room) {
        if (!userId) return;

        broadcastToRoom(room, {
            type: 'cursor_move',
            userId: userId,
            x: message.x,
            y: message.y,
            timestamp: message.timestamp
        }, wss, userId);
    }

    function handlePing(ws) {
        ws.send(JSON.stringify({
            type: 'pong'
        }));
    }

    function handleCanvasSync(ws, message, room) {
        const room_ = getOrCreateRoom(room);
        const history = room_.getDrawingHistory();

        ws.send(JSON.stringify({
            type: 'sync_complete',
            history: history,
            timestamp: Date.now()
        }));
    }
});

// Serve main application page
app.get('/', (req, res) => {
    res.sendFile(join(__dirname, '../client/index.html'));
});

// Health check endpoint
app.get('/health', (req, res) => {
    const stats = {
        status: 'healthy',
        connectedClients: wss.clients.size,
        rooms: getRooms().size,
        timestamp: Date.now()
    };

    res.json(stats);
});

// Statistics endpoint
app.get('/stats', (req, res) => {
    const roomStats = Array.from(getRooms().entries()).map(([roomId, room]) => ({
        roomId: roomId,
        usersCount: room.users.size,
        drawingOpsCount: room.drawingHistory.length,
        createdAt: room.createdAt
    }));

    res.json({
        connectedClients: wss.clients.size,
        totalUsers: getUserConnections().size,
        rooms: roomStats,
        timestamp: Date.now()
    });
});

// Start HTTP and WebSocket server
server.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════════════════╗
║  Collaborative Drawing Canvas Server                   ║
╚════════════════════════════════════════════════════════╝

🎨 Server running at http://localhost:${PORT}
📊 Stats available at http://localhost:${PORT}/stats
💚 Health check at http://localhost:${PORT}/health

Waiting for connections...
    `);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('Shutting down gracefully...');

    wss.close(() => {
        server.close(() => {
            console.log('Server closed');
            process.exit(0);
        });
    });
});

export { app, server, wss };
