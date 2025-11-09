// Canvas drawing module - handles drawing operations, history, and collaboration sync
class CanvasDrawing {
    // Initialize canvas - setup state, event listeners, and DPI scaling
    constructor() {
        // Canvas and context
        this.canvas = document.getElementById('drawingCanvas');
        this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });

        // Drawing state
        this.isDrawing = false;
        this.currentTool = 'brush';
        this.currentColor = '#000000';
        this.strokeWidth = 3;

        // Undo/redo history (snapshot-based, max 50 states)
        this.history = [];
        this.historyStep = 0;
        this.maxHistorySteps = 50;

        // Network batching (50ms interval for efficiency)
        this.drawingBuffer = [];
        this.lastSyncTime = Date.now();
        this.batchInterval = 50;

        // Performance tracking
        this.lastFrameTime = Date.now();
        this.frameCount = 0;

        // Remote drawing operations queue
        this.remoteOperations = [];

        // Initialize
        this.setupCanvas();
        this.setupEventListeners();
        this.saveHistory();
    }

    // Setup canvas with High-DPI scaling for crisp rendering on Retina displays
    setupCanvas() {
        const rect = this.canvas.parentElement.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;

        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;

        this.canvas.style.width = `${rect.width}px`;
        this.canvas.style.height = `${rect.height}px`;

        this.ctx.scale(dpr, dpr);

        this.updateCanvasSize();

        window.addEventListener('resize', () => this.handleResize());
    }

    // Handle window resize - preserve canvas content by saving and restoring ImageData
    handleResize() {
        const rect = this.canvas.parentElement.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;

        const imageData = this.ctx.getImageData(
            0, 0,
            this.canvas.width / dpr,
            this.canvas.height / dpr
        );

        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;
        this.canvas.style.width = `${rect.width}px`;
        this.canvas.style.height = `${rect.height}px`;

        this.ctx.scale(dpr, dpr);

        this.ctx.putImageData(imageData, 0, 0);

        this.updateCanvasSize();
    }

    // Setup event listeners for mouse and touch drawing interactions
    setupEventListeners() {
        this.canvas.addEventListener('mousedown', (e) => this.startDrawing(e));
        this.canvas.addEventListener('mousemove', (e) => this.draw(e));
        this.canvas.addEventListener('mouseup', () => this.stopDrawing());
        this.canvas.addEventListener('mouseleave', () => this.stopDrawing());

        this.canvas.addEventListener('touchstart', (e) => this.handleTouchStart(e));
        this.canvas.addEventListener('touchmove', (e) => this.handleTouchMove(e));
        this.canvas.addEventListener('touchend', () => this.stopDrawing());

        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    // Get canvas coordinates from mouse event accounting for DPI
    getCanvasCoordinates(e) {
        const rect = this.canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;

        const x = (e.clientX - rect.left) / (rect.width / (this.canvas.width / dpr));
        const y = (e.clientY - rect.top) / (rect.height / (this.canvas.height / dpr));

        return { x, y };
    }

    // Start drawing stroke - initialize path and buffer start operation for sync
    startDrawing(e) {
        if (window.colorPicker && window.colorPicker.isEyedropperActive) {
            return;
        }

        this.isDrawing = true;
        const coords = this.getCanvasCoordinates(e);

        this.ctx.beginPath();
        this.ctx.moveTo(coords.x, coords.y);

        this.drawingBuffer.push({
            type: 'start',
            x: coords.x,
            y: coords.y,
            tool: this.currentTool,
            color: this.currentColor,
            width: this.strokeWidth,
            timestamp: Date.now()
        });

        this.emitMouseMove(coords);
    }

    // Continue drawing stroke - renders locally and batches operations for network sync
    draw(e) {
        if (!this.isDrawing) return;

        const coords = this.getCanvasCoordinates(e);

        this.drawLine(coords.x, coords.y);

        this.drawingBuffer.push({
            type: 'draw',
            x: coords.x,
            y: coords.y,
            tool: this.currentTool,
            color: this.currentColor,
            width: this.strokeWidth,
            timestamp: Date.now()
        });

        if (Date.now() - this.lastSyncTime > this.batchInterval) {
            this.emitDrawing();
            this.lastSyncTime = Date.now();
        }

        this.emitMouseMove(coords);
    }


    drawLine(x, y) {
        // ─── Extend path to new point ───
        // Creates line from last point (from moveTo or previous lineTo) to (x,y)
        this.ctx.lineTo(x, y);

        // ─── Configure stroke appearance ───
        // Set width (thickness of line)
        this.ctx.lineWidth = this.strokeWidth;

        // Round caps = natural brush appearance (no gaps between segments)
        this.ctx.lineCap = 'round';

        // Round joins = smooth corners when direction changes
        this.ctx.lineJoin = 'round';

        // ─── Render based on tool type ───
        if (this.currentTool === 'eraser') {
            // Eraser: Actually remove pixels (true erasing, not just white paint)
            // clearRect centered on cursor position
            this.ctx.clearRect(
                x - this.strokeWidth / 2,  // Left edge (centered)
                y - this.strokeWidth / 2,  // Top edge (centered)
                this.strokeWidth,          // Width
                this.strokeWidth           // Height
            );
        } else {
            // Brush: Draw colored stroke
            this.ctx.strokeStyle = this.currentColor;  // Set color
            this.ctx.stroke();  // Render the path
        }
    }

   
    stopDrawing() {
        // ─── Guard: Only process if actually drawing ───
        // Prevents duplicate processing from multiple stop events
        if (!this.isDrawing) return;

        // ─── Update drawing state ───
        this.isDrawing = false;  // Disable further drawing

        // ─── Close canvas path ───
        // Formally ends the current path (cleanup)
        this.ctx.closePath();

        // ─── Final network synchronization ───
        // Flush any remaining buffered operations
        // This ensures complete stroke is sent to remote users
        if (this.drawingBuffer.length > 0) {
            this.emitDrawing();              // Send buffered operations
            this.lastSyncTime = Date.now();  // Update sync timestamp
        }

        // ─── Clear buffer for next stroke ───
        // Fresh buffer prevents operation leakage between strokes
        this.drawingBuffer = [];

        // ─── Save to undo history ───
        // Completed stroke = one undo step
        // Allows user to undo entire stroke with one command
        this.saveHistory();
    }

    
    handleTouchStart(e) {
        // ─── Prevent default touch behaviors ───
        // Stops scrolling, zooming, context menus while drawing
        e.preventDefault();

        // ─── Only handle single-finger touch ───
        // Ignores multi-finger gestures (could be pinch/pan)
        if (e.touches.length === 1) {
            // Get first (and only) touch point
            const touch = e.touches[0];

            // ─── Create synthetic mouse event ───
            // Converts touch coordinates to mouse event format
            const mouseEvent = new MouseEvent('mousedown', {
                clientX: touch.clientX,  // Touch X → Mouse X
                clientY: touch.clientY   // Touch Y → Mouse Y
            });

            // ─── Dispatch to existing mouse handler ───
            // Triggers startDrawing() as if mouse was clicked
            this.canvas.dispatchEvent(mouseEvent);
        }
    }

    
    handleTouchMove(e) {
        // ─── Prevent page scroll while drawing ───
        // CRITICAL: Without this, page scrolls instead of drawing
        e.preventDefault();

        // ─── Only handle single-finger touch ───
        if (e.touches.length === 1) {
            // Get current touch position
            const touch = e.touches[0];

            // ─── Create synthetic mouse event ───
            const mouseEvent = new MouseEvent('mousemove', {
                clientX: touch.clientX,  // Touch X → Mouse X
                clientY: touch.clientY   // Touch Y → Mouse Y
            });

            // ─── Dispatch to existing mouse handler ───
            // Triggers draw() as if mouse was dragged
            this.canvas.dispatchEvent(mouseEvent);
        }
    }

    
    setTool(tool) {
        // ─── Update internal state ───
        this.currentTool = tool;

        // ─── Clean up previous tool's CSS classes ───
        // Remove old cursor classes (if any)
        this.canvas.classList.remove('cursor-brush', 'cursor-eraser');

        // ─── Configure canvas for selected tool ───
        if (tool === 'brush') {
            // Brush: Paint normally (new pixels on top of old)
            this.ctx.globalCompositeOperation = 'source-over';

            // Set brush cursor (circle with crosshair)
            this.updateCursor('brush');
        } else if (tool === 'eraser') {
            // Eraser: Remove pixels (new pixels erase old ones)
            this.ctx.globalCompositeOperation = 'destination-out';

            // Set eraser cursor (square with crosshair)
            this.updateCursor('eraser');
        }
    }

    /**
     * Update cursor with dynamic size based on stroke width
     */
    updateCursor(tool) {
        // Calculate cursor size (stroke width scaled for visibility, capped between 8-64px)
        const cursorSize = Math.max(8, Math.min(64, this.strokeWidth * 2));
        const halfSize = cursorSize / 2;
        const viewBox = cursorSize + 8; // Add padding for crosshair
        const center = viewBox / 2;
        const radius = cursorSize / 2;

        let cursorSVG;

        if (tool === 'brush') {
            // Brush cursor: circle outline with crosshair (like Photoshop)
            cursorSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="${viewBox}" height="${viewBox}" viewBox="0 0 ${viewBox} ${viewBox}">
                <circle cx="${center}" cy="${center}" r="${radius}" fill="none" stroke="black" stroke-width="1.5" opacity="0.8"/>
                <circle cx="${center}" cy="${center}" r="${radius + 0.5}" fill="none" stroke="white" stroke-width="0.5" opacity="0.6"/>
                <circle cx="${center}" cy="${center}" r="1" fill="black" opacity="0.9"/>
                <line x1="${center}" y1="0" x2="${center}" y2="${center - radius - 2}" stroke="black" stroke-width="1" opacity="0.6"/>
                <line x1="${center}" y1="${center + radius + 2}" x2="${center}" y2="${viewBox}" stroke="black" stroke-width="1" opacity="0.6"/>
                <line x1="0" y1="${center}" x2="${center - radius - 2}" y2="${center}" stroke="black" stroke-width="1" opacity="0.6"/>
                <line x1="${center + radius + 2}" y1="${center}" x2="${viewBox}" y2="${center}" stroke="black" stroke-width="1" opacity="0.6"/>
            </svg>`;
        } else if (tool === 'eraser') {
            // Eraser cursor: square outline with crosshair
            const squareStart = center - radius;
            const squareEnd = center + radius;
            cursorSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="${viewBox}" height="${viewBox}" viewBox="0 0 ${viewBox} ${viewBox}">
                <rect x="${squareStart}" y="${squareStart}" width="${cursorSize}" height="${cursorSize}" fill="none" stroke="black" stroke-width="1.5" rx="1" opacity="0.8"/>
                <rect x="${squareStart - 0.5}" y="${squareStart - 0.5}" width="${cursorSize + 1}" height="${cursorSize + 1}" fill="none" stroke="white" stroke-width="0.5" rx="1" opacity="0.6"/>
                <circle cx="${center}" cy="${center}" r="1" fill="black" opacity="0.9"/>
                <line x1="${center}" y1="0" x2="${center}" y2="${squareStart - 2}" stroke="black" stroke-width="1" opacity="0.6"/>
                <line x1="${center}" y1="${squareEnd + 2}" x2="${center}" y2="${viewBox}" stroke="black" stroke-width="1" opacity="0.6"/>
                <line x1="0" y1="${center}" x2="${squareStart - 2}" y2="${center}" stroke="black" stroke-width="1" opacity="0.6"/>
                <line x1="${squareEnd + 2}" y1="${center}" x2="${viewBox}" y2="${center}" stroke="black" stroke-width="1" opacity="0.6"/>
            </svg>`;
        }

        // Encode SVG for data URI
        const encodedSVG = encodeURIComponent(cursorSVG).replace(/'/g, '%27').replace(/"/g, '%22');
        const cursorURL = `url('data:image/svg+xml;utf8,${encodedSVG}') ${center} ${center}, crosshair`;

        // Apply cursor
        this.canvas.style.cursor = cursorURL;
    }

    
    setColor(color) {
        // ─── Store color for future drawing operations ───
        this.currentColor = color;
    }

    
    setStrokeWidth(width) {
        // ─── Parse and store stroke width ───
        // Convert string to integer (handles UI input values)
        this.strokeWidth = parseInt(width);

        // ─── Update cursor to reflect new size ───
        // Provides immediate visual feedback to user
        if (this.currentTool === 'brush' || this.currentTool === 'eraser') {
            this.updateCursor(this.currentTool);
        }
    }

    
    clearCanvas() {
        // ─── Calculate logical dimensions ───
        // Account for high-DPI scaling
        const dpr = window.devicePixelRatio || 1;

        // ─── Clear entire canvas ───
        // clearRect(x, y, width, height) removes all pixels in rectangle
        // Coordinates in logical pixels (DPI-adjusted)
        this.ctx.clearRect(
            0,                          // Start at left edge
            0,                          // Start at top edge
            this.canvas.width / dpr,    // Full logical width
            this.canvas.height / dpr    // Full logical height
        );

        // ─── Save to undo history ───
        // Allows undoing accidental clears
        this.saveHistory();

        // ─── Notify remote users ───
        // Synchronize clear operation with other collaborators
        if (window.wsManager) {
            window.wsManager.sendDrawing({
                type: 'clear',         // Operation type
                timestamp: Date.now()  // For operation ordering
            });
        }
    }


    applyRemoteDrawing(operation) {
        // ─── Handle Clear Operation ───
        if (operation.type === 'clear') {
            // Clear entire canvas (matches local clearCanvas())
            const dpr = window.devicePixelRatio || 1;
            this.ctx.clearRect(0, 0, this.canvas.width / dpr, this.canvas.height / dpr);
        }
        // ─── Handle Stroke Start ───
        else if (operation.type === 'start') {
            // Begin new path (disconnected from previous strokes)
            this.ctx.beginPath();

            // Position to starting point (no drawing yet)
            this.ctx.moveTo(operation.x, operation.y);

            // Configure stroke appearance using remote user's settings
            this.ctx.strokeStyle = operation.color;  // Their color
            this.ctx.lineWidth = operation.width;    // Their brush size
            this.ctx.lineCap = 'round';              // Smooth ends
            this.ctx.lineJoin = 'round';             // Smooth corners
        }
        // ─── Handle Stroke Continuation ───
        else if (operation.type === 'draw') {
            // Extend path to new point
            this.ctx.lineTo(operation.x, operation.y);

            // Render based on remote user's tool
            if (operation.tool === 'eraser') {
                // Eraser: Remove pixels
                this.ctx.clearRect(
                    operation.x - operation.width / 2,  // Centered X
                    operation.y - operation.width / 2,  // Centered Y
                    operation.width,                     // Width
                    operation.width                      // Height
                );
            } else {
                // Brush: Draw colored stroke
                this.ctx.stroke();
            }
        }
        // ─── Handle Stroke End ───
        else if (operation.type === 'end') {
            // Close path (formally end stroke)
            this.ctx.closePath();
        }
    }

    
    redo() {
        // ─── Guard: Ensure we can step forward ───
        // Check if there's a future state to restore
        if (this.historyStep < this.history.length - 1) {
            // ─── Move forward in history ───
            this.historyStep++;

            // ─── Restore next canvas state ───
            // Redraws canvas from snapshot at new historyStep
            this.redrawFromHistory();
        }
    }

    
    saveHistory() {
        // ─── Prune redo history (branching prevention) ───
        // If we've done undo, remove "future" states before adding new one
        // slice(0, n) keeps indices 0 to n-1, removes everything after
        this.history = this.history.slice(0, this.historyStep + 1);

        // ─── Capture current canvas state ───
        const dpr = window.devicePixelRatio || 1;

        // getImageData(x, y, width, height) captures pixel data
        // Returns ImageData with complete RGBA array for all pixels
        const imageData = this.ctx.getImageData(
            0, 0,                        // Start at top-left corner
            this.canvas.width / dpr,     // Logical width (DPI-adjusted)
            this.canvas.height / dpr     // Logical height (DPI-adjusted)
        );

        // ─── Add snapshot to history ───
        this.history.push(imageData);

        // ─── Enforce history size limit ───
        // Prevent unbounded memory growth
        if (this.history.length > this.maxHistorySteps) {
            // Remove oldest snapshot (index 0)
            this.history.shift();

            // DON'T increment historyStep - shift() moved all indices down
            // historyStep now points to same visual state (just at index-1)
        } else {
            // Normal case: new snapshot added, point to it
            this.historyStep++;
        }
    }

    
    redrawFromHistory() {
        // ─── Clear canvas ───
        // Remove all existing content to prevent artifacts
        const dpr = window.devicePixelRatio || 1;
        this.ctx.clearRect(
            0, 0,                        // Start at top-left
            this.canvas.width / dpr,     // Full logical width
            this.canvas.height / dpr     // Full logical height
        );

        // ─── Restore snapshot if valid ───
        // Guard against invalid indices or missing data
        if (this.historyStep >= 0 && this.history[this.historyStep]) {
            // putImageData(imageData, dx, dy) writes pixels to canvas
            // Direct pixel copy - very fast restoration
            this.ctx.putImageData(this.history[this.historyStep], 0, 0);
        }
    }

    /**
     * Update canvas size display
     */
    updateCanvasSize() {
        const dpr = window.devicePixelRatio || 1;
        const width = Math.round(this.canvas.width / dpr);
        const height = Math.round(this.canvas.height / dpr);
        document.getElementById('canvasSize').textContent = `${width}x${height}`;
    }

    /**
     * Emit drawing data to server (to be overridden by websocket manager)
     */
    emitDrawing() {
        // Implemented by WebSocket manager
    }

    /**
     * Emit mouse move data (for cursor tracking)
     */
    emitMouseMove(coords) {
        // Implemented by WebSocket manager
    }

    
    exportCanvas() {
        try {
            // ─── Get DPI ratio (unused here, but available if needed) ───
            const dpr = window.devicePixelRatio || 1;

            // ─── Convert canvas to PNG data URL ───
            // Returns base64-encoded PNG: "data:image/png;base64,..."
            const image = this.canvas.toDataURL('image/png');

            // ─── Create temporary download link ───
            const link = document.createElement('a');
            link.href = image;  // Set data URL as link target

            // Generate unique filename with timestamp
            link.download = `drawing-${Date.now()}.png`;

            // ─── Trigger download ───
            document.body.appendChild(link);  // Add to DOM (Firefox requires this)
            link.click();                      // Programmatic click triggers download

            // ─── Cleanup ───
            document.body.removeChild(link);  // Remove temporary link

            console.log('✓ Canvas exported as PNG');
        } catch (error) {
            // ─── Error handling ───
            // Typically fails due to tainted canvas (cross-origin images)
            console.error('Error exporting canvas:', error);
            alert('Failed to export canvas');
        }
    }

    copyCanvasToClipboard() {
        try {
            // ─── Convert canvas to blob (binary PNG data) ───
            // Asynchronous operation - callback receives blob when ready
            this.canvas.toBlob(blob => {
                // ─── Write blob to clipboard ───
                // Modern Async Clipboard API (requires HTTPS)
                navigator.clipboard.write([
                    // ClipboardItem wraps data with MIME type
                    new ClipboardItem({ 'image/png': blob })
                ])
                .then(() => {
                    // ─── Success ───
                    console.log('✓ Canvas copied to clipboard');
                })
                .catch(error => {
                    // ─── Clipboard write failed ───
                    // Might be permissions, browser support, or security
                    console.error('Error copying to clipboard:', error);
                    alert('Failed to copy canvas');
                });
            });
        } catch (error) {
            // ─── Synchronous error ───
            // Typically: Clipboard API not available or tainted canvas
            console.error('Error copying canvas:', error);
            alert('Failed to copy canvas');
        }
    }
}

// Create global instance
window.canvas = new CanvasDrawing();
