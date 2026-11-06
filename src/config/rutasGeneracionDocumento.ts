/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/generacion-documento (frontend)
 * Feature: La ruta de la página de generación de documentos (Fase 03.19, Plan 11 — D-12)
 * Archivo: rutasGeneracionDocumento.ts
 * Responsabilidad: Ser el ÚNICO sitio donde se escribe la ruta de la página de generación, para que
 *   `routes.tsx` (que la registra en el plan 16), el catálogo del `⋮` (que navega a ella) y quien
 *   venga después no puedan discrepar.
 *
 *   ── 🔴 POR QUÉ UNA CONSTANTE Y NO LA CADENA SUELTA EN CADA SITIO ─────────────────────────────
 *   Es el mismo razonamiento que ya está escrito en `rutasObligacionHacer.ts`, su análogo exacto:
 *   la ruta que se registra y la ruta a la que se navega tienen que coincidir LETRA POR LETRA o el
 *   enlace cae en el comodín `*` de `routes.tsx` — es decir, la entrada del menú existe, se ve, y
 *   al pulsarla devuelve al decisor a la raíz sin decirle nada. Con un solo literal por ruta, ese
 *   error solo puede ocurrir en el diff de ESTE archivo, y `menuRoutes.test.ts` lo vigila.
 *
 *   ── 🔴 LA SALVEDAD DE ESTA FASE: NO HAY SUBMENÚ Y NO HAY MIGRACIÓN SQL ───────────────────────
 *   La rama del correctivo distingue dos rutas: la de su bandeja —que SÍ la siembra una migración
 *   en `t_submenus`, porque el menú lateral no sale de este repositorio— y la de su página, que
 *   exige un expediente concreto y por eso no tiene submenú. Esta ruta es SOLO de la segunda clase:
 *   `RUTA_GENERAR_DOCUMENTO` no se puede construir sin un identificador de expediente, así que una
 *   entrada de menú lateral apuntando aquí sería una entrada que no se puede pulsar. **No hay nada
 *   que sembrar en la base, y por tanto no hay migración que escribir ni que mantener sincronizada.**
 *   Se llega a esta página desde el `⋮` de la bandeja del decisor y, desde el quick 261014-kn3,
 *   desde «Generar providencia» de la ficha de la obligación de hacer.
 *
 *   ── 🔴 UNA LISTA CERRADA DE ORÍGENES, NO UNA RUTA EN LA URL ─────────────────────────────────
 *   Con dos puertas de entrada, la vuelta deja de ser una sola: quien entra desde la ficha de la
 *   obligación de hacer espera volver a esa ficha, no a la bandeja. El origen viaja en la query
 *   (`?desde=…`) como una CLAVE, nunca como un destino: la página de generación lee la clave, la
 *   valida contra la lista cerrada `ORIGENES_GENERACION` y construye ella misma la ruta con una
 *   constante y su propio identificador de expediente. Cualquier otro valor —una URL absoluta, una
 *   protocol-relative, un path cualquiera, `constructor`, `__proto__`, vacío— cae en la bandeja.
 *   Como en la URL nunca viaja una ruta, no hay open redirect posible POR CONSTRUCCIÓN.
 *
 *   Query y no `location.state` porque la query sobrevive a recargar la página y a la salvaguarda
 *   de «atrás», que empuja entradas de historial con estado nulo.
 *
 *   Sigue sin traerse el mapa de orígenes de Resolución, que se apoya en su arquitectura de
 *   `features` y que D-02 prohíbe traer: aquí son dos vueltas fijas, escritas en este archivo.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-09-21
 * Modificado por: Andrés Miño — 2026-10-14 (quick 261014-kn3: la vuelta deja de ser fija. Se añaden
 *   la ruta de entrada con origen y el resolvedor de la vuelta sobre una lista cerrada de orígenes.)
 * Modificado por: Andrés Miño — 2026-10-14 (quick 261014-lhu: se exporta la vuelta a la bandeja para
 *   la ficha de la obligación de hacer; mismos valores)
 */

import { RUTA_OBLIGACION_HACER } from "./rutasObligacionHacer";

/**
 * La ruta HIJA de `/home` de la bandeja del decisor, tal y como la registra `routes.tsx`. Sin la
 * barra inicial: es un hijo del subárbol privado.
 *
 * No se exporta: lo que el resto del módulo necesita es la ruta ABSOLUTA de la vuelta, y tener dos
 * formas exportadas de lo mismo es tener dos sitios donde equivocarse.
 */
const BANDEJA_HIJA = "mis-asignados";

/**
 * El segmento propio de la página de generación, sin el parámetro. Es el único literal nuevo que
 * esta fase escribe, y del que se derivan las dos rutas de abajo.
 */
const SEGMENTO_GENERACION = "document-generate";

/**
 * A DÓNDE SE VUELVE al cerrar la generación: la bandeja del decisor.
 *
 * Es también la raíz de la que cuelga la página, y por eso la ruta absoluta se construye a partir
 * de ella: si algún día la bandeja se mueve, la página la sigue sin que nadie tenga que acordarse.
 */
export const RUTA_VUELTA_GENERACION = `/home/${BANDEJA_HIJA}`;

/**
 * La ruta HIJA de la página de generación, CON su parámetro de expediente. Es el valor que el
 * plan 16 —dueño de `routes.tsx` y de la página— tiene que registrar tal cual.
 *
 * 🔴 ESTE PLAN NO REGISTRA LA RUTA. Declararla aquí un plan antes de que exista la página es
 * deliberado: así el catálogo del `⋮` puede navegar a un literal único desde el primer día, y dos
 * planes de la misma ola no abren `routes.tsx` a la vez.
 */
export const RUTA_GENERAR_DOCUMENTO_HIJA = `${BANDEJA_HIJA}/${SEGMENTO_GENERACION}/:eejeId`;

/**
 * A dónde navegar para generar un documento de UN expediente.
 *
 * @param eejeId Identificador del expediente de ejecución.
 * @returns La ruta absoluta, construida desde la misma raíz que la ruta de vuelta.
 */
export const RUTA_GENERAR_DOCUMENTO = (eejeId: number | string): string =>
  `${RUTA_VUELTA_GENERACION}/${SEGMENTO_GENERACION}/${eejeId}`;

// ── LA VUELTA SEGÚN QUIÉN ABRIÓ LA PÁGINA (quick 261014-kn3) ─────────────────────────────────────

/** El nombre del parámetro de query que trae la CLAVE del origen. Nunca trae una ruta. */
export const PARAMETRO_ORIGEN_GENERACION = "desde";

/**
 * La LISTA CERRADA de orígenes que piden una vuelta distinta de la bandeja. Un origen que no esté
 * aquí no existe: la página vuelve a la bandeja.
 */
export const ORIGENES_GENERACION = ["obligacion-hacer"] as const;

/** Uno de los orígenes admitidos. */
export type OrigenGeneracion = (typeof ORIGENES_GENERACION)[number];

/** A dónde vuelve la página, con qué rótulo lo ofrece y qué dice su miga. */
export type VueltaGeneracion = {
  ruta: string;
  rotulo: string;
  miga: string;
};

/**
 * Type guard sobre la lista cerrada. 🔴 Es un `includes` sobre el array y NO una búsqueda en un
 * objeto: con `clave in objeto` o `objeto[clave]`, valores como `constructor` o `__proto__`
 * encontrarían algo heredado de `Object.prototype` y se colarían.
 */
const esOrigenGeneracion = (valor: string | null): valor is OrigenGeneracion =>
  valor !== null && (ORIGENES_GENERACION as readonly string[]).includes(valor);

/**
 * La vuelta a la bandeja del decisor —ruta, rótulo y miga—. Es la vuelta por defecto del asistente
 * y, desde el quick 261014-lhu, la vuelta del decisor desde la ficha de la obligación de hacer: un
 * solo sitio para los dos textos.
 */
export const VUELTA_BANDEJA_DECISOR: VueltaGeneracion = {
  ruta: RUTA_VUELTA_GENERACION,
  rotulo: "Volver a Mis Expedientes",
  miga: "Mis Expedientes",
};

/**
 * Cómo se construye la vuelta de cada origen admitido. La ruta sale de una CONSTANTE y del
 * identificador del propio expediente; nada sale de la URL.
 */
const VUELTAS_POR_ORIGEN: Record<
  OrigenGeneracion,
  (eejeId: number) => VueltaGeneracion
> = {
  "obligacion-hacer": (eejeId) => ({
    ruta: RUTA_OBLIGACION_HACER(eejeId),
    rotulo: "Volver a la obligación de hacer",
    miga: "Obligación de hacer",
  }),
};

/**
 * A dónde navegar para generar un documento de UN expediente pidiendo volver a `origen`.
 *
 * @param eejeId Identificador del expediente de ejecución.
 * @param origen Uno de los orígenes de la lista cerrada.
 * @returns La ruta absoluta de siempre más el parámetro del origen.
 */
export const RUTA_GENERAR_DOCUMENTO_DESDE = (
  eejeId: number | string,
  origen: OrigenGeneracion,
): string =>
  `${RUTA_GENERAR_DOCUMENTO(eejeId)}?${new URLSearchParams({
    [PARAMETRO_ORIGEN_GENERACION]: origen,
  }).toString()}`;

/**
 * Resuelve la vuelta de la página de generación a partir de su propio expediente y de la query.
 *
 * Solo hay dos resultados posibles: la vuelta del origen admitido —si la clave está en la lista
 * cerrada y el expediente es un entero positivo— o la bandeja. Ningún valor de la URL puede
 * producir una tercera ruta.
 *
 * @param eejeId Identificador del expediente de la página (de su parámetro de ruta).
 * @param search La query de la ubicación actual (`?desde=…`, o vacía).
 * @returns La ruta, el rótulo del botón de vuelta y la miga de la cabecera.
 */
export const resolverVueltaGeneracion = (
  eejeId: number,
  search: string,
): VueltaGeneracion => {
  const origen = new URLSearchParams(search).get(PARAMETRO_ORIGEN_GENERACION);
  if (!esOrigenGeneracion(origen)) return VUELTA_BANDEJA_DECISOR;
  if (!Number.isInteger(eejeId) || eejeId <= 0) return VUELTA_BANDEJA_DECISOR;
  return VUELTAS_POR_ORIGEN[origen](eejeId);
};
