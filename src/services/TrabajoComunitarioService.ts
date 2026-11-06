/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/trabajo-comunitario (frontend)
 * Feature: Trabajo comunitario (Fase 03.14.1 act. 16.1/17 · Fase 03.14.2 act. 16)
 * Archivo: TrabajoComunitarioService.ts
 * Responsabilidad: Consumir `/trabajo-comunitario`. El backend CALCULA el desenlace con las horas
 *   del informe, pero **ya no lo aplica**.
 *
 *   ── POR QUÉ CAMBIÓ ESTE TEXTO (Fase 03.15, D-1) ─────────────────────────────────────────────
 *   Decía que la pantalla adelantaba el efecto «antes de ejecutarlo». Ya no hay efecto que
 *   ejecutar: registrar el cumplimiento ACREDITA las horas y nada más. El desenlace lo DISPONE la
 *   providencia que corresponda —archivo por trabajo comunitario, archivo con el remanente pagado,
 *   o envío a coactiva—, que es un segundo acto. El cálculo se conserva entero y cambia de oficio:
 *   de anuncio de lo que va a pasar, a **recomendación de cuál de las tres emitir**.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-09-14
 * Modificado por: Andrés Miño — 2026-10-16 (Fase 03.23, Plan 13: `aptitudOrigen` admite
 *   `"INFRACCIONES"`, el único origen de las autorizaciones nuevas.)
 * Modificado por: Andrés Miño — 2026-10-29 (quick 261028-mtg: el estado trae las suspensiones por
 *   impugnación y cuánto corrieron el plazo: `suspensionesImpugnacion`, `diasSuspendidos`,
 *   `plazoSuspendidoDesde` y `diasRestantesAlSuspender`)
 * Modificado por: Andrés Miño — 2026-11-05 (quick 261105-cc7: el estado trae `sbuParametro`, el SBU
 *   de Parámetros solo como referencia para el ejecutor, que escribe el del caso)
 * Modificado por: Andrés Miño — 2026-11-05 (quick 261105-ma6: el estado trae `horasResolucion`, las
 *   horas de trabajo comunitario que fijó la resolución de origen, aparte de las autorizadas)
 */
import httpClient from "../api/httpClient";

/**
 * Timeout POR PETICIÓN para las subidas. El `timeout: 5000` GLOBAL del httpClient se queda intacto:
 * subir un informe escaneado por una red municipal tarda más que cualquier lectura, y tocar el
 * global afectaría a toda la aplicación (misma precaución que el combo de firma de la 03.12).
 */
export const SUBIDA_TIMEOUT_MS = 45000;

export type DesenlaceTrabajoComunitario =
  "TOTAL" | "PARCIAL" | "INCUMPLIMIENTO";

/** Cifras CONGELADAS del trabajo comunitario del expediente. */
export interface EstadoTrabajoComunitario {
  eejeId: number;
  eejeStatus: string;
  multaImpuesta?: number;
  horasAutorizadas?: number;
  /**
   * Horas de TC que fijó la RESOLUCIÓN de origen (quick 261105-ma6). Solo informativas: el
   * compositor las propone como las del acto administrativo. NO son las autorizadas.
   */
  horasResolucion?: number;
  valorCompensado?: number;
  remanente?: number;
  plazoMeses?: number;
  autorizadoAt?: string;
  horasCumplidas?: number;
  informeDocId?: number;
  // ---- El PAGO del remanente (Fase 03.15, D-7 y D-7.1) ----
  /**
   * 🔴 `remanente` es el IMPORTE; estos tres son el PAGO. Hasta la Fase 03.15 el expediente solo
   * sabía cuánto quedaba a deber y no tenía dónde decir que se había saldado.
   *
   * Para el modal de emisión son el «ya consta» del comprobante del remanente: con
   * `remanentePagoAt` sellado, la providencia del tipo 30 lo CITA en vez de volver a pedirlo.
   */
  remanentePagoAt?: string;
  remanenteTransaccion?: string;
  remanenteDocId?: number;
  // ---- Actividad 16: informar, y la respuesta del administrado (Fase 03.14.2) ----
  informadoAt?: string;
  informadoDocId?: number;
  /**
   * `null` = todavía NO respondió · `false` = respondió que NO se acoge · `true` = se acogió.
   * Los tres son distintos y la pantalla los pinta distinto: colapsar null con false diría que el
   * administrado rechazó algo sobre lo que no se ha pronunciado.
   */
  acogido: boolean | null;
  acogidoAt?: string;
  peticionDocId?: number;
  /**
   * De dónde salió la aptitud para trabajo comunitario cuando se autorizó. Desde la Fase 03.23 el
   * único origen nuevo es `"INFRACCIONES"`: la decide la infracción en CORE (D-06/D-13).
   * `"MATERIA"` y `"DECLARADA"` solo aparecen en expedientes autorizados ANTES de esa fase, y se
   * conservan para poder leerlos.
   */
  aptitudOrigen?: "MATERIA" | "DECLARADA" | "INFRACCIONES";
  cifrasOrigen?: "ACTO_ADMINISTRATIVO" | "CALCULADO";
  // ---- El plazo y su prórroga (Fase 03.14.4) ----
  /** Vencimiento del plazo para cumplir las horas. Lo DERIVA el servidor; aquí no se calcula. */
  venceAt?: string;
  vencido?: boolean;
  prorrogaSolicitadaAt?: string;
  /** `undefined` = sin resolver · `true` = concedida · `false` = negada. Los tres distintos. */
  prorrogaConcedida?: boolean;
  prorrogaResueltaAt?: string;
  prorrogaMeses?: number;
  prorrogaMotivo?: string;
  /** Solo antes de vencer y una vez. */
  prorrogaDisponible: boolean;
  /**
   * Lo que se concedería si el ejecutor dijera que sí. **Lo calcula el servidor**: derivar aquí el
   * 50 % dejaría dos versiones de la misma regla, y la que ve el decisor antes de firmar podría no
   * ser la que el sistema aplica al firmar.
   */
  prorrogaMesesPrevistos?: number;
  prorrogaVenceAtPrevisto?: string;
  // ---- La suspensión por impugnación (quick 261028-mtg, plan 02) ----
  /**
   * Las suspensiones del expediente por impugnación, de la más antigua a la más reciente. `hasta`
   * nulo = sigue abierta. Opcional: el servidor anterior no la manda, y su ausencia es «ninguna».
   */
  suspensionesImpugnacion?: Array<{ desde: string; hasta: string | null }>;
  /**
   * Días CALENDARIO que las suspensiones cerradas corrieron el vencimiento. `venceAt` ya los incluye;
   * la pantalla lo DICE, no lo suma. Solo viene cuando hay plazo corriendo.
   */
  diasSuspendidos?: number;
  /**
   * Con la suspensión ABIERTA: desde cuándo está detenido el plazo. Entonces `vencido` es false, no
   * hay prórroga disponible y `venceAt` es provisional.
   */
  plazoSuspendidoDesde?: string;
  /** Con la suspensión abierta: los días calendario que le quedaban al plazo al suspenderse. */
  diasRestantesAlSuspender?: number;
  /**
   * El SBU de Parámetros (quick 261105-cc7). SOLO referencia para el ejecutor: lo devuelve el
   * servidor, se enseña junto al campo SBU y nunca lo rellena ni entra en un cálculo.
   */
  sbuParametro?: number;
}

/** Resultado de registrar la respuesta del administrado (act. 16). */
export interface AcogimientoRegistrado {
  eejeId: number;
  seAcoge: boolean;
  acogidoAt: string;
  peticionDocId?: number;
  eejeStatus: string;
}

export interface CierreTrabajoComunitario {
  horasReconocidas: number;
  valorCompensadoReal: number;
  valorRemanente: number;
  desenlace: DesenlaceTrabajoComunitario;
  eejeStatus: string;
  informeDocId: number;
}

/**
 * Qué PROVIDENCIA corresponde a cada desenlace del cálculo (Fase 03.15, D-1).
 *
 * 🔴 Renombrada a conciencia desde `ETIQUETA_DESENLACE`, que decía «el expediente pasará a
 * CUMPLIDO». Eso dejó de ser verdad: registrar el cumplimiento no mueve nada. El nombre nuevo
 * obliga a mirar cada sitio donde se usaba, que es justo lo que hacía falta — una constante con el
 * mismo nombre y otro significado habría dejado el texto viejo en pantalla sin que nada lo avisara.
 *
 * Es una RECOMENDACIÓN, no un hecho consumado: es lo único que le dice al decisor cuál de las tres
 * providencias emitir, y la última palabra sobre el acto sigue siendo suya.
 */
export const PROVIDENCIA_DEL_DESENLACE: Record<
  DesenlaceTrabajoComunitario,
  string
> = {
  TOTAL:
    "corresponde emitir la providencia de «Archivo por trabajo comunitario»",
  PARCIAL:
    "corresponde emitir «Archivo por trabajo comunitario — pago del remanente» si el remanente se salda, " +
    "o «Archivo por trabajo comunitario — envío a coactiva» si no",
  INCUMPLIMIENTO:
    "corresponde emitir «Archivo por trabajo comunitario — envío a coactiva»",
};

/**
 * Adelanta el desenlace con la MISMA regla del backend. Es ADVISORY —el valor que vale es el que
 * devuelve el servidor— y desde la Fase 03.15 sirve para decidir **qué providencia toca emitir**,
 * no para anunciar un cambio de estado que ya no ocurre aquí.
 */
export function preverDesenlace(
  horasCumplidas: number,
  horasAutorizadas: number,
): DesenlaceTrabajoComunitario {
  const reconocidas = Math.min(
    Math.max(horasCumplidas, 0),
    Math.max(horasAutorizadas, 0),
  );
  if (reconocidas === 0) return "INCUMPLIMIENTO";
  return reconocidas === horasAutorizadas ? "TOTAL" : "PARCIAL";
}

/** Adelanta el remanente proporcional. También ADVISORY (ver `preverDesenlace`). */
export function preverRemanente(
  horasCumplidas: number,
  estado: EstadoTrabajoComunitario,
): number | undefined {
  const { horasAutorizadas, valorCompensado, multaImpuesta } = estado;
  if (!horasAutorizadas || valorCompensado == null || multaImpuesta == null) {
    return undefined;
  }
  const reconocidas = Math.min(Math.max(horasCumplidas, 0), horasAutorizadas);
  const compensado = (valorCompensado * reconocidas) / horasAutorizadas;
  return Math.round((multaImpuesta - compensado) * 100) / 100;
}

export const TrabajoComunitarioService = {
  /** Cifras del TC del expediente (las pinta la bandeja). */
  async estado(eejeId: number): Promise<EstadoTrabajoComunitario> {
    const { data } = await httpClient.get<EstadoTrabajoComunitario>(
      `/trabajo-comunitario/${eejeId}`,
    );
    return data;
  },

  /**
   * Act. 16 — registra la respuesta del administrado.
   *
   * ⚠️ NO existe aquí un método `autorizar`, y su ausencia es deliberada (Fase 03.14.2): congelar
   * las cifras es parte de EMITIR la providencia que autoriza. Cuando eran dos llamadas, la pantalla
   * solo hacía la segunda y el expediente entraba en trabajo comunitario con las cifras vacías,
   * donde ni podía pagar ni cerrar horas. Si alguien lo echa en falta, es que está a punto de
   * reabrir esa vía.
   */
  async registrarAcogimiento(
    eejeId: number,
    datos: { seAcoge: boolean; acogidoAt?: string },
    escrito?: File,
  ): Promise<AcogimientoRegistrado> {
    const formData = new FormData();
    if (escrito) formData.append("file", escrito);
    formData.append("seAcoge", String(datos.seAcoge));
    if (datos.acogidoAt) formData.append("acogidoAt", datos.acogidoAt);

    const { data } = await httpClient.post<AcogimientoRegistrado>(
      `/trabajo-comunitario/${eejeId}/acogimiento`,
      formData,
      {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: SUBIDA_TIMEOUT_MS,
      },
    );
    return data;
  },

  /**
   * Fase 03.14.4 — el administrado solicita prórroga, con su escrito.
   *
   * Las reglas —solo antes de vencer, una sola vez— las hace cumplir el backend. Aquí no se
   * replican: su mensaje de error es el que explica al funcionario qué pasó, con la fecha incluida.
   */
  async solicitarProrroga(
    eejeId: number,
    escrito: File,
  ): Promise<EstadoTrabajoComunitario> {
    const formData = new FormData();
    formData.append("file", escrito);

    const { data } = await httpClient.post<EstadoTrabajoComunitario>(
      `/trabajo-comunitario/${eejeId}/prorroga/solicitud`,
      formData,
      {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: SUBIDA_TIMEOUT_MS,
      },
    );
    return data;
  },

  /**
   * Act. 17 — registra el informe del delegado y **acredita** las horas.
   *
   * 🔴 **NO mueve el expediente** (Fase 03.15, D-1). Antes lo dejaba en `CUMPLIDO` o en
   * `PENDIENTE_COACTIVA` según las horas, y la providencia que debía constatarlo llegaba tarde a un
   * expediente ya movido. Ahora el EPAS se queda en trabajo comunitario, que es el estado desde el
   * que las tres providencias de cierre sí se pueden emitir.
   *
   * Sigue devolviendo el `desenlace` calculado, que es lo que dice cuál de las tres corresponde.
   *
   * ⚠️ Se puede volver a registrar: el servidor no lo impide, y por eso es también el camino para
   * corregir unas horas mal tecleadas.
   */
  async registrarCumplimiento(
    eejeId: number,
    horasCumplidas: number,
    informe: File,
  ): Promise<CierreTrabajoComunitario> {
    const formData = new FormData();
    formData.append("file", informe);
    formData.append("horasCumplidas", String(horasCumplidas));

    const { data } = await httpClient.post<CierreTrabajoComunitario>(
      `/trabajo-comunitario/${eejeId}/cumplimiento`,
      formData,
      {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: SUBIDA_TIMEOUT_MS,
      },
    );
    return data;
  },
};

export default TrabajoComunitarioService;
