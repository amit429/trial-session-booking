import { vi } from "vitest";

type Handler = (body: unknown, url: URL) => unknown;
type Reply = { status: number; body: unknown };
const isReply = (v: unknown): v is Reply => !!v && typeof v === "object" && "status" in v && "body" in v;

/** Route-based fetch mock: keys are "METHOD /path" (path without /api). */
export function mockApi(routes: Record<string, Handler>) {
  const calls: string[] = [];
  vi.stubGlobal("fetch", vi.fn(async (input: string, init?: RequestInit) => {
    const url = new URL(input, "http://localhost");
    const key = `${init?.method ?? "GET"} ${url.pathname.replace(/^\/api/, "")}`;
    calls.push(key);
    const h = routes[key];
    if (!h) return new Response(JSON.stringify({ error: { code: "NOT_FOUND", message: "nope" } }), { status: 404 });
    const out = await h(init?.body ? JSON.parse(String(init.body)) : undefined, url);
    const res: Reply = isReply(out) ? out : { status: 200, body: out };
    return new Response(res.status === 204 ? null : JSON.stringify(res.body), { status: res.status, headers: { "Content-Type": "application/json" } });
  }));
  return calls;
}
