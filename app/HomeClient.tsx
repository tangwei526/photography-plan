"use client";

import { useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import sourceData from "./spots.json";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { toast as shadcnToast } from "@/components/ui/toast";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { BarChart3Icon, CameraIcon, CheckCircle2Icon, CircleGaugeIcon, CropIcon, CrosshairIcon, DownloadIcon, FileDownIcon, FileUpIcon, ImagesIcon, ListChecksIcon, LocateFixedIcon, LogOutIcon, MapIcon, MapPinIcon, MoonIcon, MoveIcon, PencilIcon, PlusIcon, RefreshCwIcon, RotateCcwIcon, RotateCwIcon, SunriseIcon, SunsetIcon, SunIcon, TagsIcon, Trash2Icon, ZoomInIcon } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, RadialBar, RadialBarChart, XAxis, YAxis } from "recharts";

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
type WeatherHour = { time:string; temperature:number; apparentTemperature:number; code:string; cloud:number; lowCloud:number; midCloud:number; highCloud:number; humidity:number; precipitation:number; precipitationAmount:number; visibility:number; windSpeed:number; windGust:number };
type WeatherLocation = { id?:string; name:string; adm2?:string; adm1?:string; country?:string; latitude:number; longitude:number };
type RouteInfo = { distance:number; duration:number; geometry:[number,number][] };
type AstronomyData = { date:string; sunrise:string; sunset:string; dawn:string; dusk:string; moonrise:string; moonset:string; moonPhase:number; moonIllumination:number; source?:string };
type PhotoConditionEvent = { event:string; date:string; time:string; quality:number|null; qualityLabel:string; aod:number|null; aodLabel:string; model:string; run:string; source:string; estimated:boolean };
type PhotoConditionDay = { date:string; label:string; aqi:{value:number;category:string;standard:string;source:string}|null; pm25:number|null; sunrise:PhotoConditionEvent; sunset:PhotoConditionEvent };
type PhotoConditionsData = { city:string; latitude:number; longitude:number; days:PhotoConditionDay[]; updatedAt:string; sunsetbotAvailable:boolean; attributions:string[] };

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
type GalleryInventoryCache={savedAt:number;items:GallerySample[]};
const galleryInventoryCacheKey="shancheng-gallery-inventory-v1";
const normalizeGallerySample=(sample:GallerySample):GallerySample=>({...sample,themeCategory:sample.themeCategory||inferThemeCategory(sample.theme),url:sample.url.startsWith("/")?`${sampleApi}${sample.url.slice("/api/samples".length)}`:sample.url});
function readGalleryInventoryCache():GalleryInventoryCache|null{if(typeof window==="undefined")return null;try{const value=JSON.parse(localStorage.getItem(galleryInventoryCacheKey)||"") as GalleryInventoryCache;if(!value||!Array.isArray(value.items))return null;return{savedAt:Number(value.savedAt)||0,items:value.items.map(normalizeGallerySample)}}catch{return null}}
function writeGalleryInventoryCache(items:GallerySample[]){if(typeof window==="undefined")return;try{localStorage.setItem(galleryInventoryCacheKey,JSON.stringify({savedAt:Date.now(),items} satisfies GalleryInventoryCache))}catch{return}}
async function fetchGalleryInventory(force=false){const response=await fetch(sampleApi,{cache:force?"no-cache":"default"});if(!response.ok)throw new Error("sample inventory unavailable");const data=await response.json();const items=(Array.isArray(data.items)?data.items:[]).map(normalizeGallerySample);writeGalleryInventoryCache(items);return items}
const assetBase=import.meta.env.BASE_URL||"/";
let amapPromise:Promise<any>|null=null;
async function loadAMap(){if((window as any).AMap)return (window as any).AMap;if(amapPromise)return amapPromise;amapPromise=(async()=>{const response=await fetch("/api/amap-config",{cache:"no-store"});const config=await response.json();if(!response.ok||!config.key)throw new Error(config.error||"高德地图未配置");(window as any)._AMapSecurityConfig={serviceHost:`${window.location.origin}/api/amap/_AMapService`};await new Promise<void>((resolve,reject)=>{const script=document.createElement("script");script.src=`https://webapi.amap.com/maps?v=2.0&key=${encodeURIComponent(config.key)}&plugin=AMap.Scale,AMap.ToolBar`;script.onload=()=>resolve();script.onerror=()=>reject(new Error("高德地图加载失败"));document.head.appendChild(script)});return (window as any).AMap})();return amapPromise}
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
type CropAspect="original"|"1:1"|"4:3"|"3:2"|"16:9";
type SampleImageAdjustment={rotation:0|90|180|270;zoom:number;focusX:number;focusY:number;aspect:CropAspect};
const defaultImageAdjustment:SampleImageAdjustment={rotation:0,zoom:1,focusX:50,focusY:50,aspect:"original"};
const cropAspectValue=(aspect:CropAspect,width:number,height:number)=>aspect==="original"?width/height:aspect==="1:1"?1:aspect==="4:3"?4/3:aspect==="3:2"?3/2:16/9;
const normalizeRotation=(value:number)=>([0,90,180,270].includes((value+360)%360)?(value+360)%360:0) as SampleImageAdjustment["rotation"];
function rotatedImageCanvas(bitmap:ImageBitmap,rotation:number,maxSourceSide:number){
  const scale=Math.min(1,maxSourceSide/Math.max(bitmap.width,bitmap.height));const sourceWidth=Math.max(1,Math.round(bitmap.width*scale));const sourceHeight=Math.max(1,Math.round(bitmap.height*scale));const vertical=rotation%180!==0;
  const canvas=document.createElement("canvas");canvas.width=vertical?sourceHeight:sourceWidth;canvas.height=vertical?sourceWidth:sourceHeight;
  const context=canvas.getContext("2d");if(!context)throw new Error("当前浏览器无法处理图片");context.translate(canvas.width/2,canvas.height/2);context.rotate(rotation*Math.PI/180);context.drawImage(bitmap,-sourceWidth/2,-sourceHeight/2,sourceWidth,sourceHeight);return canvas;
}
function cropImageCanvas(bitmap:ImageBitmap,adjustment:SampleImageAdjustment,maxOutputSide=4200,maxSourceSide=5000){
  const source=rotatedImageCanvas(bitmap,adjustment.rotation,maxSourceSide);const aspect=cropAspectValue(adjustment.aspect,source.width,source.height);let cropWidth=source.width;let cropHeight=cropWidth/aspect;if(cropHeight>source.height){cropHeight=source.height;cropWidth=cropHeight*aspect}cropWidth/=adjustment.zoom;cropHeight/=adjustment.zoom;
  const sourceX=(source.width-cropWidth)*Math.min(100,Math.max(0,adjustment.focusX))/100;const sourceY=(source.height-cropHeight)*Math.min(100,Math.max(0,adjustment.focusY))/100;const outputScale=Math.min(1,maxOutputSide/Math.max(cropWidth,cropHeight));const canvas=document.createElement("canvas");canvas.width=Math.max(1,Math.round(cropWidth*outputScale));canvas.height=Math.max(1,Math.round(cropHeight*outputScale));const context=canvas.getContext("2d");if(!context)throw new Error("当前浏览器无法裁切图片");context.imageSmoothingEnabled=true;context.imageSmoothingQuality="high";context.drawImage(source,sourceX,sourceY,cropWidth,cropHeight,0,0,canvas.width,canvas.height);return canvas;
}
async function exportEditedSample(url:string,name:string,adjustment:SampleImageAdjustment){
  const response=await fetch(url,{cache:"force-cache"});if(!response.ok)throw new Error("原始样片读取失败，请重试");const source=await response.blob();let bitmap:ImageBitmap;try{bitmap=await createImageBitmap(source)}catch{throw new Error("这张样片无法进行裁切，请重新上传 JPG 图片")}
  try{const canvas=cropImageCanvas(bitmap,adjustment);const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,"image/jpeg",.92));if(!blob)throw new Error("图片导出失败，请重试");return compressForUpload(new File([blob],`${name.replace(/\.[^.]+$/,'')||"样片"}-edited.jpg`,{type:"image/jpeg",lastModified:Date.now()}))}finally{bitmap.close()}
}
function SampleCropEditor({url,value,onChange}:{url:string;value:SampleImageAdjustment;onChange:(value:SampleImageAdjustment)=>void}){
  const canvasRef=useRef<HTMLCanvasElement>(null);const bitmapRef=useRef<ImageBitmap|null>(null);const dragRef=useRef<{x:number;y:number;focusX:number;focusY:number}|null>(null);const [loading,setLoading]=useState(true);const [error,setError]=useState("");
  useEffect(()=>{let active=true;setLoading(true);setError("");fetch(url,{cache:"force-cache"}).then(response=>{if(!response.ok)throw new Error();return response.blob()}).then(createImageBitmap).then(bitmap=>{if(!active){bitmap.close();return}bitmapRef.current?.close();bitmapRef.current=bitmap;setLoading(false)}).catch(()=>{if(active){setLoading(false);setError("图片预览读取失败")}});return()=>{active=false;bitmapRef.current?.close();bitmapRef.current=null}},[url]);
  useEffect(()=>{const bitmap=bitmapRef.current;const canvas=canvasRef.current;if(!bitmap||!canvas)return;try{const preview=cropImageCanvas(bitmap,value,960,1600);canvas.width=preview.width;canvas.height=preview.height;canvas.getContext("2d")?.drawImage(preview,0,0)}catch{setError("图片预览生成失败")}},[value,loading]);
  function move(event:React.PointerEvent<HTMLCanvasElement>){const origin=dragRef.current;if(!origin)return;event.preventDefault();const rect=event.currentTarget.getBoundingClientRect();onChange({...value,focusX:Math.min(100,Math.max(0,origin.focusX-(event.clientX-origin.x)/rect.width*100/value.zoom)),focusY:Math.min(100,Math.max(0,origin.focusY-(event.clientY-origin.y)/rect.height*100/value.zoom))})}
  return <section className="sampleCropEditor" aria-label="旋转和裁切样片">
    <div className="sampleCropViewport" data-loading={loading||undefined}>{loading?<Spinner/>:error?<span>{error}</span>:<canvas ref={canvasRef} aria-label="裁切预览；拖动图片调整取景位置" onPointerDown={event=>{event.currentTarget.setPointerCapture(event.pointerId);dragRef.current={x:event.clientX,y:event.clientY,focusX:value.focusX,focusY:value.focusY}}} onPointerMove={move} onPointerUp={()=>{dragRef.current=null}} onPointerCancel={()=>{dragRef.current=null}}/>}<span className="cropGrid" aria-hidden="true"/></div>
    <div className="sampleCropTools"><div className="cropToolRow"><span><CropIcon/>裁切比例</span><ToggleGroup variant="outline" size="sm" value={[value.aspect]} onValueChange={items=>{const aspect=items[0] as CropAspect|undefined;if(aspect)onChange({...value,aspect})}} aria-label="选择裁切比例">{(["original","1:1","4:3","3:2","16:9"] as CropAspect[]).map(aspect=><ToggleGroupItem key={aspect} value={aspect}>{aspect==="original"?"原图":aspect}</ToggleGroupItem>)}</ToggleGroup></div>
    <div className="cropToolRow"><span><ZoomInIcon/>缩放 {value.zoom.toFixed(1)}×</span><Slider value={value.zoom} min={1} max={3} step={.1} onValueChange={zoom=>onChange({...value,zoom:Number(zoom)})} aria-label="调整图片缩放"/></div>
    <div className="cropToolActions"><Button type="button" variant="outline" onClick={()=>onChange({...value,rotation:normalizeRotation(value.rotation-90)})}><RotateCcwIcon data-icon="inline-start"/>向左旋转</Button><Button type="button" variant="outline" onClick={()=>onChange({...value,rotation:normalizeRotation(value.rotation+90)})}><RotateCwIcon data-icon="inline-start"/>向右旋转</Button><Button type="button" variant="ghost" onClick={()=>onChange(defaultImageAdjustment)}>重置</Button><span><MoveIcon/>拖动预览调整画面中心</span></div></div>
  </section>
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
const moonStatusForDate=(date:string)=>{const [year,month,day]=date.split("-").map(Number);const synodic=29.530588853;const knownNew=Date.UTC(2000,0,6,18,14);const moment=Date.UTC(year,month-1,day,4);const age=(((moment-knownNew)/86400000)%synodic+synodic)%synodic;const phase=age/synodic*360;return{phase,label:moonLabel(phase),symbol:moonSymbol(phase),illumination:Math.round((1-Math.cos(phase*Math.PI/180))/2*100)}};
const lunarDate=(date:Date)=>{try{return new Intl.DateTimeFormat("zh-CN-u-ca-chinese",{month:"long",day:"numeric"}).format(date).replace(/\s/g,"")}catch{return "日期暂不可用"}};
const clockMinutes=(value?:string)=>{const match=/^(\d{1,2}):(\d{2})$/.exec(value||"");if(!match)return null;return Number(match[1])*60+Number(match[2])};
const countdownLabel=(minutes:number)=>minutes<60?`${minutes} 分钟`:`${Math.floor(minutes/60)} 小时${minutes%60?` ${minutes%60} 分钟`:""}`;
function AstronomyHero(){
  const [now,setNow]=useState(()=>new Date());const [data,setData]=useState<AstronomyData|null>(null);const [failed,setFailed]=useState(false);
  const dateKey=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
  useEffect(()=>{const timer=window.setInterval(()=>setNow(new Date()),1000);return()=>window.clearInterval(timer)},[]);
  useEffect(()=>{let active=true;setFailed(false);fetch(`${astronomyApi}?date=${dateKey}`).then(response=>{if(!response.ok)throw new Error();return response.json()}).then(value=>{if(active)setData(value)}).catch(()=>{if(active)setFailed(true)});return()=>{active=false}},[dateKey]);
  const phase=data?.moonPhase??0;const illumination=Math.round(data?.moonIllumination??0);
  const events=[{label:"月出",time:data?.moonrise,color:"moon",icon:MoonIcon},{label:"晨间蓝调",time:data?.dawn,color:"blue",icon:SunriseIcon},{label:"日出",time:data?.sunrise,color:"sun",icon:SunIcon},{label:"月落",time:data?.moonset,color:"moon",icon:MoonIcon},{label:"日落",time:data?.sunset,color:"sun",icon:SunIcon},{label:"晚间蓝调",time:data?.dusk,color:"blue",icon:SunsetIcon}];
  const minutesNow=now.getHours()*60+now.getMinutes();const nextEvent=events.map(event=>({...event,minutes:clockMinutes(event.time)})).filter((event):event is typeof event&{minutes:number}=>event.minutes!==null&&event.minutes>=minutesNow).sort((a,b)=>a.minutes-b.minutes)[0];
  const statusText=!data?(failed?"天象数据待重试":"正在同步天象数据"):nextEvent?`距${nextEvent.label} ${countdownLabel(nextEvent.minutes-minutesNow)}`:"今日光线窗口已结束";
  return <section className="astronomyHero" aria-label="今日天象与拍摄时间窗口">
    <header className="astroHeader"><span className="astroLocation"><LocateFixedIcon aria-hidden="true"/>重庆 · 今日光线窗口</span><Badge variant="outline" className="astroStatus" aria-live="polite">{statusText}</Badge></header>
    <div className="astroLead"><strong suppressHydrationWarning>{now.toLocaleTimeString("zh-CN",{hour:"2-digit",minute:"2-digit",hour12:false})}</strong><p suppressHydrationWarning>{now.toLocaleDateString("zh-CN",{year:"numeric",month:"long",day:"numeric",weekday:"long"})}</p><small suppressHydrationWarning>农历 {lunarDate(now)}</small></div>
    <div className="astroMoon"><div className={`astroMoonDisc ${phase<180?"isWaxing":"isWaning"}`} style={{"--moon-shift":`${illumination}%`} as React.CSSProperties} role="img" aria-label={`${moonLabel(phase)}，月面照明 ${illumination}%`}/><div className="astroMoonMeta"><strong>{data?`${illumination}%`:"--"}</strong><span>{data?moonLabel(phase):"月相同步中"}</span></div></div>
    <div className="astroTimeline" aria-label="今日太阳与月亮事件时间轴">
      <div className="astroTrajectory" aria-hidden="true"><svg viewBox="0 0 100 28" preserveAspectRatio="none"><path className="moonPath" d="M5 24 Q26 -3 50 24"/><path className="sunPath" d="M48 24 Q69 -6 94 24"/></svg><span className="astroNowMarker" style={{left:`${Math.max(2,Math.min(98,minutesNow/14.4))}%`}}/></div>
      <div className="astroEvents">{events.map(event=>{const EventIcon=event.icon;return <div className={`astroEvent astro-${event.color}`} key={event.label}><span className="astroEventNode"><EventIcon aria-hidden="true"/></span><small>{event.label}</small><strong>{event.time||"--:--"}</strong></div>})}</div>
    </div>
    <footer className="astroFoot"><span><i className="legendMoon"/>月亮事件</span><span><i className="legendBlue"/>蓝调时段</span><span><i className="legendSun"/>太阳事件</span>{failed&&<em role="status">天象数据暂未更新，将在下次打开时自动重试</em>}</footer>
  </section>
}

function CurrentWeatherCard(){
  const fallback:WeatherLocation={name:"重庆市",adm2:"重庆",latitude:29.563,longitude:106.5516};
  const [location,setLocation]=useState<WeatherLocation>(fallback);const [weather,setWeather]=useState<WeatherNow|null>(null);const [loading,setLoading]=useState(true);const [message,setMessage]=useState("");
  const [searchOpen,setSearchOpen]=useState(false);const [query,setQuery]=useState("");const [results,setResults]=useState<WeatherLocation[]>([]);const [searching,setSearching]=useState(false);
  async function load(next:WeatherLocation){setLocation(next);localStorage.setItem("shancheng-weather-location",JSON.stringify(next));window.dispatchEvent(new CustomEvent("shancheng-weather-location-change",{detail:next}));setLoading(true);setMessage("");try{const response=await fetch(`${weatherApi}?lat=${next.latitude}&lon=${next.longitude}`,{cache:"no-store"});const data=await response.json();if(!response.ok||!data.current)throw new Error(data.error||"实时天气暂不可用");setWeather(data.current)}catch(reason){setMessage(reason instanceof Error?reason.message:"实时天气暂不可用")}finally{setLoading(false)}}
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

function ConditionEventRow({label,item,icon}:{label:string;item:PhotoConditionEvent;icon:React.ReactNode}){
  const variant=item.quality!==null&&item.quality>=.4?"default":item.quality!==null&&item.quality>=.05?"secondary":"outline";
  return <article className="conditionEventRow">
    <div className="conditionEventName"><span>{icon}</span><div><strong>{label}{item.time?` · ${item.time}`:""}</strong><small>{item.estimated?"参考估算":`${item.source} · ${item.model}`}</small></div></div>
    <div className="conditionMetric"><small>鲜艳度</small><strong>{item.quality===null?"--":item.quality.toFixed(3)}</strong><Badge variant={variant}>{item.qualityLabel}</Badge></div>
    <div className="conditionMetric"><small>AOD</small><strong>{item.aod===null?"--":item.aod.toFixed(3)}</strong><Badge variant="outline">{item.aodLabel}</Badge></div>
  </article>
}

function PhotoConditionsBoard(){
  const fallback:WeatherLocation={name:"重庆市",adm2:"重庆",latitude:29.563,longitude:106.5516};
  const [location,setLocation]=useState<WeatherLocation>(fallback);const [data,setData]=useState<PhotoConditionsData|null>(null);const [loading,setLoading]=useState(true);const [error,setError]=useState("");const locationKey=useRef("");
  async function load(next:WeatherLocation,force=false){const key=`${next.latitude.toFixed(3)}:${next.longitude.toFixed(3)}`;if(!force&&locationKey.current===key)return;locationKey.current=key;setLocation(next);setLoading(true);setError("");const city=(next.adm2||next.name||"重庆").replace(/[市区县]$/,"")||"重庆";try{const response=await fetch(`${weatherApi}?mode=photo-conditions&lat=${next.latitude}&lon=${next.longitude}&city=${encodeURIComponent(city)}`,{cache:force?"no-cache":"default"});const value=await response.json();if(!response.ok||!Array.isArray(value.days))throw new Error(value.error||"拍摄大气数据暂不可用");setData(value)}catch(reason){setError(reason instanceof Error?reason.message:"拍摄大气数据暂不可用")}finally{setLoading(false)}}
  useEffect(()=>{let saved:WeatherLocation|undefined;try{saved=JSON.parse(localStorage.getItem("shancheng-weather-location")||"")}catch{}load(saved?.latitude&&saved?.longitude?saved:fallback);const changed=(event:Event)=>{const next=(event as CustomEvent<WeatherLocation>).detail;if(next?.latitude&&next?.longitude)load(next)};window.addEventListener("shancheng-weather-location-change",changed);return()=>window.removeEventListener("shancheng-weather-location-change",changed)},[]);
  const locationLabel=location.name+(location.adm2&&location.adm2!==location.name?` · ${location.adm2}`:"");
  return <section className="photoConditionsBoard" aria-label="当前位置今明两天拍摄大气条件">
    <div className="photoConditionsHead"><div><p className="eyebrow">ATMOSPHERE FOR PHOTOGRAPHY</p><h2><LocateFixedIcon/>{locationLabel} · 今明拍摄大气</h2><p>气溶胶通透度、火烧云鲜艳度与空气质量合并展示，定位会跟随首页天气地点。</p></div><Button variant="outline" size="sm" disabled={loading} onClick={()=>load(location,true)}><RefreshCwIcon data-icon="inline-start"/>{loading?"更新中":"刷新数据"}</Button></div>
    {loading&&!data?<div className="conditionDayGrid">{[0,1].map(index=><Card key={index} size="sm" className="conditionDayCard"><CardHeader><Skeleton className="h-5 w-24"/><Skeleton className="h-4 w-40"/></CardHeader><CardContent className="conditionSkeleton"><Skeleton/><Skeleton/></CardContent></Card>)}</div>:data?<div className="conditionDayGrid">{data.days.map(day=><Card key={day.date} size="sm" className="conditionDayCard">
      <CardHeader><CardTitle>{day.label}<span>{new Date(`${day.date}T12:00:00+08:00`).toLocaleDateString("zh-CN",{month:"long",day:"numeric",weekday:"short"})}</span></CardTitle><CardDescription>{day.pm25===null?"大气模型已更新":`PM2.5 约 ${day.pm25.toFixed(1)} μg/m³`}</CardDescription><CardAction><Badge variant={day.aqi&&day.aqi.value>150?"destructive":day.aqi&&day.aqi.value>100?"outline":"secondary"}>AQI {day.aqi?.value??"--"} · {day.aqi?.category||"暂缺"}</Badge></CardAction></CardHeader>
      <CardContent className="conditionEventList"><ConditionEventRow label="朝霞" item={day.sunrise} icon={<SunriseIcon/>}/><ConditionEventRow label="晚霞" item={day.sunset} icon={<SunsetIcon/>}/></CardContent>
      <CardFooter><span>{day.aqi?.standard||"AQI"} · {day.aqi?.source||"暂无空气质量数据"}</span>{day.sunrise.estimated||day.sunset.estimated?<Badge variant="outline">SunsetBot 不可用时采用参考估算</Badge>:<Badge variant="secondary">SunsetBot GFS</Badge>}</CardFooter>
    </Card>)}</div>:<Card size="sm" className="conditionError"><CardHeader><CardTitle>拍摄大气数据暂未读取</CardTitle><CardDescription>{error||"请稍后重试"}</CardDescription><CardAction><Button variant="outline" size="sm" onClick={()=>load(location,true)}>重试</Button></CardAction></CardHeader></Card>}
    {data&&<div className="conditionSources"><span>{error||`更新于 ${new Date(data.updatedAt).toLocaleTimeString("zh-CN",{hour:"2-digit",minute:"2-digit"})}`}</span><span>数据：<a href="https://sunsetbot.top/" target="_blank" rel="noreferrer">SunsetBot</a> · <a href="https://www.qweather.com/" target="_blank" rel="noreferrer">和风天气</a> · <a href="https://open-meteo.com/en/docs/air-quality-api" target="_blank" rel="noreferrer">Open-Meteo / CAMS</a></span></div>}
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
  const [district,setDistrict]=useState("全部行政区"); const [status,setStatus]=useState("全部状态"); const [priority,setPriority]=useState("全部优先级"); const [category,setCategory]=useState("全部归类"); const [query,setQuery]=useState(""); const [pointPage,setPointPage]=useState({key:"",limit:48}); const [routeQuery,setRouteQuery]=useState("");
  const [expanded,setExpanded]=useState<string|null>(null); const [pointEditOnOpen,setPointEditOnOpen]=useState(false); const [editing,setEditing]=useState<number|null>(null); const [mapTask,setMapTask]=useState<number|null>(null);
  const [routeIds,setRouteIds]=useState<number[]>([]); const [route,setRoute]=useState<RouteInfo|null>(null); const [routeLoading,setRouteLoading]=useState(false); const [amapLocating,setAmapLocating]=useState(false); const amapSyncing=useRef(false);
  const [weather,setWeather]=useState<WeatherDay[]>([]); const [weatherCurrent,setWeatherCurrent]=useState<WeatherNow|null>(null); const [weatherHours,setWeatherHours]=useState<WeatherHour[]>([]); const [weatherLoading,setWeatherLoading]=useState(false); const [weatherError,setWeatherError]=useState(""); const [month,setMonth]=useState(currentMonth);
  const [calendarEvents,setCalendarEvents]=useState<CalendarEvent[]>([]);
  const [cloudSamples,setCloudSamples]=useState<GallerySample[]>([]);
  const [themeRecords,setThemeRecords]=useState<ThemeRecord[]>(()=>defaultThemeCategories.map((name,index)=>({id:`fallback-${index}`,name})));
  const [adminDialogOpen,setAdminDialogOpen]=useState(false); const [adminKey,setAdminKey]=useState(""); const [adminError,setAdminError]=useState(""); const [adminChecking,setAdminChecking]=useState(false);
  const adminResolver=useRef<((valid:boolean)=>void)|null>(null); const adminPromise=useRef<Promise<boolean>|null>(null);
  const themeCategories=themeRecords.map(record=>record.name);
  const inputRef=useRef<HTMLInputElement>(null);
  function finishAdminCheck(valid:boolean){adminResolver.current?.(valid);adminResolver.current=null;adminPromise.current=null;setAdminDialogOpen(false);setAdminChecking(false);if(valid)setAdminKey("")}
  async function ensureAdmin(){
    try{const current=await fetch("/api/admin",{cache:"no-store"});const status=await current.json().catch(()=>({}));if(current.ok&&status.valid===true)return true}catch{}
    if(adminPromise.current)return adminPromise.current;
    setAdminError("");setAdminKey("");setAdminDialogOpen(true);
    adminPromise.current=new Promise<boolean>(resolve=>{adminResolver.current=resolve});
    return adminPromise.current;
  }
  async function verifyAdminKey(event:React.FormEvent){
    event.preventDefault();if(!adminKey.trim()||adminChecking)return;setAdminChecking(true);setAdminError("");
    try{const response=await fetch("/api/admin",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({key:adminKey})});const result=await response.json().catch(()=>({}));if(!response.ok||result.valid!==true)throw new Error(result.error||"管理密钥不正确");finishAdminCheck(true)}catch(reason){setAdminChecking(false);setAdminError(reason instanceof Error?reason.message:"验证失败，请重试")}
  }
  useEffect(()=>{try{const savedWorkspace=localStorage.getItem("shancheng-photo-workspace-v3");if(savedWorkspace){const parsed=JSON.parse(savedWorkspace) as {points:PointRecord[];tasks:Task[]};if(Array.isArray(parsed.points)&&Array.isArray(parsed.tasks)){setPoints(parsed.points.map(point=>({...point,themeNames:point.themeNames||[],stations:point.stations||[]})));setTasks(parsed.tasks.map(normalizeTask))}}else{const legacy=localStorage.getItem("shancheng-photo-tasks-v2")||localStorage.getItem("shancheng-photo-tasks-v1");if(legacy){const migrated=migrateWorkspace(JSON.parse(legacy) as Task[]);setPoints(migrated.points);setTasks(migrated.tasks)}}}catch{}setThemeMode(document.documentElement.dataset.theme==="dark"?"dark":"light");setHydrated(true)},[]);
  useEffect(()=>{if(hydrated)localStorage.setItem("shancheng-photo-workspace-v3",JSON.stringify({points,tasks}))},[points,tasks,hydrated]);
  useEffect(()=>{(async()=>{try{const response=await fetch("/api/planner",{cache:"no-store"});if(!response.ok)throw new Error();const data=await response.json();setCalendarEvents(Array.isArray(data.events)?data.events:[]);if(Array.isArray(data.themes)&&data.themes.length)setThemeRecords(data.themes)}catch{}})()},[]);
  useEffect(()=>{let active=true;const cached=readGalleryInventoryCache();if(cached)setCloudSamples(cached.items);fetchGalleryInventory().then(items=>{if(active)setCloudSamples(items)}).catch(()=>{});return()=>{active=false}},[]);
  useEffect(()=>{if(view==="map")locateAllPoints()},[view]);
  const taskViews=useMemo(()=>tasks.map(task=>{const point=points.find(item=>item.id===task.pointId);return point?{...task,district:point.district,location:point.location,longitude:point.longitude,latitude:point.latitude,coordinateSystem:point.coordinateSystem,stations:point.stations}:task}),[tasks,points]);
  const groups=useMemo(()=>group(points,taskViews),[points,taskViews]); const districts=useMemo(()=>[...new Set(points.map(point=>point.district))],[points]); const availableDistricts=useMemo(()=>[...new Set([...chongqingDistricts,...districts])],[districts]); const activeGroup=groups.find(item=>item.key===expanded);
  const cloudSampleCountByTask=useMemo(()=>cloudSamples.reduce<Record<string,number>>((counts,sample)=>{const taskId=String(sample.taskId||"");if(taskId)counts[taskId]=(counts[taskId]||0)+1;return counts},{}),[cloudSamples]);
  const filtered=useMemo(()=>groups.filter(g=>(district==="全部行政区"||g.district===district)&&(status==="全部状态"||g.status===status)&&(priority==="全部优先级"||g.priority===priority)&&(category==="全部归类"||g.themeNames.includes(category))&&`${g.location} ${g.district} ${g.themeNames.join(" ")} ${g.tasks.map(t=>`${t.timeWindow||""} ${t.theme} ${t.methods} ${t.note}`).join(" ")}`.toLowerCase().includes(query.toLowerCase())).sort((a,b)=>priorityRank[b.priority]-priorityRank[a.priority]),[groups,district,status,priority,category,query]);
  const pointFilterKey=`${district}\u0000${status}\u0000${priority}\u0000${category}\u0000${query}`;const pointDisplayLimit=pointPage.key===pointFilterKey?pointPage.limit:48;
  const counts={unshot:tasks.filter(t=>t.status==="未拍摄").length,redo:tasks.filter(t=>t.status==="待补拍").length,done:tasks.filter(t=>t.status==="已毕业").length};
  const mappedTasks=useMemo(()=>groups.map((groupItem,index)=>groupItem.tasks[0]||({id:-(index+1),pointId:groupItem.point.id,district:groupItem.district,location:groupItem.location,priority:groupItem.priority,theme:"待创建拍摄任务",timeWindow:"自定义",methods:[],media:[],clarity:"低",status:"未拍摄",note:"",sourceRow:0,longitude:groupItem.point.longitude,latitude:groupItem.point.latitude,coordinateSystem:groupItem.point.coordinateSystem,stations:groupItem.stations,samples:[]} as Task)),[groups]);
  const routeCandidates=useMemo(()=>mappedTasks.filter(item=>`${item.location} ${item.district}`.toLowerCase().includes(routeQuery.trim().toLowerCase())),[mappedTasks,routeQuery]);
  const selected=taskViews.find(t=>t.id===(editing??mapTask)); const selectedMapTask=mapTask===null?undefined:mappedTasks.find(t=>t.id===mapTask);
  useEffect(()=>{if(view==="map"&&mapTask===null&&mappedTasks.length)loadWeather(mappedTasks[0])},[view,mapTask]);
  const update=(id:number,patch:Partial<Task>)=>{const current=tasks.find(task=>task.id===id);if(!current)return;const {stations,...taskPatch}=patch;if(stations){const valid=new Set(stations.map(station=>station.id));setPoints(items=>items.map(point=>point.id===current.pointId?{...point,stations}:point));setTasks(items=>items.map(task=>task.pointId===current.pointId?{...task,stationIds:(task.stationIds||[]).filter(stationId=>valid.has(stationId)),...(task.id===id?taskPatch:{})}:task))}else setTasks(items=>items.map(task=>task.id===id?{...task,...taskPatch}:task))};

  async function importExcel(file:File){
    if(!(await ensureAdmin()))return;
    const XLSX=await import("xlsx");
    const wb=XLSX.read(await file.arrayBuffer(),{type:"array",cellDates:true}); const ws=wb.Sheets[wb.SheetNames[0]]; const rows=XLSX.utils.sheet_to_json<Record<string,unknown>>(ws,{defval:""}); let lastDistrict="",lastLocation="";const creativeThemes=new Map<string,Set<string>>();
    const imported:Task[]=rows.map((r,i)=>{lastDistrict=String(r["行政区域"]||lastDistrict).trim();lastLocation=String(r["点位名称"]||lastLocation).trim();const districtName=lastDistrict||"待分类";const locationName=lastLocation||`未命名点位 ${i+1}`;const station=String(r["机位名称"]||r["关联机位"]||"").trim();const theme=String(r["拍摄任务"]||r["拍摄主题"]||"常规记录");const themeNames=split(r["创作主题"]||r["主题归类"]).map(normalizeThemeName);const pointKey=`${districtName}::${locationName}`;creativeThemes.set(pointKey,new Set([...(creativeThemes.get(pointKey)||[]),...themeNames]));const longitude=n(r["经度"]),latitude=n(r["纬度"]);const coordinateSystem:Task["coordinateSystem"]=longitude&&latitude?(String(r["坐标系"]||"").toLowerCase()==="gcj02"?"gcj02":"wgs84"):undefined;return {id:i+1,district:districtName,location:locationName,priority:(["高","中","低"].includes(String(r["点位优先级"]||r["优先级"]))?String(r["点位优先级"]||r["优先级"]):"低") as Priority,theme,timeWindow:String(r["拍摄时间"]||"")||inferTimeWindow(theme),themeCategory:themeNames[0]||"",methods:split(r["拍摄方式"]||"待规划"),media:split(r["素材类型"]||"待规划"),clarity:String(r["通透度要求"]||"低"),status:(statuses.includes(String(r["拍摄状态"]) as Status)?String(r["拍摄状态"]):"未拍摄") as Status,note:String(r["备注"]||""),sourceRow:i+2,longitude,latitude,coordinateSystem,scheduleDate:r["计划日期"] instanceof Date?(r["计划日期"] as Date).toISOString().slice(0,10):String(r["计划日期"]||""),scheduleSlot:String(r["计划时段"]||""),stations:station?[{id:`s-${i}`,name:station,description:String(r["机位说明"]||"")}]:[],samples:String(r["样片链接"]||"").trim()?[{id:`p-${i}`,name:"Excel 样片",url:String(r["样片链接"])}]:[],retakeReason:String(r["补拍原因"]||""),missingShots:String(r["缺失镜头"]||""),graduationCriteria:String(r["毕业标准"]||"")};}).filter(t=>t.location);
    if(imported.length&&confirm(`识别到 ${imported.length} 条任务，替换当前数据吗？`)){const migrated=migrateWorkspace(imported);setPoints(migrated.points.map(point=>{const names=[...(creativeThemes.get(`${point.district}::${point.location}`)||[])];return names.length?{...point,themeNames:names}:point}));setTasks(migrated.tasks);setView("library");}
  }
  async function exportExcel(){const XLSX=await import("xlsx");const rows=taskViews.map(t=>{const point=points.find(item=>item.id===t.pointId);return{行政区域:t.district,点位名称:t.location,点位优先级:point?.priority||t.priority,拍摄任务:t.theme,拍摄时间:t.timeWindow||"自定义",创作主题:(point?.themeNames||[]).join("、"),拍摄方式:t.methods.join("、"),素材类型:t.media.join("、"),通透度要求:t.clarity,拍摄状态:t.status,计划日期:t.scheduleDate||"",计划时段:t.scheduleSlot||"",关联机位:(t.stationIds||[]).map(id=>point?.stations.find(station=>station.id===id)?.name).filter(Boolean).join("、"),全部机位:(point?.stations||[]).map(station=>station.name).join("、"),补拍原因:t.retakeReason||"",缺失镜头:t.missingShots||"",毕业标准:t.graduationCriteria||"",样片链接:(t.samples||[]).map(s=>s.url.startsWith("data:")?"本地样片":s.url).join("、"),备注:t.note}});const ws=XLSX.utils.json_to_sheet(rows);const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,"规范化点位数据");XLSX.writeFile(wb,`重庆拍摄点位_${new Date().toISOString().slice(0,10)}.xlsx`)}
  async function loadWeather(t:Task){setMapTask(t.id);setWeatherLoading(true);setWeatherError("");const [lat,lon]=coord(t);try{const response=await fetch(`${weatherApi}?lat=${lat}&lon=${lon}`,{cache:"no-store"});const data=await response.json();if(!response.ok)throw new Error(data.error||"天气读取失败");setWeatherCurrent(data.current||null);setWeatherHours(Array.isArray(data.hours)?data.hours:[]);setWeather(Array.isArray(data.days)?data.days:[])}catch(reason){setWeatherCurrent(null);setWeatherHours([]);setWeather([]);setWeatherError(reason instanceof Error?reason.message:"天气读取失败，请稍后重试")}finally{setWeatherLoading(false)}}
  async function locateAllPoints(){if(amapSyncing.current)return;const missing=points.filter(point=>!point.longitude||!point.latitude);const gps=points.filter(point=>point.longitude&&point.latitude&&point.coordinateSystem!=="gcj02");if(!missing.length&&!gps.length)return;amapSyncing.current=true;setAmapLocating(true);try{const updates=new Map<string,{longitude:number;latitude:number}>();for(let i=0;i<missing.length;i+=20){const batch=missing.slice(i,i+20);const response=await fetch("/api/amap-locate",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"locate",items:batch.map(point=>({key:point.id,district:point.district,location:point.location}))})});const data=await response.json();if(!response.ok)throw new Error(data.error||"点位解析失败");for(const item of data.items||[])if(item.longitude&&item.latitude)updates.set(item.key,{longitude:item.longitude,latitude:item.latitude})}for(let i=0;i<gps.length;i+=40){const batch=gps.slice(i,i+40);const response=await fetch("/api/amap-locate",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"convert",items:batch.map(point=>({key:point.id,longitude:point.longitude,latitude:point.latitude}))})});const data=await response.json();if(!response.ok)throw new Error(data.error||"坐标转换失败");for(const item of data.items||[])if(item.longitude&&item.latitude)updates.set(item.key,{longitude:item.longitude,latitude:item.latitude})}if(updates.size)setPoints(items=>items.map(point=>{const found=updates.get(point.id);return found?{...point,...found,coordinateSystem:"gcj02"}:point}))}catch(reason){alert(reason instanceof Error?reason.message:"暂时无法定位全部点位")}finally{setAmapLocating(false);amapSyncing.current=false}}
  async function planRoute(){const pts=routeIds.map(id=>mappedTasks.find(t=>t.id===id)).filter(Boolean) as Task[];if(pts.length<2)return;setRouteLoading(true);try{const response=await fetch("/api/amap-locate",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"route",locations:pts.map(task=>{const [latitude,longitude]=task.latitude&&task.longitude?[task.latitude,task.longitude]:coord(task);return[longitude,latitude]})})});const data=await response.json();setRoute(response.ok&&data.route?data.route:null)}catch{setRoute(null)}finally{setRouteLoading(false)}}
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
<Button className="desktopHeaderAction" variant="outline" size="sm" onClick={async()=>{if(await ensureAdmin())inputRef.current?.click()}}><FileUpIcon data-icon="inline-start"/>导入 Excel</Button>
<a className={`${buttonVariants({variant:"outline",size:"sm"})} desktopHeaderAction`} href={`${assetBase}摄影点位导入模板.xlsx`} download><DownloadIcon data-icon="inline-start"/>下载模板</a>
<Button className="desktopHeaderAction" size="sm" onClick={exportExcel}><FileDownIcon data-icon="inline-start"/>导出修改</Button>
<Tooltip><TooltipTrigger render={<Button variant="ghost" size="icon-sm"/>} onClick={logout} aria-label="退出登录"><LogOutIcon/></TooltipTrigger><TooltipContent>退出登录</TooltipContent></Tooltip>
<input ref={inputRef} hidden type="file" accept=".xlsx,.xls" onChange={e=>e.target.files?.[0]&&importExcel(e.target.files[0])}/>
</div>
  </header>
  <Dialog open={adminDialogOpen} onOpenChange={open=>{if(!open&&!adminChecking)finishAdminCheck(false)}}>
    <DialogContent className="sm:max-w-md" showCloseButton={!adminChecking}>
      <form onSubmit={verifyAdminKey}>
        <DialogHeader>
          <DialogTitle>验证管理权限</DialogTitle>
          <DialogDescription>编辑、上传或删除样片前需要验证管理密钥。验证成功后 30 天内无需再次输入。</DialogDescription>
        </DialogHeader>
        <FieldGroup className="py-4">
          <Field data-invalid={Boolean(adminError)||undefined}>
            <FieldLabel htmlFor="admin-key">管理密钥</FieldLabel>
            <Input id="admin-key" type="password" autoComplete="current-password" value={adminKey} onChange={event=>setAdminKey(event.target.value)} aria-invalid={Boolean(adminError)} disabled={adminChecking}/>
            {adminError&&<FieldError>{adminError}</FieldError>}
          </Field>
        </FieldGroup>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={adminChecking} onClick={()=>finishAdminCheck(false)}>取消</Button>
          <Button type="submit" disabled={adminChecking||!adminKey.trim()}>{adminChecking&&<Spinner data-icon="inline-start"/>}{adminChecking?"正在验证":"验证并继续"}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
  <div className={view==="gallery"?"shell galleryShell":"shell"}>
{view==="library"&&<PhotoConditionsBoard/>}
{view==="library"&&<div className="homeOverview"><AstronomyHero/><OverviewStats pointCount={groups.length} districtCount={districts.length} counts={counts} scheduleCount={calendarEvents.length} coordinateCount={points.filter(point=>point.longitude&&point.latitude).length}/></div>}
{view!=="gallery"&&<><section className="intro">
<div>
<p className="eyebrow">CHONGQING PHOTO ATLAS · WORKSPACE</p>
<h1>{view==="library"?"把重庆，拍得更完整。":view==="map"?"先看天，再出发。":view==="calendar"?"把好天气留给重要机位。":view==="themes"?"按主题，整理每一个机位。":"每一个空白，都有下一次出发。"}</h1>
<p>共 {groups.length} 个点位、{tasks.length} 条拍摄任务；点位修改保存在当前设备，云端样片长期保存。</p>
</div>
{view==="library"?<div className="libraryIntroActions"><CurrentWeatherCard/><Button size="lg" onClick={createPoint}><PlusIcon data-icon="inline-start"/>新建点位</Button></div>:view!=="calendar"&&view!=="themes"&&<Button size="lg" onClick={createPoint}><PlusIcon data-icon="inline-start"/>新建点位</Button>}
</section>
</>}

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
<span>已显示 {Math.min(pointDisplayLimit,filtered.length)} / {filtered.length} 个点位</span>
<small>按优先级排序 · 点击卡片直接编辑点位</small>
</div>
<div className="spotList">{filtered.slice(0,pointDisplayLimit).map(g=>{
  const doneTasks=g.tasks.filter(task=>task.status==="已毕业");
  const unshotTasks=g.tasks.filter(task=>task.status==="未拍摄");
  const retakeTasks=g.tasks.filter(task=>task.status==="待补拍");
  const themes=[...new Set(g.themeNames.map(normalizeThemeName).filter(Boolean))];
  const visibleThemes=themes.slice(0,3);
  const completion=g.tasks.length?Math.round(doneTasks.length/g.tasks.length*100):0;
  const sampleCount=g.tasks.reduce((total,task)=>total+(task.samples?.length||0)+(cloudSampleCountByTask[String(task.id)]||0),0);
  const taskName=(task:Task)=>task.theme||task.timeWindow||"未命名任务";
  return <article className="locationCard" key={g.key}>
  <button className="locationSummary" onClick={()=>{setPointEditOnOpen(true);setExpanded(g.key)}}>
  <div className="pointCardHeader"><span className={`priorityBadge priority-${g.priority}`}>{g.priority}优先</span><span className="pointDistrict">{g.district}</span><span className="pointCompletion">完成 {doneTasks.length}/{g.tasks.length}</span></div>
  <div className="locationName"><h3>{g.location}</h3></div>
  <div className="pointThemeTags" title={themes.join("、")}>
  {visibleThemes.map(theme=><Badge key={theme} variant="secondary" className="pointThemeBadge">#{theme}</Badge>)}
  {themes.length>visibleThemes.length&&<Badge variant="outline" className="pointThemeMore">+{themes.length-visibleThemes.length}</Badge>}
  {!themes.length&&<span className="pointThemeEmpty">尚未关联创作主题</span>}
  </div>
  <div className="pointTaskSummary">
  {unshotTasks.length>0&&<div className="pointTaskState pointTaskState-unshot"><span>待拍摄</span><div>{unshotTasks.map(task=><Badge key={task.id} variant="secondary" className="pointTaskBadge">{taskName(task)}</Badge>)}</div></div>}
  {retakeTasks.length>0&&<div className="pointTaskState pointTaskState-retake"><span>待补拍</span><div>{retakeTasks.map(task=><Badge key={task.id} variant="destructive" className="pointTaskBadge">{taskName(task)}</Badge>)}</div></div>}
  {g.tasks.length>0&&!unshotTasks.length&&!retakeTasks.length&&<div className="pointTaskComplete">✓ 全部拍摄任务已毕业</div>}
  {!g.tasks.length&&<div className="pointTaskNone">尚未创建拍摄任务</div>}
  </div>
  <div className="pointCardProgress"><div><span>任务进度</span><strong>{completion}%</strong></div><span className="pointCardProgressTrack"><i style={{width:`${completion}%`}}/></span></div>
  <div className="pointCardMeta"><span><CameraIcon aria-hidden="true"/>{g.stations.length} 个机位</span><span><ImagesIcon aria-hidden="true"/>{sampleCount} 张样片</span><span className={g.point.longitude&&g.point.latitude?"":"missing"}><MapPinIcon aria-hidden="true"/>{g.point.longitude&&g.point.latitude?"已定位":"待定位"}</span></div>
  </button><div className="pointCardActions"><Tooltip><TooltipTrigger render={<Button variant="secondary" size="icon-sm"/>} aria-label={`编辑${g.location}`} onClick={()=>{setPointEditOnOpen(true);setExpanded(g.key)}}><PencilIcon/></TooltipTrigger><TooltipContent>编辑点位</TooltipContent></Tooltip><Tooltip><TooltipTrigger render={<Button variant="destructive" size="icon-sm"/>} aria-label={`删除${g.location}`} onClick={()=>removePointGroup(g)}><Trash2Icon/></TooltipTrigger><TooltipContent>删除点位</TooltipContent></Tooltip></div></article>
})}</div>
{filtered.length>pointDisplayLimit&&<div className="progressiveLoad"><span>为保证浏览流畅，点位按批次加载</span><Button variant="outline" onClick={()=>setPointPage({key:pointFilterKey,limit:pointDisplayLimit+48})}>再加载 {Math.min(48,filtered.length-pointDisplayLimit)} 个点位</Button></div>}
</div>
</section>}

  {view==="library"&&activeGroup&&<PointDetailModal key={`${activeGroup.key}-${pointEditOnOpen?"edit":"view"}`} point={activeGroup} initialEditing={pointEditOnOpen} districts={availableDistricts} categories={themeCategories} onClose={()=>{setExpanded(null);setPointEditOnOpen(false)}} onSave={(patch,names,stations,taskWindows)=>savePointGroup(activeGroup,patch,names,stations,taskWindows)} onAddTask={()=>addTask(activeGroup)} onManageTask={async id=>{if(await openEditor(id))setExpanded(null)}} onRemoveTask={removeTask} onChangeStatus={changeStatus}/>}

  {view==="gallery"&&<Gallery tasks={taskViews} points={points} categories={themeCategories} ensureAdmin={ensureAdmin} onRemoteSamplesChange={setCloudSamples} onEdit={async id=>{if(await ensureAdmin()){setEditing(id);setView("library")}}}/>}

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
<p className="sub">每个点位只出现一次；选择 2–8 个点位，按选择顺序规划驾车路线。</p>
<label className="routeSearch" htmlFor="route-search"><span>搜索路线点位</span><Input id="route-search" value={routeQuery} onChange={event=>setRouteQuery(event.target.value)} placeholder="输入点位或行政区"/></label>
<div className="routePicker" aria-label="路线点位选择">{routeCandidates.map(t=>
<label key={t.id}>
<input type="checkbox" checked={routeIds.includes(t.id)} disabled={!routeIds.includes(t.id)&&routeIds.length>=8} onChange={e=>setRouteIds(x=>e.target.checked?[...x,t.id]:x.filter(id=>id!==t.id))}/>
<span>{t.location}</span>
<small>{t.district}</small>
</label>)}{!routeCandidates.length&&<p className="routeEmpty">没有匹配的点位</p>}</div>
<button className="primary full" onClick={planRoute} disabled={routeIds.length<2||routeLoading}>{routeLoading?"正在规划…":`规划 ${routeIds.length} 个点位`}</button>{route&&<div className="routeResult">
<strong>{(route.distance/1000).toFixed(1)} km</strong>
<span>预计驾车 {Math.round(route.duration/60)} 分钟</span>
</div>}<hr/>
<h2>天气窗口</h2>{selectedMapTask?<>
<div className="weatherPlace">
<strong>{selectedMapTask.location}</strong>
{selectedMapTask.id>0&&<button onClick={()=>openEditor(selectedMapTask.id)}>编辑坐标</button>}
</div>{weatherLoading?<p className="loading">读取天气中…</p>:weatherError?<p className="weatherError">{weatherError}<button onClick={()=>loadWeather(selectedMapTask)}>重新加载</button></p>:<>{weatherCurrent&&<div className="weatherNowPanel"><div className="weatherNowHero"><span aria-hidden="true">{weatherSymbol(weatherCurrent.code)}</span><div><strong>{weatherCurrent.temperature}° · {weatherCurrent.text}</strong><small>体感 {weatherCurrent.feelsLike}° · 气压 {weatherCurrent.pressure} hPa</small></div></div><div className="weatherNowMetrics"><span><small>总云量</small><strong>{weatherCurrent.cloud}%</strong></span><span><small>能见度</small><strong>{weatherCurrent.visibility} km</strong></span><span><small>湿度</small><strong>{weatherCurrent.humidity}%</strong></span><span><small>风速</small><strong>{weatherCurrent.windSpeed} km/h</strong></span></div></div>}
{weatherHours.length>0&&<section className="cloudForecast" aria-label="未来四十八小时云层预报"><div className="weatherSectionTitle"><div><strong>未来 48 小时云层</strong><small>每 3 小时·低/中/高云分层</small></div><span>Open-Meteo</span></div><div className="cloudHourList">{weatherHours.map(hour=><article className="cloudHour" key={hour.time}><header><strong>{hour.time.slice(5,10).replace("-","/")} {hour.time.slice(11,16)}</strong><span>{hour.temperature}° · 降水 {hour.precipitation}%</span></header><div className="cloudLayer cloudTotal"><span>总</span><i><b style={{width:`${hour.cloud}%`}}/></i><em>{hour.cloud}%</em></div><div className="cloudLayer cloudLow"><span>低</span><i><b style={{width:`${hour.lowCloud}%`}}/></i><em>{hour.lowCloud}%</em></div><div className="cloudLayer cloudMid"><span>中</span><i><b style={{width:`${hour.midCloud}%`}}/></i><em>{hour.midCloud}%</em></div><div className="cloudLayer cloudHigh"><span>高</span><i><b style={{width:`${hour.highCloud}%`}}/></i><em>{hour.highCloud}%</em></div><footer><span>湿度 {hour.humidity}%</span><span>能见度 {hour.visibility} km</span><span>阵风 {hour.windGust} km/h</span></footer></article>)}</div></section>}
{weather.length?<section className="dailyForecast"><div className="weatherSectionTitle"><div><strong>7 日天气窗口</strong><small>日出、日落与白天条件</small></div></div><div className="weatherDays">{weather.map(w=><article key={w.date}><span className="weatherDayIcon" aria-hidden="true">{weatherSymbol(w.code)}</span><div><strong>{w.date.slice(5)} · {w.text}</strong><small>{w.tempMin}–{w.tempMax}° · 云量 {w.cloud}% · 降水 {w.precipitation}% · 湿度 {w.humidity}%</small></div><span>日出 {w.sunrise}<br/>日落 {w.sunset}</span></article>)}</div></section>:!weatherHours.length&&<p className="sub">点击地图上的点位查看天气。</p>}</>}</>:<p className="sub">点击地图标记，查看实时天气、低中高云量、降水、能见度与日出日落窗口。</p>}</aside>
</section>}

  {view==="calendar"&&<Calendar month={month} setMonth={setMonth} events={calendarEvents} onSave={saveCalendarEvent} onDelete={removeCalendarEvent} onSync={()=>subscribeAppleCalendar(true)}/>}
  {view==="themes"&&<ThemeManager records={themeRecords} points={points} tasks={taskViews} onAdd={addTheme} onRename={renameTheme} onDelete={removeTheme} onOpen={name=>{setCategory(name);setView("library")}} onEdit={openEditor}/>}
  {view==="coverage"&&<Coverage points={points} tasks={taskViews} categories={themeCategories} samples={cloudSamples}/>}
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

function Gallery({tasks,points,categories,ensureAdmin,onRemoteSamplesChange,onEdit}:{tasks:Task[];points:PointRecord[];categories:string[];ensureAdmin:()=>Promise<boolean>;onRemoteSamplesChange:(samples:GallerySample[])=>void;onEdit:(id:number)=>void}){
  const [remote,setRemote]=useState<GallerySample[]>(()=>readGalleryInventoryCache()?.items||[]); const [loading,setLoading]=useState(()=>!readGalleryInventoryCache()); const [error,setError]=useState("");
  const [query,setQuery]=useState(""); const [district,setDistrict]=useState("全部行政区"); const [theme,setTheme]=useState("全部主题"); const [category,setCategory]=useState("全部归类");
  const [galleryPage,setGalleryPage]=useState({key:"",limit:60});
  const [active,setActive]=useState<GallerySample|null>(null); const [uploadOpen,setUploadOpen]=useState(false); const [uploading,setUploading]=useState(false); const [progress,setProgress]=useState(""); const [uploadError,setUploadError]=useState("");
  const [savingMeta,setSavingMeta]=useState(false); const [editError,setEditError]=useState("");const [imageAdjustment,setImageAdjustment]=useState<SampleImageAdjustment>(defaultImageAdjustment);
  const [draggedGroup,setDraggedGroup]=useState<string|null>(null);const [dropTarget,setDropTarget]=useState<string|null>(null);const [pendingMerge,setPendingMerge]=useState<{source:string;target:string}|null>(null);const [merging,setMerging]=useState(false);
  const pressTimer=useRef<number|undefined>(undefined);const pressOrigin=useRef<{x:number;y:number}|null>(null);const touchDrag=useRef<string|null>(null);const touchTarget=useRef<string|null>(null);const suppressClick=useRef(false);
  const [queue,setQueue]=useState<UploadJob[]>([]); const [broken,setBroken]=useState<Set<string>>(new Set()); const [deleting,setDeleting]=useState<Set<string>>(new Set());
  const [draft,setDraft]=useState<SampleDraft>({originalName:"",location:"",themeCategory:"",device:"",shootTime:"",stationId:"",stationName:"",stationDescription:"",subjectDescription:"",note:""});
  const [taskId,setTaskId]=useState(String(tasks[0]?.id||"")); const [stationName,setStationName]=useState(""); const [uploadDevice,setUploadDevice]=useState(""); const [uploadShootTime,setUploadShootTime]=useState(""); const [uploadLocation,setUploadLocation]=useState(""); const [note,setNote]=useState(""); const filesRef=useRef<HTMLInputElement>(null);
  const load=async(force=false)=>{if(!remote.length)setLoading(true);setError("");try{setRemote(await fetchGalleryInventory(force))}catch{setError("云端样片暂时无法读取，已保留本地缓存内容。")}finally{setLoading(false)}};
  useEffect(()=>{onRemoteSamplesChange(remote);if(!loading)writeGalleryInventoryCache(remote)},[remote,loading,onRemoteSamplesChange]);
  useEffect(()=>{load();uploadJobs().then(async jobs=>{const recovered=jobs.map(job=>job.status==="uploading"?{...job,status:"failed" as const,error:"上次上传被中断，可从已完成进度继续"}:job);await Promise.all(recovered.map(saveUploadJob));setQueue(recovered)}).catch(()=>{})},[]);
  const local=useMemo(()=>tasks.flatMap(t=>{const station=t.stations?.find(item=>(t.stationIds||[]).includes(item.id))||t.stations?.[0];const point=points.find(item=>item.id===t.pointId);return (t.samples||[]).map(s=>({id:`local-${t.id}-${s.id}`,url:s.url,uploadedAt:"",taskId:String(t.id),district:t.district,location:t.location,theme:t.theme,themeCategory:point?.themeNames[0]||"",stationId:station?.id||"",stationName:station?.name||"未指定机位",stationDescription:station?.description||"",subjectDescription:"",note:t.note||"",originalName:s.name,local:true} as GallerySample))}),[tasks,points]);
  const all=[...remote,...local]; const districts=[...new Set(all.map(x=>x.district).filter(Boolean))]; const themes=[...new Set(all.map(x=>x.theme).filter(Boolean))];
  const shown=all.filter(x=>(district==="全部行政区"||x.district===district)&&(theme==="全部主题"||x.theme===theme)&&(category==="全部归类"||(x.themeCategory||"")===category)&&`${x.location} ${x.stationName} ${x.device||""} ${x.shootTime||""} ${x.themeCategory||"未归类"} ${x.theme} ${x.subjectDescription||""} ${x.note} ${x.originalName}`.toLowerCase().includes(query.toLowerCase()));
  const sampleGroups=useMemo(()=>{const grouped=new Map<string,GallerySample[]>();for(const item of shown){const key=item.groupId?`group:${item.groupId}`:`sample:${item.id}`;grouped.set(key,[...(grouped.get(key)||[]),item])}return [...grouped].map(([key,samples])=>({key,samples,cover:samples[0]}))},[shown]);
  const galleryFilterKey=`${district}\u0000${theme}\u0000${category}\u0000${query}`;const groupDisplayLimit=galleryPage.key===galleryFilterKey?galleryPage.limit:60;
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
  async function mergeGroups(){if(!pendingMerge||!(await ensureAdmin()))return;const source=sampleGroups.find(item=>item.key===pendingMerge.source);const target=sampleGroups.find(item=>item.key===pendingMerge.target);if(!source||!target)return;setMerging(true);const groupId=target.cover.groupId||crypto.randomUUID();const affected=[...target.samples,...source.samples];try{for(const item of affected){const response=await fetch(sampleApi,{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({id:item.id,groupId})});if(!response.ok)throw new Error()}const ids=new Set(affected.map(item=>item.id));setRemote(items=>items.map(item=>ids.has(item.id)?{...item,groupId}:item));setPendingMerge(null);notify(`已将 ${affected.length} 张同机位样片合并展示`,"success")}catch{await load(true);notify("合并失败，请重试","error")}finally{setMerging(false)}}
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
        const normalized=normalizeGallerySample(uploaded);
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
  async function reupload(item:GallerySample,file:File|undefined){if(!file||item.local||!(await ensureAdmin()))return;if(!supportedUploadTypes.has(file.type)){alert("请先转换为 JPG、PNG、WebP、GIF 或 AVIF");return}setUploading(true);setProgress(file.size>uploadLimitBytes?"正在压缩替换图片…":"正在替换图片…");let prepared:File;try{prepared=await compressForUpload(file)}catch(reason){alert(reason instanceof Error?reason.message:"图片压缩失败");setUploading(false);setProgress("");return}const r=await fetch(`${sampleApi}?id=${encodeURIComponent(item.id)}&name=${encodeURIComponent(file.name)}`,{method:"PUT",headers:{"content-type":prepared.type},body:prepared});const data=await r.json().catch(()=>({}));setUploading(false);setProgress("");if(!r.ok){alert(data.error||"重新上传失败");return}setActive(null);setBroken(items=>{const next=new Set(items);next.delete(item.id);return next});await load(true)}
  async function remove(item:GallerySample){if(item.local){notify("本地样片不能在画廊中删除","error");return}if(!confirm("删除这张云端样片？删除后不可恢复。")||!(await ensureAdmin()))return;setDeleting(items=>new Set(items).add(item.id));try{const r=await fetch(`${sampleApi}?id=${encodeURIComponent(item.id)}`,{method:"DELETE"});const data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(data.error||"删除失败，请重试");setRemote(items=>items.filter(sample=>sample.id!==item.id));setBroken(items=>{const next=new Set(items);next.delete(item.id);return next});setActive(current=>current?.id===item.id?null:current);notify("样片已删除","success")}catch(reason){notify(reason instanceof Error?reason.message:"删除失败，请重试","error")}finally{setDeleting(items=>{const next=new Set(items);next.delete(item.id);return next})}}
  async function startEdit(item:GallerySample){if(item.local){notify("本地样片上传后才能编辑","error");return}if(!(await ensureAdmin()))return;setActive(item);setDraft({originalName:item.originalName||"",location:item.location||"",themeCategory:item.themeCategory||inferThemeCategory(item.theme),device:item.device||"",shootTime:item.shootTime||"",stationId:item.stationId||"",stationName:item.stationName||"",stationDescription:item.stationDescription||"",subjectDescription:item.subjectDescription||"",note:item.note||""});setImageAdjustment(defaultImageAdjustment);setEditError("")}
  function closeEditor(){if(savingMeta)return;setActive(null);setImageAdjustment(defaultImageAdjustment);setEditError("")}
  async function saveEdit(){if(!active||active.local)return;if(!(await ensureAdmin()))return;setSavingMeta(true);setEditError("");const imageChanged=imageAdjustment.rotation!==0||imageAdjustment.zoom!==1||imageAdjustment.focusX!==50||imageAdjustment.focusY!==50||imageAdjustment.aspect!=="original";try{let response:Response;if(imageChanged){const file=await exportEditedSample(active.url,draft.originalName||active.originalName||"样片",imageAdjustment);const form=new FormData();form.append("file",file);Object.entries(draft).forEach(([key,value])=>form.append(key,String(value||"")));response=await fetch(`${sampleApi}?id=${encodeURIComponent(active.id)}`,{method:"PUT",body:form})}else response=await fetch(sampleApi,{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({id:active.id,...draft})});const data=await response.json().catch(()=>({}));if(!response.ok||!data.item)throw new Error(data.error||`保存失败（${response.status}）`);const updated=normalizeGallerySample({...active,...data.item});setRemote(items=>items.map(item=>item.id===active.id?updated:item));setActive(null);setImageAdjustment(defaultImageAdjustment);notify(imageChanged?"图片裁切和样片信息已保存":"样片信息已保存","success")}catch(reason){const message=reason instanceof Error?reason.message:"保存失败，请重试";setEditError(message);notify(message,"error")}finally{setSavingMeta(false)}}
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
<span>{shown.length} 张样片 · 已显示 {Math.min(groupDisplayLimit,sampleGroups.length)} / {sampleGroups.length} 组</span>
</div>{loading?<Empty className="galleryEmpty"><EmptyHeader><EmptyMedia variant="icon"><Spinner/></EmptyMedia><EmptyTitle>正在整理样片</EmptyTitle><EmptyDescription>正在加载云端照片和机位信息。</EmptyDescription></EmptyHeader></Empty>:shown.length?<><div className="masonry">{sampleGroups.slice(0,groupDisplayLimit).map(groupItem=>{const item=groupItem.cover;return <article className={`sampleCard ${draggedGroup===groupItem.key?"sampleDragging":""} ${dropTarget===groupItem.key?"sampleDropTarget":""}`} key={groupItem.key} data-gallery-group={groupItem.key} draggable={!item.local} onDragStart={event=>{event.dataTransfer.effectAllowed="move";setDraggedGroup(groupItem.key)}} onDragOver={event=>{event.preventDefault();event.dataTransfer.dropEffect="move";setDropTarget(groupItem.key)}} onDragLeave={()=>setDropTarget(current=>current===groupItem.key?null:current)} onDrop={event=>{event.preventDefault();prepareMerge(draggedGroup,groupItem.key)}} onDragEnd={()=>{setDraggedGroup(null);setDropTarget(null)}} onPointerDown={event=>pointerDown(groupItem.key,event)} onPointerMove={pointerMove} onPointerUp={pointerEnd} onPointerCancel={pointerEnd}>
<button type="button" className="sampleCardOpen" aria-label={`编辑${item.originalName||"样片"}`} onClick={event=>{if(suppressClick.current){event.preventDefault();return}startEdit(item)}}>
{broken.has(item.id)?<span className="brokenSample"><b>图片无法显示</b><small>点击查看并重新上传</small></span>:<img src={item.url} alt={`${item.location} ${item.stationName}`} loading="lazy" decoding="async" fetchPriority="low" onError={()=>setBroken(items=>new Set(items).add(item.id))}/>}{groupItem.samples.length>1&&<b className="sampleCount">组图 · {groupItem.samples.length} 张</b>}
<span>
<b>{item.originalName||"未命名样片"}</b>
<small>{item.stationName||"未关联机位"}{item.device?` · ${item.device}`:""}{item.shootTime?` · ${item.shootTime}`:""}</small>
</span>
</button><div className="sampleCardActions" onPointerDown={event=>event.stopPropagation()}><Button type="button" variant="secondary" size="icon-sm" aria-label={`编辑${item.originalName||"样片"}`} title="编辑样片" disabled={item.local} onClick={()=>startEdit(item)}><PencilIcon/></Button><Button type="button" variant="destructive" size="icon-sm" aria-label={`删除${item.originalName||"样片"}`} title="删除样片" disabled={item.local||deleting.has(item.id)} onClick={()=>remove(item)}><Trash2Icon/></Button></div>
</article>})}</div>{sampleGroups.length>groupDisplayLimit&&<div className="progressiveLoad"><span>仅先加载当前批次的图片，减少重复下载与页面卡顿</span><Button variant="outline" onClick={()=>setGalleryPage({key:galleryFilterKey,limit:groupDisplayLimit+60})}>再加载 {Math.min(60,sampleGroups.length-groupDisplayLimit)} 组样片</Button></div>}</>:<Empty className="galleryEmpty"><EmptyHeader><EmptyMedia variant="icon"><ImagesIcon/></EmptyMedia><EmptyTitle>画廊还是空的</EmptyTitle><EmptyDescription>{error||"上传第一批参考照片，并把它们关联到具体机位。"}</EmptyDescription></EmptyHeader><EmptyContent><Button onClick={()=>setUploadOpen(true)}><FileUpIcon data-icon="inline-start"/>上传样片</Button></EmptyContent></Empty>}
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
  <Dialog open={Boolean(active)} onOpenChange={open=>{if(!open)closeEditor()}}>{active&&<DialogContent className="sampleEditorDialog" showCloseButton={!savingMeta}>
    <DialogHeader className="sr-only"><DialogTitle>编辑样片</DialogTitle><DialogDescription>旋转、裁切并修改样片信息。</DialogDescription></DialogHeader>
    <div className="sampleEditorMedia">{broken.has(active.id)?<div className="brokenLightbox"><strong>这张图片无法解码</strong><span>请在右侧重新上传可显示的图片。</span></div>:<SampleCropEditor url={active.url} value={imageAdjustment} onChange={setImageAdjustment}/>} {activeSamples.length>1&&<div className="groupThumbs">{activeSamples.map(item=><button className={item.id===active.id?"active":""} key={item.id} onClick={()=>startEdit(item)}><img src={item.url} alt={item.originalName} loading="lazy" decoding="async" fetchPriority="low"/></button>)}</div>}</div>
    <aside className="sampleEditorPanel"><div className="sampleEditorHeading"><div><p className="eyebrow">REFERENCE EDITOR</p><h2>编辑样片</h2><p>图片处理和资料修改会在点击保存后一次提交。</p></div><Badge variant="secondary">{active.district}</Badge></div>
      <FieldGroup className="sampleEditFields">
        <Field><FieldLabel htmlFor="sample-name">样片名称</FieldLabel><Input id="sample-name" value={draft.originalName} onChange={e=>setDraft({...draft,originalName:e.target.value})}/></Field>
        <div className="sampleEditPair"><Field><FieldLabel htmlFor="sample-device">拍摄设备</FieldLabel><select id="sample-device" value={draft.device||""} onChange={e=>setDraft({...draft,device:e.target.value})}><option value="">未填写</option><option>相机</option><option>无人机</option></select></Field><Field><FieldLabel htmlFor="sample-time">拍摄时间</FieldLabel><select id="sample-time" value={draft.shootTime||""} onChange={e=>setDraft({...draft,shootTime:e.target.value})}><option value="">未填写</option>{shootTimes.map(value=><option key={value}>{value}</option>)}</select></Field></div>
        <Field><FieldLabel htmlFor="sample-station">关联机位</FieldLabel><select id="sample-station" value={draft.stationName||""} onChange={e=>{const station=activeTask?.stations?.find(x=>x.name===e.target.value);setDraft({...draft,stationId:station?.id||"",stationName:e.target.value,stationDescription:station?.description||draft.stationDescription})}}><option value="">未关联机位</option>{draft.stationName&&!activeTask?.stations?.some(x=>x.name===draft.stationName)&&<option value={draft.stationName}>{draft.stationName}</option>}{(activeTask?.stations||[]).map(station=><option key={station.id} value={station.name}>{station.name}</option>)}</select></Field>
        <Field><FieldLabel htmlFor="sample-location">拍摄位置</FieldLabel><Input id="sample-location" value={draft.location} placeholder="例如：观景台西侧栏杆" onChange={e=>setDraft({...draft,location:e.target.value})}/></Field>
        <Field><FieldLabel htmlFor="sample-category">主题归类</FieldLabel><select id="sample-category" value={draft.themeCategory||""} onChange={e=>setDraft({...draft,themeCategory:e.target.value})}><option value="">未归类</option>{categories.map(x=><option key={x}>{x}</option>)}</select></Field>
        <Field><FieldLabel htmlFor="sample-station-description">机位说明</FieldLabel><Textarea id="sample-station-description" value={draft.stationDescription} onChange={e=>setDraft({...draft,stationDescription:e.target.value})}/></Field>
        <Field><FieldLabel htmlFor="sample-subject">拍摄主体说明</FieldLabel><Textarea id="sample-subject" value={draft.subjectDescription||""} onChange={e=>setDraft({...draft,subjectDescription:e.target.value})}/></Field>
        <Field><FieldLabel htmlFor="sample-note">样片备注</FieldLabel><Textarea id="sample-note" value={draft.note} onChange={e=>setDraft({...draft,note:e.target.value})}/></Field>
      </FieldGroup>
      {editError&&<FieldError className="sampleEditError">{editError}</FieldError>}
      <DialogFooter className="sampleEditorFooter"><label className={buttonVariants({variant:"outline"})}>{broken.has(active.id)?"重新上传图片":"替换原图"}<input hidden type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" onChange={e=>reupload(active,e.target.files?.[0])}/></label><Button type="button" variant="ghost" onClick={()=>onEdit(Number(active.taskId))}>打开拍摄任务</Button><Button type="button" variant="outline" disabled={savingMeta} onClick={closeEditor}>取消</Button><Button type="button" disabled={savingMeta||!draft.originalName.trim()} onClick={saveEdit}>{savingMeta?<><Spinner data-icon="inline-start"/>正在保存</>:"保存修改"}</Button></DialogFooter>
    </aside>
  </DialogContent>}</Dialog><AlertDialog open={Boolean(pendingMerge)} onOpenChange={open=>{if(!open&&!merging)setPendingMerge(null)}}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>合并同机位样片</AlertDialogTitle><AlertDialogDescription>合并后，画廊首页会以一张组图卡片集中展示；原始图片不会被删除或覆盖。</AlertDialogDescription></AlertDialogHeader>{pendingMerge&&<div className="mergePreview">{[pendingMerge.source,pendingMerge.target].map(key=>{const item=sampleGroups.find(groupItem=>groupItem.key===key);return item&&<article key={key}><img src={item.cover.url} alt={item.cover.originalName}/><span><b>{item.cover.originalName}</b><small>{item.samples.length} 张 · {item.cover.stationName}</small></span></article>})}</div>}<AlertDialogFooter><AlertDialogCancel disabled={merging}>取消</AlertDialogCancel><AlertDialogAction disabled={merging} onClick={mergeGroups}>{merging?<><Spinner data-icon="inline-start"/>正在合并</>:"确认合并"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></section>
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
<small className="calendarHint">点击日期右上角 ＋ 新建日程；桌面端也可右键日期</small>
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
<div className="calendarGrid">{cells.map((d,i)=>{const date=d?`${month}-${String(d).padStart(2,"0")}`:"";const items=events.filter(event=>event.eventDate===date);const moon=d?moonStatusForDate(date):null;return <div className={`day ${!d?"blank":""}`} key={i} onContextMenu={event=>{if(!d)return;event.preventDefault();create(date)}}>{d>0&&moon&&<div className="dayHeader"><span>{d}</span><span className="dayHeaderActions"><span className="dayMoon" title={`${moon.label} · 月面照明约 ${moon.illumination}%`} aria-label={`${date} ${moon.label}，月面照明约 ${moon.illumination}%`}><b aria-hidden="true">{moon.symbol}</b><small>{moon.label}</small></span><button type="button" className="dayAdd" aria-label={`在 ${date} 新建日程`} title="新建日程" onClick={event=>{event.stopPropagation();create(date)}}><PlusIcon aria-hidden="true"/></button></span></div>}{items.slice(0,4).map(item=>
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
<label>日程名称<input value={draft.title} onChange={event=>setDraft({...draft,title:event.target.value})}/></label>
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
{active&&<div className="modal themeDetailModal" role="dialog" aria-modal="true" aria-label={`${active.name}主题详情`}><div className="themeDetailDialog"><div className="modalHead"><div><small>THEME DETAIL</small><h2>{active.name}</h2><p>{activeCounts.pointCount} 个关联点位 · {activeCounts.stationCount} 个关联机位</p></div><button onClick={()=>setActiveId(null)}>×</button></div>
<div className="themeDetailHero"><span className="themeDetailIcon">{themeIcon(active.name)?<img src={themeIcon(active.name)} alt=""/>:<b>{active.name.slice(0,1)}</b>}</span><div><strong>{active.name}拍摄清单</strong><p>集中查看该主题下的点位状态、优先级、拍摄方式和全部机位。</p></div><button onClick={()=>{setActiveId(null);onOpen(active.name)}}>在点位库中查看 →</button></div>
<div className="themeDetailList">{related.length?related.map(point=>{const pointTasks=tasks.filter(task=>task.pointId===point.id);const state:Status=pointTasks.length&&pointTasks.every(task=>task.status==="已毕业")?"已毕业":pointTasks.some(task=>task.status==="待补拍")?"待补拍":"未拍摄";return <article key={point.id}><div className="themeDetailTitle"><div><span>{point.district}</span><h3>{point.location}</h3></div><span className={`status status-${state}`}>{state}</span></div><div className="themeDetailMeta"><span>点位优先级 {point.priority}</span><span>{pointTasks.length} 个拍摄任务</span><span>{point.stations.length} 个机位</span></div><div className="themeDetailStations"><small>拍摄机位</small><p>{point.stations.length?point.stations.map(station=>`${station.name}${station.description?`（${station.description}）`:""}`).join("；"):"尚未添加机位"}</p></div><p className="themeDetailNote">任务：{pointTasks.length?pointTasks.map(task=>`${task.timeWindow||"自定义"} · ${task.theme}`).join("；"):"尚未创建拍摄任务"}</p><button className="themeTaskEdit" onClick={()=>{setActiveId(null);if(pointTasks[0])onEdit(pointTasks[0].id);else onOpen(active.name)}}>{pointTasks[0]?"查看并编辑任务 →":"在点位库中查看 →"}</button></article>}):<div className="themeDetailEmpty"><strong>暂无关联点位</strong><p>可以先在点位详情中勾选这个创作主题。</p></div>}</div>
</div></div>}</>}

const coverageStatusConfig={unshot:{label:"未拍摄",color:"var(--coverage-unshot)"},redo:{label:"待补拍",color:"var(--coverage-redo)"},done:{label:"已毕业",color:"var(--coverage-done)"}} satisfies ChartConfig;
const coverageProgressConfig={done:{label:"已毕业点位",color:"var(--coverage-done)"},open:{label:"未毕业点位",color:"var(--coverage-open)"}} satisfies ChartConfig;
const coverageThemeConfig={total:{label:"关联点位",color:"var(--coverage-primary)"},done:{label:"已毕业点位",color:"var(--coverage-done)"}} satisfies ChartConfig;
const coverageActivityConfig={planned:{label:"计划任务",color:"var(--coverage-primary)"},samples:{label:"样片入库",color:"var(--coverage-accent)"}} satisfies ChartConfig;
const completionPercent=(value:number,total:number)=>total?Math.round(value/total*100):0;
function CoverageMetric({icon:Icon,label,value,detail}:{icon:ComponentType;label:string;value:string;detail:string}){return <Card size="sm" className="coverageMetricCard"><CardHeader><CardDescription>{label}</CardDescription><CardAction><Icon/></CardAction><CardTitle>{value}</CardTitle></CardHeader><CardContent><p>{detail}</p></CardContent></Card>}
function Coverage({points,tasks,categories,samples}:{points:PointRecord[];tasks:Task[];categories:string[];samples:GallerySample[]}){
  const pointTasks=new Map(points.map(point=>[point.id,tasks.filter(task=>task.pointId===point.id)]));
  const pointState=(point:PointRecord):Status=>{const related=pointTasks.get(point.id)||[];return related.length&&related.every(task=>task.status==="已毕业")?"已毕业":related.some(task=>task.status==="待补拍")?"待补拍":"未拍摄"};
  const graduatedPoints=points.filter(point=>pointState(point)==="已毕业").length;
  const taskCounts={unshot:tasks.filter(task=>task.status==="未拍摄").length,redo:tasks.filter(task=>task.status==="待补拍").length,done:tasks.filter(task=>task.status==="已毕业").length};
  const districtStats=[...new Set(points.map(point=>point.district))].map(name=>{const related=points.filter(point=>point.district===name);const done=related.filter(point=>pointState(point)==="已毕业").length;return{name,total:related.length,done,open:related.length-done}}).sort((a,b)=>b.total-a.total||a.name.localeCompare(b.name,"zh-CN"));
  const categoryStats=categories.map(name=>{const related=points.filter(point=>point.themeNames.some(theme=>normalizeThemeName(theme)===normalizeThemeName(name)));const done=related.filter(point=>pointState(point)==="已毕业").length;return{name,total:related.length,done,open:related.length-done,percent:completionPercent(done,related.length)}}).sort((a,b)=>b.total-a.total||a.name.localeCompare(b.name,"zh-CN"));
  const sampleTaskIds=new Set(samples.map(sample=>String(sample.taskId||"")));
  const sampledTasks=tasks.filter(task=>sampleTaskIds.has(String(task.id))||(task.samples?.length||0)>0).length;
  const coordinateReady=points.filter(point=>point.longitude&&point.latitude).length;
  const stationReady=points.filter(point=>point.stations.length>0).length;
  const criteriaReady=tasks.filter(task=>task.graduationCriteria?.trim()).length;
  const reachedThemes=categoryStats.filter(item=>item.total>0).length;
  const taskStatusData=[{key:"unshot",name:"未拍摄",value:taskCounts.unshot,fill:"var(--color-unshot)"},{key:"redo",name:"待补拍",value:taskCounts.redo,fill:"var(--color-redo)"},{key:"done",name:"已毕业",value:taskCounts.done,fill:"var(--color-done)"}];
  const pointCompletion=completionPercent(graduatedPoints,points.length);const taskCompletion=completionPercent(taskCounts.done,tasks.length);
  const windowStats=[...new Set([...shootTimes,...tasks.map(task=>task.timeWindow||inferTimeWindow(task.theme))])].map(name=>{const related=tasks.filter(task=>(task.timeWindow||inferTimeWindow(task.theme))===name);return{name,unshot:related.filter(task=>task.status==="未拍摄").length,redo:related.filter(task=>task.status==="待补拍").length,done:related.filter(task=>task.status==="已毕业").length,total:related.length}}).filter(item=>item.total>0).sort((a,b)=>b.total-a.total);
  const activityDates=[...tasks.map(task=>task.scheduleDate||""),...samples.map(sample=>sample.uploadedAt||"")].map(value=>new Date(value)).filter(date=>!Number.isNaN(date.getTime()));const latestActivity=activityDates.sort((a,b)=>b.getTime()-a.getTime())[0]||new Date();
  const activityData=Array.from({length:6},(_,index)=>{const date=new Date(latestActivity.getFullYear(),latestActivity.getMonth()-5+index,1);const key=`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}`;return{month:`${date.getMonth()+1}月`,planned:tasks.filter(task=>task.scheduleDate?.startsWith(key)).length,samples:samples.filter(sample=>{const uploaded=new Date(sample.uploadedAt);return !Number.isNaN(uploaded.getTime())&&uploaded.getFullYear()===date.getFullYear()&&uploaded.getMonth()===date.getMonth()}).length}});
  const readiness=[{label:"坐标完整度",value:coordinateReady,total:points.length},{label:"机位配置率",value:stationReady,total:points.length},{label:"毕业标准完备率",value:criteriaReady,total:tasks.length},{label:"样片佐证率",value:sampledTasks,total:tasks.length}];
  const weakestReadiness=[...readiness].sort((a,b)=>completionPercent(a.value,a.total)-completionPercent(b.value,b.total))[0];
  const districtGap=[...districtStats].sort((a,b)=>b.open-a.open||b.total-a.total)[0];const themeGap=[...categoryStats].filter(item=>item.total>0).sort((a,b)=>a.percent-b.percent||b.open-a.open)[0];const windowGap=[...windowStats].sort((a,b)=>(b.unshot+b.redo)-(a.unshot+a.redo))[0];
  const openTasks=tasks.filter(task=>task.status!=="已毕业").sort((a,b)=>priorityRank[b.priority]-priorityRank[a.priority]||(a.status==="待补拍"?-1:1));
  const totalStations=points.reduce((sum,point)=>sum+point.stations.length,0);
  return <section className="coverage coverageDashboard">
    <div className="coverageIntro"><div><p className="eyebrow">COVERAGE INTELLIGENCE</p><h2>摄影资产覆盖分析</h2><p>同时观察点位毕业、任务状态、行政区域、创作主题、拍摄时段与资料完整度；点位下全部任务完成后才计为毕业。</p></div><Badge variant="outline">{points.length} 个点位 · {tasks.length} 条任务 · {samples.length} 张云端样片</Badge></div>
    <div className="coverageTopGrid">
      <Card className="coverageCompletionCard"><CardHeader><CardTitle>点位毕业度</CardTitle><CardDescription>全部任务均完成的点位占比</CardDescription><CardAction><CircleGaugeIcon/></CardAction></CardHeader><CardContent><div className="coverageRadial"><ChartContainer config={{completion:{label:"毕业度",color:"var(--coverage-primary)"}}}><RadialBarChart data={[{name:"completion",value:pointCompletion,fill:"var(--color-completion)"}]} startAngle={90} endAngle={-270} innerRadius="74%" outerRadius="100%"><RadialBar dataKey="value" background cornerRadius={18}/></RadialBarChart></ChartContainer><div><strong>{pointCompletion}%</strong><span>{graduatedPoints} / {points.length} 个点位</span></div></div></CardContent><CardFooter><span>任务毕业率</span><strong>{taskCompletion}%</strong></CardFooter></Card>
      <Card className="coverageStatusCard"><CardHeader><CardTitle>任务状态结构</CardTitle><CardDescription>区分尚未开始、需要补拍与已经毕业</CardDescription><CardAction><ListChecksIcon/></CardAction></CardHeader><CardContent><div className="coverageDonut"><ChartContainer config={coverageStatusConfig}><PieChart accessibilityLayer><ChartTooltip content={<ChartTooltipContent hideLabel nameKey="key"/>}/><Pie data={taskStatusData} dataKey="value" nameKey="key" innerRadius="62%" outerRadius="88%" paddingAngle={3} strokeWidth={0}>{taskStatusData.map(item=><Cell key={item.key} fill={item.fill}/>)}</Pie></PieChart></ChartContainer><div><strong>{tasks.length}</strong><span>全部任务</span></div></div><div className="coverageStatusLegend">{taskStatusData.map(item=><span key={item.key}><i style={{background:item.fill}}/><b>{item.name}</b><em>{item.value}</em></span>)}</div></CardContent></Card>
      <div className="coverageMetricGrid">
        <CoverageMetric icon={MapIcon} label="行政区触达" value={`${districtStats.length} / ${chongqingDistricts.length}`} detail={`重庆行政区覆盖 ${completionPercent(districtStats.length,chongqingDistricts.length)}%`}/>
        <CoverageMetric icon={TagsIcon} label="创作主题触达" value={`${reachedThemes} / ${categories.length}`} detail={`${categories.length-reachedThemes} 个主题尚无关联点位`}/>
        <CoverageMetric icon={CameraIcon} label="机位准备度" value={`${completionPercent(stationReady,points.length)}%`} detail={`${totalStations} 个机位，${points.length? (totalStations/points.length).toFixed(1):"0"} 个/点位`}/>
        <CoverageMetric icon={CrosshairIcon} label="坐标完整度" value={`${completionPercent(coordinateReady,points.length)}%`} detail={`${points.length-coordinateReady} 个点位仍缺精确坐标`}/>
        <CoverageMetric icon={CheckCircle2Icon} label="毕业标准" value={`${completionPercent(criteriaReady,tasks.length)}%`} detail={`${tasks.length-criteriaReady} 条任务尚未定义毕业标准`}/>
        <CoverageMetric icon={ImagesIcon} label="样片佐证率" value={`${completionPercent(sampledTasks,tasks.length)}%`} detail={`${sampledTasks} 条任务已经关联样片`}/>
      </div>
    </div>
    <div className="coverageChartGrid">
      <Card><CardHeader><CardTitle>行政区域完成分布</CardTitle><CardDescription>按点位总量排序，比较已毕业与未毕业点位</CardDescription><CardAction><MapPinIcon/></CardAction></CardHeader><CardContent><ChartContainer config={coverageProgressConfig} className="coverageHorizontalChart"><BarChart accessibilityLayer data={districtStats.slice(0,12)} layout="vertical" margin={{left:8,right:12}}><CartesianGrid horizontal={false}/><YAxis dataKey="name" type="category" tickLine={false} axisLine={false} width={62}/><XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false}/><ChartTooltip content={<ChartTooltipContent indicator="line"/>}/><ChartLegend content={<ChartLegendContent/>}/><Bar dataKey="done" stackId="district" fill="var(--color-done)" radius={[4,0,0,4]}/><Bar dataKey="open" stackId="district" fill="var(--color-open)" radius={[0,4,4,0]}/></BarChart></ChartContainer></CardContent></Card>
      <Card><CardHeader><CardTitle>创作主题覆盖</CardTitle><CardDescription>关联点位数量与主题内已毕业点位对比</CardDescription><CardAction><BarChart3Icon/></CardAction></CardHeader><CardContent><ChartContainer config={coverageThemeConfig} className="coverageColumnChart"><BarChart accessibilityLayer data={categoryStats.slice(0,12)} margin={{left:0,right:4}}><CartesianGrid vertical={false}/><XAxis dataKey="name" tickLine={false} axisLine={false} interval={0} tickFormatter={value=>String(value).slice(0,4)}/><YAxis allowDecimals={false} tickLine={false} axisLine={false} width={24}/><ChartTooltip content={<ChartTooltipContent/>}/><ChartLegend content={<ChartLegendContent/>}/><Bar dataKey="total" fill="var(--color-total)" radius={[5,5,0,0]}/><Bar dataKey="done" fill="var(--color-done)" radius={[5,5,0,0]}/></BarChart></ChartContainer></CardContent></Card>
    </div>
    <div className="coverageChartGrid coverageSecondaryCharts">
      <Card><CardHeader><CardTitle>拍摄时段任务结构</CardTitle><CardDescription>日出、日落、蓝调与夜景分别还剩多少任务</CardDescription></CardHeader><CardContent><ChartContainer config={coverageStatusConfig} className="coverageWindowChart"><BarChart accessibilityLayer data={windowStats} layout="vertical" margin={{left:8,right:12}}><CartesianGrid horizontal={false}/><YAxis dataKey="name" type="category" tickLine={false} axisLine={false} width={68}/><XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false}/><ChartTooltip content={<ChartTooltipContent indicator="line"/>}/><ChartLegend content={<ChartLegendContent/>}/><Bar dataKey="done" stackId="window" fill="var(--color-done)" radius={[4,0,0,4]}/><Bar dataKey="redo" stackId="window" fill="var(--color-redo)"/><Bar dataKey="unshot" stackId="window" fill="var(--color-unshot)" radius={[0,4,4,0]}/></BarChart></ChartContainer></CardContent></Card>
      <Card><CardHeader><CardTitle>近六个月活动趋势</CardTitle><CardDescription>拍摄计划与云端样片入库变化</CardDescription></CardHeader><CardContent><ChartContainer config={coverageActivityConfig} className="coverageLineChart"><LineChart accessibilityLayer data={activityData} margin={{left:2,right:12}}><CartesianGrid vertical={false}/><XAxis dataKey="month" tickLine={false} axisLine={false}/><YAxis allowDecimals={false} tickLine={false} axisLine={false} width={24}/><ChartTooltip content={<ChartTooltipContent indicator="line"/>}/><ChartLegend content={<ChartLegendContent/>}/><Line dataKey="planned" type="monotone" stroke="var(--color-planned)" strokeWidth={2.5} dot={{r:3}}/><Line dataKey="samples" type="monotone" stroke="var(--color-samples)" strokeWidth={2.5} dot={{r:3}}/></LineChart></ChartContainer></CardContent></Card>
    </div>
    <Card className="coverageInsightCard"><CardHeader><CardTitle>系统归纳</CardTitle><CardDescription>根据当前数据自动提取最值得优先处理的覆盖缺口</CardDescription></CardHeader><CardContent className="coverageInsightGrid"><article><span>区域缺口</span><strong>{districtGap?.name||"暂无数据"}</strong><p>{districtGap?`还有 ${districtGap.open} 个点位未毕业，共 ${districtGap.total} 个点位。`:"添加点位后将自动分析。"}</p></article><article><span>主题短板</span><strong>{themeGap?.name||"暂无关联主题"}</strong><p>{themeGap?`毕业度 ${themeGap.percent}%，还有 ${themeGap.open} 个关联点位未完成。`:"先为点位关联创作主题。"}</p></article><article><span>时段缺口</span><strong>{windowGap?.name||"暂无任务"}</strong><p>{windowGap?`未完成 ${windowGap.unshot+windowGap.redo} 条，其中 ${windowGap.redo} 条待补拍。`:"创建拍摄任务后将自动分析。"}</p></article><article><span>资料短板</span><strong>{weakestReadiness?.label||"暂无数据"}</strong><p>{weakestReadiness?`当前 ${weakestReadiness.value} / ${weakestReadiness.total}，完整度 ${completionPercent(weakestReadiness.value,weakestReadiness.total)}%。`:"暂无需要补齐的资料。"}</p></article></CardContent></Card>
    <Card className="coveragePriorityCard"><CardHeader><CardTitle>下一批优先补齐</CardTitle><CardDescription>优先级、补拍状态和资料缺口综合排序，展示前 12 条</CardDescription><CardAction><Badge variant={openTasks.some(task=>task.priority==="高")?"destructive":"secondary"}>{openTasks.length} 条未毕业</Badge></CardAction></CardHeader><CardContent><div className="coveragePriorityList">{openTasks.slice(0,12).map(task=>{const point=points.find(item=>item.id===task.pointId);const missing=[!point?.longitude||!point?.latitude?"缺坐标":"",!point?.stations.length?"缺机位":"",!task.graduationCriteria?.trim()?"缺毕业标准":"",!sampleTaskIds.has(String(task.id))&&!(task.samples?.length||0)?"缺样片":"",task.status==="待补拍"&&!task.retakeReason?.trim()?"缺补拍原因":""].filter(Boolean);return <article key={task.id}><div><Badge variant={task.priority==="高"?"destructive":task.priority==="中"?"default":"secondary"}>{task.priority}优先</Badge><Badge variant="outline">{task.status}</Badge></div><strong>{task.location}</strong><p>{task.timeWindow||inferTimeWindow(task.theme)} · {task.themeCategory||"未归类"} · {task.theme}</p><footer>{missing.length?missing.map(item=><Badge variant="outline" key={item}>{item}</Badge>):<Badge variant="secondary">资料齐全</Badge>}</footer></article>})}{!openTasks.length&&<Empty className="coverageEmpty"><EmptyHeader><EmptyMedia variant="icon"><CheckCircle2Icon/></EmptyMedia><EmptyTitle>所有任务均已毕业</EmptyTitle><EmptyDescription>当前没有需要优先补齐的拍摄任务。</EmptyDescription></EmptyHeader></Empty>}</div></CardContent></Card>
  </section>
}

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
