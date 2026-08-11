import { env } from "cloudflare:workers";

type QWeatherEnv = {
  QWEATHER_API_HOST?: string;
  QWEATHER_KEY_ID?: string;
  QWEATHER_PROJECT_ID?: string;
  QWEATHER_PRIVATE_KEY?: string;
  QWEATHER_PRIVATE_KEY_BASE64?: string;
};

let cachedToken: { value: string; refreshAt: number } | null = null;
const encoder = new TextEncoder();

const values = () => env as unknown as QWeatherEnv;
const base64Url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
const encodeJson = (value: unknown) => base64Url(encoder.encode(JSON.stringify(value)));
const decodeBase64 = (value: string) => new TextDecoder().decode(Uint8Array.from(atob(value), character => character.charCodeAt(0)));
const pemBytes = (pem: string) => Uint8Array.from(atob(pem.replace(/-----[^-]+-----|\s/g, "")), character => character.charCodeAt(0));
const clock = (value?: string) => /T(\d{2}:\d{2})/.exec(String(value || ""))?.[1] || "";
const percent = (value: unknown) => Math.round(Math.max(0, Math.min(1, Number(value) || 0)) * 100);

async function jwt() {
  const config = values();
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.refreshAt > now) return cachedToken.value;
  const privatePem = config.QWEATHER_PRIVATE_KEY || (config.QWEATHER_PRIVATE_KEY_BASE64 ? decodeBase64(config.QWEATHER_PRIVATE_KEY_BASE64) : "");
  if (!config.QWEATHER_KEY_ID || !config.QWEATHER_PROJECT_ID || !privatePem) throw new Error("和风天气 JWT 凭据尚未配置完整");
  const issuedAt = now - 30;
  const header = encodeJson({ alg: "EdDSA", kid: config.QWEATHER_KEY_ID });
  const payload = encodeJson({ sub: config.QWEATHER_PROJECT_ID, iat: issuedAt, exp: issuedAt + 900 });
  const signingInput = `${header}.${payload}`;
  const key = await crypto.subtle.importKey("pkcs8", pemBytes(privatePem), { name: "Ed25519" }, false, ["sign"]);
  const signature = new Uint8Array(await crypto.subtle.sign("Ed25519", key, encoder.encode(signingInput)));
  const value = `${signingInput}.${base64Url(signature)}`;
  cachedToken = { value, refreshAt: issuedAt + 720 };
  return value;
}

async function qweather(path: string) {
  const host = String(values().QWEATHER_API_HOST || "").trim().replace(/^https?:\/\//, "").replace(/\/+$/, "");
  if (!/^[a-z0-9.-]+\.qweatherapi\.com$/i.test(host)) throw new Error("和风天气 API Host 尚未配置");
  const response = await fetch(`https://${host}${path}`, { headers: { authorization: `Bearer ${await jwt()}`, accept: "application/json" } });
  const data = await response.json().catch(() => ({})) as Record<string, any>;
  if (!response.ok || data.code && String(data.code) !== "200") throw new Error(`和风天气请求失败${data.code ? `（${data.code}）` : ""}`);
  return data;
}

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams;
  try {
    if (query.get("mode") === "search") {
      const keyword = String(query.get("query") || "").trim().slice(0, 80);
      if (!keyword) return Response.json({ error: "请输入地点名称" }, { status: 400 });
      const data = await qweather(`/geo/v2/city/lookup?location=${encodeURIComponent(keyword)}&range=cn&number=8&lang=zh`);
      const locations = (Array.isArray(data.location) ? data.location : []).map((item: Record<string, unknown>) => ({
        id: String(item.id || ""), name: String(item.name || ""), adm2: String(item.adm2 || ""), adm1: String(item.adm1 || ""),
        country: String(item.country || ""), latitude: Number(item.lat), longitude: Number(item.lon),
      })).filter((item: { latitude: number; longitude: number }) => Number.isFinite(item.latitude) && Number.isFinite(item.longitude));
      return Response.json({ locations }, { headers: { "cache-control": "public, max-age=3600", "access-control-allow-origin": "*" } });
    }

    const latitude = Number(query.get("lat"));
    const longitude = Number(query.get("lon"));
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return Response.json({ error: "无效天气坐标" }, { status: 400 });
    const lat = latitude.toFixed(2); const lon = longitude.toFixed(2);
    const [currentData, dailyData] = await Promise.all([
      qweather(`/weather/v1/current/${lat}/${lon}?localTime=true&lang=zh`),
      qweather(`/weather/v1/daily/${lat}/${lon}?days=7&localTime=true&lang=zh`),
    ]);
    const current = currentData.condition ? {
      text: String(currentData.condition.text || ""), code: String(currentData.condition.code || ""),
      temperature: Math.round(Number(currentData.temperature?.value || 0)), feelsLike: Math.round(Number(currentData.feelsLike?.value || 0)),
      humidity: percent(currentData.humidity), cloud: percent(currentData.cloudCover),
      windScale: Number(currentData.wind?.scale || 0), windSpeed: Number(currentData.wind?.speed?.value || 0),
      visibility: Math.round(Number(currentData.visibility?.value || 0) / 1000), pressure: Math.round(Number(currentData.pressure?.value || 0)),
    } : null;
    const days = (Array.isArray(dailyData.days) ? dailyData.days : []).map((day: Record<string, any>) => ({
      date: String(day.forecastStartTime || "").slice(0, 10), sunrise: clock(day.astro?.sunrise), sunset: clock(day.astro?.sunset),
      text: String(day.daytime?.condition?.text || ""), code: String(day.daytime?.condition?.code || ""),
      tempMax: Math.round(Number(day.temperatureMax?.value || 0)), tempMin: Math.round(Number(day.temperatureMin?.value || 0)),
      cloud: percent(day.daytime?.cloudCover), precipitation: percent(day.daytime?.precipitation?.probability), humidity: percent(day.daytime?.humidity),
    }));
    return Response.json({ current, days, attribution: "和风天气", updatedAt: new Date().toISOString() }, { headers: { "cache-control": "public, max-age=300, stale-while-revalidate=600", "access-control-allow-origin": "*" } });
  } catch (reason) {
    return Response.json({ error: reason instanceof Error ? reason.message : "天气服务暂不可用" }, { status: 502, headers: { "access-control-allow-origin": "*" } });
  }
}
