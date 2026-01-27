/**
 * Tests for MCP image content block response formatting
 */

import { describe, it, expect } from "vitest";

/**
 * This tests the server response transformation logic for image content blocks.
 * The actual logic in server.ts:
 *
 * if (result && typeof result === "object" && "base64" in result && "mimeType" in result) {
 *   const { base64, mimeType, ...metadata } = result;
 *   return {
 *     content: [
 *       { type: "image", data: base64, mimeType },
 *       { type: "text", text: JSON.stringify(metadata, null, 2) },
 *     ],
 *   };
 * }
 */

// Replicate the server logic for testing
function formatToolResponse(result: unknown) {
  if (result && typeof result === "object" && "base64" in result && "mimeType" in result) {
    const { base64, mimeType, ...metadata } = result as { base64: string; mimeType: string; [key: string]: unknown };
    return {
      content: [
        { type: "image", data: base64, mimeType },
        { type: "text", text: JSON.stringify(metadata, null, 2) },
      ],
    };
  }

  return {
    content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
  };
}

describe("Image Content Block Response Formatting", () => {
  it("should return image content blocks for results with base64 and mimeType", () => {
    const mockBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
    const screenshotResult = {
      mode: "inline",
      base64: mockBase64,
      mimeType: "image/png",
      sizeBytes: 68,
      device: { width: 1080, height: 2400 },
      image: { width: 450, height: 1000 },
      scaleFactor: 2.4,
      deviceId: "emulator-5554",
    };

    const response = formatToolResponse(screenshotResult);

    // Should have 2 content blocks: image + metadata
    expect(response.content).toHaveLength(2);

    // First block should be the image
    const imageBlock = response.content[0];
    expect(imageBlock.type).toBe("image");
    expect((imageBlock as { data: string }).data).toBe(mockBase64);
    expect((imageBlock as { mimeType: string }).mimeType).toBe("image/png");

    // Second block should be metadata (without base64/mimeType)
    const textBlock = response.content[1];
    expect(textBlock.type).toBe("text");
    const metadata = JSON.parse((textBlock as { text: string }).text);
    expect(metadata.base64).toBeUndefined();
    expect(metadata.mimeType).toBeUndefined();
    expect(metadata.mode).toBe("inline");
    expect(metadata.sizeBytes).toBe(68);
    expect(metadata.scaleFactor).toBe(2.4);
    expect(metadata.deviceId).toBe("emulator-5554");
  });

  it("should return text-only for results without base64", () => {
    const result = { message: "success", count: 5 };
    const response = formatToolResponse(result);

    expect(response.content).toHaveLength(1);
    expect(response.content[0].type).toBe("text");
  });

  it("should return text-only for results without mimeType", () => {
    const result = { base64: "abc123", data: "something" };
    const response = formatToolResponse(result);

    expect(response.content).toHaveLength(1);
    expect(response.content[0].type).toBe("text");
  });

  it("should return text-only for null result", () => {
    const response = formatToolResponse(null);

    expect(response.content).toHaveLength(1);
    expect(response.content[0].type).toBe("text");
  });

  it("should return text-only for primitive result", () => {
    const response = formatToolResponse("hello");

    expect(response.content).toHaveLength(1);
    expect(response.content[0].type).toBe("text");
  });

  it("should handle JPEG screenshots", () => {
    const result = {
      base64: "/9j/4AAQSkZJRg==",
      mimeType: "image/jpeg",
      sizeBytes: 15540,
    };

    const response = formatToolResponse(result);

    expect(response.content).toHaveLength(2);
    expect(response.content[0].type).toBe("image");
    expect((response.content[0] as { mimeType: string }).mimeType).toBe("image/jpeg");
  });
});
