const localDate = (timeZone:string) => { try { return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()); } catch { return new Intl.DateTimeFormat("en-CA", { timeZone: "UTC", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()); } };
const clock = (value?:string|null) => value && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value) ? value.slice(11,16) : "";
const shiftClock = (value:string,minutes:number) => { const match=/^(\d{2}):(\d{2})$/.exec(value);if(!match)return "";const total=(Number(match[1])*60+Number(match[2])+minutes+1440)%1440;return `${String(Math.floor(total/60)).padStart(2,"0")}:${String(total%60).padStart(2,"0")}` };
const approximatePhase = (date:string) => { const synodic=29.530588853;const knownNew=Date.UTC(2000,0,6,18,14);const moment=new Date(`${date}T12:00:00Z`).getTime();const age=(((moment-knownNew)/86400000)%synodic+synodic)%synodic;return age/synodic*360 };
const validTimezone=(value:string)=>{try{new Intl.DateTimeFormat("en",{timeZone:value}).format();return value}catch{return "UTC"}};
const timezoneOffset=(timeZone:string,date:string)=>{const instant=new Date(`${date}T12:00:00Z`);const parts=new Intl.DateTimeFormat("en-US",{timeZone,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(instant);const get=(type:string)=>Number(parts.find(part=>part.type===type)?.value||0);const minutes=Math.round((Date.UTC(get("year"),get("month")-1,get("day"),get("hour"),get("minute"))-instant.getTime())/60000);const sign=minutes>=0?"+":"-";const absolute=Math.abs(minutes);return `${sign}${String(Math.floor(absolute/60)).padStart(2,"0")}:${String(absolute%60).padStart(2,"0")}`};

export async function GET(request:Request) {
  const query=new URL(request.url).searchParams;const latitude=Number(query.get("lat")||29.563);const longitude=Number(query.get("lon")||106.5516);const timezone=validTimezone(String(query.get("timezone")||"Asia/Shanghai"));
  if(!Number.isFinite(latitude)||!Number.isFinite(longitude)||Math.abs(latitude)>90||Math.abs(longitude)>180)return Response.json({error:"无效天象坐标"},{status:400});
  const requested=query.get("date")||localDate(timezone);
  const date=/^\d{4}-\d{2}-\d{2}$/.test(requested)?requested:localDate(timezone);const offset=timezoneOffset(timezone,date);
  const headers={"User-Agent":"ShanchengPhotoAtlas/1.0 github.com/tangwei526/photography-plan"};
  const sunUrl=`https://api.met.no/weatherapi/sunrise/3.0/sun?lat=${latitude}&lon=${longitude}&date=${date}&offset=${encodeURIComponent(offset)}`;
  const moonUrl=`https://api.met.no/weatherapi/sunrise/3.0/moon?lat=${latitude}&lon=${longitude}&date=${date}&offset=${encodeURIComponent(offset)}`;
  const twilightRequest=fetch("https://www.tc03vd.top/timeInfo/getSunTimeInfo",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({latitude,longitude,date,timezone,timeFormat:"24"})}).then(async response=>response.ok?response.json():null).catch(()=>null);
  const [sunResult,moonResult,twilight]=await Promise.all([
    fetch(sunUrl,{headers}).then(async response=>response.ok?response.json():null).catch(()=>null),
    fetch(moonUrl,{headers}).then(async response=>response.ok?response.json():null).catch(()=>null),
    twilightRequest
  ]);
  const sun=sunResult?.properties||{};const moon=moonResult?.properties||{};const external=twilight?.data||twilight||{};
  const sunrise=external.sunrise||clock(sun.sunrise?.time);const sunset=external.sunset||clock(sun.sunset?.time);
  const moonPhase=Number.isFinite(Number(moon.moonphase?.value))?Number(moon.moonphase.value):approximatePhase(date);
  const payload={date,latitude,longitude,timezone,offset,sunrise:sunrise||"",sunset:sunset||"",dawn:external.dawn||external.firstLight||shiftClock(sunrise,-25),dusk:external.dusk||external.lastLight||shiftClock(sunset,25),moonrise:clock(moon.moonrise?.time),moonset:clock(moon.moonset?.time),moonPhase,moonIllumination:(1-Math.cos(moonPhase*Math.PI/180))/2*100,source:twilight?"MET Norway + Sunrise Sunset":"MET Norway"};
  return Response.json(payload,{headers:{"cache-control":"public, max-age=1800, stale-while-revalidate=3600","access-control-allow-origin":"*"}});
}
