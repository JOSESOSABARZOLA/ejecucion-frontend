/**
 * Microservicio: ejecucion
 * Módulo: Compartido / HTTP — Fase 03.11 / Plan 03
 * Feature: Exclusión de las rutas de sesión de la reacción global a 401
 * Archivo: authPaths.test.ts
 * Responsabilidad: Fijar la lista EXACTA de rutas que NO disparan la reacción global a 401. Es la
 *   regresión de P-01 (bucle infinito de redirección): si `/auth/session` no estuviera excluida, el
 *   bootstrap de un usuario anónimo entraría en bucle. Y al revés: `/auth/me` y las APIs privadas
 *   (`/epas`, `/sorteo/...`) NO están excluidas a propósito, porque un 401 ahí sí significa que la
 *   sesión murió y hay que limpiarla (T-0311-13).
 * Desarrollador: Andrés Miño
 * Fecha: 2026-08-05
 */

import { describe, it, expect } from "vitest";

import { AUTH_SESSION_PATHS, isAuthSessionPath } from "./authPaths";

describe("isAuthSessionPath (rutas excluidas de la reacción global a 401)", () => {
  it("excluye las cuatro rutas de sesión", () => {
    expect(isAuthSessionPath("/auth/session")).toBe(true);
    expect(isAuthSessionPath("/auth/session/exchange")).toBe(true);
    expect(isAuthSessionPath("/auth/session/logout")).toBe(true);
    expect(isAuthSessionPath("/auth/mode")).toBe(true);
  });

  it("la lista tiene exactamente esas cuatro rutas", () => {
    expect([...AUTH_SESSION_PATHS].sort()).toEqual([
      "/auth/mode",
      "/auth/session",
      "/auth/session/exchange",
      "/auth/session/logout",
    ]);
  });

  it("NO excluye /auth/me: un 401 ahí sí significa que no hay sesión", () => {
    expect(isAuthSessionPath("/auth/me")).toBe(false);
  });

  it("NO excluye las APIs privadas del módulo", () => {
    expect(isAuthSessionPath("/epas")).toBe(false);
    expect(isAuthSessionPath("/sorteo/1/2/firmar")).toBe(false);
    expect(isAuthSessionPath("/alert/listByUser")).toBe(false);
  });

  it("ignora query y fragmento", () => {
    expect(isAuthSessionPath("/auth/session?foo=1")).toBe(true);
    expect(isAuthSessionPath("/auth/session#x")).toBe(true);
  });

  it("compara el pathname cuando llega una URL absoluta", () => {
    expect(isAuthSessionPath("http://localhost:3004/auth/session")).toBe(true);
    expect(isAuthSessionPath("http://localhost:3004/epas")).toBe(false);
  });

  it("tolera el prefijo /api del proxy de producción", () => {
    expect(isAuthSessionPath("/api/auth/session")).toBe(true);
    expect(isAuthSessionPath("/api/auth/me")).toBe(false);
  });

  it("compara por igualdad exacta, no por prefijo", () => {
    expect(isAuthSessionPath("/auth/sessionfoo")).toBe(false);
    expect(isAuthSessionPath("/auth/session/otra")).toBe(false);
  });

  it("ignora la barra final sobrante", () => {
    expect(isAuthSessionPath("/auth/session/")).toBe(true);
  });

  it("devuelve false y no lanza cuando no hay url", () => {
    expect(() => isAuthSessionPath(undefined)).not.toThrow();
    expect(isAuthSessionPath(undefined)).toBe(false);
    expect(isAuthSessionPath("")).toBe(false);
  });
});
