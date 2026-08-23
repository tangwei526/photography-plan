export type Geography = {
  countryCode: string;
  countryName: string;
  admin1: string;
  city: string;
  district: string;
  timezone: string;
  formattedAddress?: string;
};

export type CityStatus = "计划前往" | "已点亮";

export type CityRecord = Omit<Geography, "district" | "formattedAddress"> & {
  id: string;
  status: CityStatus;
  visitedAt?: string;
  latitude?: number;
  longitude?: number;
  note: string;
};

export const DEFAULT_GEOGRAPHY: Geography = {
  countryCode: "CN",
  countryName: "中国",
  admin1: "重庆市",
  city: "重庆市",
  district: "渝中区",
  timezone: "Asia/Shanghai",
};

type GeographySource = Partial<Geography> & { district?: string };

export function normalizeGeography(source: GeographySource | null | undefined): Geography {
  const countryCode = String(source?.countryCode || "CN").trim().toUpperCase();
  const legacyChina = !source?.countryCode || countryCode === "CN";
  const city = String(source?.city || (legacyChina ? "重庆市" : "")).trim();
  return {
    countryCode,
    countryName: String(source?.countryName || (legacyChina ? "中国" : countryCode || "未设置国家")).trim(),
    admin1: String(source?.admin1 || (legacyChina ? "重庆市" : "")).trim(),
    city,
    district: String(source?.district || "待分类").trim(),
    timezone: String(source?.timezone || (legacyChina ? "Asia/Shanghai" : "UTC")).trim(),
    formattedAddress: String(source?.formattedAddress || "").trim() || undefined,
  };
}

export function geographyLabel(source: GeographySource, detail: "city" | "district" | "full" = "full") {
  const value = normalizeGeography(source);
  const city = [value.countryName, value.admin1 !== value.city ? value.admin1 : "", value.city].filter(Boolean);
  if (detail === "city") return [...new Set(city)].join(" · ");
  const district = [...new Set([...city, value.district].filter(Boolean))];
  if (detail === "district") return district.join(" · ");
  return [...new Set([...district, value.formattedAddress || ""].filter(Boolean))].join(" · ");
}

export const countryKey = (source: GeographySource) => normalizeGeography(source).countryCode;
export const cityKey = (source: GeographySource) => {
  const value = normalizeGeography(source);
  return `${value.countryCode}::${value.admin1}::${value.city}`;
};
export const districtKey = (source: GeographySource) => {
  const value = normalizeGeography(source);
  return `${cityKey(value)}::${value.district}`;
};

export function pointIdentity(source: GeographySource, location: string) {
  return `point:${districtKey(source)}::${String(location || "").trim()}`;
}

export function cityIdentity(source: GeographySource) {
  return `city:${cityKey(source)}`;
}

export function cityGeography(source: CityRecord): Geography {
  return normalizeGeography({ ...source, district: "待分类" });
}

export function normalizeCityRecord(source: Partial<CityRecord>): CityRecord {
  const geography = normalizeGeography({ ...source, district: "待分类" });
  return {
    id: String(source.id || cityIdentity(geography)),
    countryCode: geography.countryCode,
    countryName: geography.countryName,
    admin1: geography.admin1,
    city: geography.city,
    timezone: geography.timezone,
    status: source.status === "已点亮" ? "已点亮" : "计划前往",
    visitedAt: String(source.visitedAt || "") || undefined,
    latitude: Number.isFinite(Number(source.latitude)) ? Number(source.latitude) : undefined,
    longitude: Number.isFinite(Number(source.longitude)) ? Number(source.longitude) : undefined,
    note: String(source.note || ""),
  };
}

export function deriveCityRecords(
  points: Array<Geography & { latitude?: number; longitude?: number }>,
  tasks: Array<Partial<Geography> & { status?: string; scheduleDate?: string }>,
): CityRecord[] {
  const grouped = new Map<string, typeof points>();
  for (const point of points) {
    const key = cityKey(point);
    grouped.set(key, [...(grouped.get(key) || []), point]);
  }

  return [...grouped.entries()].map(([key, cityPoints]) => {
    const first = normalizeGeography(cityPoints[0]);
    const located = cityPoints.filter((point) => Number.isFinite(point.latitude) && Number.isFinite(point.longitude));
    const relatedTasks = tasks.filter((task) => cityKey(task) === key);
    const completedDates = relatedTasks
      .filter((task) => task.status === "已毕业" && task.scheduleDate)
      .map((task) => String(task.scheduleDate))
      .sort();

    return {
      id: cityIdentity(first),
      countryCode: first.countryCode,
      countryName: first.countryName,
      admin1: first.admin1,
      city: first.city,
      timezone: first.timezone,
      status: relatedTasks.some((task) => task.status === "已毕业") ? "已点亮" : "计划前往",
      visitedAt: completedDates[0],
      latitude: located.length ? located.reduce((sum, point) => sum + Number(point.latitude), 0) / located.length : undefined,
      longitude: located.length ? located.reduce((sum, point) => sum + Number(point.longitude), 0) / located.length : undefined,
      note: "",
    };
  });
}

export function mergeCityRecords(
  existing: CityRecord[],
  points: Array<Geography & { latitude?: number; longitude?: number }>,
  tasks: Array<Partial<Geography> & { status?: string; scheduleDate?: string }>,
) {
  const derived = deriveCityRecords(points, tasks);
  const derivedByKey = new Map(derived.map((city) => [cityKey(city), city]));
  const seen = new Set<string>();
  let changed = false;

  const merged = existing.map((city) => {
    const key = cityKey(city);
    const fallback = derivedByKey.get(key);
    seen.add(key);
    if (!fallback || (city.latitude && city.longitude)) return city;
    changed = true;
    return { ...city, latitude: fallback.latitude, longitude: fallback.longitude };
  });

  for (const city of derived) {
    const key = cityKey(city);
    if (!seen.has(key)) {
      merged.push(city);
      changed = true;
    }
  }

  return changed ? merged : existing;
}
