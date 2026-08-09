import { env } from "cloudflare:workers";

async function forward(request: Request) {
  const securityCode = (env as unknown as { AMAP_SECURITY_JS_CODE?: string }).AMAP_SECURITY_JS_CODE;
  if (!securityCode) return Response.json({ error: "高德地图安全代理尚未配置" }, { status: 503 });
  const incoming = new URL(request.url);
  const marker = "/api/amap/_AMapService/";
  const index = incoming.pathname.indexOf(marker);
  if (index < 0) return new Response("Not found", { status: 404 });
  const path = incoming.pathname.slice(index + marker.length);
  if (!/^[a-zA-Z0-9_./-]+$/.test(path) || path.includes("..")) return new Response("Invalid path", { status: 400 });
  const base = path.startsWith("v4/map/styles") ? "https://webapi.amap.com/" : "https://restapi.amap.com/";
  const target = new URL(path, base);
  incoming.searchParams.forEach((value, key) => target.searchParams.append(key, value));
  target.searchParams.set("jscode", securityCode);
  const response = await fetch(target, {
    method: request.method,
    headers: { "accept": request.headers.get("accept") || "application/json", "content-type": request.headers.get("content-type") || "application/json" },
    body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
  });
  const headers = new Headers();
  headers.set("content-type", response.headers.get("content-type") || "application/json; charset=utf-8");
  headers.set("cache-control", response.headers.get("cache-control") || "private, max-age=60");
  return new Response(response.body, { status: response.status, headers });
}

export const GET = forward;
export const POST = forward;
