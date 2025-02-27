const { RigidBody } = require('./physics-engine');

const PLAYER_SPEED = 5;
const PLAYER_RADIUS = 20;
const PLAYER_MASS = 1;
const PLAYER_FORCE = 500; // Force to apply when moving

class Player extends RigidBody {
  constructor(id, x, y) {
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

  update(deltaTime = 1/60) {
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
    
    // Update shooting cooldown
    if (this.shootCooldown > 0) {
      this.shootCooldown -= deltaTime;
    }
  }

  canShoot() {
    return this.shootCooldown <= 0;
  }

  shoot() {
    if (!this.canShoot()) return null;
    
    // Set cooldown based on fire rate stat
    this.shootCooldown = this.baseShootCooldown / this.stats.fireRate;
    
    // Return projectile stats
    return {
      damage: 10 * this.stats.damage,
      speed: 800 * this.stats.projectileSpeed,
      health: this.stats.projectileHealth
    };
  }

  takeDamage(amount) {
    this.health -= amount;
    return this.health <= 0;
  }

  heal(amount) {
    this.health = Math.min(this.health + amount, this.maxHealth);
  }

  addExperience(amount) {
    this.experience += amount;
    
    // Check for level up
    const newLevel = Math.floor(1 + Math.sqrt(this.experience / 100));
    if (newLevel > this.level) {
      this.levelUp(newLevel);
      return true;
    }
    
    return false;
  }

  levelUp(newLevel) {
    this.level = newLevel;
    this.maxHealth = 100 + (this.level - 1) * 10;
    this.health = this.maxHealth;
    this.radius = PLAYER_RADIUS + (this.level - 1) * 2; // Grow slightly with level
  }

  upgrade(stat) {
    if (!this.stats[stat]) return false;
    
    // Each upgrade costs level * 10 experience
    const cost = this.level * 10;
    
    if (this.experience < cost) return false;
    
    this.experience -= cost;
    this.stats[stat] += 0.1; // 10% increase per upgrade
    
    return true;
  }

  getState() {
    return {
      id: this.id,
      x: this.position.x,
      y: this.position.y,
      rotation: this.rotation,
      radius: this.radius,
      health: this.health,
      maxHealth: this.maxHealth,
      level: this.level,
      experience: this.experience,
      stats: this.stats
    };
  }
}

module.exports = Player; 