const Player = require('./player');

class GameInstance {
  constructor() {
    this.players = new Map();
  }

  addPlayer(id) {
    // Start player in middle of game area
    const player = new Player(id, 1000, 1000);
    this.players.set(id, player);
    return player;
  }

  removePlayer(id) {
    this.players.delete(id);
  }

  update() {
    // Update all players
    for (const player of this.players.values()) {
      player.update();
    }
  }

  getState() {
    const state = [];
    for (const [id, player] of this.players) {
      state.push({
        id,
        x: player.x,
        y: player.y,
        rotation: player.rotation
      });
    }
    return state;
  }
}

module.exports = GameInstance; 