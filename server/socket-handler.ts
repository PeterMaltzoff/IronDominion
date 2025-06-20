import { Server, Socket } from 'socket.io';
import { games, findOrCreateGame } from './game-manager';
import GameInstance from './models/game-instance';

interface PlayerInput {
  inputs: {
    up: boolean;
    down: boolean;
    left: boolean;
    right: boolean;
    shoot: boolean;
  };
  rotation: number;
}

function setupSocketHandlers(io: Server) {
  const gameNamespace = io.of('/game');
  
  gameNamespace.on('connection', (socket: Socket) => {
    let gameId: string | null = null;
    console.log(`Socket connected: ${socket.id}`);

    socket.on('joinGame', (requestedId?: string) => {
      gameId = requestedId || findOrCreateGame();
      
      if (!games.has(gameId)) {
        // If the requested game doesn't exist, emit gameNotFound event
        if (requestedId) {
          console.log(`Game ${gameId} not found, sending gameNotFound event`);
          socket.emit('gameNotFound');
          return;
        }
        // Otherwise create a new game
        games.set(gameId, new GameInstance());
      }

      const game = games.get(gameId)!;
      const player = game.addPlayer(socket.id);
      socket.join(gameId);
      
      // Send initial game state
      socket.emit('gameJoined', { 
        gameId,
        player: player.getState(),
        worldBounds: game.getState().worldBounds
      });

      // Send existing players to the new player
      for (const existingPlayer of game.players.values()) {
        if (existingPlayer.id !== socket.id) {
          socket.emit('playerJoined', existingPlayer.getState());
        }
      }

      // Broadcast new player to others
      socket.to(gameId).emit('playerJoined', player.getState());
    });

    socket.on('playerInput', (data: PlayerInput) => {
      if (gameId && games.has(gameId)) {
        const game = games.get(gameId)!;
        const player = game.players.get(socket.id);
        if (player) {
          player.inputs = data.inputs;
          player.rotation = data.rotation;
        }
      }
    });

    socket.on('shoot', () => {
      if (gameId && games.has(gameId)) {
        const game = games.get(gameId)!;
        const projectile = game.handlePlayerShoot(socket.id);
        
        if (projectile) {
          // Notify all players about the new projectile
          gameNamespace.to(gameId).emit('projectileCreated', projectile.getState());
        }
      }
    });

    socket.on('upgrade', (stat: string) => {
      if (gameId && games.has(gameId)) {
        const game = games.get(gameId)!;
        const success = game.upgradePlayer(socket.id, stat);
        
        if (success) {
          // Send updated player state
          const player = game.players.get(socket.id);
          socket.emit('playerUpdated', player!.getState());
        }
      }
    });

    socket.on('disconnect', () => {
      if (gameId && games.has(gameId)) {
        const game = games.get(gameId)!;
        game.removePlayer(socket.id);
        
        if (game.players.size === 0) {
          games.delete(gameId);
        } else {
          socket.to(gameId).emit('playerLeft', { id: socket.id });
        }
      }
    });
  });

  return gameNamespace;
}

export default setupSocketHandlers; 