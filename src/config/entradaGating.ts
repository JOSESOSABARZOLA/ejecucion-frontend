/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/entrada-lotes (frontend)
 * Feature: Resolver de gating ROLE-ONLY de la Bandeja de Entrada (opción A del RESEARCH, D-06) — Fase 3.8
 * Archivo: entradaGating.ts
 * Responsabilidad: Decir, dado un ROL, qué acciones de la ENTRADA lote-céntrica son visibles. Es
 *   role-only (SIN status): las acciones de entrada no se gatean por `envl_status` (texto libre,
 *   verdicto OQ-1) sino solo por el rol operativo. Reparto (RECE-08): el SECRETARIO ve
 *   `aprobarEnviarSorteo` (aprueba y remite al sorteo); el DIRECTOR ve `approveDirectorEntrada`
 *   (sella el reenvío director→secretario); los dos ven `devolverDmr`. El gating de UI es CONVENIENCIA,
 *   NO seguridad: la autorización real vive en el backend (@Roles + gate fino) — T-03.8-08. Se mantiene
 *   APARTE del enum EPAS InboxActionStatus (prohibido contaminarlo con los envl_status). La comparación
 *   de rol es case-insensitive (se normaliza a minúsculas, igual que isInboxActionVisible).
 * Desarrollador: Andrés Miño
 * Fecha: 2026-07-23
 * Modificado por: Andrés Miño — 2026-10-20 (Fase 03.24, Plan 07, D-09): sale la acción de
 *   sincronización manual del secretario. La sincronización con Resolución es automática y ya no
 *   hay botón que gatear; su nombre cae en el default deny como cualquier acción desconocida.
 */

/** Rol operativo con acciones en la Bandeja de Entrada (misma cadena EXACTA del backend, minúsculas). */
export type EntradaRole =
  | "secretario abogado"
  | "director"
  | "funcionario decisor";

/** Las acciones de la ENTRADA lote-céntrica gateadas por rol (role-only, sin status). */
export type EntradaActionName =
  | "aprobarEnviarSorteo"
  | "approveDirectorEntrada"
  | "devolverDmr";

/**
 * Mapa role-only de las acciones de entrada → roles permitidos. SIN `status`: el reparto es puramente
 * por rol (RECE-08). Si una acción no está en el mapa, NO es visible para ningún rol (default deny) —
 * a diferencia de INBOX_ACTION_STATUS_RULES, aquí el universo de acciones es CERRADO y conocido.
 */
export const ENTRADA_ACTION_ROLES: Record<EntradaActionName, EntradaRole[]> = {
  // Aprueba y remite el lote al sorteo (puebla envl_amas_id): acto del SECRETARIO.
  aprobarEnviarSorteo: ["secretario abogado"],
  // Sella el reenvío director→secretario (patrón RECE-08): acto del DIRECTOR.
  approveDirectorEntrada: ["director"],
  // Devuelve el lote a la DMR (contraparte de aprobar+enviar / remitir): COMPARTIDA por ambos roles.
  devolverDmr: ["director", "secretario abogado"],
};

/**
 * ¿Es visible la acción de entrada `action` para el rol `rolName`? Role-only: normaliza el rol a
 * minúsculas (case-insensitive, tolera espacios) y devuelve si está en la lista permitida. Una acción
 * desconocida devuelve false (default deny). NO consulta `envl_status` ni el enum EPAS.
 *
 * @param action acción de entrada (aprobarEnviarSorteo | approveDirectorEntrada | devolverDmr).
 * @param rolName rol_name crudo del backend (p. ej. user.rolName); se compara en minúsculas.
 */
export function isEntradaActionVisible(
  action: string,
  rolName: string,
): boolean {
  const allowed = ENTRADA_ACTION_ROLES[action as EntradaActionName];
  if (!allowed) return false;

  const normalizedRole = (rolName ?? "").trim().toLowerCase();
  return allowed.includes(normalizedRole as EntradaRole);
}
