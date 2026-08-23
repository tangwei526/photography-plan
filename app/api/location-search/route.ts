type OpenMeteoLocation = {
  id?: number;
  name?: string;
  latitude?: number;
  longitude?: number;
  country_code?: string;
  country?: string;
  admin1?: string;
  admin2?: string;
  admin3?: string;
  timezone?: string;
};

export async function GET(request: Request) {
  const query = String(new URL(request.url).searchParams.get("query") || "").trim().slice(0, 120);
  if (query.length < 2) return Response.json({ error: "请输入至少两个字符" }, { status: 400 });
  const params = new URLSearchParams({ name: query, count: "10", language: "zh", format: "json" });
  try {
    const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${params}`, {
      headers: { accept: "application/json", "user-agent": "ShanchengPhotoAtlas/2.0 github.com/tangwei526/photography-plan" },
    });
    const data = await response.json().catch(() => ({})) as { results?: OpenMeteoLocation[]; reason?: string };
    if (!response.ok) throw new Error(data.reason || `全球地点搜索失败（${response.status}）`);
    const items = (data.results || []).map(item => ({
      id: String(item.id || ""),
      name: String(item.name || ""),
      address: [item.admin3, item.admin2, item.admin1, item.country].filter(Boolean).join(" · "),
      countryCode: String(item.country_code || "").toUpperCase(),
      countryName: String(item.country || item.country_code || ""),
      admin1: String(item.admin1 || ""),
      city: String(item.name || item.admin2 || item.admin1 || ""),
      district: String(item.admin3 || item.admin2 || "待分类"),
      timezone: String(item.timezone || "UTC"),
      longitude: Number(item.longitude),
      latitude: Number(item.latitude),
      coordinateSystem: "wgs84" as const,
    })).filter(item => item.name && Number.isFinite(item.longitude) && Number.isFinite(item.latitude));
    return Response.json({ items, attribution: "Open-Meteo / GeoNames" }, { headers: { "cache-control": "public, max-age=86400, stale-while-revalidate=604800" } });
  } catch (reason) {
    return Response.json({ error: reason instanceof Error ? reason.message : "全球地点搜索暂不可用" }, { status: 502 });
  }
}
