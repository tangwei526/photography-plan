import * as XLSX from "xlsx";

const headers = [
  "国家代码", "国家", "省/州", "城市", "区县", "时区", "完整地址",
  "点位名称", "点位优先级", "拍摄任务", "拍摄时间", "创作主题",
  "拍摄方式", "素材类型", "通透度要求", "拍摄状态", "计划日期",
  "计划时段", "机位名称", "机位说明", "经度", "纬度", "坐标系",
  "补拍原因", "缺失镜头", "毕业标准", "样片链接", "备注",
];

const dataSheet = XLSX.utils.aoa_to_sheet([headers]);
dataSheet["!cols"] = headers.map((header) => ({
  wch: ["完整地址", "毕业标准", "备注"].includes(header) ? 28 : Math.max(12, header.length * 2 + 2),
}));
dataSheet["!autofilter"] = { ref: `A1:${XLSX.utils.encode_col(headers.length - 1)}1` };
dataSheet["!freeze"] = { xSplit: 0, ySplit: 1, topLeftCell: "A2", activePane: "bottomLeft", state: "frozen" };

const guideRows = [
  ["字段", "填写说明", "示例"],
  ["国家代码", "ISO 3166-1 两位国家代码；用于地图服务与分组", "CN / JP / FR"],
  ["国家—区县", "完整地点层级。旧模板只有“行政区域”时仍可继续导入", "中国 / 重庆市 / 重庆市 / 渝中区"],
  ["时区", "IANA 时区名称；决定天气、日月与日历时间", "Asia/Shanghai / Europe/Paris"],
  ["点位名称", "同一地点层级下用于识别点位的名称", "洪崖洞"],
  ["拍摄任务", "一个点位可占多行，对应多个任务", "日出 / 日落 / 蓝调 / 夜景"],
  ["创作主题", "多个主题使用顿号、逗号或斜杠分隔", "桥梁、轨道交通"],
  ["经纬度", "WGS84；国内高德坐标可将坐标系填写为 gcj02。也可留空后在地图选择", "106.585 / 29.563"],
  ["状态与枚举", "优先级：高/中/低；通透度：低/中/高/极高；状态：未拍摄/待补拍/已毕业", "高 / 极高 / 未拍摄"],
  ["导入方法", "在“点位库”点击“Excel 导入”，导入前请删除示例内容并保留表头", ""],
];
const guideSheet = XLSX.utils.aoa_to_sheet(guideRows);
guideSheet["!cols"] = [{ wch: 16 }, { wch: 68 }, { wch: 30 }];

const cityHeaders = ["国家代码", "国家", "省/州", "城市", "时区", "点亮状态", "到访日期", "城市中心经度", "城市中心纬度", "关联点位数", "城市备注"];
const citySheet = XLSX.utils.aoa_to_sheet([cityHeaders]);
citySheet["!cols"] = cityHeaders.map((header) => ({ wch: header === "城市备注" ? 28 : 14 }));
citySheet["!autofilter"] = { ref: `A1:${XLSX.utils.encode_col(cityHeaders.length - 1)}1` };

const workbook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(workbook, dataSheet, "点位数据");
XLSX.utils.book_append_sheet(workbook, citySheet, "城市足迹");
XLSX.utils.book_append_sheet(workbook, guideSheet, "填写说明");
XLSX.writeFile(workbook, "public/摄影点位导入模板.xlsx");
