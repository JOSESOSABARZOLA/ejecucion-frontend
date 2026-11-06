/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/tabla (frontend)
 * Feature: Catálogos de los filtros de columna de la tabla (Fase 03.19, Plan 06, D-09)
 * Archivo: ITableCatalog.ts
 * Responsabilidad: Declarar QUÉ columnas admiten filtro de catálogo (desplegable cerrado) y cómo se
 *   escribe una opción. Es el tipo que `ColumnMeta.catalogKey` referencia, así que una columna solo
 *   puede pedir un catálogo que exista aquí: el compilador rechaza `catalogKey: "loQueSea"`.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-09-21
 * Modificado por: Andrés Miño — 2026-10-06 (quick 261006-g35: la clave se parte en catálogos
 *   LOCALES —derivados de código— y REMOTOS —servidos por el backend—; entra el id de materia, la
 *   materia del expediente, como primer catálogo remoto)
 * Modificado por: Andrés Miño — 2026-10-06 (quick 261006-kys: el id de materia se parte en DOS claves
 *   remotas, `materiaId` y `submateriaId`, los dos niveles del catálogo)
 * Modificado por: Andrés Miño — 2026-10-16 (Fase 03.23, Plan 11 — D-14/D-17: las dos claves remotas
 *   pasan a `materiaCod` y `submateriaCod`, CÓDIGOS del diccionario CAT v1.3; el catálogo local de
 *   materias se retiró)
 * Modificado por: Andrés Miño — 2026-11-04 (quick 261104-jh1: las dos claves remotas vuelven a
 *   `materiaId` y `submateriaId`, ahora ids de SORTEO de `GET /infracciones/materias`; el diccionario
 *   CAT v1.3 local se retiró)
 * Modificado por: Andrés Miño — 2026-11-05 (quick 261105-ma6: nota de que la grafía de la zona es
 *   «Manuela Sáenz», con tilde, como CORE; la medición histórica no se toca)
 *
 * ── DE DÓNDE VIENE Y QUÉ SE LE AMPUTÓ ────────────────────────────────────────────────────────
 * Portado de `resolucion-frontend @ origin/dev — src/shared/domain/types/ITableCatalog.ts`. Allí
 * `TableCatalogKey` tiene cuatro claves, y las cuatro son de Resolución: `eresStatus`, `expZone`,
 * `eresMedidaCautelar` y `eresHasAppeal`. Las tres últimas NO se portan —los dos `eres*` son
 * columnas que la bandeja de Ejecución no tiene— y la primera se traduce a `eejeStatus`, que es el
 * nombre que `FilterMisAsignadosDto` declara en el backend (D-09).
 *
 * ── 🔴 `expZone` NO ES UNA CLAVE DE CATÁLOGO, Y LA OMISIÓN ES LA DECISIÓN ─────────────────────
 * La rama sí la tiene, y la captura de la que sale esta fase enseña «seleccione» en la columna
 * ZONAL. Pero esa captura es de Resolución, donde el dato está limpio. Medido sobre EjecucionDB el
 * 2026-09-21, `exp_zone` es TEXTO LIBRE y está sucio:
 *
 *     Manuela Saenz 32 · Eugenio Espejo 24 · Tumbaco 24 · Eugenio Espejo (Norte) 1 · Quitumbe 1
 *
 * ⟳ 2026-11-05 (quick 261105-ma6): la grafía buena es «Manuela Sáenz», con tilde, como CORE; el
 * backend ya la escribe así en el simulador y la siembra. La línea de arriba es la medición de
 * aquel día y no se reescribe.
 *
 * El catálogo de la rama codifica TRES zonales. Un desplegable de tres esconde dos expedientes al
 * filtrar y no avisa de que los está escondiendo — un filtro que miente es peor que un filtro
 * tosco. ZONAL usa filtro de TEXTO (`ILIKE`), que encuentra `Eugenio Espejo` y
 * `Eugenio Espejo (Norte)` con la misma búsqueda (UI-SPEC §1.3, y el JSDoc de `expZone` en
 * `filter-mis-asignados.dto.ts` dice lo mismo desde el otro lado del cable).
 *
 * No se declara la clave con una lista vacía: `TABLE_CATALOG_DEFAULTS` es un `Record` TOTAL, y una
 * clave sin opciones pintaría un disparador permanentemente deshabilitado. El día que exista un
 * endpoint `SELECT DISTINCT exp_zone`, la clave se añade aquí y el tipo obliga a poblarla.
 */

/**
 * Catálogos LOCALES: sus opciones se DERIVAN de código (hoy, `eejeStatus` desde `estadosEpas.ts`,
 * espejo del enum del backend). Están listas al primer render y no tocan la red. Añadir una clave
 * aquí obliga a poblarla en `TABLE_CATALOG_DEFAULTS`, que es un `Record` total sobre este tipo.
 */
export type TableCatalogKeyLocal = "eejeStatus";

/**
 * Catálogos REMOTOS: sus opciones las da el SERVIDOR. Son DOS y los dos salen del mismo sitio, el
 * catálogo de materias de SORTEO servido por `GET /infracciones/materias` (quick 261104-jh1):
 *   · `materiaId` — ids de MATERIA de Sorteo (`subId`, p. ej. 26 = LICENCIAMIENTO).
 *   · `submateriaId` — ids de SUBMATERIA de Sorteo (= ssubId de CORE, p. ej. 54 = LUAE).
 * Son exactamente los parámetros que acepta `GET /sorteo/mis-asignados` (enteros) y los aplica por
 * PERTENENCIA sobre las infracciones del EPAS: la materia de cada infracción sale de Sorteo por su
 * submateria y queda en la foto del backend.
 *
 * Dos claves y no una porque cada nivel registra sus etiquetas aparte en `tableCatalogDefaults.ts`.
 * Teclearlos aquí sería una segunda verdad que divergiría de Sorteo. Añadir una clave aquí obliga a darle cargador en `useTableCatalogOptions.ts` (otro
 * `Record` total).
 */
export type TableCatalogKeyRemoto = "materiaId" | "submateriaId";

/**
 * Las columnas que se filtran por catálogo cerrado: hay DOS clases de catálogo, local y remoto, y
 * esta unión es lo que `ColumnMeta.catalogKey` admite.
 */
export type TableCatalogKey = TableCatalogKeyLocal | TableCatalogKeyRemoto;

/** Una opción del desplegable: `value` es lo que viaja al backend, `label` lo que lee la persona. */
export type ICatalogOption = {
  value: string;
  label: string;
};

/**
 * Forma de la respuesta de un futuro endpoint GENÉRICO de catálogos. Se conserva del original aunque
 * hoy nadie la consuma: los dos catálogos remotos se leen de las materias de Sorteo y se mapean
 * a `ICatalogOption` en `useTableCatalogOptions.ts`.
 */
export type ICatalogOptionsResponse = {
  data: ICatalogOption[];
};
