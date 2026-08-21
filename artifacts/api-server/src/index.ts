import app from "./app";
import { logger } from "./lib/logger";
import { seed } from "./seed";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const start = async () => {
  try {
    await seed();
    app.listen(port, () => logger.info({ port }, "Server listening"));
  } catch (err) {
    logger.error({ err }, "Unable to initialize the server");
    process.exit(1);
  }
};

void start();
