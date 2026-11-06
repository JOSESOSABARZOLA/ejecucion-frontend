/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/tabla (frontend)
 * Feature: Las opciones de cada filtro de catálogo (Fase 03.19, Plan 06, D-09)
 * Archivo: tableCatalogDefaults.ts
 * Responsabilidad: Decir qué opciones ofrece cada desplegable de la fila de filtros, y traducir un
 *   valor a su etiqueta legible para la barra de «filtros aplicados».
 * Desarrollador: Andrés Miño
 * Fecha: 2026-09-21
 * Modificado por: Andrés Miño — 2026-10-06 (quick 261006-g35: los defaults pasan a ser solo de los
 *   catálogos LOCALES, y entra un registro de las opciones REMOTAS ya cargadas para que la barra de
 *   «filtros aplicados» lea «Materia: Ambiente» y no el id)
 * Modificado por: Andrés Miño — 2026-10-06 (quick 261006-kys: solo comentarios. El registro guarda
 *   ahora DOS catálogos remotos, `materiaId` y `submateriaId`, cada uno en su entrada)
 * Modificado por: Andrés Miño — 2026-10-16 (Fase 03.23, Plan 11 — D-17: solo comentarios. Las dos
 *   claves remotas pasan a `materiaCod` y `submateriaCod`, códigos del diccionario CAT v1.3)
 * Modificado por: Andrés Miño — 2026-11-04 (quick 261104-jh1: solo comentarios. Las dos claves remotas
 *   son ahora `materiaId` y `submateriaId`, ids de Sorteo de `GET /infracciones/materias`)
 *
 * ── DE DÓNDE VIENE Y QUÉ SE LE AMPUTÓ ────────────────────────────────────────────────────────
 * Portado ADAPTADO de `resolucion-frontend @ origin/dev — src/shared/config/tableCatalogDefaults.ts`.
 * De sus cuatro catálogos sobrevive uno. Se amputan:
 *   · `eresMedidaCautelar` y `eresHasAppeal` — columnas que la bandeja de Ejecución no tiene.
 *   · `expZone` — tres zonales tecleadas a mano sobre un dato que en EjecucionDB está SUCIO. El
 *     porqué completo está en la cabecera de `ITableCatalog.ts`; en corto: filtrar por un catálogo
 *     de tres esconde dos expedientes reales sin avisar, y ZONAL se filtra por texto.
 *
 * ── 🔴 LOS ESTADOS NO SE TECLEAN AQUÍ: SE DERIVAN ────────────────────────────────────────────
 * La versión de la rama teclea su propia lista (`CASE_STATUSES`). Aquí el catálogo de `eejeStatus`
 * se CONSTRUYE a partir de `src/config/estadosEpas.ts`, que es el espejo del enum `EpasState` del
 * backend y tiene prueba de totalidad. Si se tecleara una segunda lista, el día que el backend
 * añada un estado habría dos sitios que actualizar y uno de los dos se olvidaría: el desplegable
 * ofrecería un estado que el servidor no reconoce (400) o dejaría de ofrecer uno que sí existe
 * (filas invisibles). Con la derivación, ese fallo no se puede escribir.
 */

import {
  ESTADOS_EPAS,
  ETIQUETA_ESTADO_EPAS,
} from "./estadosEpas";
import type {
  ICatalogOption,
  TableCatalogKey,
  TableCatalogKeyLocal,
  TableCatalogKeyRemoto,
} from "../interfaces/ITableCatalog";

/**
 * Las opciones de cada catálogo LOCAL. Es un `Record` TOTAL sobre `TableCatalogKeyLocal`: añadir una
 * clave local al tipo obliga a poblarla aquí, y por eso no puede existir un desplegable vacío. Los
 * catálogos REMOTOS no viven aquí: los carga `useTableCatalogOptions.ts`.
 */
export const TABLE_CATALOG_DEFAULTS: Record<
  TableCatalogKeyLocal,
  readonly ICatalogOption[]
> = {
  // El orden es el del enum del backend, que es el orden del recorrido del expediente: de
  // `RECIBIDO` a `EN_TRABAJO_COMUNITARIO`. No se ordena alfabéticamente a propósito — alfabético
  // pondría `ARCHIVADO` primero, que es el final del trámite.
  eejeStatus: ESTADOS_EPAS.map((estado) => ({
    value: estado,
    label: ETIQUETA_ESTADO_EPAS[estado],
  })),
};

/** ¿La clave es de un catálogo LOCAL (sus opciones están en `TABLE_CATALOG_DEFAULTS`)? */
export const esCatalogoLocal = (
  clave: TableCatalogKey,
): clave is TableCatalogKeyLocal =>
  Object.prototype.hasOwnProperty.call(TABLE_CATALOG_DEFAULTS, clave);

/**
 * quick 261006-g35 — REGISTRO de las opciones REMOTAS ya cargadas, por clave.
 *
 * Existe SOLO para la barra de «filtros aplicados»: `formatFilterBadgeValue` es síncrona y pura, y
 * sin este registro leería «Materia: 26» en vez de «Materia: LICENCIAMIENTO». NO es una caché de
 * peticiones —nadie lee de aquí para ahorrarse un `GET`—: lo rellena `useTableCatalogOptions` cada
 * vez que carga, y cada carga sustituye lo anterior. Este fichero no importa servicios: la red vive
 * en el hook.
 *
 * Quick 261104-jh1: hay dos claves remotas, `materiaId` y `submateriaId`, las dos del catálogo de
 * materias de Sorteo. Cada una tiene su propia entrada en el `Map`, así que las etiquetas de materias y de
 * submaterias nunca se mezclan.
 */
const OPCIONES_REMOTAS = new Map<
  TableCatalogKeyRemoto,
  readonly ICatalogOption[]
>();

/** Registra (sustituyendo) las opciones que el servidor devolvió para un catálogo remoto. */
export const registrarOpcionesRemotas = (
  clave: TableCatalogKeyRemoto,
  opciones: readonly ICatalogOption[],
): void => {
  OPCIONES_REMOTAS.set(clave, opciones);
};

/**
 * La etiqueta legible de un valor de catálogo, con *fallback* AL VALOR CRUDO.
 *
 * El *fallback* no es defensa ceremonial: la barra de «filtros aplicados» pinta lo que el usuario
 * eligió, y si un día llega un valor que este catálogo no conoce, enseñar el valor tal cual dice la
 * verdad; devolver cadena vacía haría creer que no hay filtro puesto cuando sí lo hay. Un catálogo
 * remoto que aún no se cargó (o que falló) se lee con el id crudo por la misma razón.
 */
export const getCatalogOptionLabel = (
  catalogKey: TableCatalogKey,
  value: string,
): string => {
  const opciones = esCatalogoLocal(catalogKey)
    ? TABLE_CATALOG_DEFAULTS[catalogKey]
    : (OPCIONES_REMOTAS.get(catalogKey) ?? []);
  const option = opciones.find((entry) => entry.value === value);

  return option?.label ?? value;
};
