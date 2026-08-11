import { readFile } from "node:fs/promises";
import { createPrivateKey, sign } from "node:crypto";

const keyId = process.env.QWEATHER_KEY_ID?.trim();
const projectId = process.env.QWEATHER_PROJECT_ID?.trim();
const privateKeyPath = process.env.QWEATHER_PRIVATE_KEY_PATH?.trim()
  || ".secrets/qweather/ed25519-private.pem";
const ttl = Number(process.env.QWEATHER_JWT_TTL || 900);

if (!keyId || !projectId) {
  console.error("请设置 QWEATHER_KEY_ID 和 QWEATHER_PROJECT_ID");
  process.exit(1);
}

if (!Number.isInteger(ttl) || ttl < 60 || ttl > 86400) {
  console.error("QWEATHER_JWT_TTL 必须是 60 到 86400 之间的整数秒数");
  process.exit(1);
}

const encode = (value) => Buffer.from(value).toString("base64url");
const issuedAt = Math.floor(Date.now() / 1000) - 30;
const header = encode(JSON.stringify({ alg: "EdDSA", kid: keyId }));
const payload = encode(JSON.stringify({
  sub: projectId,
  iat: issuedAt,
  exp: issuedAt + ttl,
}));
const signingInput = `${header}.${payload}`;
const privateKey = createPrivateKey(await readFile(privateKeyPath));
const signature = sign(null, Buffer.from(signingInput), privateKey).toString("base64url");

process.stdout.write(`${signingInput}.${signature}\n`);
