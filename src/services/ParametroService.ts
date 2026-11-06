/**
 * Microservicio: ejecucion
 * Módulo: Parámetros del módulo (DME)
 * Feature: Parámetros administrables sin redespliegue (plazos 03.13 + económicos 03.14)
 * Archivo: ParametroService.ts
 * Responsabilidad: Consumir /parametros del backend. Los tres endpoints son EXCLUSIVOS del
 *   administrador; el actor de cada cambio lo deriva el backend del JWT, nunca viaja en el body.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-08-13
 * Modificado por: Andrés Miño — 2026-11-04 (quick 261030-m29: entran los tres plazos en días HÁBILES
 *   —el término de alegación al informe, que el backend ya servía y la pantalla no conocía, y los
 *   dos de las alertas de la campana: el plazo de la orden de pago y el aviso previo del trabajo
 *   comunitario—; «hábiles» ya descuenta los feriados del calendario del módulo)
 */
import httpClient from "../api/httpClient";

/**
 * Las claves administrables. Espeja el CHECK `chk_parametro_clave` de la tabla y `ClavePlazo` /
 * `ClaveEconomica` del backend (`parametros.store.ts`).
 *
 * Dos familias: los PLAZOS (dos de la Fase 03.13, el término de alegación de la 03.17 y los dos de
 * las alertas de la quick 261030-m29) y los tres ECONÓMICOS del trabajo comunitario (Fase 03.14),
 * con los que se genera el cuadro de horas de las providencias.
 */
export type ClavePlazo =
  | "PLAZO_ACEPTACION_SORTEO"
  | "PLAZO_EXTENSION_TERMINO"
  | "PLAZO_ALEGACION_INFORME"
  // quick 261030-m29: alimentan las alertas de la campana (D-ORDEN y D-TC).
  | "PLAZO_ORDEN_PAGO"
  | "AVISO_PREVIO_TRABAJO_COMUNITARIO";

export type ClaveEconomica =
  "SBU_VIGENTE" | "TOPE_COMPENSACION_SBU" | "HORAS_POR_SBU";

export type ParametroClave = ClavePlazo | ClaveEconomica;

/** Unidad en la que se cuenta un plazo. */
export type UnidadPlazo = "HABILES" | "CALENDARIO";

/** Unidad de un parámetro económico (de valor, no de tiempo). */
export type UnidadEconomica = "USD" | "SBU" | "HORAS";

/** Todas las unidades. Espeja el CHECK `chk_parametro_unidad`. */
export type UnidadParametro = UnidadPlazo | UnidadEconomica;

/**
 * De dónde está saliendo el valor que sirve el sistema AHORA MISMO.
 *
 * 🔴 `env` no es un detalle técnico: significa que la fila NO está en la tabla y que **editar aquí no
 * tendría efecto**. La pantalla tiene que decirlo (mitad (b) de D-08); es la lección del quick
 * `260805-hon`, donde un respaldo silencioso hizo correr el contenedor con valores por defecto.
 */
export type OrigenParametro = "tabla" | "env";

export interface ParametroVigente {
  id: number;
  clave: ParametroClave;
  valor: number;
  unidad: UnidadParametro;
  descripcion?: string;
  updatedAt?: string;
  updatedBy?: number;
  origen: OrigenParametro;
}

/** Una entrada del histórico: quién, cuándo, de qué valor a cuál. Sin motivo (D-07). */
export interface CambioParametro {
  cambiadoAt: string;
  cambiadoBy?: number;
  cambiadoPor?: string;
  valorAnterior: number;
  unidadAnterior: UnidadParametro;
  valorNuevo: number;
  unidadNueva: UnidadParametro;
}

/** Etiquetas de la UI. Un solo sitio para que la pantalla y los modales no se contradigan. */
export const ETIQUETA_PARAMETRO: Record<ParametroClave, string> = {
  PLAZO_ACEPTACION_SORTEO: "Plazo de aceptación del sorteo",
  PLAZO_EXTENSION_TERMINO: "Plazo de extensión de término",
  PLAZO_ALEGACION_INFORME: "Término de alegación al informe de verificación",
  PLAZO_ORDEN_PAGO: "Plazo para registrar la orden de pago",
  AVISO_PREVIO_TRABAJO_COMUNITARIO:
    "Aviso previo del vencimiento del trabajo comunitario",
  SBU_VIGENTE: "Salario Básico Unificado vigente",
  TOPE_COMPENSACION_SBU: "Tope de compensación con trabajo comunitario",
  HORAS_POR_SBU: "Horas de trabajo comunitario por SBU",
};

export const ETIQUETA_UNIDAD: Record<UnidadParametro, string> = {
  // Desde la Fase 03.17 el módulo tiene calendario de feriados y los plazos en HÁBILES se cuentan en
  // TypeScript con él: se saltan fines de semana Y feriados. Antes la etiqueta advertía lo contrario
  // («sin feriados» = no se descuentan), que dejó de ser cierto.
  HABILES: "días hábiles (sin fines de semana ni feriados)",
  CALENDARIO: "días calendario",
  USD: "dólares",
  SBU: "SBU",
  HORAS: "horas",
};

/**
 * Qué unidades admite cada clave. Espeja `UNIDADES_POR_CLAVE` del backend y el CHECK
 * `chk_parametro_unidad_por_clave` de la tabla: un plazo no se mide en SBU ni el SBU en días
 * hábiles. Los económicos tienen UNA sola, así que la pantalla no ofrece un selector de una opción.
 */
export const UNIDADES_POR_CLAVE: Record<
  ParametroClave,
  readonly UnidadParametro[]
> = {
  // 🔴 QUIÉN ADMITE «HÁBILES» Y POR QUÉ (reescrito en la quick 261030-m29; el comentario anterior
  // decía que ninguna clave la admitía, y eso dejó de ser cierto en la 03.17).
  // · HÁBILES, y SOLO hábiles, los tres que se cuentan en TypeScript con el calendario de feriados:
  //   el término de alegación al informe (COA art. 158: un término de defensa no se cuenta de otra
  //   forma) y los dos de las alertas de la campana —el plazo para registrar la orden de pago y la
  //   anticipación del aviso del trabajo comunitario—.
  // · CALENDARIO, los dos de la 03.13: son invenciones operativas del módulo y su vencimiento se
  //   deriva en SQL con días corridos; ofrecerles «hábiles» sería una etiqueta que nadie honra.
  // Espejo del backend y del CHECK `chk_parametro_unidad_por_clave`: un plazo de una sola unidad no
  // ofrece selector.
  PLAZO_ACEPTACION_SORTEO: ["CALENDARIO"],
  PLAZO_EXTENSION_TERMINO: ["CALENDARIO"],
  PLAZO_ALEGACION_INFORME: ["HABILES"],
  PLAZO_ORDEN_PAGO: ["HABILES"],
  AVISO_PREVIO_TRABAJO_COMUNITARIO: ["HABILES"],
  SBU_VIGENTE: ["USD"],
  TOPE_COMPENSACION_SBU: ["SBU"],
  HORAS_POR_SBU: ["HORAS"],
};

export const ParametroService = {
  /** Todos los parámetros vigentes con su origen. */
  async listar(): Promise<ParametroVigente[]> {
    const { data } = await httpClient.get<ParametroVigente[]>("/parametros");
    return data;
  },

  /** Histórico de un parámetro, del cambio más reciente al más antiguo. */
  async historico(clave: ParametroClave): Promise<CambioParametro[]> {
    const { data } = await httpClient.get<CambioParametro[]>(
      `/parametros/${clave}/historico`,
    );
    return data;
  },

  /**
   * Guarda valor y unidad. El backend deriva el actor del JWT.
   *
   * ⚠️ Rige SOLO para expedientes que arranquen su reloj a partir de ahora; los que están en curso
   * conservan el suyo. Es lo que el modal de confirmación tiene que decir con todas las letras.
   */
  async actualizar(
    clave: ParametroClave,
    valor: number,
    unidad: UnidadParametro,
  ): Promise<ParametroVigente> {
    const { data } = await httpClient.patch<ParametroVigente>(
      `/parametros/${clave}`,
      { valor, unidad },
    );
    return data;
  },
};

export default ParametroService;
