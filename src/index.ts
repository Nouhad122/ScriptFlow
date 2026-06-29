import app from './app';
import { env } from './config/env';
import { runMigrations } from './database/migrations';

async function start(): Promise<void> {
  await runMigrations();
  app.listen(env.port, () => {
    console.log(`ScriptFlow backend running on port ${env.port} [${env.nodeEnv}]`);
  });
}

start().catch((error) => {
  console.error('[FATAL] Server failed to start:', error);
  process.exit(1);
});
