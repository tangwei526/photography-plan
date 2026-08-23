import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toast";
import { TooltipProvider } from "@/components/ui/tooltip";

export const metadata: Metadata = {
  title: "取景簿｜全球摄影点位与拍摄计划",
  description: "跨国家和城市规划、执行与归档摄影点位、机位、任务与样片。",
  icons: { icon: "/favicon.svg" },
  openGraph: {
    title: "取景簿",
    description: "把想去的地方，拍得更完整。",
    images: [{ url: "/og.png", width: 1733, height: 909, alt: "取景簿" }],
  },
  twitter: { card: "summary_large_image", images: ["/og.png"] },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN" data-theme="dark" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{__html:`(()=>{try{const saved=localStorage.getItem("shancheng-theme");document.documentElement.dataset.theme=saved==="light"?"light":"dark"}catch{document.documentElement.dataset.theme="dark"}})()`}}/></head><body><TooltipProvider>{children}</TooltipProvider><Toaster/></body></html>;
}
