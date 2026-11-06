/**
 * Microservicio: ejecucion
 * Módulo: Auth central (frontend) — Fase 03.11 / Plan 03
 * Feature: Contrato de sesión del ecosistema
 * Archivo: ISession.ts
 * Responsabilidad: Tipar el contrato de sesión homologado del ecosistema: el usuario mínimo que
 *   devuelven los endpoints de sesión, el sobre común a los cuatro endpoints de auth y la bandera de
 *   modo que publica el backend (fuente ÚNICA del modo; el frontend no la deduce de ninguna VITE_*).
 * Desarrollador: Andrés Miño
 * Fecha: 2026-08-05
 */

/** Usuario mínimo del contrato de sesión: exactamente lo que devuelve el Auth central. */
export interface SessionUser {
  username: string;
  displayName: string;
}

/** Sobre homologado del ecosistema; lo comparten los cuatro endpoints de auth. */
export interface ApiEnvelope<TData> {
  success: boolean;
  data: TData;
  correlationId: string;
  requestId: string;
}

/** Modo de autenticación publicado por el backend. */
export interface AuthMode {
  authCentralEnabled: boolean;
}
