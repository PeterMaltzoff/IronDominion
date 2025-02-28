import { RigidBody } from './physics-engine';

// Projectile constants
const PROJECTILE_RADIUS = 5;
const PROJECTILE_MASS = 0.2;
const PROJECTILE_SPEED = 800;
const PROJECTILE_DAMAGE = 10;
const PROJECTILE_LIFETIME = 2; // seconds

interface ProjectileStats {
  damage?: number;
  health?: number;
  speed?: number;
}

interface ProjectileState {
  id: string;
  x: number;
  y: number;
  radius: number;
  ownerId: string;
}

export class Projectile extends RigidBody {
  ownerId: string;
  damage: number;
  health: number;
  lifetime: number;
  timeRemaining: number;

  constructor(id: string, ownerId: string, x: number, y: number, rotation: number, stats: ProjectileStats = {}) {
    super(id, x, y, PROJECTILE_RADIUS, PROJECTILE_MASS);
    
    this.ownerId = ownerId;
    this.damage = stats.damage || PROJECTILE_DAMAGE;
    this.health = stats.health || 1; // Projectile health (for piercing)
    this.damping = 0.99; // Less damping than players
    
    // Set initial velocity based on rotation
    const speed = stats.speed || PROJECTILE_SPEED;
    this.setVelocity(
      Math.cos(rotation) * speed,
      Math.sin(rotation) * speed
    );
    
    // Track lifetime
    this.lifetime = PROJECTILE_LIFETIME;
    this.timeRemaining = this.lifetime;
  }

  update(deltaTime: number): void {
    // Update physics
    super.update(deltaTime);
    
    // Update lifetime
    this.timeRemaining -= deltaTime;
  }

  isDead(): boolean {
    return this.timeRemaining <= 0 || this.health <= 0;
  }

  takeDamage(amount: number): boolean {
    this.health -= amount;
    return this.health <= 0;
  }

  getState(): ProjectileState {
    return {
      id: this.id,
      x: this.position.x,
      y: this.position.y,
      radius: this.radius,
      ownerId: this.ownerId
    };
  }
}

export default Projectile; 