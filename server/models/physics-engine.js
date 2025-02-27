/**
 * Physics engine for diep.io-like movement and collisions
 * Implements soft body physics with damping for mushy, petri dish-like movement
 */

class RigidBody {
  constructor(id, x, y, radius, mass = 1) {
    this.id = id;
    this.position = { x, y };
    this.velocity = { x: 0, y: 0 };
    this.acceleration = { x: 0, y: 0 };
    this.force = { x: 0, y: 0 };
    this.radius = radius;
    this.mass = mass;
    this.inverseMass = 1 / mass;
    this.damping = 0.95; // Damping coefficient (0 = full stop, 1 = no damping)
    this.restitution = 0.5; // Bounciness (0 = no bounce, 1 = perfect bounce)
    this.static = false; // Static bodies don't move (walls, etc.)
  }

  applyForce(forceX, forceY) {
    this.force.x += forceX;
    this.force.y += forceY;
  }

  applyImpulse(impulseX, impulseY) {
    // Apply an instantaneous change in velocity
    this.velocity.x += impulseX * this.inverseMass;
    this.velocity.y += impulseY * this.inverseMass;
  }

  setVelocity(velocityX, velocityY) {
    this.velocity.x = velocityX;
    this.velocity.y = velocityY;
  }

  update(deltaTime) {
    if (this.static) return;

    // Calculate acceleration from force: a = F/m
    this.acceleration.x = this.force.x * this.inverseMass;
    this.acceleration.y = this.force.y * this.inverseMass;

    // Update velocity: v = v + a*dt
    this.velocity.x += this.acceleration.x * deltaTime;
    this.velocity.y += this.acceleration.y * deltaTime;

    // Apply damping: v = v * damping
    this.velocity.x *= this.damping;
    this.velocity.y *= this.damping;

    // Update position: p = p + v*dt
    this.position.x += this.velocity.x * deltaTime;
    this.position.y += this.velocity.y * deltaTime;

    // Reset forces for next frame
    this.force.x = 0;
    this.force.y = 0;
  }
}

class PhysicsEngine {
  constructor(worldWidth = 4000, worldHeight = 4000) {
    this.bodies = new Map();
    this.worldBounds = {
      width: worldWidth,
      height: worldHeight
    };
    this.collisionPairs = [];
  }

  addBody(body) {
    this.bodies.set(body.id, body);
    return body;
  }

  removeBody(id) {
    this.bodies.delete(id);
  }

  update(deltaTime = 1/60) {
    // Clear collision pairs
    this.collisionPairs = [];

    // Detect collisions
    this.detectCollisions();

    // Resolve collisions
    this.resolveCollisions();

    // Update all bodies
    for (const body of this.bodies.values()) {
      body.update(deltaTime);
      this.constrainToWorld(body);
    }
  }

  detectCollisions() {
    const bodies = Array.from(this.bodies.values());
    
    // Simple O(n²) collision detection
    for (let i = 0; i < bodies.length; i++) {
      for (let j = i + 1; j < bodies.length; j++) {
        const bodyA = bodies[i];
        const bodyB = bodies[j];
        
        // Skip if either body is static
        if (bodyA.static && bodyB.static) continue;
        
        // Calculate distance between centers
        const dx = bodyB.position.x - bodyA.position.x;
        const dy = bodyB.position.y - bodyA.position.y;
        const distanceSquared = dx * dx + dy * dy;
        
        // Sum of radii
        const radiusSum = bodyA.radius + bodyB.radius;
        
        // Check if colliding
        if (distanceSquared < radiusSum * radiusSum) {
          this.collisionPairs.push({ bodyA, bodyB, dx, dy, distanceSquared });
        }
      }
    }
  }

  resolveCollisions() {
    for (const pair of this.collisionPairs) {
      const { bodyA, bodyB, dx, dy, distanceSquared } = pair;
      
      // Calculate actual distance
      const distance = Math.sqrt(distanceSquared);
      
      // Avoid division by zero
      if (distance === 0) continue;
      
      // Calculate penetration depth
      const penetration = bodyA.radius + bodyB.radius - distance;
      
      // Normalize collision vector
      const nx = dx / distance;
      const ny = dy / distance;
      
      // Calculate repulsion force based on penetration
      const repulsionStrength = penetration * 0.05; // Adjust for softer/harder collisions
      
      // Calculate repulsion force
      const repulsionX = nx * repulsionStrength;
      const repulsionY = ny * repulsionStrength;
      
      // Apply forces in opposite directions
      if (!bodyA.static) {
        bodyA.applyForce(-repulsionX * bodyA.mass, -repulsionY * bodyA.mass);
      }
      
      if (!bodyB.static) {
        bodyB.applyForce(repulsionX * bodyB.mass, repulsionY * bodyB.mass);
      }
    }
  }

  constrainToWorld(body) {
    // Constrain to world bounds with soft boundaries
    const buffer = body.radius;
    
    // Left boundary
    if (body.position.x < buffer) {
      body.position.x = buffer;
      body.velocity.x *= -body.restitution;
    }
    
    // Right boundary
    if (body.position.x > this.worldBounds.width - buffer) {
      body.position.x = this.worldBounds.width - buffer;
      body.velocity.x *= -body.restitution;
    }
    
    // Top boundary
    if (body.position.y < buffer) {
      body.position.y = buffer;
      body.velocity.y *= -body.restitution;
    }
    
    // Bottom boundary
    if (body.position.y > this.worldBounds.height - buffer) {
      body.position.y = this.worldBounds.height - buffer;
      body.velocity.y *= -body.restitution;
    }
  }
}

module.exports = { PhysicsEngine, RigidBody }; 