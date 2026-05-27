import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? "/Gaveteira/" : "/",
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        duel: resolve(__dirname, "experiments/gaveteira-duel/index.html"),
      },
    },
  },
});
