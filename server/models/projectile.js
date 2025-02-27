const { RigidBody } = require('./physics-engine');

// Projectile constants
const PROJECTILE_RADIUS = 5;
const PROJECTILE_MASS = 0.2;
const PROJECTILE_SPEED = 800;
const PROJECTILE_DAMAGE = 10;
const PROJECTILE_LIFETIME = 2; // seconds

class Projectile extends RigidBody {
  constructor(id, ownerId, x, y, rotation, stats = {}) {
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

  update(deltaTime) {
    // Update physics
    super.update(deltaTime);
    
    // Update lifetime
    this.timeRemaining -= deltaTime;
  }

  isDead() {
    return this.timeRemaining <= 0 || this.health <= 0;
  }

  takeDamage(amount) {
    this.health -= amount;
    return this.health <= 0;
  }

  getState() {
    return {
      id: this.id,
      x: this.position.x,
      y: this.position.y,
      radius: this.radius,
      ownerId: this.ownerId
    };
  }
}

module.exports = Projectile; 