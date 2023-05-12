import { ZodNumber, ZodTypeAny } from "zod";

export function isZodNumber(type: ZodTypeAny): type is ZodNumber {
  return type._def.type === "ZodNumber";
}
