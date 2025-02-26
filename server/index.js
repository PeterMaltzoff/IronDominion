const fastify = require('fastify')();
const path = require('path');
const { Server } = require('socket.io');
const fastifyStatic = require('@fastify/static');

// Serve static files
fastify.register(fastifyStatic, {
  root: path.join(__dirname, '../client'),
  prefix: '/'
});

// Game state
const games = new Map();
const GAME_CAPACITY = 10; // Max players per game

function generateGameId() {
  return Math.random().toString(36).substring(2, 6).toUpperCase();
}

function findOrCreateGame() {
  // Look for an existing game with space
  for (const [id, game] of games) {
    if (game.players.size < GAME_CAPACITY) {
      console.log(`Found existing game with space: ${id}`);
      return id;
    }
  }
  
  // No games with space found, create new one
  const newId = generateGameId();
  console.log(`Creating new game: ${newId}`);
  games.set(newId, { players: new Set() });
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

    // Setup Socket.IO with path specific to game namespace
    const io = new Server(fastify.server, {
      path: '/game-socket/'
    });

    // Create a namespace for games
    const gameNamespace = io.of('/game');
    
    gameNamespace.on('connection', (socket) => {
      let gameId = null;
      console.log(`Socket connected: ${socket.id}`);

      socket.on('joinGame', (requestedId) => {
        gameId = requestedId || findOrCreateGame();
        console.log(`Player ${socket.id} joining game ${gameId} (${requestedId ? 'requested' : 'auto-assigned'})`);
        
        if (!games.has(gameId)) {
          console.log(`Creating new game with ID: ${gameId}`);
          games.set(gameId, { players: new Set() });
        }

        const game = games.get(gameId);
        game.players.add(socket.id);
        socket.join(gameId);
        
        console.log(`Game ${gameId} now has ${game.players.size} players`);
        socket.emit('gameJoined', { gameId });
      });

      socket.on('playerUpdate', (data) => {
        if (gameId) {
          console.log(`Player ${socket.id} in game ${gameId} updated:`, data);
          socket.to(gameId).emit('playerUpdated', { ...data, id: socket.id });
        } else {
          console.warn(`Received player update from ${socket.id} but not in a game`);
        }
      });

      socket.on('disconnect', () => {
        console.log(`Socket disconnected: ${socket.id}`);
        if (gameId && games.has(gameId)) {
          const game = games.get(gameId);
          game.players.delete(socket.id);
          
          console.log(`Player ${socket.id} left game ${gameId}. ${game.players.size} players remaining`);
          
          if (game.players.size === 0) {
            console.log(`Game ${gameId} is empty, removing it`);
            games.delete(gameId);
          }
          
          socket.to(gameId).emit('playerLeft', { id: socket.id });
        }
      });
    });

    // Add periodic logging of active games
    setInterval(() => {
      console.log('\nActive games status:');
      games.forEach((game, id) => {
        console.log(`Game ${id}: ${game.players.size} players`);
      });
    }, 30000); // Log every 30 seconds

  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

start(); 