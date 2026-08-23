import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("uses the normalized point, task, station and theme model", async () => {
  const source = await readFile(new URL("../app/HomeClient.tsx", import.meta.url), "utf8");
  assert.match(source, /type PointRecord =/);
  assert.match(source, /pointId\?:string/);
  assert.match(source, /stationIds\?:string\[\]/);
  assert.match(source, /themeNames:string\[\]/);
  assert.match(source, /shancheng-photo-workspace-v3/);
  assert.match(source, /点位、机位和创作主题已经独立保存/);
});

test("ships a real Excel import template with the normalized columns", async () => {
  const bytes = await readFile(new URL("../public/摄影点位导入模板.xlsx", import.meta.url));
  assert.equal(bytes.subarray(0, 2).toString(), "PK");
  const source = await readFile(new URL("../app/HomeClient.tsx", import.meta.url), "utf8");
  for (const heading of ["拍摄任务", "拍摄时间", "创作主题", "关联机位", "全部机位"]) {
    assert.match(source, new RegExp(heading));
  }
});

test("uses an in-app admin dialog before editing gallery samples", async () => {
  const source = await readFile(new URL("../app/HomeClient.tsx", import.meta.url), "utf8");
  assert.match(source, /<DialogTitle>验证管理权限<\/DialogTitle>/);
  assert.match(source, /verifyAdminKey/);
  assert.match(source, /ensureAdmin=\{ensureAdmin\}/);
  assert.doesNotMatch(source, /prompt\("请输入管理密钥/);
});

test("ships Soft UI tokens for light and dark themes", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(css, /--soft-raised:/);
  assert.match(css, /--soft-inset:/);
  assert.match(css, /\[data-theme="dark"\]\{[\s\S]*?--soft-highlight:#2b312e/);
  assert.match(css, /box-shadow:var\(--soft-raised\)/);
});
