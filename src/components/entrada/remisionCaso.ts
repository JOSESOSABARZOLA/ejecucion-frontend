/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/entrada (frontend)
 * Feature: «Remitir al secretario» por caso en la fila del director (quick 261029-kl0)
 * Archivo: remisionCaso.ts
 * Responsabilidad: Decidir, con los campos que manda el servidor, cuándo la fila de UN caso de la
 *   Bandeja de Entrada ofrece al director «Remitir al secretario» (PATCH /epas/:id/approve-director).
 *   Guarda también los textos de los avisos de la ficha cuando una observación retira la remisión.
 *   Módulo puro, sin React.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-10-29
 *
 * ── POR QUÉ HACE FALTA (2026-10-29, EPAS 264 / lote 15 del 127) ────────────────────────────────
 * Una observación viva sobre un expediente remitido y sin sortear le retira la remisión y lo devuelve
 * al director «Por devolver». Si el director rechaza todas las observaciones, el expediente queda
 * RECIBIDO, sin marca y sin remitir, dentro de un lote que ya está remitido: la remisión por lote ya no
 * está en pantalla, así que se remite de uno en uno desde su fila.
 *
 * ── EL NAVEGADOR NO DECIDE ──────────────────────────────────────────────────────────────────────
 * Es conveniencia: el servidor (`approveByDirector`) exige rol director, RECIBIDO, sin remitir y sin
 * retención en el WHERE. Aquí solo se evita ofrecer un botón que el servidor negaría.
 */
import type { EnvioLoteCaso } from "../../services/EntradaLotesService";
import { isInboxActionVisible } from "../../config/inboxActionStatusRules";

/** Lo que la fila sabe para decidir si ofrece «Remitir al secretario». */
export interface RemisionCasoContexto {
  /** Rol del usuario (claim del JWT). */
  rolName: string;
  /** ¿El lote sigue EN_REVISION? Entonces la remisión es la del lote entero. */
  loteEnRevision: boolean;
  /** ¿El lote sigue sin ir a sorteo (`envlAmasId == null`)? */
  loteSinSortear: boolean;
  /** El caso de la fila. */
  caso: Pick<
    EnvioLoteCaso,
    "eejeId" | "eejeStatus" | "remitidoAlSecretario" | "porDevolver" | "reingreso"
  >;
}

/**
 * ¿Ofrece la fila del director «Remitir al secretario» para ESTE caso?
 *
 * En un lote EN_REVISION la remisión es del lote entero (el botón del lote). Ya remitido el lote, lo
 * que se quedó con el director —retenido, devuelto a él por una observación cuyas observaciones
 * rechazó, o aterrizado tarde— se remite de uno en uno. Hace falta, todo a la vez:
 *   - lote no EN_REVISION y sin sortear;
 *   - caso aterrizado (con `eejeId`);
 *   - la regla `aprobarEpas` (director sobre RECIBIDO, en `inboxActionStatusRules`: no se repite aquí);
 *   - `remitidoAlSecretario === false` (estricto: un servidor que no lo mande no ofrece el botón);
 *   - sin `porDevolver` y sin `reingreso.porVerificar > 0` (el servidor rechazaría lo retenido).
 *
 * @param ctx rol, estado del lote y el caso.
 * @returns true si la fila debe pintar el botón.
 */
export const puedeRemitirCasoSuelto = ({
  rolName,
  loteEnRevision,
  loteSinSortear,
  caso,
}: RemisionCasoContexto): boolean =>
  !loteEnRevision &&
  loteSinSortear &&
  caso.eejeId != null &&
  isInboxActionVisible("aprobarEpas", caso.eejeStatus, rolName) &&
  caso.remitidoAlSecretario === false &&
  caso.porDevolver !== true &&
  (caso.reingreso?.porVerificar ?? 0) === 0;

// ── Los avisos de la ficha (ModalExpedienteLote) cuando la observación retira la remisión ─────────

/** Frase común: cuántas observaciones se guardaron. */
const seGuardaron = (n: number): string =>
  `Se ${n === 1 ? "guardó 1 observación" : `guardaron ${n} observaciones`}.`;

/**
 * La observación retiró la remisión al secretario. Va al SECRETARIO: el expediente sale de su
 * bandeja y la ficha se cierra.
 */
export const avisoRemisionRetiradaSecretario = (n: number): string =>
  `${seGuardaron(n)} El expediente vuelve al director para que las revise: sale de su bandeja y no irá a sorteo.`;

/** Lo mismo, dicho al DIRECTOR: el expediente sigue en su bandeja. */
export const avisoRemisionRetiradaDirector = (n: number): string =>
  `${seGuardaron(n)} El expediente deja de estar remitido al secretario y queda «Por devolver» en su bandeja.`;

/** Rechazada la última observación viva de un RECIBIDO sin remitir: el director puede remitirlo. */
export const AVISO_PUEDE_REMITIRSE =
  "Ya no queda ninguna observación viva: el expediente puede remitirse de nuevo al secretario desde su fila.";
