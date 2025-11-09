// Main Application File - handles UI initialization, tool interactions, and color picker

// ===========================
// Advanced Color Picker Module
// ===========================
class AdvancedColorPicker {
    constructor() {
        this.currentColor = '#000000';
        this.colorHistory = [];
        this.maxHistorySize = 20;
        this.isEyedropperActive = false;

        this.defaultPalette = [
            '#000000', '#FF0000', '#00FF00', '#0000FF',
            '#FFFF00', '#FF00FF', '#00FFFF', '#FFFFFF'
        ];

        this.presets = {
            pastel: [
                '#FFB3BA', '#FFCCCB', '#FFDFBA', '#FFFFBA',
                '#BAFFC9', '#BAE1FF', '#E0BBE4', '#FFDFD3'
            ],
            vibrant: [
                '#FF6B6B', '#FF6B9D', '#FFA502', '#FFD93D',
                '#6BCF7F', '#4D96FF', '#B565D8', '#FF6B9D'
            ],
            earth: [
                '#8B4513', '#A0522D', '#CD853F', '#DEB887',
                '#D2B48C', '#BC8F8F', '#A52A2A', '#654321'
            ]
        };

        this.loadColorHistory();
        this.setupEventListeners();
        this.drawColorWheel();
    }

    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    }

    rgbToHex(r, g, b) {
        return '#' + [r, g, b].map(x => {
            const hex = x.toString(16);
            return hex.length === 1 ? '0' + hex : hex;
        }).join('').toUpperCase();
    }

    rgbToHsl(r, g, b) {
        r /= 255;
        g /= 255;
        b /= 255;

        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        let h, s, l = (max + min) / 2;

        if (max === min) {
            h = s = 0;
        } else {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

            switch (max) {
                case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
                case g: h = ((b - r) / d + 2) / 6; break;
                case b: h = ((r - g) / d + 4) / 6; break;
            }
        }

        return {
            h: Math.round(h * 360),
            s: Math.round(s * 100),
            l: Math.round(l * 100)
        };
    }

    hslToRgb(h, s, l) {
        h = h / 360;
        s = s / 100;
        l = l / 100;

        let r, g, b;

        if (s === 0) {
            r = g = b = l;
        } else {
            const hue2rgb = (p, q, t) => {
                if (t < 0) t += 1;
                if (t > 1) t -= 1;
                if (t < 1/6) return p + (q - p) * 6 * t;
                if (t < 1/2) return q;
                if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
                return p;
            };

            const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
            const p = 2 * l - q;
            r = hue2rgb(p, q, h + 1/3);
            g = hue2rgb(p, q, h);
            b = hue2rgb(p, q, h - 1/3);
        }

        return {
            r: Math.round(r * 255),
            g: Math.round(g * 255),
            b: Math.round(b * 255)
        };
    }

    getColorName(hex) {
        const colorNames = {
            '#000000': 'Black',
            '#FFFFFF': 'White',
            '#FF0000': 'Red',
            '#00FF00': 'Green',
            '#0000FF': 'Blue',
            '#FFFF00': 'Yellow',
            '#FF00FF': 'Magenta',
            '#00FFFF': 'Cyan',
            '#FFA500': 'Orange',
            '#800080': 'Purple',
            '#FFC0CB': 'Pink',
            '#A52A2A': 'Brown'
        };

        return colorNames[hex] || 'Custom Color';
    }

    drawColorWheel() {
        const canvas = document.getElementById('colorWheel');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const radius = Math.min(centerX, centerY) - 5;

        for (let angle = 0; angle < 360; angle += 1) {
            const startAngle = (angle - 1) * Math.PI / 180;
            const endAngle = angle * Math.PI / 180;

            const gradient = ctx.createLinearGradient(
                centerX, centerY,
                centerX + Math.cos(endAngle) * radius,
                centerY + Math.sin(endAngle) * radius
            );

            gradient.addColorStop(0, `hsl(${angle}, 100%, 50%)`);
            gradient.addColorStop(1, `hsl(${angle}, 100%, 100%)`);

            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.arc(centerX, centerY, radius, startAngle, endAngle);
            ctx.closePath();
            ctx.fillStyle = `hsl(${angle}, 100%, 50%)`;
            ctx.fill();
        }

        const whiteGradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius * 0.3);
        whiteGradient.addColorStop(0, 'white');
        whiteGradient.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = whiteGradient;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius * 0.3, 0, Math.PI * 2);
        ctx.fill();
    }

    setupEventListeners() {
        document.querySelectorAll('.color-tab').forEach(tab => {
            tab.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
        });

        document.querySelectorAll('.color-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const color = e.target.dataset.color;
                this.setColor(color);
            });
        });

        document.querySelectorAll('.preset-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const preset = e.target.dataset.preset;
                this.showPresetPalette(preset);
            });
        });

        document.getElementById('hueSlider')?.addEventListener('input', (e) => {
            this.updateFromHsl();
        });

        document.getElementById('saturationSlider')?.addEventListener('input', (e) => {
            this.updateFromHsl();
        });

        document.getElementById('lightnessSlider')?.addEventListener('input', (e) => {
            this.updateFromHsl();
        });

        document.getElementById('alphaSlider')?.addEventListener('input', (e) => {
            document.getElementById('alphaValue').textContent = e.target.value;
        });

        const hexInput = document.getElementById('hexInput');
        if (hexInput) {
            hexInput.addEventListener('input', (e) => {
                let hex = e.target.value.trim();
                if (!hex.startsWith('#')) hex = '#' + hex;

                if (/^#[0-9A-F]{6}$/i.test(hex)) {
                    this.setColor(hex);
                    hexInput.style.borderColor = '';
                    hexInput.style.backgroundColor = '';
                } else if (hex.length > 1) {
                    hexInput.style.borderColor = '#ff6b6b';
                    hexInput.style.backgroundColor = 'rgba(255, 107, 107, 0.1)';
                }
            });

            hexInput.addEventListener('blur', (e) => {
                e.target.style.borderColor = '';
                e.target.style.backgroundColor = '';
            });
        }

        document.getElementById('colorWheel')?.addEventListener('click', (e) => {
            const canvas = e.target;
            const rect = canvas.getBoundingClientRect();
            const dpr = window.devicePixelRatio || 1;

            const displayWidth = rect.width;
            const displayHeight = rect.height;

            const x = (e.clientX - rect.left) / displayWidth * canvas.width;
            const y = (e.clientY - rect.top) / displayHeight * canvas.height;

            const centerX = canvas.width / 2;
            const centerY = canvas.height / 2;

            const dx = x - centerX;
            const dy = y - centerY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const radius = Math.min(canvas.width, canvas.height) / 2;

            if (distance <= radius) {
                let angle = Math.atan2(dy, dx) * 180 / Math.PI + 90;
                if (angle < 0) angle += 360;

                const saturation = Math.min(100, Math.round((distance / radius) * 100));

                document.getElementById('hueSlider').value = Math.round(angle);
                document.getElementById('saturationSlider').value = saturation;
                document.getElementById('lightnessSlider').value = 50;

                this.updateFromHsl();
            }
        });

        document.getElementById('eyedropperBtn')?.addEventListener('click', () => {
            this.toggleEyedropper();
        });

        document.getElementById('clearHistoryBtn')?.addEventListener('click', () => {
            this.clearHistory();
        });

        document.getElementById('currentColor')?.addEventListener('click', () => {
            document.getElementById('hexInput').focus();
        });
    }

    switchTab(tabName) {
        document.querySelectorAll('.color-tab-content').forEach(content => {
            content.classList.remove('active');
        });

        document.querySelectorAll('.color-tab').forEach(tab => {
            tab.classList.remove('active');
        });

        const tabContent = document.getElementById(`${tabName}-tab`);
        if (tabContent) {
            tabContent.classList.add('active');
        }

        document.querySelector(`[data-tab="${tabName}"]`)?.classList.add('active');
    }

    setColor(hex) {
        if (!/^#[0-9A-F]{6}$/i.test(hex)) return;

        this.currentColor = hex.toUpperCase();

        document.getElementById('currentColor').style.background = this.currentColor;
        document.getElementById('colorHex').textContent = this.currentColor;
        document.getElementById('colorName').textContent = this.getColorName(this.currentColor);
        document.getElementById('hexInput').value = this.currentColor;

        const hexInput = document.getElementById('hexInput');
        if (hexInput) {
            hexInput.value = this.currentColor;
            hexInput.style.borderColor = this.currentColor;
        }

        const rgb = this.hexToRgb(this.currentColor);
        const hsl = this.rgbToHsl(rgb.r, rgb.g, rgb.b);

        document.getElementById('hueSlider').value = hsl.h;
        document.getElementById('saturationSlider').value = hsl.s;
        document.getElementById('lightnessSlider').value = hsl.l;

        document.getElementById('hValue').textContent = hsl.h;
        document.getElementById('sValue').textContent = hsl.s;
        document.getElementById('lValue').textContent = hsl.l;

        document.querySelectorAll('.color-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.color === this.currentColor);
        });

        this.addToHistory(this.currentColor);

        if (window.canvas) {
            window.canvas.setColor(this.currentColor);
        }
    }

    updateFromHsl() {
        const h = parseInt(document.getElementById('hueSlider').value);
        const s = parseInt(document.getElementById('saturationSlider').value);
        const l = parseInt(document.getElementById('lightnessSlider').value);

        document.getElementById('hValue').textContent = h;
        document.getElementById('sValue').textContent = s;
        document.getElementById('lValue').textContent = l;

        const rgb = this.hslToRgb(h, s, l);
        const hex = this.rgbToHex(rgb.r, rgb.g, rgb.b);

        this.setColor(hex);
    }

    showPresetPalette(presetName) {
        const palette = this.presets[presetName];
        if (!palette) return;

        const colorPalette = document.querySelector('#quick-tab .color-palette');
        colorPalette.innerHTML = '';

        palette.forEach(color => {
            const btn = document.createElement('button');
            btn.className = 'color-btn';
            btn.style.background = color;
            btn.dataset.color = color;
            btn.addEventListener('click', () => this.setColor(color));
            colorPalette.appendChild(btn);
        });

        const resetBtn = document.createElement('button');
        resetBtn.className = 'color-btn';
        resetBtn.textContent = '↻';
        resetBtn.title = 'Reset to default palette';
        resetBtn.style.fontSize = '18px';
        resetBtn.addEventListener('click', () => this.resetDefaultPalette());
        colorPalette.appendChild(resetBtn);
    }

    resetDefaultPalette() {
        const colorPalette = document.querySelector('#quick-tab .color-palette');
        colorPalette.innerHTML = '';

        const colorNames = {
            '#000000': 'Black',
            '#FF0000': 'Red',
            '#00FF00': 'Green',
            '#0000FF': 'Blue',
            '#FFFF00': 'Yellow',
            '#FF00FF': 'Magenta',
            '#00FFFF': 'Cyan',
            '#FFFFFF': 'White'
        };

        this.defaultPalette.forEach(color => {
            const btn = document.createElement('button');
            btn.className = 'color-btn';
            btn.style.background = color;
            btn.dataset.color = color;
            btn.title = colorNames[color] || color;
            if (color === '#FFFFFF') {
                btn.style.border = '2px solid #ccc';
            }
            btn.addEventListener('click', () => this.setColor(color));
            colorPalette.appendChild(btn);
        });
    }

    toggleEyedropper() {
        if (!window.canvas || !window.canvas.canvas) {
            console.error('Canvas not initialized');
            return;
        }

        this.isEyedropperActive = !this.isEyedropperActive;
        const btn = document.getElementById('eyedropperBtn');

        if (this.isEyedropperActive) {
            if (btn) btn.classList.add('active');
            window.canvas.canvas.classList.add('cursor-eyedropper');
            window.canvas.canvas.style.cursor = '';

            const pickHandler = (e) => {
                if (this.isEyedropperActive) {
                    this.pickColorFromCanvas(e);
                }
            };

            window.canvas.canvas.addEventListener('click', pickHandler, { once: true, capture: true });
        } else {
            if (btn) btn.classList.remove('active');
            window.canvas.canvas.classList.remove('cursor-eyedropper');
            window.canvas.canvas.style.cursor = '';
            if (window.canvas.currentTool) {
                window.canvas.setTool(window.canvas.currentTool);
            }
        }
    }

    pickColorFromCanvas(event) {
        if (!window.canvas || !window.canvas.canvas) return;

        event.preventDefault();
        event.stopPropagation();

        const canvas = window.canvas.canvas;
        const rect = canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;

        const x = (event.clientX - rect.left) * dpr;
        const y = (event.clientY - rect.top) * dpr;

        const ctx = window.canvas.ctx;

        const clampedX = Math.max(0, Math.min(x, canvas.width - 1));
        const clampedY = Math.max(0, Math.min(y, canvas.height - 1));

        try {
            const imageData = ctx.getImageData(clampedX, clampedY, 1, 1);
            const data = imageData.data;

            const hex = this.rgbToHex(data[0], data[1], data[2]);
            this.setColor(hex);
            console.log('✓ Color picked:', hex, 'at coords:', Math.round(clampedX), Math.round(clampedY));
        } catch (error) {
            console.error('Error picking color:', error);
        }

        this.isEyedropperActive = false;
        const btn = document.getElementById('eyedropperBtn');
        if (btn) {
            btn.classList.remove('active');
        }

        window.canvas.canvas.classList.remove('cursor-eyedropper');
        window.canvas.canvas.style.cursor = '';
        if (window.canvas.currentTool) {
            window.canvas.setTool(window.canvas.currentTool);
        }
    }

    addToHistory(hex) {
        this.colorHistory = this.colorHistory.filter(c => c !== hex);
        this.colorHistory.unshift(hex);

        if (this.colorHistory.length > this.maxHistorySize) {
            this.colorHistory = this.colorHistory.slice(0, this.maxHistorySize);
        }

        this.saveColorHistory();
        this.updateHistoryDisplay();
    }

    updateHistoryDisplay() {
        const historyContainer = document.getElementById('colorHistory');
        if (!historyContainer) return;

        if (this.colorHistory.length === 0) {
            historyContainer.innerHTML = '<p class="empty-state">No color history yet</p>';
            return;
        }

        historyContainer.innerHTML = '';
        this.colorHistory.forEach(color => {
            const item = document.createElement('div');
            item.className = 'color-history-item';
            item.style.background = color;
            item.title = color;
            item.addEventListener('click', () => this.setColor(color));
            historyContainer.appendChild(item);
        });
    }

    clearHistory() {
        if (confirm('Clear color history?')) {
            this.colorHistory = [];
            this.saveColorHistory();
            this.updateHistoryDisplay();
        }
    }

    saveColorHistory() {
        try {
            localStorage.setItem('colorHistory', JSON.stringify(this.colorHistory));
        } catch (e) {
            console.warn('localStorage unavailable - color history not saved:', e.message);
        }
    }

    loadColorHistory() {
        try {
            const saved = localStorage.getItem('colorHistory');
            if (saved) {
                try {
                    this.colorHistory = JSON.parse(saved);
                    this.updateHistoryDisplay();
                } catch (e) {
                    console.error('Error parsing color history:', e);
                }
            }
        } catch (e) {
            console.warn('localStorage unavailable - color history not loaded:', e.message);
        }
    }

    getColor() {
        return this.currentColor;
    }
}

// ===========================
// Main Application Initialization
// ===========================

// Wait for all scripts to load before initializing
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        if (window.canvas && window.wsManager) {
            // Initialize color picker
            window.colorPicker = new AdvancedColorPicker();

            initializeUI();
            setupToolListeners();
            setupPerformanceTracking();
            console.log('✓ UI initialized successfully with all dependencies');
        } else {
            console.error('✗ Missing dependencies:', {
                canvas: !!window.canvas,
                wsManager: !!window.wsManager
            });
        }
    }, 100);
});

// Initialize UI elements
function initializeUI() {
    updateColorIndicator('#000000');

    if (window.canvas && window.canvas.setTool) {
        window.canvas.setTool('brush');
    }

    const strokeWidth = document.getElementById('strokeWidth');
    if (strokeWidth) {
        strokeWidth.addEventListener('input', (e) => {
            const width = e.target.value;
            document.getElementById('strokeWidthValue').textContent = `${width}px`;
            if (window.canvas && window.canvas.setStrokeWidth) {
                window.canvas.setStrokeWidth(width);
            }
        });
    }
}

// Setup tool button listeners
function setupToolListeners() {
    document.getElementById('brushTool').addEventListener('click', () => {
        selectTool('brush', document.getElementById('brushTool'));
        window.canvas.setTool('brush');
    });

    document.getElementById('eraserTool').addEventListener('click', () => {
        selectTool('eraser', document.getElementById('eraserTool'));
        window.canvas.setTool('eraser');
    });

    document.getElementById('clearBtn').addEventListener('click', () => {
        if (confirm('Are you sure you want to clear the canvas?')) {
            window.canvas.clearCanvas();
        }
    });

    document.getElementById('undoBtn').addEventListener('click', () => {
        if (window.canvas && window.canvas.undo) {
            window.canvas.undo();
        }
    });

    document.getElementById('redoBtn').addEventListener('click', () => {
        if (window.canvas && window.canvas.redo) {
            window.canvas.redo();
        }
    });

    const downloadBtn = document.getElementById('downloadBtn');
    if (downloadBtn) {
        downloadBtn.addEventListener('click', () => {
            if (window.canvas && window.canvas.exportCanvas) {
                window.canvas.exportCanvas();
            }
        });
    }

    const copyBtn = document.getElementById('copyBtn');
    if (copyBtn) {
        copyBtn.addEventListener('click', () => {
            if (window.canvas && window.canvas.copyCanvasToClipboard) {
                window.canvas.copyCanvasToClipboard();
            }
        });
    }
}

// Select tool and update UI
function selectTool(tool, buttonElement) {
    document.querySelectorAll('.tool-btn').forEach(btn => {
        if (btn !== document.getElementById('clearBtn')) {
            btn.classList.remove('active');
        }
    });

    buttonElement.classList.add('active');
}

// Update color indicator
function updateColorIndicator(color) {
    document.querySelectorAll('.color-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.color === color) {
            btn.classList.add('active');
        }
    });
}

// Setup performance tracking
function setupPerformanceTracking() {
    let frameCount = 0;
    let lastTime = Date.now();

    function updateFPS() {
        const now = Date.now();
        const delta = now - lastTime;

        frameCount++;

        if (delta >= 1000) {
            const fps = Math.round((frameCount * 1000) / delta);
            document.getElementById('fps').textContent = fps;
            frameCount = 0;
            lastTime = now;
        }

        requestAnimationFrame(updateFPS);
    }

    updateFPS();
}

// Override canvas drawing buffer to send individual operations to WebSocket
window.canvas.emitDrawing = function() {
    if (this.drawingBuffer.length > 0) {
        this.drawingBuffer.forEach(op => {
            window.wsManager.sendDrawing(op);
        });
        this.drawingBuffer = [];
    }
};

// Override canvas mouse move to emit cursor position
const originalEmitMouseMove = window.canvas.emitMouseMove;
window.canvas.emitMouseMove = function(coords) {
    window.wsManager.sendCursorMove(coords.x, coords.y);
};

// Handle keyboard shortcuts
document.addEventListener('keydown', (e) => {
    const isTypingInInput = e.target.tagName === 'INPUT' ||
                           e.target.tagName === 'TEXTAREA' ||
                           e.target.contentEditable === 'true';

    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        if (!isTypingInInput) {
            e.preventDefault();
            if (window.canvas && window.canvas.undo) {
                window.canvas.undo();
            }
        }
    }

    if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'y') && e.shiftKey) {
        if (!isTypingInInput) {
            e.preventDefault();
            if (window.canvas && window.canvas.redo) {
                window.canvas.redo();
            }
        }
    }

    if (isTypingInInput) return;

    if (e.key === 'b' || e.key === 'B') {
        const brushBtn = document.getElementById('brushTool');
        if (brushBtn) brushBtn.click();
    }

    if (e.key === 'e' || e.key === 'E') {
        const eraserBtn = document.getElementById('eraserTool');
        if (eraserBtn) eraserBtn.click();
    }

    if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        e.preventDefault();
        const clearBtn = document.getElementById('clearBtn');
        if (clearBtn) clearBtn.click();
    }
});

// Setup mobile toolbar handlers
function setupMobileToolbar() {
    const mobileToolbar = document.querySelector('.mobile-toolbar');
    if (!mobileToolbar) return;

    document.querySelectorAll('.mobile-tool-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tool = btn.dataset.tool;

            document.querySelectorAll('.mobile-tool-btn').forEach(b => b.classList.remove('active'));

            switch(tool) {
                case 'brush':
                    btn.classList.add('active');
                    document.getElementById('brushTool')?.click();
                    break;
                case 'eraser':
                    btn.classList.add('active');
                    document.getElementById('eraserTool')?.click();
                    break;
                case 'color':
                    toggleColorPickerModal();
                    break;
                case 'undo':
                    document.getElementById('undoBtn')?.click();
                    break;
                case 'redo':
                    document.getElementById('redoBtn')?.click();
                    break;
                case 'clear':
                    document.getElementById('clearBtn')?.click();
                    break;
            }
        });
    });

    document.querySelector('.mobile-more-btn')?.addEventListener('click', () => {
        toggleUsersOverlay();
    });

    const brushBtn = document.querySelector('.mobile-tool-btn[data-tool="brush"]');
    if (brushBtn) brushBtn.classList.add('active');
}

// Toggle color picker modal for mobile
function toggleColorPickerModal() {
    const modal = document.getElementById('mobileColorModal');
    if (!modal) return;

    const isActive = modal.classList.contains('active');

    if (isActive) {
        modal.classList.remove('active');
    } else {
        const modalBody = document.getElementById('modalColorPicker');
        if (modalBody && modalBody.children.length === 0) {
            const colorSection = document.querySelector('.tool-section:has(.color-display)');
            if (colorSection) {
                const clone = colorSection.cloneNode(true);
                modalBody.appendChild(clone);
            }
        }
        modal.classList.add('active');
    }
}

// Toggle users overlay for mobile
function toggleUsersOverlay() {
    const overlay = document.getElementById('usersOverlay');
    if (!overlay) return;

    const isActive = overlay.classList.contains('active');

    if (isActive) {
        overlay.classList.remove('active');
    } else {
        const overlayBody = document.getElementById('overlayUsersList');
        if (overlayBody) {
            const usersList = document.getElementById('usersList');
            if (usersList) {
                overlayBody.innerHTML = usersList.innerHTML;
            }
        }
        overlay.classList.add('active');
    }
}

// Close modals when clicking backdrop
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-backdrop') || e.target.classList.contains('modal-close-btn') || e.target.closest('.modal-close-btn')) {
        const modal = document.getElementById('mobileColorModal');
        if (modal) modal.classList.remove('active');
    }

    if (e.target.classList.contains('overlay-backdrop') || e.target.classList.contains('overlay-close-btn') || e.target.closest('.overlay-close-btn')) {
        const overlay = document.getElementById('usersOverlay');
        if (overlay) overlay.classList.remove('active');
    }
});

// Initialize mobile toolbar on appropriate screen sizes
function initResponsiveFeatures() {
    if (window.innerWidth < 768) {
        setupMobileToolbar();
    }
}

initResponsiveFeatures();

let resizeTimer;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
        initResponsiveFeatures();
    }, 250);
});

console.log('Collaborative Drawing Canvas initialized');
