import GameInstance from './models/game-instance';

const games = new Map<string, GameInstance>();
const GAME_CAPACITY = 10;

function generateGameId(): string {
  return Math.random().toString(36).substring(2, 6).toUpperCase();
}

function findOrCreateGame(): string {
  for (const [id, game] of games) {
    if (game.players.size < GAME_CAPACITY) {
      return id;
    }
  }
  
  const newId = generateGameId();
  games.set(newId, new GameInstance());
  return newId;
}

export {
  games,
  GAME_CAPACITY,
  generateGameId,
  findOrCreateGame
}; 