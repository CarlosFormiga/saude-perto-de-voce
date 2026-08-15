import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig({
  base: "/saude/",
  plugins: [react()],
  build: { outDir: "static-dist", emptyOutDir: true, rollupOptions: { input: resolve(import.meta.dirname, "index.html") } },
});
