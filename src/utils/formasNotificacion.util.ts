/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/notificacion (frontend)
 * Feature: La regla D-15 de las formas de notificación, espejada en el cliente (quick 261026-ft2)
 * Archivo: formasNotificacion.util.ts
 * Responsabilidad: La regla D-15 del servidor (`guardarFormas`), espejada en el cliente para que el
 *   paso 3 la diga DONDE SE ARREGLA y no al confirmar la emisión: un canal aceptado exige su dato —
 *   el correo, al menos una dirección vigente; el casillero, su número; el físico, la dirección—.
 *   Aceptar NINGUNA forma sigue siendo válido (D-12): eso no se bloquea, solo se avisa.
 *
 *   ⚠️ El servidor sigue siendo la AUTORIDAD: esto es conveniencia de UI. Por eso se copia la regla
 *   tal cual —orden, recorte, caída al valor guardado y frases— y no se endurece nada que el
 *   servidor tolere: un cliente más estricto que el servidor bloquearía sin motivo.
 *
 *   ⚠️ NO se importa `SeleccionFormas` del componente: la entrada es ESTRUCTURAL, y tanto la
 *   selección publicada como el estado crudo del cuerpo encajan sin conversión. Del servicio se
 *   importa sólo el TIPO (`import type`), que se borra al compilar.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-10-26
 */
import type { FormasAceptadas } from "../services/NotificacionEjecucionService";

/** Mismo texto que `guardarFormas` del backend; si cambia allí, cambia aquí. */
export const MOTIVO_CORREO_SIN_VIGENTE =
  "Para notificar por correo hace falta al menos una dirección VIGENTE: agréguela antes de aceptar ese canal.";

/** Mismo texto que `guardarFormas` del backend; si cambia allí, cambia aquí. */
export const MOTIVO_CASILLERO_SIN_NUMERO =
  "Para notificar por casillero judicial hace falta su número: indíquelo antes de aceptar ese canal.";

/** Mismo texto que `guardarFormas` del backend; si cambia allí, cambia aquí. */
export const MOTIVO_FISICO_SIN_DIRECCION =
  "Para aceptar la notificación en el domicilio hace falta la dirección del administrado.";

/** Lo que el decisor tiene marcado y tecleado, SIN recortar (la regla recorta como el servidor). */
export interface EntradaFormas {
  aceptaCorreo: boolean;
  aceptaCasillero: boolean;
  aceptaFisico: boolean;
  casillero?: string;
  direccion?: string;
}

/** Lo que el servidor ya tiene guardado del administrado: el `actual` de `guardarFormas`. */
export type LeidoFormas = Pick<
  FormasAceptadas,
  "correos" | "casillero" | "direccion"
>;

/** Un motivo por canal MARCADO al que le falta su dato. Ausente = ese canal está en regla. */
export interface MotivosFormasIncompletas {
  correo?: string;
  casillero?: string;
  fisico?: string;
}

/**
 * Qué le falta a cada canal marcado, con la regla de `guardarFormas`:
 * - correo: al menos una dirección `vigente` entre las guardadas;
 * - casillero y dirección: el valor efectivo es lo tecleado RECORTADO o, si queda vacío, el guardado
 *   SIN recortar (`entrada.x?.trim() || actual.x`); falta si el efectivo es vacío o ausente.
 *
 * Un canal NO marcado no da motivo nunca, le falte lo que le falte.
 */
export const motivosFormasIncompletas = (
  entrada: EntradaFormas,
  leido: LeidoFormas,
): MotivosFormasIncompletas => {
  const motivos: MotivosFormasIncompletas = {};

  const casillero = entrada.casillero?.trim() || leido.casillero;
  const direccion = entrada.direccion?.trim() || leido.direccion;
  const tieneCorreoVigente = leido.correos.some((c) => c.vigente);

  if (entrada.aceptaCorreo && !tieneCorreoVigente)
    motivos.correo = MOTIVO_CORREO_SIN_VIGENTE;
  if (entrada.aceptaCasillero && !casillero)
    motivos.casillero = MOTIVO_CASILLERO_SIN_NUMERO;
  if (entrada.aceptaFisico && !direccion)
    motivos.fisico = MOTIVO_FISICO_SIN_DIRECCION;

  return motivos;
};

/** El primer motivo en el orden en que los comprueba el servidor: correo, casillero, físico. */
export const primerMotivoFormas = (
  motivos: MotivosFormasIncompletas,
): string | undefined => motivos.correo ?? motivos.casillero ?? motivos.fisico;
