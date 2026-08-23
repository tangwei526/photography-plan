import { env } from "cloudflare:workers";

type SampleMeta = {
  taskId: string; district: string; location: string; theme: string; themeCategory: string;
  device: string; shootTime: string;
  stationId: string; stationName: string; stationDescription: string;
  subjectDescription: string; note: string; originalName: string; groupId?: string;
};

const bucket = () => (env as unknown as { SAMPLES: R2Bucket }).SAMPLES;
const clean = (value: FormDataEntryValue | null, max = 500) => String(value || "").slice(0, max);
const cleanText = (value: unknown, max = 500) => String(value || "").trim().slice(0, max);
const displayableImageTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"]);
const extensionFor = (type: string) => ({ "image/jpeg":"jpg", "image/png":"png", "image/webp":"webp", "image/gif":"gif", "image/avif":"avif" }[type] || "jpg");
const allowedOrigin = "https://tangwei526.github.io";
const cors = (request: Request) => ({ "access-control-allow-origin": request.headers.get("origin") === allowedOrigin ? allowedOrigin : "", "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS", "access-control-allow-headers": "content-type,x-admin-key", "access-control-expose-headers": "etag", "vary": "origin" });
const jsonHeaders = (request: Request) => ({ ...cors(request), "cache-control": "no-store" });
const etagMatches = (value: string | null, etag: string) => Boolean(value?.split(",").some(item => item.trim().replace(/^W\//, "") === etag));
const inventoryEtag = async (objects: R2Object[]) => {
  const signature = objects.map(object => `${object.key}:${object.uploaded.getTime()}:${object.size}:${object.httpEtag}`).join("|");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(signature));
  return `"${Array.from(new Uint8Array(digest)).map(value => value.toString(16).padStart(2, "0")).join("")}"`;
};
const sampleItem = (object: R2Object, id = object.key.slice("samples/".length)) => ({
  id, url: `/api/samples?id=${encodeURIComponent(id)}`, uploadedAt: object.uploaded.toISOString(), size: object.size, ...(object.customMetadata || {}),
});
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
  const check = url.searchParams.get("check");
  if (check) {
    if (check.includes("/")) return Response.json({ exists: false }, { status: 400, headers: jsonHeaders(request) });
    const object = await bucket().head(`samples/${check}`);
    return Response.json({ exists: Boolean(object), item: object ? sampleItem(object, check) : undefined }, { headers: jsonHeaders(request) });
  }
  const id = url.searchParams.get("id");
  if (id) {
    const object = await bucket().get(`samples/${id}`);
    if (!object || !object.body) return new Response("Not found", { status: 404 });
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("etag", object.httpEtag);
    headers.set("cache-control", "public, max-age=31536000, s-maxage=31536000, immutable");
    Object.entries(cors(request)).forEach(([key,value]) => value && headers.set(key,value));
    if (etagMatches(request.headers.get("if-none-match"), object.httpEtag)) return new Response(null, { status: 304, headers });
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
    return sampleItem(object, id);
  });
  const etag = await inventoryEtag(objects);
  const headers = { ...cors(request), etag, "cache-control": "public, max-age=60, stale-while-revalidate=86400" };
  if (etagMatches(request.headers.get("if-none-match"), etag)) return new Response(null, { status: 304, headers });
  return Response.json({ items }, { headers });
}

export async function POST(request: Request) {
  if (!secured(request)) return Response.json({ error: "需要管理密钥" }, { status: 401, headers: cors(request) });
  if ((request.headers.get("content-type") || "").includes("application/json")) {
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const action = cleanText(body.action, 20);
    if (action === "init") {
      const type = cleanText(body.type, 80);
      const size = Number(body.size || 0);
      if (!displayableImageTypes.has(type)) return Response.json({ error: "暂不支持 HEIC/RAW，请先转换为 JPG、PNG、WebP、GIF 或 AVIF" }, { status: 415, headers: cors(request) });
      if (!Number.isFinite(size) || size <= 0 || size > 4 * 1024 * 1024) return Response.json({ error: "图片需压缩到 4MB 以内" }, { status: 400, headers: cors(request) });
      const id = `${crypto.randomUUID()}.${extensionFor(type)}`;
      const meta: SampleMeta = {
        taskId: cleanText(body.taskId, 40), district: cleanText(body.district, 60), location: cleanText(body.location, 160),
        theme: cleanText(body.theme, 100), themeCategory: cleanText(body.themeCategory, 40), device: cleanText(body.device, 40), shootTime: cleanText(body.shootTime, 40), stationId: cleanText(body.stationId, 80), stationName: cleanText(body.stationName, 160),
        stationDescription: cleanText(body.stationDescription, 500), subjectDescription: "", note: cleanText(body.note, 500), originalName: cleanText(body.originalName, 200),
      };
      const multipart = await bucket().createMultipartUpload(`samples/${id}`, { httpMetadata: { contentType: type }, customMetadata: meta });
      return Response.json({ id, uploadId: multipart.uploadId }, { headers: cors(request) });
    }
    if (action === "complete") {
      const id = cleanText(body.id, 120); const uploadId = cleanText(body.uploadId, 220);
      const parts = Array.isArray(body.parts) ? body.parts.map(part => ({ partNumber: Number((part as Record<string, unknown>).partNumber), etag: cleanText((part as Record<string, unknown>).etag, 200) })) : [];
      if (!id || id.includes("/") || !uploadId || !parts.length) return Response.json({ error: "续传信息不完整" }, { status: 400, headers: cors(request) });
      const upload = bucket().resumeMultipartUpload(`samples/${id}`, uploadId);
      const completed = await upload.complete(parts);
      const object = await bucket().head(`samples/${id}`) || completed;
      return Response.json({ ok: true, item: sampleItem(object, id) }, { headers: jsonHeaders(request) });
    }
    return Response.json({ error: "无效上传操作" }, { status: 400, headers: cors(request) });
  }
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || !displayableImageTypes.has(file.type)) return Response.json({ error: "暂不支持 HEIC/RAW，请先转换为 JPG、PNG、WebP、GIF 或 AVIF" }, { status: 415, headers: jsonHeaders(request) });
    if (file.size <= 0 || file.size > 4 * 1024 * 1024) return Response.json({ error: "图片需压缩到 4MB 以内" }, { status: 400, headers: jsonHeaders(request) });
    const id = `${crypto.randomUUID()}.${extensionFor(file.type)}`;
    const meta: SampleMeta = {
      taskId: clean(form.get("taskId"), 40), district: clean(form.get("district"), 60), location: clean(form.get("location"), 160),
      theme: clean(form.get("theme"), 100), themeCategory: clean(form.get("themeCategory"), 40), device: clean(form.get("device"), 40), shootTime: clean(form.get("shootTime"), 40), stationId: clean(form.get("stationId"), 80), stationName: clean(form.get("stationName"), 160),
      stationDescription: clean(form.get("stationDescription"), 500), subjectDescription: "", note: clean(form.get("note"), 500), originalName: clean(form.get("originalName"), 200) || file.name.slice(0, 200),
    };
    await bucket().put(`samples/${id}`, file.stream(), { httpMetadata: { contentType: file.type }, customMetadata: meta });
    return Response.json({ item: { id, url: `/api/samples?id=${encodeURIComponent(id)}`, uploadedAt: new Date().toISOString(), size: file.size, ...meta } }, { headers: jsonHeaders(request) });
  } catch {
    return Response.json({ error: "样片存储失败，请重试" }, { status: 500, headers: jsonHeaders(request) });
  }
}

export async function PUT(request: Request) {
  if (!secured(request)) return Response.json({ error: "需要管理密钥" }, { status: 401, headers: cors(request) });
  const url = new URL(request.url);
  const requestType = request.headers.get("content-type") || "";
  const action = url.searchParams.get("upload");
  if (action === "part") {
    const id = cleanText(url.searchParams.get("id"), 120); const uploadId = cleanText(url.searchParams.get("uploadId"), 220); const partNumber = Number(url.searchParams.get("partNumber"));
    if (!id || id.includes("/") || !uploadId || !Number.isInteger(partNumber) || partNumber < 1 || partNumber > 10000) return Response.json({ error: "无效分片" }, { status: 400, headers: cors(request) });
    const upload = bucket().resumeMultipartUpload(`samples/${id}`, uploadId);
    const part = await upload.uploadPart(partNumber, request.body || new Uint8Array());
    return Response.json(part, { headers: cors(request) });
  }

  const id = cleanText(url.searchParams.get("id"), 120);
  if (!id || id.includes("/")) return Response.json({ error: "无效样片" }, { status: 400, headers: cors(request) });
  if (requestType.includes("multipart/form-data")) {
    const form = await request.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File) || !displayableImageTypes.has(file.type)) return Response.json({ error: "请改用 JPG、PNG、WebP、GIF 或 AVIF" }, { status: 415, headers: cors(request) });
    if (file.size <= 0 || file.size > 4 * 1024 * 1024) return Response.json({ error: "图片需压缩到 4MB 以内" }, { status: 400, headers: cors(request) });
    const existing = await bucket().get(`samples/${id}`);
    if (!existing) return Response.json({ error: "样片不存在" }, { status: 404, headers: cors(request) });
    const metadata: Record<string,string> = { ...(existing.customMetadata || {}) };
    const fields: [string,number][] = [["originalName",200],["location",160],["themeCategory",40],["device",40],["shootTime",40],["stationId",80],["stationName",160],["stationDescription",500],["subjectDescription",500],["note",500],["groupId",80]];
    for (const [field,max] of fields) if (form?.has(field)) metadata[field] = clean(form.get(field), max).trim();
    const replacementId = `${crypto.randomUUID()}.${extensionFor(file.type)}`;
    await bucket().put(`samples/${replacementId}`, file.stream(), { httpMetadata: { contentType: file.type }, customMetadata: metadata });
    const replacement = await bucket().head(`samples/${replacementId}`);
    if (!replacement) return Response.json({ error: "图片保存后暂时无法读取，请刷新画廊" }, { status: 500, headers: cors(request) });
    await bucket().delete(`samples/${id}`);
    return Response.json({ ok: true, item: sampleItem(replacement, replacementId) }, { headers: jsonHeaders(request) });
  }

  const type = cleanText(requestType, 80);
  const size = Number(request.headers.get("content-length") || 0);
  if (!displayableImageTypes.has(type)) return Response.json({ error: "请改用 JPG、PNG、WebP、GIF 或 AVIF" }, { status: 415, headers: cors(request) });
  if (size > 4 * 1024 * 1024) return Response.json({ error: "图片需压缩到 4MB 以内" }, { status: 400, headers: cors(request) });
  const existing = await bucket().get(`samples/${id}`);
  if (!existing) return Response.json({ error: "样片不存在" }, { status: 404, headers: cors(request) });
  const replacementId = `${crypto.randomUUID()}.${extensionFor(type)}`;
  await bucket().put(`samples/${replacementId}`, request.body, { httpMetadata: { contentType: type }, customMetadata: { ...(existing.customMetadata || {}), originalName: cleanText(url.searchParams.get("name") || "重新上传样片", 200) } });
  const replacement = await bucket().head(`samples/${replacementId}`);
  if (!replacement) return Response.json({ error: "图片保存后暂时无法读取，请重试" }, { status: 500, headers: cors(request) });
  await bucket().delete(`samples/${id}`);
  return Response.json({ ok: true, id: replacementId, url: `/api/samples?id=${encodeURIComponent(replacementId)}`, item: sampleItem(replacement, replacementId) }, { headers: cors(request) });
}

export async function PATCH(request: Request) {
  if (!secured(request)) return Response.json({ error: "需要管理密钥" }, { status: 401, headers: cors(request) });
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const id = cleanText(body.id, 120);
  if (!id || id.includes("/")) return Response.json({ error: "无效样片" }, { status: 400, headers: cors(request) });
  const object = await bucket().get(`samples/${id}`);
  if (!object) return Response.json({ error: "样片不存在" }, { status: 404, headers: cors(request) });

  const metadata: Record<string,string> = { ...(object.customMetadata || {}) };
  const fields: [string,number][] = [["originalName",200],["location",160],["themeCategory",40],["device",40],["shootTime",40],["stationId",80],["stationName",160],["stationDescription",500],["subjectDescription",500],["note",500],["groupId",80]];
  for (const [field,max] of fields) if (body[field] !== undefined) metadata[field] = cleanText(body[field], max);
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
