class Game {
    constructor() {
        this.app = new PIXI.Application({
            width: window.innerWidth,
            height: window.innerHeight,
            backgroundColor: 0xf0f0f0,
            resolution: window.devicePixelRatio || 1,
            autoDensity: true,
            resizeTo: window
        });
        this.app.view.id = 'gameCanvas';
        
        this.players = new Map();
        this.playerInputs = {
            up: false,
            down: false,
            left: false,
            right: false
        };
        
        // Connect to game namespace
        this.socket = io('/game', {
            path: '/game-socket/'
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
        window.addEventListener('resize', this.handleResize.bind(this));
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
        graphics.lineStyle(1, 0xcccccc, 0.3);
        
        // Draw vertical lines
        for (let x = 0; x < window.innerWidth; x += 50) {
            graphics.moveTo(x, 0);
            graphics.lineTo(x, window.innerHeight);
        }
        
        // Draw horizontal lines
        for (let y = 0; y < window.innerHeight; y += 50) {
            graphics.moveTo(0, y);
            graphics.lineTo(window.innerWidth, y);
        }
        
        this.grid.addChild(graphics);
    }

    drawPlayer(graphics, color) {
        graphics.clear();
        graphics.beginFill(color);
        graphics.drawCircle(0, 0, 20);
        graphics.endFill();
        
        // Draw cannon
        graphics.beginFill(color);
        graphics.drawRect(15, -10, 30, 20);
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
window.onload = () => {
    const game = new Game();
    document.body.appendChild(game.app.view);
}; 