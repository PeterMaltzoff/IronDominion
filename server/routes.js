const { findOrCreateGame, games } = require('./game-manager');

function setupRoutes(fastify) {
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
      console.log(`Game ${gameId} not found, redirecting to home`);
      return reply.redirect('/');
    }
    
    return reply.sendFile('game.html');
  });
}

module.exports = setupRoutes; 