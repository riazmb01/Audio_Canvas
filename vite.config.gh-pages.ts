import { defineConfig, Plugin } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// Set your GitHub repository name here (or use environment variable)
const repoName = process.env.REPO_NAME || 'Audio_Canvas';
const basePath = `/${repoName}/`;

// Plugin to fix favicon path for GitHub Pages
function faviconPlugin(): Plugin {
  return {
    name: 'favicon-base-path',
    transformIndexHtml(html) {
      return html.replace(
        /href="[^"]*favicon\.svg"/,
        `href="${basePath}favicon.svg"`
      );
    }
  };
}

export default defineConfig({
  base: basePath,
  plugins: [react(), faviconPlugin()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist"),
    emptyOutDir: true,
  },
});
