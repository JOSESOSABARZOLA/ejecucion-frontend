/**
 * Microservicio: ejecucion
 * Módulo: Impugnación (rama act. 7 de PRO-GEJ-001)
 * Archivo: ImpugnacionService.ts
 * Responsabilidad: Cliente HTTP de la rama de impugnación del decisor: iniciar la gestión, iniciar
 *   ejecución (sin impugnación), adjuntar la Resolución de la Procuraduría (multipart) y resolver el
 *   recurso de apelación. Espeja los endpoints POST /epas/:eejeId/... del ImpugnacionController.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-07-30
 * Modificado por: Andrés Miño — 2026-10-12 (destino del recurso aceptado: Instrucción / Resolución / Archivo)
 * Modificado por: Andrés Miño — 2026-10-28 (DMI pasa a llamarse DMIT)
 * Modificado por: Andrés Miño — 2026-10-29 (quick 261028-mtg: la impugnación entra desde cualquier
 *   estado activo; `leerEstado` lee GET /epas/:eejeId/impugnacion y `registrarImpugnacion` devuelve
 *   a qué estado vuelve el expediente si el recurso no se acepta)
 */
import httpClient from "../api/httpClient";

export interface ResolverRecursoResult {
  /**
   * El estado en que quedó el EPAS. Al NO aceptar es el estado REANUDADO (quick 261028-mtg): el que
   * tenía antes de la impugnación, calculado por el servidor desde la suspensión persistida.
   */
  eejeStatus: string;
  /** Solo al aceptar (2026-10-12): el destino que quedó registrado. */
  destino?: RecursoDestino;
}

/**
 * Calificación del recurso de apelación NO aceptado. Espejo palabra por palabra del enum
 * RecursoDesenlace del backend y de su CHECK en la BD.
 *
 * Es dato de REPORTERÍA: los tres desenlaces reanudan el EPAS en el mismo estado (el previo a la
 * impugnación), así que la UI no debe ramificar por su valor —solo recogerlo—.
 */
export const RECURSO_DESENLACES = [
  { valor: "RECHAZADO", etiqueta: "Rechazado" },
  { valor: "INADMITIDO", etiqueta: "Inadmitido" },
  { valor: "DESISTIDO", etiqueta: "Desistido" },
] as const;

export type RecursoDesenlace = (typeof RECURSO_DESENLACES)[number]["valor"];

/**
 * A dónde se remite el expediente al ACEPTAR el recurso (act. 7.1.1; decisión del usuario del
 * 2026-10-12). Espejo palabra por palabra del enum RecursoDestino del backend y de su CHECK
 * `chk_eeje_recurso_destino` en la BD, en el orden que pidió el usuario.
 *
 * 🔴 A diferencia del desenlace, ESTO SÍ GOBIERNA: el valor es la pestaña de la Bandeja de Salida por
 * la que sale el expediente (SG | DMR | DMIT). SG significa ARCHIVO en Secretaría General.
 */
export const RECURSO_DESTINOS = [
  { valor: "DMIT", etiqueta: "Instrucción (DMIT)" },
  { valor: "DMR", etiqueta: "Resolución (DMR)" },
  { valor: "SG", etiqueta: "Archivo (Secretaría General)" },
] as const;

export type RecursoDestino = (typeof RECURSO_DESTINOS)[number]["valor"];

/** De quién viene la impugnación. Espejo de `OrigenImpugnacion` del backend. */
export type OrigenImpugnacion = "DECISOR" | "INTEGRACION";

/**
 * Lo que responde GET /epas/:eejeId/impugnacion. Espejo de `VistaImpugnacion` del backend
 * (`impugnacion/interfaces/suspension-impugnacion.interface.ts`, quick 261028-mtg plan 01).
 *
 * 🔴 TODO LO QUE AQUÍ VIENE LO DECIDE EL SERVIDOR: si se puede registrar (`entrada.permitida` y su
 * `motivo`), a qué estado vuelve el expediente si el recurso no se acepta (`estadoAlReanudar`) y si la
 * resolución adjunta es la de ESTA impugnación. La pantalla lo pinta y no deduce ningún estado.
 * Las fechas viajan como cadena ISO.
 */
export interface VistaImpugnacion {
  eejeStatus: string;
  entrada: {
    permitida: boolean;
    motivo: string | null;
    estadoAlReanudar: string | null;
  };
  suspension: {
    esusId: number;
    desde: string;
    estadoPrevio: string;
    estadoAlReanudar: string;
    origen: OrigenImpugnacion;
  } | null;
  resolucionAdjunta: boolean;
  historial: Array<{
    desde: string;
    hasta: string | null;
    estadoPrevio: string;
    estadoSalida: string | null;
    origen: OrigenImpugnacion;
  }>;
}

/** Lo que responde POST /epas/:eejeId/impugnacion/iniciar (quick 261028-mtg). */
export interface ResultadoRegistroImpugnacion {
  eejeStatus: "EN_IMPUGNACION";
  estadoPrevio: string;
  estadoAlReanudar: string;
}

export const ImpugnacionService = {
  /** Lee el estado de la rama: si se puede registrar, la suspensión abierta y el historial. */
  async leerEstado(eejeId: number): Promise<VistaImpugnacion> {
    const { data } = await httpClient.get<VistaImpugnacion>(
      `/epas/${eejeId}/impugnacion`,
    );
    return data;
  },

  /**
   * Registra la impugnación desde cualquier estado activo que el servidor admita (ASIGNADO_DECISOR
   * con el caso aceptado, EN_VERIFICACION_PAGO, EN_TRABAJO_COMUNITARIO, PENDIENTE_COACTIVA) →
   * EN_IMPUGNACION. Todo lo que estaba en curso queda suspendido hasta que se resuelva el recurso.
   */
  async registrarImpugnacion(
    eejeId: number,
  ): Promise<ResultadoRegistroImpugnacion> {
    const { data } = await httpClient.post<ResultadoRegistroImpugnacion>(
      `/epas/${eejeId}/impugnacion/iniciar`,
    );
    return data;
  },

  /** Rama sin impugnación: inicia acciones de ejecución → EN_VERIFICACION_PAGO. */
  async iniciarEjecucion(eejeId: number): Promise<void> {
    await httpClient.post(`/epas/${eejeId}/ejecucion/iniciar`);
  },

  /** Adjunta la Resolución de la Procuraduría (PDF). Requiere el EPAS EN_IMPUGNACION. */
  async subirResolucion(
    eejeId: number,
    file: File,
  ): Promise<{ docId: number; docUrl: string }> {
    const formData = new FormData();
    formData.append("file", file);
    const { data } = await httpClient.post<{ docId: number; docUrl: string }>(
      `/epas/${eejeId}/impugnacion/resolucion`,
      formData,
      { headers: { "Content-Type": "multipart/form-data" } },
    );
    return data;
  },

  /**
   * Resuelve el recurso: acepta=true → RECURSO_ACEPTADO con el `destino` elegido, y el expediente
   * sale por la Bandeja de Salida (⟳ 2026-10-12: antes archivaba en el acto); false → el expediente
   * se REANUDA en el estado que tenía antes de la impugnación (⟳ quick 261028-mtg: antes siempre
   * EN_VERIFICACION_PAGO), y ese estado es el `eejeStatus` de la respuesta. Ninguno de los tres
   * desenlaces cambia el destino: el estado no depende de la calificación.
   *
   * `destino` y `desenlace` son espejo: cada uno es obligatorio en su rama y está PROHIBIDO en la otra,
   * y así lo valida el backend (400 en cualquier incumplimiento). Por eso el cuerpo lleva SOLO la
   * clave que corresponde —nunca las dos—, en lugar de mandar la otra como `undefined`.
   */
  async resolverRecurso(
    eejeId: number,
    aceptaRecurso: boolean,
    desenlace?: RecursoDesenlace,
    destino?: RecursoDestino,
  ): Promise<ResolverRecursoResult> {
    const { data } = await httpClient.post<ResolverRecursoResult>(
      `/epas/${eejeId}/impugnacion/resolver`,
      aceptaRecurso ? { aceptaRecurso, destino } : { aceptaRecurso, desenlace },
    );
    return data;
  },
};
