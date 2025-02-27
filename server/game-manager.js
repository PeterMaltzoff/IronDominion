const GameInstance = require('./models/game-instance');

const games = new Map();
const GAME_CAPACITY = 10;

function generateGameId() {
  return Math.random().toString(36).substring(2, 6).toUpperCase();
}

function findOrCreateGame() {
  for (const [id, game] of games) {
    if (game.players.size < GAME_CAPACITY) {
      return id;
    }
  }
  
  const newId = generateGameId();
  games.set(newId, new GameInstance());
  return newId;
}

module.exports = {
  games,
  GAME_CAPACITY,
  generateGameId,
  findOrCreateGame
}; 