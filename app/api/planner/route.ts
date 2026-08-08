import { env } from "cloudflare:workers";

const database = () => (env as unknown as { DB: D1Database }).DB;
const clean = (value: unknown, max = 200) => String(value || "").trim().slice(0, max);
const secured = (request: Request) => {
  const values = env as unknown as { SAMPLE_ADMIN_KEY?: string; SAMPLE_ADMIN_SESSION?: string };
  const cookie = request.headers.get("cookie") || "";
  const session = cookie.split(";").map(part => part.trim()).find(part => part.startsWith("shancheng_admin="))?.slice("shancheng_admin=".length);
  return Boolean((values.SAMPLE_ADMIN_KEY && request.headers.get("x-admin-key") === values.SAMPLE_ADMIN_KEY) || (values.SAMPLE_ADMIN_SESSION && session === values.SAMPLE_ADMIN_SESSION));
};

export async function GET() {
  const db = database();
  const [events, themes] = await Promise.all([
    db.prepare("SELECT id, title, location, event_date AS eventDate, start_time AS startTime, end_time AS endTime, created_at AS createdAt, updated_at AS updatedAt FROM calendar_events ORDER BY event_date, start_time").all(),
    db.prepare("SELECT id, name, created_at AS createdAt FROM shooting_themes ORDER BY created_at, name").all(),
  ]);
  return Response.json({ events: events.results, themes: themes.results });
}

export async function POST(request: Request) {
  if (!secured(request)) return Response.json({ error: "需要管理密钥" }, { status: 401 });
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const kind = clean(body.kind, 20); const now = Date.now(); const id = clean(body.id, 100) || crypto.randomUUID();
  if (kind === "event") {
    const title = clean(body.title, 160); const eventDate = clean(body.eventDate, 10); const startTime = clean(body.startTime, 5); const endTime = clean(body.endTime, 5); const location = clean(body.location, 200);
    if (!title || !/^\d{4}-\d{2}-\d{2}$/.test(eventDate) || !/^\d{2}:\d{2}$/.test(startTime) || !/^\d{2}:\d{2}$/.test(endTime)) return Response.json({ error: "日程信息不完整" }, { status: 400 });
    await database().prepare("INSERT INTO calendar_events (id,title,location,event_date,start_time,end_time,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)").bind(id,title,location,eventDate,startTime,endTime,now,now).run();
    return Response.json({ item: { id,title,location,eventDate,startTime,endTime,createdAt:now,updatedAt:now } });
  }
  if (kind === "theme") {
    const name = clean(body.name, 40); if (!name) return Response.json({ error: "请填写主题名称" }, { status: 400 });
    try { await database().prepare("INSERT INTO shooting_themes (id,name,created_at) VALUES (?,?,?)").bind(id,name,now).run(); }
    catch { return Response.json({ error: "主题名称已存在" }, { status: 409 }); }
    return Response.json({ item: { id,name,createdAt:now } });
  }
  return Response.json({ error: "无效操作" }, { status: 400 });
}

export async function PATCH(request: Request) {
  if (!secured(request)) return Response.json({ error: "需要管理密钥" }, { status: 401 });
  const body = await request.json().catch(() => ({})) as Record<string, unknown>; const kind = clean(body.kind, 20); const id = clean(body.id, 100);
  if (!id) return Response.json({ error: "缺少记录" }, { status: 400 });
  if (kind === "event") {
    const title = clean(body.title, 160); const eventDate = clean(body.eventDate, 10); const startTime = clean(body.startTime, 5); const endTime = clean(body.endTime, 5); const location = clean(body.location, 200); const updatedAt = Date.now();
    await database().prepare("UPDATE calendar_events SET title=?, location=?, event_date=?, start_time=?, end_time=?, updated_at=? WHERE id=?").bind(title,location,eventDate,startTime,endTime,updatedAt,id).run();
    return Response.json({ item: { id,title,location,eventDate,startTime,endTime,updatedAt } });
  }
  if (kind === "theme") {
    const name = clean(body.name, 40); if (!name) return Response.json({ error: "请填写主题名称" }, { status: 400 });
    try { await database().prepare("UPDATE shooting_themes SET name=? WHERE id=?").bind(name,id).run(); }
    catch { return Response.json({ error: "主题名称已存在" }, { status: 409 }); }
    return Response.json({ item: { id,name } });
  }
  return Response.json({ error: "无效操作" }, { status: 400 });
}

export async function DELETE(request: Request) {
  if (!secured(request)) return Response.json({ error: "需要管理密钥" }, { status: 401 });
  const url = new URL(request.url); const kind = clean(url.searchParams.get("kind"), 20); const id = clean(url.searchParams.get("id"), 100);
  if (!id) return Response.json({ error: "缺少记录" }, { status: 400 });
  const table = kind === "event" ? "calendar_events" : kind === "theme" ? "shooting_themes" : "";
  if (!table) return Response.json({ error: "无效操作" }, { status: 400 });
  await database().prepare(`DELETE FROM ${table} WHERE id=?`).bind(id).run();
  return Response.json({ ok: true });
}
