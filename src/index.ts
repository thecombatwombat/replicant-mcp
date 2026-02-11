#!/usr/bin/env node

if (process.argv.length > 2) {
  // CLI mode: has arguments (e.g., --version, doctor, adb, etc.)
  import("./cli.js").catch((error) => {
    console.error("Failed to load CLI:", error);
    process.exit(1);
  });
} else {
  // MCP server mode: no arguments, start the server
  Promise.all([import("./server.js"), import("./utils/logger.js")])
    .then(([{ runServer }, { logger }]) => {
      runServer().catch((error) => {
        logger.error("Server error", { error: String(error) });
        process.exit(1);
      });
    })
    .catch((error) => {
      console.error("Failed to start server:", error);
      process.exit(1);
    });
}
