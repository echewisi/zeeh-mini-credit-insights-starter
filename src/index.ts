import { createServer } from "./server";

const port = process.env.PORT || 3000;
const app = createServer();

const server = app.listen(port, () => {
  console.log(` API server listening on port ${port}`);
  console.log(` API documentation available at http://localhost:${port}/docs`);
  console.log(` Health check available at http://localhost:${port}/health`);
  console.log(`Metrics available at http://localhost:${port}/metrics`);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
    process.exit(0);
  });
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});
