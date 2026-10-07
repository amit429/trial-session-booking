import { vi } from "vitest";

type Handler = (body: any, url: URL) => unknown | Promise<unknown>;

/** Route-based fetch mock: keys are "METHOD /path" (path without /api). */
export function mockApi(routes: Record<string, Handler>) {
  const calls: string[] = [];
  vi.stubGlobal("fetch", vi.fn(async (input: string, init?: RequestInit) => {
    const url = new URL(input, "http://localhost");
    const key = `${init?.method ?? "GET"} ${url.pathname.replace(/^\/api/, "")}`;
    calls.push(key);
    const h = routes[key];
    if (!h) return new Response(JSON.stringify({ error: { code: "NOT_FOUND", message: "nope" } }), { status: 404 });
    const out = (await h(init?.body ? JSON.parse(String(init.body)) : undefined, url)) as any;
    const res = out && typeof out === "object" && "status" in out && "body" in out ? out : { status: 200, body: out };
    return new Response(res.status === 204 ? null : JSON.stringify(res.body), { status: res.status, headers: { "Content-Type": "application/json" } });
  }));
  return calls;
}
