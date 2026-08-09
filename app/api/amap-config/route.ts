import { env } from "cloudflare:workers";

export async function GET() {
  const key = (env as unknown as { AMAP_JS_KEY?: string }).AMAP_JS_KEY;
  if (!key) return Response.json({ error: "高德地图尚未配置" }, { status: 503 });
  return Response.json({ key }, { headers: { "cache-control": "private, max-age=300" } });
}
