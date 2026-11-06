/**
 * Microservicio: ejecucion
 * Módulo: Auth central (frontend) — Fase 03.11 / Plan 03
 * Feature: Servicio único de los cinco endpoints de auth
 * Archivo: AuthSessionService.test.ts
 * Responsabilidad: Fijar verbo, ruta y desempaquetado de los cinco endpoints de auth
 *   (`/auth/mode`, `/auth/session`, `/auth/session/exchange`, `/auth/me`, `/auth/session/logout`), que
 *   comparten el MISMO sobre del ecosistema `{success, data, correlationId, requestId}`. También fija
 *   que ninguno captura errores —los propaga para que el callback y el guard apliquen políticas
 *   distintas— y que el tipo `User` ya no puede alojar un token (T-0311-11). Mockea api/httpClient:
 *   no hace red real.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-08-05
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

/** Fuentes crudas, para aseverar por revisión estática la ausencia del token fantasma. */
const USER_INTERFACE_SOURCES = import.meta.glob<string>(
  "../interfaces/IUser.ts",
  { query: "?raw", eager: true, import: "default" },
);
const AUTH_SERVICE_SOURCES = import.meta.glob<string>("./AuthService.ts", {
  query: "?raw",
  eager: true,
  import: "default",
});

vi.mock("../api/httpClient", () => ({
  default: {
    get: vi.fn(async () => ({ data: {} })),
    post: vi.fn(async () => ({ data: {} })),
    patch: vi.fn(async () => ({ data: {} })),
  },
}));

import httpClient from "../api/httpClient";
import { AuthSessionService } from "./AuthSessionService";

const mockGet = httpClient.get as unknown as ReturnType<typeof vi.fn>;
const mockPost = httpClient.post as unknown as ReturnType<typeof vi.fn>;

/** Sobre del ecosistema, igual para los cuatro endpoints de auth. */
function envelope<TData>(data: TData) {
  return {
    data: {
      success: true,
      data,
      correlationId: "c-1",
      requestId: "r-1",
    },
  };
}

describe("AuthSessionService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("getMode() pide GET /auth/mode y devuelve el contenido de data", async () => {
    mockGet.mockResolvedValueOnce(envelope({ authCentralEnabled: true }));

    const mode = await AuthSessionService.getMode();

    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(mockGet.mock.calls[0][0]).toBe("/auth/mode");
    expect(mode).toEqual({ authCentralEnabled: true });
  });

  it("getSession() pide GET /auth/session y devuelve el usuario de la sesión", async () => {
    mockGet.mockResolvedValueOnce(
      envelope({ user: { username: "amino", displayName: "Andrés Miño" } }),
    );

    const user = await AuthSessionService.getSession();

    expect(mockGet.mock.calls[0][0]).toBe("/auth/session");
    expect(user).toEqual({ username: "amino", displayName: "Andrés Miño" });
  });

  it("exchange(code) hace POST /auth/session/exchange con el código y devuelve el usuario", async () => {
    mockPost.mockResolvedValueOnce(
      envelope({ user: { username: "amino", displayName: "Andrés Miño" } }),
    );

    const user = await AuthSessionService.exchange("abc");

    expect(mockPost).toHaveBeenCalledTimes(1);
    expect(mockPost.mock.calls[0][0]).toBe("/auth/session/exchange");
    expect(JSON.stringify(mockPost.mock.calls[0][1])).toContain("abc");
    expect(user).toEqual({ username: "amino", displayName: "Andrés Miño" });
  });

  it("getMe() pide GET /auth/me y devuelve el perfil de autorización", async () => {
    mockGet.mockResolvedValueOnce(
      envelope({
        user: {
          usuId: 7,
          usuEmail: "a@amc.gob.ec",
          usuFullName: "Andrés Miño",
          rolName: "SECRETARIO",
          modulos: [],
          submenus: [],
          actividades: [],
        },
      }),
    );

    const user = await AuthSessionService.getMe();

    expect(mockGet.mock.calls[0][0]).toBe("/auth/me");
    expect(user.usuId).toBe(7);
    expect(user.rolName).toBe("SECRETARIO");
  });

  it("logout() hace POST /auth/session/logout y resuelve sin valor", async () => {
    mockPost.mockResolvedValueOnce(envelope({ ok: true }));

    const result = await AuthSessionService.logout();

    expect(mockPost.mock.calls[0][0]).toBe("/auth/session/logout");
    expect(result).toBeUndefined();
  });

  it("ninguno de los cinco métodos captura el error: lo propaga", async () => {
    const fallo = new Error("401");

    mockGet.mockRejectedValueOnce(fallo);
    await expect(AuthSessionService.getMode()).rejects.toBe(fallo);

    mockGet.mockRejectedValueOnce(fallo);
    await expect(AuthSessionService.getSession()).rejects.toBe(fallo);

    mockGet.mockRejectedValueOnce(fallo);
    await expect(AuthSessionService.getMe()).rejects.toBe(fallo);

    mockPost.mockRejectedValueOnce(fallo);
    await expect(AuthSessionService.exchange("abc")).rejects.toBe(fallo);

    mockPost.mockRejectedValueOnce(fallo);
    await expect(AuthSessionService.logout()).rejects.toBe(fallo);
  });
});

describe("T-0311-11: el tipo User ya no puede alojar un token", () => {
  it("IUser.ts no declara ningún campo de token", () => {
    const source = USER_INTERFACE_SOURCES["../interfaces/IUser.ts"];

    expect(source).toBeTruthy();
    expect(source).not.toMatch(/^\s*token\s*:/m);
    expect(source).not.toMatch(/accessToken/);
  });

  it("AuthService.ts ya no pega contra el endpoint inexistente de validación de token", () => {
    const source = AUTH_SERVICE_SOURCES["./AuthService.ts"];

    expect(source).toBeTruthy();
    expect(source).not.toContain("validate-token");
    expect(source).not.toContain("console.log");
  });
});
