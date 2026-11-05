import { createApp, listen, StartupError } from './app.ts';
import { loadConfig } from './config.ts';
import { SecretsError } from './secrets.ts';
import { VERSION } from '@posteulen/shared/version.ts';

async function main(): Promise<void> {
  const config = loadConfig();
  const app = await createApp(config);
  let closing = false;
  const shutdown = (): void => {
    if (closing) return;
    closing = true;
    void app.close().finally(() => process.exit(0));
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
  await listen(app);
  app.userApi.log.info({ version: VERSION }, 'PostEulen gestartet');
}

main().catch((error: unknown) => {
  if (error instanceof StartupError || error instanceof SecretsError) {
    console.error(`PostEulen kann nicht starten: ${error.message}`);
  } else {
    console.error('PostEulen kann nicht starten:', error instanceof Error ? error.message : error);
  }
  process.exit(1);
});
