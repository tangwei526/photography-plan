import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  root: "github-pages-src",
  base: "/photography-plan/",
  publicDir: "../public",
  plugins: [react()],
  build: { outDir: "../pages-dist", emptyOutDir: true },
});
