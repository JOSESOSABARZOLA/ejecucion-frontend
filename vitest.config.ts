/**
 * Microservicio: ejecucion
 * Módulo: App Shell
 * Feature: Infraestructura de tests (Wave 0, D-05)
 * Archivo: vitest.config.ts
 * Responsabilidad: Configurar el runner de tests (vitest) para el frontend de Ejecución. Reusa el
 *   plugin de React (react-swc) de la app para que los imports .tsx (p.ej. routes.tsx) se transformen
 *   igual que en `vite build`, corre en entorno jsdom y carga los matchers de @testing-library/jest-dom
 *   desde src/test/setup.ts. NO altera vite.config.ts ni el script build.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-07-23
 * Modificado por: Andrés Miño — 2026-09-23 (Fase 03.19, Plan 21: `css.include` para UNA hoja. El
 *   contrato de `src/styles/ui/menu-acciones-caso.css` se fija por prueba —es la pieza invisible
 *   del arreglo del gap 5 y nada más podría notar su borrado—, y para eso la prueba necesita LEER
 *   su texto. Sin esta línea no puede: vitest sustituye TODA importación de CSS por una cadena
 *   vacía, también con `?raw`.)
 * Modificado por: Andrés Miño — 2026-11-05 (quick 261105-edf: `server.deps.inline` para el paquete
 *   compartido @amc-automatizacion/ui, que importa su propia hoja)
 */

import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    // 🔴 UNA SOLA HOJA SE PROCESA, Y ES A PROPÓSITO. Por omisión vitest reemplaza toda importación
    // de CSS por una cadena vacía —`?raw` y `?inline` incluidos—, así que la prueba que fija el
    // contrato de `menu-acciones-caso.css` (`MenuAccionesCaso.test.tsx`) leería un fichero vacío y
    // pasaría en verde con la hoja BORRADA, que es justo lo que viene a impedir. El resto de las
    // hojas se sigue sustituyendo por vacío, igual que hasta hoy: no es `css: true`, es ésta y
    // ninguna más.
    //
    // ⚠️ SIN ANCLAR EL FINAL DEL PATRÓN. Se compara contra el id del módulo, que con `?raw` acaba
    // en la consulta y no en `.css`: anclarlo lo dejaría sin efecto EN SILENCIO y la prueba volvería
    // a leer vacío.
    // La segunda entrada es `src/index.css`: la prueba afirma que la hoja está IMPORTADA ahí, y una
    // regla que no se sirve es una regla que no existe. El punto hace de separador de ruta para no
    // escribir uno de Windows y otro de POSIX.
    css: { include: [/menu-acciones-caso\.css/, /src.index\.css/] },
    // El buscador flotante viene de @amc-automatizacion/ui, cuyo `dist/index.js` empieza con
    // `import "./index.css"`. Vitest externaliza lo que hay en node_modules y lo deja a Node, que no
    // sabe cargar un `.css` («Unknown file extension ".css"», desde `menuRoutes.test.ts` →
    // routes.tsx → MainLayout). Con el paquete en línea lo procesa Vite y su hoja se sustituye por
    // vacío como el resto (no entra en `css.include`).
    server: { deps: { inline: [/@amc-automatizacion\/ui/] } },
  },
});
