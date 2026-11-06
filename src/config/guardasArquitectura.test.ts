/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/tooling (frontend)
 * Feature: Las guardas de arquitectura de la Fase 03.19 (D-02, D-03, D-08) — Ola 0
 * Archivo: guardasArquitectura.test.ts
 * Responsabilidad: Envolver `scripts/guardas-arquitectura.mjs` en la suite, para que las tres
 *   prohibiciones de la fase no dependan de que alguien se acuerde de correr un script suelto.
 *
 *   🔴 QUÉ SE VA A ROMPER Y QUÉ LO IMPIDE. Esta fase porta ~46 archivos desde
 *   `resolucion-frontend @ origin/dev`, que tiene OTRA arquitectura. Tres cosas pueden entrar
 *   pegadas a ellos y NINGUNA la detecta el compilador, porque todas compilan perfectamente:
 *     1. la arquitectura `features/` + `shared/` + Redux que D-02 prohíbe (entraría por un import
 *        que TypeScript ni siquiera resuelve como error si alguien añade el alias);
 *     2. el aplanado de HTML de Resolución (`htmlToPlainText`, `dynamicDocumentGeneration`), que
 *        emitiría providencias sin negrita ni listas y regresaría las fases 03.14 y 03.15;
 *     3. las llamadas al módulo roto del backlog 999.1 (`case-administration/timeline`).
 *
 *   Por eso el archivo no prueba solo que la guarda pasa hoy: prueba que MUERDE. Una guarda que no
 *   puede fallar no es una guarda, es un comentario con código de salida 0. Cada caso siembra un
 *   archivo que viola una familia y exige que el script salga con 1 y NOMBRE al archivo.
 *
 *   ⚠️ Este archivo está en la lista de exclusiones del script, porque cita los patrones prohibidos
 *   como DATOS. Si se renombra, hay que renombrarlo también en `ARCHIVOS_EXCLUIDOS`, o la guarda se
 *   delatará a sí misma.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-09-21
 */
import { describe, it, expect, afterEach, beforeAll } from "vitest";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIR_ACTUAL = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(DIR_ACTUAL, "..", "..");
const GUARDA = path.join(RAIZ, "scripts", "guardas-arquitectura.mjs");

/** Prefijo de los archivos sembrados: hace obvio en `git status` que algo quedó sin limpiar. */
const PREFIJO_SEMBRADO = "__violacion-sembrada-";

interface Corrida {
  codigo: number;
  salida: string;
}

/**
 * Corre la guarda y devuelve su código de salida y su reporte JUNTOS. `execFileSync` LANZA cuando el
 * proceso sale con código distinto de 0 — que aquí es el caso interesante, no un fallo del test—, así
 * que el catch no es defensivo: es la mitad normal del contrato.
 */
function correrGuarda(): Corrida {
  try {
    const salida = execFileSync(process.execPath, [GUARDA], {
      cwd: RAIZ,
      encoding: "utf8",
    });
    return { codigo: 0, salida };
  } catch (error) {
    const err = error as {
      status?: number;
      stdout?: string;
      stderr?: string;
      message?: string;
    };
    const salida = `${err.stdout ?? ""}\n${err.stderr ?? ""}`.trim();
    return { codigo: err.status ?? -1, salida: salida || (err.message ?? "") };
  }
}

/** Siembra un archivo que viola una guarda, dentro de `src/` para que el recorrido lo alcance. */
function sembrar(nombre: string, contenido: string): string {
  const destino = path.join(RAIZ, "src", "config", `${PREFIJO_SEMBRADO}${nombre}`);
  fs.writeFileSync(destino, contenido, "utf8");
  return destino;
}

/** Borra todo lo sembrado, haya pasado lo que haya pasado. */
function limpiarSembrados(): void {
  const dir = path.join(RAIZ, "src", "config");
  for (const archivo of fs.readdirSync(dir)) {
    if (archivo.startsWith(PREFIJO_SEMBRADO)) {
      fs.rmSync(path.join(dir, archivo), { force: true });
    }
  }
}

describe("guardas de arquitectura (D-02, D-03, D-08)", () => {
  // Si una corrida anterior murió a mitad, el árbol arrastraría una violación sembrada y el primer
  // caso fallaría culpando al repo. Se limpia ANTES de medir nada.
  beforeAll(limpiarSembrados);
  afterEach(limpiarSembrados);

  it("sale con código 0 sobre el árbol de hoy", () => {
    const { codigo, salida } = correrGuarda();
    expect(salida).toBeTruthy();
    expect(codigo).toBe(0);
  });

  it("D-02: muerde un import de la arquitectura `features/` de Resolución", () => {
    const archivo = sembrar(
      "features.ts",
      'import { algo } from "@/features/case-administration/algo";\nexport const x = algo;\n',
    );
    const { codigo, salida } = correrGuarda();
    expect(codigo).toBe(1);
    expect(salida).toContain(path.basename(archivo));
    expect(salida).toContain("D-02");
  });

  it("D-02: muerde un import de Redux", () => {
    const archivo = sembrar(
      "redux.ts",
      'import { createSlice } from "@reduxjs/toolkit";\nexport const s = createSlice;\n',
    );
    const { codigo, salida } = correrGuarda();
    expect(codigo).toBe(1);
    expect(salida).toContain(path.basename(archivo));
  });

  it("D-03: muerde el aplanado de HTML que regresaría 03.14 y 03.15", () => {
    const archivo = sembrar(
      "aplanado.ts",
      "export const plano = (html: string) => htmlToPlainText(html);\n" +
        "declare function htmlToPlainText(html: string): string;\n",
    );
    const { codigo, salida } = correrGuarda();
    expect(codigo).toBe(1);
    expect(salida).toContain(path.basename(archivo));
    expect(salida).toContain("D-03");
  });

  it("D-08: muerde una llamada NUEVA al módulo roto del backlog 999.1", () => {
    // El archivo sembrado no es el de la deuda conocida: eso es lo que se prueba. La excepción del
    // árbol de hoy está anclada a UN archivo, no al patrón, así que una llamada nueva en cualquier
    // otro sitio sigue siendo un fallo.
    const archivo = sembrar(
      "timeline.ts",
      'export const url = (id: number) => `/case-administration/timeline/${id}`;\n',
    );
    const { codigo, salida } = correrGuarda();
    expect(codigo).toBe(1);
    expect(salida).toContain(path.basename(archivo));
    expect(salida).toContain("999.1");
  });
});
