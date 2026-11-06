/**
 * Microservicio: ejecucion
 * Módulo: test (frontend)
 * Feature: Puerta — sin copia local del CAT v1.3 (quick 261104-jh1)
 * Archivo: sinCatalogoLocal.test.ts
 * Responsabilidad: Convertir en una prueba que FALLA la prohibición de la quick 261104-jh1 en el
 *   frontend: la copia local de las 891 infracciones del CAT v1.3 se borró (el buscador consulta el
 *   catálogo de CORE por el backend y las materias salen de Sorteo), y no puede volver. Falla si el
 *   módulo borrado existe o si algún `.ts`/`.tsx` de `src` (sin pruebas) nombra ese módulo o la ruta
 *   del diccionario retirado del backend.
 *
 *   ── CÓMO LEE ───────────────────────────────────────────────────────────────────────────────────
 *   Con `import.meta.glob(..., { query: "?raw" })` de Vite y NO con `node:fs`, por la misma razón
 *   que `MenuAccionesCaso.test.tsx`: `tsconfig.app.json` no abre `fs` a `src` a propósito. El glob
 *   lee los ficheros de verdad, del disco, y sus claves dicen qué archivos existen.
 *
 *   Los nombres prohibidos se construyen por CONCATENACIÓN para que este archivo no los escriba de
 *   forma literal (como la puerta del backend, `sin-catalogo-local.spec.ts`).
 * Desarrollador: Andrés Miño
 * Fecha: 2026-11-04
 */
import { describe, expect, it } from "vitest";

/** Nombre del módulo borrado con la copia local de las 891 infracciones. */
const MODULO_BORRADO = "infracciones" + "CatV13";
/** Ruta del endpoint del diccionario retirado del backend. */
const RUTA_DICCIONARIO = "/infracciones/" + "diccionario";

const FUENTES = import.meta.glob<string>("/src/**/*.{ts,tsx}", {
  query: "?raw",
  import: "default",
  eager: true,
});

/** Los fuentes de la app, sin las pruebas (que pueden citar lo prohibido para defenderlo). */
const fuentesDeLaApp = Object.entries(FUENTES).filter(
  ([ruta]) => !/\.test\.tsx?$/.test(ruta),
);

describe("sin copia local del CAT v1.3 (quick 261104-jh1)", () => {
  it("el recorrido lee la app de verdad (si no, la puerta pasaría sin mirar nada)", () => {
    expect(fuentesDeLaApp.length).toBeGreaterThan(100);
    expect(Object.keys(FUENTES)).toContain("/src/main.tsx");
    // Y lee el CONTENIDO, no solo los nombres: el servicio pide las materias de Sorteo.
    expect(FUENTES["/src/services/InfraccionesService.ts"]).toContain(
      "/infracciones/materias",
    );
  });

  it("el módulo de la copia local no existe", () => {
    expect(Object.keys(FUENTES)).not.toContain(`/src/data/${MODULO_BORRADO}.ts`);
  });

  it("ningún fuente de la app nombra el módulo borrado ni la ruta del diccionario retirado", () => {
    const hallazgos = fuentesDeLaApp.flatMap(([ruta, texto]) =>
      texto
        .split("\n")
        .map((linea, i) => ({ ruta, linea: i + 1, texto: linea.trim() }))
        .filter(
          (l) =>
            l.texto.includes(MODULO_BORRADO) ||
            l.texto.includes(RUTA_DICCIONARIO),
        ),
    );

    if (hallazgos.length > 0) {
      throw new Error(
        "La copia local del CAT v1.3 ha vuelto (retirada en la quick 261104-jh1: el catálogo es " +
          "el de CORE vía backend y las materias salen de Sorteo):\n" +
          hallazgos
            .map((h) => `  ${h.ruta}:${h.linea}  ${h.texto}`)
            .join("\n"),
      );
    }
    expect(hallazgos).toEqual([]);
  });
});
