/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/entrada-lotes (frontend)
 * Feature: Resolver de gating ROLE-ONLY de la Bandeja de Salida (opción A del RESEARCH, D-06) — Fase 3.9
 * Archivo: salidaGating.ts
 * Responsabilidad: Decir, dado un ROL, si la acción de SALIDA `enviarSg` (remitir el lote a Secretaría
 *   General) es visible. Es role-only (SIN status): la acción no se gatea por `envl_status` (texto libre,
 *   verdicto OQ-1) sino solo por el rol operativo. Reparto (Plan 02): la Bandeja de Salida es COMPARTIDA
 *   por el SECRETARIO ABOGADO y el DIRECTOR (ambos ven `enviarSg`) — a diferencia del reparto EXCLUSIVO
 *   de la entrada (donde sync/aprobar-enviar-sorteo son solo del secretario y approve-director solo del
 *   director). El funcionario decisor NO ve la acción. El gating de UI es CONVENIENCIA, NO seguridad: la
 *   autorización real vive en el backend (@Roles('director','secretario abogado') + gate fino
 *   isSalidaActionAllowedForRoles del Plan 02) — T-03.9-08. Se mantiene APARTE de entradaGating (no se
 *   fusiona con el enum de acciones de entrada). La comparación de rol es case-insensitive (se normaliza a
 *   minúsculas, igual que isEntradaActionVisible).
 * Desarrollador: Andrés Miño
 * Fecha: 2026-07-23
 */

/** Rol operativo con acciones en la Bandeja de Salida (misma cadena EXACTA del backend, minúsculas). */
export type SalidaRole =
  | "secretario abogado"
  | "director"
  | "funcionario decisor";

/**
 * Las acciones de la SALIDA gateadas por rol (role-only, sin status).
 *
 * `revisarObservaciones` entró el 2026-09-18 y es la PRIMERA que rompe el reparto compartido de esta
 * bandeja: despachar lo pueden los dos, revisar solo el director.
 */
export type SalidaActionName = "enviarSg" | "revisarObservaciones";

/**
 * Mapa role-only de las acciones de salida → roles permitidos. SIN `status`: el reparto es puramente por
 * rol. A diferencia de la entrada, la SALIDA es COMPARTIDA: `enviarSg` lo ven director Y secretario. Si
 * una acción no está en el mapa, NO es visible para ningún rol (default deny) — el universo de acciones
 * es CERRADO y conocido.
 */
export const SALIDA_ACTION_ROLES: Record<SalidaActionName, SalidaRole[]> = {
  // Remite el lote a Secretaría General (cierra el flujo local): acto COMPARTIDO director + secretario.
  enviarSg: ["secretario abogado", "director"],
  // 🔴 APROBAR O RECHAZAR las observaciones del secretario (2026-09-18): acto EXCLUSIVO del DIRECTOR,
  // y la excepción al reparto compartido de esta bandeja. El secretario ANOTA y el director
  // CONSIENTE; si el mismo rol pudiera hacer las dos cosas, la revisión dejaría de ser un control.
  // El backend lo cierra igual (@Roles('director') + gate fino): esto solo evita ofrecer el botón.
  revisarObservaciones: ["director"],
};

/**
 * ¿Es visible la acción de salida `action` para el rol `rolName`? Role-only: normaliza el rol a
 * minúsculas (case-insensitive, tolera espacios) y devuelve si está en la lista permitida. Una acción
 * desconocida devuelve false (default deny). NO consulta `envl_status` ni el enum EPAS.
 *
 * @param action acción de salida (enviarSg).
 * @param rolName rol_name crudo del backend (p. ej. user.rolName); se compara en minúsculas.
 */
export function isSalidaActionVisible(
  action: string,
  rolName: string,
): boolean {
  const allowed = SALIDA_ACTION_ROLES[action as SalidaActionName];
  if (!allowed) return false;

  const normalizedRole = (rolName ?? "").trim().toLowerCase();
  return allowed.includes(normalizedRole as SalidaRole);
}
