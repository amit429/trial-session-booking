import type { ZodTypeAny, z } from "zod";
import { zodToAppError } from "@/http/errors";

export function parse<S extends ZodTypeAny>(schema: S, data: unknown): z.infer<S> {
  const r = schema.safeParse(data);
  if (!r.success) throw zodToAppError(r.error);
  return r.data;
}
