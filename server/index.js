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
  for (const [id, game] of games) {
    if (game.players.size < GAME_CAPACITY) {
      return id;
    }
  }
  const newId = generateGameId();
  games.set(newId, { players: new Set() });
  return newId;
}

// Routes
fastify.get('/game/:id', async (request, reply) => {
  return reply.sendFile('index.html');
});

// Start server
const start = async () => {
  try {
    await fastify.listen({ port: 3000, host: '0.0.0.0' });
    console.log('Server running at http://localhost:3000');

    // Setup Socket.IO
    const io = new Server(fastify.server);

    io.on('connection', (socket) => {
      let gameId = null;

      socket.on('joinGame', (requestedId) => {
        gameId = requestedId || findOrCreateGame();
        
        if (!games.has(gameId)) {
          games.set(gameId, { players: new Set() });
        }

        const game = games.get(gameId);
        game.players.add(socket.id);
        socket.join(gameId);
        
        socket.emit('gameJoined', { gameId });
      });

      socket.on('playerUpdate', (data) => {
        if (gameId) {
          socket.to(gameId).emit('playerUpdated', { ...data, id: socket.id });
        }
      });

      socket.on('disconnect', () => {
        if (gameId && games.has(gameId)) {
          const game = games.get(gameId);
          game.players.delete(socket.id);
          
          if (game.players.size === 0) {
            games.delete(gameId);
          }
          
          socket.to(gameId).emit('playerLeft', { id: socket.id });
        }
      });
    });

  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

start(); 