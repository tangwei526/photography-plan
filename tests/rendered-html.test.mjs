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

test("point cards expose themes, unfinished tasks and field readiness", async () => {
  const source = await readFile(new URL("../app/HomeClient.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  for (const detail of ["pointThemeTags", "待拍摄", "待补拍", "cloudSampleCountByTask", "已定位"]) {
    assert.match(source, new RegExp(detail));
  }
  assert.match(css, /\.pointTaskState-retake/);
  assert.match(css, /\.pointCardMeta/);
});

test("gallery opens one editor with crop, rotate and a single name field", async () => {
  const source = await readFile(new URL("../app/HomeClient.tsx", import.meta.url), "utf8");
  const api = await readFile(new URL("../app/api/samples/route.ts", import.meta.url), "utf8");
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(source, /className="sampleCardOpen"/);
  assert.doesNotMatch(source, /<article role="button" tabIndex=\{0\} className=\{`sampleCard/);
  assert.match(source, /className="sampleCardOpen"[\s\S]*?startEdit\(item\)/);
  assert.match(source, /async function startEdit[\s\S]*?if\(!\(await ensureAdmin\(\)\)\)return;setActive\(item\)/);
  assert.equal(source.match(/htmlFor="sample-name"/g)?.length, 1);
  for (const feature of ["SampleCropEditor", "exportEditedSample", "ToggleGroup", "Slider", "RotateCwIcon"]) assert.match(source, new RegExp(feature));
  assert.match(api, /requestType\.includes\("multipart\/form-data"\)/);
  assert.match(css, /\.sampleEditorDialog\[data-slot="dialog-content"\]/);
});

test("map weather includes layered cloud forecasts and calendar includes moon status", async () => {
  const source = await readFile(new URL("../app/HomeClient.tsx", import.meta.url), "utf8");
  const weather = await readFile(new URL("../app/api/weather/route.ts", import.meta.url), "utf8");
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  for (const field of ["cloud_cover_low", "cloud_cover_mid", "cloud_cover_high", "visibility", "wind_gusts_10m"]) {
    assert.match(weather, new RegExp(field));
  }
  assert.match(source, /\u672a\u6765 48 \u5c0f\u65f6\u4e91\u5c42/);
  assert.match(source, /moonStatusForDate/);
  assert.match(source, /className="dayMoon"/);
  assert.match(css, /\.cloudLayer/);
  assert.match(css, /\.dayMoon/);
});

test("large point and gallery collections render progressively", async () => {
  const source = await readFile(new URL("../app/HomeClient.tsx", import.meta.url), "utf8");
  assert.match(source, /pointDisplayLimit/);
  assert.match(source, /filtered\.slice\(0,pointDisplayLimit\)/);
  assert.match(source, /groupDisplayLimit/);
  assert.match(source, /sampleGroups\.slice\(0,groupDisplayLimit\)/);
  assert.match(source, /为保证浏览流畅/);
});

test("mobile navigation, calendar creation and route selection remain reachable", async () => {
  const source = await readFile(new URL("../app/HomeClient.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(source, /className="dayAdd"/);
  assert.match(source, /routeCandidates\.map/);
  assert.match(source, /mappedTasks\.find\(t=>t\.id===id\)/);
  assert.match(css, /@media\(max-width:720px\)\{[\s\S]*?\.topbar nav\{display:flex/);
});

test("astronomy uses one light timeline and coverage reports multiple dimensions", async () => {
  const source = await readFile(new URL("../app/HomeClient.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(source, /suppressHydrationWarning/);
  assert.match(source, /statusText=.*?nextEvent/);
  assert.match(source, /className="astroTrajectory"/);
  assert.match(source, /className="astroNowMarker"/);
  assert.match(source, /className=\{`astroMoonDisc/);
  assert.match(css, /--astro-moon:#70a9ff/);
  assert.match(css, /\.astroEvents\{display:grid;grid-template-columns:repeat\(6/);
  assert.match(css, /\[data-theme="light"\] \.astronomyHero/);
  assert.match(source, /const categoryStats=categories\.map/);
  assert.match(source, /coverageStatusConfig/);
  assert.match(source, /<RadialBarChart/);
  assert.match(source, /className="coverageChartGrid"/);
  assert.match(source, /className="coverageLineChart"/);
  assert.match(source, /坐标完整度/);
  assert.match(source, /毕业标准完备率/);
  assert.match(source, /系统归纳/);
  assert.match(css, /\.coverageTopGrid\{display:grid/);
  assert.match(css, /\.coverageInsightGrid\{display:grid/);
});
