"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import sourceData from "./spots.json";

type Status = "未拍摄" | "待补拍" | "已毕业";
type Priority = "低" | "中" | "高";
type ThemeCategory = string;
type View = "library" | "gallery" | "map" | "calendar" | "themes" | "coverage";
type CalendarEvent = { id:string; title:string; location:string; eventDate:string; startTime:string; endTime:string; createdAt?:number; updatedAt?:number };
type ThemeRecord = { id:string; name:string; createdAt?:number };
type Station = { id: string; name: string; description: string };
type Sample = { id: string; name: string; url: string };
type GallerySample = { id:string; url:string; uploadedAt:string; size?:number; taskId:string; district:string; location:string; theme:string; themeCategory?:string; device?:string; shootTime?:string; stationId:string; stationName:string; stationDescription:string; subjectDescription?:string; note:string; originalName:string; local?:boolean };
type SampleDraft = Pick<GallerySample,"originalName"|"location"|"themeCategory"|"device"|"shootTime"|"stationId"|"stationName"|"stationDescription"|"subjectDescription"|"note">;
type UploadPart = { partNumber:number; etag:string };
type UploadJob = { jobId:string; file:File; taskId:string; district:string; location:string; theme:string; themeCategory:string; device:string; shootTime:string; stationId:string; stationName:string; stationDescription:string; note:string; originalName:string; uploadId?:string; objectId?:string; parts:UploadPart[]; status:"waiting"|"uploading"|"failed"; error?:string; createdAt:number };
type Task = {
  id:number; district:string; location:string; priority:Priority; theme:string; themeCategory?:string; methods:string[]; media:string[];
  clarity:string; status:Status; note:string; sourceRow:number; longitude?:number; latitude?:number;
  scheduleDate?:string; scheduleSlot?:string; stations?:Station[]; samples?:Sample[]; retakeReason?:string;
  missingShots?:string; graduationCriteria?:string; coordinateSystem?:"wgs84"|"gcj02";
};
type WeatherDay = { date:string; sunrise:string; sunset:string; cloud:number; visibility:number; code:number };
type RouteInfo = { distance:number; duration:number; geometry:[number,number][] };

const districtCenters:Record<string,[number,number]> = {
  渝中区:[106.555,29.557], 江北区:[106.574,29.606], 南岸区:[106.620,29.522], 沙坪坝区:[106.455,29.555],
  九龙坡区:[106.505,29.503], 大渡口区:[106.482,29.476], 渝北区:[106.630,29.718], 巴南区:[106.540,29.402]
};
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
const normalizeTask=(t:Task):Task=>({...t,themeCategory:t.themeCategory==="地铁"?"轨道交通":t.themeCategory||inferThemeCategory(t.theme),stations:t.stations||[],samples:t.samples||[],graduationCriteria:t.graduationCriteria||""});
const baseTasks=(sourceData as unknown as Task[]).map(normalizeTask);
const split=(v:unknown)=>String(v||"").split(/[，,、;；]/).map(x=>x.trim()).filter(Boolean);
const n=(v:unknown)=>{const x=Number(v);return Number.isFinite(x)?x:undefined};
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
const group=(tasks:Task[])=>[...new Map(tasks.map(t=>[`${t.district}::${t.location}`,0])).keys()].map(key=>{
  const items=tasks.filter(t=>`${t.district}::${t.location}`===key);
  const state:Status=items.every(x=>x.status==="已毕业")?"已毕业":items.some(x=>x.status==="待补拍")?"待补拍":"未拍摄";
  return {key,district:items[0].district,location:items[0].location,tasks:items,status:state,priority:[...items].sort((a,b)=>priorityRank[b.priority]-priorityRank[a.priority])[0].priority};
});

function MapCanvas({tasks,route,onPick}:{tasks:Task[];route:RouteInfo|null;onPick:(t:Task)=>void}){
  const el=useRef<HTMLDivElement>(null);const map=useRef<any>(null);const [ready,setReady]=useState(false);const [mapError,setMapError]=useState("");
  useEffect(()=>{let active=true;(async()=>{try{const AMap=await loadAMap();if(!active||!el.current)return;map.current=new AMap.Map(el.current,{viewMode:"3D",zoom:11,center:[106.551,29.563],mapStyle:"amap://styles/normal"});map.current.addControl(new AMap.Scale());map.current.addControl(new AMap.ToolBar({position:{top:"16px",right:"16px"}}));setReady(true)}catch(reason){if(active)setMapError(reason instanceof Error?reason.message:"高德地图加载失败")}})();return()=>{active=false;map.current?.destroy();map.current=null}},[]);
  useEffect(()=>{if(!ready||!map.current)return;const AMap=(window as any).AMap;map.current.clearMap();const overlays:any[]=[];tasks.forEach(t=>{const [lat,lng]=t.latitude&&t.longitude?[t.latitude,t.longitude]:coord(t);const color=t.status==="已毕业"?"#3e7b61":t.status==="待补拍"?"#d99434":"#e86632";const marker=new AMap.Marker({position:[lng,lat],anchor:"center",title:`${t.location} · ${t.theme}`,content:`<span class="amapSpot" style="--marker:${color}"></span>`});marker.on("click",()=>onPick(t));map.current.add(marker);overlays.push(marker)});if(route?.geometry.length){const line=new AMap.Polyline({path:route.geometry.map(([lat,lng])=>[lng,lat]),strokeColor:"#e86632",strokeWeight:5,strokeOpacity:.9,showDir:true});map.current.add(line);overlays.push(line)}if(overlays.length)map.current.setFitView(overlays,false,[45,45,45,45],13)},[tasks,route,onPick,ready]);
  return <div ref={el} className="realMap">{mapError&&<div className="mapLoadError">{mapError}</div>}</div>;
}

export default function Home(){
  const [tasks,setTasks]=useState<Task[]>(baseTasks); const [hydrated,setHydrated]=useState(false); const [view,setView]=useState<View>("library");
  const [themeMode,setThemeMode]=useState<"light"|"dark">("light");
  const [district,setDistrict]=useState("全部行政区"); const [status,setStatus]=useState("全部状态"); const [priority,setPriority]=useState("全部优先级"); const [category,setCategory]=useState("全部归类"); const [query,setQuery]=useState("");
  const [expanded,setExpanded]=useState<string|null>(null); const [editing,setEditing]=useState<number|null>(null); const [mapTask,setMapTask]=useState<number|null>(null);
  const [routeIds,setRouteIds]=useState<number[]>([]); const [route,setRoute]=useState<RouteInfo|null>(null); const [routeLoading,setRouteLoading]=useState(false); const [amapLocating,setAmapLocating]=useState(false); const amapSyncing=useRef(false);
  const [weather,setWeather]=useState<WeatherDay[]>([]); const [weatherLoading,setWeatherLoading]=useState(false); const [month,setMonth]=useState(currentMonth);
  const [calendarEvents,setCalendarEvents]=useState<CalendarEvent[]>([]);
  const [themeRecords,setThemeRecords]=useState<ThemeRecord[]>(()=>defaultThemeCategories.map((name,index)=>({id:`fallback-${index}`,name})));
  const themeCategories=themeRecords.map(record=>record.name);
  const inputRef=useRef<HTMLInputElement>(null);
  useEffect(()=>{const saved=localStorage.getItem("shancheng-photo-tasks-v2")||localStorage.getItem("shancheng-photo-tasks-v1");if(saved)try{setTasks((JSON.parse(saved) as Task[]).map(normalizeTask))}catch{}setThemeMode(document.documentElement.dataset.theme==="dark"?"dark":"light");setHydrated(true)},[]);
  useEffect(()=>{if(hydrated)localStorage.setItem("shancheng-photo-tasks-v2",JSON.stringify(tasks))},[tasks,hydrated]);
  useEffect(()=>{(async()=>{try{const response=await fetch("/api/planner",{cache:"no-store"});if(!response.ok)throw new Error();const data=await response.json();setCalendarEvents(Array.isArray(data.events)?data.events:[]);if(Array.isArray(data.themes)&&data.themes.length)setThemeRecords(data.themes)}catch{}})()},[]);
  useEffect(()=>{if(view==="map")locateAllPoints()},[view]);
  const groups=useMemo(()=>group(tasks),[tasks]); const districts=useMemo(()=>[...new Set(tasks.map(t=>t.district))],[tasks]);
  const filtered=useMemo(()=>groups.filter(g=>(district==="全部行政区"||g.district===district)&&(status==="全部状态"||g.status===status)&&(priority==="全部优先级"||g.priority===priority)&&(category==="全部归类"||g.tasks.some(t=>(t.themeCategory||"")===category))&&`${g.location} ${g.district} ${g.tasks.map(t=>`${t.themeCategory||"未归类"} ${t.theme} ${t.methods} ${t.note}`).join(" ")}`.toLowerCase().includes(query.toLowerCase())).sort((a,b)=>priorityRank[b.priority]-priorityRank[a.priority]),[groups,district,status,priority,category,query]);
  const counts={unshot:tasks.filter(t=>t.status==="未拍摄").length,redo:tasks.filter(t=>t.status==="待补拍").length,done:tasks.filter(t=>t.status==="已毕业").length};
  const selected=tasks.find(t=>t.id===(editing??mapTask)); const mappedTasks=tasks;
  const update=(id:number,patch:Partial<Task>)=>setTasks(x=>x.map(t=>t.id===id?{...t,...patch}:t));

  async function importExcel(file:File){
    if(!(await ensureAdmin()))return;
    const wb=XLSX.read(await file.arrayBuffer(),{type:"array",cellDates:true}); const ws=wb.Sheets[wb.SheetNames[0]]; const rows=XLSX.utils.sheet_to_json<Record<string,unknown>>(ws,{defval:""}); let lastDistrict="",lastLocation="";
    const imported=rows.map((r,i)=>{lastDistrict=String(r["行政区域"]||lastDistrict).trim();lastLocation=String(r["点位名称"]||lastLocation).trim();const station=String(r["机位名称"]||"").trim();const theme=String(r["拍摄主题"]||"常规记录");const rawCategory=String(r["主题归类"]||"").trim();const longitude=n(r["经度"]),latitude=n(r["纬度"]);return {id:i+1,district:lastDistrict||"待分类",location:lastLocation||`未命名点位 ${i+1}`,priority:(["高","中","低"].includes(String(r["优先级"]))?String(r["优先级"]):"低") as Priority,theme,themeCategory:themeCategories.includes(rawCategory as ThemeCategory)?rawCategory:inferThemeCategory(theme),methods:split(r["拍摄方式"]||"待规划"),media:split(r["素材类型"]||"待规划"),clarity:String(r["通透度要求"]||"低"),status:(statuses.includes(String(r["拍摄状态"]) as Status)?String(r["拍摄状态"]):"未拍摄") as Status,note:String(r["备注"]||""),sourceRow:i+2,longitude,latitude,coordinateSystem:longitude&&latitude&&String(r["坐标系"]||"").toLowerCase()==="gcj02"?"gcj02":longitude&&latitude?"wgs84":undefined,scheduleDate:r["计划日期"] instanceof Date?(r["计划日期"] as Date).toISOString().slice(0,10):String(r["计划日期"]||""),scheduleSlot:String(r["计划时段"]||""),stations:station?[{id:`s-${i}`,name:station,description:String(r["机位说明"]||"")}]:[],samples:String(r["样片链接"]||"").trim()?[{id:`p-${i}`,name:"Excel 样片",url:String(r["样片链接"])}]:[],retakeReason:String(r["补拍原因"]||""),missingShots:String(r["缺失镜头"]||""),graduationCriteria:String(r["毕业标准"]||"")};}).filter(t=>t.location);
    if(imported.length&&confirm(`识别到 ${imported.length} 条任务，替换当前数据吗？`)){setTasks(imported);setView("library");}
  }
  function exportExcel(){const rows=tasks.map(t=>({行政区域:t.district,点位名称:t.location,优先级:t.priority,拍摄主题:t.theme,主题归类:t.themeCategory||"",拍摄方式:t.methods.join("、"),素材类型:t.media.join("、"),通透度要求:t.clarity,拍摄状态:t.status,经度:t.longitude||"",纬度:t.latitude||"",坐标系:t.coordinateSystem||"",计划日期:t.scheduleDate||"",计划时段:t.scheduleSlot||"",机位名称:(t.stations||[]).map(s=>s.name).join("、"),机位说明:(t.stations||[]).map(s=>s.description).join("；"),补拍原因:t.retakeReason||"",缺失镜头:t.missingShots||"",毕业标准:t.graduationCriteria||"",样片链接:(t.samples||[]).map(s=>s.url.startsWith("data:")?"本地样片":s.url).join("、"),备注:t.note}));const ws=XLSX.utils.json_to_sheet(rows);ws["!cols"]=Object.keys(rows[0]||{}).map((_,i)=>({wch:[12,24,8,14,12,20,14,11,11,12,12,10,13,14,20,26,24,24,28,24,24][i]}));const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,"点位数据");XLSX.writeFile(wb,`重庆拍摄点位_${new Date().toISOString().slice(0,10)}.xlsx`)}
  async function loadWeather(t:Task){setMapTask(t.id);setWeatherLoading(true);const [lat,lon]=coord(t);try{const url=`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=cloud_cover,visibility,weather_code&daily=sunrise,sunset&timezone=Asia%2FShanghai&forecast_days=7`;const d=await fetch(url).then(r=>r.json());setWeather(d.daily.time.map((date:string,i:number)=>{const idx=d.hourly.time.map((x:string)=>x.slice(0,10)).reduce((a:string[],x:string,j:number)=>x===date?[...a,j]:a,[]);return{date,sunrise:d.daily.sunrise[i].slice(11,16),sunset:d.daily.sunset[i].slice(11,16),cloud:Math.round(idx.reduce((s:number,j:number)=>s+d.hourly.cloud_cover[j],0)/(idx.length||1)),visibility:Math.round(Math.max(...idx.map((j:number)=>d.hourly.visibility[j]))/1000),code:d.hourly.weather_code[idx[12]||idx[0]]}}))}catch{setWeather([])}finally{setWeatherLoading(false)}}
  async function locateAllPoints(){if(amapSyncing.current)return;const unique=[...new Map(tasks.map(task=>[`${task.district}::${task.location}`,task])).values()];const missing=unique.filter(task=>!task.longitude||!task.latitude);const gps=unique.filter(task=>task.longitude&&task.latitude&&task.coordinateSystem!=="gcj02");if(!missing.length&&!gps.length)return;amapSyncing.current=true;setAmapLocating(true);try{const updates=new Map<string,{longitude:number;latitude:number}>();for(let i=0;i<missing.length;i+=20){const batch=missing.slice(i,i+20);const response=await fetch("/api/amap-locate",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"locate",items:batch.map(task=>({key:`${task.district}::${task.location}`,district:task.district,location:task.location}))})});const data=await response.json();if(!response.ok)throw new Error(data.error||"点位解析失败");for(const item of data.items||[])if(item.longitude&&item.latitude)updates.set(item.key,{longitude:item.longitude,latitude:item.latitude})}for(let i=0;i<gps.length;i+=40){const batch=gps.slice(i,i+40);const response=await fetch("/api/amap-locate",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"convert",items:batch.map(task=>({key:`${task.district}::${task.location}`,longitude:task.longitude,latitude:task.latitude}))})});const data=await response.json();if(!response.ok)throw new Error(data.error||"坐标转换失败");for(const item of data.items||[])if(item.longitude&&item.latitude)updates.set(item.key,{longitude:item.longitude,latitude:item.latitude})}if(updates.size)setTasks(items=>items.map(task=>{const found=updates.get(`${task.district}::${task.location}`);return found?{...task,...found,coordinateSystem:"gcj02"}:task}))}catch(reason){alert(reason instanceof Error?reason.message:"暂时无法定位全部点位")}finally{setAmapLocating(false);amapSyncing.current=false}}
  async function planRoute(){const pts=routeIds.map(id=>tasks.find(t=>t.id===id)).filter(Boolean) as Task[];if(pts.length<2)return;setRouteLoading(true);try{const response=await fetch("/api/amap-locate",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"route",locations:pts.map(task=>{const [latitude,longitude]=task.latitude&&task.longitude?[task.latitude,task.longitude]:coord(task);return[longitude,latitude]})})});const data=await response.json();setRoute(response.ok&&data.route?data.route:null)}catch{setRoute(null)}finally{setRouteLoading(false)}}
  function addStation(id:number){const t=tasks.find(x=>x.id===id);if(!t)return;update(id,{stations:[...(t.stations||[]),{id:crypto.randomUUID(),name:`机位 ${(t.stations?.length||0)+1}`,description:"待勘景"}]})}
  async function addSamples(id:number,files:FileList|null){if(!files)return;const t=tasks.find(x=>x.id===id);if(!t)return;const accepted=[...files].filter(f=>f.size<=1200000).slice(0,6-(t.samples?.length||0));const samples=await Promise.all(accepted.map(f=>new Promise<Sample>(resolve=>{const r=new FileReader();r.onload=()=>resolve({id:crypto.randomUUID(),name:f.name,url:String(r.result)});r.readAsDataURL(f)})));update(id,{samples:[...(t.samples||[]),...samples]})}
  async function openEditor(id:number){if(await ensureAdmin())setEditing(id)}
  async function changeStatus(t:Task){if(await ensureAdmin())update(t.id,{status:statuses[(statuses.indexOf(t.status)+1)%3]})}
  async function createPoint(){if(!(await ensureAdmin()))return;const id=Math.max(0,...tasks.map(t=>t.id))+1;setTasks([{id,district:districts[0]||"渝中区",location:"新拍摄点位",priority:"低",theme:"常规记录",themeCategory:"",methods:["待规划"],media:["照片"],clarity:"中",status:"未拍摄",note:"",sourceRow:0,stations:[],samples:[]},...tasks]);setEditing(id);setView("library")}
  async function saveCalendarEvent(item:CalendarEvent,isNew:boolean){if(!(await ensureAdmin()))return false;const response=await fetch("/api/planner",{method:isNew?"POST":"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({kind:"event",...item})});const data=await response.json().catch(()=>({}));if(!response.ok){alert(data.error||"日程保存失败");return false}setCalendarEvents(events=>isNew?[...events,data.item].sort((a,b)=>`${a.eventDate}${a.startTime}`.localeCompare(`${b.eventDate}${b.startTime}`)):events.map(event=>event.id===item.id?{...event,...data.item}:event));return true}
  async function removeCalendarEvent(id:string){if(!(await ensureAdmin())||!confirm("删除这条拍摄日程？"))return false;const response=await fetch(`/api/planner?kind=event&id=${encodeURIComponent(id)}`,{method:"DELETE"});if(!response.ok){alert("日程删除失败");return false}setCalendarEvents(events=>events.filter(event=>event.id!==id));return true}
  async function addTheme(){const name=prompt("新拍摄主题名称")?.trim();if(!name||!(await ensureAdmin()))return;const response=await fetch("/api/planner",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({kind:"theme",name})});const data=await response.json().catch(()=>({}));if(!response.ok){alert(data.error||"主题新增失败");return}setThemeRecords(records=>[...records,data.item])}
  async function renameTheme(record:ThemeRecord){const name=prompt("修改拍摄主题名称",record.name)?.trim();if(!name||name===record.name||!(await ensureAdmin()))return;const response=await fetch("/api/planner",{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({kind:"theme",id:record.id,name})});const data=await response.json().catch(()=>({}));if(!response.ok){alert(data.error||"主题修改失败");return}setThemeRecords(records=>records.map(item=>item.id===record.id?{...item,name}:item));setTasks(items=>items.map(task=>task.themeCategory===record.name?{...task,themeCategory:name}:task))}
  async function removeTheme(record:ThemeRecord){if(!confirm(`删除“${record.name}”主题归类？已关联任务将变为未归类。`)||!(await ensureAdmin()))return;const response=await fetch(`/api/planner?kind=theme&id=${encodeURIComponent(record.id)}`,{method:"DELETE"});if(!response.ok){alert("主题删除失败");return}setThemeRecords(records=>records.filter(item=>item.id!==record.id));setTasks(items=>items.map(task=>task.themeCategory===record.name?{...task,themeCategory:""}:task))}
  async function subscribeAppleCalendar(force=false){const consent=localStorage.getItem("apple-calendar-consent");if(!force&&consent)return;if(!force&&!confirm("是否将拍摄日程订阅到 Apple 日历？同意后系统会打开日历并请你确认订阅。")){localStorage.setItem("apple-calendar-consent","declined");return}localStorage.setItem("apple-calendar-consent","accepted");try{const response=await fetch("/api/calendar-feed?setup=1",{cache:"no-store"});const data=await response.json();if(!response.ok)throw new Error(data.error||"订阅暂不可用");window.location.href=data.webcal}catch(reason){alert(reason instanceof Error?reason.message:"暂时无法打开 Apple 日历")}}
  function openView(next:View){if(next==="calendar"){setMonth(currentMonth());setTimeout(()=>subscribeAppleCalendar(false),0)}setView(next)}
  function toggleTheme(){const next=themeMode==="dark"?"light":"dark";setThemeMode(next);document.documentElement.dataset.theme=next;localStorage.setItem("shancheng-theme",next)}
  async function logout(){await Promise.all([fetch("/api/admin",{method:"DELETE"}),fetch("/api/auth",{method:"DELETE"})]);window.location.href="/login"}
  const nav=[{id:"library",label:"点位库"},{id:"gallery",label:"样片画廊"},{id:"map",label:"地图天气"},{id:"calendar",label:"拍摄日历"},{id:"themes",label:"主题整理"},{id:"coverage",label:"覆盖分析"}] as const;

  return <main>
<header className="topbar">
<div className="brand">
<span className="brandMark">焦</span>
<span>山城取景簿</span>
</div>
<nav>{nav.map(x=>
<button key={x.id} className={view===x.id?"navActive":""} onClick={()=>openView(x.id)}>{x.label}</button>)}</nav>
<div className="headerActions">
<button className="soft themeToggle" onClick={toggleTheme} aria-label={themeMode==="dark"?"切换到浅色模式":"切换到暗黑模式"}>{themeMode==="dark"?"☀ 浅色":"◐ 暗色"}</button>
<button className="soft" onClick={async()=>{if(await ensureAdmin())inputRef.current?.click()}}>导入 Excel</button>
<a className="soft" href={`${assetBase}摄影点位导入模板.xlsx`} download>下载模板</a>
<button className="dark" onClick={exportExcel}>导出修改</button>
<button className="soft" onClick={logout}>退出</button>
<input ref={inputRef} hidden type="file" accept=".xlsx,.xls" onChange={e=>e.target.files?.[0]&&importExcel(e.target.files[0])}/>
</div>
  </header>
  <div className={view==="gallery"?"shell galleryShell":"shell"}>
{view!=="gallery"&&<><section className="intro">
<div>
<p className="eyebrow">CHONGQING PHOTO ATLAS · WORKSPACE</p>
<h1>{view==="library"?"把重庆，拍得更完整。":view==="gallery"?"先看见，再抵达。":view==="map"?"先看天，再出发。":view==="calendar"?"把好天气留给重要机位。":view==="themes"?"按主题，整理每一个机位。":"每一个空白，都有下一次出发。"}</h1>
<p>共 {groups.length} 个点位、{tasks.length} 条主题任务；点位修改保存在当前设备，云端样片长期保存。</p>
</div>
{view!=="calendar"&&view!=="themes"&&<button className="primary" onClick={createPoint}>＋ 新建点位</button>}
</section>
  <section className="stats">
<article>
<span className="statIcon orange">⌖</span>
<div>
<small>独立点位</small>
<strong>{groups.length}<i>个</i>
</strong>
<em>覆盖 {districts.length} 个区域</em>
</div>
</article>
<article>
<span className="statIcon blue">◷</span>
<div>
<small>未拍摄任务</small>
<strong>{counts.unshot}<i>条</i>
</strong>
<em>优先安排高优任务</em>
</div>
</article>
<article>
<span className="statIcon amber">↻</span>
<div>
<small>待补拍 / 已毕业</small>
<strong>{counts.redo}<i> / {counts.done}</i>
</strong>
<em>可追踪缺失镜头</em>
</div>
</article>
<article>
<span className="statIcon green">◉</span>
<div>
<small>已安排日程</small>
<strong>{calendarEvents.length}<i>条</i>
</strong>
<em>{tasks.filter(t=>t.longitude&&t.latitude).length} 条含精确坐标</em>
</div>
</article>
</section></>}

  {view==="library"&&<section className="workspace">
<aside>
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
<small>按优先级排序 · 点击展开主题任务</small>
</div>
<div className="spotList">{filtered.map(g=>
<article className={`locationCard ${expanded===g.key?"open":""}`} key={g.key}>
<button className="locationSummary" onClick={()=>setExpanded(expanded===g.key?null:g.key)}>
<span className={`priorityBadge priority-${g.priority}`}>{g.priority}</span>
<div className="locationName">
<div>
<h3>{g.location}</h3>
<span>{g.district}</span>
</div>
<p>{g.tasks.map(t=>`${t.themeCategory?`【${t.themeCategory}】`:""}${t.theme}`).join(" · ")}</p>
</div>
<div className="taskProgress">
<small>主题毕业</small>
<strong>{g.tasks.filter(t=>t.status==="已毕业").length}/{g.tasks.length}</strong>
<div>
<i style={{width:`${g.tasks.filter(t=>t.status==="已毕业").length/g.tasks.length*100}%`}}/>
</div>
</div>
<span className={`status status-${g.status}`}>{g.status}</span>
<span className="chevron">⌄</span>
</button>{expanded===g.key&&<div className="taskPanel">{g.tasks.map(t=>
<div className="taskRow" key={t.id}>
<div className="themeCell">
<small>拍摄主题 · {t.themeCategory||"未归类"}</small>
<strong>{t.theme}</strong>
<p className="micro">{t.scheduleDate?`计划 ${t.scheduleDate} ${t.scheduleSlot||""}`:"尚未排期"}</p>
</div>
<div>
<small>拍摄方式</small>
<div className="tags">{t.methods.map(x=>
<span key={x}>{x}</span>)}</div>
</div>
<div>
<small>机位 / 素材</small>
<div className="tags">
<span>{t.stations?.length||0} 个机位</span>
<span>{t.samples?.length||0} 张样片</span>
<span>通透度 {t.clarity}</span>
</div>
</div>
<div className="taskStatus">
<button className={`status status-${t.status}`} onClick={()=>changeStatus(t)}>{t.status} ↻</button>
<button className="manage" onClick={()=>openEditor(t.id)}>管理 →</button>
</div>
</div>)}</div>}</article>)}</div>
</div>
</section>}

  {view==="gallery"&&<Gallery tasks={tasks} categories={themeCategories} onEdit={async id=>{if(await ensureAdmin()){setEditing(id);setView("library")}}}/>}

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
<div className="routePicker">{tasks.slice(0,80).map(t=>
<label key={t.id}>
<input type="checkbox" checked={routeIds.includes(t.id)} disabled={!routeIds.includes(t.id)&&routeIds.length>=8} onChange={e=>setRouteIds(x=>e.target.checked?[...x,t.id]:x.filter(id=>id!==t.id))}/>
<span>{t.location}</span>
<small>{t.theme}</small>
</label>)}</div>
<button className="primary full" onClick={planRoute} disabled={routeIds.length<2||routeLoading}>{routeLoading?"正在规划…":`规划 ${routeIds.length} 个点位`}</button>{route&&<div className="routeResult">
<strong>{(route.distance/1000).toFixed(1)} km</strong>
<span>预计驾车 {Math.round(route.duration/60)} 分钟</span>
</div>}<hr/>
<h2>天气窗口</h2>{selected?<>
<div className="weatherPlace">
<strong>{selected.location}</strong>
<button onClick={()=>openEditor(selected.id)}>编辑坐标</button>
</div>{weatherLoading?<p className="loading">读取天气中…</p>:weather.length?<div className="weatherDays">{weather.map(w=>
<article key={w.date}>
<div>
<strong>{w.date.slice(5)}</strong>
<small>云量 {w.cloud}% · 能见度 {w.visibility}km</small>
</div>
<span>↑ {w.sunrise}<br/>↓ {w.sunset}</span>
</article>)}</div>:<p className="sub">点击地图上的点位查看 7 日天气。</p>}</>:<p className="sub">点击地图标记，查看云量、能见度与日出日落窗口。</p>}</aside>
</section>}

  {view==="calendar"&&<Calendar month={month} setMonth={setMonth} events={calendarEvents} onSave={saveCalendarEvent} onDelete={removeCalendarEvent} onSync={()=>subscribeAppleCalendar(true)}/>}
  {view==="themes"&&<ThemeManager records={themeRecords} tasks={tasks} onAdd={addTheme} onRename={renameTheme} onDelete={removeTheme} onOpen={name=>{setCategory(name);setView("library")}} onEdit={openEditor}/>}
  {view==="coverage"&&<Coverage tasks={tasks} categories={themeCategories}/>}
  </div>{editing!==null&&selected&&<Editor task={selected} categories={themeCategories} update={p=>update(selected.id,p)} close={()=>setEditing(null)} addStation={()=>addStation(selected.id)} addSamples={f=>addSamples(selected.id,f)}/>}</main>
}

function Gallery({tasks,categories,onEdit}:{tasks:Task[];categories:string[];onEdit:(id:number)=>void}){
  const [remote,setRemote]=useState<GallerySample[]>([]); const [loading,setLoading]=useState(true); const [error,setError]=useState("");
  const [query,setQuery]=useState(""); const [district,setDistrict]=useState("全部行政区"); const [theme,setTheme]=useState("全部主题"); const [category,setCategory]=useState("全部归类");
  const [active,setActive]=useState<GallerySample|null>(null); const [uploadOpen,setUploadOpen]=useState(false); const [uploading,setUploading]=useState(false); const [progress,setProgress]=useState("");
  const [editingMeta,setEditingMeta]=useState(false); const [savingMeta,setSavingMeta]=useState(false); const [editError,setEditError]=useState("");
  const [toast,setToast]=useState<{message:string;kind:"success"|"error"}|null>(null); const toastTimer=useRef<number|undefined>(undefined);
  const [queue,setQueue]=useState<UploadJob[]>([]); const [broken,setBroken]=useState<Set<string>>(new Set());
  const [draft,setDraft]=useState<SampleDraft>({originalName:"",location:"",themeCategory:"",device:"",shootTime:"",stationId:"",stationName:"",stationDescription:"",subjectDescription:"",note:""});
  const [taskId,setTaskId]=useState(String(tasks[0]?.id||"")); const [stationName,setStationName]=useState(""); const [uploadDevice,setUploadDevice]=useState(""); const [uploadShootTime,setUploadShootTime]=useState(""); const [uploadLocation,setUploadLocation]=useState(""); const [note,setNote]=useState(""); const filesRef=useRef<HTMLInputElement>(null);
  const load=async()=>{setLoading(true);setError("");try{const r=await fetch(sampleApi);if(!r.ok)throw new Error();const d=await r.json();setRemote((d.items||[]).map((x:GallerySample)=>({...x,themeCategory:x.themeCategory||inferThemeCategory(x.theme),url:x.url.startsWith("/")?`${sampleApi}${x.url.slice("/api/samples".length)}`:x.url})))}catch{setError("云端样片暂时无法读取，请稍后重试。")}finally{setLoading(false)}};
  useEffect(()=>{load();uploadJobs().then(setQueue).catch(()=>{})},[]);
  const local=useMemo(()=>tasks.flatMap(t=>(t.samples||[]).map(s=>({id:`local-${t.id}-${s.id}`,url:s.url,uploadedAt:"",taskId:String(t.id),district:t.district,location:t.location,theme:t.theme,themeCategory:t.themeCategory||inferThemeCategory(t.theme),stationId:t.stations?.[0]?.id||"",stationName:t.stations?.[0]?.name||"未指定机位",stationDescription:t.stations?.[0]?.description||"",subjectDescription:"",note:t.note||"",originalName:s.name,local:true} as GallerySample))),[tasks]);
  const all=[...remote,...local]; const districts=[...new Set(all.map(x=>x.district).filter(Boolean))]; const themes=[...new Set(all.map(x=>x.theme).filter(Boolean))];
  const shown=all.filter(x=>(district==="全部行政区"||x.district===district)&&(theme==="全部主题"||x.theme===theme)&&(category==="全部归类"||(x.themeCategory||"")===category)&&`${x.location} ${x.stationName} ${x.device||""} ${x.shootTime||""} ${x.themeCategory||"未归类"} ${x.theme} ${x.subjectDescription||""} ${x.note} ${x.originalName}`.toLowerCase().includes(query.toLowerCase()));
  const pickedTask=tasks.find(t=>String(t.id)===taskId);
  const activeTask=active?tasks.find(t=>String(t.id)===active.taskId):undefined;
  function notify(message:string,kind:"success"|"error"){if(toastTimer.current)window.clearTimeout(toastTimer.current);setToast({message,kind});toastTimer.current=window.setTimeout(()=>setToast(null),2600)}
  async function resumeUploads(jobs:UploadJob[]){if(!jobs.length||!(await ensureAdmin()))return;
setUploading(true);
setError("");
for(let index=0;
index<jobs.length;
index++){let job={...jobs[index],status:"uploading" as const,error:""};
try{await saveUploadJob(job);
setQueue(items=>items.map(x=>x.jobId===job.jobId?job:x));
setProgress(`正在续传 ${index+1} / ${jobs.length}：${job.originalName}`);
if(!job.uploadId||!job.objectId){const init=await fetch(sampleApi,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"init",type:job.file.type,size:job.file.size,taskId:job.taskId,district:job.district,location:job.location,theme:job.theme,themeCategory:job.themeCategory,device:job.device,shootTime:job.shootTime,stationId:job.stationId,stationName:job.stationName,stationDescription:job.stationDescription,note:job.note,originalName:job.originalName})});
const data=await init.json().catch(()=>({}));
if(!init.ok)throw new Error(data.error||"无法开始上传");
job={...job,uploadId:data.uploadId,objectId:data.id};
await saveUploadJob(job)}const chunkSize=5*1024*1024;
const total=Math.ceil(job.file.size/chunkSize);
for(let partNumber=1;
partNumber<=total;
partNumber++){if(job.parts.some(p=>p.partNumber===partNumber))continue;
const body=job.file.slice((partNumber-1)*chunkSize,Math.min(partNumber*chunkSize,job.file.size));
let response:Response|null=null;
for(let attempt=1;
attempt<=3;
attempt++){try{response=await fetch(`${sampleApi}?upload=part&id=${encodeURIComponent(job.objectId!)}&uploadId=${encodeURIComponent(job.uploadId!)}&partNumber=${partNumber}`,{method:"PUT",body});
if(response.ok)break}catch{}if(attempt<3)await new Promise(resolve=>setTimeout(resolve,attempt*700))}const part=await response?.json().catch(()=>({}));
if(!response?.ok)throw new Error(part?.error||`第 ${partNumber} 段上传中断`);
job={...job,parts:[...job.parts,{partNumber:Number(part.partNumber),etag:String(part.etag)}]};
await saveUploadJob(job);
setQueue(items=>items.map(x=>x.jobId===job.jobId?job:x));
setProgress(`正在续传 ${index+1} / ${jobs.length}：${Math.round(job.parts.length/total*100)}%`)}const complete=await fetch(sampleApi,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"complete",id:job.objectId,uploadId:job.uploadId,parts:job.parts})});
if(!complete.ok){
const check=await fetch(`${sampleApi}?check=${encodeURIComponent(job.objectId!)}`).then(r=>r.json()).catch(()=>({exists:false}));
if(!check.exists){const completeData=await complete.json().catch(()=>({}));throw new Error(completeData.error||"合并图片失败")}}
await deleteUploadJob(job.jobId);
setQueue(items=>items.filter(x=>x.jobId!==job.jobId))}catch(reason){const failed={...job,status:"failed" as const,error:reason instanceof Error?reason.message:"上传中断"};
await saveUploadJob(failed).catch(()=>{});
setQueue(items=>items.map(x=>x.jobId===failed.jobId?failed:x));
setError("部分图片尚未完成，可稍后继续上传。")}}setUploading(false);
setProgress("");
await load()}
  async function upload(){const sources=[...(filesRef.current?.files||[])].slice(0,60);if(!pickedTask||!stationName.trim()||!sources.length)return;const unsupported=sources.filter(file=>!supportedUploadTypes.has(file.type));if(unsupported.length){setError(`${unsupported.map(file=>file.name).join("、")} 无法直接显示，请先转换为 JPG、PNG、WebP、GIF 或 AVIF。`);return}setUploading(true);setError("");const prepared:{file:File;originalName:string}[]=[];try{for(let i=0;i<sources.length;i++){setProgress(sources[i].size>uploadLimitBytes?`正在压缩 ${i+1} / ${sources.length}`:`正在准备 ${i+1} / ${sources.length}`);prepared.push({file:await compressForUpload(sources[i]),originalName:sources[i].name})}}catch(reason){setError(reason instanceof Error?reason.message:"图片压缩失败");setUploading(false);setProgress("");return}setUploading(false);const station=pickedTask.stations?.find(s=>s.name===stationName);const jobs=prepared.map(({file,originalName})=>({jobId:crypto.randomUUID(),file,taskId:String(pickedTask.id),district:pickedTask.district,location:uploadLocation.trim(),theme:pickedTask.theme,themeCategory:pickedTask.themeCategory||inferThemeCategory(pickedTask.theme),device:uploadDevice,shootTime:uploadShootTime,stationId:station?.id||"",stationName:stationName.trim(),stationDescription:"",note,originalName,parts:[],status:"waiting" as const,createdAt:Date.now()}));await Promise.all(jobs.map(saveUploadJob));setQueue(items=>[...items,...jobs]);if(filesRef.current)filesRef.current.value="";await resumeUploads(jobs)}
  async function reupload(item:GallerySample,file:File|undefined){if(!file||item.local||!(await ensureAdmin()))return;if(!supportedUploadTypes.has(file.type)){alert("请先转换为 JPG、PNG、WebP、GIF 或 AVIF");return}setUploading(true);setProgress(file.size>uploadLimitBytes?"正在压缩替换图片…":"正在替换图片…");let prepared:File;try{prepared=await compressForUpload(file)}catch(reason){alert(reason instanceof Error?reason.message:"图片压缩失败");setUploading(false);setProgress("");return}const r=await fetch(`${sampleApi}?id=${encodeURIComponent(item.id)}&name=${encodeURIComponent(file.name)}`,{method:"PUT",headers:{"content-type":prepared.type},body:prepared});const data=await r.json().catch(()=>({}));setUploading(false);setProgress("");if(!r.ok){alert(data.error||"重新上传失败");return}setActive(null);setBroken(items=>{const next=new Set(items);next.delete(item.id);return next});await load()}
  async function remove(item:GallerySample){if(item.local||!confirm("删除这张云端样片？删除后不可恢复。")||!(await ensureAdmin()))return;const r=await fetch(`${sampleApi}?id=${encodeURIComponent(item.id)}`,{method:"DELETE"});if(!r.ok){alert("管理权限已失效，请重新验证");return}setActive(null);await load()}
  async function startEdit(item:GallerySample){if(!(await ensureAdmin()))return;setDraft({originalName:item.originalName||"",location:item.location||"",themeCategory:item.themeCategory||inferThemeCategory(item.theme),device:item.device||"",shootTime:item.shootTime||"",stationId:item.stationId||"",stationName:item.stationName||"",stationDescription:item.stationDescription||"",subjectDescription:item.subjectDescription||"",note:item.note||""});setEditError("");setEditingMeta(true)}
  async function saveEdit(){if(!active||active.local)return;if(!(await ensureAdmin())){notify("保存失败，请重试","error");return}setSavingMeta(true);setEditError("");try{const r=await fetch(sampleApi,{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({id:active.id,...draft})});const data=await r.json().catch(()=>({}));if(!r.ok)throw new Error();const updated={...active,...data.item,url:active.url};setRemote(items=>items.map(item=>item.id===active.id?updated:item));setEditingMeta(false);setActive(null);notify("修改成功","success")}catch{setEditError("保存失败，请重试");notify("保存失败，请重试","error")}finally{setSavingMeta(false)}}
  return <section className="galleryPanel">
<div className="galleryToolbar">
<div>
<p className="eyebrow">REFERENCE GALLERY</p>
<h2>样片瀑布流</h2>
<p>从照片反查点位与机位，把灵感直接落到下一次拍摄。</p>
</div>
<button className="primary" onClick={()=>setUploadOpen(true)}>＋ 批量上传样片</button>
</div>
{queue.length>0&&<div className="uploadRecovery">
<div><strong>{queue.length} 张图片等待续传</strong><small>已完成的分片不会重复上传，断网或重启后仍可继续。</small></div>
<button disabled={uploading} onClick={()=>resumeUploads(queue)}>{uploading?progress:"继续上传"}</button>
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
<span>{shown.length} 张样片</span>
</div>{loading?<div className="galleryEmpty">正在整理样片…</div>:shown.length?<div className="masonry">{shown.map(item=>
<button className="sampleCard" key={item.id} onClick={()=>setActive(item)}>
{broken.has(item.id)?<span className="brokenSample"><b>图片无法显示</b><small>点击查看并重新上传</small></span>:<img src={item.url} alt={`${item.location} ${item.stationName}`} onError={()=>setBroken(items=>new Set(items).add(item.id))}/>}
<span>
<b>{item.originalName||"未命名样片"}</b>
<small>{item.stationName||"未关联机位"}{item.device?` · ${item.device}`:""}{item.shootTime?` · ${item.shootTime}`:""}</small>
</span>
</button>)}</div>:<div className="galleryEmpty">
<strong>画廊还是空的</strong>
<p>{error||"上传第一批参考照片，并把它们关联到具体机位。"}</p>
<button className="primary" onClick={()=>setUploadOpen(true)}>上传样片</button>
</div>}
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
<label>对应点位与主题<select value={taskId} onChange={e=>{setTaskId(e.target.value);const t=tasks.find(x=>String(x.id)===e.target.value);setStationName(t?.stations?.[0]?.name||"")}}>{tasks.map(t=>
<option key={t.id} value={t.id}>{t.district} · {t.location} · {t.theme}</option>)}</select>
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
<small>支持 JPG、PNG、WebP、GIF、AVIF；超过 4MB 会在上传前自动压缩到 4MB 以内。HEIC/RAW 请先转换。</small>
</label>{error&&<p className="uploadError">{error}</p>}<div className="modalActions">
<button onClick={()=>setUploadOpen(false)}>取消</button>
<button className="primary" disabled={uploading||!stationName.trim()} onClick={upload}>{uploading?progress:"开始上传"}</button>
</div>
</div>
</div>}
  {active&&<div className="lightbox" onClick={()=>{setActive(null);setEditingMeta(false)}}>
<div className="lightboxImage">
{broken.has(active.id)?<div className="brokenLightbox"><strong>这张图片无法解码</strong><span>可在右侧保留原信息并重新上传可显示的图片。</span></div>:<img src={active.url} alt={`${active.location} ${active.stationName}`} onError={()=>setBroken(items=>new Set(items).add(active.id))}/>}
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
</div>}{toast&&<div className={`toast toast-${toast.kind}`} role="status"><span>{toast.kind==="success"?"✓":"!"}</span>{toast.message}</div>}</section>
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

function ThemeManager({records,tasks,onAdd,onRename,onDelete,onOpen,onEdit}:{records:ThemeRecord[];tasks:Task[];onAdd:()=>void;onRename:(record:ThemeRecord)=>void;onDelete:(record:ThemeRecord)=>void;onOpen:(name:string)=>void;onEdit:(id:number)=>void}){return <section className="themeManager">
<div className="themeManagerHead"><div><p className="eyebrow">THEME COLLECTION</p><h2>拍摄主题与机位</h2><p>按天气、天象与城市题材整理拍摄任务，并从主题直达对应点位。</p></div><button className="primary" onClick={onAdd}>＋ 新增拍摄主题</button></div>
<div className="themeGrid">{records.map(record=>{const related=tasks.filter(task=>task.themeCategory===record.name);const stationCount=related.reduce((sum,task)=>sum+(task.stations?.length||0),0);return <article className="themeCard" key={record.id}>
<div className="themeCardHead"><div><span>{record.name.slice(0,1)}</span><div><h3>{record.name}</h3><small>{related.length} 个主题任务 · {stationCount} 个机位</small></div></div><div><button onClick={()=>onRename(record)}>编辑</button><button onClick={()=>onDelete(record)}>删除</button></div></div>
<div className="themeStations">{related.length?related.slice(0,6).map(task=><button key={task.id} onClick={()=>onEdit(task.id)}><b>{task.location}</b><span>{task.stations?.length?task.stations.map(station=>station.name).join("、"):"尚未添加机位"}</span></button>):<p>暂无对应拍摄点位</p>}</div>
<button className="themeEntry" onClick={()=>onOpen(record.name)}>查看该主题全部点位 →</button>
</article>})}</div></section>}

function Coverage({tasks,categories}:{tasks:Task[];categories:string[]}){const districts=[...new Set(tasks.map(t=>t.district))].map(name=>{const g=group(tasks.filter(t=>t.district===name));return{name,total:g.length,done:g.filter(x=>x.status==="已毕业").length}});const categoryStats=[...categories,"未归类"].map(name=>{const a=tasks.filter(t=>(t.themeCategory||"未归类")===name);return{name,total:a.length,done:a.filter(t=>t.status==="已毕业").length}}).filter(x=>x.total>0).sort((a,b)=>b.total-a.total);return <section className="coverage">
<div className="coverageIntro">
<p className="eyebrow">COVERAGE REPORT</p>
<h2>区域与主题归类覆盖率</h2>
<p>区域按“点位下所有主题均毕业”计算；归类按任务毕业数计算。</p>
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

function Editor({task,categories,update,close,addStation,addSamples}:{task:Task;categories:string[];update:(p:Partial<Task>)=>void;close:()=>void;addStation:()=>void;addSamples:(f:FileList|null)=>void}){return <div className="modal editorModal">
<div className="editor">
<div className="modalHead">
<div>
<small>TASK WORKBENCH</small>
<h2>{task.location}</h2>
<p>{task.district} · {task.themeCategory||"未归类"} · {task.theme}</p>
</div>
<button onClick={close}>×</button>
</div>
<div className="editGrid">
<label>点位名称<input value={task.location} onChange={e=>update({location:e.target.value})}/>
</label>
<label>拍摄主题<input value={task.theme} onChange={e=>update({theme:e.target.value})}/>
</label>
<label>主题归类<select value={task.themeCategory||""} onChange={e=>update({themeCategory:e.target.value})}>
<option value="">未归类</option>{categories.map(x=>
<option key={x}>{x}</option>)}</select>
</label>
<label>高德经度<input type="number" step="0.000001" value={task.longitude||""} placeholder="106.551" onChange={e=>update({longitude:n(e.target.value),coordinateSystem:"gcj02"})}/>
</label>
<label>高德纬度<input type="number" step="0.000001" value={task.latitude||""} placeholder="29.563" onChange={e=>update({latitude:n(e.target.value),coordinateSystem:"gcj02"})}/>
</label>
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
<h3>多机位</h3>
<button onClick={addStation}>＋ 添加机位</button>
</div>
<div className="stationList">{(task.stations||[]).map((s,i)=>
<div key={s.id}>
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
