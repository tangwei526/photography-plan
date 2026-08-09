import { env } from "cloudflare:workers";

const values = () => env as unknown as { AMAP_WEB_SERVICE_KEY?: string };
const text = (value: unknown, max = 160) => String(value || "").trim().slice(0, max);
const wait = (milliseconds: number) => new Promise(resolve => setTimeout(resolve, milliseconds));
const retryableCodes = new Set(["10014", "10015", "10016", "10019", "10020", "10021", "10022", "10023"]);

async function amap(path: string, params: Record<string, string>) {
  const key = values().AMAP_WEB_SERVICE_KEY;
  if (!key) throw new Error("高德 Web 服务尚未配置");
  const url = new URL(path, "https://restapi.amap.com");
  Object.entries({ ...params, key }).forEach(([name, value]) => url.searchParams.set(name, value));
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetch(url, { headers: { accept: "application/json" } });
    const data = await response.json() as Record<string, any>;
    if (response.ok && String(data.status) === "1") return data;
    const code = String(data.infocode || "");
    if (retryableCodes.has(code) && attempt < 2) { await wait(1200 * (attempt + 1)); continue; }
    if (retryableCodes.has(code)) throw new Error("高德接口请求过于频繁，请稍后重试");
    throw new Error(text(data.info, 100) || "高德地图请求失败");
  }
  throw new Error("高德地图请求失败");
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as Record<string, any>;
  const action = text(body.action, 20);
  try {
    if (action === "locate") {
      const source = Array.isArray(body.items) ? body.items.slice(0, 20) : [];
      const items: Array<Record<string, unknown>> = [];
      for (let index = 0; index < source.length; index++) {
        const item = source[index] as Record<string, unknown>;
        const key = text(item.key, 260); const district = text(item.district, 60); const location = text(item.location, 160);
        if (!key || !location) { items.push({ key }); continue; }
        const data = await amap("/v3/geocode/geo", { address: `重庆市${district}${location}`, city: "重庆", output: "JSON" });
        const point = data.geocodes?.[0]; const [longitude, latitude] = String(point?.location || "").split(",").map(Number);
        items.push(Number.isFinite(longitude) && Number.isFinite(latitude) ? { key, longitude, latitude, formattedAddress: point.formatted_address || "" } : { key });
        if (index < source.length - 1) await wait(1100);
      }
      return Response.json({ items });
    }
    if (action === "convert") {
      const source = Array.isArray(body.items) ? body.items.slice(0, 40) : [];
      const valid = source.filter((item: Record<string, unknown>) => Number.isFinite(Number(item.longitude)) && Number.isFinite(Number(item.latitude)));
      if (!valid.length) return Response.json({ items: [] });
      const data = await amap("/v3/assistant/coordinate/convert", { locations: valid.map((item: Record<string, unknown>) => `${Number(item.longitude).toFixed(6)},${Number(item.latitude).toFixed(6)}`).join("|"), coordsys: "gps", output: "JSON" });
      const locations = String(data.locations || "").split(";");
      return Response.json({ items: valid.map((item: Record<string, unknown>, index: number) => { const [longitude, latitude] = String(locations[index] || "").split(",").map(Number); return { key: text(item.key, 260), longitude, latitude }; }) });
    }
    if (action === "reverse") {
      const longitude = Number(body.longitude); const latitude = Number(body.latitude);
      if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return Response.json({ error: "无效地图坐标" }, { status: 400 });
      const data = await amap("/v3/geocode/regeo", { location: `${longitude.toFixed(6)},${latitude.toFixed(6)}`, radius: "1000", extensions: "base", output: "JSON" });
      const component = data.regeocode?.addressComponent || {};
      return Response.json({ district: text(component.district, 60), city: text(component.city || component.province, 60), formattedAddress: text(data.regeocode?.formatted_address, 200) });
    }
    if (action === "search") {
      const query = text(body.query, 120); const district = text(body.district, 60);
      if (!query) return Response.json({ error: "请输入要搜索的地点" }, { status: 400 });
      const data = await amap("/v5/place/text", { keywords: query, region: district ? `重庆市${district}` : "重庆市", city_limit: "false", page_size: "8", output: "JSON" });
      const items = (Array.isArray(data.pois) ? data.pois : []).map((poi: Record<string, unknown>) => { const [longitude, latitude] = text(poi.location, 80).split(",").map(Number); return { name: text(poi.name, 120), address: text(poi.address, 180), district: text(poi.adname || district, 60), longitude, latitude }; }).filter((item: { longitude:number; latitude:number }) => Number.isFinite(item.longitude) && Number.isFinite(item.latitude));
      return Response.json({ items });
    }
    if (action === "route") {
      const locations = Array.isArray(body.locations) ? body.locations.slice(0, 8).filter((point: unknown) => Array.isArray(point) && point.length === 2 && point.every(value => Number.isFinite(Number(value)))) : [];
      if (locations.length < 2) return Response.json({ error: "请至少选择两个点位" }, { status: 400 });
      const format = (point: unknown[]) => `${Number(point[0]).toFixed(6)},${Number(point[1]).toFixed(6)}`;
      const params: Record<string, string> = { origin: format(locations[0]), destination: format(locations[locations.length - 1]), extensions: "base", strategy: "10", output: "JSON" };
      if (locations.length > 2) params.waypoints = locations.slice(1, -1).map(format).join(";");
      const data = await amap("/v3/direction/driving", params); const path = data.route?.paths?.[0];
      const geometry = (path?.steps || []).flatMap((step: Record<string, unknown>) => text(step.polyline, 20000).split(";").map(pair => { const [longitude, latitude] = pair.split(",").map(Number); return [latitude, longitude]; })).filter((point: number[]) => point.every(Number.isFinite));
      return Response.json({ route: { distance: Number(path?.distance || 0), duration: Number(path?.duration || 0), geometry } });
    }
    return Response.json({ error: "无效操作" }, { status: 400 });
  } catch (reason) {
    return Response.json({ error: reason instanceof Error ? reason.message : "高德地图请求失败" }, { status: 502 });
  }
}
