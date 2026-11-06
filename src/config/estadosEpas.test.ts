/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/bandejas (frontend)
 * Feature: El catálogo de los 16 estados del EPAS en pantalla (Fase 03.19, Plan 07, D-10)
 * Archivo: estadosEpas.test.ts
 * Responsabilidad: Demostrar, recorriendo el enum ENTERO valor por valor, que ningún estado del
 *   EPAS llega a la columna `ESTATUS` sin etiqueta legible y sin chip propio.
 *
 *   ── 🔴 POR QUÉ ESTA PRUEBA ES DE TOTALIDAD Y NO DE MUESTRA ───────────────────────────────────
 *   Porque el defecto que corrige el Plan 07 es exactamente un defecto de COBERTURA, no de lógica:
 *   las claves de `BADGE_GROUPS` estaban en minúsculas y sin guiones bajos (`recibido`, `sorteado`)
 *   y los estados del EPAS llegan como `EN_VERIFICACION_PAGO`. Ninguna clave casaba, así que los
 *   15 estados caían al mismo azul pálido por defecto — y NADA fallaba: `BadgePriority` tiene un
 *   `?? BADGE_GROUPS.default` que convierte el fallo en un color. Una prueba de muestra sobre dos
 *   estados habría pasado igual de verde con los otros trece rotos.
 *
 *   Es el mismo criterio de `politicaAcciones.test.ts`: se recorre el union entero, porque lo que
 *   se quiere demostrar no es que un caso funcione sino que NINGUNO se quedó fuera.
 *
 *   ── 🔴 CÓMO SE COMPRUEBA «NO CAE EN EL POR DEFECTO» ──────────────────────────────────────────
 *   Por PRESENCIA DE LA CLAVE en `BADGE_GROUPS`, nunca comparando el valor con el del grupo por
 *   defecto. Dos estados —`PENDIENTE_ARCHIVO` y `EN_EJECUCION_HACER`— tienen `badge-soft badge-info`
 *   a propósito, que es el MISMO valor que `default`: una comparación de valores los daría por
 *   rotos estando bien. Lo que se afirma es que el mapa los conoce, no de qué color son.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-09-21
 * Modificado por: Andrés Miño — 2026-10-21 (Fase 03.24, Plan 20 — G-04: `estaAntesDelSorteo`)
 */

import { describe, expect, it } from "vitest";
import {
  agruparPorFamilia,
  CHIP_ESTADO_EPAS,
  COLOR_FAMILIA_ESTADO_EPAS,
  ESTADOS_ANTES_DEL_SORTEO,
  ESTADOS_EPAS,
  estaAntesDelSorteo,
  ETIQUETA_ESTADO_EPAS,
  etiquetaEstadoEpas,
  FAMILIA_ESTADO_EPAS,
  FAMILIAS_ESTADO_EPAS,
  RESUMEN_FAMILIA_ESTADO_EPAS,
  type EstadoEpas,
} from "./estadosEpas";
import { BADGE_GROUPS } from "../components/common/BadgePriority";
import type { InboxActionStatus } from "./inboxActionStatusRules";

/**
 * 🔴 LOS 16 VALORES, ESCRITOS A MANO (2026-10-12: entra RECURSO_ACEPTADO).
 *
 * Deliberadamente NO se derivan de `ESTADOS_EPAS`: una prueba que lee su lista del mismo sitio que
 * el código no comprueba nada —si alguien borra un estado del catálogo, la lista de la prueba
 * encoge con él y todo sigue verde—. Esta lista es la transcripción independiente del enum
 * `EpasState` de `ejecucion-backend/src/modules/ejecucion/epas/interfaces/epas-state.enum.ts`, que
 * es el contrato compartido. Si el backend añade un estado 17, esta prueba tiene que fallar.
 */
const ESTADOS_DEL_CONTRATO: EstadoEpas[] = [
  "RECIBIDO",
  "VERIFICADO",
  "SORTEADO",
  "ASIGNADO_DECISOR",
  "EN_VERIFICACION_PAGO",
  "PENDIENTE_COACTIVA",
  "CUMPLIDO",
  "PENDIENTE_ARCHIVO",
  "ARCHIVADO",
  "DEVUELTO_DMR",
  "DEVUELTO_POR_NULIDAD",
  "RECURSO_ACEPTADO",
  "EN_IMPUGNACION",
  "EN_PRESCRIPCION",
  "EN_EJECUCION_HACER",
  "EN_TRABAJO_COMUNITARIO",
];

describe("estadosEpas — el catálogo de la columna ESTATUS", () => {
  it("🔴 los 16 estados del contrato tienen etiqueta Y chip: ninguno se quedó fuera del catálogo", () => {
    expect(ESTADOS_DEL_CONTRATO).toHaveLength(16);

    for (const estado of ESTADOS_DEL_CONTRATO) {
      expect(
        ETIQUETA_ESTADO_EPAS[estado],
        `el estado ${estado} no tiene etiqueta legible`,
      ).toBeTruthy();
      expect(
        CHIP_ESTADO_EPAS[estado],
        `el estado ${estado} no tiene chip`,
      ).toBeTruthy();
    }
  });

  it("el catálogo no lleva estados de más: `ESTADOS_EPAS` es exactamente el contrato del backend", () => {
    expect([...ESTADOS_EPAS].sort()).toEqual([...ESTADOS_DEL_CONTRATO].sort());
  });

  it("🔴 ninguno de los 16 cae en el grupo POR DEFECTO de BadgePriority", () => {
    for (const estado of ESTADOS_DEL_CONTRATO) {
      // Presencia de la CLAVE, no comparación de valores: ver la cabecera de este archivo.
      expect(
        Object.prototype.hasOwnProperty.call(BADGE_GROUPS, estado),
        `BADGE_GROUPS no conoce la clave ${estado}: la columna ESTATUS lo pintaría con el chip por defecto`,
      ).toBe(true);
    }
  });

  it("el chip que BadgePriority resuelve para cada estado es el que declara el catálogo", () => {
    for (const estado of ESTADOS_DEL_CONTRATO) {
      expect(BADGE_GROUPS[estado]).toBe(CHIP_ESTADO_EPAS[estado]);
    }
  });

  it("🔴 un estado DESCONOCIDO devuelve el valor crudo, nunca `undefined` en pantalla", () => {
    // Que el estado sea ilegible es preferible a que la fila desaparezca o pinte «undefined»
    // (T-03.19-30: el valor crudo no es dato personal).
    expect(etiquetaEstadoEpas("ESTADO_QUE_NO_EXISTE")).toBe(
      "ESTADO_QUE_NO_EXISTE",
    );
    expect(etiquetaEstadoEpas(undefined)).toBe("");
    expect(etiquetaEstadoEpas("")).toBe("");
  });

  it("🔴 ninguna etiqueta lleva guion bajo ni va toda en MAYÚSCULAS: el enum no se enseña crudo", () => {
    for (const estado of ESTADOS_DEL_CONTRATO) {
      const etiqueta = ETIQUETA_ESTADO_EPAS[estado];

      expect(
        etiqueta,
        `la etiqueta de ${estado} conserva un guion bajo del enum`,
      ).not.toMatch(/_/);
      // Toda en mayúsculas = sigue siendo el valor crudo disfrazado. Se compara contra su propia
      // versión en mayúsculas: una etiqueta legible siempre tiene alguna minúscula.
      expect(
        etiqueta === etiqueta.toUpperCase(),
        `la etiqueta de ${estado} («${etiqueta}») está toda en mayúsculas`,
      ).toBe(false);
    }
  });

  it("los 7 estados que GATEAN acciones son un subconjunto del catálogo, no una segunda lista", () => {
    // `InboxActionStatus` es el subconjunto de estados que abre o cierra acciones de bandeja; este
    // catálogo es el enum COMPLETO. Que uno deje de estar contenido en el otro significaría que hay
    // dos listas de estados del EPAS en el frontend, que es justo lo que esta fase evita.
    const QUE_GATEAN: InboxActionStatus[] = [
      "RECIBIDO",
      "VERIFICADO",
      "SORTEADO",
      "ASIGNADO_DECISOR",
      "EN_VERIFICACION_PAGO",
      "EN_TRABAJO_COMUNITARIO",
      "PENDIENTE_COACTIVA",
    ];

    for (const estado of QUE_GATEAN) {
      expect(ESTADOS_DEL_CONTRATO).toContain(estado);
    }
  });
});

/**
 * ── LAS FAMILIAS, PARA AGREGAR EN EL TABLERO (2026-10-02) ─────────────────────────────────────
 * Lo que hay que impedir no es un color feo: es que el anillo del tablero NO SUME lo mismo que las
 * tarjetas de arriba. Un estado que se cae por el camino hace que los dos números se contradigan en
 * la misma pantalla, y el usuario no tiene forma de saber cuál creer.
 */
describe("estadosEpas — RECURSO_ACEPTADO (261012-giz)", () => {
  it("se lee «Recurso aceptado», con el chip rojo y la familia de su hermano DEVUELTO_POR_NULIDAD", () => {
    expect(etiquetaEstadoEpas("RECURSO_ACEPTADO")).toBe("Recurso aceptado");
    expect(CHIP_ESTADO_EPAS.RECURSO_ACEPTADO).toBe("badge-error");
    expect(FAMILIA_ESTADO_EPAS.RECURSO_ACEPTADO).toBe("Fuera del módulo");
    expect(FAMILIA_ESTADO_EPAS.RECURSO_ACEPTADO).toBe(
      FAMILIA_ESTADO_EPAS.DEVUELTO_POR_NULIDAD,
    );
  });
});

describe("estadosEpas — familias para el tablero", () => {
  it("cada uno de los 16 estados tiene familia: el mapa es TOTAL", () => {
    for (const estado of ESTADOS_EPAS) {
      expect(FAMILIAS_ESTADO_EPAS).toContain(FAMILIA_ESTADO_EPAS[estado]);
    }
  });

  it("cada familia tiene su color y su explicación", () => {
    for (const familia of FAMILIAS_ESTADO_EPAS) {
      expect(COLOR_FAMILIA_ESTADO_EPAS[familia]).toMatch(/^--color-/);
      expect(RESUMEN_FAMILIA_ESTADO_EPAS[familia]).toBeTruthy();
    }
  });

  it("🔴 agrupar CONSERVA el total: ni un expediente se pierde por el camino", () => {
    const conteo = ESTADOS_EPAS.map((estado, indice) => ({
      estado,
      total: indice + 1,
    }));
    const esperado = conteo.reduce((suma, fila) => suma + fila.total, 0);

    const agrupado = agruparPorFamilia(conteo);

    expect(agrupado.reduce((suma, fila) => suma + fila.value, 0)).toBe(esperado);
  });

  it("suma los estados de la misma familia en una sola porción", () => {
    const agrupado = agruparPorFamilia([
      { estado: "RECIBIDO", total: 58 },
      { estado: "VERIFICADO", total: 3 },
      { estado: "SORTEADO", total: 3 },
      { estado: "ASIGNADO_DECISOR", total: 21 },
    ]);

    expect(agrupado).toHaveLength(1);
    expect(agrupado[0]).toMatchObject({ label: "En trámite", value: 85 });
  });

  it("descarta las familias vacías: no pinta porciones de cero", () => {
    const agrupado = agruparPorFamilia([{ estado: "CUMPLIDO", total: 10 }]);

    expect(agrupado).toHaveLength(1);
    expect(agrupado[0].label).toBe("Logrado");
  });

  /**
   * 🔴 Si el backend añade un estado y este catálogo todavía no lo conoce, perderlo haría que el
   * anillo dejara de cuadrar con los totales SIN QUE NADA FALLE. Sale con su valor crudo: feo, pero
   * verdadero y rastreable — el mismo criterio que `etiquetaEstadoEpas`.
   */
  it("🔴 un estado que el catálogo no conoce NO se descarta: sale crudo, al final", () => {
    const agrupado = agruparPorFamilia([
      { estado: "CUMPLIDO", total: 10 },
      { estado: "EN_LO_QUE_SEA", total: 2 },
    ]);

    expect(agrupado.reduce((suma, fila) => suma + fila.value, 0)).toBe(12);
    expect(agrupado[agrupado.length - 1]).toMatchObject({
      label: "EN_LO_QUE_SEA",
      value: 2,
    });
  });

  it("sin conteo devuelve lista vacía, no una fila de ceros", () => {
    expect(agruparPorFamilia([])).toEqual([]);
  });
});

/**
 * ANTES DEL SORTEO (Fase 03.24, Plan 20 — G-04). Decide solo qué frase enseña la línea de tiempo
 * abierta desde la Bandeja de Entrada: con el expediente todavía sin sortear, el aviso de «sin
 * identificador de asignación» sería falso, porque no hay identificador que resolver.
 */
describe("estaAntesDelSorteo — los estados en los que todavía no ha habido sorteo (G-04)", () => {
  it.each(["RECIBIDO", "VERIFICADO", "DEVUELTO_DMR"])(
    "%s está antes del sorteo",
    (estado) => {
      expect(estaAntesDelSorteo(estado)).toBe(true);
    },
  );

  it.each(["ASIGNADO_DECISOR", "SORTEADO", "EN_VERIFICACION_PAGO"])(
    "%s ya pasó por el sorteo",
    (estado) => {
      expect(estaAntesDelSorteo(estado)).toBe(false);
    },
  );

  it("sin estado (undefined, null o vacío) NO se da por «antes del sorteo»", () => {
    expect(estaAntesDelSorteo(undefined)).toBe(false);
    expect(estaAntesDelSorteo(null)).toBe(false);
    expect(estaAntesDelSorteo("")).toBe(false);
  });

  it("el conjunto son exactamente tres estados, y los tres existen en el catálogo", () => {
    expect([...ESTADOS_ANTES_DEL_SORTEO].sort()).toEqual([
      "DEVUELTO_DMR",
      "RECIBIDO",
      "VERIFICADO",
    ]);
    for (const estado of ESTADOS_ANTES_DEL_SORTEO) {
      expect(ESTADOS_EPAS).toContain(estado);
    }
  });
});
