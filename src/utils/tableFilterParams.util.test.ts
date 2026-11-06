/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/tabla (frontend)
 * Feature: Unidad pura de la serialización de filtros de columna (Fase 03.19, Plan 06, D-09)
 * Archivo: tableFilterParams.util.test.ts
 * Responsabilidad: Bloquear con aserciones EJECUTABLES los NOMBRES DE PARÁMETRO que salen de la
 *   tabla hacia `GET /sorteo/mis-asignados`. Lo que se prueba aquí no es «que la función funcione»:
 *   es que los nombres que emite coincidan, letra por letra, con los que `FilterMisAsignadosDto`
 *   declara en el backend. Ese DTO es una allowlist bajo `forbidNonWhitelisted: true`, así que una
 *   divergencia no se manifiesta como un filtro que no filtra, sino como un **400 que no dice cuál
 *   de los doce parámetros lo causó**.
 *
 *   Se cubren los tres tipos de filtro y, en cada uno, el caso VACÍO — que es el que más caro sale:
 *   emitir una clave sin valor es pedir «filtra por nada», no «no filtres».
 * Desarrollador: Andrés Miño
 * Fecha: 2026-09-21
 * Modificado por: Andrés Miño — 2026-10-06 (quick 261006-g35: la barra de «filtros aplicados» lee
 *   la etiqueta de un catálogo REMOTO —las materias— desde el registro que el hook rellena al cargar)
 * Modificado por: Andrés Miño — 2026-10-06 (quick 261006-kys: dos catálogos remotos, materia y
 *   submateria, cada uno con su registro)
 * Modificado por: Andrés Miño — 2026-10-16 (Fase 03.23, Plan 17 — D-16/D-17: los catálogos remotos
 *   pasan a `materiaCod`/`submateriaCod` con códigos del diccionario CAT v1.3, y un caso nuevo fija
 *   las tres claves de la infracción —`materiaCod`, `submateriaCod`, `infraccion`— hasta el query)
 * Modificado por: Andrés Miño — 2026-11-04 (quick 261104-jh1: las claves de materia son `materiaId` y
 *   `submateriaId`, ids de Sorteo en texto)
 */

import { describe, it, expect } from "vitest";
import type { ColumnDef, ColumnFiltersState } from "@tanstack/react-table";
import {
  appendTableFilterParams,
  formatFilterBadgeValue,
  isActiveFilterValue,
  normalizeColumnFiltersKey,
  serializeColumnFilters,
} from "./tableFilterParams.util";
import { registrarOpcionesRemotas } from "../config/tableCatalogDefaults";
import "../interfaces/ITableFilter";

/** Una fila de la bandeja del decisor, recortada a lo que estas columnas necesitan. */
type FilaBandeja = {
  expNumber: string;
  expZone: string;
  eejeStatus: string;
  expCreatedAt: string;
};

/**
 * Las cuatro columnas que esta prueba necesita, y son las cuatro formas que la bandeja usa:
 *
 *   · `expNumber`    — texto por defecto (sin `meta`): el caso más común y el que no se declara.
 *   · `expZone`      — texto DECLARADO. Existe para dejar constancia de que ZONAL NO es catálogo
 *                      (el dato es texto libre y sucio; ver `ITableCatalog.ts`).
 *   · `eejeStatus`   — catálogo: emite un ARRAY, que es lo que el DTO espera para `= ANY($n)`.
 *   · `expCreatedAt` — rango de fechas: emite el par `…From`/`…To`.
 */
const COLUMNAS: ColumnDef<FilaBandeja>[] = [
  { id: "expNumber", header: "Expediente" },
  { id: "expZone", header: "Zonal", meta: { filterType: "text" } },
  {
    id: "eejeStatus",
    header: "Estatus",
    meta: { filterType: "catalog", catalogKey: "eejeStatus" },
  },
  { id: "expCreatedAt", header: "Creado", meta: { filterType: "dateRange" } },
];

describe("serializeColumnFilters — los nombres que el backend declara", () => {
  it("un filtro de TEXTO viaja con el id de la columna como nombre, y recortado", () => {
    const filtros: ColumnFiltersState = [
      { id: "expNumber", value: "  EPAS-2026-04101  " },
    ];

    expect(serializeColumnFilters(filtros, COLUMNAS)).toEqual({
      expNumber: "EPAS-2026-04101",
    });
  });

  it("un filtro de CATÁLOGO viaja como ARRAY con el id de la columna", () => {
    const filtros: ColumnFiltersState = [
      { id: "eejeStatus", value: ["ASIGNADO_DECISOR", "EN_VERIFICACION_PAGO"] },
    ];

    expect(serializeColumnFilters(filtros, COLUMNAS)).toEqual({
      eejeStatus: ["ASIGNADO_DECISOR", "EN_VERIFICACION_PAGO"],
    });
  });

  it("un RANGO DE FECHAS sobre `expCreatedAt` emite EXACTAMENTE `expCreatedAtFrom` y `expCreatedAtTo`", () => {
    const filtros: ColumnFiltersState = [
      { id: "expCreatedAt", value: { from: "2026-09-01", to: "2026-09-21" } },
    ];

    const parametros = serializeColumnFilters(filtros, COLUMNAS);

    // Se afirma el conjunto EXACTO de claves, no solo su contenido: una clave de más también es un
    // 400, porque el DTO rechaza lo que no declara.
    expect(Object.keys(parametros).sort()).toEqual([
      "expCreatedAtFrom",
      "expCreatedAtTo",
    ]);
    expect(parametros).toEqual({
      expCreatedAtFrom: "2026-09-01",
      expCreatedAtTo: "2026-09-21",
    });
  });

  it("un rango con solo `desde` emite solo `…From`: el extremo que falta no se inventa", () => {
    const filtros: ColumnFiltersState = [
      { id: "expCreatedAt", value: { from: "2026-09-01" } },
    ];

    expect(serializeColumnFilters(filtros, COLUMNAS)).toEqual({
      expCreatedAtFrom: "2026-09-01",
    });
  });

  it("un `filterParamKeys` explícito manda sobre el `<id>From`/`<id>To` derivado", () => {
    // La escotilla para cuando el nombre del parámetro del backend no se deriva del id.
    const columnasConNombrePropio: ColumnDef<FilaBandeja>[] = [
      {
        id: "expCreatedAt",
        header: "Creado",
        meta: {
          filterType: "dateRange",
          filterParamKeys: { from: "desde", to: "hasta" },
        },
      },
    ];

    const filtros: ColumnFiltersState = [
      { id: "expCreatedAt", value: { from: "2026-09-01", to: "2026-09-21" } },
    ];

    expect(serializeColumnFilters(filtros, columnasConNombrePropio)).toEqual({
      desde: "2026-09-01",
      hasta: "2026-09-21",
    });
  });

  it("LO VACÍO SE OMITE en los tres tipos: ni una clave sale hacia el servidor", () => {
    // Éste es el caso que justifica el archivo. Los tres estados vacíos se dan de verdad: el texto
    // en blanco lo produce borrar lo tecleado; el array vacío, deseleccionar la única opción; y el
    // rango sin extremos, vaciar el campo «Desde».
    const filtros: ColumnFiltersState = [
      { id: "expNumber", value: "   " },
      { id: "eejeStatus", value: [] },
      { id: "expCreatedAt", value: { from: "", to: "" } },
    ];

    expect(serializeColumnFilters(filtros, COLUMNAS)).toEqual({});
  });

  it("🔴 las tres columnas de la infracción (quick 261104-jh1) emiten `materiaId`, `submateriaId` e `infraccion`", () => {
    // Son exactamente las tres claves que `FilterMisAsignadosDto` acepta; las de código
    // (`materiaCod`, `submateriaCod`) son ya un 400 por la allowlist. Los valores de catálogo son
    // IDS de Sorteo en texto (`26`, `54`).
    type FilaInfraccion = { materia: string; submateria: string; codigos: string };
    const columnas: ColumnDef<FilaInfraccion>[] = [
      {
        id: "materiaId",
        header: "Materia",
        meta: {
          filterType: "catalog",
          catalogKey: "materiaId",
          filterParamKey: "materiaId",
        },
      },
      {
        id: "submateriaId",
        header: "Submateria",
        meta: {
          filterType: "catalog",
          catalogKey: "submateriaId",
          filterParamKey: "submateriaId",
        },
      },
      {
        id: "infraccion",
        header: "Infracciones",
        meta: { filterType: "text", filterParamKey: "infraccion" },
      },
    ];
    const filtros: ColumnFiltersState = [
      { id: "materiaId", value: ["26"] },
      { id: "submateriaId", value: ["54", "43"] },
      { id: "infraccion", value: "  LU-X  " },
    ];

    expect(serializeColumnFilters(filtros, columnas)).toEqual({
      materiaId: ["26"],
      submateriaId: ["54", "43"],
      infraccion: "LU-X",
    });

    const params = new URLSearchParams();
    appendTableFilterParams(params, serializeColumnFilters(filtros, columnas));
    expect(params.toString()).toBe(
      "materiaId=26&submateriaId=54&submateriaId=43&infraccion=LU-X",
    );
  });
});

describe("isActiveFilterValue — qué cuenta como filtro puesto", () => {
  it("reconoce activos los tres tipos con contenido", () => {
    expect(isActiveFilterValue("EPAS-2026-04101")).toBe(true);
    expect(isActiveFilterValue(["ARCHIVADO"])).toBe(true);
    expect(isActiveFilterValue({ from: "2026-09-01" })).toBe(true);
  });

  it("no cuenta como filtro lo vacío, lo ausente ni lo nulo", () => {
    expect(isActiveFilterValue("   ")).toBe(false);
    expect(isActiveFilterValue([])).toBe(false);
    expect(isActiveFilterValue({ from: "", to: "" })).toBe(false);
    expect(isActiveFilterValue(undefined)).toBe(false);
    expect(isActiveFilterValue(null)).toBe(false);
  });
});

describe("normalizeColumnFiltersKey — la clave que evita la petición fantasma", () => {
  it("un filtro VACÍO no cambia la clave: es el arreglo de la petición duplicada al montar", () => {
    // TanStack devuelve un array NUEVO al quitar un filtro vacío. Antes eso bastaba para que el
    // efecto de carga volviera a pedir lo mismo. Comparando por esta clave, deja de bastar.
    const sinFiltros: ColumnFiltersState = [];
    const conUnoVacio: ColumnFiltersState = [{ id: "expNumber", value: "" }];

    expect(normalizeColumnFiltersKey(conUnoVacio)).toBe(
      normalizeColumnFiltersKey(sinFiltros),
    );
  });

  it("un filtro con contenido SÍ cambia la clave", () => {
    expect(normalizeColumnFiltersKey([{ id: "expNumber", value: "04101" }])).not.toBe(
      normalizeColumnFiltersKey([]),
    );
  });
});

describe("formatFilterBadgeValue — lo que se lee en la barra de «filtros aplicados»", () => {
  it("un rango se lee en formato del país, con los dos extremos", () => {
    expect(
      formatFilterBadgeValue(
        { from: "2026-09-01", to: "2026-09-21" },
        "dateRange",
      ),
    ).toBe("01/09/2026 – 21/09/2026");
  });

  it("un catálogo se lee con la ETIQUETA del estado, no con el valor del enum", () => {
    expect(
      formatFilterBadgeValue(["EN_VERIFICACION_PAGO"], "catalog", "eejeStatus"),
    ).toBe("En verificación de pago");
  });

  it("un valor de catálogo desconocido se enseña CRUDO en vez de desaparecer", () => {
    // Degradación honesta: si el backend añade un estado antes que el frontend, el usuario ve
    // `EN_LO_QUE_SEA` —feo, pero rastreable— en vez de un badge sin texto.
    expect(formatFilterBadgeValue(["EN_LO_QUE_SEA"], "catalog", "eejeStatus")).toBe(
      "EN_LO_QUE_SEA",
    );
  });

  it("un catálogo REMOTO (materias) se lee con la etiqueta que se registró al cargarlo; un id nunca registrado, crudo", () => {
    // La barra es síncrona y pura, así que lee del REGISTRO que el hook rellena tras cargar el
    // catálogo de materias de Sorteo (quick 261104-jh1). Aquí se registra a mano para probar la unidad sin
    // red. Viaja el ID (`22`), se lee el NOMBRE.
    registrarOpcionesRemotas("materiaId", [
      { value: "22", label: "AMBIENTE" },
    ]);

    expect(formatFilterBadgeValue(["22"], "catalog", "materiaId")).toBe(
      "AMBIENTE",
    );
    expect(formatFilterBadgeValue(["999"], "catalog", "materiaId")).toBe(
      "999",
    );
  });

  it("el catálogo REMOTO de SUBMATERIAS tiene su propio registro: un id de materia no se lee en el de submaterias", () => {
    // Dos claves y dos registros: cada nivel se lee del suyo, aunque los dos salgan del mismo
    // catálogo de Sorteo. Un id de materia buscado en submaterias se enseña CRUDO, no con el nombre
    // del otro nivel.
    registrarOpcionesRemotas("materiaId", [
      { value: "26", label: "LICENCIAMIENTO" },
    ]);
    registrarOpcionesRemotas("submateriaId", [
      { value: "54", label: "LUAE" },
      { value: "43", label: "EDIFICACIÓN" },
    ]);

    expect(formatFilterBadgeValue(["54"], "catalog", "submateriaId")).toBe(
      "LUAE",
    );
    expect(formatFilterBadgeValue(["43"], "catalog", "submateriaId")).toBe(
      "EDIFICACIÓN",
    );
    expect(formatFilterBadgeValue(["26"], "catalog", "submateriaId")).toBe(
      "26",
    );
    expect(formatFilterBadgeValue(["26"], "catalog", "materiaId")).toBe(
      "LICENCIAMIENTO",
    );
  });
});

describe("appendTableFilterParams — el paso del objeto al query string", () => {
  it("un array repite la clave, que es lo que `@Transform(aArray)` del DTO espera", () => {
    const params = new URLSearchParams();

    appendTableFilterParams(params, {
      eejeStatus: ["ASIGNADO_DECISOR", "CUMPLIDO"],
      expNumber: "04101",
    });

    expect(params.toString()).toBe(
      "eejeStatus=ASIGNADO_DECISOR&eejeStatus=CUMPLIDO&expNumber=04101",
    );
  });

  it("no escribe claves para valores vacíos, nulos o ausentes", () => {
    const params = new URLSearchParams();

    appendTableFilterParams(params, {
      expNumber: "",
      expZone: null,
      eejeStatus: [],
      admiName: undefined,
    });

    expect(params.toString()).toBe("");
  });

  // 🔴 Fase 03.19, Plan 17. La rama del ARRAY recortaba y comparaba en blanco; la del ESCALAR no:
  // dentro de la misma función, un `"   "` se omitía dentro de un array y se emitía suelto. Esta
  // prueba salió en ROJO contra la versión anterior, que escribía `expZone=+++`.
  it("🔴 un escalar de SOLO ESPACIOS tampoco se escribe, y el que se escribe va recortado", () => {
    const params = new URLSearchParams();

    appendTableFilterParams(params, {
      expZone: "   ",
      admiName: "  Gabriela  ",
      eejeStatus: ["  CUMPLIDO  "],
    });

    expect(params.toString()).toBe("admiName=Gabriela&eejeStatus=CUMPLIDO");
  });
});
