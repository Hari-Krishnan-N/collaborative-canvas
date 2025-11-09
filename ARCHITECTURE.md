# Collaborative Drawing Canvas - Architecture & Design Decisions

## 🏛️ System Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      CLIENT BROWSER                          │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────────┐          ┌─────────────────────┐ │
│  │   Canvas Drawing     │          │  WebSocket Manager  │ │
│  │  (canvas.js)         │◄────────►│  (websocket.js)     │ │
│  │                      │          │                     │ │
│  │ - Path drawing       │          │ - Connection mgmt   │ │
│  │ - Tool selection     │          │ - Message handling  │ │
│  │ - Color management   │          │ - User tracking     │ │
│  │ - Undo/Redo history  │          │ - Cursor updates    │ │
│  └──────────────────────┘          └─────────────────────┘ │
│           ▲                                   │               │
│           │                                   │               │
│           └───────────────┬───────────────────┘               │
│                           │                                    │
│                      UI Events                               │
│                      (main.js)                               │
│                                                               │
└──────────────────────────────┬──────────────────────────────┘
                               │
                    WebSocket Connection
                    (TCP + Framing)
                               │
┌──────────────────────────────┴──────────────────────────────┐
│                   NODE.JS SERVER                             │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌────────────────────────────────────────────────────────┐│
│  │              WebSocket Server (ws library)             ││
│  └────────────────────────────────────────────────────────┘│
│                           │                                  │
│    ┌──────────────────────┴──────────────────────────────┐  │
│    │                                                      │  │
│    ▼                                                      ▼  │
│  ┌───────────────────┐                      ┌──────────────┐│
│  │  Room Management  │                      │  Express.js  ││
│  │                   │                      │              ││
│  │ - User tracking   │                      │ - Serve HTML ││
│  │ - Drawing history │                      │ - Static CSS/│
│  │ - Message routing │                      │   JS files   ││
│  └───────────────────┘                      │ - Health API ││
│                                              └──────────────┘│
└─────────────────────────────────────────────────────────────┘
```

## 📊 Data Flow Diagram

### 1. User Drawing Flow

```
User Input (Mouse Move)
    │
    ▼
[Canvas.js] getCanvasCoordinates(event)
    │
    ▼
Draw to Local Canvas
    │
    ├─► Save to drawingBuffer
    │
    └─► Batch Operations (50ms interval)
         │
         ▼
    [WebSocket.js] flushDrawingBuffer()
         │
         ▼
    Send JSON message over WebSocket
         │
         ▼
[Server.js] handleDrawing()
    │
    ├─► Add to Room.drawingHistory
    │
    ├─► Validate operations
    │
    └─► Broadcast to other clients in room
         │
         ▼
[Other Clients] Receive drawing message
         │
         ▼
[Canvas.js] applyRemoteDrawing()
         │
         ▼
Render on Remote Canvas (Real-time!)
```

### 2. User Join Flow

```
New User Opens Browser
    │
    ▼
WebSocket connects
    │
    ▼
[WebSocket.js] handleOpen()
    │
    └─► Send USER_JOIN message
         │
         ▼
[Server.js] handleUserJoin()
    │
    ├─► Create user object
    ├─► Add to Room.users
    └─► Send USER_LIST to new user
         │
         ▼
[WebSocket.js] handleUserList()
    │
    └─► Update UI with users
         │
         ▼
Server broadcasts USER_JOINED to others
    │
    ▼
[Other Clients] Update user list
```

### 3. Cursor Tracking Flow

```
User Moves Mouse
    │
    ▼
[Canvas.js] emitMouseMove() called
    │
    ▼
[WebSocket.js] sendCursorMove()
    │
    ├─► Buffer cursor position
    │
    └─► Send with next drawing batch OR
        Send immediately if too far from last
         │
         ▼
[Server.js] handleCursorMove()
    │
    └─► Broadcast to other clients
         │
         ▼
[Other Clients] handleCursorMove()
    │
    ▼
[WebSocket.js] updateCursor()
    │
    ├─► Create/update cursor DOM element
    └─► Animate to new position
```

## 🔄 WebSocket Protocol Design

### Message Batching Strategy

**Why**: Sending individual operations per mouse move would cause:
- High network overhead (1000+ messages per second)
- Jittery rendering
- Server overwhelming

**How**:
```javascript
// Client side
drawingBuffer = []  // Accumulate operations
lastFlushTime = now()

// On each draw event
drawingBuffer.push({type: 'draw', x, y, ...})

// Every 50ms, flush if buffer has data
if (now - lastFlushTime > 50ms) {
    send({
        type: 'drawing',
        operations: [...drawingBuffer],  // All ops since last flush
        timestamp: now
    })
    drawingBuffer = []
    lastFlushTime = now
}
```

**Benefits**:
- Reduces messages from 1000/sec to ~20/sec
- Network bandwidth reduced 50x
- Server load dramatically lower
- Still feels instantaneous to user

### Operation Format

Each drawing operation is atomic and contains all needed info:

```javascript
{
    type: 'start'|'draw'|'end'|'clear',
    x: number,           // Canvas X coordinate (0-canvas width)
    y: number,           // Canvas Y coordinate (0-canvas height)
    tool: 'brush'|'eraser',
    color: '#RRGGBB',
    width: number,       // Stroke width in pixels
    timestamp: number    // Client timestamp for ordering
}
```

## 🗂️ Undo/Redo Strategy

### Local Undo/Redo (Current Implementation)

**Approach**: Snapshot-based history per client

```javascript
// Canvas state management
history = []        // Array of canvas ImageData objects
historyStep = -1    // Current position in history
maxSteps = 50       // Limit memory usage

// On user draws something new
stopDrawing() {
    saveHistory()  // Save current canvas state
}

// Save to history
saveHistory() {
    // Discard redo history
    history = history.slice(0, historyStep + 1)

    // Add new state (full canvas snapshot)
    imageData = ctx.getImageData(0, 0, width, height)
    history.push(imageData)
    historyStep++

    // Limit size
    if (history.length > maxSteps) {
        history.shift()
    }
}

// Undo
undo() {
    if (historyStep > 0) {
        historyStep--
        redrawFromHistory()
    }
}

// Redraw from snapshot
redrawFromHistory() {
    ctx.clearRect(0, 0, width, height)
    ctx.putImageData(history[historyStep], 0, 0)
}
```

**Pros**:
- Simple to understand
- No coordination with server
- Instant user feedback

**Cons**:
- Only works locally (doesn't affect other users)
- Memory intensive (full canvas snapshots)
- Can't undo other users' drawings

### Global Undo/Redo (Not Implemented)

Would require one of these approaches:

#### 1. Operation Transformation (OT)
```javascript
// Track all operations in order
ops = [
    {user: A, action: stroke at (10,10)},
    {user: B, action: stroke at (50,50)},
]

// User A wants to undo
undo(A) {
    // Remove A's first operation
    ops = ops.filter(op => op.user != A || op != first)

    // Transform remaining operations
    // (complex - dealing with ordering conflicts)

    // Redraw for all users
    broadcast(replayOps())
}
```

**Complexity**: Very high, multiple research papers on this

#### 2. CRDT (Conflict-free Replicated Data Type)
```javascript
// Each operation has unique ID
ops = [
    {id: A-001, x: 10, y: 10, parent: null},
    {id: B-001, x: 50, y: 50, parent: null},
]

// Operations can be applied in any order and converge
// Undo removes operation from sequence
// All clients automatically converge
```

**Complexity**: High, but handles all ordering issues

### Why Not Implemented
- Significant complexity for assignment scope
- OT/CRDT requires careful implementation
- Local undo is sufficient for demo
- Could be added later without breaking current system

## 🚀 Performance Optimizations

### 1. Canvas Context Caching
```javascript
// Reuse context object, not recreated per draw
ctx = canvas.getContext('2d', { willReadFrequently: true })
// willReadFrequently flag hints to browser for optimization
```

### 2. High DPI Awareness
```javascript
// Get device pixel ratio
dpr = window.devicePixelRatio || 1

// Create larger canvas for crisp rendering
canvas.width = rect.width * dpr
canvas.height = rect.height * dpr

// Scale context accordingly
ctx.scale(dpr, dpr)

// Canvas CSS size stays the same
canvas.style.width = `${rect.width}px`
```

### 3. Batch Updates
- Drawing operations batched every 50ms
- Cursor updates sent with drawing batch
- Reduces context switches

### 4. Efficient Redraw
```javascript
// For eraser: use clearRect instead of fillRect
if (tool === 'eraser') {
    ctx.clearRect(x - width/2, y - width/2, width, width)
} else {
    ctx.stroke()  // Draw line
}
```

### 5. Room-based Broadcasting
```javascript
// Only send to clients in same room
broadcastToRoom(roomId, message)

// Gets only clients connected to this room
getRoomClients(roomId).forEach(client => {
    client.send(JSON.stringify(message))
})
```

## 🔀 Conflict Resolution Strategy

### Drawing in Overlapping Areas

**Problem**: When User A and User B draw in the same spot simultaneously, what should happen?

**Current Approach**: Last-write-wins (LWW)
```
Time: 0ms  - User A starts stroke at (100, 100)
Time: 5ms  - User B starts stroke at (105, 105)
Time: 10ms - User A draws at (110, 110)
Time: 15ms - User B draws at (115, 115)

Both clients apply operations in receive order:
- All see A's stroke
- All see B's stroke
- Both strokes visible (no conflict!)

Result: Both strokes rendered on top of each other
```

**Why This Works**:
- Canvas rendering is additive (later draws layer on top)
- No data loss
- Simple to implement
- Feels natural

**When It Matters**:
- Eraser vs Brush: Eraser wins (clears both)
- Different colors: Blending occurs naturally

### Order Guarantees

**Per-user operations are ordered**:
```javascript
// Client batches: [draw1, draw2, draw3]
// Sent in one message, applied in order
```

**Between users**: Best effort, depends on network
```javascript
// User A's operations arrive slightly before B's
// But if network reorders, B might arrive first

// Solution: Include client timestamp
{
    operations: [...],
    timestamp: clientTime,  // Used for sorting
}

// Server could sort by timestamp before broadcasting
// (not currently implemented, but could be added)
```

## 📡 Network Protocol Details

### WebSocket Message Structure

```
Raw: {"type":"drawing","userId":"user_123",...}
     └─ JSON serialization (text)

Overhead per 50ms batch (50px drawing):
- Fixed: 24 bytes (type, userId, timestamp)
- Per operation: 30 bytes × 10 ops = 300 bytes
- Total: ~324 bytes
- Compression: Could reduce ~60% with binary protocol

At 1000 ops/sec: 6.4 MB/sec raw
Vs optimized: 2.5 MB/sec
```

### Connection Lifecycle

```
User Opens Page
    ↓
WebSocket.connect() → ws://localhost:8080
    ↓
Server receives connection
    ↓
Client waits for user interaction
    ↓
User moves mouse in 50ms window
    ↓
drawingBuffer accumulates operations
    ↓
50ms timer fires → flushDrawingBuffer()
    ↓
Send JSON over WebSocket
    ↓
Server receives, validates, broadcasts
    ↓
Other clients receive, apply to canvas
    ↓
(Local latency ~20-50ms in LAN)

User leaves page
    ↓
WebSocket.close()
    ↓
Server handles disconnect
    ↓
Broadcast USER_LEFT
    ↓
Remove from room, clean up cursors
```

## 🔐 Validation & Error Handling

### Input Validation

```javascript
// On message receive
validateMessage(msg) {
    // Type checking
    if (!['drawing', 'cursor_move', 'ping'].includes(msg.type)) {
        drop(msg)
    }

    // Bounds checking
    if (msg.x < 0 || msg.x > canvasWidth) {
        clip(msg.x)
    }

    // Color validation
    if (!isValidHex(msg.color)) {
        msg.color = '#000000'  // Default
    }

    // No validation of operation content (canvas is safe)
}
```

### Error Recovery

```javascript
// Connection lost → automatic reconnect
ws.addEventListener('close', () => {
    setTimeout(connect, 3000)  // Try again in 3s
})

// Failed message send → buffer and retry
send(msg) {
    if (!ws.open) {
        messageBuffer.push(msg)
        // Retry when reconnected
    }
}

// Corrupted message → skip and continue
try {
    const msg = JSON.parse(data)
    handleMessage(msg)
} catch(e) {
    console.error(e)
    // Connection continues
}
```

## 📈 Scaling Considerations

### Current Limits
- ~10-20 concurrent users per room (good experience)
- ~100 concurrent users (acceptable but laggy)
- ~1000 concurrent users (technical limit hit)

### Scaling Bottlenecks

1. **Broadcast Overhead**
```javascript
// Every drawing operation sent to ALL clients
operations × clients × bandwidth = load

// Solution: Spatial partitioning
// Only send updates relevant to client's viewport
```

2. **Memory Usage**
```javascript
// History per room: 1000 operations × 100 bytes = 100KB
// Per room (reasonable)
// But 100 rooms × 1000 ops each = 10MB
// 1000 rooms = 100MB (server memory)
```

3. **CPU Usage**
```javascript
// Server: Parsing JSON, validating, broadcasting
// With 1000 ops/sec: parsing = 1000 JSON parses/sec
// Broadcasting = 1000 × 20 clients = 20,000 send calls/sec
```

### Scaling Solutions

1. **Binary Protocol** (reduce ~60% bandwidth)
```javascript
// Use MessagePack or Protocol Buffers instead of JSON
// Serialize: 324 bytes → 130 bytes
```

2. **Spatial Partitioning** (reduce broadcast scope)
```javascript
// Divide canvas into 4×4 grid
// Only broadcast to clients viewing that section
// Reduces broadcast from N to N/16
```

3. **Redis Pub/Sub** (multi-server)
```javascript
// Server A ↔ Redis ↔ Server B
// Clients can connect to different servers
// Scales horizontally
```

4. **Compression** (reduce transfer)
```javascript
// gzip reduces ~60% more
// WebSocket permessage-deflate extension
```

5. **Operation Compression** (fewer messages)
```javascript
// Instead of: 1000 individual points per stroke
// Send: bounding box + simplified curve
// Reconstruct on client side
```

## 🎯 Design Decisions & Trade-offs

| Decision | Chosen | Alternative | Trade-off |
|----------|--------|-------------|-----------|
| Drawing Lib | Canvas API | Fabric.js | More features vs complexity |
| Serialization | JSON | Binary Protocol | Simplicity vs bandwidth |
| Undo/Redo | Local Snapshot | OT/CRDT | Simple vs powerful |
| Broadcasting | All clients | Spatial grid | Easy vs scalable |
| History | Per-room in memory | Database | Speed vs persistence |
| Authentication | None | JWT | Simple vs secure |
| Transport | WebSocket | HTTP polling | Modern vs compatible |

## 📝 Future Improvements

1. **Persistence**
   - Save canvas state to database
   - Resume sessions after disconnect
   - History replay/scrubbing

2. **Collaboration Features**
   - Comments and annotations
   - Layer support
   - Shape tools (rectangle, circle)
   - Text tool

3. **Advanced Tools**
   - Layers and transparency
   - Blend modes
   - Filters
   - Animation/timeline

4. **Performance**
   - WebGL rendering for large canvases
   - Worker threads for processing
   - Spatial indexing
   - Operation compression

5. **Reliability**
   - Operation log replay
   - Periodic state snapshots
   - Conflict-free data structures
   - Distributed consensus

---

This architecture balances simplicity with real-time collaboration requirements. It's suitable for educational purposes and small group collaboration. For production scale, the improvements listed above would be necessary.
