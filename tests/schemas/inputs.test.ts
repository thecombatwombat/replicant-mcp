import { describe, it, expect } from "vitest";
import { z } from "zod";
import {
  numberInput,
  booleanInput,
  jsonObjectInput,
  toolSchema,
} from "../../src/schemas/inputs.js";
import { toMcpJsonSchema } from "../../src/schemas/derive.js";

describe("numberInput", () => {
  const s = numberInput();

  it("accepts native numbers", () => {
    expect(s.parse(178)).toBe(178);
    expect(s.parse(0)).toBe(0);
    expect(s.parse(-3.14)).toBe(-3.14);
  });

  it("coerces numeric strings", () => {
    expect(s.parse("178")).toBe(178);
    expect(s.parse("0")).toBe(0);
    expect(s.parse("-3.14")).toBe(-3.14);
  });

  it("rejects non-numeric strings (not silently NaN)", () => {
    expect(() => s.parse("abc")).toThrow();
  });

  // Note: empty string coerces to 0 via Number("") — JS default, tolerated here.

  it("rejects Infinity and NaN", () => {
    expect(() => s.parse(Infinity)).toThrow();
    expect(() => s.parse(NaN)).toThrow();
  });

  it("applies {min, max} bounds passed as options", () => {
    const bounded = numberInput({ min: 1, max: 100 }).optional();
    expect(bounded.parse("50")).toBe(50);
    expect(bounded.parse(undefined)).toBe(undefined);
    expect(() => bounded.parse("0")).toThrow();
    expect(() => bounded.parse("101")).toThrow();
  });

  it("rejects null, booleans, arrays, objects (Codex P1 guard)", () => {
    // z.coerce.number() would silently coerce null→0, true→1, []→0.
    // numberInput() must reject these so e.g. elementIndex: null can't tap element 0.
    expect(() => s.parse(null)).toThrow();
    expect(() => s.parse(true)).toThrow();
    expect(() => s.parse(false)).toThrow();
    expect(() => s.parse([])).toThrow();
    expect(() => s.parse([1])).toThrow();
    expect(() => s.parse({})).toThrow();
  });
});

describe("booleanInput", () => {
  const s = booleanInput();

  it("accepts native booleans", () => {
    expect(s.parse(true)).toBe(true);
    expect(s.parse(false)).toBe(false);
  });

  it("coerces 'true' / 'false' strings", () => {
    expect(s.parse("true")).toBe(true);
    expect(s.parse("false")).toBe(false);
  });

  it("does NOT treat 'false' as truthy (the z.coerce.boolean() footgun)", () => {
    // z.coerce.boolean() would return true here — we must return false.
    expect(s.parse("false")).toBe(false);
  });

  it("rejects other strings and non-boolean primitives", () => {
    expect(() => s.parse("yes")).toThrow();
    expect(() => s.parse("1")).toThrow();
    expect(() => s.parse(1)).toThrow();
    expect(() => s.parse(null)).toThrow();
  });
});

describe("jsonObjectInput", () => {
  const s = jsonObjectInput({
    textContains: z.string().optional(),
    resourceId: z.string().optional(),
  });

  it("accepts a plain object", () => {
    expect(s.parse({ textContains: "foo" })).toEqual({ textContains: "foo" });
  });

  it("parses a JSON-string encoding of the same object", () => {
    expect(s.parse('{"textContains":"foo"}')).toEqual({ textContains: "foo" });
  });

  it("rejects malformed JSON (falls through to 'expected object' error)", () => {
    expect(() => s.parse("{not json")).toThrow(/expected object/);
  });

  it("rejects JSON that parses but fails inner validation", () => {
    expect(() => s.parse('{"textContains":123}')).toThrow();
  });

  it("rejects unknown nested fields (Greptile P2 guard — inner object is strict)", () => {
    // Typos in nested field names should error, not silently drop.
    expect(() => s.parse({ textContian: "foo" })).toThrow();
    expect(() => s.parse('{"textContian":"foo"}')).toThrow();
  });
});

describe("toolSchema", () => {
  const s = toolSchema({
    operation: z.enum(["tap", "scroll"]),
    x: numberInput().optional(),
  });

  it("rejects unknown fields (fixes silent-accept bug)", () => {
    expect(() => s.parse({ operation: "tap", unknownField: "bar" })).toThrow();
  });

  it("still accepts known fields with coercion", () => {
    expect(s.parse({ operation: "tap", x: "178" })).toEqual({
      operation: "tap",
      x: 178,
    });
  });
});

describe("toMcpJsonSchema", () => {
  const s = toolSchema({
    operation: z.enum(["tap", "scroll"]).describe("action to perform"),
    x: numberInput().optional().describe("x coord in device space"),
    deviceSpace: booleanInput().optional(),
  });

  const json = toMcpJsonSchema(s);

  it("emits MCP-compatible object schema", () => {
    expect(json.type).toBe("object");
  });

  it("advertises coerced fields with their canonical JSON type", () => {
    const props = json.properties as Record<string, { type: string }>;
    expect(props.x.type).toBe("number");
    expect(props.deviceSpace.type).toBe("boolean");
    expect(props.operation.type).toBe("string");
  });

  it("carries .describe() text through to the JSON schema", () => {
    const props = json.properties as Record<
      string,
      { description?: string }
    >;
    expect(props.operation.description).toBe("action to perform");
    expect(props.x.description).toBe("x coord in device space");
  });

  it("strips $schema and additionalProperties for wire-payload compactness (strict is still enforced at parse time)", () => {
    const raw = json as Record<string, unknown>;
    expect(raw.$schema).toBe(undefined);
    expect(raw.additionalProperties).toBe(undefined);
  });

  it("lists required fields", () => {
    expect(json.required).toEqual(["operation"]);
  });
});
