const fastify = require('fastify')();
const path = require('path');
const { Server } = require('socket.io');
const fastifyStatic = require('@fastify/static');
const setupRoutes = require('./routes');
const setupSocketHandlers = require('./socket-handler');
const { games } = require('./game-manager');
const GameInstance = require('./models/game-instance');

// Serve static files from Webpack's output directory
fastify.register(fastifyStatic, {
  root: path.join(__dirname, '../client/dist'),
  prefix: '/'
});

// Game constants
const TICK_RATE = 60;
const TICK_INTERVAL = 1000 / TICK_RATE;

// Setup routes
setupRoutes(fastify);

// Start server
const start = async () => {
  try {
    const PORT = process.env.PORT || 3000;
    await fastify.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`Server running at http://localhost:${PORT}`);

    const io = new Server(fastify.server, {
      path: '/game-socket/'
    });

    const gameNamespace = setupSocketHandlers(io);

    // Game loop for each game instance
    setInterval(() => {
      for (const [gameId, game] of games) {
        game.update();
        gameNamespace.to(gameId).emit('gameState', game.getState());
      }
    }, TICK_INTERVAL);

  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

start(); 