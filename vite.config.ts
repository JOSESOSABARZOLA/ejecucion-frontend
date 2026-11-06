import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5177,
    strictPort: true,
    // Espejo del `location ^~ /api/` de nginx.conf (con su rewrite). En desarrollo
    // el cliente HTTP llama directo a http://localhost:3004 (config/env.ts), así
    // que este proxy solo lo usan los visores al abrir un `docUrl` relativo
    // "/api/fileserver/ejecucion/...". Sin él, vite devolvería el index.html del
    // SPA y pdf.js fallaría con "Invalid PDF structure". La cookie de sesión
    // (puesta por localhost:3004, path "/") viaja porque las cookies no
    // distinguen puerto.
    proxy: {
      "/api": {
        target: "http://localhost:3004",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
});
