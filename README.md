# Collaborative Drawing Canvas

A real-time collaborative drawing application where multiple users can draw simultaneously on the same canvas with instant synchronization.

## 🎨 Live Demo

**🌐 [View Live Demo](collaborative-canvas-production-6f7d.up.railway.app)** ← *Deploy link will be added here*

*Works immediately, no setup required. Open in multiple tabs to test collaboration!*

## ⚡ Quick Start

### Option 1: Try the Live Demo (Recommended for Evaluators)
1. Click the demo link above
2. Start drawing immediately
3. Open another tab/window to see real-time collaboration

### Option 2: Run Locally

**Prerequisites**: Node.js 14+

```bash
# Clone the repository
git clone https://github.com/Hari-Krishnan-N/FLAM.git
cd FLAM

# Install dependencies
npm install

# Start the server
npm start
```

Open `http://localhost:8080` in your browser.

**For development with auto-reload:**
```bash
npm run dev
```

**Run on different port:**
```bash
PORT=3000 npm start
```

## 🌐 Browser Compatibility

**Fully Tested & Supported:**
- ✅ Google Chrome (latest)
- ✅ Mozilla Firefox (latest)
- ✅ Safari (latest)
- ✅ Microsoft Edge (latest)
- ✅ Mobile browsers (iOS Safari, Chrome Mobile)

**Requirements:**
- Modern browser with WebSocket support
- JavaScript enabled
- Canvas API support

## 📋 Features

### 🎨 Advanced Color Picker
- **Quick Palette**: 8 preset colors for instant selection
- **Color Wheel**: Visual color selector with hue/saturation
- **HSL Sliders**: Precise color control (Hue, Saturation, Lightness)
- **Hex Input**: Enter custom hex codes directly
- **Eyedropper Tool**: Pick colors from canvas
- **Color History**: Automatically saves last 20 colors used
- **Preset Palettes**: Pastel, Vibrant, and Earth tone collections

### 🖌️ Drawing Tools
- **Brush Tool**: Smooth drawing with adjustable stroke width (1-20px)
- **Eraser Tool**: Remove content precisely
- **Undo/Redo**: Full history management (Ctrl+Z / Ctrl+Shift+Z)
- **Clear Canvas**: One-click canvas clearing with confirmation
- **Export Options**: Download as PNG or copy to clipboard

### 👥 Real-Time Collaboration
- **Instant Synchronization**: See drawings appear in < 100ms
- **Live Cursors**: Watch where other users are drawing
- **User Management**: Real-time list of connected users with color indicators
- **Connection Status**: Visual WebSocket connection indicator
- **Room-Based**: Isolated drawing sessions (expandable to multiple rooms)

### 📱 Mobile Responsive
- **Touch Support**: Draw with finger or stylus
- **Mobile Toolbar**: Optimized bottom toolbar for small screens
- **Responsive Layout**: Adapts to all screen sizes
- **Modal Color Picker**: Full-screen color picker on mobile
- **Gesture Support**: Smooth touch-based drawing

### 📊 Performance Tracking
- **FPS Counter**: Real-time frame rate display
- **Latency Monitor**: WebSocket ping/pong timing
- **Canvas Size**: Dynamic canvas dimensions
- **User Count**: Active users indicator

## 🏗️ Project Structure

```
collaborative-canvas/
├── client/
│   ├── index.html           # Main HTML file
│   ├── style.css            # Styling & responsive design
│   ├── canvas.js            # Canvas drawing logic
│   ├── websocket.js         # WebSocket client management
│   └── main.js              # App initialization & color picker
├── server/
│   ├── server.js            # Express + WebSocket server
│   ├── rooms.js             # Room management
│   └── drawing-state.js     # Canvas state management
├── package.json             # Dependencies and scripts
├── README.md                # This file
├── ARCHITECTURE.md          # Technical architecture details
├── TESTING.md               # Multi-user testing instructions
└── DEPLOYMENT.md            # Deployment guide (Railway, Render)
```

## 🎮 How to Use

### Drawing Tools
- **Select Tool**: Click brush or eraser icon in toolbar (or press **B** / **E**)
- **Choose Color**: Click color palette or use advanced color picker
- **Adjust Width**: Use stroke width slider (1-20 pixels)
- **Draw**: Click and drag on canvas
- **Undo/Redo**: Use toolbar buttons or **Ctrl+Z** / **Ctrl+Shift+Z**

### Multi-User Collaboration
1. Open the app in multiple browser tabs/windows
2. Arrange windows side-by-side
3. Draw in one window → Changes appear instantly in all windows
4. Watch colored cursor indicators show where others are drawing
5. User list (right panel) shows all connected users

### Advanced Color Picker
- **Quick Colors**: Click preset color buttons
- **Color Wheel**: Click anywhere on the wheel to select
- **HSL Sliders**: Fine-tune Hue (0-360), Saturation (0-100), Lightness (0-100)
- **Hex Input**: Type hex codes like `#FF5733`
- **Eyedropper**: Click eyedropper icon, then click canvas to pick color
- **History**: Recently used colors saved automatically

### Keyboard Shortcuts
- **B**: Switch to Brush tool
- **E**: Switch to Eraser tool
- **Ctrl+Z**: Undo last action
- **Ctrl+Shift+Z** or **Ctrl+Y**: Redo
- **Ctrl+C**: Clear canvas (with confirmation)

## 🔧 Technical Stack

### Frontend
- **HTML5 Canvas API**: High-performance drawing
- **Vanilla JavaScript (ES6+)**: No frameworks, pure web standards
- **WebSocket API**: Real-time bidirectional communication
- **CSS3 Grid/Flexbox**: Responsive layout
- **localStorage**: Color history persistence

### Backend
- **Node.js**: JavaScript runtime
- **Express.js**: HTTP server for static files
- **ws**: WebSocket library for real-time communication
- **ES Modules**: Modern module system

### Architecture Highlights
- **Operation Batching**: Drawing operations batched every 50ms
- **DPI Awareness**: High-DPI display support (Retina, 4K)
- **Memory Management**: History capped at 1000 operations/room
- **Room Isolation**: Multi-room support ready
- **Graceful Reconnection**: Auto-reconnect on connection loss

## 📊 WebSocket Protocol

### Message Types
```javascript
// User joins
USER_JOIN: { type: 'user_join', userId, userName, userColor }

// Drawing operations
DRAWING: {
  type: 'drawing',
  userId: string,
  operations: [{
    type: 'start'|'draw'|'end'|'clear',
    x: number, y: number,
    tool: 'brush'|'eraser',
    color: string,
    width: number,
    timestamp: number
  }]
}

// Cursor tracking
CURSOR_MOVE: { type: 'cursor_move', userId, x, y, timestamp }

// Keep-alive
PING/PONG: { type: 'ping' } / { type: 'pong' }
```

Full protocol documentation: [ARCHITECTURE.md](ARCHITECTURE.md)

## 🎯 Performance

**Metrics** (typical):
- Drawing latency: < 100ms
- FPS: 60 fps (stable)
- WebSocket overhead: ~300 bytes per 50ms batch
- Memory: ~100KB per 1000 operations
- Concurrent users: 10-20 optimal, ~100 max

**Optimizations**:
- Operation batching (50ms intervals)
- Canvas context caching
- Efficient path rendering
- DPI-aware drawing
- Throttled cursor updates

## 🐛 Known Limitations

1. **Undo/Redo**: Local per user (not global across users)
2. **Persistence**: Drawings cleared on server restart
3. **Scaling**: Optimized for 10-20 users per room
4. **Mobile**: Touch works but not optimized for precision
5. **Conflict Resolution**: Simultaneous edits may appear slightly out of order

For detailed architecture analysis: [ARCHITECTURE.md](ARCHITECTURE.md)

*This is a demonstration of real-time collaborative drawing with vanilla JavaScript and WebSockets. For production use, consider adding persistence, authentication, and scaling optimizations.*
