/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/tabla (frontend)
 * Feature: Los tres tipos de filtro de columna de la tabla (Fase 03.19, Plan 06, D-09)
 * Archivo: ITableFilter.ts
 * Responsabilidad: Declarar los tres tipos de filtro —texto, rango de fechas y catálogo— y AMPLIAR
 *   el `ColumnMeta` de TanStack con los cuatro campos que la tabla lee para despachar el control y
 *   para nombrar el parámetro que sale hacia el backend.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-09-21
 *
 * ── DE DÓNDE VIENE ───────────────────────────────────────────────────────────────────────────
 * Portado VERBATIM de `resolucion-frontend @ origin/dev — src/shared/types/ITableFilter.ts`. Lo
 * único traducido es el import de `TableCatalogKey`, que allí llega por el alias de carpetas
 * compartidas de la rama y aquí es un archivo vecino (D-02: esa arquitectura no entra).
 *
 * ⚠️ El alias NO se escribe literalmente en ningún comentario de este plan: `guardas-arquitectura.mjs`
 * busca la cadena línea a línea, y citarla —aunque sea para explicar que se amputó— produce un
 * hallazgo permanente que nadie podría distinguir de una violación de verdad.
 *
 * ── 🔴 ESTE ARCHIVO HAY QUE IMPORTARLO POR SU EFECTO SECUNDARIO ──────────────────────────────
 * El `declare module` de abajo es *ambient*: solo se aplica si el archivo entra en la compilación.
 * `Table.tsx` lo importa con `import "../../interfaces/ITableFilter";` —sin llaves, sin nombre— y
 * por eso esa línea NO es prescindible: quitarla no rompe el `import`, rompe el TIPO. Sin ella,
 * `column.columnDef.meta?.filterType` deja de existir para el compilador y toda la fila de filtros
 * cae a «texto» en silencio.
 */

import type { RowData } from "@tanstack/react-table";
import type { TableCatalogKey } from "./ITableCatalog";

/** Rango de fechas de una columna `dateRange`. Los dos extremos son `YYYY-MM-DD` o no están. */
export type IDateRangeFilterValue = {
  from?: string;
  to?: string;
};

/** Selección de un filtro de catálogo. Es un array aunque hoy solo se elija una opción. */
export type ICatalogFilterValue = string[];

/** Los tres controles que `FilterByColumn` sabe pintar. Sin `meta.filterType`, se asume `text`. */
export type TableColumnFilterType = "text" | "dateRange" | "catalog";

/**
 * Nombres EXPLÍCITOS de los dos parámetros de un rango, para cuando el `<id>From`/`<id>To` que se
 * deriva del id de la columna no coincide con lo que el DTO del backend declara.
 */
export type TableColumnFilterParamKeys = {
  from: string;
  to: string;
};

declare module "@tanstack/react-table" {
  // Los dos genéricos son los de la interfaz original de TanStack y hay que repetirlos para
  // ampliarla, aunque esta ampliación no los use: es la forma que exige la fusión de declaraciones.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    /** Qué control pinta la fila de filtros para esta columna. Por defecto, `text`. */
    filterType?: TableColumnFilterType;
    /** Nombres explícitos del par `desde`/`hasta` de un `dateRange`. */
    filterParamKeys?: TableColumnFilterParamKeys;
    /** Qué catálogo alimenta el desplegable de una columna `catalog`. */
    catalogKey?: TableCatalogKey;
    /** Nombre del parámetro de un filtro de catálogo, cuando difiere del id de la columna. */
    filterParamKey?: string;
    /**
     * 🔴 AÑADIDO SOBRE EL ORIGINAL — no existe en `origin/dev`. Fija la columna a la derecha
     * mientras la tabla se desplaza en horizontal, que es lo que la captura enseña para ACCIONES y
     * lo que el UI-SPEC §1.6 pide. La rama no fija ninguna columna, así que esto no se pudo portar.
     *
     * Es un INTERRUPTOR, no un estilo: `Table.tsx` traduce este `true` a las clases
     * `app-data-table-actions-col` (en los dos `<th>`) y `app-data-table-actions-cell` (en el
     * `<td>`), cuyas reglas viven en `src/styles/ui/tables.css`. La página decide QUÉ columna se
     * fija; la tabla decide CÓMO. Así la bandeja del decisor, que define su propia columna de
     * acciones (`hideActionsColumn` + columna propia, UI-SPEC §1.6), la puede fijar sin que la
     * tabla sepa de qué columna se trata.
     *
     * Ninguna pantalla anterior a esta fase lo declara, así que para todas ellas no cambia nada.
     */
    pinnedRight?: boolean;
    /**
     * Fija la columna a la IZQUIERDA mientras la tabla se desplaza en horizontal. Es el gap 2 del
     * UAT de la Fase 03.22, pedido literal del usuario: «podemos hacer que la columna del nro del
     * expediente se mantenga estatica cuando se hace scroll horizontal? como la columna de las
     * acciones». Con 17 columnas, desplazarse a la derecha para teclear una orden de pago hacía
     * perder de vista de qué expediente era la fila.
     *
     * 🔴 SUSTITUYE A LA PREGUNTA P2 DEL CONTRATO DE UI, y por eso las dos columnas de orden de pago
     * NO se movieron: reordenarlas contradiría lo que la Fase 03.19 decidió sobre qué se lee antes
     * del pliegue, y fijar el identificador sirve para las 17 columnas y no sólo para las dos
     * nuevas.
     *
     * Es un INTERRUPTOR, no un estilo —igual que su hermano de la derecha—: `Table.tsx` traduce
     * este `true` a las clases `app-data-table-pinned-col` / `-cell` de
     * `src/styles/ui/tables.css`. La página decide QUÉ columna se fija; la tabla decide CÓMO.
     *
     * 🔴 LA ASIMETRÍA CON `pinnedRight`, que es la trampa de este interruptor: el bloque fijado NO
     * es sólo esta columna. Cuando la tabla pinta su columna de numeración —`numberColumn`, que
     * declara `Table.tsx` y NO la página—, esa numeración va DELANTE, así que entra en el bloque y
     * lidera pegada al borde; esta columna va detrás, desplazada por el ancho de aquélla. Fijar
     * sólo la declarada dejaría un hueco a la izquierda por donde se vería pasar el contenido
     * desplazado. Por la derecha el problema no existe: ACCIONES es la última de verdad.
     *
     * Ninguna pantalla anterior a esta fase lo declara, así que para todas ellas no cambia nada.
     */
    pinnedLeft?: boolean;
  }
}
