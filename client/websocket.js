// WebSocket Manager handles real-time client-server communication
class WebSocketManager {
    // Initialize WebSocket manager with user identity and connection setup
    constructor() {
        // WebSocket connection instance
        this.ws = null;

        // Unique identifier for this client session
        this.userId = this.generateUserId();

        // Display name derived from userId
        this.userName = `User-${this.userId.substring(0, 4)}`;

        // Hex color code for visual user distinction
        this.userColor = this.generateUserColor();

        // Connection state tracking
        this.isConnected = false;

        // Counter for reconnection attempts with exponential backoff
        this.reconnectAttempts = 0;

        // Maximum reconnection attempts before giving up
        this.maxReconnectAttempts = 5;

        // Base delay between reconnection attempts (3 seconds)
        this.reconnectDelay = 3000;

        // Timestamp when last ping was sent to calculate latency
        this.lastPingTime = 0;

        // Current round-trip latency in milliseconds
        this.latency = 0;

        // Registry of all connected users (Map for O(1) lookups)
        this.remoteUsers = new Map();

        // Buffer for batching drawing operations before transmission
        this.drawingBuffer = [];

        // Timestamp of last buffer flush to server
        this.lastFlushTime = Date.now();

        // Flush interval for batching operations (50ms = 20 flushes/second)
        this.flushInterval = 50;

        // Establish WebSocket connection immediately
        this.connect();
    }

    // Generate unique user ID using timestamp and random string
    generateUserId() {
        return `user_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }

    // Generate random color from palette for user visual distinction
    generateUserColor() {
        const colors = [
            '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A',
            '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2'
        ];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    // Establish WebSocket connection with auto-detected protocol (ws:// or wss://)
    connect() {
        try {
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const host = window.location.host;

            this.ws = new WebSocket(`${protocol}//${host}`);

            this.ws.addEventListener('open', () => this.handleOpen());
            this.ws.addEventListener('message', (e) => this.handleMessage(e));
            this.ws.addEventListener('error', (e) => this.handleError(e));
            this.ws.addEventListener('close', () => this.handleClose());

        } catch (error) {
            console.error('WebSocket connection error:', error);
            this.updateConnectionStatus(false);
        }
    }

    // Handle successful WebSocket connection and send user join notification
    handleOpen() {
        console.log('WebSocket connected');

        this.isConnected = true;
        this.reconnectAttempts = 0;

        this.updateConnectionStatus(true);

        this.send({
            type: 'user_join',
            userId: this.userId,
            userName: this.userName,
            userColor: this.userColor
        });

        this.startPing();
    }

    // Route incoming WebSocket messages to appropriate handlers
    handleMessage(event) {
        try {
            const message = JSON.parse(event.data);

            switch (message.type) {
                case 'user_list':
                    this.handleUserList(message);
                    break;

                case 'user_joined':
                    this.handleUserJoined(message);
                    break;

                case 'user_left':
                    this.handleUserLeft(message);
                    break;

                case 'drawing':
                    this.handleDrawing(message);
                    break;

                case 'drawing_history':
                    this.handleDrawingHistory(message);
                    break;

                case 'sync_complete':
                    this.handleSyncComplete(message);
                    break;

                case 'cursor_move':
                    this.handleCursorMove(message);
                    break;

                case 'pong':
                    this.handlePong(message);
                    break;

                case 'sync_request':
                    this.handleSyncRequest(message);
                    break;
            }
        } catch (error) {
            console.error('Error handling message:', error);
        }
    }

    // Handle initial user list and populate remote users map (excluding self)
    handleUserList(message) {
        this.remoteUsers.clear();

        if (message.users) {
            message.users.forEach(user => {
                if (user.userId !== this.userId) {
                    this.remoteUsers.set(user.userId, {
                        userId: user.userId,
                        userName: user.userName,
                        userColor: user.userColor,
                        cursorX: 0,
                        cursorY: 0
                    });
                }
            });
        }

        this.updateUsersList();
    }

    // Handle new user joining session and add to remote users map
    handleUserJoined(message) {
        this.remoteUsers.set(message.userId, {
            userId: message.userId,
            userName: message.userName,
            userColor: message.userColor,
            cursorX: 0,
            cursorY: 0
        });

        this.updateUsersList();
        console.log(`${message.userName} joined`);
    }

    // Handle user leaving session and clean up their cursor and state
    handleUserLeft(message) {
        // Remove the user from our remote users registry
        this.remoteUsers.delete(message.userId);

        // Remove their cursor from the DOM (important cleanup!)
        this.removeCursor(message.userId);

        // Update the UI to remove the user from the sidebar
        this.updateUsersList();

        // Log for developer visibility and debugging
        console.log(`${message.userName} left`);
    }

    // Handle real-time drawing operations from other users
    handleDrawing(message) {
        // ECHO PREVENTION: Ignore our own drawings (already rendered locally)
        if (message.userId === this.userId) return;

        // Apply remote user's drawing operations to our canvas
        if (Array.isArray(message.operations)) {
            message.operations.forEach(op => {
                // Delegate to canvas manager for actual rendering
                window.canvas.applyRemoteDrawing(op);
            });
        }
    }

    // Handle drawing history for synchronizing late joiners
    handleDrawingHistory(message) {
        if (Array.isArray(message.operations)) {
            // Log replay progress for visibility
            console.log('Replaying drawing history for', message.operations.length, 'operations');

            // Replay operations in chronological order (server guarantees this)
            message.operations.forEach(op => {
                // Apply each historical operation to canvas
                window.canvas.applyRemoteDrawing(op);
            });

            // Note: sync_complete message will arrive separately to confirm completion
        }
    }

    // Handle sync completion notification
    handleSyncComplete(message) {
        console.log('✓ Canvas sync complete - drawing history has been replayed');

        // Provide visual feedback that sync is complete
        const statusEl = document.getElementById('connectionStatus');
        if (statusEl) {
            // Save original text to restore later
            const originalText = statusEl.textContent;

            // Temporarily show "Synced" confirmation
            statusEl.textContent = 'Synced ✓';

            // Restore original status after 2 seconds
            setTimeout(() => {
                statusEl.textContent = originalText;
            }, 2000);
        }
    }

    // Handle remote cursor position updates
    handleCursorMove(message) {
        // ECHO PREVENTION: Ignore our own cursor (we see the native cursor)
        if (message.userId === this.userId) return;

        // Validate user exists (may have disconnected)
        const user = this.remoteUsers.get(message.userId);
        if (user) {
            // Update cursor position in our user state
            user.cursorX = message.x;
            user.cursorY = message.y;

            // Update the visual cursor element on screen
            this.updateCursor(message.userId, message.x, message.y, user.userColor);
        }
    }

    // Handle pong response for latency measurement
    handlePong() {
        // Calculate round-trip latency
        this.latency = Date.now() - this.lastPingTime;

        // Update UI with current latency
        document.getElementById('latency').textContent = this.latency;
    }

    // Handle sync request from server for recovery scenarios
    handleSyncRequest(message) {
        // Get device pixel ratio for DPI scaling
        const dpr = window.devicePixelRatio || 1;

        // Access canvas and context
        const canvas = window.canvas.canvas;

        // Extract image data at CSS pixel dimensions (not physical pixels)
        // This ensures correct scaling on high DPI displays
        const imageData = window.canvas.ctx.getImageData(
            0, 0,
            canvas.width / dpr,   // CSS width
            canvas.height / dpr   // CSS height
        );

        // Send complete canvas state to server
        this.send({
            type: 'canvas_sync',
            imageData: imageData,
            userId: this.userId
        });
    }

        // Connection Error Handling
            // WebSocket error events

    handleError(error) {
        // Log error for debugging (though event contains no useful info)
        console.error('WebSocket error:', error);

        // Note: Don't attempt reconnect here, wait for 'close' event
        // Error is always followed by close, which handles reconnection
    }

        // WebSocket connection closure

    handleClose() {
        console.log('WebSocket disconnected');

        // Update internal connection state
        this.isConnected = false;

        // Update UI to show disconnected status
        this.updateConnectionStatus(false);

        // Attempt automatic reconnection
        this.attemptReconnect();
    }

        // Attempt automatic reconnection with exponential backoff

    attemptReconnect() {
        // Check if we haven't exceeded retry limit
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            // Increment attempt counter
            this.reconnectAttempts++;

            // Log reconnection attempt for visibility
            console.log(`Reconnecting... attempt ${this.reconnectAttempts}`);

            // Schedule reconnection after delay
            setTimeout(() => this.connect(), this.reconnectDelay);

            // Note: If connection succeeds, handleOpen() resets reconnectAttempts to 0
        } else {
            // Max attempts reached, give up
            // User must manually refresh page
            // Could add UI notification here
        }
    }

        // Outgoing Message Methods
            // Generic message sender (internal utility)

    send(message) {
        // Double-check connection state before sending
        if (this.isConnected && this.ws.readyState === WebSocket.OPEN) {
            // Serialize message object to JSON string and send
            this.ws.send(JSON.stringify(message));
        }
        // If not connected, silently drop message
        // (Prevents errors, messages are ephemeral anyway)
    }

        // Queue a drawing operation for network transmission

    sendDrawing(operation) {
        // Add operation to buffer
        this.drawingBuffer.push(operation);

        // Check if it's time to flush buffer
        if (Date.now() - this.lastFlushTime > this.flushInterval) {
            this.flushDrawingBuffer();
        }
        // Otherwise, keep accumulating operations
    }

        // Send buffered drawing operations to server

    flushDrawingBuffer() {
        // Don't send if buffer is empty
        if (this.drawingBuffer.length === 0) return;

        // Send batched operations to server
        this.send({
            type: 'drawing',
            userId: this.userId,
            operations: [...this.drawingBuffer],  // Spread to create copy
            timestamp: Date.now()
        });

        // Clear buffer for next batch
        this.drawingBuffer = [];

        // Record flush time for interval calculation
        this.lastFlushTime = Date.now();
    }

        // Send cursor position update to server

    sendCursorMove(x, y) {
        this.send({
            type: 'cursor_move',
            userId: this.userId,
            x: x,
            y: y,
            timestamp: Date.now()
        });
    }

        // Latency Monitoring (Ping/Pong)
            // Start periodic ping for latency measurement

    startPing() {
        // Start interval that runs every 5 seconds
        this.pingInterval = setInterval(() => {
            // Only send ping if connected
            if (this.isConnected) {
                // Record ping time for latency calculation
                this.lastPingTime = Date.now();

                // Send ping message
                this.send({ type: 'ping' });
            }
            // If disconnected, interval still runs but doesn't send
            // (Should ideally stop interval on disconnect)
        }, 5000);  // 5000ms = 5 seconds
    }

        // Stop ping interval

    stopPing() {
        // Clear interval if it exists
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            // Optionally: this.pingInterval = null; (for clarity)
        }
    }

        // UI Update Methods
            // Update connection status indicator in the UI

    updateConnectionStatus(connected) {
        const statusEl = document.getElementById('connectionStatus');

        if (connected) {
            // CONNECTED STATE: Green indicator with username
            statusEl.textContent = `✓ Connected (${this.userName})`;
            statusEl.classList.add('connected');
            statusEl.classList.remove('disconnected');
        } else {
            // DISCONNECTED STATE: Red indicator, generic message
            statusEl.textContent = '✗ Disconnected';
            statusEl.classList.remove('connected');
            statusEl.classList.add('disconnected');
        }
    }

        // Rebuild and display the complete users list

    updateUsersList() {
        const usersList = document.getElementById('usersList');

        // Clear existing list (full rebuild approach)
        usersList.innerHTML = '';

                // Add Self (Always First)
                const selfItem = document.createElement('div');
        selfItem.className = 'user-item';
        selfItem.innerHTML = `
            <div class="user-color-indicator" style="background: ${this.userColor};"></div>
            <div class="user-label">${this.userName} (you)</div>
        `;
        usersList.appendChild(selfItem);

                // Add Remote Users (In Join Order)
                this.remoteUsers.forEach(user => {
            const userItem = document.createElement('div');
            userItem.className = 'user-item';
            userItem.innerHTML = `
                <div class="user-color-indicator" style="background: ${user.userColor};"></div>
                <div class="user-label">${user.userName}</div>
            `;
            usersList.appendChild(userItem);
        });
    }

        // Update cursor position display (with DPI scaling support)

    updateCursor(userId, x, y, color) {
        const cursorsContainer = document.getElementById('cursorsContainer');
        let cursorEl = document.getElementById(`cursor-${userId}`);

        if (!cursorEl) {
            cursorEl = document.createElement('div');
            cursorEl.id = `cursor-${userId}`;
            cursorEl.className = 'remote-cursor';
            cursorEl.style.background = color;

            const pointer = document.createElement('div');
            pointer.className = 'cursor-pointer';
            pointer.style.background = color;

            const label = document.createElement('div');
            label.className = 'cursor-label';
            label.style.background = color;
            label.textContent = this.remoteUsers.get(userId)?.userName || 'User';

            cursorEl.appendChild(pointer);
            cursorEl.appendChild(label);
            cursorsContainer.appendChild(cursorEl);
        }

        // Convert canvas coordinates to display coordinates, accounting for DPI
        // Canvas coordinates are in logical pixels, CSS positions are in display pixels
        const dpr = window.devicePixelRatio || 1;
        const displayX = x / dpr;
        const displayY = y / dpr;

        cursorEl.style.left = `${displayX}px`;
        cursorEl.style.top = `${displayY}px`;
    }

        // Remove cursor from display

    removeCursor(userId) {
        const cursorEl = document.getElementById(`cursor-${userId}`);
        if (cursorEl) {
            cursorEl.remove();
        }
    }
}

// Create global WebSocket manager
window.wsManager = new WebSocketManager();
