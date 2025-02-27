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
            background: '#1a1a1a', // Darker background like diep.io
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
            shoot: false
        };

        // Initialize food containers and graphics
        this.foodContainer = new PIXI.Container();
        this.app.stage.addChild(this.foodContainer);
        this.foodGraphics = {
            SQUARE: {},
            TRIANGLE: {},
            PENTAGON: {}
        };

        // Initialize projectile container
        this.projectileContainer = new PIXI.Container();
        this.projectiles = new Map();

        // Initialize UI elements
        this.setupUI();

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
            
            // Set a timeout to check if we successfully joined the game
            setTimeout(() => {
                // If we haven't received a gameJoined event after 3 seconds, redirect to home
                if (!this.gameJoined) {
                    console.log('Game not found or join failed, redirecting to home');
                    window.location.href = '/';
                }
            }, 3000);
        }

        // Handle window resize
        window.addEventListener('resize', () => {
            this.app.renderer.resize(window.innerWidth, window.innerHeight);
            this.handleResize();
        });

        // Start game loop
        this.app.ticker.add(this.gameLoop.bind(this));
    }

    setupUI() {
        // Create UI container
        this.uiContainer = new PIXI.Container();
        this.app.stage.addChild(this.uiContainer);

        // Create stats display
        this.statsText = new PIXI.Text('Level: 1 | XP: 0 | Health: 100/100', {
            fontFamily: 'Arial',
            fontSize: 16,
            fill: 0xffffff,
            align: 'left'
        });
        this.statsText.position.set(20, 20);
        this.uiContainer.addChild(this.statsText);

        // Create game ID display
        this.gameIdText = new PIXI.Text('Game ID: ----', {
            fontFamily: 'Arial',
            fontSize: 16,
            fill: 0xffffff,
            align: 'right'
        });
        this.gameIdText.position.set(window.innerWidth - 150, 20);
        this.uiContainer.addChild(this.gameIdText);

        // Setup upgrade menu
        this.setupUpgradeMenu();
    }

    setupUpgradeMenu() {
        // Get the upgrade menu from the DOM
        this.upgradeMenu = document.getElementById('upgradeMenu');
        
        // Add event listeners to upgrade buttons
        const upgradeButtons = document.querySelectorAll('.upgradeButton');
        upgradeButtons.forEach(button => {
            button.addEventListener('click', () => {
                const stat = button.getAttribute('data-upgrade');
                this.socket.emit('upgrade', stat);
            });
        });
    }

    showUpgradeMenu() {
        this.upgradeMenu.style.display = 'flex';
    }

    hideUpgradeMenu() {
        this.upgradeMenu.style.display = 'none';
    }

    handleResize() {
        // Update UI positions
        this.gameIdText.position.set(window.innerWidth - 150, 20);
        
        // Redraw grid for new dimensions
        this.grid.removeChildren();
        this.drawGrid();
    }

    setupGame() {
        // Create camera container for game world
        this.camera = new PIXI.Container();
        this.app.stage.addChild(this.camera);
        
        // Add grid to camera
        this.grid = new PIXI.Container();
        this.camera.addChild(this.grid);
        this.drawGrid();

        // Add food container to camera
        this.camera.addChild(this.foodContainer);

        // Add projectile container to camera
        this.camera.addChild(this.projectileContainer);

        // Create local player
        this.playerGraphics = new PIXI.Container();
        this.playerBody = new PIXI.Graphics();
        this.playerCannon = new PIXI.Graphics();
        this.playerGraphics.addChild(this.playerBody);
        this.playerGraphics.addChild(this.playerCannon);
        this.drawPlayer(this.playerBody, this.playerCannon, 0x4CAF50);
        this.camera.addChild(this.playerGraphics);

        // Initialize player data
        this.playerData = {
            id: null,
            x: 0,
            y: 0,
            rotation: 0,
            radius: 20,
            level: 1,
            experience: 0,
            health: 100,
            maxHealth: 100
        };

        // Initialize world bounds
        this.worldBounds = {
            width: 4000,
            height: 4000
        };
    }

    drawGrid() {
        const graphics = new PIXI.Graphics();
        const gridSize = 50;
        const width = this.worldBounds ? this.worldBounds.width : 4000;
        const height = this.worldBounds ? this.worldBounds.height : 4000;
        
        // Draw vertical lines
        for (let x = 0; x <= width; x += gridSize) {
            graphics.moveTo(x, 0);
            graphics.lineTo(x, height);
        }
        
        // Draw horizontal lines
        for (let y = 0; y <= height; y += gridSize) {
            graphics.moveTo(0, y);
            graphics.lineTo(width, y);
        }

        graphics.stroke({ width: 1, color: 0x333333, alpha: 0.3 });
        
        this.grid.addChild(graphics);
    }

    drawPlayer(bodyGraphics, cannonGraphics, color) {
        // Clear previous graphics
        bodyGraphics.clear();
        cannonGraphics.clear();
        
        // Draw body (circle)
        bodyGraphics.circle(0, 0, 20);
        bodyGraphics.fill({ color });
        
        // Draw cannon (rectangle)
        cannonGraphics.rect(0, -5, 30, 10);
        cannonGraphics.fill({ color: 0x333333 });
    }

    updatePlayerGraphics(player) {
        // Update player size based on level
        const radius = player.radius || 20;
        
        // Clear and redraw player graphics
        this.playerBody.clear();
        this.playerCannon.clear();
        
        // Draw body
        this.playerBody.circle(0, 0, radius);
        this.playerBody.fill({ color: 0x4CAF50 });
        
        // Draw cannon (scaled with player size)
        const cannonWidth = radius * 1.5;
        const cannonHeight = radius * 0.5;
        this.playerCannon.rect(0, -cannonHeight/2, cannonWidth, cannonHeight);
        this.playerCannon.fill({ color: 0x333333 });
    }

    createProjectile(projectileData) {
        const graphic = new PIXI.Graphics();
        
        // Draw projectile (small circle)
        graphic.circle(0, 0, projectileData.radius || 5);
        
        // Color based on owner (green for local player, red for others)
        const color = projectileData.ownerId === this.socket.id ? 0x4CAF50 : 0xFF0000;
        graphic.fill({ color });
        
        // Position
        graphic.position.set(projectileData.x, projectileData.y);
        
        // Add to container
        this.projectileContainer.addChild(graphic);
        
        // Store reference
        this.projectiles.set(projectileData.id, {
            graphic,
            data: projectileData
        });
        
        return graphic;
    }

    setupSocketListeners() {
        // Track if we've successfully joined a game
        this.gameJoined = false;
        
        // Listen for game not found error
        this.socket.on('connect_error', (error) => {
            console.error('Connection error:', error);
            window.location.href = '/';
        });
        
        this.socket.on('gameJoined', ({ gameId, player, worldBounds }) => {
            console.log('Joined game:', gameId);
            
            // Store player data
            this.playerData = player;
            this.playerGraphics.position.set(player.x, player.y);
            this.playerGraphics.rotation = player.rotation;
            
            // Update player graphics based on level/size
            this.updatePlayerGraphics(player);
            
            // Update UI
            this.updateStatsUI();
            this.gameIdText.text = `Game ID: ${gameId}`;
            
            // Store world bounds
            if (worldBounds) {
                this.worldBounds = worldBounds;
                // Redraw grid with correct bounds
                this.grid.removeChildren();
                this.drawGrid();
            }
            
            this.gameJoined = true;
        });
        
        this.socket.on('gameNotFound', () => {
            console.log('Game not found, redirecting to home');
            window.location.href = '/';
        });

        this.socket.on('playerJoined', (player) => {
            const container = new PIXI.Container();
            const body = new PIXI.Graphics();
            const cannon = new PIXI.Graphics();
            container.addChild(body);
            container.addChild(cannon);
            
            // Draw player with red color for other players
            this.drawPlayer(body, cannon, 0xff0000);
            
            // Set position and rotation
            container.position.set(player.x, player.y);
            container.rotation = player.rotation;
            
            // Add to camera container
            this.camera.addChild(container);
            
            // Store reference
            this.players.set(player.id, {
                container,
                body,
                cannon,
                data: player
            });
        });

        this.socket.on('gameState', (state) => {
            // Update players
            if (state.players) {
                for (const player of state.players) {
                    if (player.id === this.socket.id) {
                        // Update local player data
                        this.playerData = player;
                        
                        // Update player graphics if size changed
                        if (player.radius !== this.playerGraphics.radius) {
                            this.updatePlayerGraphics(player);
                        }
                        
                        // Update UI
                        this.updateStatsUI();
                        
                        // Update position and rotation
                        this.playerGraphics.position.set(player.x, player.y);
                        this.playerGraphics.rotation = player.rotation;
                        
                        // Center camera on player
                        this.updateCamera();
                    } else if (this.players.has(player.id)) {
                        // Update other players
                        const otherPlayer = this.players.get(player.id);
                        otherPlayer.container.position.set(player.x, player.y);
                        otherPlayer.container.rotation = player.rotation;
                        
                        // Update player data
                        otherPlayer.data = player;
                        
                        // Update graphics if size changed
                        if (player.radius !== otherPlayer.body.radius) {
                            otherPlayer.body.clear();
                            otherPlayer.body.circle(0, 0, player.radius);
                            otherPlayer.body.fill({ color: 0xff0000 });
                            
                            otherPlayer.cannon.clear();
                            const cannonWidth = player.radius * 1.5;
                            const cannonHeight = player.radius * 0.5;
                            otherPlayer.cannon.rect(0, -cannonHeight/2, cannonWidth, cannonHeight);
                            otherPlayer.cannon.fill({ color: 0x333333 });
                        }
                    }
                }
            }
            
            // Update food
            if (state.food) {
                this.updateFood(state.food);
            }

            // Update projectiles
            if (state.projectiles) {
                this.updateProjectiles(state.projectiles);
            }
        });

        this.socket.on('playerLeft', ({ id }) => {
            if (this.players.has(id)) {
                this.camera.removeChild(this.players.get(id).container);
                this.players.delete(id);
            }
        });

        this.socket.on('projectileCreated', (projectileData) => {
            this.createProjectile(projectileData);
        });

        this.socket.on('playerUpdated', (playerData) => {
            if (playerData.id === this.socket.id) {
                // Update local player data
                this.playerData = playerData;
                
                // Update UI
                this.updateStatsUI();
            }
        });
    }

    updateStatsUI() {
        if (this.playerData) {
            this.statsText.text = `Level: ${this.playerData.level} | XP: ${this.playerData.experience} | Health: ${this.playerData.health}/${this.playerData.maxHealth}`;
            
            // Show upgrade menu if player has leveled up
            if (this.playerData.level > 1) {
                this.showUpgradeMenu();
            }
        }
    }

    updateCamera() {
        // Center camera on player
        const centerX = window.innerWidth / 2;
        const centerY = window.innerHeight / 2;
        
        // Calculate camera position (negative because we're moving the world, not the camera)
        this.camera.position.x = centerX - this.playerData.x;
        this.camera.position.y = centerY - this.playerData.y;
    }

    setupEventListeners() {
        // Mouse movement for rotation
        document.addEventListener('mousemove', (e) => {
            if (!this.playerGraphics) return;
            
            // Calculate rotation based on mouse position relative to player on screen
            const centerX = window.innerWidth / 2;
            const centerY = window.innerHeight / 2;
            const dx = e.clientX - centerX;
            const dy = e.clientY - centerY;
            const rotation = Math.atan2(dy, dx);
            
            // Update local rotation immediately for smooth feel
            this.playerGraphics.rotation = rotation;
            
            // Send rotation to server
            this.socket.emit('playerInput', {
                inputs: this.playerInputs,
                rotation: rotation
            });
        });

        // Mouse click for shooting
        document.addEventListener('mousedown', (e) => {
            if (e.button === 0) { // Left click
                this.playerInputs.shoot = true;
                this.socket.emit('shoot');
            }
        });

        document.addEventListener('mouseup', (e) => {
            if (e.button === 0) { // Left click
                this.playerInputs.shoot = false;
            }
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

    updateFood(foodData) {
        // If no food data, return early
        if (!foodData || !Array.isArray(foodData)) {
            return;
        }
        
        // Clear previous food container
        this.foodContainer.removeChildren();
        
        // Track current food IDs for cleanup
        const currentFoodIds = new Set();
        
        // Render each food item
        for (const food of foodData) {
            const foodGraphic = this.getFoodGraphic(food);
            
            // Position the food
            foodGraphic.x = food.x;
            foodGraphic.y = food.y;
            
            // Add to container
            this.foodContainer.addChild(foodGraphic);
            
            // Track this food ID
            currentFoodIds.add(food.id);
        }
        
        // Clean up any food graphics that are no longer in the game
        this.cleanupFoodGraphics(currentFoodIds);
    }

    updateProjectiles(projectileData) {
        // If no projectile data, return early
        if (!projectileData || !Array.isArray(projectileData)) {
            return;
        }
        
        // Track current projectile IDs
        const currentProjectileIds = new Set();
        
        // Update or create projectiles
        for (const projectile of projectileData) {
            currentProjectileIds.add(projectile.id);
            
            if (this.projectiles.has(projectile.id)) {
                // Update existing projectile
                const existingProjectile = this.projectiles.get(projectile.id);
                existingProjectile.graphic.position.set(projectile.x, projectile.y);
                existingProjectile.data = projectile;
            } else {
                // Create new projectile
                this.createProjectile(projectile);
            }
        }
        
        // Remove projectiles that are no longer in the game
        for (const [id, projectile] of this.projectiles.entries()) {
            if (!currentProjectileIds.has(id)) {
                this.projectileContainer.removeChild(projectile.graphic);
                this.projectiles.delete(id);
            }
        }
    }

    getFoodGraphic(food) {
        // Check if we already have this food graphic cached
        if (this.foodGraphics[food.type] && this.foodGraphics[food.type][food.id]) {
            return this.foodGraphics[food.type][food.id];
        }
        
        // Create new food graphic based on type
        const graphic = new PIXI.Graphics();
        const radius = food.radius || 10;
        
        switch (food.type) {
            case 'SQUARE':
                // Yellow square
                const size = radius * 1.8; // Make square slightly larger than radius for visibility
                graphic.rect(-size/2, -size/2, size, size);
                graphic.fill(0xFFFF00);
                break;
                
            case 'TRIANGLE':
                // Red triangle
                // Draw equilateral triangle
                const height = radius * 2 * Math.sqrt(3) / 2;
                graphic.moveTo(0, -height/2);
                graphic.lineTo(-radius, height/2);
                graphic.lineTo(radius, height/2);
                graphic.lineTo(0, -height/2);
                graphic.fill(0xFF0000);
                break;
                
            case 'PENTAGON':
                // Blue pentagon
                // Draw regular pentagon
                const points = [];
                for (let i = 0; i < 5; i++) {
                    const angle = (i * 2 * Math.PI / 5) - Math.PI/2; // Start at top
                    const x = Math.cos(angle) * radius;
                    const y = Math.sin(angle) * radius;
                    points.push(x, y);
                }
                graphic.drawPolygon(points);
                graphic.fill(0x0000FF);
                break;
        }
        
        // Add a subtle border
        graphic.lineStyle(1, 0x000000, 0.3);
        
        switch (food.type) {
            case 'SQUARE':
                const size = radius * 1.8;
                graphic.rect(-size/2, -size/2, size, size);
                break;
            case 'TRIANGLE':
                const height = radius * 2 * Math.sqrt(3) / 2;
                graphic.moveTo(0, -height/2);
                graphic.lineTo(-radius, height/2);
                graphic.lineTo(radius, height/2);
                graphic.lineTo(0, -height/2);
                break;
            case 'PENTAGON':
                const points = [];
                for (let i = 0; i < 5; i++) {
                    const angle = (i * 2 * Math.PI / 5) - Math.PI/2;
                    const x = Math.cos(angle) * radius;
                    const y = Math.sin(angle) * radius;
                    points.push(x, y);
                }
                graphic.drawPolygon(points);
                break;
        }
        
        // Add a slight rotation animation
        graphic.rotation = Math.random() * Math.PI; // Random initial rotation
        
        // Make sure the food type object exists
        if (!this.foodGraphics[food.type]) {
            this.foodGraphics[food.type] = {};
        }
        
        // Store in cache
        this.foodGraphics[food.type][food.id] = graphic;
        
        return graphic;
    }

    animateFood(delta) {
        // Rotate each food item slightly
        for (const type in this.foodGraphics) {
            for (const id in this.foodGraphics[type]) {
                const graphic = this.foodGraphics[type][id];
                
                // Different rotation speeds for different types
                let rotationSpeed;
                switch (type) {
                    case 'SQUARE': rotationSpeed = 0.001; break;
                    case 'TRIANGLE': rotationSpeed = 0.002; break;
                    case 'PENTAGON': rotationSpeed = 0.0015; break;
                    default: rotationSpeed = 0.001;
                }
                
                graphic.rotation += rotationSpeed * delta;
            }
        }
    }

    gameLoop(delta) {
        // Animate food
        this.animateFood(delta);
        
        // Auto-fire if mouse is held down
        if (this.playerInputs.shoot) {
            this.socket.emit('shoot');
        }
    }

    cleanupFoodGraphics(currentFoodIds) {
        for (const type in this.foodGraphics) {
            for (const id in this.foodGraphics[type]) {
                if (!currentFoodIds.has(id)) {
                    // This food is no longer in the game state, remove it from cache
                    delete this.foodGraphics[type][id];
                }
            }
        }
    }
}

// Start game when window loads
document.addEventListener('DOMContentLoaded', async () => {
    const game = new Game();
    await game.init();
}); 