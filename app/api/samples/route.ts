import { env } from "cloudflare:workers";

type SampleMeta = {
  taskId: string; district: string; location: string; theme: string; themeCategory: string;
  stationId: string; stationName: string; stationDescription: string;
  subjectDescription: string; note: string; originalName: string;
};

const bucket = () => (env as unknown as { SAMPLES: R2Bucket }).SAMPLES;
const clean = (value: FormDataEntryValue | null, max = 500) => String(value || "").slice(0, max);
const cleanText = (value: unknown, max = 500) => String(value || "").trim().slice(0, max);
const allowedOrigin = "https://tangwei526.github.io";
const cors = (request: Request) => ({ "access-control-allow-origin": request.headers.get("origin") === allowedOrigin ? allowedOrigin : "", "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS", "access-control-allow-headers": "content-type,x-admin-key", "vary": "origin" });
const secured = (request: Request) => {
  const values = env as unknown as { SAMPLE_ADMIN_KEY?: string; SAMPLE_ADMIN_SESSION?: string };
  const cookie = request.headers.get("cookie") || "";
  const session = cookie.split(";").map(part => part.trim()).find(part => part.startsWith("shancheng_admin="))?.slice("shancheng_admin=".length);
  return Boolean(
    (values.SAMPLE_ADMIN_KEY && request.headers.get("x-admin-key") === values.SAMPLE_ADMIN_KEY) ||
    (values.SAMPLE_ADMIN_SESSION && session === values.SAMPLE_ADMIN_SESSION)
  );
};

export async function OPTIONS(request: Request) {
  return new Response(null, { status: 204, headers: cors(request) });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (id) {
    const object = await bucket().get(`samples/${id}`);
    if (!object || !object.body) return new Response("Not found", { status: 404 });
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("etag", object.httpEtag);
    headers.set("cache-control", "private, max-age=31536000, immutable");
    Object.entries(cors(request)).forEach(([key,value]) => value && headers.set(key,value));
    return new Response(object.body, { headers });
  }

  const objects: R2Object[] = [];
  let cursor: string | undefined;
  do {
    const page = await bucket().list({ prefix: "samples/", cursor, limit: 500, include: ["customMetadata", "httpMetadata"] });
    objects.push(...page.objects);
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);

  const items = objects.sort((a,b) => b.uploaded.getTime() - a.uploaded.getTime()).map(object => {
    const id = object.key.slice("samples/".length);
    return { id, url: `/api/samples?id=${encodeURIComponent(id)}`, uploadedAt: object.uploaded.toISOString(), size: object.size, ...(object.customMetadata || {}) };
  });
  return Response.json({ items }, { headers: cors(request) });
}

export async function POST(request: Request) {
  if (!secured(request)) return Response.json({ error: "需要管理密钥" }, { status: 401, headers: cors(request) });
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File) || !file.type.startsWith("image/")) return Response.json({ error: "请选择图片文件" }, { status: 400, headers: cors(request) });
  if (file.size > 20 * 1024 * 1024) return Response.json({ error: "单张图片不能超过 20MB" }, { status: 400 });
  const ext = (file.name.split(".").pop() || "jpg").replace(/[^a-zA-Z0-9]/g, "").slice(0, 8);
  const id = `${crypto.randomUUID()}.${ext || "jpg"}`;
  const meta: SampleMeta = {
    taskId: clean(form.get("taskId"), 40), district: clean(form.get("district"), 60), location: clean(form.get("location"), 160),
    theme: clean(form.get("theme"), 100), themeCategory: clean(form.get("themeCategory"), 40), stationId: clean(form.get("stationId"), 80), stationName: clean(form.get("stationName"), 160),
    stationDescription: clean(form.get("stationDescription"), 500), subjectDescription: "", note: clean(form.get("note"), 500), originalName: file.name.slice(0, 200),
  };
  await bucket().put(`samples/${id}`, file.stream(), { httpMetadata: { contentType: file.type }, customMetadata: meta });
  return Response.json({ item: { id, url: `/api/samples?id=${encodeURIComponent(id)}`, uploadedAt: new Date().toISOString(), size: file.size, ...meta } }, { headers: cors(request) });
}

export async function PATCH(request: Request) {
  if (!secured(request)) return Response.json({ error: "需要管理密钥" }, { status: 401, headers: cors(request) });
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const id = cleanText(body.id, 120);
  if (!id || id.includes("/")) return Response.json({ error: "无效样片" }, { status: 400, headers: cors(request) });
  const object = await bucket().get(`samples/${id}`);
  if (!object) return Response.json({ error: "样片不存在" }, { status: 404, headers: cors(request) });

  const metadata = {
    ...(object.customMetadata || {}),
    originalName: cleanText(body.originalName, 200),
    location: cleanText(body.location, 160),
    themeCategory: cleanText(body.themeCategory, 40),
    stationName: cleanText(body.stationName, 160),
    stationDescription: cleanText(body.stationDescription, 500),
    subjectDescription: cleanText(body.subjectDescription, 500),
    note: cleanText(body.note, 500),
  };
  await bucket().put(`samples/${id}`, await object.arrayBuffer(), {
    httpMetadata: object.httpMetadata,
    customMetadata: metadata,
  });
  return Response.json({
    item: { id, url: `/api/samples?id=${encodeURIComponent(id)}`, uploadedAt: object.uploaded.toISOString(), size: object.size, ...metadata },
  }, { headers: cors(request) });
}

export async function DELETE(request: Request) {
  if (!secured(request)) return Response.json({ error: "需要管理密钥" }, { status: 401, headers: cors(request) });
  const id = new URL(request.url).searchParams.get("id");
  if (!id || id.includes("/")) return Response.json({ error: "无效样片" }, { status: 400, headers: cors(request) });
  await bucket().delete(`samples/${id}`);
  return Response.json({ ok: true }, { headers: cors(request) });
}
