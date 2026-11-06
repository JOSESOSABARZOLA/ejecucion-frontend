/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/pago (frontend)
 * Feature: Verificación de pago (Fase 03.14.1, act. 16.2 · Fase 03.15, D-1)
 * Archivo: PagoService.ts
 * Responsabilidad: Consumir `/pago`. Registrar el pago exige comprobante — y **ya no mueve el
 *   expediente**.
 *
 *   ── POR QUÉ CAMBIÓ ESTE TEXTO (Fase 03.15, D-1) ─────────────────────────────────────────────
 *   Decía que las dos cosas movían el expediente, y era verdad hasta esta fase. Ya no: **quien
 *   transiciona el EPAS es siempre la providencia**. Registrar el pago ACREDITA un hecho; disponer
 *   el archivo es un SEGUNDO ACTO —la providencia de archivo por pago—, que además cita este
 *   comprobante. Dejar el texto viejo sería la pantalla prometiendo un cierre que nadie va a hacer.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-09-14
 */
import httpClient from "../api/httpClient";
import { SUBIDA_TIMEOUT_MS } from "./TrabajoComunitarioService";

/**
 * Lo que el expediente sabe de su pago.
 *
 * ── AQUÍ HABÍA UN RELOJ, Y SE FUE (2026-08-19) ─────────────────────────────────────────────────
 * Traía plazo, vencimiento, si estaba vencido y con qué unidad se contó. Todo eso descansaba en una
 * premisa que la DME corrigió: **el pago no tiene tiempo límite**. Un badge de «vencido» sobre un
 * plazo que no existe es peor que no tener plazo — hace que un funcionario apremie a alguien que no
 * está en mora.
 */
export interface EstadoPago {
  eejeId: number;
  eejeStatus: string;
  multaImpuesta?: number;
  pagoAt?: string;
  transaccion?: string;
  pagoDocId?: number;
}

export interface ResultadoPago {
  eejeId: number;
  eejeStatus: string;
  pagoDocId?: number;
}

export const PagoService = {
  /** Reloj y estado del pago. Arranca el plazo si el EPAS ya está en verificación y no lo tenía. */
  async estado(eejeId: number): Promise<EstadoPago> {
    const { data } = await httpClient.get<EstadoPago>(`/pago/${eejeId}`);
    return data;
  },

  /**
   * Adjunta el comprobante y registra el dato del pago. **El comprobante sigue siendo obligatorio.**
   *
   * 🔴 **NO archiva ni mueve el expediente** (Fase 03.15, D-1). El EPAS se queda donde estaba —en
   * verificación de pago—, que es precisamente el estado desde el que la providencia de archivo por
   * pago sí se puede emitir. Antes lo dejaba en `CUMPLIDO`, y desde ahí la providencia que debía
   * cerrarlo era rechazada: los dos caminos eran excluyentes y el expediente no se podía cerrar por
   * ninguno.
   *
   * ⚠️ Solo se puede registrar UNA VEZ: con el pago ya acreditado, el servidor rechaza el segundo
   * intento nombrando la fecha del primero.
   *
   * El paso siguiente —y el que de verdad cierra— es emitir «Archivo por pago o convenio de pago».
   */
  async registrar(
    eejeId: number,
    datos: { pagoAt: string; transaccion: string },
    comprobante: File,
  ): Promise<ResultadoPago> {
    const formData = new FormData();
    formData.append("file", comprobante);
    formData.append("pagoAt", datos.pagoAt);
    formData.append("transaccion", datos.transaccion);

    const { data } = await httpClient.post<ResultadoPago>(
      `/pago/${eejeId}`,
      formData,
      {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: SUBIDA_TIMEOUT_MS,
      },
    );
    return data;
  },

  // «declararImpago» se retiró (2026-08-19): la coactiva la dispone la providencia «Archivo por
  // envío a coactiva», que además ordena la remisión del expediente y el oficio a la Zonal. Un
  // endpoint que movía el estado sin documento no tenía sitio en un módulo donde todo lo demás
  // exige su papel.
};

export default PagoService;
