import { env } from "cloudflare:workers";
import { Buffer } from "node:buffer";
import { createPrivateKey, sign as signJwt } from "node:crypto";

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
const base64Url = (bytes: Uint8Array) => Buffer.from(bytes).toString("base64url");
const encodeJson = (value: unknown) => base64Url(encoder.encode(JSON.stringify(value)));
const decodeBase64 = (value: string) => new TextDecoder().decode(Uint8Array.from(atob(value), character => character.charCodeAt(0)));
const clock = (value?: string) => /T(\d{2}:\d{2})/.exec(String(value || ""))?.[1] || "";
const percent = (value: unknown) => Math.round(Math.max(0, Math.min(1, Number(value) || 0)) * 100);
const metric = (value: unknown) => { const match = /-?\d+(?:\.\d+)?/.exec(String(value || "")); return match ? Number(match[0]) : null; };
const parenthetical = (value: unknown) => /[（(]([^）)]+)[）)]/.exec(String(value || ""))?.[1] || "";
const localDate = (timeZone = "UTC", offset = 0) => { const date = new Date(Date.now() + offset * 86400000); try { return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date); } catch { return new Intl.DateTimeFormat("en-CA", { timeZone: "UTC", year: "numeric", month: "2-digit", day: "2-digit" }).format(date); } };
const aodLabel = (value: number | null) => value === null ? "暂缺" : value < .1 ? "高级水晶" : value < .2 ? "水晶" : value < .3 ? "较通透" : value < .4 ? "一般" : value < .6 ? "偏浑浊" : value < .8 ? "浑浊" : "\u91cd\u973e";
const qualityLabel = (value: number | null) => value === null ? "暂缺" : value < .001 ? "不烧" : value < .05 ? "微微烧" : value < .2 ? "小烧" : value < .4 ? "小到中烧" : value < .6 ? "中等烧" : value < .8 ? "中到大烧" : value < 1 ? "大烧" : value < 1.5 ? "典型大烧" : value < 2 ? "优质大烧" : "世纪大烧";

async function timedFetch(input: string, init: RequestInit = {}, timeout = 8000) {
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), timeout);
  try { return await fetch(input, { ...init, signal: controller.signal }); } finally { clearTimeout(timer); }
}

async function sunsetbot(city: string, event: "rise_1" | "set_1" | "rise_2" | "set_2") {
  const params = new URLSearchParams({ intend: "select_city", query_city: city, event, model: "GFS" });
  const response = await timedFetch(`https://www.sunsetbot.top/?${params}`, { headers: { accept: "application/json", "user-agent": "ShanchengPhotoAtlas/1.0" } }, 6500);
  const data = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok || data.status !== "ok") throw new Error(`SunsetBot ${response.status}`);
  const quality = metric(data.tb_quality); const aod = metric(data.tb_aod); const eventTime = String(data.tb_event_time || "");
  return {
    event, date: eventTime.slice(0, 10), time: eventTime.slice(11, 16), quality,
    qualityLabel: parenthetical(data.tb_quality) || qualityLabel(quality), aod,
    aodLabel: parenthetical(data.tb_aod) || aodLabel(aod), model: String(data.display_model || "GFS"),
    run: String(data.display_times_str || ""), source: "SunsetBot",
  };
}

async function openMeteoAir(latitude: number, longitude: number) {
  const params = new URLSearchParams({ latitude: String(latitude), longitude: String(longitude), hourly: "aerosol_optical_depth,us_aqi,pm2_5", timezone: "auto", forecast_days: "2" });
  const response = await timedFetch(`https://air-quality-api.open-meteo.com/v1/air-quality?${params}`, { headers: { accept: "application/json" } }, 8000);
  if (!response.ok) throw new Error(`Open-Meteo ${response.status}`);
  return response.json() as Promise<{ hourly?: { time?: string[]; aerosol_optical_depth?: Array<number | null>; us_aqi?: Array<number | null>; pm2_5?: Array<number | null> } }>;
}

async function openMeteoWeather(latitude: number, longitude: number) {
  const params = new URLSearchParams({ latitude: String(latitude), longitude: String(longitude), hourly: "cloud_cover,cloud_cover_low,cloud_cover_mid,cloud_cover_high,relative_humidity_2m,precipitation_probability", timezone: "auto", forecast_days: "2" });
  const response = await timedFetch(`https://api.open-meteo.com/v1/forecast?${params}`, { headers: { accept: "application/json" } }, 8000);
  if (!response.ok) throw new Error(`Open-Meteo Weather ${response.status}`);
  return response.json() as Promise<{ hourly?: { time?: string[]; cloud_cover?: Array<number | null>; cloud_cover_low?: Array<number | null>; cloud_cover_mid?: Array<number | null>; cloud_cover_high?: Array<number | null>; relative_humidity_2m?: Array<number | null>; precipitation_probability?: Array<number | null> } }>;
}

async function openMeteoHourlyForecast(latitude: number, longitude: number) {
  const params = new URLSearchParams({
    latitude: String(latitude), longitude: String(longitude), timezone: "auto", forecast_hours: "48", wind_speed_unit: "kmh",
    hourly: "temperature_2m,apparent_temperature,weather_code,cloud_cover,cloud_cover_low,cloud_cover_mid,cloud_cover_high,relative_humidity_2m,precipitation_probability,precipitation,visibility,wind_speed_10m,wind_gusts_10m",
  });
  const response = await timedFetch(`https://api.open-meteo.com/v1/forecast?${params}`, { headers: { accept: "application/json" } }, 8000);
  if (!response.ok) throw new Error(`Open-Meteo Hourly ${response.status}`);
  return response.json() as Promise<{ hourly?: {
    time?: string[]; temperature_2m?: Array<number | null>; apparent_temperature?: Array<number | null>; weather_code?: Array<number | null>;
    cloud_cover?: Array<number | null>; cloud_cover_low?: Array<number | null>; cloud_cover_mid?: Array<number | null>; cloud_cover_high?: Array<number | null>;
    relative_humidity_2m?: Array<number | null>; precipitation_probability?: Array<number | null>; precipitation?: Array<number | null>;
    visibility?: Array<number | null>; wind_speed_10m?: Array<number | null>; wind_gusts_10m?: Array<number | null>;
  } }>;
}

async function openMeteoLocationSearch(keyword: string) {
  const params = new URLSearchParams({ name: keyword, count: "8", language: "zh", format: "json" });
  const response = await timedFetch(`https://geocoding-api.open-meteo.com/v1/search?${params}`, { headers: { accept: "application/json" } }, 8000);
  if (!response.ok) throw new Error(`Open-Meteo Geocoding ${response.status}`);
  const data = await response.json() as { results?: Array<Record<string, unknown>> };
  return (data.results || []).map(item => ({
    id: String(item.id || ""), name: String(item.name || ""), adm2: String(item.admin2 || item.admin3 || ""), adm1: String(item.admin1 || ""),
    country: String(item.country || ""), countryCode: String(item.country_code || ""), timezone: String(item.timezone || "UTC"), latitude: Number(item.latitude), longitude: Number(item.longitude),
  })).filter(item => Number.isFinite(item.latitude) && Number.isFinite(item.longitude));
}

const hourlyForecast = (data: Awaited<ReturnType<typeof openMeteoHourlyForecast>> | null) => {
  const hourly = data?.hourly; const times = hourly?.time || [];
  const value = (field: Exclude<keyof NonNullable<typeof hourly>, "time">, index: number) => { const number = Number(hourly?.[field]?.[index]); return Number.isFinite(number) ? number : 0; };
  return times.map((time, index) => ({
    time, temperature: Math.round(value("temperature_2m", index)), apparentTemperature: Math.round(value("apparent_temperature", index)), code: String(Math.round(value("weather_code", index))),
    cloud: Math.round(value("cloud_cover", index)), lowCloud: Math.round(value("cloud_cover_low", index)), midCloud: Math.round(value("cloud_cover_mid", index)), highCloud: Math.round(value("cloud_cover_high", index)),
    humidity: Math.round(value("relative_humidity_2m", index)), precipitation: Math.round(value("precipitation_probability", index)), precipitationAmount: Number(value("precipitation", index).toFixed(1)),
    visibility: Number((value("visibility", index) / 1000).toFixed(1)), windSpeed: Math.round(value("wind_speed_10m", index)), windGust: Math.round(value("wind_gusts_10m", index)),
  })).filter((_, index) => index % 3 === 0).slice(0, 16);
};

const closestHourly = (data: Awaited<ReturnType<typeof openMeteoAir>> | null, date: string, hour: number, field: "aerosol_optical_depth" | "us_aqi" | "pm2_5") => {
  const times = data?.hourly?.time || []; const values = data?.hourly?.[field] || [];
  const index = times.findIndex(value => value === `${date}T${String(hour).padStart(2, "0")}:00`); const value = index >= 0 ? Number(values[index]) : NaN;
  return Number.isFinite(value) ? value : null;
};

const closestWeather = (data: Awaited<ReturnType<typeof openMeteoWeather>> | null, date: string, hour: number) => {
  const times = data?.hourly?.time || []; const index = times.findIndex(value => value === `${date}T${String(hour).padStart(2, "0")}:00`); if (index < 0) return null;
  const at = (field: "cloud_cover" | "cloud_cover_low" | "cloud_cover_mid" | "cloud_cover_high" | "relative_humidity_2m" | "precipitation_probability") => { const value = Number(data?.hourly?.[field]?.[index]); return Number.isFinite(value) ? value / 100 : 0; };
  return { cloud: at("cloud_cover"), low: at("cloud_cover_low"), mid: at("cloud_cover_mid"), high: at("cloud_cover_high"), humidity: at("relative_humidity_2m"), rain: at("precipitation_probability") };
};

const qweatherAqi = (data: Record<string, any> | null, date: string) => {
  const day = (Array.isArray(data?.days) ? data.days : []).find((item: Record<string, unknown>) => String(item.forecastStartTime || "").slice(0, 10) === date);
  const indexes = Array.isArray(day?.indexes) ? day.indexes : [];
  const index = indexes.find((item: Record<string, unknown>) => item.code === "cn-mee") || indexes.find((item: Record<string, unknown>) => item.code === "qaqi") || indexes[0];
  const value = metric(index?.aqiDisplay ?? index?.aqi);
  return value === null ? null : { value: Math.round(value), category: String(index?.category || ""), standard: String(index?.name || "AQI"), source: "和风天气" };
};

const estimatedQuality = (weather: ReturnType<typeof closestWeather>, aod: number | null) => {
  if (!weather || aod === null) return null;
  const litCloud = Math.min(1, weather.high * .78 + weather.mid * .48); const lowPenalty = 1 - weather.low * .72; const air = Math.max(0, 1 - aod / .9);
  const score = (litCloud * .72 + air * .2 + (1 - weather.humidity) * .08) * lowPenalty * (1 - weather.rain * .85);
  return Number(Math.max(0, Math.min(1.2, score * 1.15)).toFixed(3));
};

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
  const signature = signJwt(null, Buffer.from(signingInput), createPrivateKey(privatePem));
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
      const data = await qweather(`/geo/v2/city/lookup?location=${encodeURIComponent(keyword)}&number=8&lang=zh`).catch(() => null);
      let locations = (Array.isArray(data?.location) ? data.location : []).map((item: Record<string, unknown>) => ({
          id: String(item.id || ""), name: String(item.name || ""), adm2: String(item.adm2 || ""), adm1: String(item.adm1 || ""),
          country: String(item.country || ""), countryCode: String(item.countryCode || ""), timezone: String(item.tz || "UTC"), latitude: Number(item.lat), longitude: Number(item.lon),
        })).filter((item: { latitude: number; longitude: number }) => Number.isFinite(item.latitude) && Number.isFinite(item.longitude));
      if (!locations.length && !/^-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?$/.test(keyword)) locations = await openMeteoLocationSearch(keyword);
      return Response.json({ locations }, { headers: { "cache-control": "public, max-age=3600", "access-control-allow-origin": "*" } });
    }

    const latitude = Number(query.get("lat"));
    const longitude = Number(query.get("lon"));
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return Response.json({ error: "无效天气坐标" }, { status: 400 });
    const lat = latitude.toFixed(2); const lon = longitude.toFixed(2);
    if (query.get("mode") === "photo-conditions") {
      const rawCity = String(query.get("city") || "重庆").trim().slice(0, 48); const city = rawCity.replace(/[市区县]$/, "") || "重庆"; const timezone = String(query.get("timezone") || "UTC").trim().slice(0, 80);
      const eventKeys = ["rise_1", "set_1", "rise_2", "set_2"] as const;
      const [sunsetEvents, airDaily, weatherModel, airModel] = await Promise.all([
        Promise.all(eventKeys.map(event => sunsetbot(city, event).catch(() => null))),
        qweather(`/airquality/v1/daily/${lat}/${lon}?localTime=true&lang=zh`).catch(() => null),
        openMeteoWeather(latitude, longitude).catch(() => null),
        openMeteoAir(latitude, longitude).catch(() => null),
      ]);
      const buildEvent = (date: string, event: typeof eventKeys[number], hour: number) => {
        const sunset = sunsetEvents.find(item => item?.event === event); const fallbackAod = closestHourly(airModel, date, hour, "aerosol_optical_depth");
        const aod = sunset?.aod ?? fallbackAod; const estimate = estimatedQuality(closestWeather(weatherModel, date, hour), aod);
        return sunset ? { ...sunset, date: /^\d{4}-\d{2}-\d{2}$/.test(sunset.date) ? sunset.date : date, quality: sunset.quality ?? estimate, qualityLabel: sunset.quality === null ? qualityLabel(estimate) : sunset.qualityLabel, aod: aod === null ? null : Number(aod.toFixed(3)), aodLabel: sunset.aod === null ? aodLabel(aod) : sunset.aodLabel, source: sunset.quality === null ? "参考估算" : sunset.source, estimated: sunset.quality === null } : {
          event, date, time: "", quality: estimate, qualityLabel: estimate === null ? "暂缺" : qualityLabel(estimate), aod: aod === null ? null : Number(aod.toFixed(3)), aodLabel: aodLabel(aod), model: "CAMS", run: "", source: "参考估算", estimated: true,
        };
      };
      const days = [localDate(timezone,0), localDate(timezone,1)].map((date, index) => {
        const fallbackAqi = closestHourly(airModel, date, 12, "us_aqi"); const aqi = qweatherAqi(airDaily, date) || (fallbackAqi === null ? null : { value: Math.round(fallbackAqi), category: fallbackAqi <= 50 ? "优" : fallbackAqi <= 100 ? "良" : fallbackAqi <= 150 ? "轻度污染" : "污染", standard: "US AQI", source: "Open-Meteo / CAMS" });
        return { date, label: index ? "明日" : "今日", aqi, pm25: closestHourly(airModel, date, 12, "pm2_5"), sunrise: buildEvent(date, index ? "rise_2" : "rise_1", 6), sunset: buildEvent(date, index ? "set_2" : "set_1", 19) };
      });
      return Response.json({ city: rawCity, timezone, latitude, longitude, days, updatedAt: new Date().toISOString(), sunsetbotAvailable: sunsetEvents.some(Boolean), attributions: ["SunsetBot", "和风天气", "Open-Meteo / CAMS"] }, { headers: { "cache-control": "public, max-age=900, stale-while-revalidate=1800", "access-control-allow-origin": "*" } });
    }
    const [currentData, dailyData, hourlyData] = await Promise.all([
      qweather(`/weather/v1/current/${lat}/${lon}?localTime=true&lang=zh`),
      qweather(`/weather/v1/daily/${lat}/${lon}?days=7&localTime=true&lang=zh`),
      openMeteoHourlyForecast(latitude, longitude).catch(() => null),
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
    return Response.json({ current, days, hours: hourlyForecast(hourlyData), attribution: "和风天气 + Open-Meteo", updatedAt: new Date().toISOString() }, { headers: { "cache-control": "public, max-age=300, stale-while-revalidate=600", "access-control-allow-origin": "*" } });
  } catch (reason) {
    console.error("QWeather request failed", reason instanceof Error ? reason.message : reason);
    return Response.json({ error: reason instanceof Error ? reason.message : "天气服务暂不可用" }, { status: 502, headers: { "access-control-allow-origin": "*" } });
  }
}
