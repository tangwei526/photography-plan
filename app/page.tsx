"use client";

import { useEffect, useMemo, useState } from "react";
import sourceData from "./spots.json";

type Status = "未拍摄" | "待补拍" | "已毕业";
type Priority = "低" | "中" | "高";
type Task = {
  id: number; district: string; location: string; priority: Priority; theme: string;
  methods: string[]; media: string[]; clarity: string; status: Status; note: string; sourceRow: number;
};
type LocationGroup = { key: string; district: string; location: string; tasks: Task[]; priority: Priority; status: Status };

const baseTasks = sourceData as unknown as Task[];
const priorityRank: Record<Priority, number> = { 高: 3, 中: 2, 低: 1 };
const nextStatus: Record<Status, Status> = { 未拍摄: "待补拍", 待补拍: "已毕业", 已毕业: "未拍摄" };

function groupTasks(tasks: Task[]): LocationGroup[] {
  const map = new Map<string, Task[]>();
  for (const task of tasks) {
    const key = `${task.district}::${task.location}`;
    map.set(key, [...(map.get(key) || []), task]);
  }
  return [...map.entries()].map(([key, items]) => {
    const status: Status = items.every(x => x.status === "已毕业") ? "已毕业" : items.some(x => x.status === "待补拍") ? "待补拍" : "未拍摄";
    const priority = [...items].sort((a,b) => priorityRank[b.priority] - priorityRank[a.priority])[0].priority;
    return { key, district: items[0].district, location: items[0].location, tasks: items, priority, status };
  });
}

export default function Home() {
  const [tasks, setTasks] = useState<Task[]>(baseTasks);
  const [district, setDistrict] = useState("全部行政区");
  const [status, setStatus] = useState("全部状态");
  const [priority, setPriority] = useState("全部优先级");
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("shancheng-photo-tasks-v1");
    if (saved) { try { setTasks(JSON.parse(saved)); } catch { /* ignore invalid local data */ } }
    setHydrated(true);
  }, []);
  useEffect(() => { if (hydrated) localStorage.setItem("shancheng-photo-tasks-v1", JSON.stringify(tasks)); }, [tasks, hydrated]);

  const allGroups = useMemo(() => groupTasks(tasks), [tasks]);
  const districts = useMemo(() => [...new Set(tasks.map(t => t.district))], [tasks]);
  const filtered = useMemo(() => allGroups.filter(g => {
    const haystack = `${g.location} ${g.district} ${g.tasks.map(t => `${t.theme} ${t.methods.join(" ")} ${t.note}`).join(" ")}`.toLowerCase();
    return (district === "全部行政区" || g.district === district)
      && (status === "全部状态" || g.status === status)
      && (priority === "全部优先级" || g.priority === priority)
      && haystack.includes(query.toLowerCase());
  }).sort((a,b) => priorityRank[b.priority] - priorityRank[a.priority]), [allGroups, district, status, priority, query]);

  const counts = { unshot: tasks.filter(t => t.status === "未拍摄").length, redo: tasks.filter(t => t.status === "待补拍").length, done: tasks.filter(t => t.status === "已毕业").length };
  const completion = Math.round(counts.done / tasks.length * 100);

  function updateTask(id: number, patch: Partial<Task>) { setTasks(current => current.map(t => t.id === id ? { ...t, ...patch } : t)); }
  function cycleTask(id: number) { const task = tasks.find(t => t.id === id); if (task) updateTask(id, { status: nextStatus[task.status] }); }
  function resetData() { if (window.confirm("恢复 Excel 原始数据？本机上的状态修改将被清除。")) setTasks(baseTasks); }
  function addLocation(form: FormData) {
    const location = String(form.get("location") || "").trim(); if (!location) return;
    const maxId = Math.max(...tasks.map(t => t.id), 0);
    setTasks(current => [{ id: maxId + 1, district: String(form.get("district")), location, priority: String(form.get("priority")) as Priority, theme: String(form.get("theme") || "常规记录"), methods: ["待规划"], media: ["待规划"], clarity: String(form.get("clarity")), status: "未拍摄", note: String(form.get("note") || ""), sourceRow: 0 }, ...current]);
    setShowForm(false);
  }

  return <main>
    <header className="topbar">
      <div className="brand"><span className="brandMark">焦</span><span>山城取景簿</span></div>
      <nav><button className="navActive">点位库</button><button>拍摄任务</button><button>进度分析</button></nav>
      <div className="headerActions"><button className="textButton" onClick={resetData}>恢复原始数据</button><div className="avatar">TW</div><div className="profile">Tang Wei<small>重庆摄影计划</small></div></div>
    </header>

    <div className="shell">
      <section className="intro">
        <div><p className="eyebrow">CHONGQING PHOTO ATLAS · 2026</p><h1>把重庆，拍得更完整。</h1><p>已从 Excel 导入 {allGroups.length} 个点位、{tasks.length} 条主题任务，所有修改自动保存在本机。</p></div>
        <button className="primary" onClick={() => setShowForm(true)}><b>＋</b> 新建拍摄点位</button>
      </section>

      <section className="stats">
        <article><span className="statIcon orange">⌖</span><div><small>独立点位</small><strong>{allGroups.length}<i>个</i></strong><em>覆盖 {districts.length} 个区域</em></div></article>
        <article><span className="statIcon blue">◷</span><div><small>未拍摄任务</small><strong>{counts.unshot}<i>条</i></strong><em>{Math.round(counts.unshot/tasks.length*100)}% 尚未开始</em></div></article>
        <article><span className="statIcon amber">↻</span><div><small>待补拍 / 已毕业</small><strong>{counts.redo}<i> / {counts.done}</i></strong><em>任务级状态统计</em></div></article>
        <article className="progressCard"><div><small>任务完成度</small><strong>{completion}<i>%</i></strong></div><div className="ring" style={{"--p": `${completion * 3.6}deg`} as React.CSSProperties}><span>{completion}%</span></div><em>已毕业 {counts.done} / {tasks.length} 条</em></article>
      </section>

      <section className="workspace">
        <aside>
          <div className="asideTitle"><span>行政区域</span><small>{districts.length} 个</small></div>
          {["全部行政区", ...districts].map(d => <button key={d} className={district === d ? "district active" : "district"} onClick={() => setDistrict(d)}><span>{d}</span><b>{d === "全部行政区" ? allGroups.length : allGroups.filter(g => g.district === d).length}</b></button>)}
          <div className="dataHealth"><span>数据完整度</span><div><i style={{width:`${Math.round(tasks.filter(t=>t.theme!=="常规记录").length/tasks.length*100)}%`}} /></div><small>38 条已填写拍摄主题<br/>27 条已规划拍摄方式</small></div>
        </aside>

        <div className="content">
          <div className="toolbar">
            <label className="search">⌕<input aria-label="搜索点位" placeholder="搜索点位、主题、方式或备注…" value={query} onChange={e => setQuery(e.target.value)} /></label>
            <div className="filters"><select aria-label="筛选状态" value={status} onChange={e => setStatus(e.target.value)}><option>全部状态</option><option>未拍摄</option><option>待补拍</option><option>已毕业</option></select><select aria-label="筛选优先级" value={priority} onChange={e => setPriority(e.target.value)}><option>全部优先级</option><option>高</option><option>中</option><option>低</option></select></div>
          </div>
          <div className="listHead"><span>显示 {filtered.length} 个点位</span><small>按优先级排序 · 点击展开任务</small></div>
          <div className="spotList">
            {filtered.map(group => {
              const isOpen = expanded === group.key;
              const done = group.tasks.filter(t => t.status === "已毕业").length;
              return <article className={`locationCard ${isOpen ? "open" : ""}`} key={group.key}>
                <button className="locationSummary" onClick={() => setExpanded(isOpen ? null : group.key)} aria-expanded={isOpen}>
                  <span className={`priorityBadge priority-${group.priority}`}>{group.priority}</span>
                  <div className="locationName"><div><h3>{group.location}</h3><span>{group.district}</span></div><p>{group.tasks.length === 1 && group.tasks[0].theme === "常规记录" ? "拍摄主题待规划" : group.tasks.map(t => t.theme).join(" · ")}</p></div>
                  <div className="taskProgress"><small>主题任务</small><strong>{done}/{group.tasks.length}</strong><div><i style={{width:`${done/group.tasks.length*100}%`}} /></div></div>
                  <span className={`status status-${group.status}`}>{group.status}</span><span className="chevron">⌄</span>
                </button>
                {isOpen && <div className="taskPanel">{group.tasks.map(task => <div className="taskRow" key={task.id}>
                  <div className="themeCell"><small>拍摄主题</small><strong>{task.theme}</strong>{task.note && <p className="note">备注：{task.note}</p>}</div>
                  <div><small>拍摄方式</small><div className="tags">{task.methods.map(x => <span key={x}>{x}</span>)}</div></div>
                  <div><small>素材 / 通透度</small><div className="tags">{task.media.map(x => <span key={x}>▣ {x}</span>)}<span>通透度 {task.clarity}</span></div></div>
                  <div className="taskStatus"><button className={`status status-${task.status}`} onClick={() => cycleTask(task.id)}>{task.status} ↻</button><small>Excel 第 {task.sourceRow || "新增"} 行</small></div>
                </div>)}</div>}
              </article>;
            })}
          </div>
          {filtered.length === 0 && <div className="empty">没有找到匹配点位，换个筛选条件试试。</div>}
        </div>
      </section>
    </div>

    {showForm && <div className="modal" role="dialog" aria-modal="true"><form action={addLocation}><div className="modalHead"><div><small>NEW LOCATION</small><h2>添加拍摄点位</h2></div><button type="button" onClick={() => setShowForm(false)}>×</button></div><label>点位名称<input name="location" placeholder="例如：鹅岭公园瞰胜楼" autoFocus required /></label><div className="formGrid"><label>行政区域<select name="district">{districts.map(d=><option key={d}>{d}</option>)}</select></label><label>优先级<select name="priority"><option>高</option><option>中</option><option>低</option></select></label></div><div className="formGrid"><label>拍摄主题<input name="theme" placeholder="日出 / 日落 / 夜景" /></label><label>通透度<select name="clarity"><option>低</option><option>中</option><option>高</option><option>极高</option></select></label></div><label>备注<textarea name="note" placeholder="补拍要求、机位限制或季节建议" /></label><div className="modalActions"><button type="button" onClick={() => setShowForm(false)}>取消</button><button className="primary" type="submit">保存点位</button></div></form></div>}
  </main>;
}
