/**
 * Physics engine for diep.io-like movement and collisions
 * Implements soft body physics with damping for mushy, petri dish-like movement
 */

export interface Vector2D {
  x: number;
  y: number;
}

export class RigidBody {
  id: string;
  position: Vector2D;
  velocity: Vector2D;
  acceleration: Vector2D;
  force: Vector2D;
  radius: number;
  mass: number;
  inverseMass: number;
  damping: number;
  restitution: number;
  static: boolean;

  constructor(id: string, x: number, y: number, radius: number, mass: number = 1) {
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

  applyForce(forceX: number, forceY: number): void {
    this.force.x += forceX;
    this.force.y += forceY;
  }

  applyImpulse(impulseX: number, impulseY: number): void {
    // Apply an instantaneous change in velocity
    this.velocity.x += impulseX * this.inverseMass;
    this.velocity.y += impulseY * this.inverseMass;
  }

  setVelocity(velocityX: number, velocityY: number): void {
    this.velocity.x = velocityX;
    this.velocity.y = velocityY;
  }

  update(deltaTime: number): void {
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

export interface Collision {
  a: RigidBody;
  b: RigidBody;
  distance: number;
  overlap: number;
}

export class PhysicsEngine {
  bodies: Map<string, RigidBody>;
  worldWidth: number;
  worldHeight: number;

  constructor(worldWidth: number = 4000, worldHeight: number = 4000) {
    this.bodies = new Map();
    this.worldWidth = worldWidth;
    this.worldHeight = worldHeight;
  }

  addBody(body: RigidBody): void {
    this.bodies.set(body.id, body);
  }

  removeBody(id: string): void {
    this.bodies.delete(id);
  }

  update(deltaTime: number = 1/60): void {
    // Update all bodies
    for (const body of this.bodies.values()) {
      body.update(deltaTime);
      this.constrainToWorld(body);
    }

    // Resolve collisions
    this.resolveCollisions();
  }

  detectCollisions(): Collision[] {
    const collisions: Collision[] = [];
    const bodies = Array.from(this.bodies.values());

    // Check each pair of bodies for collisions
    for (let i = 0; i < bodies.length; i++) {
      for (let j = i + 1; j < bodies.length; j++) {
        const bodyA = bodies[i];
        const bodyB = bodies[j];

        // Calculate distance between centers
        const dx = bodyB.position.x - bodyA.position.x;
        const dy = bodyB.position.y - bodyA.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Check if bodies are overlapping
        const minDistance = bodyA.radius + bodyB.radius;
        if (distance < minDistance) {
          const overlap = minDistance - distance;
          collisions.push({ a: bodyA, b: bodyB, distance, overlap });
        }
      }
    }

    return collisions;
  }

  resolveCollisions(): void {
    const collisions = this.detectCollisions();
    
    for (const collision of collisions) {
      const { a, b, distance, overlap } = collision;
      
      // Skip if either body is static
      if (a.static && b.static) continue;
      
      // Calculate collision normal
      const nx = (b.position.x - a.position.x) / distance;
      const ny = (b.position.y - a.position.y) / distance;
      
      // Calculate relative velocity
      const rvx = b.velocity.x - a.velocity.x;
      const rvy = b.velocity.y - a.velocity.y;
      
      // Calculate relative velocity along normal
      const velAlongNormal = rvx * nx + rvy * ny;
      
      // Do not resolve if objects are moving away from each other
      if (velAlongNormal > 0) continue;
      
      // Calculate restitution (bounciness)
      const restitution = Math.min(a.restitution, b.restitution);
      
      // Calculate impulse scalar
      let j = -(1 + restitution) * velAlongNormal;
      j /= a.inverseMass + b.inverseMass;
      
      // Apply impulse
      const impulseX = j * nx;
      const impulseY = j * ny;
      
      if (!a.static) {
        a.applyImpulse(-impulseX, -impulseY);
      }
      
      if (!b.static) {
        b.applyImpulse(impulseX, impulseY);
      }
      
      // Positional correction to prevent sinking
      const percent = 0.2; // Penetration percentage to correct
      const correction = (overlap / (a.inverseMass + b.inverseMass)) * percent;
      
      if (!a.static) {
        a.position.x -= correction * nx * a.inverseMass;
        a.position.y -= correction * ny * a.inverseMass;
      }
      
      if (!b.static) {
        b.position.x += correction * nx * b.inverseMass;
        b.position.y += correction * ny * b.inverseMass;
      }
    }
  }

  constrainToWorld(body: RigidBody): void {
    // Constrain to world boundaries with bounce
    if (body.position.x - body.radius < 0) {
      body.position.x = body.radius;
      body.velocity.x = -body.velocity.x * body.restitution;
    } else if (body.position.x + body.radius > this.worldWidth) {
      body.position.x = this.worldWidth - body.radius;
      body.velocity.x = -body.velocity.x * body.restitution;
    }
    
    if (body.position.y - body.radius < 0) {
      body.position.y = body.radius;
      body.velocity.y = -body.velocity.y * body.restitution;
    } else if (body.position.y + body.radius > this.worldHeight) {
      body.position.y = this.worldHeight - body.radius;
      body.velocity.y = -body.velocity.y * body.restitution;
    }
  }
} 