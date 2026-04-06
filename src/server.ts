import { config } from './config';
import app from './app';
import { prisma } from './lib/prisma';

async function main() {
  // Verify database connection before accepting traffic
  await prisma.$connect();
  console.log('✓ Database connection established');

  const server = app.listen(config.port, () => {
    console.log(`✓ Server running on http://localhost:${config.port}`);
    console.log(`✓ API docs available at http://localhost:${config.port}/api/v1/docs`);
    console.log(`  Environment: ${config.nodeEnv}`);
  });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`\n${signal} received — shutting down gracefully`);
    server.close(async () => {
      await prisma.$disconnect();
      console.log('Database connection closed');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
