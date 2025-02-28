import { RigidBody } from './physics-engine';

const PLAYER_SPEED = 5;
const PLAYER_RADIUS = 20;
const PLAYER_MASS = 1;
const PLAYER_FORCE = 500; // Force to apply when moving

interface PlayerInputs {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  shoot: boolean;
}

interface PlayerStats {
  speed: number;
  damage: number;
  fireRate: number;
  projectileSpeed: number;
  projectileHealth: number;
}

interface PlayerState {
  id: string;
  x: number;
  y: number;
  radius: number;
  rotation: number;
  level: number;
  experience: number;
  health: number;
  maxHealth: number;
  stats: PlayerStats;
}

export class Player extends RigidBody {
  rotation: number;
  inputs: PlayerInputs;
  level: number;
  experience: number;
  health: number;
  maxHealth: number;
  stats: PlayerStats;
  shootCooldown: number;
  baseShootCooldown: number;

  constructor(id: string, x: number, y: number) {
    super(id, x, y, PLAYER_RADIUS, PLAYER_MASS);
    this.rotation = 0;
    this.inputs = {
      up: false,
      down: false,
      left: false,
      right: false,
      shoot: false
    };
    this.level = 1;
    this.experience = 0;
    this.health = 100;
    this.maxHealth = 100;
    
    // Stats for upgrades
    this.stats = {
      speed: 1,
      damage: 1,
      fireRate: 1,
      projectileSpeed: 1,
      projectileHealth: 1
    };
    
    // Shooting cooldown
    this.shootCooldown = 0;
    this.baseShootCooldown = 0.5; // seconds
  }

  update(deltaTime: number = 1/60): void {
    // Apply forces based on inputs
    let forceX = 0;
    let forceY = 0;
    
    if (this.inputs.up) forceY -= PLAYER_FORCE * this.stats.speed;
    if (this.inputs.down) forceY += PLAYER_FORCE * this.stats.speed;
    if (this.inputs.left) forceX -= PLAYER_FORCE * this.stats.speed;
    if (this.inputs.right) forceX += PLAYER_FORCE * this.stats.speed;
    
    // Apply the calculated force
    this.applyForce(forceX, forceY);
    
    // Update physics
    super.update(deltaTime);
    
    // Update cooldowns
    if (this.shootCooldown > 0) {
      this.shootCooldown -= deltaTime;
    }
  }

  canShoot(): boolean {
    return this.shootCooldown <= 0;
  }

  shoot(): void {
    // Reset cooldown when shooting
    this.shootCooldown = this.baseShootCooldown / this.stats.fireRate;
  }

  getProjectileStats(): { damage: number, speed: number, health: number } {
    return {
      damage: 10 * this.stats.damage,
      speed: 800 * this.stats.projectileSpeed,
      health: this.stats.projectileHealth
    };
  }

  takeDamage(amount: number): boolean {
    this.health -= amount;
    return this.health <= 0;
  }

  heal(amount: number): void {
    this.health = Math.min(this.health + amount, this.maxHealth);
  }

  addExperience(amount: number): boolean {
    this.experience += amount;
    
    // Check for level up
    const expNeeded = this.level * 1000;
    if (this.experience >= expNeeded) {
      this.levelUp(this.level + 1);
      return true;
    }
    
    return false;
  }

  levelUp(newLevel: number): void {
    this.level = newLevel;
    this.maxHealth = 100 + (this.level - 1) * 10;
    this.health = this.maxHealth; // Heal on level up
  }

  upgrade(stat: keyof PlayerStats): boolean {
    if (this.level > Object.values(this.stats).reduce((sum, value) => sum + value - 1, 0)) {
      if (this.stats[stat] < 10) { // Max level for each stat
        this.stats[stat]++;
        
        // Special case for health upgrade
        if (stat === 'speed') {
          this.maxHealth += 10;
          this.health += 10;
        }
        
        return true;
      }
    }
    return false;
  }

  getState(): PlayerState {
    return {
      id: this.id,
      x: this.position.x,
      y: this.position.y,
      radius: this.radius,
      rotation: this.rotation,
      level: this.level,
      experience: this.experience,
      health: this.health,
      maxHealth: this.maxHealth,
      stats: { ...this.stats }
    };
  }
}

export default Player; 