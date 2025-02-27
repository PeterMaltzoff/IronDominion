import * as PIXI from 'pixi.js';
import { io } from 'socket.io-client';

class Game {
    async init() {
        // Create the PixiJS application instance
        this.app = new PIXI.Application();

        // Initialize the application with options
        await this.app.init({
            width: window.innerWidth,
            height: window.innerHeight,
            background: '#f0f0f0', // Use CSS color string
            antialias: true,
            resolution: window.devicePixelRatio || 1,
            autoDensity: true,
        });

        // Add the application canvas to the DOM
        document.body.appendChild(this.app.canvas);

        // Initialize player data
        this.players = new Map();
        this.playerInputs = {
            up: false,
            down: false,
            left: false,
            right: false,
        };

        // Connect to game namespace
        this.socket = io('/game', {
            path: '/game-socket/',
        });

        // Get game ID from URL
        const gameId = window.location.pathname.split('/').pop();

        this.setupSocketListeners();
        this.setupEventListeners();
        this.setupGame();

        // Auto-join the game from URL
        if (gameId) {
            this.socket.emit('joinGame', gameId);
        }

        // Handle window resize
        window.addEventListener('resize', () => {
            this.app.renderer.resize(window.innerWidth, window.innerHeight);
            this.handleResize();
        });
    }

    handleResize() {
        // Redraw grid for new dimensions
        this.grid.removeChildren();
        this.drawGrid();
    }

    setupGame() {
        // Grid
        this.grid = new PIXI.Container();
        this.app.stage.addChild(this.grid);
        this.drawGrid();

        // Local player
        this.playerGraphics = new PIXI.Graphics();
        this.drawPlayer(this.playerGraphics, 0x4CAF50);
        this.app.stage.addChild(this.playerGraphics);
    }

    drawGrid() {
        const graphics = new PIXI.Graphics();
        const width = window.innerWidth;
        const height = window.innerHeight;
        
        // Draw vertical lines
        graphics.stroke({ width: 1, color: 0xcccccc, alpha: 0.3 });
        for (let x = 0; x < width; x += 50) {
            graphics.moveTo(x, 0);
            graphics.lineTo(x, height);
        }
        
        // Draw horizontal lines
        for (let y = 0; y < height; y += 50) {
            graphics.moveTo(0, y);
            graphics.lineTo(width, y);
        }
        
        this.grid.addChild(graphics);
    }

    drawPlayer(graphics, color) {
        graphics.clear();
        
        // Draw body (circle)
        graphics.fill({ color });
        graphics.beginFill(color);
        graphics.circle(0, 0, 20);
        graphics.endFill();
        
        // Draw cannon (rectangle)
        // Move to center, then draw rectangle
        graphics.beginFill(color);
        graphics.rect(0, -10, 30, 20); // Changed x from 15 to 0 to center the cannon
        graphics.endFill();
    }

    setupSocketListeners() {
        this.socket.on('gameJoined', ({ gameId, player }) => {
            console.log('Joined game:', gameId);
            // Set initial player position
            this.playerGraphics.position.set(player.x, player.y);
            this.playerGraphics.rotation = player.rotation;
        });

        this.socket.on('playerJoined', ({ id, x, y, rotation }) => {
            const graphics = new PIXI.Graphics();
            this.drawPlayer(graphics, 0xff0000);
            graphics.position.set(x, y);
            graphics.rotation = rotation;
            this.app.stage.addChild(graphics);
            this.players.set(id, graphics);
        });

        this.socket.on('gameState', (state) => {
            for (const player of state) {
                if (player.id === this.socket.id) {
                    // Update local player
                    this.playerGraphics.position.set(player.x, player.y);
                    this.playerGraphics.rotation = player.rotation;
                } else if (this.players.has(player.id)) {
                    // Update other players
                    const graphics = this.players.get(player.id);
                    graphics.position.set(player.x, player.y);
                    graphics.rotation = player.rotation;
                }
            }
        });

        this.socket.on('playerLeft', ({ id }) => {
            if (this.players.has(id)) {
                this.app.stage.removeChild(this.players.get(id));
                this.players.delete(id);
            }
        });
    }

    setupEventListeners() {
        // Mouse movement for rotation
        document.addEventListener('mousemove', (e) => {
            const dx = e.clientX - this.playerGraphics.x;
            const dy = e.clientY - this.playerGraphics.y;
            const rotation = Math.atan2(dy, dx);
            
            // Update local rotation immediately for smooth feel
            this.playerGraphics.rotation = rotation;
            
            // Debug: log rotation
            console.log('Rotation:', rotation);
            
            // Send rotation to server
            this.socket.emit('playerInput', {
                inputs: this.playerInputs,
                rotation: rotation
            });
        });

        // WASD movement
        const keyMap = {
            'w': 'up',
            's': 'down',
            'a': 'left',
            'd': 'right'
        };

        document.addEventListener('keydown', (e) => {
            const key = e.key.toLowerCase();
            if (keyMap[key]) {
                this.playerInputs[keyMap[key]] = true;
                this.socket.emit('playerInput', {
                    inputs: this.playerInputs,
                    rotation: this.playerGraphics.rotation
                });
            }
        });

        document.addEventListener('keyup', (e) => {
            const key = e.key.toLowerCase();
            if (keyMap[key]) {
                this.playerInputs[keyMap[key]] = false;
                this.socket.emit('playerInput', {
                    inputs: this.playerInputs,
                    rotation: this.playerGraphics.rotation
                });
            }
        });
    }
}

// Start game when window loads
document.addEventListener('DOMContentLoaded', async () => {
    const game = new Game();
    await game.init();
    document.getElementById('gameCanvas').replaceWith(game.app.renderer.canvas);
}); 