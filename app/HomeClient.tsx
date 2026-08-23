"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import sourceData from "./spots.json";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { toast as shadcnToast } from "@/components/ui/toast";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { DownloadIcon, FileDownIcon, FileUpIcon, ImagesIcon, LogOutIcon, MoonIcon, PencilIcon, PlusIcon, SunIcon, Trash2Icon } from "lucide-react";

type Status = "未拍摄" | "待补拍" | "已毕业";
type Priority = "低" | "中" | "高";
type ThemeCategory = string;
type View = "library" | "gallery" | "map" | "calendar" | "themes" | "coverage";
type CalendarEvent = { id:string; title:string; location:string; eventDate:string; startTime:string; endTime:string; createdAt?:number; updatedAt?:number };
type ThemeRecord = { id:string; name:string; createdAt?:number };
type Station = { id: string; name: string; description: string };
type PointRecord = { id:string; district:string; location:string; priority:Priority; longitude?:number; latitude?:number; coordinateSystem?:"wgs84"|"gcj02"; themeNames:string[]; stations:Station[] };
type Sample = { id: string; name: string; url: string };
type GallerySample = { id:string; url:string; uploadedAt:string; size?:number; taskId:string; district:string; location:string; theme:string; themeCategory?:string; device?:string; shootTime?:string; stationId:string; stationName:string; stationDescription:string; subjectDescription?:string; note:string; originalName:string; groupId?:string; local?:boolean };
type SampleDraft = Pick<GallerySample,"originalName"|"location"|"themeCategory"|"device"|"shootTime"|"stationId"|"stationName"|"stationDescription"|"subjectDescription"|"note">;
type UploadPart = { partNumber:number; etag:string };
type UploadJob = { jobId:string; file:File; taskId:string; district:string; location:string; theme:string; themeCategory:string; device:string; shootTime:string; stationId:string; stationName:string; stationDescription:string; note:string; originalName:string; uploadId?:string; objectId?:string; parts:UploadPart[]; status:"waiting"|"uploading"|"failed"; error?:string; createdAt:number };
type Task = {
  id:number; pointId?:string; district:string; location:string; priority:Priority; theme:string; themeCategory?:string; timeWindow?:string; stationIds?:string[]; methods:string[]; media:string[];
  clarity:string; status:Status; note:string; sourceRow:number; longitude?:number; latitude?:number;
  scheduleDate?:string; scheduleSlot?:string; stations?:Station[]; samples?:Sample[]; retakeReason?:string;
  missingShots?:string; graduationCriteria?:string; coordinateSystem?:"wgs84"|"gcj02";
};
type WeatherDay = { date:string; sunrise:string; sunset:string; cloud:number; precipitation:number; humidity:number; code:string; text:string; tempMin:number; tempMax:number };
type WeatherNow = { text:string; code:string; temperature:number; feelsLike:number; humidity:number; cloud:number; windScale:number; windSpeed:number; visibility:number; pressure:number };
type WeatherLocation = { id?:string; name:string; adm2?:string; adm1?:string; country?:string; latitude:number; longitude:number };
type RouteInfo = { distance:number; duration:number; geometry:[number,number][] };
type AstronomyData = { date:string; sunrise:string; sunset:string; dawn:string; dusk:string; moonrise:string; moonset:string; moonPhase:number; moonIllumination:number; source?:string };

const districtCenters:Record<string,[number,number]> = {
  渝中区:[106.555,29.557], 江北区:[106.574,29.606], 南岸区:[106.620,29.522], 沙坪坝区:[106.455,29.555],
  九龙坡区:[106.505,29.503], 大渡口区:[106.482,29.476], 渝北区:[106.630,29.718], 巴南区:[106.540,29.402]
};
const chongqingDistricts=["渝中区","江北区","南岸区","沙坪坝区","九龙坡区","大渡口区","渝北区","巴南区","北碚区","綦江区","大足区","璧山区","铜梁区","潼南区","荣昌区","开州区","梁平区","武隆区","万州区","涪陵区","黔江区","长寿区","江津区","合川区","永川区","南川区","城口县","丰都县","垫江县","忠县","云阳县","奉节县","巫山县","巫溪县","石柱土家族自治县","秀山土家族苗族自治县","酉阳土家族苗族自治县","彭水苗族土家族自治县"];
const priorityRank:Record<Priority,number>={高:3,中:2,低:1};
const statuses:Status[]=["未拍摄","待补拍","已毕业"];
const defaultThemeCategories:ThemeCategory[]=["雨天","朝霞","晚霞","日月对齐","轨道交通","桥梁","寺庙","彩虹","雷电","立交"];
const currentMonth=()=>{const date=new Date();return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}`};
const inferThemeCategory=(theme:string):string=>{
  const value=String(theme||"");
  if(/立交/.test(value))return "立交";
  if(/彩虹/.test(value))return "彩虹";
  if(/朝霞|日出/.test(value))return "朝霞";
  if(/晚霞|日落/.test(value))return "晚霞";
  if(/地铁|轨道|轻轨/.test(value))return "轨道交通";
  if(/桥梁|大桥|桥/.test(value))return "桥梁";
  if(/雨天|雨景|下雨|雨/.test(value))return "雨天";
  return "";
};
const sampleApi=typeof window!=="undefined"&&window.location.hostname.endsWith("github.io")?"https://shancheng-photo-atlas.ahaclassmate.chatgpt.site/api/samples":"/api/samples";
const assetBase=import.meta.env.BASE_URL||"/";
let amapPromise:Promise<any>|null=null;
async function loadAMap(){if((window as any).AMap)return (window as any).AMap;if(amapPromise)return amapPromise;amapPromise=(async()=>{const response=await fetch("/api/amap-config",{cache:"no-store"});const config=await response.json();if(!response.ok||!config.key)throw new Error(config.error||"高德地图未配置");(window as any)._AMapSecurityConfig={serviceHost:`${window.location.origin}/api/amap/_AMapService`};await new Promise<void>((resolve,reject)=>{const script=document.createElement("script");script.src=`https://webapi.amap.com/maps?v=2.0&key=${encodeURIComponent(config.key)}&plugin=AMap.Scale,AMap.ToolBar`;script.onload=()=>resolve();script.onerror=()=>reject(new Error("高德地图加载失败"));document.head.appendChild(script)});return (window as any).AMap})();return amapPromise}
async function ensureAdmin(){
  try{
    const current=await fetch("/api/admin",{cache:"no-store"});
    const status=await current.json().catch(()=>({}));
    if(current.ok&&status.valid===true){localStorage.removeItem("sample-admin-key");return true}
    localStorage.removeItem("sample-admin-key");
    const key=prompt("请输入管理密钥。验证成功后 30 天内无需再次输入。")||"";
    if(!key)return false;
    const response=await fetch("/api/admin",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({key})});
    const verified=await response.json().catch(()=>({}));
    if(response.ok&&verified.valid===true)return true;
    alert("管理密钥不正确");
  }catch{alert("暂时无法验证管理权限，请稍后重试")}
  return false;
}
const inferTimeWindow=(value:string)=>/日出蓝调|晨间蓝调/.test(value)?"日出蓝调":/日落蓝调|晚间蓝调/.test(value)?"日落蓝调":/日出|朝霞/.test(value)?"日出":/日落|晚霞/.test(value)?"日落":/夜景|夜拍|夜/.test(value)?"夜景":"自定义";
const normalizeTask=(t:Task):Task=>({...t,themeCategory:t.themeCategory==="地铁"?"轨道交通":t.themeCategory||inferThemeCategory(t.theme),timeWindow:t.timeWindow||inferTimeWindow(t.theme),stations:t.stations||[],stationIds:t.stationIds||t.stations?.map(station=>station.id)||[],samples:t.samples||[],graduationCriteria:t.graduationCriteria||""});
const normalizeThemeName=(value:string)=>String(value||"").trim().replace(/^地铁$/,"轨道交通").replace(/^大桥$/,"桥梁").replace(/^立交桥$/,"立交").replace(/^太阳月亮同框$/,"日月对齐");
const pointIdentity=(district:string,location:string)=>`point:${district.trim()}::${location.trim()}`;
const migrateWorkspace=(source:Task[])=>{const normalized=source.map(normalizeTask);const keys=[...new Set(normalized.map(task=>`${task.district}::${task.location}`))];const points:PointRecord[]=keys.map(key=>{const items=normalized.filter(task=>`${task.district}::${task.location}`===key);const first=items[0];const stations=[...new Map(items.flatMap(task=>task.stations||[]).map(station=>[station.id||station.name,station])).values()];const themeNames=[...new Set(items.map(task=>normalizeThemeName(task.themeCategory||inferThemeCategory(task.theme))).filter(Boolean))];return{id:first.pointId||pointIdentity(first.district,first.location),district:first.district,location:first.location,priority:[...items].sort((a,b)=>priorityRank[b.priority]-priorityRank[a.priority])[0].priority,longitude:first.longitude,latitude:first.latitude,coordinateSystem:first.coordinateSystem,themeNames,stations}});const pointByKey=new Map(points.map(point=>[`${point.district}::${point.location}`,point]));const tasks=normalized.map(task=>{const point=pointByKey.get(`${task.district}::${task.location}`)!;return{...task,pointId:point.id,stationIds:task.stationIds?.length?task.stationIds:point.stations.map(station=>station.id)}});return{points,tasks}};
const baseWorkspace=migrateWorkspace(sourceData as unknown as Task[]);
const baseTasks=baseWorkspace.tasks;
const split=(v:unknown)=>String(v||"").split(/[，,、;；]/).map(x=>x.trim()).filter(Boolean);
const n=(v:unknown)=>{if(v===""||v===null||v===undefined)return undefined;const x=Number(v);return Number.isFinite(x)?x:undefined};
const supportedUploadTypes=new Set(["image/jpeg","image/png","image/webp","image/gif","image/avif"]);
const shootTimes=["日出","日落","日出蓝调","日落蓝调","夜景"];
const uploadLimitBytes=4*1024*1024;
const uploadTargetBytes=4*1024*1024-64*1024;
async function compressForUpload(source:File){
  if(source.size<=uploadLimitBytes)return source;
  let bitmap:ImageBitmap;
  try{bitmap=await createImageBitmap(source)}catch{throw new Error(`${source.name} 无法压缩，请先转换为 JPG 后重试`)}
  try{
    let scale=Math.min(1,5000/Math.max(bitmap.width,bitmap.height));
    let result:Blob|null=null;
    for(let resize=0;resize<6;resize++){
      const canvas=document.createElement("canvas");canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
      const context=canvas.getContext("2d");if(!context)throw new Error("浏览器无法处理图片");context.fillStyle="#fff";context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(bitmap,0,0,canvas.width,canvas.height);
      for(const quality of [.9,.82,.74,.66,.58,.5]){result=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,"image/jpeg",quality));if(result&&result.size<=uploadTargetBytes)break}
      if(result&&result.size<=uploadTargetBytes)break;
      scale*=.78;
    }
    if(!result||result.size>uploadTargetBytes)throw new Error(`${source.name} 压缩后仍超过 4MB`);
    return new File([result],`${source.name.replace(/\.[^.]+$/,"")}.jpg`,{type:"image/jpeg",lastModified:source.lastModified});
  }finally{bitmap.close()}
}
const uploadDb=()=>new Promise<IDBDatabase>((resolve,reject)=>{const request=indexedDB.open("shancheng-upload-queue",1);request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains("jobs"))request.result.createObjectStore("jobs",{keyPath:"jobId"})};request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)});
async function uploadJobs(){const db=await uploadDb();return new Promise<UploadJob[]>((resolve,reject)=>{const request=db.transaction("jobs","readonly").objectStore("jobs").getAll();request.onsuccess=()=>resolve(request.result as UploadJob[]);request.onerror=()=>reject(request.error)})}
async function saveUploadJob(job:UploadJob){const db=await uploadDb();return new Promise<void>((resolve,reject)=>{const request=db.transaction("jobs","readwrite").objectStore("jobs").put(job);request.onsuccess=()=>resolve();request.onerror=()=>reject(request.error)})}
async function deleteUploadJob(jobId:string){const db=await uploadDb();return new Promise<void>((resolve,reject)=>{const request=db.transaction("jobs","readwrite").objectStore("jobs").delete(jobId);request.onsuccess=()=>resolve();request.onerror=()=>reject(request.error)})}
const coord=(t:Task):[number,number]=>{
  if(t.latitude&&t.longitude)return[t.latitude,t.longitude];
  const c=districtCenters[t.district]||[29.563,106.551]; let h=0; for(const ch of t.location)h=(h*31+ch.charCodeAt(0))|0;
  return [c[1]+((h%19)-9)/1800,c[0]+(((h>>4)%19)-9)/1800];
};
const group=(points:PointRecord[],tasks:Task[])=>points.map(point=>{const items=tasks.filter(task=>task.pointId===point.id);const state:Status=items.length&&items.every(task=>task.status==="已毕业")?"已毕业":items.some(task=>task.status==="待补拍")?"待补拍":"未拍摄";return{key:point.id,point,district:point.district,location:point.location,tasks:items,status:state,priority:point.priority,themeNames:point.themeNames,stations:point.stations}});

type MapSearchResult={name:string;address:string;district:string;longitude:number;latitude:number};
function PointMapPicker({longitude,latitude,district,onPick}:{longitude?:number;latitude?:number;district?:string;onPick:(value:{longitude:number;latitude:number;district?:string})=>void}){
  const el=useRef<HTMLDivElement>(null);const map=useRef<any>(null);const marker=useRef<any>(null);const onPickRef=useRef(onPick);const [ready,setReady]=useState(false);const [message,setMessage]=useState("搜索地点，或点击地图选择点位");const [query,setQuery]=useState("");const [searching,setSearching]=useState(false);const [results,setResults]=useState<MapSearchResult[]>([]);
  onPickRef.current=onPick;
  function placePoint(point:{longitude:number;latitude:number;district?:string},zoom=17){const AMap=(window as any).AMap;if(!map.current||!AMap)return;if(marker.current)marker.current.setPosition([point.longitude,point.latitude]);else{marker.current=new AMap.Marker({position:[point.longitude,point.latitude],anchor:"bottom-center"});map.current.add(marker.current)}map.current.setZoomAndCenter(zoom,[point.longitude,point.latitude]);onPickRef.current(point)}
  async function searchPlace(){const keyword=query.trim();if(!keyword||searching)return;setSearching(true);setResults([]);setMessage("正在搜索地点…");try{const response=await fetch("/api/amap-locate",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"search",query:keyword,district})});const data=await response.json();if(!response.ok)throw new Error(data.error||"地点搜索失败");const items=(data.items||[]) as MapSearchResult[];setResults(items);setMessage(items.length?`找到 ${items.length} 个候选地点，请选择后在地图上微调`:`没有找到“${keyword}”，请改搜附近商场、道路或地标，再点击地图微调`)}catch(reason){setMessage(reason instanceof Error?reason.message:"地点搜索失败，请改搜附近地标")}finally{setSearching(false)}}
  function chooseResult(item:MapSearchResult){placePoint(item);setResults([]);setMessage(`${item.name}${item.address?` · ${item.address}`:""}；可继续点击地图微调`)}
  useEffect(()=>{let active=true;(async()=>{try{const AMap=await loadAMap();if(!active||!el.current)return;const center=longitude&&latitude?[longitude,latitude]:[106.551,29.563];map.current=new AMap.Map(el.current,{viewMode:"2D",zoom:longitude&&latitude?16:12,center});map.current.addControl(new AMap.Scale());map.current.on("click",async(event:any)=>{const point={longitude:Number(event.lnglat.getLng()),latitude:Number(event.lnglat.getLat())};placePoint(point);setResults([]);setMessage("正在识别行政区域…");try{const response=await fetch("/api/amap-locate",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"reverse",...point})});const data=await response.json();if(response.ok){onPickRef.current({...point,district:data.district||undefined});setMessage(`${data.formattedAddress||"已关联地图坐标"}；可继续点击微调`)}else setMessage(data.error||"坐标已选择，区域识别失败")}catch{setMessage("坐标已选择，区域识别失败")}});setReady(true)}catch{if(active)setMessage("地图暂时无法加载，请手动填写经纬度")}})();return()=>{active=false;map.current?.destroy();map.current=null;marker.current=null}},[]);
  useEffect(()=>{if(!ready||!map.current||!longitude||!latitude)return;const AMap=(window as any).AMap;if(marker.current)marker.current.setPosition([longitude,latitude]);else{marker.current=new AMap.Marker({position:[longitude,latitude],anchor:"bottom-center"});map.current.add(marker.current)}map.current.setZoomAndCenter(16,[longitude,latitude])},[ready,longitude,latitude]);
  return <div className="pointMapField"><div ref={el} className="pointMapPicker"/><div className="pointMapSearch"><input value={query} onChange={event=>setQuery(event.target.value)} onKeyDown={event=>{if(event.key==="Enter"){event.preventDefault();searchPlace()}}} placeholder="搜索点位、道路、建筑或附近地标" aria-label="搜索地图地点"/><button type="button" disabled={searching||!query.trim()} onClick={searchPlace}>{searching?"搜索中":"搜索"}</button>{results.length>0&&<div className="pointMapResults">{results.map((item,index)=><button type="button" key={`${item.longitude}-${item.latitude}-${index}`} onClick={()=>chooseResult(item)}><strong>{item.name}</strong><small>{item.district}{item.address?` · ${item.address}`:""}</small></button>)}</div>}</div><div className="pointMapHint"><span>⌖</span><strong>{message}</strong><small>{longitude&&latitude?"已确定地图位置，可继续点击微调":"选择后将自动关联地图位置与行政区域"}</small></div></div>
}

function MapCanvas({tasks,route,onPick}:{tasks:Task[];route:RouteInfo|null;onPick:(t:Task)=>void}){
  const el=useRef<HTMLDivElement>(null);const map=useRef<any>(null);const defaultViewSet=useRef(false);const [ready,setReady]=useState(false);const [mapError,setMapError]=useState("");
  useEffect(()=>{let active=true;(async()=>{try{const AMap=await loadAMap();if(!active||!el.current)return;map.current=new AMap.Map(el.current,{viewMode:"3D",zoom:13,center:[106.551,29.563],mapStyle:"amap://styles/normal"});map.current.addControl(new AMap.Scale());map.current.addControl(new AMap.ToolBar({position:{top:"16px",right:"16px"}}));setReady(true)}catch(reason){if(active)setMapError(reason instanceof Error?reason.message:"高德地图加载失败")}})();return()=>{active=false;map.current?.destroy();map.current=null}},[]);
  useEffect(()=>{if(!ready||!map.current)return;const AMap=(window as any).AMap;map.current.clearMap();tasks.forEach(t=>{const [lat,lng]=t.latitude&&t.longitude?[t.latitude,t.longitude]:coord(t);const color=t.status==="已毕业"?"#3e7b61":t.status==="待补拍"?"#d99434":"#e86632";const marker=new AMap.Marker({position:[lng,lat],anchor:"center",title:`${t.location} · ${t.theme}`,content:`<span class="amapSpot" style="--marker:${color}"></span>`});marker.on("click",()=>onPick(t));map.current.add(marker)});if(route?.geometry.length){const line=new AMap.Polyline({path:route.geometry.map(([lat,lng])=>[lng,lat]),strokeColor:"#e86632",strokeWeight:5,strokeOpacity:.9,showDir:true});map.current.add(line);map.current.setFitView([line],false,[45,45,45,45],13)}else if(!defaultViewSet.current){map.current.setZoomAndCenter(13,[106.551,29.563]);defaultViewSet.current=true}},[tasks,route,onPick,ready]);
  return <div ref={el} className="realMap">{mapError&&<div className="mapLoadError">{mapError}</div>}</div>;
}

const serviceBase=typeof window!=="undefined"&&window.location.hostname.endsWith("github.io")?"https://shancheng-photo-atlas.ahaclassmate.chatgpt.site":"";
const astronomyApi=`${serviceBase}/api/astronomy`;
const weatherApi=`${serviceBase}/api/weather`;
const weatherSymbol=(code:string)=>{const value=Number(code);return value>=400&&value<500?"❄️":value>=300&&value<400?"🌧️":value>=500?"🌫️":value===100?"☀️":value>=101&&value<=104?"⛅":"🌤️"};
const moonLabel=(phase:number)=>phase<22.5||phase>=337.5?"新月":phase<67.5?"蛾眉月":phase<112.5?"上弦月":phase<157.5?"盈凸月":phase<202.5?"满月":phase<247.5?"亏凸月":phase<292.5?"下弦月":"残月";
const moonSymbol=(phase:number)=>phase<22.5||phase>=337.5?"🌑":phase<67.5?"🌒":phase<112.5?"🌓":phase<157.5?"🌔":phase<202.5?"🌕":phase<247.5?"🌖":phase<292.5?"🌗":"🌘";
const lunarDate=(date:Date)=>{try{return new Intl.DateTimeFormat("zh-CN-u-ca-chinese",{month:"long",day:"numeric"}).format(date).replace(/\s/g,"")}catch{return "农历日期暂不可用"}};
function AstronomyHero(){
  const [now,setNow]=useState(()=>new Date());const [data,setData]=useState<AstronomyData|null>(null);const [failed,setFailed]=useState(false);
  const dateKey=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
  useEffect(()=>{const timer=window.setInterval(()=>setNow(new Date()),1000);return()=>window.clearInterval(timer)},[]);
  useEffect(()=>{let active=true;setFailed(false);fetch(`${astronomyApi}?date=${dateKey}`).then(response=>{if(!response.ok)throw new Error();return response.json()}).then(value=>{if(active)setData(value)}).catch(()=>{if(active)setFailed(true)});return()=>{active=false}},[dateKey]);
  const phase=data?.moonPhase??0;const events=[{label:"月出",time:data?.moonrise,color:"moon"},{label:"晨间蓝调",time:data?.dawn,color:"blue"},{label:"日出",time:data?.sunrise,color:"sun"},{label:"月落",time:data?.moonset,color:"moon"},{label:"日落",time:data?.sunset,color:"sun"},{label:"晚间蓝调",time:data?.dusk,color:"blue"}];
  return <section className="astronomyHero" aria-label="今日天象与拍摄时间窗口">
    <div className="astroLead"><span className="astroLocation">重庆市 · 今日光线窗口</span><strong>{now.toLocaleTimeString("zh-CN",{hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:false})}</strong><p>{now.toLocaleDateString("zh-CN",{year:"numeric",month:"long",day:"numeric",weekday:"long"})}</p><small>{lunarDate(now)}</small></div>
    <div className="astroMoon"><span className="moonGlyph" aria-hidden="true">{moonSymbol(phase)}</span><div><strong>{Math.round(data?.moonIllumination??0)}%</strong><span>{moonLabel(phase)}</span></div></div>
    <div className="astroTimeline">{events.map(event=><div className={`astroEvent astro-${event.color}`} key={event.label}><i/><small>{event.label}</small><strong>{event.time||"--:--"}</strong></div>)}</div>
    <div className="astroFoot"><span>● 太阳轨迹</span><span>● 月亮轨迹</span>{failed&&<em>天象数据暂未更新，稍后将自动重试</em>}</div>
  </section>
}

function CurrentWeatherCard(){
  const fallback:WeatherLocation={name:"重庆市",adm2:"重庆",latitude:29.563,longitude:106.5516};
  const [location,setLocation]=useState<WeatherLocation>(fallback);const [weather,setWeather]=useState<WeatherNow|null>(null);const [loading,setLoading]=useState(true);const [message,setMessage]=useState("");
  const [searchOpen,setSearchOpen]=useState(false);const [query,setQuery]=useState("");const [results,setResults]=useState<WeatherLocation[]>([]);const [searching,setSearching]=useState(false);
  async function load(next:WeatherLocation){setLoading(true);setMessage("");try{const response=await fetch(`${weatherApi}?lat=${next.latitude}&lon=${next.longitude}`,{cache:"no-store"});const data=await response.json();if(!response.ok||!data.current)throw new Error(data.error||"实时天气暂不可用");setLocation(next);setWeather(data.current);localStorage.setItem("shancheng-weather-location",JSON.stringify(next))}catch(reason){setMessage(reason instanceof Error?reason.message:"实时天气暂不可用")}finally{setLoading(false)}}
  async function useCurrentLocation(){if(!navigator.geolocation){setMessage("当前浏览器不支持定位");return}setLoading(true);setMessage("");navigator.geolocation.getCurrentPosition(async position=>{const coordinates={latitude:position.coords.latitude,longitude:position.coords.longitude};let next:WeatherLocation={...coordinates,name:"当前位置"};try{const lookup=await fetch(`${weatherApi}?mode=search&query=${encodeURIComponent(`${coordinates.longitude},${coordinates.latitude}`)}`).then(response=>response.json());if(lookup.locations?.[0])next=lookup.locations[0]}catch{}await load(next)},()=>{setLoading(false);setMessage("无法读取当前位置，可搜索城市切换")},{enableHighAccuracy:false,timeout:8000,maximumAge:600000})}
  async function search(event:React.FormEvent){event.preventDefault();const keyword=query.trim();if(!keyword)return;setSearching(true);setMessage("");try{const response=await fetch(`${weatherApi}?mode=search&query=${encodeURIComponent(keyword)}`,{cache:"no-store"});const data=await response.json();if(!response.ok)throw new Error(data.error||"地点搜索失败");setResults(data.locations||[]);if(!data.locations?.length)setMessage("没有找到这个地点") }catch(reason){setMessage(reason instanceof Error?reason.message:"地点搜索失败")}finally{setSearching(false)}}
  useEffect(()=>{let saved:WeatherLocation|undefined;try{saved=JSON.parse(localStorage.getItem("shancheng-weather-location")||"")}catch{}if(saved?.latitude&&saved?.longitude)load(saved);else useCurrentLocation()},[]);
  return <section className="currentWeather" aria-label="当前地点实时天气">
    <div className="currentWeatherMain"><span className="currentWeatherIcon" aria-hidden="true">{weatherSymbol(weather?.code||"")}</span><div><small>{location.name}{location.adm2&&location.adm2!==location.name?` · ${location.adm2}`:""}</small>{loading?<strong className="weatherPulse">读取天气…</strong>:weather?<strong>{weather.temperature}° <i>{weather.text}</i></strong>:<strong>天气未更新</strong>}<p>{weather?`体感 ${weather.feelsLike}° · 湿度 ${weather.humidity}% · ${weather.windScale}级风 · 能见度 ${weather.visibility}km`:message||"使用定位或搜索城市"}</p></div></div>
    <div className="currentWeatherActions"><button type="button" onClick={useCurrentLocation}>⌖ 当前位置</button><button type="button" onClick={()=>{setSearchOpen(value=>!value);setResults([])}}>切换地点</button></div>
    {searchOpen&&<form className="weatherSearch" onSubmit={search}><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="搜索城市或区县" aria-label="搜索天气地点"/><button disabled={searching||!query.trim()}>{searching?"搜索中":"搜索"}</button>{results.length>0&&<div className="weatherSearchResults">{results.map(item=><button type="button" key={`${item.id}-${item.latitude}`} onClick={()=>{load(item);setSearchOpen(false);setResults([]);setQuery("")}}><strong>{item.name}</strong><small>{[item.adm2,item.adm1].filter(Boolean).join(" · ")}</small></button>)}</div>}</form>}
    {message&&<em>{message}</em>}<a href="https://www.qweather.com/" target="_blank" rel="noreferrer">数据来源：和风天气</a>
  </section>
}

function OverviewStats({pointCount,districtCount,counts,scheduleCount,coordinateCount}:{pointCount:number;districtCount:number;counts:{unshot:number;redo:number;done:number};scheduleCount:number;coordinateCount:number}){
  return <section className="stats">
    <article><span className="statIcon orange">⌖</span><div><small>独立点位</small><strong>{pointCount}<i>个</i></strong><em>覆盖 {districtCount} 个区域</em></div></article>
    <article><span className="statIcon blue">◷</span><div><small>未拍摄任务</small><strong>{counts.unshot}<i>条</i></strong><em>优先安排高优任务</em></div></article>
    <article><span className="statIcon amber">↻</span><div><small>待补拍 / 已毕业</small><strong>{counts.redo}<i> / {counts.done}</i></strong><em>可追踪缺失镜头</em></div></article>
    <article><span className="statIcon green">◉</span><div><small>已安排日程</small><strong>{scheduleCount}<i>条</i></strong><em>{coordinateCount} 条含精确坐标</em></div></article>
  </section>
}

export default function Home(){
  const [points,setPoints]=useState<PointRecord[]>(baseWorkspace.points); const [tasks,setTasks]=useState<Task[]>(baseTasks); const [hydrated,setHydrated]=useState(false); const [view,setView]=useState<View>("library");
  const [themeMode,setThemeMode]=useState<"light"|"dark">("dark");
  const [district,setDistrict]=useState("全部行政区"); const [status,setStatus]=useState("全部状态"); const [priority,setPriority]=useState("全部优先级"); const [category,setCategory]=useState("全部归类"); const [query,setQuery]=useState("");
  const [expanded,setExpanded]=useState<string|null>(null); const [pointEditOnOpen,setPointEditOnOpen]=useState(false); const [editing,setEditing]=useState<number|null>(null); const [mapTask,setMapTask]=useState<number|null>(null);
  const [routeIds,setRouteIds]=useState<number[]>([]); const [route,setRoute]=useState<RouteInfo|null>(null); const [routeLoading,setRouteLoading]=useState(false); const [amapLocating,setAmapLocating]=useState(false); const amapSyncing=useRef(false);
  const [weather,setWeather]=useState<WeatherDay[]>([]); const [weatherLoading,setWeatherLoading]=useState(false); const [weatherError,setWeatherError]=useState(""); const [month,setMonth]=useState(currentMonth);
  const [calendarEvents,setCalendarEvents]=useState<CalendarEvent[]>([]);
  const [themeRecords,setThemeRecords]=useState<ThemeRecord[]>(()=>defaultThemeCategories.map((name,index)=>({id:`fallback-${index}`,name})));
  const themeCategories=themeRecords.map(record=>record.name);
  const inputRef=useRef<HTMLInputElement>(null);
  useEffect(()=>{try{const savedWorkspace=localStorage.getItem("shancheng-photo-workspace-v3");if(savedWorkspace){const parsed=JSON.parse(savedWorkspace) as {points:PointRecord[];tasks:Task[]};if(Array.isArray(parsed.points)&&Array.isArray(parsed.tasks)){setPoints(parsed.points.map(point=>({...point,themeNames:point.themeNames||[],stations:point.stations||[]})));setTasks(parsed.tasks.map(normalizeTask))}}else{const legacy=localStorage.getItem("shancheng-photo-tasks-v2")||localStorage.getItem("shancheng-photo-tasks-v1");if(legacy){const migrated=migrateWorkspace(JSON.parse(legacy) as Task[]);setPoints(migrated.points);setTasks(migrated.tasks)}}}catch{}setThemeMode(document.documentElement.dataset.theme==="dark"?"dark":"light");setHydrated(true)},[]);
  useEffect(()=>{if(hydrated)localStorage.setItem("shancheng-photo-workspace-v3",JSON.stringify({points,tasks}))},[points,tasks,hydrated]);
  useEffect(()=>{(async()=>{try{const response=await fetch("/api/planner",{cache:"no-store"});if(!response.ok)throw new Error();const data=await response.json();setCalendarEvents(Array.isArray(data.events)?data.events:[]);if(Array.isArray(data.themes)&&data.themes.length)setThemeRecords(data.themes)}catch{}})()},[]);
  useEffect(()=>{if(view==="map")locateAllPoints()},[view]);
  const taskViews=useMemo(()=>tasks.map(task=>{const point=points.find(item=>item.id===task.pointId);return point?{...task,district:point.district,location:point.location,longitude:point.longitude,latitude:point.latitude,coordinateSystem:point.coordinateSystem,stations:point.stations}:task}),[tasks,points]);
  const groups=useMemo(()=>group(points,taskViews),[points,taskViews]); const districts=useMemo(()=>[...new Set(points.map(point=>point.district))],[points]); const availableDistricts=useMemo(()=>[...new Set([...chongqingDistricts,...districts])],[districts]); const activeGroup=groups.find(item=>item.key===expanded);
  const filtered=useMemo(()=>groups.filter(g=>(district==="全部行政区"||g.district===district)&&(status==="全部状态"||g.status===status)&&(priority==="全部优先级"||g.priority===priority)&&(category==="全部归类"||g.themeNames.includes(category))&&`${g.location} ${g.district} ${g.themeNames.join(" ")} ${g.tasks.map(t=>`${t.timeWindow||""} ${t.theme} ${t.methods} ${t.note}`).join(" ")}`.toLowerCase().includes(query.toLowerCase())).sort((a,b)=>priorityRank[b.priority]-priorityRank[a.priority]),[groups,district,status,priority,category,query]);
  const counts={unshot:tasks.filter(t=>t.status==="未拍摄").length,redo:tasks.filter(t=>t.status==="待补拍").length,done:tasks.filter(t=>t.status==="已毕业").length};
  const mappedTasks=groups.map((groupItem,index)=>groupItem.tasks[0]||({id:-(index+1),pointId:groupItem.point.id,district:groupItem.district,location:groupItem.location,priority:groupItem.priority,theme:"待创建拍摄任务",timeWindow:"自定义",methods:[],media:[],clarity:"低",status:"未拍摄",note:"",sourceRow:0,longitude:groupItem.point.longitude,latitude:groupItem.point.latitude,coordinateSystem:groupItem.point.coordinateSystem,stations:groupItem.stations,samples:[]} as Task));
  const selected=taskViews.find(t=>t.id===(editing??mapTask)); const selectedMapTask=mapTask===null?undefined:mappedTasks.find(t=>t.id===mapTask);
  useEffect(()=>{if(view==="map"&&mapTask===null&&mappedTasks.length)loadWeather(mappedTasks[0])},[view,mapTask]);
  const update=(id:number,patch:Partial<Task>)=>{const current=tasks.find(task=>task.id===id);if(!current)return;const {stations,...taskPatch}=patch;if(stations){const valid=new Set(stations.map(station=>station.id));setPoints(items=>items.map(point=>point.id===current.pointId?{...point,stations}:point));setTasks(items=>items.map(task=>task.pointId===current.pointId?{...task,stationIds:(task.stationIds||[]).filter(stationId=>valid.has(stationId)),...(task.id===id?taskPatch:{})}:task))}else setTasks(items=>items.map(task=>task.id===id?{...task,...taskPatch}:task))};

  async function importExcel(file:File){
    if(!(await ensureAdmin()))return;
    const wb=XLSX.read(await file.arrayBuffer(),{type:"array",cellDates:true}); const ws=wb.Sheets[wb.SheetNames[0]]; const rows=XLSX.utils.sheet_to_json<Record<string,unknown>>(ws,{defval:""}); let lastDistrict="",lastLocation="";const creativeThemes=new Map<string,Set<string>>();
    const imported:Task[]=rows.map((r,i)=>{lastDistrict=String(r["行政区域"]||lastDistrict).trim();lastLocation=String(r["点位名称"]||lastLocation).trim();const districtName=lastDistrict||"待分类";const locationName=lastLocation||`未命名点位 ${i+1}`;const station=String(r["机位名称"]||r["关联机位"]||"").trim();const theme=String(r["拍摄任务"]||r["拍摄主题"]||"常规记录");const themeNames=split(r["创作主题"]||r["主题归类"]).map(normalizeThemeName);const pointKey=`${districtName}::${locationName}`;creativeThemes.set(pointKey,new Set([...(creativeThemes.get(pointKey)||[]),...themeNames]));const longitude=n(r["经度"]),latitude=n(r["纬度"]);const coordinateSystem:Task["coordinateSystem"]=longitude&&latitude?(String(r["坐标系"]||"").toLowerCase()==="gcj02"?"gcj02":"wgs84"):undefined;return {id:i+1,district:districtName,location:locationName,priority:(["高","中","低"].includes(String(r["点位优先级"]||r["优先级"]))?String(r["点位优先级"]||r["优先级"]):"低") as Priority,theme,timeWindow:String(r["拍摄时间"]||"")||inferTimeWindow(theme),themeCategory:themeNames[0]||"",methods:split(r["拍摄方式"]||"待规划"),media:split(r["素材类型"]||"待规划"),clarity:String(r["通透度要求"]||"低"),status:(statuses.includes(String(r["拍摄状态"]) as Status)?String(r["拍摄状态"]):"未拍摄") as Status,note:String(r["备注"]||""),sourceRow:i+2,longitude,latitude,coordinateSystem,scheduleDate:r["计划日期"] instanceof Date?(r["计划日期"] as Date).toISOString().slice(0,10):String(r["计划日期"]||""),scheduleSlot:String(r["计划时段"]||""),stations:station?[{id:`s-${i}`,name:station,description:String(r["机位说明"]||"")}]:[],samples:String(r["样片链接"]||"").trim()?[{id:`p-${i}`,name:"Excel 样片",url:String(r["样片链接"])}]:[],retakeReason:String(r["补拍原因"]||""),missingShots:String(r["缺失镜头"]||""),graduationCriteria:String(r["毕业标准"]||"")};}).filter(t=>t.location);
    if(imported.length&&confirm(`识别到 ${imported.length} 条任务，替换当前数据吗？`)){const migrated=migrateWorkspace(imported);setPoints(migrated.points.map(point=>{const names=[...(creativeThemes.get(`${point.district}::${point.location}`)||[])];return names.length?{...point,themeNames:names}:point}));setTasks(migrated.tasks);setView("library");}
  }
  function exportExcel(){const rows=taskViews.map(t=>{const point=points.find(item=>item.id===t.pointId);return{行政区域:t.district,点位名称:t.location,点位优先级:point?.priority||t.priority,拍摄任务:t.theme,拍摄时间:t.timeWindow||"自定义",创作主题:(point?.themeNames||[]).join("、"),拍摄方式:t.methods.join("、"),素材类型:t.media.join("、"),通透度要求:t.clarity,拍摄状态:t.status,计划日期:t.scheduleDate||"",计划时段:t.scheduleSlot||"",关联机位:(t.stationIds||[]).map(id=>point?.stations.find(station=>station.id===id)?.name).filter(Boolean).join("、"),全部机位:(point?.stations||[]).map(station=>station.name).join("、"),补拍原因:t.retakeReason||"",缺失镜头:t.missingShots||"",毕业标准:t.graduationCriteria||"",样片链接:(t.samples||[]).map(s=>s.url.startsWith("data:")?"本地样片":s.url).join("、"),备注:t.note}});const ws=XLSX.utils.json_to_sheet(rows);const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,"规范化点位数据");XLSX.writeFile(wb,`重庆拍摄点位_${new Date().toISOString().slice(0,10)}.xlsx`)}
  async function loadWeather(t:Task){setMapTask(t.id);setWeatherLoading(true);setWeatherError("");const [lat,lon]=coord(t);try{const response=await fetch(`${weatherApi}?lat=${lat}&lon=${lon}`,{cache:"no-store"});const data=await response.json();if(!response.ok)throw new Error(data.error||"天气读取失败");setWeather(Array.isArray(data.days)?data.days:[])}catch(reason){setWeather([]);setWeatherError(reason instanceof Error?reason.message:"天气读取失败，请稍后重试")}finally{setWeatherLoading(false)}}
  async function locateAllPoints(){if(amapSyncing.current)return;const missing=points.filter(point=>!point.longitude||!point.latitude);const gps=points.filter(point=>point.longitude&&point.latitude&&point.coordinateSystem!=="gcj02");if(!missing.length&&!gps.length)return;amapSyncing.current=true;setAmapLocating(true);try{const updates=new Map<string,{longitude:number;latitude:number}>();for(let i=0;i<missing.length;i+=20){const batch=missing.slice(i,i+20);const response=await fetch("/api/amap-locate",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"locate",items:batch.map(point=>({key:point.id,district:point.district,location:point.location}))})});const data=await response.json();if(!response.ok)throw new Error(data.error||"点位解析失败");for(const item of data.items||[])if(item.longitude&&item.latitude)updates.set(item.key,{longitude:item.longitude,latitude:item.latitude})}for(let i=0;i<gps.length;i+=40){const batch=gps.slice(i,i+40);const response=await fetch("/api/amap-locate",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"convert",items:batch.map(point=>({key:point.id,longitude:point.longitude,latitude:point.latitude}))})});const data=await response.json();if(!response.ok)throw new Error(data.error||"坐标转换失败");for(const item of data.items||[])if(item.longitude&&item.latitude)updates.set(item.key,{longitude:item.longitude,latitude:item.latitude})}if(updates.size)setPoints(items=>items.map(point=>{const found=updates.get(point.id);return found?{...point,...found,coordinateSystem:"gcj02"}:point}))}catch(reason){alert(reason instanceof Error?reason.message:"暂时无法定位全部点位")}finally{setAmapLocating(false);amapSyncing.current=false}}
  async function planRoute(){const pts=routeIds.map(id=>taskViews.find(t=>t.id===id)).filter(Boolean) as Task[];if(pts.length<2)return;setRouteLoading(true);try{const response=await fetch("/api/amap-locate",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"route",locations:pts.map(task=>{const [latitude,longitude]=task.latitude&&task.longitude?[task.latitude,task.longitude]:coord(task);return[longitude,latitude]})})});const data=await response.json();setRoute(response.ok&&data.route?data.route:null)}catch{setRoute(null)}finally{setRouteLoading(false)}}
  function addStation(id:number){const task=tasks.find(item=>item.id===id);const point=points.find(item=>item.id===task?.pointId);if(!task||!point)return;const station={id:crypto.randomUUID(),name:`机位 ${point.stations.length+1}`,description:"待勘景"};setPoints(items=>items.map(item=>item.id===point.id?{...item,stations:[...item.stations,station]}:item));setTasks(items=>items.map(item=>item.id===id?{...item,stationIds:[...(item.stationIds||[]),station.id]}:item))}
  async function addSamples(id:number,files:FileList|null){if(!files)return;const t=tasks.find(x=>x.id===id);if(!t)return;const accepted=[...files].filter(f=>f.size<=1200000).slice(0,6-(t.samples?.length||0));const samples=await Promise.all(accepted.map(f=>new Promise<Sample>(resolve=>{const r=new FileReader();r.onload=()=>resolve({id:crypto.randomUUID(),name:f.name,url:String(r.result)});r.readAsDataURL(f)})));update(id,{samples:[...(t.samples||[]),...samples]})}
  async function openEditor(id:number){if(await ensureAdmin()){setEditing(id);return true}return false}
  async function changeStatus(t:Task){if(await ensureAdmin())update(t.id,{status:statuses[(statuses.indexOf(t.status)+1)%3]})}
  async function createPoint(){if(!(await ensureAdmin()))return;const id=crypto.randomUUID();const initialDistrict=district!=="全部行政区"?district:"渝中区";const point:PointRecord={id,district:initialDistrict,location:`新拍摄点位 ${points.length+1}`,priority:"低",themeNames:[],stations:[]};setPoints(items=>[point,...items]);setExpanded(id);setPointEditOnOpen(true);setView("library")}
  async function savePointGroup(groupItem:ReturnType<typeof group>[number],patch:{location:string;district:string;longitude?:number;latitude?:number},themeNames:string[],stations:Station[],taskWindows:string[]){if(!(await ensureAdmin()))return false;const pointId=groupItem.point.id;const validStationIds=new Set(stations.map(station=>station.id));setPoints(items=>items.map(point=>point.id===pointId?{...point,...patch,themeNames,stations,coordinateSystem:patch.longitude&&patch.latitude?"gcj02":point.coordinateSystem}:point));setTasks(items=>{const retained=items.map(task=>task.pointId===pointId?{...task,district:patch.district,location:patch.location,stations,stationIds:(task.stationIds||[]).filter(id=>validStationIds.has(id))}:task);const existing=new Set(retained.filter(task=>task.pointId===pointId).map(task=>task.timeWindow||inferTimeWindow(task.theme)));let nextId=Math.max(0,...retained.map(task=>task.id));const additions:Task[]=taskWindows.filter(window=>!existing.has(window)).map(window=>({id:++nextId,pointId,district:patch.district,location:patch.location,priority:"低",theme:window,timeWindow:window,themeCategory:"",methods:["待规划"],media:["照片"],clarity:"中",status:"未拍摄",note:"",sourceRow:0,stationIds:[],stations,samples:[]}));return [...additions,...retained]});setPointEditOnOpen(false);setExpanded(null);return true}
  async function removePointGroup(groupItem:ReturnType<typeof group>[number]){if(!confirm(`删除“${groupItem.location}”点位、${groupItem.tasks.length} 个拍摄任务及全部机位？此操作无法撤销。`)||!(await ensureAdmin()))return;setPoints(items=>items.filter(point=>point.id!==groupItem.point.id));setTasks(items=>items.filter(task=>task.pointId!==groupItem.point.id));if(expanded===groupItem.key)setExpanded(null)}
  async function addTask(groupItem:ReturnType<typeof group>[number]){if(!(await ensureAdmin()))return;const id=Math.max(0,...tasks.map(task=>task.id))+1;const point=groupItem.point;const task:Task={id,pointId:point.id,district:point.district,location:point.location,priority:"低",theme:"日出",timeWindow:"日出",themeCategory:"",methods:["待规划"],media:["照片"],clarity:"中",status:"未拍摄",note:"",sourceRow:0,stationIds:[],stations:point.stations,samples:[]};setTasks(items=>[task,...items]);setExpanded(null);setEditing(id)}
  async function removeTask(task:Task){if(!confirm(`删除“${task.theme}”拍摄任务？点位、机位与创作主题会继续保留。`)||!(await ensureAdmin()))return;setTasks(items=>items.filter(item=>item.id!==task.id))}
  async function saveCalendarEvent(item:CalendarEvent,isNew:boolean){if(!(await ensureAdmin()))return false;const response=await fetch("/api/planner",{method:isNew?"POST":"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({kind:"event",...item})});const data=await response.json().catch(()=>({}));if(!response.ok){alert(data.error||"日程保存失败");return false}setCalendarEvents(events=>isNew?[...events,data.item].sort((a,b)=>`${a.eventDate}${a.startTime}`.localeCompare(`${b.eventDate}${b.startTime}`)):events.map(event=>event.id===item.id?{...event,...data.item}:event));return true}
  async function removeCalendarEvent(id:string){if(!(await ensureAdmin())||!confirm("删除这条拍摄日程？"))return false;const response=await fetch(`/api/planner?kind=event&id=${encodeURIComponent(id)}`,{method:"DELETE"});if(!response.ok){alert("日程删除失败");return false}setCalendarEvents(events=>events.filter(event=>event.id!==id));return true}
  async function addTheme(){const name=prompt("新创作主题名称")?.trim();if(!name||!(await ensureAdmin()))return;const response=await fetch("/api/planner",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({kind:"theme",name})});const data=await response.json().catch(()=>({}));if(!response.ok){alert(data.error||"主题新增失败");return}setThemeRecords(records=>[...records,data.item])}
  async function renameTheme(record:ThemeRecord){const name=prompt("修改拍摄主题名称",record.name)?.trim();if(!name||name===record.name||!(await ensureAdmin()))return;const response=await fetch("/api/planner",{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({kind:"theme",id:record.id,name})});const data=await response.json().catch(()=>({}));if(!response.ok){alert(data.error||"主题修改失败");return}setThemeRecords(records=>records.map(item=>item.id===record.id?{...item,name}:item));setPoints(items=>items.map(point=>({...point,themeNames:point.themeNames.map(theme=>theme===record.name?name:theme)})))}
  async function removeTheme(record:ThemeRecord){if(!confirm(`删除“${record.name}”创作主题？点位和拍摄任务不会被删除。`)||!(await ensureAdmin()))return;const response=await fetch(`/api/planner?kind=theme&id=${encodeURIComponent(record.id)}`,{method:"DELETE"});if(!response.ok){alert("主题删除失败");return}setThemeRecords(records=>records.filter(item=>item.id!==record.id));setPoints(items=>items.map(point=>({...point,themeNames:point.themeNames.filter(theme=>theme!==record.name)})))}
  async function subscribeAppleCalendar(force=false){const consent=localStorage.getItem("apple-calendar-consent");if(!force&&consent)return;if(!force&&!confirm("是否将拍摄日程订阅到 Apple 日历？同意后系统会打开日历并请你确认订阅。")){localStorage.setItem("apple-calendar-consent","declined");return}localStorage.setItem("apple-calendar-consent","accepted");try{const response=await fetch("/api/calendar-feed?setup=1",{cache:"no-store"});const data=await response.json();if(!response.ok)throw new Error(data.error||"订阅暂不可用");window.location.href=data.webcal}catch(reason){alert(reason instanceof Error?reason.message:"暂时无法打开 Apple 日历")}}
  function openView(next:View){if(next==="calendar"){setMonth(currentMonth());setTimeout(()=>subscribeAppleCalendar(false),0)}setView(next)}
  function toggleTheme(){const next=themeMode==="dark"?"light":"dark";setThemeMode(next);document.documentElement.dataset.theme=next;localStorage.setItem("shancheng-theme",next)}
  async function logout(){await Promise.all([fetch("/api/admin",{method:"DELETE"}),fetch("/api/auth",{method:"DELETE"})]);window.location.href="/login"}
  const nav=[{id:"library",label:"点位库"},{id:"gallery",label:"样片画廊"},{id:"map",label:"地图天气"},{id:"calendar",label:"拍摄日历"},{id:"themes",label:"创作主题"},{id:"coverage",label:"覆盖分析"}] as const;

  return <main>
<header className="topbar">
<div className="brand">
<span className="brandMark">焦</span>
<span>山城取景簿</span>
</div>
<nav>{nav.map(x=>
<button key={x.id} className={view===x.id?"navActive":""} onClick={()=>openView(x.id)}>{x.label}</button>)}</nav>
<div className="headerActions">
<Tooltip><TooltipTrigger render={<Button variant="outline" size="sm"/>} onClick={toggleTheme} aria-label={themeMode==="dark"?"切换到浅色模式":"切换到暗黑模式"}>{themeMode==="dark"?<SunIcon data-icon="inline-start"/>:<MoonIcon data-icon="inline-start"/>}{themeMode==="dark"?"浅色":"暗色"}</TooltipTrigger><TooltipContent>切换网站配色</TooltipContent></Tooltip>
<Button variant="outline" size="sm" onClick={async()=>{if(await ensureAdmin())inputRef.current?.click()}}><FileUpIcon data-icon="inline-start"/>导入 Excel</Button>
<a className={buttonVariants({variant:"outline",size:"sm"})} href={`${assetBase}摄影点位导入模板.xlsx`} download><DownloadIcon data-icon="inline-start"/>下载模板</a>
<Button size="sm" onClick={exportExcel}><FileDownIcon data-icon="inline-start"/>导出修改</Button>
<Tooltip><TooltipTrigger render={<Button variant="ghost" size="icon-sm"/>} onClick={logout} aria-label="退出登录"><LogOutIcon/></TooltipTrigger><TooltipContent>退出登录</TooltipContent></Tooltip>
<input ref={inputRef} hidden type="file" accept=".xlsx,.xls" onChange={e=>e.target.files?.[0]&&importExcel(e.target.files[0])}/>
</div>
  </header>
  <div className={view==="gallery"?"shell galleryShell":"shell"}>
{view==="library"&&<div className="homeOverview"><AstronomyHero/><OverviewStats pointCount={groups.length} districtCount={districts.length} counts={counts} scheduleCount={calendarEvents.length} coordinateCount={points.filter(point=>point.longitude&&point.latitude).length}/></div>}
{view!=="gallery"&&<><section className="intro">
<div>
<p className="eyebrow">CHONGQING PHOTO ATLAS · WORKSPACE</p>
<h1>{view==="library"?"把重庆，拍得更完整。":view==="map"?"先看天，再出发。":view==="calendar"?"把好天气留给重要机位。":view==="themes"?"按主题，整理每一个机位。":"每一个空白，都有下一次出发。"}</h1>
<p>共 {groups.length} 个点位、{tasks.length} 条拍摄任务；点位修改保存在当前设备，云端样片长期保存。</p>
</div>
{view==="library"?<div className="libraryIntroActions"><CurrentWeatherCard/><Button size="lg" onClick={createPoint}><PlusIcon data-icon="inline-start"/>新建点位</Button></div>:view!=="calendar"&&view!=="themes"&&<Button size="lg" onClick={createPoint}><PlusIcon data-icon="inline-start"/>新建点位</Button>}
</section>
{view!=="library"&&<OverviewStats pointCount={groups.length} districtCount={districts.length} counts={counts} scheduleCount={calendarEvents.length} coordinateCount={points.filter(point=>point.longitude&&point.latitude).length}/>}</>}

  {view==="library"&&<section className="workspace">
<aside className="districtSidebar" aria-label="行政区域筛选">
<div className="asideTitle">
<span>行政区域</span>
<small>{districts.length} 个</small>
</div>{["全部行政区",...districts].map(d=>
<button key={d} className={district===d?"district active":"district"} onClick={()=>setDistrict(d)}>
<span>{d}</span>
<b>{d==="全部行政区"?groups.length:groups.filter(g=>g.district===d).length}</b>
</button>)}<div className="dataHealth">
<span>工具提示</span>
<small>点击主题任务右侧“管理”，可设置主题归类、坐标、计划、机位、样片和毕业标准。</small>
</div>
</aside>
<div className="content">
<div className="toolbar">
<label className="search">⌕<input placeholder="搜索点位、主题归类、方式或备注…" value={query} onChange={e=>setQuery(e.target.value)}/>
</label>
<div className="filters">
<select value={category} onChange={e=>setCategory(e.target.value)}>
<option>全部归类</option>{themeCategories.map(x=>
<option key={x}>{x}</option>)}</select>
<select value={status} onChange={e=>setStatus(e.target.value)}>
<option>全部状态</option>{statuses.map(x=>
<option key={x}>{x}</option>)}</select>
<select value={priority} onChange={e=>setPriority(e.target.value)}>
<option>全部优先级</option>
<option>高</option>
<option>中</option>
<option>低</option>
</select>
</div>
</div>
<div className="listHead">
<span>显示 {filtered.length} 个点位</span>
<small>按优先级排序 · 点击卡片直接编辑点位</small>
</div>
<div className="spotList">{filtered.map(g=>
<article className="locationCard" key={g.key}>
<button className="locationSummary" onClick={()=>{setPointEditOnOpen(true);setExpanded(g.key)}}>
<span className={`priorityBadge priority-${g.priority}`}>{g.priority}</span>
<div className="locationName">
<div>
<h3>{g.location}</h3>
<span>{g.district}</span>
</div>
<p>{g.themeNames.length?`标签：${g.themeNames.join("、")}`:"尚未添加创作主题"} · {g.tasks.length} 个拍摄任务 · {g.stations.length} 个机位</p>
</div>
<div className="taskProgress">
<small>任务毕业</small>
<strong>{g.tasks.filter(t=>t.status==="已毕业").length}/{g.tasks.length}</strong>
<div>
<i style={{width:`${g.tasks.length?g.tasks.filter(t=>t.status==="已毕业").length/g.tasks.length*100:0}%`}}/>
</div>
</div>
<Badge variant={g.status==="待补拍"?"destructive":g.status==="已毕业"?"default":"secondary"}>{g.status}</Badge>
<span className="chevron">↗</span>
</button><div className="pointCardActions"><Tooltip><TooltipTrigger render={<Button variant="secondary" size="icon-sm"/>} aria-label={`编辑${g.location}`} onClick={()=>{setPointEditOnOpen(true);setExpanded(g.key)}}><PencilIcon/></TooltipTrigger><TooltipContent>编辑点位</TooltipContent></Tooltip><Tooltip><TooltipTrigger render={<Button variant="destructive" size="icon-sm"/>} aria-label={`删除${g.location}`} onClick={()=>removePointGroup(g)}><Trash2Icon/></TooltipTrigger><TooltipContent>删除点位</TooltipContent></Tooltip></div></article>)}</div>
</div>
</section>}

  {view==="library"&&activeGroup&&<PointDetailModal key={`${activeGroup.key}-${pointEditOnOpen?"edit":"view"}`} point={activeGroup} initialEditing={pointEditOnOpen} districts={availableDistricts} categories={themeCategories} onClose={()=>{setExpanded(null);setPointEditOnOpen(false)}} onSave={(patch,names,stations,taskWindows)=>savePointGroup(activeGroup,patch,names,stations,taskWindows)} onAddTask={()=>addTask(activeGroup)} onManageTask={async id=>{if(await openEditor(id))setExpanded(null)}} onRemoveTask={removeTask} onChangeStatus={changeStatus}/>}

  {view==="gallery"&&<Gallery tasks={taskViews} points={points} categories={themeCategories} onEdit={async id=>{if(await ensureAdmin()){setEditing(id);setView("library")}}}/>}

  {view==="map"&&<section className="mapWorkspace">
<div className="mapMain">
<MapCanvas tasks={mappedTasks} route={route} onPick={loadWeather}/>
<div className="mapLegend">
<span>
<i className="dot unshot"/>未拍摄</span>
<span>
<i className="dot redo"/>待补拍</span>
<span>
<i className="dot done"/>已毕业</span>
<small>{amapLocating?"正在通过高德定位全部点位…":"高德地图 · 缺失坐标已自动解析"}</small>
</div>
</div>
<aside className="mapSide">
<h2>拍摄路线</h2>
<p className="sub">选择 2–8 个主题任务，按选择顺序规划驾车路线。</p>
<div className="routePicker">{taskViews.slice(0,80).map(t=>
<label key={t.id}>
<input type="checkbox" checked={routeIds.includes(t.id)} disabled={!routeIds.includes(t.id)&&routeIds.length>=8} onChange={e=>setRouteIds(x=>e.target.checked?[...x,t.id]:x.filter(id=>id!==t.id))}/>
<span>{t.location}</span>
<small>{t.theme}</small>
</label>)}</div>
<button className="primary full" onClick={planRoute} disabled={routeIds.length<2||routeLoading}>{routeLoading?"正在规划…":`规划 ${routeIds.length} 个点位`}</button>{route&&<div className="routeResult">
<strong>{(route.distance/1000).toFixed(1)} km</strong>
<span>预计驾车 {Math.round(route.duration/60)} 分钟</span>
</div>}<hr/>
<h2>天气窗口</h2>{selectedMapTask?<>
<div className="weatherPlace">
<strong>{selectedMapTask.location}</strong>
{selectedMapTask.id>0&&<button onClick={()=>openEditor(selectedMapTask.id)}>编辑坐标</button>}
</div>{weatherLoading?<p className="loading">读取天气中…</p>:weatherError?<p className="weatherError">{weatherError}<button onClick={()=>loadWeather(selectedMapTask)}>重新加载</button></p>:weather.length?<div className="weatherDays">{weather.map(w=>
<article key={w.date}>
<span className="weatherDayIcon" aria-hidden="true">{weatherSymbol(w.code)}</span><div>
<strong>{w.date.slice(5)} · {w.text}</strong>
<small>{w.tempMin}–{w.tempMax}° · 云量 {w.cloud}% · 降水 {w.precipitation}%</small>
</div>
<span>日出 {w.sunrise}<br/>日落 {w.sunset}</span>
</article>)}</div>:<p className="sub">点击地图上的点位查看 7 日天气。</p>}</>:<p className="sub">点击地图标记，查看天气现象、云量、降水概率与日出日落窗口。</p>}</aside>
</section>}

  {view==="calendar"&&<Calendar month={month} setMonth={setMonth} events={calendarEvents} onSave={saveCalendarEvent} onDelete={removeCalendarEvent} onSync={()=>subscribeAppleCalendar(true)}/>}
  {view==="themes"&&<ThemeManager records={themeRecords} points={points} tasks={taskViews} onAdd={addTheme} onRename={renameTheme} onDelete={removeTheme} onOpen={name=>{setCategory(name);setView("library")}} onEdit={openEditor}/>}
  {view==="coverage"&&<Coverage points={points} tasks={taskViews} categories={themeCategories}/>}
  </div>{editing!==null&&selected&&<Editor task={selected} update={p=>update(selected.id,p)} close={()=>setEditing(null)} addStation={()=>addStation(selected.id)} addSamples={f=>addSamples(selected.id,f)}/>}</main>
}

function PointDetailModal({point,initialEditing,districts,categories,onClose,onSave,onAddTask,onManageTask,onRemoveTask,onChangeStatus}:{point:ReturnType<typeof group>[number];initialEditing?:boolean;districts:string[];categories:string[];onClose:()=>void;onSave:(patch:{location:string;district:string;longitude?:number;latitude?:number},themeNames:string[],stations:Station[],taskWindows:string[])=>Promise<boolean>;onAddTask:()=>void;onManageTask:(id:number)=>void;onRemoveTask:(task:Task)=>void;onChangeStatus:(task:Task)=>void}){
  const source=point.point;const themeOptions=[...new Set([...categories,...source.themeNames])];
  const existingTaskWindows=new Set(point.tasks.map(task=>task.timeWindow||inferTimeWindow(task.theme)));const [editingPoint,setEditingPoint]=useState(Boolean(initialEditing));const [saving,setSaving]=useState(false);const [formError,setFormError]=useState("");const [selectedThemes,setSelectedThemes]=useState<string[]>(source.themeNames);const [selectedTaskWindows,setSelectedTaskWindows]=useState<string[]>(shootTimes.filter(window=>existingTaskWindows.has(window)));const [draftStations,setDraftStations]=useState<Station[]>(source.stations);const [draft,setDraft]=useState({location:point.location,district:point.district,longitude:source.longitude?String(source.longitude):"",latitude:source.latitude?String(source.latitude):""});
  useEffect(()=>{const previous=document.body.style.overflow;document.body.style.overflow="hidden";return()=>{document.body.style.overflow=previous}},[]);
  async function save(){const longitude=n(draft.longitude);const latitude=n(draft.latitude);if(!draft.location.trim()){setFormError("请填写点位名称");return}if(!longitude||!latitude){setFormError("请在地图中搜索并选择拍摄位置");return}setSaving(true);setFormError("");try{if(await onSave({location:draft.location.trim(),district:draft.district,longitude,latitude},selectedThemes,draftStations.filter(station=>station.name.trim()).map(station=>({...station,name:station.name.trim()})),selectedTaskWindows))onClose()}finally{setSaving(false)}}
  function toggleTheme(name:string,checked:boolean){setSelectedThemes(items=>checked?[...new Set([...items,name])]:items.filter(item=>item!==name));setFormError("")}
  return <div className="modal pointModal" role="dialog" aria-modal="true" aria-labelledby="point-dialog-title"><div className="pointDialog">
<div className="modalHead"><div><small>{editingPoint?"EDIT LOCATION":"LOCATION DETAIL"}</small><h2 id="point-dialog-title">{editingPoint?"新建或编辑拍摄点位":point.location}</h2><p>{editingPoint?"搜索地图确定位置，并选择点位所属的创作主题。":`${point.district} · ${point.tasks.length} 个拍摄任务 · ${point.stations.length} 个机位`}</p></div>{!editingPoint&&<button onClick={onClose} aria-label="关闭点位详情">×</button>}</div>
{editingPoint?<div className="pointEditGrid">
<FieldGroup className="pointBaseFields"><Field><FieldLabel htmlFor="point-name">点位名称</FieldLabel><Input id="point-name" value={draft.location} onChange={event=>{setDraft({...draft,location:event.target.value});setFormError("")}}/></Field><Field><FieldLabel htmlFor="point-district">行政区域</FieldLabel><select id="point-district" value={draft.district} onChange={event=>setDraft({...draft,district:event.target.value})}>{districts.map(name=><option key={name}>{name}</option>)}</select></Field></FieldGroup>
<div className="pointMapSection"><strong>地图位置</strong><p>搜索建筑、道路或附近地标，选择结果后可直接在地图上点击微调。</p><PointMapPicker longitude={n(draft.longitude)} latitude={n(draft.latitude)} district={draft.district} onPick={value=>{setDraft(current=>({...current,longitude:String(value.longitude),latitude:String(value.latitude),district:value.district&&districts.includes(value.district)?value.district:current.district}));setFormError("")}}/></div>
<FieldSet className="pointTaskSelector"><FieldLegend>拍摄任务</FieldLegend><FieldDescription>直接勾选需要创建的常用任务。已存在的任务保持选中，如需删除请回到点位详情单独操作。</FieldDescription><FieldGroup className="taskCheckboxGrid">{shootTimes.map(window=>{const id=`point-task-${window}`;const exists=existingTaskWindows.has(window);return <Field orientation="horizontal" key={window} data-disabled={exists||undefined}><Checkbox id={id} checked={selectedTaskWindows.includes(window)} disabled={exists} onCheckedChange={checked=>setSelectedTaskWindows(items=>checked?[...new Set([...items,window])]:items.filter(item=>item!==window))}/><FieldLabel htmlFor={id}>{window}{exists&&<small>已创建</small>}</FieldLabel></Field>})}</FieldGroup></FieldSet>
<FieldSet className="pointThemeSelector"><FieldLegend>关联拍摄主题</FieldLegend><FieldDescription>当前所有创作主题均展示在这里，可一次选择多个。</FieldDescription><FieldGroup className="themeCheckboxGrid">{themeOptions.map(name=>{const id=`point-theme-${name}`;return <Field orientation="horizontal" key={name}><Checkbox id={id} checked={selectedThemes.includes(name)} onCheckedChange={checked=>toggleTheme(name,Boolean(checked))}/><FieldLabel htmlFor={id}>{name}</FieldLabel></Field>})}</FieldGroup></FieldSet>
<FieldSet className="pointStationSelector"><div className="pointStationHeading"><div><FieldLegend>点位机位</FieldLegend><FieldDescription>机位属于点位，可先建立机位，再由不同拍摄任务分别关联。</FieldDescription></div><Button variant="outline" size="sm" onClick={()=>setDraftStations(items=>[...items,{id:crypto.randomUUID(),name:`机位 ${items.length+1}`,description:""}])}><PlusIcon data-icon="inline-start"/>添加机位</Button></div><div className="pointStationRows">{draftStations.map((station,index)=><div key={station.id}><Input aria-label={`机位 ${index+1} 名称`} value={station.name} placeholder="机位名称" onChange={event=>setDraftStations(items=>items.map(item=>item.id===station.id?{...item,name:event.target.value}:item))}/><Input aria-label={`机位 ${index+1} 说明`} value={station.description} placeholder="朝向、焦段、进入限制等说明" onChange={event=>setDraftStations(items=>items.map(item=>item.id===station.id?{...item,description:event.target.value}:item))}/><Button variant="ghost" size="icon-sm" aria-label={`删除${station.name||`机位 ${index+1}`}`} onClick={()=>setDraftStations(items=>items.filter(item=>item.id!==station.id))}><Trash2Icon/></Button></div>)}{!draftStations.length&&<p className="sub">尚未建立机位，可稍后补充，不影响点位保存。</p>}</div></FieldSet>
{formError&&<FieldError className="pointFormError">{formError}</FieldError>}
<div className="pointEditActions"><Button variant="outline" disabled={saving} onClick={onClose}>取消</Button><Button disabled={saving} onClick={save}>{saving?<><Spinner data-icon="inline-start"/>正在保存</>:"保存点位"}</Button></div>
</div>:<><div className="pointOverview"><div><small>任务进度</small><strong>{point.tasks.filter(task=>task.status==="已毕业").length} / {point.tasks.length}</strong></div><div><small>点位机位</small><strong>{point.stations.length} 个</strong></div><div><small>地图位置</small><strong>{source.longitude&&source.latitude?"已定位":"待定位"}</strong></div><button onClick={()=>setEditingPoint(true)}>编辑点位信息</button></div>
<div className="pointThemeHead"><div><h3>创作主题</h3><p>{source.themeNames.length?source.themeNames.join("、"):"尚未添加标签"}</p></div><Button onClick={onAddTask}><PlusIcon data-icon="inline-start"/>新建拍摄任务</Button></div><div className="pointThemeList">{point.tasks.map(task=><article key={task.id}>
<div className="pointThemeTitle"><div><span>{task.timeWindow||"自定义时段"}</span><h4>{task.theme}</h4></div><button className={`status status-${task.status}`} onClick={()=>onChangeStatus(task)}>{task.status} ↻</button></div>
<div className="pointThemeMeta"><span>优先级 {task.priority}</span><span>{task.stationIds?.length||0} 个关联机位</span><span>{task.samples?.length||0} 张样片</span><span>通透度 {task.clarity}</span></div>
<p>{task.methods.join("、")} · {task.media.join("、")}{task.scheduleDate?` · ${task.scheduleDate} ${task.scheduleSlot||""}`:""}</p>
<div className="pointThemeActions"><button className="pointTaskDelete" onClick={()=>onRemoveTask(task)}>删除任务</button><button onClick={()=>onManageTask(task.id)}>查看并编辑 →</button></div>
</article>)}{!point.tasks.length&&<div className="pointTaskEmpty"><strong>暂无拍摄任务</strong><p>点位、机位和创作主题已经独立保存，可按需要新增日出、日落、蓝调或夜景任务。</p></div>}</div></>}
</div></div>
}

function Gallery({tasks,points,categories,onEdit}:{tasks:Task[];points:PointRecord[];categories:string[];onEdit:(id:number)=>void}){
  const [remote,setRemote]=useState<GallerySample[]>([]); const [loading,setLoading]=useState(true); const [error,setError]=useState("");
  const [query,setQuery]=useState(""); const [district,setDistrict]=useState("全部行政区"); const [theme,setTheme]=useState("全部主题"); const [category,setCategory]=useState("全部归类");
  const [active,setActive]=useState<GallerySample|null>(null); const [uploadOpen,setUploadOpen]=useState(false); const [uploading,setUploading]=useState(false); const [progress,setProgress]=useState(""); const [uploadError,setUploadError]=useState("");
  const [editingMeta,setEditingMeta]=useState(false); const [savingMeta,setSavingMeta]=useState(false); const [editError,setEditError]=useState("");
  const [draggedGroup,setDraggedGroup]=useState<string|null>(null);const [dropTarget,setDropTarget]=useState<string|null>(null);const [pendingMerge,setPendingMerge]=useState<{source:string;target:string}|null>(null);const [merging,setMerging]=useState(false);
  const pressTimer=useRef<number|undefined>(undefined);const pressOrigin=useRef<{x:number;y:number}|null>(null);const touchDrag=useRef<string|null>(null);const touchTarget=useRef<string|null>(null);const suppressClick=useRef(false);
  const [queue,setQueue]=useState<UploadJob[]>([]); const [broken,setBroken]=useState<Set<string>>(new Set()); const [deleting,setDeleting]=useState<Set<string>>(new Set());
  const [draft,setDraft]=useState<SampleDraft>({originalName:"",location:"",themeCategory:"",device:"",shootTime:"",stationId:"",stationName:"",stationDescription:"",subjectDescription:"",note:""});
  const [taskId,setTaskId]=useState(String(tasks[0]?.id||"")); const [stationName,setStationName]=useState(""); const [uploadDevice,setUploadDevice]=useState(""); const [uploadShootTime,setUploadShootTime]=useState(""); const [uploadLocation,setUploadLocation]=useState(""); const [note,setNote]=useState(""); const filesRef=useRef<HTMLInputElement>(null);
  const normalizeSample=(x:GallerySample):GallerySample=>({...x,themeCategory:x.themeCategory||inferThemeCategory(x.theme),url:x.url.startsWith("/")?`${sampleApi}${x.url.slice("/api/samples".length)}`:x.url});
  const load=async()=>{setLoading(true);setError("");try{const r=await fetch(sampleApi,{cache:"no-store"});if(!r.ok)throw new Error();const d=await r.json();setRemote((d.items||[]).map(normalizeSample))}catch{setError("云端样片暂时无法读取，请稍后重试。")}finally{setLoading(false)}};
  useEffect(()=>{load();uploadJobs().then(async jobs=>{const recovered=jobs.map(job=>job.status==="uploading"?{...job,status:"failed" as const,error:"上次上传被中断，可从已完成进度继续"}:job);await Promise.all(recovered.map(saveUploadJob));setQueue(recovered)}).catch(()=>{})},[]);
  const local=useMemo(()=>tasks.flatMap(t=>{const station=t.stations?.find(item=>(t.stationIds||[]).includes(item.id))||t.stations?.[0];const point=points.find(item=>item.id===t.pointId);return (t.samples||[]).map(s=>({id:`local-${t.id}-${s.id}`,url:s.url,uploadedAt:"",taskId:String(t.id),district:t.district,location:t.location,theme:t.theme,themeCategory:point?.themeNames[0]||"",stationId:station?.id||"",stationName:station?.name||"未指定机位",stationDescription:station?.description||"",subjectDescription:"",note:t.note||"",originalName:s.name,local:true} as GallerySample))}),[tasks,points]);
  const all=[...remote,...local]; const districts=[...new Set(all.map(x=>x.district).filter(Boolean))]; const themes=[...new Set(all.map(x=>x.theme).filter(Boolean))];
  const shown=all.filter(x=>(district==="全部行政区"||x.district===district)&&(theme==="全部主题"||x.theme===theme)&&(category==="全部归类"||(x.themeCategory||"")===category)&&`${x.location} ${x.stationName} ${x.device||""} ${x.shootTime||""} ${x.themeCategory||"未归类"} ${x.theme} ${x.subjectDescription||""} ${x.note} ${x.originalName}`.toLowerCase().includes(query.toLowerCase()));
  const sampleGroups=useMemo(()=>{const grouped=new Map<string,GallerySample[]>();for(const item of shown){const key=item.groupId?`group:${item.groupId}`:`sample:${item.id}`;grouped.set(key,[...(grouped.get(key)||[]),item])}return [...grouped].map(([key,samples])=>({key,samples,cover:samples[0]}))},[shown]);
  const activeSamples=active?(sampleGroups.find(item=>item.samples.some(sample=>sample.id===active.id))?.samples||[active]):[];
  const pickedTask=tasks.find(t=>String(t.id)===taskId);
  const activeTask=active?tasks.find(t=>String(t.id)===active.taskId):undefined;
  function notify(message:string,kind:"success"|"error"){shadcnToast.add({title:message,type:kind,timeout:2600})}
  const stationKey=(item:GallerySample)=>item.stationId?`id:${item.stationId}`:`${item.district}::${item.location}::${item.stationName.trim().toLowerCase()}`;
  function prepareMerge(sourceKey:string|null,targetKey:string|null){setDraggedGroup(null);setDropTarget(null);if(!sourceKey||!targetKey||sourceKey===targetKey)return;const source=sampleGroups.find(item=>item.key===sourceKey);const target=sampleGroups.find(item=>item.key===targetKey);if(!source||!target)return;if([...source.samples,...target.samples].some(item=>item.local)){notify("本地样片需要上传后才能合并","error");return}if(!source.cover.stationName.trim()||stationKey(source.cover)!==stationKey(target.cover)){notify("仅支持合并同一拍摄机位的样片","error");return}setPendingMerge({source:sourceKey,target:targetKey})}
  function clearPress(){if(pressTimer.current)window.clearTimeout(pressTimer.current);pressTimer.current=undefined;pressOrigin.current=null}
  function pointerDown(key:string,event:React.PointerEvent<HTMLElement>){if(event.pointerType==="mouse")return;clearPress();event.currentTarget.setPointerCapture(event.pointerId);pressOrigin.current={x:event.clientX,y:event.clientY};pressTimer.current=window.setTimeout(()=>{touchDrag.current=key;suppressClick.current=true;setDraggedGroup(key);notify("拖到同机位样片上松开即可合并","success")},500)}
  function pointerMove(event:React.PointerEvent<HTMLElement>){if(!touchDrag.current){const origin=pressOrigin.current;if(origin&&Math.hypot(event.clientX-origin.x,event.clientY-origin.y)>10)clearPress();return}event.preventDefault();const card=document.elementFromPoint(event.clientX,event.clientY)?.closest<HTMLElement>("[data-gallery-group]");touchTarget.current=card?.dataset.galleryGroup||null;setDropTarget(touchTarget.current)}
  function pointerEnd(){clearPress();if(touchDrag.current)prepareMerge(touchDrag.current,touchTarget.current);touchDrag.current=null;touchTarget.current=null;window.setTimeout(()=>{suppressClick.current=false},0)}
  async function mergeGroups(){if(!pendingMerge||!(await ensureAdmin()))return;const source=sampleGroups.find(item=>item.key===pendingMerge.source);const target=sampleGroups.find(item=>item.key===pendingMerge.target);if(!source||!target)return;setMerging(true);const groupId=target.cover.groupId||crypto.randomUUID();const affected=[...target.samples,...source.samples];try{for(const item of affected){const response=await fetch(sampleApi,{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({id:item.id,groupId})});if(!response.ok)throw new Error()}const ids=new Set(affected.map(item=>item.id));setRemote(items=>items.map(item=>ids.has(item.id)?{...item,groupId}:item));setPendingMerge(null);notify(`已将 ${affected.length} 张同机位样片合并展示`,"success")}catch{await load();notify("合并失败，请重试","error")}finally{setMerging(false)}}
  async function resumeUploads(jobs:UploadJob[]){
    if(!jobs.length||!(await ensureAdmin()))return;
    setUploading(true);setUploadError("");
    let succeeded=0;let failedCount=0;
    for(let index=0;index<jobs.length;index++){
      let job={...jobs[index],status:"uploading" as const,error:""};
      try{
        if(!supportedUploadTypes.has(job.file.type))throw new Error("格式不受支持，请转换为 JPG、PNG、WebP、GIF 或 AVIF 后重新选择");
        if(job.file.size>uploadLimitBytes){
          setProgress(`正在压缩 ${index+1} / ${jobs.length}：${job.originalName}`);
          job={...job,file:await compressForUpload(job.file),uploadId:undefined,objectId:undefined,parts:[]};
        }
        job={...job,uploadId:undefined,objectId:undefined,parts:[]};
        await saveUploadJob(job);
        setQueue(items=>items.map(x=>x.jobId===job.jobId?job:x));
        setProgress(`正在上传 ${index+1} / ${jobs.length}：${job.originalName}`);
        let response:Response|null=null;let data:{error?:string;item?:GallerySample}={};let networkFailed=false;
        for(let attempt=1;attempt<=3;attempt++){
          const form=new FormData();form.append("file",job.file);form.append("taskId",job.taskId);form.append("district",job.district);form.append("location",job.location);form.append("theme",job.theme);form.append("themeCategory",job.themeCategory);form.append("device",job.device);form.append("shootTime",job.shootTime);form.append("stationId",job.stationId);form.append("stationName",job.stationName);form.append("stationDescription",job.stationDescription);form.append("note",job.note);form.append("originalName",job.originalName);
          try{response=await fetch(sampleApi,{method:"POST",body:form});data=await response.json().catch(()=>({}));networkFailed=false;if(response.ok||response.status<500)break}catch{networkFailed=true}
          if(attempt<3){setProgress(`正在重试 ${index+1} / ${jobs.length}：第 ${attempt+1} 次`);await new Promise(resolve=>setTimeout(resolve,attempt*900))}
        }
        if(!response?.ok)throw new Error(data.error||(networkFailed?"网络连接中断，已自动重试 3 次":`服务器上传失败（${response?.status||500}）`));
        const uploaded=data.item as GallerySample|undefined;
        if(!uploaded)throw new Error("服务器未返回样片信息，请重试");
        const normalized=normalizeSample(uploaded);
        setRemote(items=>[normalized,...items.filter(item=>item.id!==normalized.id)]);
        await deleteUploadJob(job.jobId);setQueue(items=>items.filter(x=>x.jobId!==job.jobId));succeeded++;
      }catch(reason){
        const failed={...job,status:"failed" as const,error:reason instanceof Error?reason.message:"未知上传错误"};
        await saveUploadJob(failed).catch(()=>{});setQueue(items=>items.map(x=>x.jobId===failed.jobId?failed:x));failedCount++;
      }
    }
    setUploading(false);setProgress("");
    if(failedCount){setUploadError(`${failedCount} 张上传失败，成功的 ${succeeded} 张已加入画廊。请在下方查看原因并重试。`);notify(`${failedCount} 张上传失败，可单独重试`,"error");}
    else if(succeeded){setUploadOpen(false);notify(`${succeeded} 张样片已上传并加入画廊`,"success");}
  }
  async function upload(){
    const sources=[...(filesRef.current?.files||[])];if(!pickedTask||!stationName.trim()||!sources.length)return;
    setUploading(true);setUploadError("");const station=pickedTask.stations?.find(s=>s.name===stationName);const jobs:UploadJob[]=[];
    for(let i=0;i<sources.length;i++){
      const source=sources[i];let file=source;let status:UploadJob["status"]="waiting";let jobError="";
      setProgress(source.size>uploadLimitBytes?`正在压缩 ${i+1} / ${sources.length}`:`正在准备 ${i+1} / ${sources.length}`);
      try{if(!supportedUploadTypes.has(source.type))throw new Error("格式不受支持，请转换为 JPG、PNG、WebP、GIF 或 AVIF 后重新选择");file=await compressForUpload(source)}catch(reason){status="failed";jobError=reason instanceof Error?reason.message:"图片压缩失败"}
      const point=points.find(item=>item.id===pickedTask.pointId);const job:UploadJob={jobId:crypto.randomUUID(),file,taskId:String(pickedTask.id),district:pickedTask.district,location:uploadLocation.trim(),theme:pickedTask.theme,themeCategory:point?.themeNames[0]||"",device:uploadDevice,shootTime:uploadShootTime,stationId:station?.id||"",stationName:stationName.trim(),stationDescription:"",note,originalName:source.name,parts:[],status,error:jobError,createdAt:Date.now()};
      await saveUploadJob(job);jobs.push(job);
    }
    setQueue(items=>[...items,...jobs]);setUploading(false);setProgress("");if(filesRef.current)filesRef.current.value="";
    const ready=jobs.filter(job=>job.status==="waiting");const preparationFailures=jobs.length-ready.length;
    if(preparationFailures)setUploadError(`${preparationFailures} 张图片无法准备上传，请查看下方原因。`);
    if(ready.length)await resumeUploads(ready);
    if(preparationFailures){setUploadOpen(true);setUploadError(`${preparationFailures} 张图片无法准备上传，其他图片已正常处理。请查看下方原因。`)}
  }
  async function discardUpload(jobId:string){await deleteUploadJob(jobId).catch(()=>{});setQueue(items=>items.filter(item=>item.jobId!==jobId))}
  async function reupload(item:GallerySample,file:File|undefined){if(!file||item.local||!(await ensureAdmin()))return;if(!supportedUploadTypes.has(file.type)){alert("请先转换为 JPG、PNG、WebP、GIF 或 AVIF");return}setUploading(true);setProgress(file.size>uploadLimitBytes?"正在压缩替换图片…":"正在替换图片…");let prepared:File;try{prepared=await compressForUpload(file)}catch(reason){alert(reason instanceof Error?reason.message:"图片压缩失败");setUploading(false);setProgress("");return}const r=await fetch(`${sampleApi}?id=${encodeURIComponent(item.id)}&name=${encodeURIComponent(file.name)}`,{method:"PUT",headers:{"content-type":prepared.type},body:prepared});const data=await r.json().catch(()=>({}));setUploading(false);setProgress("");if(!r.ok){alert(data.error||"重新上传失败");return}setActive(null);setBroken(items=>{const next=new Set(items);next.delete(item.id);return next});await load()}
  async function remove(item:GallerySample){if(item.local){notify("本地样片不能在画廊中删除","error");return}if(!confirm("删除这张云端样片？删除后不可恢复。")||!(await ensureAdmin()))return;setDeleting(items=>new Set(items).add(item.id));try{const r=await fetch(`${sampleApi}?id=${encodeURIComponent(item.id)}`,{method:"DELETE"});const data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(data.error||"删除失败，请重试");setRemote(items=>items.filter(sample=>sample.id!==item.id));setBroken(items=>{const next=new Set(items);next.delete(item.id);return next});setActive(current=>current?.id===item.id?null:current);notify("样片已删除","success")}catch(reason){notify(reason instanceof Error?reason.message:"删除失败，请重试","error")}finally{setDeleting(items=>{const next=new Set(items);next.delete(item.id);return next})}}
  async function startEdit(item:GallerySample){if(item.local){notify("本地样片上传后才能编辑","error");return}if(!(await ensureAdmin()))return;setActive(item);setDraft({originalName:item.originalName||"",location:item.location||"",themeCategory:item.themeCategory||inferThemeCategory(item.theme),device:item.device||"",shootTime:item.shootTime||"",stationId:item.stationId||"",stationName:item.stationName||"",stationDescription:item.stationDescription||"",subjectDescription:item.subjectDescription||"",note:item.note||""});setEditError("");setEditingMeta(true)}
  async function saveEdit(){if(!active||active.local)return;if(!(await ensureAdmin())){notify("保存失败，请重试","error");return}setSavingMeta(true);setEditError("");try{const r=await fetch(sampleApi,{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({id:active.id,...draft})});const data=await r.json().catch(()=>({}));if(!r.ok)throw new Error();const updated={...active,...data.item,url:active.url};setRemote(items=>items.map(item=>item.id===active.id?updated:item));setEditingMeta(false);setActive(null);notify("修改成功","success")}catch{setEditError("保存失败，请重试");notify("保存失败，请重试","error")}finally{setSavingMeta(false)}}
  return <section className="galleryPanel">
<div className="galleryToolbar">
<div>
<p className="eyebrow">REFERENCE GALLERY</p>
<h2>样片瀑布流</h2>
<p>从照片反查点位与机位，把灵感直接落到下一次拍摄。</p>
</div>
<Button size="lg" onClick={()=>setUploadOpen(true)}><ImagesIcon data-icon="inline-start"/>批量上传样片</Button>
</div>
{queue.length>0&&<div className="uploadRecovery">
<div className="uploadRecoveryHead"><div><strong>{queue.length} 张图片尚未完成</strong><small>每张图片独立上传；成功项会立即进入画廊，失败项会保留原因和进度。</small></div><button disabled={uploading} onClick={()=>resumeUploads(queue)}>{uploading?progress:"全部重试"}</button></div>
<div className="uploadQueueList">{queue.map(job=><div className={`uploadQueueItem uploadQueue-${job.status}`} key={job.jobId}><div><strong title={job.originalName}>{job.originalName}</strong><small>{job.status==="uploading"?"正在上传…":job.status==="waiting"?"等待上传":job.error||"上传失败，请重试"}</small></div><span>{job.status==="failed"?"失败":job.status==="uploading"?"上传中":"待处理"}</span><div className="uploadQueueActions">{job.status==="failed"&&<button disabled={uploading} onClick={()=>resumeUploads([job])}>重试</button>}<button className="uploadDiscard" disabled={uploading&&job.status==="uploading"} onClick={()=>discardUpload(job.jobId)}>移除</button></div></div>)}</div>
</div>}
<div className="galleryFilters">
<label className="search">⌕<input placeholder="搜索点位、机位、主题归类或备注…" value={query} onChange={e=>setQuery(e.target.value)}/>
</label>
<select value={district} onChange={e=>setDistrict(e.target.value)}>
<option>全部行政区</option>{districts.map(x=>
<option key={x}>{x}</option>)}</select>
<select value={category} onChange={e=>setCategory(e.target.value)}>
<option>全部归类</option>{categories.map(x=>
<option key={x}>{x}</option>)}</select>
<select value={theme} onChange={e=>setTheme(e.target.value)}>
<option>全部主题</option>{themes.map(x=>
<option key={x}>{x}</option>)}</select>
<span>{shown.length} 张样片 · {sampleGroups.length} 组</span>
</div>{loading?<Empty className="galleryEmpty"><EmptyHeader><EmptyMedia variant="icon"><Spinner/></EmptyMedia><EmptyTitle>正在整理样片</EmptyTitle><EmptyDescription>正在加载云端照片和机位信息。</EmptyDescription></EmptyHeader></Empty>:shown.length?<div className="masonry">{sampleGroups.map(groupItem=>{const item=groupItem.cover;return <article role="button" tabIndex={0} className={`sampleCard ${draggedGroup===groupItem.key?"sampleDragging":""} ${dropTarget===groupItem.key?"sampleDropTarget":""}`} key={groupItem.key} data-gallery-group={groupItem.key} draggable={!item.local} onDragStart={event=>{event.dataTransfer.effectAllowed="move";setDraggedGroup(groupItem.key)}} onDragOver={event=>{event.preventDefault();event.dataTransfer.dropEffect="move";setDropTarget(groupItem.key)}} onDragLeave={()=>setDropTarget(current=>current===groupItem.key?null:current)} onDrop={event=>{event.preventDefault();prepareMerge(draggedGroup,groupItem.key)}} onDragEnd={()=>{setDraggedGroup(null);setDropTarget(null)}} onPointerDown={event=>pointerDown(groupItem.key,event)} onPointerMove={pointerMove} onPointerUp={pointerEnd} onPointerCancel={pointerEnd} onClick={event=>{if(suppressClick.current){event.preventDefault();return}setActive(item)}} onKeyDown={event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();setActive(item)}}}>
{broken.has(item.id)?<span className="brokenSample"><b>图片无法显示</b><small>点击查看并重新上传</small></span>:<img src={item.url} alt={`${item.location} ${item.stationName}`} onError={()=>setBroken(items=>new Set(items).add(item.id))}/>}{groupItem.samples.length>1&&<b className="sampleCount">组图 · {groupItem.samples.length} 张</b>}<div className="sampleCardActions" onPointerDown={event=>event.stopPropagation()} onClick={event=>event.stopPropagation()}><button aria-label={`编辑${item.originalName||"样片"}`} title="编辑样片" disabled={item.local} onClick={()=>startEdit(item)}>✎</button><button aria-label={`删除${item.originalName||"样片"}`} title="删除样片" disabled={item.local||deleting.has(item.id)} onClick={()=>remove(item)}>⌫</button></div>
<span>
<b>{item.originalName||"未命名样片"}</b>
<small>{item.stationName||"未关联机位"}{item.device?` · ${item.device}`:""}{item.shootTime?` · ${item.shootTime}`:""}</small>
</span>
</article>})}</div>:<Empty className="galleryEmpty"><EmptyHeader><EmptyMedia variant="icon"><ImagesIcon/></EmptyMedia><EmptyTitle>画廊还是空的</EmptyTitle><EmptyDescription>{error||"上传第一批参考照片，并把它们关联到具体机位。"}</EmptyDescription></EmptyHeader><EmptyContent><Button onClick={()=>setUploadOpen(true)}><FileUpIcon data-icon="inline-start"/>上传样片</Button></EmptyContent></Empty>}
  {uploadOpen&&<div className="modal">
<div className="uploadDialog">
<div className="modalHead">
<div>
<small>UPLOAD REFERENCES</small>
<h2>批量上传样片</h2>
<p>每张照片自动使用原文件名作为样片名称，并统一关联到一个拍摄机位。</p>
</div>
<button onClick={()=>setUploadOpen(false)}>×</button>
</div>
<label>对应点位与拍摄任务<select value={taskId} onChange={e=>{setTaskId(e.target.value);const t=tasks.find(x=>String(x.id)===e.target.value);const station=t?.stations?.find(item=>(t.stationIds||[]).includes(item.id))||t?.stations?.[0];setStationName(station?.name||"")}}>{tasks.map(t=>
<option key={t.id} value={t.id}>{t.district} · {t.location} · {t.timeWindow||"自定义"} · {t.theme}</option>)}</select>
</label>
<label>拍摄机位<input list="station-options" value={stationName} onChange={e=>setStationName(e.target.value)} placeholder="例如：西侧观景台栏杆前"/>
<datalist id="station-options">{(pickedTask?.stations||[]).map(s=>
<option key={s.id} value={s.name}/>)}</datalist>
</label>
<div className="uploadMetaGrid">
<label>拍摄设备<select value={uploadDevice} onChange={e=>setUploadDevice(e.target.value)}>
<option value="">默认空白</option><option>相机</option><option>无人机</option>
</select></label>
<label>拍摄时间<select value={uploadShootTime} onChange={e=>setUploadShootTime(e.target.value)}>
<option value="">默认空白</option>{shootTimes.map(value=><option key={value}>{value}</option>)}
</select></label>
</div>
<label>拍摄位置<input value={uploadLocation} onChange={e=>setUploadLocation(e.target.value)} placeholder="默认空白，可上传后单独编辑"/>
</label>
<label>样片备注<textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="构图、光线、焦段、值得参考的细节……"/>
</label>
<label className="fileDrop">选择照片<input ref={filesRef} type="file" accept="image/*" multiple/>
<small>上传数量不限；支持 JPG、PNG、WebP、GIF、AVIF。超过 4MB 会自动压缩，HEIC/RAW 请先转换。</small>
</label>{uploadError&&<p className="uploadError">{uploadError}</p>}<div className="modalActions">
<button onClick={()=>setUploadOpen(false)}>取消</button>
<button className="primary" disabled={uploading||!stationName.trim()} onClick={upload}>{uploading?progress:"开始上传"}</button>
</div>
</div>
</div>}
  {active&&<div className="lightbox" onClick={()=>{setActive(null);setEditingMeta(false)}}>
<div className="lightboxImage">
{broken.has(active.id)?<div className="brokenLightbox"><strong>这张图片无法解码</strong><span>可在右侧保留原信息并重新上传可显示的图片。</span></div>:<img src={active.url} alt={`${active.location} ${active.stationName}`} onError={()=>setBroken(items=>new Set(items).add(active.id))}/>}
{activeSamples.length>1&&<div className="groupThumbs" onClick={event=>event.stopPropagation()}>{activeSamples.map(item=><button className={item.id===active.id?"active":""} key={item.id} onClick={()=>{setActive(item);setEditingMeta(false)}}><img src={item.url} alt={item.originalName}/></button>)}</div>}
</div>
<aside onClick={e=>e.stopPropagation()}>
<button className="lightboxClose" onClick={()=>{setActive(null);setEditingMeta(false)}}>×</button>
<p className="eyebrow">REFERENCE DETAIL</p>{editingMeta?<div className="sampleEdit">
<h2>编辑样片信息</h2>
<label>样片名称<input value={draft.originalName} onChange={e=>setDraft({...draft,originalName:e.target.value})}/>
</label>
<label>拍摄设备<select value={draft.device||""} onChange={e=>setDraft({...draft,device:e.target.value})}>
<option value="">未填写</option>
<option>相机</option>
<option>无人机</option>
</select>
</label>
<label>关联机位<select value={draft.stationName||""} onChange={e=>{const station=activeTask?.stations?.find(x=>x.name===e.target.value);setDraft({...draft,stationId:station?.id||"",stationName:e.target.value,stationDescription:station?.description||draft.stationDescription})}}>
<option value="">未关联机位</option>
{draft.stationName&&!activeTask?.stations?.some(x=>x.name===draft.stationName)&&<option value={draft.stationName}>{draft.stationName}</option>}
{(activeTask?.stations||[]).map(station=><option key={station.id} value={station.name}>{station.name}</option>)}
</select>
</label>
<label>拍摄时间<select value={draft.shootTime||""} onChange={e=>setDraft({...draft,shootTime:e.target.value})}>
<option value="">未填写</option>
{shootTimes.map(value=><option key={value}>{value}</option>)}
</select>
</label>
<label>拍摄位置<input value={draft.location} placeholder="例如：观景台西侧栏杆" onChange={e=>setDraft({...draft,location:e.target.value})}/>
</label>
<label>主题归类<select value={draft.themeCategory||""} onChange={e=>setDraft({...draft,themeCategory:e.target.value})}>
<option value="">未归类</option>{categories.map(x=>
<option key={x}>{x}</option>)}</select>
</label>
<label>机位说明<textarea value={draft.stationDescription} onChange={e=>setDraft({...draft,stationDescription:e.target.value})}/>
</label>
<label>拍摄主体说明<textarea value={draft.subjectDescription||""} onChange={e=>setDraft({...draft,subjectDescription:e.target.value})}/>
</label>
<label>样片备注<textarea value={draft.note} onChange={e=>setDraft({...draft,note:e.target.value})}/>
</label>{editError&&<p className="uploadError">{editError}</p>}<div className="sampleEditActions">
<button onClick={()=>setEditingMeta(false)}>取消</button>
<button className="primary" disabled={savingMeta||!draft.originalName.trim()} onClick={saveEdit}>{savingMeta?"正在保存…":"保存修改"}</button>
</div>
</div>:<>
<button className="editableTitle" disabled={active.local} onClick={()=>startEdit(active)}>{active.originalName||"未命名样片"}<small>{active.local?"本地样片":"点击编辑"}</small></button>
<span className="galleryTag">{active.district}</span>
<dl>
<div>
<dt>样片名称</dt>
<dd><button className="editableDetail" disabled={active.local} onClick={()=>startEdit(active)}>{active.originalName||"样片"}<small>点击编辑</small></button></dd>
</div>
<div>
<dt>拍摄位置</dt>
<dd><button className="editableDetail" disabled={active.local} onClick={()=>startEdit(active)}>{active.location||"未填写"}<small>点击编辑</small></button></dd>
</div>
<div>
<dt>拍摄设备</dt>
<dd><button className="editableDetail" disabled={active.local} onClick={()=>startEdit(active)}>{active.device||"未填写"}<small>点击编辑</small></button></dd>
</div>
<div>
<dt>拍摄时间</dt>
<dd><button className="editableDetail" disabled={active.local} onClick={()=>startEdit(active)}>{active.shootTime||"未填写"}<small>点击编辑</small></button></dd>
</div>
<div>
<dt>主题归类</dt>
<dd><button className="editableDetail" disabled={active.local} onClick={()=>startEdit(active)}>{active.themeCategory||"未归类"}<small>点击编辑</small></button></dd>
</div>
<div>
<dt>关联机位</dt>
<dd><button className="editableDetail" disabled={active.local} onClick={()=>startEdit(active)}>{active.stationName||"未指定"}<small>点击编辑</small></button></dd>
</div>
<div>
<dt>机位说明</dt>
<dd><button className="editableDetail" disabled={active.local} onClick={()=>startEdit(active)}>{active.stationDescription||"暂无说明"}<small>点击编辑</small></button></dd>
</div>
<div>
<dt>拍摄主题</dt>
<dd>{active.theme||"常规记录"}</dd>
</div>
<div>
<dt>拍摄主体说明</dt>
<dd><button className="editableDetail" disabled={active.local} onClick={()=>startEdit(active)}>{active.subjectDescription||"暂无说明"}<small>点击编辑</small></button></dd>
</div>
<div>
<dt>样片备注</dt>
<dd><button className="editableDetail" disabled={active.local} onClick={()=>startEdit(active)}>{active.note||"暂无备注"}<small>点击编辑</small></button></dd>
</div>
</dl>{!active.local&&<label className="soft full reuploadButton">{broken.has(active.id)?"重新上传图片":"替换图片"}<input hidden type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" onChange={e=>reupload(active,e.target.files?.[0])}/></label>}<button className="primary full" onClick={()=>onEdit(Number(active.taskId))}>打开对应拍摄任务</button>{!active.local&&<button className="dangerText" onClick={()=>remove(active)}>删除这张样片</button>}</>}</aside>
</div>}<AlertDialog open={Boolean(pendingMerge)} onOpenChange={open=>{if(!open&&!merging)setPendingMerge(null)}}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>合并同机位样片</AlertDialogTitle><AlertDialogDescription>合并后，画廊首页会以一张组图卡片集中展示；原始图片不会被删除或覆盖。</AlertDialogDescription></AlertDialogHeader>{pendingMerge&&<div className="mergePreview">{[pendingMerge.source,pendingMerge.target].map(key=>{const item=sampleGroups.find(groupItem=>groupItem.key===key);return item&&<article key={key}><img src={item.cover.url} alt={item.cover.originalName}/><span><b>{item.cover.originalName}</b><small>{item.samples.length} 张 · {item.cover.stationName}</small></span></article>})}</div>}<AlertDialogFooter><AlertDialogCancel disabled={merging}>取消</AlertDialogCancel><AlertDialogAction disabled={merging} onClick={mergeGroups}>{merging?<><Spinner data-icon="inline-start"/>正在合并</>:"确认合并"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></section>
}

function Calendar({month,setMonth,events,onSave,onDelete,onSync}:{month:string;setMonth:(m:string)=>void;events:CalendarEvent[];onSave:(item:CalendarEvent,isNew:boolean)=>Promise<boolean>;onDelete:(id:string)=>Promise<boolean>;onSync:()=>void}){
  const [selected,setSelected]=useState<CalendarEvent|null>(null);const [draft,setDraft]=useState<CalendarEvent|null>(null);const [isNew,setIsNew]=useState(false);const [saving,setSaving]=useState(false);
  const [y,m]=month.split("-").map(Number);const days=new Date(y,m,0).getDate();const offset=(new Date(y,m-1,1).getDay()+6)%7;const cells=Array.from({length:offset+days},(_,i)=>i<offset?0:i-offset+1);
  function move(x:number){const d=new Date(y,m-1+x,1);setMonth(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`)}
  function create(date:string){setSelected(null);setIsNew(true);setDraft({id:crypto.randomUUID(),title:"新拍摄日程",location:"",eventDate:date,startTime:"06:00",endTime:"08:00"})}
  async function save(){if(!draft)return;if(!draft.title.trim()){alert("请填写日程名称");return}if(draft.startTime>=draft.endTime){alert("结束时间需要晚于开始时间");return}setSaving(true);if(await onSave({...draft,title:draft.title.trim(),location:draft.location.trim()},isNew)){setSelected(null);setDraft(null)}setSaving(false)}
  return <><section className="calendarPanel">
<div className="calendarHead">
<div>
<p className="eyebrow">SHOOTING SCHEDULE</p>
<h2>{y} 年 {m} 月</h2>
<small className="calendarHint">右键点击某一天新建日程</small>
</div>
<div className="calendarActions">
<button onClick={onSync}> 同步 Apple 日历</button>
<button onClick={()=>move(-1)}>← 上月</button>
<button onClick={()=>setMonth(currentMonth())}>本月</button>
<button onClick={()=>move(1)}>下月 →</button>
</div>
</div>
<div className="week">{["周一","周二","周三","周四","周五","周六","周日"].map(x=>
<b key={x}>{x}</b>)}</div>
<div className="calendarGrid">{cells.map((d,i)=>{const date=d?`${month}-${String(d).padStart(2,"0")}`:"";const items=events.filter(event=>event.eventDate===date);return <div className={`day ${!d?"blank":""}`} key={i} onContextMenu={event=>{if(!d)return;event.preventDefault();create(date)}}>{d>0&&<span>{d}</span>}{items.slice(0,4).map(item=>
<button key={item.id} className="event" onClick={()=>setSelected(item)}>
<b>{item.title}</b>
<small>{item.startTime}–{item.endTime}{item.location?` · ${item.location}`:""}</small>
</button>)}{items.length>4&&<small className="more">另有 {items.length-4} 项</small>}</div>})}</div>
</section>{selected&&<div className="modal"><div className="eventDialog">
<div className="modalHead"><div><small>SCHEDULE DETAIL</small><h2>{selected.title}</h2><p>{selected.eventDate} · {selected.startTime}–{selected.endTime}</p></div><button onClick={()=>setSelected(null)}>×</button></div>
<dl className="eventDetail"><div><dt>日程名称</dt><dd>{selected.title}</dd></div><div><dt>拍摄位置</dt><dd>{selected.location||"未填写"}</dd></div><div><dt>时间</dt><dd>{selected.eventDate} {selected.startTime}–{selected.endTime}</dd></div></dl>
<div className="modalActions"><button className="dangerText" onClick={async()=>{if(await onDelete(selected.id))setSelected(null)}}>删除</button><button className="primary" onClick={()=>{setDraft({...selected});setIsNew(false);setSelected(null)}}>编辑日程</button></div>
</div></div>}{draft&&<div className="modal"><div className="eventDialog">
<div className="modalHead"><div><small>{isNew?"NEW SCHEDULE":"EDIT SCHEDULE"}</small><h2>{isNew?"新建拍摄日程":"编辑拍摄日程"}</h2></div><button onClick={()=>setDraft(null)}>×</button></div>
<label>日程名称<input value={draft.title} autoFocus onChange={event=>setDraft({...draft,title:event.target.value})}/></label>
<label>位置信息<input value={draft.location} placeholder="例如：千厮门大桥北侧观景台" onChange={event=>setDraft({...draft,location:event.target.value})}/></label>
<label>拍摄日期<input type="date" value={draft.eventDate} onChange={event=>setDraft({...draft,eventDate:event.target.value})}/></label>
<div className="eventFormGrid"><label>开始时间<input type="time" value={draft.startTime} onChange={event=>setDraft({...draft,startTime:event.target.value})}/></label><label>结束时间<input type="time" value={draft.endTime} onChange={event=>setDraft({...draft,endTime:event.target.value})}/></label></div>
<div className="modalActions"><button onClick={()=>setDraft(null)}>取消</button><button className="primary" disabled={saving} onClick={save}>{saving?"正在保存…":"保存日程"}</button></div>
</div></div>}</>}

const themeIcon=(name:string)=>{const icons:Record<string,string>={彩虹:"rainbow.png",朝霞:"dawn.png",晚霞:"sunset.png",寺庙:"temple.png",日月对齐:"sun-moon.png",太阳月亮同框:"sun-moon.png",桥梁:"bridge.png",大桥:"bridge.png",立交:"interchange.png",立交桥:"interchange.png",雷电:"lightning.png",雨天:"rain.png",轨道交通:"transit.png",地铁:"transit.png",星空:"starry.png",星空摄影:"starry.png",老街:"old-street.png",老街巷:"old-street.png",长江索道:"cableway.png",索道:"cableway.png",字母:"letters.png",数字:"numbers.png"};return icons[name]?`${assetBase}theme-icons/${icons[name]}`:""};
function ThemeManager({records,points,tasks,onAdd,onRename,onDelete,onOpen,onEdit}:{records:ThemeRecord[];points:PointRecord[];tasks:Task[];onAdd:()=>void;onRename:(record:ThemeRecord)=>void;onDelete:(record:ThemeRecord)=>void;onOpen:(name:string)=>void;onEdit:(id:number)=>void}){
  const [activeId,setActiveId]=useState<string|null>(null);const active=records.find(record=>record.id===activeId);const related=active?points.filter(point=>point.themeNames.some(theme=>normalizeThemeName(theme)===normalizeThemeName(active.name))):[];const activeCounts={pointCount:related.length,stationCount:related.reduce((sum,point)=>sum+point.stations.length,0)};
  return <><section className="themeManager">
<div className="themeManagerHead"><div><p className="eyebrow">CREATIVE THEMES</p><h2>创作主题</h2><p>用图标快速找到天气、天象与城市题材；点击卡片查看主题下的全部点位和机位。</p></div><button className="primary" onClick={onAdd}>＋ 新增创作主题</button></div>
<div className="themeGrid">{records.map(record=>{const pointCount=points.filter(point=>point.themeNames.some(theme=>normalizeThemeName(theme)===normalizeThemeName(record.name))).length;const icon=themeIcon(record.name);return <article className="themeCard" key={record.id}>
<button className="themeCardOpen" onClick={()=>setActiveId(record.id)}><span className="themeCardIcon">{icon?<img src={icon} alt=""/>:<b>{record.name.slice(0,1)}</b>}</span><span className="themeCardCopy"><strong>{record.name}</strong><em>{pointCount} 个关联点位</em></span><span className="themeCardArrow">↗</span></button>
<div className="themeCardActions"><button aria-label={`编辑${record.name}名称`} title="编辑名称" onClick={()=>onRename(record)}>✎</button><button aria-label={`删除${record.name}主题`} title="删除主题" onClick={()=>onDelete(record)}>⌫</button></div>
</article>})}</div></section>
{active&&<div className="modal themeDetailModal" onClick={()=>setActiveId(null)}><div className="themeDetailDialog" onClick={event=>event.stopPropagation()}><div className="modalHead"><div><small>THEME DETAIL</small><h2>{active.name}</h2><p>{activeCounts.pointCount} 个关联点位 · {activeCounts.stationCount} 个关联机位</p></div><button onClick={()=>setActiveId(null)}>×</button></div>
<div className="themeDetailHero"><span className="themeDetailIcon">{themeIcon(active.name)?<img src={themeIcon(active.name)} alt=""/>:<b>{active.name.slice(0,1)}</b>}</span><div><strong>{active.name}拍摄清单</strong><p>集中查看该主题下的点位状态、优先级、拍摄方式和全部机位。</p></div><button onClick={()=>{setActiveId(null);onOpen(active.name)}}>在点位库中查看 →</button></div>
<div className="themeDetailList">{related.length?related.map(point=>{const pointTasks=tasks.filter(task=>task.pointId===point.id);const state:Status=pointTasks.length&&pointTasks.every(task=>task.status==="已毕业")?"已毕业":pointTasks.some(task=>task.status==="待补拍")?"待补拍":"未拍摄";return <article key={point.id}><div className="themeDetailTitle"><div><span>{point.district}</span><h3>{point.location}</h3></div><span className={`status status-${state}`}>{state}</span></div><div className="themeDetailMeta"><span>点位优先级 {point.priority}</span><span>{pointTasks.length} 个拍摄任务</span><span>{point.stations.length} 个机位</span></div><div className="themeDetailStations"><small>拍摄机位</small><p>{point.stations.length?point.stations.map(station=>`${station.name}${station.description?`（${station.description}）`:""}`).join("；"):"尚未添加机位"}</p></div><p className="themeDetailNote">任务：{pointTasks.length?pointTasks.map(task=>`${task.timeWindow||"自定义"} · ${task.theme}`).join("；"):"尚未创建拍摄任务"}</p><button className="themeTaskEdit" onClick={()=>{setActiveId(null);pointTasks[0]?onEdit(pointTasks[0].id):onOpen(active.name)}}>{pointTasks[0]?"查看并编辑任务 →":"在点位库中查看 →"}</button></article>}):<div className="themeDetailEmpty"><strong>暂无关联点位</strong><p>可以先在点位详情中勾选这个创作主题。</p></div>}</div>
</div></div>}</>}

function Coverage({points,tasks,categories}:{points:PointRecord[];tasks:Task[];categories:string[]}){const districts=[...new Set(points.map(point=>point.district))].map(name=>{const districtPoints=points.filter(point=>point.district===name);const done=districtPoints.filter(point=>{const pointTasks=tasks.filter(task=>task.pointId===point.id);return pointTasks.length>0&&pointTasks.every(task=>task.status==="已毕业")}).length;return{name,total:districtPoints.length,done}});const categoryStats=categories.map(name=>{const themed=points.filter(point=>point.themeNames.includes(name));const done=themed.filter(point=>{const pointTasks=tasks.filter(task=>task.pointId===point.id);return pointTasks.length>0&&pointTasks.every(task=>task.status==="已毕业")}).length;return{name,total:themed.length,done}}).filter(item=>item.total>0).sort((a,b)=>b.total-a.total);return <section className="coverage">
<div className="coverageIntro">
<p className="eyebrow">COVERAGE REPORT</p>
<h2>区域与主题归类覆盖率</h2>
<p>区域和创作主题均按点位统计；点位下全部拍摄任务完成后计为毕业。</p>
</div>
<div className="coverageGrid">
<article>
<h3>行政区域覆盖</h3>{districts.map(x=>
<Bar key={x.name} {...x}/>)}</article>
<article>
<h3>主题归类覆盖</h3>{categoryStats.map(x=>
<Bar key={x.name} {...x}/>)}</article>
</div>
<article className="gapList">
<h3>下一批优先补齐</h3>
<div>{tasks.filter(t=>t.status!=="已毕业").sort((a,b)=>priorityRank[b.priority]-priorityRank[a.priority]).slice(0,12).map(t=>
<span key={t.id}>
<b>{t.location}</b>{t.themeCategory||"未归类"} · {t.theme} · {t.status}</span>)}</div>
</article>
</section>}
function Bar({name,total,done}:{name:string;total:number;done:number}){const p=Math.round(done/(total||1)*100);return <div className="barRow">
<div>
<span>{name}</span>
<b>{p}%</b>
</div>
<div className="bar">
<i style={{width:`${p}%`}}/>
</div>
<small>{done} / {total}</small>
</div>}

function Editor({task,update,close,addStation,addSamples}:{task:Task;update:(p:Partial<Task>)=>void;close:()=>void;addStation:()=>void;addSamples:(f:FileList|null)=>void}){return <div className="modal editorModal">
<div className="editor">
<div className="modalHead">
<div>
<small>TASK WORKBENCH</small>
<h2>{task.location}</h2>
<p>{task.district} · 拍摄任务 · {task.timeWindow||"自定义时段"}</p>
</div>
<button onClick={close}>×</button>
</div>
<div className="editGrid">
<label>任务名称<input value={task.theme} placeholder="例如：朝霞广角全景" onChange={e=>update({theme:e.target.value})}/></label>
<label>拍摄时间<select value={task.timeWindow||"自定义"} onChange={e=>update({timeWindow:e.target.value})}>{[...shootTimes,"自定义"].map(value=><option key={value}>{value}</option>)}</select></label>
<label>拍摄方式<input value={task.methods.join("、")} placeholder="延时视频、无人机航拍" onChange={e=>update({methods:split(e.target.value)})}/></label>
<label>素材类型<input value={task.media.join("、")} placeholder="照片、视频" onChange={e=>update({media:split(e.target.value)})}/></label>
<label>通透度要求<select value={task.clarity} onChange={e=>update({clarity:e.target.value})}>{["低","中","高","极高"].map(value=><option key={value}>{value}</option>)}</select></label>
<label>计划日期<input type="date" value={task.scheduleDate||""} onChange={e=>update({scheduleDate:e.target.value})}/>
</label>
<label>计划时段<input value={task.scheduleSlot||""} placeholder="17:30-20:00" onChange={e=>update({scheduleSlot:e.target.value})}/>
</label>
<label>状态<select value={task.status} onChange={e=>update({status:e.target.value as Status})}>{statuses.map(x=>
<option key={x}>{x}</option>)}</select>
</label>
<label>优先级<select value={task.priority} onChange={e=>update({priority:e.target.value as Priority})}>
<option>高</option>
<option>中</option>
<option>低</option>
</select>
</label>
</div>
<label>补拍原因<textarea value={task.retakeReason||""} placeholder="为什么需要补拍？" onChange={e=>update({retakeReason:e.target.value})}/>
</label>
<label>缺失镜头<textarea value={task.missingShots||""} placeholder="广角全景、人物关系、蓝调延时……" onChange={e=>update({missingShots:e.target.value})}/>
</label>
<label>毕业标准<textarea value={task.graduationCriteria||""} placeholder="满足哪些画面、天气与技术条件才算完成？" onChange={e=>update({graduationCriteria:e.target.value})}/>
</label>
<div className="sectionTitle">
<div><h3>点位机位</h3><p className="micro">机位属于点位；勾选后才与当前拍摄任务关联。</p></div>
<button onClick={addStation}>＋ 添加机位</button>
</div>
<div className="stationList">{(task.stations||[]).map((s,i)=>
<div key={s.id}>
<Checkbox checked={(task.stationIds||[]).includes(s.id)} aria-label={`关联机位${s.name}`} onCheckedChange={checked=>update({stationIds:checked?[...new Set([...(task.stationIds||[]),s.id])]:(task.stationIds||[]).filter(id=>id!==s.id)})}/>
<input value={s.name} onChange={e=>update({stations:task.stations!.map((x,j)=>j===i?{...x,name:e.target.value}:x)})}/>
<input value={s.description} placeholder="机位方向、限制、焦段建议" onChange={e=>update({stations:task.stations!.map((x,j)=>j===i?{...x,description:e.target.value}:x)})}/>
<button onClick={()=>update({stations:task.stations!.filter(x=>x.id!==s.id)})}>移除</button>
</div>)}{!task.stations?.length&&<p className="sub">还没有机位，先添加一个勘景机位。</p>}</div>
<div className="sectionTitle">
<h3>样片管理</h3>
<label className="upload">＋ 上传样片<input hidden type="file" accept="image/*" multiple onChange={e=>addSamples(e.target.files)}/>
</label>
</div>
<div className="samples">{(task.samples||[]).map(s=>
<figure key={s.id}>
<img src={s.url} alt={s.name}/>
<figcaption>{s.name}</figcaption>
<button onClick={()=>update({samples:task.samples!.filter(x=>x.id!==s.id)})}>×</button>
</figure>)}</div>
<div className="modalActions">
<button className="primary" onClick={close}>完成</button>
</div>
</div>
</div>}
