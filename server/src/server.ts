import app from './app';
import { config } from './config';

const start = async () => {
  try {
    app.listen(config.port, () => {
      console.log(`[LECSTU] Server running on http://localhost:${config.port}`);
      console.log(`[LECSTU] Environment: ${config.nodeEnv}`);
    });
  } catch (error) {
    console.error('[LECSTU] Failed to start server:', error);
    process.exit(1);
  }
};

start();
