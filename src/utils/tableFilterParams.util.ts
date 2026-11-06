/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/tabla (frontend)
 * Feature: Serialización de los filtros de columna hacia el backend (Fase 03.19, Plan 06, D-09)
 * Archivo: tableFilterParams.util.ts
 * Responsabilidad: Traducir el estado de filtros de TanStack a los NOMBRES DE PARÁMETRO que el
 *   backend declara, y dar a la barra de «filtros aplicados» el texto legible de cada filtro. Es
 *   una unidad pura: no monta React, no llama a nadie.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-09-21
 *
 * ── DE DÓNDE VIENE ───────────────────────────────────────────────────────────────────────────
 * Portado VERBATIM de `resolucion-frontend @ origin/dev — src/shared/lib/tableFilterParams.util.ts`.
 * Lo único que cambia son los imports, traducidos del alias de carpetas compartidas de la rama a
 * rutas relativas de esta estructura (D-02). No se le quitó ni se le añadió ninguna función; la
 * única línea de CÓDIGO que se aparta del original está marcada abajo con su medición.
 *
 * ── 🔴 ESTOS NOMBRES SON EL CONTRATO CON EL BACKEND ──────────────────────────────────────────
 * `FilterMisAsignadosDto` (`ejecucion-backend/src/modules/ejecucion/sorteo/presentation/dto/`) es
 * una ALLOWLIST, y el `ValidationPipe` global corre con `forbidNonWhitelisted: true`: un parámetro
 * que el DTO no declare no se ignora, se RECHAZA con 400 — y el mensaje del 400 no dice cuál fue.
 * De ahí las dos reglas que este archivo sostiene y que su prueba fija:
 *   · una columna `dateRange` con id `expCreatedAt` emite `expCreatedAtFrom` / `expCreatedAtTo`,
 *     que es exactamente lo que el DTO declara;
 *   · **lo vacío se OMITE**. Un `?expNumber=` sin valor no es «sin filtro»: es un filtro por
 *     cadena vacía, y el repositorio lo envolvería en `%%` devolviendo todo, o el DTO lo rechazaría.
 *
 * ── POR QUÉ EXISTE `normalizeColumnFiltersKey` ───────────────────────────────────────────────
 * Es la pieza que arregla, de raíz, la petición fantasma que la tabla de Ejecución tenía al montar.
 * TanStack devuelve un ARRAY NUEVO cada vez que quita un filtro vacío, así que `columnFilters`
 * cambia de identidad sin cambiar de contenido. Comparando por esta clave normalizada —solo los
 * filtros ACTIVOS, serializados— el efecto de carga deja de dispararse por un cambio que no lo es.
 */

import type { ColumnDef, ColumnFiltersState } from "@tanstack/react-table";
import { format, parseISO } from "date-fns";
import type {
  ICatalogFilterValue,
  IDateRangeFilterValue,
  TableColumnFilterType,
} from "../interfaces/ITableFilter";
import { getCatalogOptionLabel } from "../config/tableCatalogDefaults";
import type { TableCatalogKey } from "../interfaces/ITableCatalog";

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const isDateRangeFilterValue = (
  value: unknown,
): value is IDateRangeFilterValue => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as IDateRangeFilterValue;
  const { from, to } = candidate;

  if (from !== undefined && !ISO_DATE_PATTERN.test(from)) {
    return false;
  }

  if (to !== undefined && !ISO_DATE_PATTERN.test(to)) {
    return false;
  }

  return from !== undefined || to !== undefined;
};

const isEmptyDateRange = (value: IDateRangeFilterValue): boolean =>
  !value.from?.trim() && !value.to?.trim();

export const isCatalogFilterValue = (
  value: unknown,
): value is ICatalogFilterValue =>
  Array.isArray(value) &&
  value.every((item) => typeof item === "string" && item.trim() !== "");

export const getColumnFilterType = <T extends object>(
  columns: ColumnDef<T>[],
  columnId: string,
): TableColumnFilterType => {
  const column = columns.find((col) => col.id === columnId);
  return column?.meta?.filterType ?? "text";
};

const getDateRangeParamKeys = <T extends object>(
  columns: ColumnDef<T>[],
  columnId: string,
): { from: string; to: string } => {
  const column = columns.find((col) => col.id === columnId);
  const customKeys = column?.meta?.filterParamKeys;

  if (customKeys) {
    return customKeys;
  }

  return {
    from: `${columnId}From`,
    to: `${columnId}To`,
  };
};

const getFilterParamKey = <T extends object>(
  columns: ColumnDef<T>[],
  columnId: string,
): string => {
  const column = columns.find((col) => col.id === columnId);
  return column?.meta?.filterParamKey ?? columnId;
};

export const getColumnCatalogKey = <T extends object>(
  columns: ColumnDef<T>[],
  columnId: string,
): TableCatalogKey | undefined => {
  const column = columns.find((col) => col.id === columnId);
  return column?.meta?.catalogKey;
};

const formatIsoDateForBadge = (isoDate: string): string => {
  try {
    return format(parseISO(isoDate), "dd/MM/yyyy");
  } catch {
    return isoDate;
  }
};

export const formatFilterBadgeValue = (
  value: unknown,
  filterType: TableColumnFilterType,
  catalogKey?: TableCatalogKey,
): string => {
  if (filterType === "dateRange" && isDateRangeFilterValue(value)) {
    const parts: string[] = [];

    if (value.from) {
      parts.push(formatIsoDateForBadge(value.from));
    }

    if (value.to) {
      parts.push(formatIsoDateForBadge(value.to));
    }

    return parts.join(" – ");
  }

  if (filterType === "catalog" && isCatalogFilterValue(value)) {
    if (catalogKey) {
      return value
        .map((item) => getCatalogOptionLabel(catalogKey, item))
        .join(", ");
    }

    return value.join(", ");
  }

  return String(value ?? "");
};

export const isActiveFilterValue = (value: unknown): boolean => {
  if (value === undefined || value === null) {
    return false;
  }

  if (isDateRangeFilterValue(value)) {
    return !isEmptyDateRange(value);
  }

  if (isCatalogFilterValue(value)) {
    return value.length > 0;
  }

  // 🔴 ÚNICA DESVIACIÓN DE CÓDIGO respecto del original de `origin/dev`, y es un arreglo, no un
  // gusto. Allí esta función termina en el `String(value)` de abajo, y por eso un rango de fechas
  // con los DOS extremos en blanco —`{ from: "", to: "" }`— se declara FILTRO ACTIVO: el guardián
  // `isDateRangeFilterValue` lo rechaza porque `""` no casa con `YYYY-MM-DD`, así que el valor cae
  // hasta `String({…}).trim()`, que vale `"[object Object]"` y no está vacío.
  //
  // Medido con la prueba «LO VACÍO SE OMITE» de `tableFilterParams.util.test.ts`, que salió en rojo
  // contra el original: la consecuencia es que `serializeColumnFilters` emite
  // `expCreatedAt=[object Object]`, un parámetro que `FilterMisAsignadosDto` ni siquiera declara y
  // que el `ValidationPipe` global (`forbidNonWhitelisted: true`) rechaza con **400 sin decir cuál
  // de los doce filtros lo causó** — y además pinta ese mismo `[object Object]` en la barra de
  // «filtros aplicados». `isEmptyDateRange`, que existe justo para este caso, era inalcanzable.
  //
  // El arreglo es una línea: ningún OBJETO que no sea un rango válido es un filtro. Es cierto por
  // construcción —los tres tipos de filtro son cadena, array de cadenas y rango, y los dos primeros
  // ya salieron por arriba—, y `String(objeto)` nunca fue un valor de filtro legítimo.
  if (typeof value === "object") {
    return false;
  }

  return String(value).trim() !== "";
};

export const normalizeColumnFiltersKey = (
  columnFilters: ColumnFiltersState,
): string =>
  JSON.stringify(
    columnFilters
      .filter((filter) => isActiveFilterValue(filter.value))
      .map((filter) => ({ id: filter.id, value: filter.value })),
  );

export const serializeColumnFilters = <T extends object>(
  columnFilters: ColumnFiltersState,
  columns: ColumnDef<T>[],
): Record<string, string | string[]> => {
  const params: Record<string, string | string[]> = {};

  for (const filter of columnFilters) {
    if (!isActiveFilterValue(filter.value)) {
      continue;
    }

    const filterType = getColumnFilterType(columns, filter.id);

    if (filterType === "dateRange" && isDateRangeFilterValue(filter.value)) {
      const paramKeys = getDateRangeParamKeys(columns, filter.id);

      if (filter.value.from?.trim()) {
        params[paramKeys.from] = filter.value.from.trim();
      }

      if (filter.value.to?.trim()) {
        params[paramKeys.to] = filter.value.to.trim();
      }

      continue;
    }

    if (filterType === "catalog" && isCatalogFilterValue(filter.value)) {
      params[getFilterParamKey(columns, filter.id)] = filter.value.map((item) =>
        item.trim(),
      );
      continue;
    }

    params[filter.id] = String(filter.value).trim();
  }

  return params;
};

export const appendTableFilterParams = (
  params: URLSearchParams,
  filterParams: Record<string, unknown>,
): void => {
  for (const [key, value] of Object.entries(filterParams)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item !== null && item !== undefined && String(item).trim() !== "") {
          params.append(key, String(item).trim());
        }
      }
      continue;
    }

    // 🔴 RECORTADO Y COMPARADO EN BLANCO, IGUAL QUE LA RAMA DEL ARRAY (Fase 03.19, Plan 17).
    //
    // Hasta hoy esta rama comparaba contra `""` a secas mientras la de arriba hacía
    // `String(item).trim() !== ""`: dentro de la MISMA función, un `"   "` se omitía si venía en un
    // array y se emitía si venía suelto. La asimetría no se notaba porque esta función no tenía
    // todavía ningún llamante —la escribió el Plan 06 para el Plan 17— y porque desde la tabla
    // `serializeColumnFilters` ya recorta; pero la promesa de la cabecera es «lo vacío se OMITE», y
    // un `?expZone=%20%20` es justamente el filtro en blanco que el repositorio envolvería en `%%`.
    const escalar = String(value ?? "").trim();
    if (value !== null && value !== undefined && escalar !== "") {
      params.append(key, escalar);
    }
  }
};
