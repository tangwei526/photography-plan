import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "山城取景簿｜重庆摄影点位管理",
  description: "按行政区规划、执行与归档重庆摄影点位。",
  icons: { icon: "/favicon.svg" },
  openGraph: {
    title: "山城取景簿",
    description: "把重庆，拍得更完整。",
    images: [{ url: "/og.png", width: 1733, height: 909, alt: "山城取景簿" }],
  },
  twitter: { card: "summary_large_image", images: ["/og.png"] },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{__html:`(()=>{try{const saved=localStorage.getItem("shancheng-theme");document.documentElement.dataset.theme=saved==="light"?"light":"dark"}catch{document.documentElement.dataset.theme="dark"}})()`}}/></head><body>{children}</body></html>;
}
