import { env } from "cloudflare:workers";

const cookieName = "shancheng_session";

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

export async function POST(request: Request) {
  const values = env as unknown as {
    SITE_AUTH_USERNAME?: string;
    SITE_AUTH_PASSWORD?: string;
    SITE_AUTH_SESSION?: string;
  };
  const body = await request.json().catch(() => ({})) as { username?: string; password?: string };
  const valid = Boolean(
    values.SITE_AUTH_USERNAME && values.SITE_AUTH_PASSWORD && values.SITE_AUTH_SESSION &&
    await sameValue(body.username || "", values.SITE_AUTH_USERNAME) &&
    await sameValue(body.password || "", values.SITE_AUTH_PASSWORD)
  );
  if (!valid) return Response.json({ error: "账号或密码不正确" }, { status: 401 });

  return Response.json({ ok: true }, {
    headers: {
      "set-cookie": `${cookieName}=${values.SITE_AUTH_SESSION}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000`,
      "cache-control": "no-store",
    },
  });
}

export async function DELETE() {
  return Response.json({ ok: true }, {
    headers: {
      "set-cookie": `${cookieName}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`,
      "cache-control": "no-store",
    },
  });
}
