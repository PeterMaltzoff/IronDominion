const Player = require('./player');
const Projectile = require('./projectile');
const { PhysicsEngine, RigidBody } = require('./physics-engine');

// Game world constants
const WORLD_WIDTH = 4000;
const WORLD_HEIGHT = 4000;

// Food constants
const FOOD_TYPES = {
  SQUARE: { radius: 10, mass: 0.5, experience: 100, color: 0xFFFF00 },
  TRIANGLE: { radius: 15, mass: 0.8, experience: 300, color: 0xFF0000 },
  PENTAGON: { radius: 25, mass: 1.2, experience: 900, color: 0x0000FF }
};

class Food extends RigidBody {
  constructor(id, x, y, type) {
    const foodType = FOOD_TYPES[type];
    super(id, x, y, foodType.radius, foodType.mass);
    this.type = type;
    this.experience = foodType.experience;
    this.color = foodType.color;
    this.damping = 0.98; // Food has less damping than players
  }

  getState() {
    return {
      id: this.id,
      x: this.position.x,
      y: this.position.y,
      radius: this.radius,
      type: this.type,
      color: this.color
    };
  }
}

class GameInstance {
  constructor() {
    this.players = new Map();
    this.food = new Map();
    this.projectiles = new Map();
    this.physics = new PhysicsEngine(WORLD_WIDTH, WORLD_HEIGHT);
    this.lastUpdateTime = Date.now();
    this.foodCount = 0;
    this.projectileCount = 0;
    
    // Initialize food
    this.initializeFood();
  }

  initializeFood() {
    // Add some initial food to the game
    const foodCount = {
      SQUARE: 100,
      TRIANGLE: 50,
      PENTAGON: 20
    };

    for (const [type, count] of Object.entries(foodCount)) {
      for (let i = 0; i < count; i++) {
        this.spawnFood(type);
      }
    }
  }

  spawnFood(type) {
    const id = `food_${this.foodCount++}`;
    const x = Math.random() * WORLD_WIDTH;
    const y = Math.random() * WORLD_HEIGHT;
    
    const food = new Food(id, x, y, type);
    this.food.set(id, food);
    this.physics.addBody(food);
    
    return food;
  }

  addPlayer(id) {
    // Start player in random position within the game area
    const x = Math.random() * WORLD_WIDTH;
    const y = Math.random() * WORLD_HEIGHT;
    
    const player = new Player(id, x, y);
    this.players.set(id, player);
    this.physics.addBody(player);
    
    return player;
  }

  removePlayer(id) {
    if (this.players.has(id)) {
      this.physics.removeBody(id);
      this.players.delete(id);
    }
  }

  handlePlayerShoot(playerId) {
    const player = this.players.get(playerId);
    if (!player) return null;
    
    // Check if player can shoot
    const projectileStats = player.shoot();
    if (!projectileStats) return null;
    
    // Create projectile
    const id = `projectile_${this.projectileCount++}`;
    const projectile = new Projectile(
      id,
      playerId,
      player.position.x + Math.cos(player.rotation) * (player.radius + 10),
      player.position.y + Math.sin(player.rotation) * (player.radius + 10),
      player.rotation,
      projectileStats
    );
    
    // Add to game
    this.projectiles.set(id, projectile);
    this.physics.addBody(projectile);
    
    return projectile;
  }

  upgradePlayer(playerId, stat) {
    const player = this.players.get(playerId);
    if (!player) return false;
    
    return player.upgrade(stat);
  }

  update() {
    // Calculate delta time
    const now = Date.now();
    const deltaTime = (now - this.lastUpdateTime) / 1000; // Convert to seconds
    this.lastUpdateTime = now;
    
    // Cap delta time to avoid large jumps
    const cappedDeltaTime = Math.min(deltaTime, 0.1);
    
    // Update physics
    this.physics.update(cappedDeltaTime);
    
    // Update all players
    for (const player of this.players.values()) {
      player.update(cappedDeltaTime);
      
      // Check for player shooting
      if (player.inputs.shoot && player.canShoot()) {
        this.handlePlayerShoot(player.id);
      }
      
      // Check food collisions
      this.checkFoodCollisions(player);
    }
    
    // Update projectiles
    this.updateProjectiles(cappedDeltaTime);
    
    // Respawn food if needed
    this.respawnFood();
  }

  updateProjectiles(deltaTime) {
    // Track projectiles to remove
    const projectilesToRemove = [];
    
    // Update each projectile
    for (const [id, projectile] of this.projectiles.entries()) {
      projectile.update(deltaTime);
      
      // Check if projectile is dead
      if (projectile.isDead()) {
        projectilesToRemove.push(id);
        continue;
      }
      
      // Check for collisions with players
      this.checkProjectilePlayerCollisions(projectile);
    }
    
    // Remove dead projectiles
    for (const id of projectilesToRemove) {
      this.physics.removeBody(id);
      this.projectiles.delete(id);
    }
  }

  checkProjectilePlayerCollisions(projectile) {
    // Skip collisions with the owner
    for (const [id, player] of this.players.entries()) {
      // Skip owner
      if (id === projectile.ownerId) continue;
      
      // Calculate distance
      const dx = player.position.x - projectile.position.x;
      const dy = player.position.y - projectile.position.y;
      const distanceSquared = dx * dx + dy * dy;
      
      // Sum of radii
      const radiusSum = player.radius + projectile.radius;
      
      // Check if colliding
      if (distanceSquared < radiusSum * radiusSum) {
        // Player takes damage
        const killed = player.takeDamage(projectile.damage);
        
        // Projectile takes damage
        const destroyed = projectile.takeDamage(1);
        
        // If player was killed, give experience to the shooter
        if (killed) {
          const shooter = this.players.get(projectile.ownerId);
          if (shooter) {
            // Award experience based on killed player's level
            const expReward = 500 * player.level;
            shooter.addExperience(expReward);
          }
        }
        
        // If projectile was destroyed, mark for removal
        if (destroyed) {
          return true;
        }
      }
    }
    
    return false;
  }

  checkFoodCollisions(player) {
    for (const [foodId, food] of this.food.entries()) {
      // Calculate distance between player and food
      const dx = player.position.x - food.position.x;
      const dy = player.position.y - food.position.y;
      const distanceSquared = dx * dx + dy * dy;
      
      // Sum of radii
      const radiusSum = player.radius + food.radius;
      
      // Check if colliding and player is larger
      if (distanceSquared < radiusSum * radiusSum && player.radius >= food.radius) {
        // Player gains experience
        player.addExperience(food.experience);
        
        // Remove the food
        this.physics.removeBody(foodId);
        this.food.delete(foodId);
      }
    }
  }

  respawnFood() {
    // Maintain a certain amount of each food type
    const targetCounts = {
      SQUARE: 100,
      TRIANGLE: 50,
      PENTAGON: 20
    };
    
    // Count current food by type
    const currentCounts = {
      SQUARE: 0,
      TRIANGLE: 0,
      PENTAGON: 0
    };
    
    for (const food of this.food.values()) {
      currentCounts[food.type]++;
    }
    
    // Spawn new food if needed
    for (const [type, targetCount] of Object.entries(targetCounts)) {
      const toSpawn = Math.max(0, targetCount - currentCounts[type]);
      for (let i = 0; i < toSpawn; i++) {
        this.spawnFood(type);
      }
    }
  }

  getState() {
    const playerStates = [];
    for (const player of this.players.values()) {
      playerStates.push(player.getState());
    }
    
    const foodStates = [];
    for (const food of this.food.values()) {
      foodStates.push(food.getState());
    }
    
    const projectileStates = [];
    for (const projectile of this.projectiles.values()) {
      projectileStates.push(projectile.getState());
    }
    
    return {
      players: playerStates,
      food: foodStates,
      projectiles: projectileStates,
      worldBounds: {
        width: WORLD_WIDTH,
        height: WORLD_HEIGHT
      }
    };
  }
}

module.exports = GameInstance; 