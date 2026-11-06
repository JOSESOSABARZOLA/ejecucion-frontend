/**
 * Microservicio: ejecucion
 * Módulo: Auth central (frontend) — Fase 03.11 / Plan 03
 * Feature: Configuración de auth runtime-first y armado de la URL del portal
 * Archivo: authRuntimeConfig.test.ts
 * Responsabilidad: Fijar con aserciones ejecutables (a) el orden de resolución de la configuración
 *   —runtime inyectado en window > VITE_* > default por modo—, (b) la forma EXACTA de la URL del portal
 *   de Auth central (`redirectUri` + `module`, percent-codificados, sin doble barra) y (c) que el
 *   `redirectUri` SIEMPRE se deriva del origen del navegador y nunca de un query param entrante
 *   (mitigación T-0311-12, open redirect). Mockea `../utils/navigation` para que ningún test navegue.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-08-05
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

// Costura de navegación dura: ningún test puede tocar window.location de verdad.
vi.mock("../utils/navigation", () => ({
  replaceLocation: vi.fn(),
  currentOrigin: vi.fn(() => "http://localhost:5177"),
}));

import { replaceLocation } from "../utils/navigation";
import {
  buildCentralAuthPortalUrl,
  buildPortalUrl,
  getCentralAuthLogoutUrl,
  redirectToCentralAuthPortal,
} from "./authRuntimeConfig";
import { env, resolveEnv } from "./env";

const mockReplaceLocation = replaceLocation as unknown as ReturnType<
  typeof vi.fn
>;

describe("buildCentralAuthPortalUrl (URL del portal de Auth central)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("empieza por el portal configurado y lleva redirectUri y module", () => {
    const url = buildCentralAuthPortalUrl("http://localhost:5177");

    expect(url.startsWith(env.authPortalUrl)).toBe(true);

    const params = new URL(url).searchParams;
    expect(params.get("redirectUri")).toBe("http://localhost:5177/auth/callback");
    expect(params.get("module")).toBe(env.authModuleCode);
  });

  it("percent-codifica el redirectUri en la URL resultante", () => {
    const url = buildCentralAuthPortalUrl("http://localhost:5177");

    expect(url).toContain(
      "redirectUri=http%3A%2F%2Flocalhost%3A5177%2Fauth%2Fcallback",
    );
    expect(url).not.toContain("redirectUri=http://");
  });

  it("nunca produce doble barra aunque el origen llegue con barra final", () => {
    const url = buildCentralAuthPortalUrl("http://localhost:5177/");

    expect(new URL(url).searchParams.get("redirectUri")).toBe(
      "http://localhost:5177/auth/callback",
    );
    expect(url).not.toContain("5177%2F%2Fauth");
  });

  it("usa el origen del navegador cuando no se le pasa uno", () => {
    const url = buildCentralAuthPortalUrl();

    expect(new URL(url).searchParams.get("redirectUri")).toBe(
      "http://localhost:5177/auth/callback",
    );
  });

  it("T-0311-12: ignora cualquier redirectUri que venga en la URL actual", () => {
    window.history.replaceState(
      {},
      "",
      "/?redirectUri=https://evil.example.com/robo",
    );

    const url = buildCentralAuthPortalUrl();

    expect(new URL(url).searchParams.get("redirectUri")).toBe(
      "http://localhost:5177/auth/callback",
    );
    expect(url).not.toContain("evil.example.com");
  });

  it("concatena con & cuando el portal ya trae query propia", () => {
    const url = buildPortalUrl(
      "https://portal.example.com/login?tenant=amc",
      "EJECUCION",
      "http://localhost:5177",
    );

    expect(url.startsWith("https://portal.example.com/login?tenant=amc&")).toBe(
      true,
    );
    expect(new URL(url).searchParams.get("tenant")).toBe("amc");
    expect(new URL(url).searchParams.get("module")).toBe("EJECUCION");
  });
});

describe("getCentralAuthLogoutUrl / redirectToCentralAuthPortal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("devuelve la URL de logout configurada", () => {
    expect(getCentralAuthLogoutUrl()).toBe(env.authLogoutUrl);
  });

  it("navega una sola vez, por la costura de navegación, a la URL del portal", () => {
    redirectToCentralAuthPortal();

    expect(mockReplaceLocation).toHaveBeenCalledTimes(1);
    expect(mockReplaceLocation).toHaveBeenCalledWith(
      buildCentralAuthPortalUrl(),
    );
  });
});

describe("resolveEnv (orden runtime > VITE_* > default)", () => {
  it("prefiere la configuración runtime inyectada en window", () => {
    const resolved = resolveEnv({
      runtime: { API_URL: "https://runtime.example.com" },
      viteEnv: {
        VITE_API_URL: "https://vite.example.com",
        VITE_API_BASE_URL: "https://legacy.example.com",
      },
      mode: "development",
    });

    expect(resolved.apiBaseUrl).toBe("https://runtime.example.com");
  });

  it("cae a VITE_API_URL cuando no hay runtime", () => {
    const resolved = resolveEnv({
      viteEnv: {
        VITE_API_URL: "https://vite.example.com",
        VITE_API_BASE_URL: "https://legacy.example.com",
      },
      mode: "development",
    });

    expect(resolved.apiBaseUrl).toBe("https://vite.example.com");
  });

  it("acepta VITE_API_BASE_URL como alias histórico", () => {
    const resolved = resolveEnv({
      viteEnv: { VITE_API_BASE_URL: "https://legacy.example.com" },
      mode: "development",
    });

    expect(resolved.apiBaseUrl).toBe("https://legacy.example.com");
  });

  it("usa el default por modo cuando no hay nada configurado", () => {
    expect(resolveEnv({ mode: "development" }).apiBaseUrl).toBe(
      "http://localhost:3004",
    );
    expect(resolveEnv({ mode: "production" }).apiBaseUrl).toBe("/api");
  });

  it("resuelve portal, logout y código de módulo con el mismo orden", () => {
    const resolved = resolveEnv({
      runtime: { AUTH_PORTAL_URL: "https://runtime-portal.example.com/login" },
      viteEnv: {
        VITE_AUTH_PORTAL_URL: "https://vite-portal.example.com/login",
        VITE_AUTH_LOGOUT_URL: "https://vite-portal.example.com/logout",
        VITE_AUTH_MODULE_CODE: "OTRO",
      },
      mode: "development",
    });

    expect(resolved.authPortalUrl).toBe(
      "https://runtime-portal.example.com/login",
    );
    expect(resolved.authLogoutUrl).toBe(
      "https://vite-portal.example.com/logout",
    );
    expect(resolved.authModuleCode).toBe("OTRO");
  });
});

describe("T-0311-14: la configuración pública no puede llevar secretos", () => {
  it("expone exactamente cuatro claves, todas URLs públicas o el código de módulo", () => {
    expect(Object.keys(env).sort()).toEqual([
      "apiBaseUrl",
      "authLogoutUrl",
      "authModuleCode",
      "authPortalUrl",
    ]);
  });

  it("ningún valor parece un secreto", () => {
    for (const value of Object.values(env)) {
      expect(value).not.toMatch(/secret|password|passwd|apikey|token/i);
    }
  });
});
