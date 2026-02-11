#!/usr/bin/env node
import { runServer } from "./server.js";
import { logger } from "./utils/logger.js";

runServer().catch((error) => {
  logger.error("Server error", { error: String(error) });
  process.exit(1);
});
