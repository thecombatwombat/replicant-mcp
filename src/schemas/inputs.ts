import { z } from "zod";

export type NumberOpts = { min?: number; max?: number };

// Accepts native numbers or numeric strings. Rejects null, booleans, arrays,
// objects, and other primitives that z.coerce.number() would silently coerce
// to 0/1/NaN. Use options for bounds since the preprocess wrapper loses
// .min()/.max() chainability.
export const numberInput = (opts: NumberOpts = {}) => {
  let base = z.coerce.number().finite();
  if (opts.min !== undefined) base = base.min(opts.min);
  if (opts.max !== undefined) base = base.max(opts.max);
  return z.preprocess((v, ctx) => {
    if (typeof v === "number" || typeof v === "string") return v;
    ctx.addIssue({
      code: "custom",
      message: `Expected number or numeric string, got ${v === null ? "null" : Array.isArray(v) ? "array" : typeof v}`,
    });
    return z.NEVER;
  }, base);
};

// z.coerce.boolean() treats "false" as truthy — manual preprocess avoids the footgun.
export const booleanInput = () =>
  z.preprocess((v) => {
    if (typeof v === "boolean") return v;
    if (v === "true") return true;
    if (v === "false") return false;
    return v;
  }, z.boolean());

// Accepts either a plain object or a JSON-string encoding. Inner object is
// strict so nested unknown fields are rejected (matches toolSchema).
export const jsonObjectInput = <T extends z.ZodRawShape>(shape: T) =>
  z.preprocess((v) => {
    if (typeof v !== "string") return v;
    try {
      return JSON.parse(v);
    } catch {
      return v;
    }
  }, z.object(shape).strict());

export const toolSchema = <T extends z.ZodRawShape>(shape: T) =>
  z.object(shape).strict();
