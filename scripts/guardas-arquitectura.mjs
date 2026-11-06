/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/tooling (frontend)
 * Feature: Guardas de arquitectura de la Fase 03.19 (D-02, D-03, D-08) — Ola 0
 * Archivo: guardas-arquitectura.mjs
 * Responsabilidad: Convertir en un FALLO EJECUTABLE, con código de salida, las tres prohibiciones
 *   que esta fase no puede dejar escritas solo en un acta. La 03.19 porta ~46 archivos desde
 *   `resolucion-frontend @ origin/dev`, que tiene otra arquitectura; la aduana de ese porte es este
 *   script, porque las tres cosas que no pueden entrar COMPILAN perfectamente y por tanto el
 *   compilador no dice nada:
 *
 *     · Guarda A (D-02) — la arquitectura `features/` + `shared/` + Redux de la rama de Resolución.
 *     · Guarda B (D-03) — el aplanado de HTML, que regresaría las fases 03.14 y 03.15.
 *     · Guarda C (D-08) — las llamadas al módulo roto del backlog 999.1.
 *
 *   Recorre `src/` (`.ts`/`.tsx`), imprime `ruta:línea` con el MOTIVO de cada hallazgo —no solo el
 *   patrón, porque quien lo lea dentro de seis meses necesita saber por qué está prohibido— y sale
 *   con 1 si hay alguno. Sin dependencias nuevas: `node:fs` + `node:path` (RESEARCH § Package
 *   Legitimacy: en esta fase se amputa la pieza, no se instala el paquete).
 *
 *   Se ejecuta con `npm run guard:arquitectura`, para que la puerta de fase y la suite lo corran
 *   por el mismo sitio.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-09-21
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIR_ACTUAL = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(DIR_ACTUAL, "..");
const SRC = path.join(RAIZ, "src");

const EXTENSIONES = new Set([".ts", ".tsx"]);

/** Carpetas que no se recorren (no son código fuente de la app). */
const DIRECTORIOS_IGNORADOS = new Set(["node_modules", "dist", "coverage"]);

/**
 * Archivos que CITAN los patrones prohibidos como datos y por tanto se delatarían solos.
 * Rutas relativas a la raíz del repo, en formato POSIX.
 *
 * El propio script no hace falta listarlo: vive en `scripts/` y el recorrido solo entra a `src/`.
 */
const ARCHIVOS_EXCLUIDOS = new Set(["src/config/guardasArquitectura.test.ts"]);

/**
 * LAS TRES GUARDAS. Cada una lleva su `motivo`, que es lo que se imprime junto al hallazgo: el
 * patrón dice QUÉ se encontró, y el motivo dice por qué eso no puede quedarse.
 */
const GUARDAS = [
  {
    id: "A",
    decision: "D-02",
    titulo: "arquitectura de la rama de Resolución (features/ + shared/ + Redux)",
    motivo:
      "D-02 prohíbe la migración arquitectónica de `origin/dev`; el código nuevo vive en " +
      "`src/pages`, `src/components`, `src/services`.",
    patrones: [
      { etiqueta: "@/features", expresion: /@\/features/ },
      { etiqueta: "@/shared", expresion: /@\/shared/ },
      { etiqueta: "@reduxjs/toolkit", expresion: /@reduxjs\// },
      { etiqueta: "react-redux", expresion: /\breact-redux\b/ },
    ],
  },
  {
    id: "B",
    decision: "D-03",
    titulo: "aplanado de HTML en el cliente",
    motivo:
      "el richtext de Ejecución viaja como HTML al backend y lo traduce `richtext-a-pdfmake`; " +
      "aplanarlo en el cliente regresa las fases 03.14 y 03.15 y emite providencias sin negrita " +
      "ni listas.",
    patrones: [
      { etiqueta: "htmlToPlainText", expresion: /\bhtmlToPlainText\b/ },
      {
        etiqueta: "dynamicDocumentGeneration",
        expresion: /\bdynamicDocumentGeneration\b/,
      },
    ],
  },
  {
    id: "C",
    decision: "D-08",
    titulo: "llamadas al módulo roto del backlog 999.1",
    motivo:
      "backlog 999.1 — `t_expediente_resolucion` está roto; la línea de tiempo se sirve de " +
      "`/epas/:eejeId/bitacora` y `/sorteo/caso/:caseId/historial`.",
    patrones: [
      {
        etiqueta: "case-administration/timeline",
        expresion: /case-administration\/timeline/,
      },
    ],
  },
];

/**
 * DEUDA CONOCIDA — excepciones ancladas a UN archivo, con el plan que las salda escrito.
 *
 * ✅ **HOY ESTÁ VACÍA, y eso es el final previsto, no un descuido.** La guarda C no nació limpia:
 * arrastraba `CaseService.getTimeline`, la llamada heredada al módulo roto del backlog 999.1. El
 * Plan 03.19-09 la retiró —`ModalTimeline` pide ahora `/epas/:eejeId/bitacora` y
 * `/sorteo/caso/:caseId/historial`— y su entrada se quitó de aquí EN EL MISMO COMMIT, que es lo que
 * el mecanismo de abajo exige: una excepción que sobrevive a su causa es una puerta abierta sin
 * dueño, así que el script FALLA si la deuda desaparece del árbol y la entrada se queda.
 *
 * Esto NO es una allowlist que se pueda engordar. Si algún día hace falta otra, va anclada al
 * ARCHIVO —nunca silenciando el patrón— para que cualquier llamada NUEVA, en cualquier otro sitio,
 * siga saliendo con código 1.
 */
const DEUDA_CONOCIDA = [];

/** Recorre un directorio y devuelve las rutas absolutas de los archivos `.ts`/`.tsx`. */
function recorrer(directorio) {
  const encontrados = [];
  for (const entrada of fs.readdirSync(directorio, { withFileTypes: true })) {
    if (entrada.isDirectory()) {
      if (DIRECTORIOS_IGNORADOS.has(entrada.name)) continue;
      encontrados.push(...recorrer(path.join(directorio, entrada.name)));
    } else if (EXTENSIONES.has(path.extname(entrada.name))) {
      encontrados.push(path.join(directorio, entrada.name));
    }
  }
  return encontrados;
}

/** Ruta relativa a la raíz, siempre con `/`, para que el reporte sea igual en Windows y en Linux. */
function relativa(absoluta) {
  return path.relative(RAIZ, absoluta).split(path.sep).join("/");
}

/** Indica si el hallazgo corresponde a la deuda conocida declarada para ese archivo. */
function esDeudaConocida(ruta, guardaId, etiqueta) {
  return DEUDA_CONOCIDA.some(
    (deuda) =>
      deuda.archivo === ruta &&
      deuda.guarda === guardaId &&
      deuda.patron === etiqueta,
  );
}

function clave(archivo, guarda, patron) {
  return archivo + "|" + guarda + "|" + patron;
}

function analizar() {
  const violaciones = [];
  const deudaVista = new Set();

  for (const absoluta of recorrer(SRC)) {
    const ruta = relativa(absoluta);
    if (ARCHIVOS_EXCLUIDOS.has(ruta)) continue;

    const lineas = fs.readFileSync(absoluta, "utf8").split(/\r?\n/);
    for (const guarda of GUARDAS) {
      for (const patron of guarda.patrones) {
        lineas.forEach((texto, indice) => {
          if (!patron.expresion.test(texto)) return;
          if (esDeudaConocida(ruta, guarda.id, patron.etiqueta)) {
            deudaVista.add(clave(ruta, guarda.id, patron.etiqueta));
            return;
          }
          violaciones.push({
            ruta,
            linea: indice + 1,
            texto: texto.trim(),
            guarda,
            patron,
          });
        });
      }
    }
  }

  // Deuda que ya se saldó y cuya entrada sigue declarada aquí: también es un fallo, con su
  // instrucción de limpieza.
  const deudaObsoleta = DEUDA_CONOCIDA.filter(
    (deuda) => !deudaVista.has(clave(deuda.archivo, deuda.guarda, deuda.patron)),
  );

  return { violaciones, deudaVista, deudaObsoleta };
}

function main() {
  const { violaciones, deudaVista, deudaObsoleta } = analizar();

  if (violaciones.length > 0) {
    console.error("\nGUARDAS DE ARQUITECTURA — FASE 03.19: hay hallazgos.\n");
    for (const guarda of GUARDAS) {
      const suyas = violaciones.filter((v) => v.guarda.id === guarda.id);
      if (suyas.length === 0) continue;
      console.error(
        "Guarda " + guarda.id + " (" + guarda.decision + ") — " + guarda.titulo,
      );
      console.error("  Motivo: " + guarda.motivo);
      for (const v of suyas) {
        console.error(
          "    " +
            v.ruta +
            ":" +
            v.linea +
            "  [" +
            v.patron.etiqueta +
            "]  " +
            v.texto,
        );
      }
      console.error("");
    }
  }

  for (const deuda of deudaObsoleta) {
    console.error(
      "DEUDA CONOCIDA YA SALDADA: " +
        deuda.archivo +
        ' ya no contiene "' +
        deuda.patron +
        '" (guarda ' +
        deuda.guarda +
        ").\n" +
        "  Quita su entrada de DEUDA_CONOCIDA en scripts/guardas-arquitectura.mjs, en el mismo\n" +
        "  commit que la saldó (" +
        deuda.salda +
        "). Una excepción que sobrevive a su causa\n" +
        "  es una puerta abierta sin dueño.\n",
    );
  }

  if (violaciones.length > 0 || deudaObsoleta.length > 0) {
    console.error(
      "Resultado: " +
        violaciones.length +
        " violación(es) y " +
        deudaObsoleta.length +
        " excepción(es) obsoleta(s).",
    );
    process.exit(1);
  }

  console.log("Guardas de arquitectura (D-02, D-03, D-08): sin hallazgos en src/.");
  for (const deuda of DEUDA_CONOCIDA) {
    if (deudaVista.has(clave(deuda.archivo, deuda.guarda, deuda.patron))) {
      console.log(
        "  Deuda conocida PENDIENTE — guarda " +
          deuda.guarda +
          ": " +
          deuda.archivo +
          ' ("' +
          deuda.patron +
          '"). La salda: ' +
          deuda.salda +
          ".",
      );
    }
  }
  process.exit(0);
}

main();
