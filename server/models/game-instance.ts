import Player from './player';
import Projectile from './projectile';
import { PhysicsEngine, RigidBody } from './physics-engine';

// Game world constants
const WORLD_WIDTH = 500;
const WORLD_HEIGHT = 500;

// Food constants
const FOOD_TYPES = {
  SQUARE: { radius: 10, mass: 0.5, experience: 100, color: 0xFFFF00 },
  TRIANGLE: { radius: 15, mass: 0.8, experience: 300, color: 0xFF0000 },
  PENTAGON: { radius: 25, mass: 1.2, experience: 900, color: 0x0000FF }
};

type FoodType = keyof typeof FOOD_TYPES;

interface FoodState {
  id: string;
  x: number;
  y: number;
  radius: number;
  type: FoodType;
  color: number;
}

interface GameState {
  players: ReturnType<Player['getState']>[];
  projectiles: ReturnType<Projectile['getState']>[];
  food: FoodState[];
  worldBounds: {
    width: number;
    height: number;
  };
}

class Food extends RigidBody {
  type: FoodType;
  experience: number;
  color: number;

  constructor(id: string, x: number, y: number, type: FoodType) {
    const foodType = FOOD_TYPES[type];
    super(id, x, y, foodType.radius, foodType.mass);
    this.type = type;
    this.experience = foodType.experience;
    this.color = foodType.color;
    this.damping = 0.98; // Food has less damping than players
  }

  getState(): FoodState {
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

export class GameInstance {
  players: Map<string, Player>;
  food: Map<string, Food>;
  projectiles: Map<string, Projectile>;
  physics: PhysicsEngine;
  lastUpdateTime: number;
  foodCount: number;
  projectileCount: number;

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

  initializeFood(): void {
    // Add initial food
    const foodCount = {
      SQUARE: 100,
      TRIANGLE: 50,
      PENTAGON: 20
    };
    
    for (const [type, count] of Object.entries(foodCount)) {
      for (let i = 0; i < count; i++) {
        this.spawnFood(type as FoodType);
      }
    }
  }

  spawnFood(type: FoodType): Food {
    const id = `food-${this.foodCount++}`;
    const x = Math.random() * WORLD_WIDTH;
    const y = Math.random() * WORLD_HEIGHT;
    
    const food = new Food(id, x, y, type);
    this.food.set(id, food);
    this.physics.addBody(food);
    
    return food;
  }

  addPlayer(id: string): Player {
    // Spawn player at random position
    const x = Math.random() * WORLD_WIDTH;
    const y = Math.random() * WORLD_HEIGHT;
    
    const player = new Player(id, x, y);
    this.players.set(id, player);
    this.physics.addBody(player);
    
    return player;
  }

  removePlayer(id: string): void {
    if (this.players.has(id)) {
      this.physics.removeBody(id);
      this.players.delete(id);
    }
  }

  handlePlayerShoot(playerId: string): Projectile | null {
    const player = this.players.get(playerId);
    if (!player || !player.canShoot()) {
      return null;
    }
    
    // Create projectile
    const id = `projectile-${this.projectileCount++}`;
    const { x, y } = player.position;
    const rotation = player.rotation;
    
    // Get projectile stats from player
    const projectileStats = player.getProjectileStats();
    
    // Create projectile
    const projectile = new Projectile(
      id,
      playerId,
      x,
      y,
      rotation,
      projectileStats
    );
    
    // Add to game
    this.projectiles.set(id, projectile);
    this.physics.addBody(projectile);
    
    // Reset player's shoot cooldown
    player.shoot();
    
    return projectile;
  }

  upgradePlayer(playerId: string, stat: string): boolean {
    const player = this.players.get(playerId);
    if (!player) return false;
    
    return player.upgrade(stat as keyof Player['stats']);
  }

  update(): void {
    const now = Date.now();
    const deltaTime = (now - this.lastUpdateTime) / 1000; // Convert to seconds
    this.lastUpdateTime = now;
    
    // Update physics
    this.physics.update(deltaTime);
    
    // Update players
    for (const player of this.players.values()) {
      player.update(deltaTime);
      
      // Check for food collisions
      /*
      this.checkFoodCollisions(player);
      */
    }
    
    // Update projectiles
    this.updateProjectiles(deltaTime);
    
    // Respawn food if needed
    this.respawnFood();
  }

  updateProjectiles(deltaTime: number): void {
    const deadProjectiles: string[] = [];
    
    for (const [id, projectile] of this.projectiles.entries()) {
      projectile.update(deltaTime);
      
      // Check if projectile is dead
      if (projectile.isDead()) {
        deadProjectiles.push(id);
        continue;
      }
      
      // Check for collisions with players
      this.checkProjectilePlayerCollisions(projectile);
    }
    
    // Remove dead projectiles
    for (const id of deadProjectiles) {
      this.physics.removeBody(id);
      this.projectiles.delete(id);
    }
  }

  checkProjectilePlayerCollisions(projectile: Projectile): void {
    for (const [playerId, player] of this.players.entries()) {
      // Skip if projectile belongs to this player
      if (projectile.ownerId === playerId) {
        continue;
      }
      
      // Calculate distance between projectile and player
      const dx = player.position.x - projectile.position.x;
      const dy = player.position.y - projectile.position.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      // Check if collision
      if (distance < player.radius + projectile.radius) {
        // Player takes damage
        const isDead = player.takeDamage(projectile.damage);
        
        // Projectile takes damage
        const isProjectileDead = projectile.takeDamage(1);
        
        if (isProjectileDead) {
          this.physics.removeBody(projectile.id);
          this.projectiles.delete(projectile.id);
        }
        
        // If player is dead, give experience to killer
        if (isDead) {
          const killer = this.players.get(projectile.ownerId);
          if (killer) {
            // Award experience based on victim's level
            const expReward = player.level * 500;
            killer.addExperience(expReward);
          }
          
          // Respawn player
          this.removePlayer(playerId);
          
          // Create new player with same ID
          this.addPlayer(playerId);
        }
        
        // Stop checking if projectile is destroyed
        if (isProjectileDead) {
          break;
        }
      }
    }
  }

  checkFoodCollisions(player: Player): void {
    const foodToRemove: string[] = [];
    
    for (const [id, food] of this.food.entries()) {
      // Calculate distance between player and food
      const dx = player.position.x - food.position.x;
      const dy = player.position.y - food.position.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      // Check if collision
      if (distance < player.radius + food.radius) {
        // Player gains experience
        player.addExperience(food.experience);
        
        // Remove food
        foodToRemove.push(id);
      }
    }
    
    // Remove collected food
    for (const id of foodToRemove) {
      this.physics.removeBody(id);
      this.food.delete(id);
    }
  }

  respawnFood(): void {
    // Count current food by type
    const currentCounts = {
      SQUARE: 0,
      TRIANGLE: 0,
      PENTAGON: 0
    };
    
    for (const food of this.food.values()) {
      currentCounts[food.type]++;
    }
    
    // Target counts
    const targetCounts = {
      SQUARE: 100,
      TRIANGLE: 50,
      PENTAGON: 20
    };
    
    // Spawn new food to reach target counts
    for (const [type, target] of Object.entries(targetCounts)) {
      const current = currentCounts[type as FoodType];
      const needed = Math.max(0, target - current);
      
      for (let i = 0; i < needed; i++) {
        this.spawnFood(type as FoodType);
      }
    }
  }

  getState(): GameState {
    return {
      players: Array.from(this.players.values()).map(player => player.getState()),
      projectiles: Array.from(this.projectiles.values()).map(projectile => projectile.getState()),
      food: Array.from(this.food.values()).map(food => food.getState()),
      worldBounds: {
        width: WORLD_WIDTH,
        height: WORLD_HEIGHT
      }
    };
  }
}

export default GameInstance; 