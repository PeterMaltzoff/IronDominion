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
        
        // Connect to game namespace with specific path
        this.socket = io('/game', {
            path: '/game-socket/'
        });
        
        // Get game ID from URL
        const gameId = window.location.pathname.split('/').pop();
        
        this.setupSocketListeners();
        this.setupEventListeners();
        
        // Player properties
        this.player = {
            x: window.innerWidth / 2,
            y: window.innerHeight / 2,
            rotation: 0,
            speed: 5,
        };
        
        this.setupGame();
        
        // Auto-join the game from URL
        if (gameId) {
            this.socket.emit('joinGame', gameId);
        }

        // Handle window resize
        window.addEventListener('resize', this.handleResize.bind(this));
    }

    handleResize() {
        // Update player position relative to new dimensions
        this.player.x = (this.player.x / this.app.screen.width) * window.innerWidth;
        this.player.y = (this.player.y / this.app.screen.height) * window.innerHeight;
        
        // Redraw grid for new dimensions
        this.grid.removeChildren();
        this.drawGrid();
    }

    setupGame() {
        // Grid
        this.grid = new PIXI.Container();
        this.app.stage.addChild(this.grid);
        this.drawGrid();

        // Player
        this.playerGraphics = new PIXI.Graphics();
        this.drawPlayer(this.playerGraphics, 0x4CAF50);
        this.app.stage.addChild(this.playerGraphics);

        // Game loop
        this.app.ticker.add(() => this.gameLoop());
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
        this.socket.on('gameJoined', ({ gameId }) => {
            console.log('Joined game:', gameId);
        });

        this.socket.on('playerUpdated', ({ id, x, y, rotation }) => {
            if (!this.players.has(id)) {
                const graphics = new PIXI.Graphics();
                this.drawPlayer(graphics, 0xff0000);
                this.app.stage.addChild(graphics);
                this.players.set(id, graphics);
            }
            
            const playerGraphics = this.players.get(id);
            playerGraphics.position.set(x, y);
            playerGraphics.rotation = rotation;
        });

        this.socket.on('playerLeft', ({ id }) => {
            if (this.players.has(id)) {
                this.app.stage.removeChild(this.players.get(id));
                this.players.delete(id);
            }
        });
    }

    setupEventListeners() {
        // Mouse movement
        document.addEventListener('mousemove', (e) => {
            const dx = e.clientX - this.player.x;
            const dy = e.clientY - this.player.y;
            this.player.rotation = Math.atan2(dy, dx);
        });

        // WASD movement
        const keys = new Set();
        document.addEventListener('keydown', (e) => keys.add(e.key.toLowerCase()));
        document.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
        
        this.keys = keys;
    }

    gameLoop() {
        // Update player position based on WASD input
        if (this.keys.has('w')) this.player.y -= this.player.speed;
        if (this.keys.has('s')) this.player.y += this.player.speed;
        if (this.keys.has('a')) this.player.x -= this.player.speed;
        if (this.keys.has('d')) this.player.x += this.player.speed;

        // Update player graphics
        this.playerGraphics.position.set(this.player.x, this.player.y);
        this.playerGraphics.rotation = this.player.rotation;

        // Send player update to server
        this.socket.emit('playerUpdate', {
            x: this.player.x,
            y: this.player.y,
            rotation: this.player.rotation
        });
    }
}

// Start game when window loads
window.onload = () => {
    const game = new Game();
    document.body.appendChild(game.app.view);
}; 