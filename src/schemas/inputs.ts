import { z } from "zod";

export const numberInput = () => z.coerce.number().finite();

export const booleanInput = () =>
  z.preprocess((v) => {
    if (typeof v === "boolean") return v;
    if (v === "true") return true;
    if (v === "false") return false;
    return v;
  }, z.boolean());

export const jsonObjectInput = <T extends z.ZodRawShape>(shape: T) =>
  z.preprocess((v) => {
    if (typeof v !== "string") return v;
    try {
      return JSON.parse(v);
    } catch {
      return v;
    }
  }, z.object(shape));

export const toolSchema = <T extends z.ZodRawShape>(shape: T) =>
  z.object(shape).strict();
