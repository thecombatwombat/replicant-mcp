/**
 * Behavioral tests for live marketplace publishing verification.
 *
 * These tests hit LIVE external APIs and require a network connection.
 * They are skipped automatically in CI (when CI=true) and when
 * SKIP_NETWORK_TESTS=true is set.
 *
 * Run locally on demand:
 *   npx vitest run tests/config/marketplace-publishing.test.ts
 *
 * Requirements covered: PUB-01, PUB-03
 *
 * MCP Registry API response shape (v0.1):
 *   { servers: [{ server: { name, version, packages }, _meta: { "io.modelcontextprotocol.registry/official": { status } } }] }
 */

import { describe, it, expect } from "vitest";

const isCI = process.env["CI"] === "true";
const skipNetworkTests = process.env["SKIP_NETWORK_TESTS"] === "true";
const shouldSkip = isCI || skipNetworkTests;

// Registry API response types
interface RegistryPackage {
  registryType: string;
  identifier: string;
  version: string;
  transport: { type: string };
}

interface RegistryServerEntry {
  name: string;
  version: string;
  packages: RegistryPackage[];
}

interface RegistryMeta {
  "io.modelcontextprotocol.registry/official": {
    status: string;
    publishedAt: string;
    isLatest: boolean;
  };
}

interface RegistryServerItem {
  server: RegistryServerEntry;
  _meta: RegistryMeta;
}

interface RegistryResponse {
  servers: RegistryServerItem[];
  metadata: { count: number };
}

// PUB-01: MCP Registry lists replicant-mcp as active with correct metadata
describe.skipIf(shouldSkip)(
  "PUB-01: MCP Registry — replicant-mcp has an active listing",
  () => {
    const REGISTRY_URL =
      "https://registry.modelcontextprotocol.io/v0.1/servers?search=replicant-mcp";
    const EXPECTED_NAME = "io.github.thecombatwombat/replicant-mcp";

    it(
      "registry API returns HTTP 200 for replicant-mcp search",
      async () => {
        const response = await fetch(REGISTRY_URL);
        expect(response.ok).toBe(true);
        expect(response.status).toBe(200);
      },
      10_000
    );

    it(
      "registry response contains a servers array with at least one entry",
      async () => {
        const response = await fetch(REGISTRY_URL);
        const body = (await response.json()) as RegistryResponse;
        expect(Array.isArray(body.servers)).toBe(true);
        expect(body.servers.length).toBeGreaterThan(0);
      },
      10_000
    );

    it(
      "first server entry name matches expected MCP Registry identifier",
      async () => {
        const response = await fetch(REGISTRY_URL);
        const body = (await response.json()) as RegistryResponse;
        // The registry wraps each entry in a `server` object
        expect(body.servers[0].server.name).toBe(EXPECTED_NAME);
      },
      10_000
    );

    it(
      "listing status is active",
      async () => {
        const response = await fetch(REGISTRY_URL);
        const body = (await response.json()) as RegistryResponse;
        // Status lives in _meta under the official registry key
        const officialMeta =
          body.servers[0]._meta["io.modelcontextprotocol.registry/official"];
        expect(officialMeta.status).toBe("active");
      },
      10_000
    );

    it(
      "listing transport type is stdio",
      async () => {
        const response = await fetch(REGISTRY_URL);
        const body = (await response.json()) as RegistryResponse;
        const packages = body.servers[0].server.packages;
        expect(Array.isArray(packages)).toBe(true);
        expect(packages.length).toBeGreaterThan(0);
        expect(packages[0].transport.type).toBe("stdio");
      },
      10_000
    );

    it(
      "listing version is a valid semver string",
      async () => {
        const response = await fetch(REGISTRY_URL);
        const body = (await response.json()) as RegistryResponse;
        const version = body.servers[0].server.version;
        expect(typeof version).toBe("string");
        expect(version).toMatch(/^\d+\.\d+\.\d+/);
      },
      10_000
    );
  }
);

// PUB-03: Glama listing is live and accessible at the expected URL
describe.skipIf(shouldSkip)(
  "PUB-03: Glama — replicant-mcp server page returns HTTP 200",
  () => {
    const GLAMA_URL =
      "https://glama.ai/mcp/servers/thecombatwombat/replicant-mcp";

    it(
      "Glama server page returns HTTP 200",
      async () => {
        const response = await fetch(GLAMA_URL, {
          redirect: "follow",
          headers: {
            // Identify as a standard browser request to avoid bot-blocking
            "User-Agent":
              "Mozilla/5.0 (compatible; replicant-mcp-test/1.0; +https://github.com/thecombatwombat/replicant-mcp)",
          },
        });
        expect(response.ok).toBe(true);
        expect(response.status).toBe(200);
      },
      10_000
    );

    it(
      "Glama server page URL is reachable (not a redirect to 404)",
      async () => {
        const response = await fetch(GLAMA_URL, {
          redirect: "follow",
          headers: {
            "User-Agent":
              "Mozilla/5.0 (compatible; replicant-mcp-test/1.0; +https://github.com/thecombatwombat/replicant-mcp)",
          },
        });
        // Final URL after redirects should not be an error page
        expect(response.status).not.toBe(404);
        expect(response.status).not.toBe(410);
      },
      10_000
    );
  }
);
