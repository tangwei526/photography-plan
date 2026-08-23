"use client";

export type AMapPosition = { getLng(): number; getLat(): number } | [number, number];

export type AMapOverlay = {
  on(event: string, listener: (event: unknown) => void): void;
  getPosition(): AMapPosition;
  setPosition(position: [number, number]): void;
};

export type AMapInstance = {
  addControl(control: unknown): void;
  add(overlay: unknown): void;
  clearMap(): void;
  destroy(): void;
  on(event: string, listener: (event: unknown) => void): void;
  setFitView(overlays?: unknown[], immediately?: boolean, padding?: number[], maxZoom?: number): void;
  setZoomAndCenter(zoom: number, center: AMapPosition): void;
};

export type AMapNamespace = {
  Map: new (element: HTMLElement, options?: Record<string, unknown>) => AMapInstance;
  Scale: new (options?: Record<string, unknown>) => unknown;
  ToolBar: new (options?: Record<string, unknown>) => unknown;
  Marker: new (options?: Record<string, unknown>) => AMapOverlay;
  Polyline: new (options?: Record<string, unknown>) => AMapOverlay;
};

type AMapWindow = Window & {
  AMap?: AMapNamespace;
  _AMapSecurityConfig?: { serviceHost: string };
};

let amapPromise: Promise<AMapNamespace> | null = null;

export async function loadAMap() {
  const amapWindow = window as AMapWindow;
  if (amapWindow.AMap) return amapWindow.AMap;
  if (amapPromise) return amapPromise;

  amapPromise = (async () => {
    const response = await fetch("/api/amap-config", { cache: "no-store" });
    const config = await response.json();
    if (!response.ok || !config.key) throw new Error(config.error || "高德地图未配置");

    amapWindow._AMapSecurityConfig = {
      serviceHost: `${window.location.origin}/api/amap/_AMapService`,
    };

    await new Promise<void>((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>('script[data-amap-loader="true"]');
      if (existing) {
        existing.addEventListener("load", () => resolve(), { once: true });
        existing.addEventListener("error", () => reject(new Error("高德地图加载失败")), { once: true });
        return;
      }

      const script = document.createElement("script");
      script.dataset.amapLoader = "true";
      script.src = `https://webapi.amap.com/maps?v=2.0&key=${encodeURIComponent(config.key)}&plugin=AMap.Scale,AMap.ToolBar`;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("高德地图加载失败"));
      document.head.appendChild(script);
    });

    if (!amapWindow.AMap) throw new Error("高德地图初始化失败");
    return amapWindow.AMap;
  })();

  return amapPromise;
}
