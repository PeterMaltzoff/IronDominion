const fastify = require('fastify')();
const path = require('path');
const { Server } = require('socket.io');
const fastifyStatic = require('@fastify/static');

// Serve static files from Webpack's output directory
fastify.register(fastifyStatic, {
  root: path.join(__dirname, '../client/dist'),
  prefix: '/'
});

// Game state
const games = new Map();
const GAME_CAPACITY = 10;
const TICK_RATE = 60;
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

// Routes
fastify.get('/', async (request, reply) => {
  return reply.sendFile('index.html');
});

// Endpoint for Play button to find/create game
fastify.get('/play', async (request, reply) => {
  const gameId = findOrCreateGame();
  console.log(`Play button clicked - directing to game: ${gameId}`);
  return reply.redirect(`/game/${gameId}`);
});

// Join specific game
fastify.get('/game/:id', async (request, reply) => {
  const gameId = request.params.id;
  console.log(`Join game requested for ID: ${gameId}`);
  
  if (!games.has(gameId)) {
    console.log(`Game ${gameId} not found`);
    return reply.status(404).send({ error: 'Game not found' });
  }
  
  return reply.sendFile('game.html');
});

// Start server
const start = async () => {
  try {
    await fastify.listen({ port: 3000, host: '0.0.0.0' });
    console.log('Server running at http://localhost:3000');

    const io = new Server(fastify.server, {
      path: '/game-socket/'
    });

    const gameNamespace = io.of('/game');
    
    gameNamespace.on('connection', (socket) => {
      let gameId = null;
      console.log(`Socket connected: ${socket.id}`);

      socket.on('joinGame', (requestedId) => {
        gameId = requestedId || findOrCreateGame();
        
        if (!games.has(gameId)) {
          games.set(gameId, new GameInstance());
        }

        const game = games.get(gameId);
        const player = game.addPlayer(socket.id);
        socket.join(gameId);
        
        // Send initial game state
        socket.emit('gameJoined', { 
          gameId,
          player: {
            x: player.x,
            y: player.y,
            rotation: player.rotation
          }
        });

        // Send existing players to the new player
        for (const [playerId, existingPlayer] of game.players) {
          if (playerId !== socket.id) {
            socket.emit('playerJoined', {
              id: playerId,
              x: existingPlayer.x,
              y: existingPlayer.y,
              rotation: existingPlayer.rotation
            });
          }
        }

        // Broadcast new player to others
        socket.to(gameId).emit('playerJoined', {
          id: socket.id,
          x: player.x,
          y: player.y,
          rotation: player.rotation
        });
      });

      socket.on('playerInput', (data) => {
        if (gameId && games.has(gameId)) {
          const game = games.get(gameId);
          const player = game.players.get(socket.id);
          if (player) {
            player.inputs = data.inputs;
            player.rotation = data.rotation;
          }
        }
      });

      socket.on('disconnect', () => {
        if (gameId && games.has(gameId)) {
          const game = games.get(gameId);
          game.removePlayer(socket.id);
          
          if (game.players.size === 0) {
            games.delete(gameId);
          } else {
            socket.to(gameId).emit('playerLeft', { id: socket.id });
          }
        }
      });
    });

    // Game loop for each game instance
    setInterval(() => {
      for (const [gameId, game] of games) {
        game.update();
        gameNamespace.to(gameId).emit('gameState', game.getState());
      }
    }, 1000 / TICK_RATE);

  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

start(); 