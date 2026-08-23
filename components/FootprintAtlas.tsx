"use client";

import { useEffect, useRef, useState } from "react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cityGeography, cityIdentity, cityKey, type CityRecord, type Geography } from "@/lib/geography";
import { loadAMap, type AMapInstance, type AMapNamespace } from "@/lib/amap-client";
import { CheckCircle2Icon, ChevronRightIcon, EarthIcon, ListFilterIcon, MapIcon, MapPinIcon, PencilIcon, PlusIcon, RouteIcon, SearchIcon, SparklesIcon, Trash2Icon } from "lucide-react";

type PointLike = Geography & {
  id: string;
  location: string;
  latitude?: number;
  longitude?: number;
};

type TaskLike = Partial<Geography> & {
  pointId?: string;
  status: string;
};

type LocationResult = Partial<Geography> & {
  id?: string;
  name: string;
  latitude: number;
  longitude: number;
};

type FootprintAtlasProps = {
  cities: CityRecord[];
  points: PointLike[];
  tasks: TaskLike[];
  ensureAdmin: () => Promise<boolean>;
  onSaveCity: (city: CityRecord, previous?: CityRecord) => Promise<boolean>;
  onDeleteCity: (city: CityRecord) => Promise<boolean>;
  onOpenPoints: (city: CityRecord) => void;
};

const blankCity = (): CityRecord => ({
  id: "",
  countryCode: "",
  countryName: "",
  admin1: "",
  city: "",
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
  status: "计划前往",
  visitedAt: "",
  latitude: undefined,
  longitude: undefined,
  note: "",
});

const escapeMapLabel = (value: string) => value.replace(/[&<>'"]/g, (character) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  "'": "&#39;",
  '"': "&quot;",
}[character] || character));

function FootprintMap({ mode, cities, points, selectedCityId, onSelectCity }: {
  mode: "world" | "city";
  cities: CityRecord[];
  points: PointLike[];
  selectedCityId: string;
  onSelectCity: (city: CityRecord) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<AMapInstance | null>(null);
  const amapRef = useRef<AMapNamespace | null>(null);
  const onSelectRef = useRef(onSelectCity);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    onSelectRef.current = onSelectCity;
  }, [onSelectCity]);

  const selectedCity = cities.find((city) => city.id === selectedCityId);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const AMap = await loadAMap();
        if (!active || !containerRef.current) return;
        amapRef.current = AMap;
        mapRef.current = new AMap.Map(containerRef.current, {
          viewMode: "2D",
          zoom: 2,
          center: [25, 25],
          mapStyle: "amap://styles/darkblue",
        });
        mapRef.current.addControl(new AMap.Scale());
        mapRef.current.addControl(new AMap.ToolBar({ position: { top: "16px", right: "16px" } }));
        setReady(true);
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : "足迹地图加载失败");
      }
    })();
    return () => {
      active = false;
      mapRef.current?.destroy();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const AMap = amapRef.current;
    if (!AMap) return;
    const map = mapRef.current;
    map.clearMap();

    if (mode === "world") {
      const located = cities.filter((city) => Number.isFinite(city.latitude) && Number.isFinite(city.longitude));
      const markers = located.map((city) => {
        const lit = city.status === "已点亮";
        const marker = new AMap.Marker({
          position: [city.longitude, city.latitude],
          anchor: "center",
          title: `${city.countryName} · ${city.city}`,
          content: `<button class="footprintCityMarker${lit ? " isLit" : ""}" aria-label="查看 ${escapeMapLabel(city.city)}"><i></i><span>${escapeMapLabel(city.city)}</span></button>`,
        });
        marker.on("click", () => onSelectRef.current(city));
        map.add(marker);
        return marker;
      });
      const trail = located
        .filter((city) => city.status === "已点亮")
        .sort((a, b) => `${a.visitedAt || "9999"}${a.city}`.localeCompare(`${b.visitedAt || "9999"}${b.city}`));
      if (trail.length > 1) {
        map.add(new AMap.Polyline({
          path: trail.map((city) => [city.longitude, city.latitude]),
          strokeColor: "#ff7a45",
          strokeWeight: 3,
          strokeOpacity: 0.85,
          strokeStyle: "dashed",
          showDir: true,
        }));
      }
      if (markers.length > 1) map.setFitView(markers, false, [70, 70, 70, 70], 4);
      else if (markers.length === 1) map.setZoomAndCenter(5, markers[0].getPosition());
      else map.setZoomAndCenter(2, [25, 25]);
      return;
    }

    if (!selectedCity) return;
    const key = cityKey(selectedCity);
    const locatedPoints = points.filter((point) => cityKey(point) === key && Number.isFinite(point.latitude) && Number.isFinite(point.longitude));
    const markers = locatedPoints.map((point, index) => {
      const marker = new AMap.Marker({
        position: [point.longitude, point.latitude],
        anchor: "center",
        title: point.location,
        content: `<span class="footprintPointMarker"><i>${index + 1}</i><b>${escapeMapLabel(point.location)}</b></span>`,
      });
      map.add(marker);
      return marker;
    });
    if (locatedPoints.length > 1) {
      map.add(new AMap.Polyline({
        path: locatedPoints.map((point) => [point.longitude, point.latitude]),
        strokeColor: "#ff7a45",
        strokeWeight: 5,
        strokeOpacity: 0.9,
        showDir: true,
      }));
    }
    if (markers.length > 1) map.setFitView(markers, false, [80, 80, 80, 80], 14);
    else if (markers.length === 1) map.setZoomAndCenter(13, markers[0].getPosition());
    else if (selectedCity.latitude && selectedCity.longitude) map.setZoomAndCenter(11, [selectedCity.longitude, selectedCity.latitude]);
  }, [cities, mode, points, ready, selectedCity, selectedCityId]);

  return <div className="footprintMapFrame">
    <div ref={containerRef} className="footprintMapCanvas" />
    {error && <div className="footprintMapError"><MapIcon /><strong>{error}</strong><span>城市数据仍可正常管理，请稍后重试地图。</span></div>}
    {!error && mode === "world" && !cities.some((city) => city.latitude && city.longitude) && <div className="footprintMapEmpty"><EarthIcon /><strong>还没有可定位的城市</strong><span>新增城市并选择搜索结果后，即可点亮世界地图。</span></div>}
    {!error && mode === "city" && selectedCity && !points.some((point) => cityKey(point) === cityKey(selectedCity) && point.latitude && point.longitude) && <div className="footprintMapEmpty"><RouteIcon /><strong>这个城市还没有轨迹</strong><span>为点位选择地图位置后，将按录入顺序形成城市轨迹。</span></div>}
  </div>;
}

function CityEditor({ open, city, onOpenChange, onSave }: {
  open: boolean;
  city?: CityRecord;
  onOpenChange: (open: boolean) => void;
  onSave: (city: CityRecord, previous?: CityRecord) => Promise<boolean>;
}) {
  const [draft, setDraft] = useState<CityRecord>(city || blankCity());
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<LocationResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function searchCity() {
    if (!query.trim() || searching) return;
    setSearching(true);
    setError("");
    try {
      const response = await fetch(`/api/location-search?query=${encodeURIComponent(query.trim())}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "城市搜索失败");
      setResults(Array.isArray(data.items) ? data.items : []);
      if (!data.items?.length) setError("没有找到匹配城市，请尝试城市的中文名或英文名。");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "城市搜索失败");
    } finally {
      setSearching(false);
    }
  }

  function chooseLocation(result: LocationResult) {
    setDraft((current) => ({
      ...current,
      countryCode: String(result.countryCode || "").toUpperCase(),
      countryName: String(result.countryName || ""),
      admin1: String(result.admin1 || ""),
      city: String(result.city || result.name || ""),
      timezone: String(result.timezone || "UTC"),
      latitude: result.latitude,
      longitude: result.longitude,
    }));
    setQuery(result.name);
    setResults([]);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!draft.countryCode.trim() || !draft.countryName.trim() || !draft.city.trim()) {
      setError("请完整填写国家代码、国家和城市名称。");
      return;
    }
    setSaving(true);
    setError("");
    const record = {
      ...draft,
      id: draft.id || cityIdentity({ ...cityGeography(draft), district: "待分类" }),
      countryCode: draft.countryCode.trim().toUpperCase(),
      countryName: draft.countryName.trim(),
      admin1: draft.admin1.trim(),
      city: draft.city.trim(),
      timezone: draft.timezone.trim() || "UTC",
      note: draft.note.trim(),
    };
    const saved = await onSave(record, city);
    setSaving(false);
    if (saved) onOpenChange(false);
  }

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="footprintCityDialog" showCloseButton={!saving}>
      <form onSubmit={submit}>
        <DialogHeader>
          <DialogTitle>{city ? "编辑城市" : "新增城市"}</DialogTitle>
          <DialogDescription>先搜索并选择城市，可自动获取国家、时区与地图中心；随后仍可修改展示信息。</DialogDescription>
        </DialogHeader>
        <FieldGroup className="footprintCityFields">
          <Field>
            <FieldLabel htmlFor="footprint-city-search">搜索全球城市</FieldLabel>
            <div className="footprintCitySearch">
              <Input id="footprint-city-search" value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); searchCity(); } }} placeholder="例如：东京、Paris、Reykjavík" />
              <Button type="button" variant="outline" onClick={searchCity} disabled={searching || !query.trim()}>{searching ? <Spinner data-icon="inline-start" /> : <SearchIcon data-icon="inline-start" />}{searching ? "搜索中" : "搜索"}</Button>
            </div>
            {results.length > 0 && <div className="footprintCityResults">{results.map((result, index) => <button type="button" key={`${result.latitude}-${result.longitude}-${index}`} onClick={() => chooseLocation(result)}><MapPinIcon /><span><strong>{result.name}</strong><small>{[result.countryName, result.admin1, result.city].filter(Boolean).join(" · ")}</small></span><ChevronRightIcon /></button>)}</div>}
          </Field>
          <div className="footprintCityFieldGrid">
            <Field><FieldLabel htmlFor="footprint-country-code">国家代码</FieldLabel><Input id="footprint-country-code" maxLength={2} value={draft.countryCode} onChange={(event) => setDraft((current) => ({ ...current, countryCode: event.target.value.toUpperCase() }))} placeholder="CN" /></Field>
            <Field><FieldLabel htmlFor="footprint-country-name">国家或地区</FieldLabel><Input id="footprint-country-name" value={draft.countryName} onChange={(event) => setDraft((current) => ({ ...current, countryName: event.target.value }))} placeholder="中国" /></Field>
            <Field><FieldLabel htmlFor="footprint-admin1">省 / 州</FieldLabel><Input id="footprint-admin1" value={draft.admin1} onChange={(event) => setDraft((current) => ({ ...current, admin1: event.target.value }))} placeholder="重庆市" /></Field>
            <Field><FieldLabel htmlFor="footprint-city-name">城市名称</FieldLabel><Input id="footprint-city-name" value={draft.city} onChange={(event) => setDraft((current) => ({ ...current, city: event.target.value }))} placeholder="重庆市" /></Field>
            <Field><FieldLabel>点亮状态</FieldLabel><Select value={draft.status} onValueChange={(value) => setDraft((current) => ({ ...current, status: value === "已点亮" ? "已点亮" : "计划前往" }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectGroup><SelectItem value="计划前往">计划前往</SelectItem><SelectItem value="已点亮">已点亮</SelectItem></SelectGroup></SelectContent></Select></Field>
            <Field><FieldLabel htmlFor="footprint-visited-at">到访日期</FieldLabel><Input id="footprint-visited-at" type="date" value={draft.visitedAt || ""} onChange={(event) => setDraft((current) => ({ ...current, visitedAt: event.target.value }))} /></Field>
            <Field className="footprintCityFieldWide"><FieldLabel htmlFor="footprint-timezone">IANA 时区</FieldLabel><Input id="footprint-timezone" value={draft.timezone} onChange={(event) => setDraft((current) => ({ ...current, timezone: event.target.value }))} placeholder="Asia/Shanghai" /><FieldDescription>{draft.latitude && draft.longitude ? "已获取城市中心位置，可显示在地图上。" : "尚未定位，建议从搜索结果中选择城市。"}</FieldDescription></Field>
            <Field className="footprintCityFieldWide"><FieldLabel htmlFor="footprint-note">城市备注</FieldLabel><Textarea id="footprint-note" value={draft.note} onChange={(event) => setDraft((current) => ({ ...current, note: event.target.value }))} placeholder="记录当地拍摄季节、交通、器材或创作计划…" /></Field>
          </div>
          {error && <p className="footprintFormError">{error}</p>}
        </FieldGroup>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={saving} onClick={() => onOpenChange(false)}>取消</Button>
          <Button type="submit" disabled={saving}>{saving && <Spinner data-icon="inline-start" />}{saving ? "正在保存" : "保存城市"}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}

export function FootprintAtlas({ cities, points, tasks, ensureAdmin, onSaveCity, onDeleteCity, onOpenPoints }: FootprintAtlasProps) {
  const [mode, setMode] = useState<"world" | "city">("world");
  const [selectedCityId, setSelectedCityId] = useState(cities[0]?.id || "");
  const [editingCity, setEditingCity] = useState<CityRecord | undefined>();
  const [editorOpen, setEditorOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CityRecord | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [query, setQuery] = useState("");

  const safeSelectedCityId = cities.some((city) => city.id === selectedCityId) ? selectedCityId : cities[0]?.id || "";
  const selectedCity = cities.find((city) => city.id === safeSelectedCityId);
  const filteredCities = cities.filter((city) => `${city.countryName} ${city.admin1} ${city.city} ${city.note}`.toLowerCase().includes(query.trim().toLowerCase()));
  const litCities = cities.filter((city) => city.status === "已点亮");
  const litCountries = new Set(litCities.map((city) => city.countryCode));
  const selectedKey = selectedCity ? cityKey(selectedCity) : "";
  const selectedPoints = selectedCity ? points.filter((point) => cityKey(point) === selectedKey) : [];
  const selectedPointIds = new Set(selectedPoints.map((point) => point.id));
  const selectedTasks = tasks.filter((task) => task.pointId && selectedPointIds.has(task.pointId));
  const completedTasks = selectedTasks.filter((task) => task.status === "已毕业").length;

  async function beginEdit(city?: CityRecord) {
    if (!(await ensureAdmin())) return;
    setEditingCity(city);
    setEditorOpen(true);
  }

  async function saveCity(city: CityRecord, previous?: CityRecord) {
    const saved = await onSaveCity(city, previous);
    if (saved) {
      setSelectedCityId(city.id);
      toast.add({ title: previous ? "城市信息已更新" : "城市已加入足迹地图", type: "success", timeout: 2600 });
    }
    return saved;
  }

  async function deleteCity() {
    if (!deleteTarget) return;
    setDeleting(true);
    const deleted = await onDeleteCity(deleteTarget);
    setDeleting(false);
    if (deleted) {
      toast.add({ title: "城市及其关联数据已删除", type: "success", timeout: 2600 });
      setDeleteTarget(null);
    }
  }

  function openCity(city: CityRecord) {
    setSelectedCityId(city.id);
    setMode("city");
  }

  return <section className="footprintAtlas">
    <div className="footprintToolbar">
      <div>
        <p className="eyebrow">TRAVEL FOOTPRINT · PHOTO TRAILS</p>
        <h2>点亮去过的城市，连接每一次拍摄。</h2>
        <p>世界层查看城市足迹与跨城轨迹；城市层查看点位分布和拍摄路径。</p>
      </div>
      <div className="footprintToolbarActions">
        <ToggleGroup variant="outline" value={[mode]} onValueChange={(values) => { const next = values[0] as "world" | "city" | undefined; if (next) setMode(next); }} aria-label="切换世界地图与城市地图">
          <ToggleGroupItem value="world"><EarthIcon data-icon="inline-start" />世界地图</ToggleGroupItem>
          <ToggleGroupItem value="city" disabled={!cities.length}><MapIcon data-icon="inline-start" />城市地图</ToggleGroupItem>
        </ToggleGroup>
        <Button onClick={() => beginEdit()}><PlusIcon data-icon="inline-start" />新增城市</Button>
      </div>
    </div>

    <div className="footprintMetrics">
      <Card><CardHeader><CardDescription>已点亮国家</CardDescription><CardTitle>{litCountries.size}<small> 个</small></CardTitle><CardAction><EarthIcon /></CardAction></CardHeader><CardFooter>由已点亮城市自动汇总</CardFooter></Card>
      <Card><CardHeader><CardDescription>已点亮城市</CardDescription><CardTitle>{litCities.length}<small> / {cities.length}</small></CardTitle><CardAction><SparklesIcon /></CardAction></CardHeader><CardFooter>还有 {cities.length - litCities.length} 个计划目的地</CardFooter></Card>
      <Card><CardHeader><CardDescription>城市内点位</CardDescription><CardTitle>{selectedCity ? selectedPoints.length : points.length}<small> 个</small></CardTitle><CardAction><MapPinIcon /></CardAction></CardHeader><CardFooter>{selectedCity ? `${selectedCity.city}当前收录` : "全部城市合计"}</CardFooter></Card>
      <Card><CardHeader><CardDescription>毕业任务</CardDescription><CardTitle>{selectedCity ? completedTasks : tasks.filter((task) => task.status === "已毕业").length}<small> 条</small></CardTitle><CardAction><CheckCircle2Icon /></CardAction></CardHeader><CardFooter>{selectedCity && selectedTasks.length ? `${Math.round(completedTasks / selectedTasks.length * 100)}% 城市任务完成度` : "从已完成拍摄自动统计"}</CardFooter></Card>
    </div>

    <div className="footprintWorkspace">
      <div className="footprintMapColumn">
        <div className="footprintMapHeader">
          <div><Badge variant={mode === "world" ? "default" : "secondary"}>{mode === "world" ? "全球视图" : selectedCity?.city || "城市视图"}</Badge><strong>{mode === "world" ? "城市足迹与跨城轨迹" : "点位分布与城市轨迹"}</strong></div>
          {mode === "city" && <Select value={safeSelectedCityId} onValueChange={(value) => setSelectedCityId(value || "")}><SelectTrigger className="footprintCitySelect"><SelectValue placeholder="选择城市" /></SelectTrigger><SelectContent><SelectGroup>{cities.map((city) => <SelectItem key={city.id} value={city.id}>{city.city} · {city.countryName}</SelectItem>)}</SelectGroup></SelectContent></Select>}
        </div>
        <FootprintMap mode={mode} cities={cities} points={points} selectedCityId={safeSelectedCityId} onSelectCity={openCity} />
        <div className="footprintMapLegend"><span><i className="lit" />已点亮城市</span><span><i />计划前往</span><span><b />轨迹连线</span><small>{mode === "world" ? "跨城轨迹按到访日期排列" : "城市轨迹按点位录入顺序连接"}</small></div>
      </div>

      <aside className="footprintCityPanel">
        <div className="footprintCityPanelHeader"><div><strong>{mode === "world" ? "城市清单" : selectedCity?.city || "选择城市"}</strong><small>{mode === "world" ? `${cities.length} 个城市` : `${selectedPoints.length} 个点位 · ${selectedTasks.length} 条任务`}</small></div>{selectedCity && mode === "city" && <Button size="icon-sm" variant="ghost" onClick={() => beginEdit(selectedCity)} aria-label="编辑当前城市"><PencilIcon /></Button>}</div>
        {mode === "world" && <label className="footprintListSearch" htmlFor="footprint-city-filter"><ListFilterIcon /><Input id="footprint-city-filter" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="筛选国家或城市" /></label>}

        {mode === "world" ? <div className="footprintCityList">{filteredCities.map((city) => {
          const cityPointCount = points.filter((point) => cityKey(point) === cityKey(city)).length;
          return <Card key={city.id} className="footprintCityCard">
            <button type="button" className="footprintCityCardMain" onClick={() => openCity(city)}>
              <span className={city.status === "已点亮" ? "footprintCityOrb isLit" : "footprintCityOrb"}><MapPinIcon /></span>
              <span><strong>{city.city}</strong><small>{[city.countryName, city.admin1 !== city.city ? city.admin1 : ""].filter(Boolean).join(" · ")}</small><em>{cityPointCount} 个点位{city.visitedAt ? ` · ${city.visitedAt}` : ""}</em></span>
              <ChevronRightIcon />
            </button>
            <CardFooter><Badge variant={city.status === "已点亮" ? "default" : "outline"}>{city.status}</Badge><span><Button size="icon-sm" variant="ghost" onClick={() => beginEdit(city)} aria-label={`编辑${city.city}`}><PencilIcon /></Button><Button size="icon-sm" variant="ghost" onClick={() => setDeleteTarget(city)} aria-label={`删除${city.city}`}><Trash2Icon /></Button></span></CardFooter>
          </Card>;
        })}{!filteredCities.length && <Empty><EmptyHeader><EmptyMedia variant="icon"><EarthIcon /></EmptyMedia><EmptyTitle>没有匹配的城市</EmptyTitle><EmptyDescription>调整搜索词，或新增一个目的地。</EmptyDescription></EmptyHeader><EmptyContent><Button onClick={() => beginEdit()}><PlusIcon data-icon="inline-start" />新增城市</Button></EmptyContent></Empty>}</div> : selectedCity ? <div className="footprintCityDetail">
          <div className="footprintSelectedCity"><span className={selectedCity.status === "已点亮" ? "footprintCityOrb isLit" : "footprintCityOrb"}><MapPinIcon /></span><div><strong>{selectedCity.city}</strong><small>{[selectedCity.countryName, selectedCity.admin1].filter(Boolean).join(" · ")}</small></div><Badge variant={selectedCity.status === "已点亮" ? "default" : "outline"}>{selectedCity.status}</Badge></div>
          {selectedCity.note && <p className="footprintCityNote">{selectedCity.note}</p>}
          <div className="footprintCityFacts"><span><small>到访日期</small><strong>{selectedCity.visitedAt || "待记录"}</strong></span><span><small>当地时区</small><strong>{selectedCity.timezone}</strong></span></div>
          <div className="footprintPointList">{selectedPoints.map((point, index) => <button key={point.id} type="button" onClick={() => onOpenPoints(selectedCity)}><i>{String(index + 1).padStart(2, "0")}</i><span><strong>{point.location}</strong><small>{point.district}</small></span><ChevronRightIcon /></button>)}</div>
          {!selectedPoints.length && <Empty><EmptyHeader><EmptyMedia variant="icon"><MapPinIcon /></EmptyMedia><EmptyTitle>还没有城市点位</EmptyTitle><EmptyDescription>前往点位库新增点位，即可生成城市内轨迹。</EmptyDescription></EmptyHeader></Empty>}
          <Button className="footprintOpenPoints" variant="outline" onClick={() => onOpenPoints(selectedCity)}><MapPinIcon data-icon="inline-start" />在点位库查看该城市</Button>
        </div> : null}
      </aside>
    </div>

    {editorOpen && <CityEditor open city={editingCity} onOpenChange={setEditorOpen} onSave={saveCity} />}
    <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => { if (!open && !deleting) setDeleteTarget(null); }}>
      <AlertDialogContent>
        <AlertDialogHeader><AlertDialogTitle>删除“{deleteTarget?.city}”城市？</AlertDialogTitle><AlertDialogDescription>这会同时删除该城市下的 {deleteTarget ? points.filter((point) => cityKey(point) === cityKey(deleteTarget)).length : 0} 个点位及其全部拍摄任务。操作不可撤销。</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter><AlertDialogCancel disabled={deleting}>取消</AlertDialogCancel><AlertDialogAction variant="destructive" disabled={deleting} onClick={deleteCity}>{deleting && <Spinner data-icon="inline-start" />}{deleting ? "正在删除" : "确认删除"}</AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </section>;
}
