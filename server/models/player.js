const PLAYER_SPEED = 5;

class Player {
  constructor(id, x, y) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.rotation = 0;
    this.inputs = {
      up: false,
      down: false,
      left: false,
      right: false
    };
  }

  update() {
    // Update position based on inputs
    if (this.inputs.up) this.y -= PLAYER_SPEED;
    if (this.inputs.down) this.y += PLAYER_SPEED;
    if (this.inputs.left) this.x -= PLAYER_SPEED;
    if (this.inputs.right) this.x += PLAYER_SPEED;
  }
}

module.exports = Player; 