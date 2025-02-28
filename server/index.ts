import fastify from 'fastify';
import path from 'path';
import { Server } from 'socket.io';
import fastifyStatic from '@fastify/static';
import setupRoutes from './routes';
import setupSocketHandlers from './socket-handler';
import { games } from './game-manager';

// Create fastify instance
const server = fastify();

// Serve static files from Webpack's output directory
server.register(fastifyStatic, {
  root: path.join(__dirname, '../client/dist'),
  prefix: '/'
});

// Game constants
const TICK_RATE = 60;
const TICK_INTERVAL = 1000 / TICK_RATE;

// Setup routes
setupRoutes(server);

// Start server
const start = async () => {
  try {
    const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;
    await server.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`Server running at http://localhost:${PORT}`);

    const io = new Server(server.server, {
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