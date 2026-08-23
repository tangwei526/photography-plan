import { env } from "cloudflare:workers";

const escapeIcs = (value: unknown) => String(value || "").replace(/\\/g,"\\\\").replace(/,/g,"\\,").replace(/;/g,"\\;").replace(/\r?\n/g,"\\n");
const stamp = (date: string, time: string) => `${date.replace(/-/g,"")}T${time.replace(":","")}00`;

export async function GET(request: Request) {
  const values = env as unknown as { DB: D1Database; APPLE_CALENDAR_TOKEN?: string; SITE_AUTH_SESSION?: string };
  const url = new URL(request.url);
  if (url.searchParams.get("setup") === "1") {
    const cookie = request.headers.get("cookie") || "";
    const session = cookie.split(";").map(part=>part.trim()).find(part=>part.startsWith("shancheng_session="))?.slice("shancheng_session=".length);
    if (!values.SITE_AUTH_SESSION || session !== values.SITE_AUTH_SESSION) return Response.json({ error:"请先登录" }, { status:401 });
    if (!values.APPLE_CALENDAR_TOKEN) return Response.json({ error:"日历订阅尚未配置" }, { status:503 });
    const feed = `${url.origin}/api/calendar-feed?token=${encodeURIComponent(values.APPLE_CALENDAR_TOKEN)}`;
    return Response.json({ webcal:feed.replace(/^https:/,"webcal:"), feed });
  }
  if (!values.APPLE_CALENDAR_TOKEN || url.searchParams.get("token") !== values.APPLE_CALENDAR_TOKEN) return new Response("Not found", { status:404 });
  const result = await values.DB.prepare("SELECT id,title,location,event_date AS eventDate,start_time AS startTime,end_time AS endTime,updated_at AS updatedAt FROM calendar_events ORDER BY event_date,start_time").all<Record<string, unknown>>();
  const events = result.results.map((event: Record<string, unknown>) => [
    "BEGIN:VEVENT",
    `UID:${escapeIcs(event.id)}@shancheng-photo-atlas`,
    `DTSTAMP:${new Date(Number(event.updatedAt)||Date.now()).toISOString().replace(/[-:]/g,"").replace(/\.\d{3}Z$/,"Z")}`,
    `DTSTART;TZID=Asia/Shanghai:${stamp(String(event.eventDate),String(event.startTime))}`,
    `DTEND;TZID=Asia/Shanghai:${stamp(String(event.eventDate),String(event.endTime))}`,
    `SUMMARY:${escapeIcs(event.title)}`,
    `LOCATION:${escapeIcs(event.location)}`,
    "END:VEVENT",
  ].join("\r\n")).join("\r\n");
  const calendar = ["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//Photo Location Atlas//CN","CALSCALE:GREGORIAN","METHOD:PUBLISH","X-WR-CALNAME:取景簿",events,"END:VCALENDAR"].filter(Boolean).join("\r\n");
  return new Response(calendar, { headers:{ "content-type":"text/calendar; charset=utf-8", "cache-control":"no-cache" } });
}
