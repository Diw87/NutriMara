import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
export default defineConfig(({ command }) => ({
  root: `${root}pwa`,
  base: "/NutriMara/",
  publicDir: command === "serve" ? `${root}public` : false,
  plugins: [react()],
  resolve: { alias: { "@": root } },
  server: { allowedHosts: ["terminal.local"], fs: { allow: [root] } },
  build: { outDir: `${root}docs`, emptyOutDir: true, sourcemap: false },
}));
