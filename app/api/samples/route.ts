import { env } from "cloudflare:workers";

type SampleMeta = {
  taskId: string; district: string; location: string; theme: string;
  stationId: string; stationName: string; stationDescription: string;
  note: string; originalName: string;
};

const bucket = () => (env as unknown as { SAMPLES: R2Bucket }).SAMPLES;
const clean = (value: FormDataEntryValue | null, max = 500) => String(value || "").slice(0, max);

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
  return Response.json({ items });
}

export async function POST(request: Request) {
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File) || !file.type.startsWith("image/")) return Response.json({ error: "请选择图片文件" }, { status: 400 });
  if (file.size > 20 * 1024 * 1024) return Response.json({ error: "单张图片不能超过 20MB" }, { status: 400 });
  const ext = (file.name.split(".").pop() || "jpg").replace(/[^a-zA-Z0-9]/g, "").slice(0, 8);
  const id = `${crypto.randomUUID()}.${ext || "jpg"}`;
  const meta: SampleMeta = {
    taskId: clean(form.get("taskId"), 40), district: clean(form.get("district"), 60), location: clean(form.get("location"), 160),
    theme: clean(form.get("theme"), 100), stationId: clean(form.get("stationId"), 80), stationName: clean(form.get("stationName"), 160),
    stationDescription: clean(form.get("stationDescription"), 500), note: clean(form.get("note"), 500), originalName: file.name.slice(0, 200),
  };
  await bucket().put(`samples/${id}`, file.stream(), { httpMetadata: { contentType: file.type }, customMetadata: meta });
  return Response.json({ item: { id, url: `/api/samples?id=${encodeURIComponent(id)}`, uploadedAt: new Date().toISOString(), size: file.size, ...meta } });
}

export async function DELETE(request: Request) {
  const id = new URL(request.url).searchParams.get("id");
  if (!id || id.includes("/")) return Response.json({ error: "无效样片" }, { status: 400 });
  await bucket().delete(`samples/${id}`);
  return Response.json({ ok: true });
}
