import { env } from "cloudflare:workers";

const cookieName = "shancheng_admin";

function sessionFrom(request: Request) {
  const cookie = request.headers.get("cookie") || "";
  return cookie.split(";").map(part => part.trim()).find(part => part.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1) || "";
}

async function sameValue(left: string, right: string) {
  const encoder = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(left)),
    crypto.subtle.digest("SHA-256", encoder.encode(right)),
  ]);
  const aa = new Uint8Array(a);
  const bb = new Uint8Array(b);
  let difference = aa.length ^ bb.length;
  for (let i = 0; i < Math.min(aa.length, bb.length); i++) difference |= aa[i] ^ bb[i];
  return difference === 0;
}

export async function GET(request: Request) {
  const configured = (env as unknown as { SAMPLE_ADMIN_SESSION?: string }).SAMPLE_ADMIN_SESSION;
  const valid = Boolean(configured && sessionFrom(request) === configured);
  return Response.json({ valid }, { status: valid ? 200 : 401, headers: { "cache-control": "no-store" } });
}

export async function POST(request: Request) {
  const values = env as unknown as { SAMPLE_ADMIN_KEY?: string; SAMPLE_ADMIN_SESSION?: string };
  const body = await request.json().catch(() => ({})) as { key?: string };
  const valid = Boolean(values.SAMPLE_ADMIN_KEY && values.SAMPLE_ADMIN_SESSION && await sameValue(body.key || "", values.SAMPLE_ADMIN_KEY));
  if (!valid) return Response.json({ error: "管理密钥不正确" }, { status: 401, headers: { "cache-control": "no-store" } });
  return Response.json({ valid: true }, { headers: {
    "set-cookie": `${cookieName}=${values.SAMPLE_ADMIN_SESSION}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=2592000`,
    "cache-control": "no-store",
  } });
}

export async function DELETE() {
  return Response.json({ ok: true }, { headers: {
    "set-cookie": `${cookieName}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`,
    "cache-control": "no-store",
  } });
}
