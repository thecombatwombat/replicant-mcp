#!/usr/bin/env node
import { runServer } from "./server.js";

runServer().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
