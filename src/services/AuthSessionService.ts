/**
 * Microservicio: ejecucion
 * Módulo: Auth central (frontend) — Fase 03.11 / Plan 03
 * Feature: Servicio único de los cinco endpoints de auth
 * Archivo: AuthSessionService.ts
 * Responsabilidad: Único punto del frontend que habla con la superficie de auth del backend
 *   (`/auth/mode`, `/auth/session`, `/auth/session/exchange`, `/auth/me` y `/auth/session/logout`).
 *   Los cuatro endpoints con cuerpo comparten el MISMO sobre del ecosistema, así que aquí hay un solo
 *   desempaquetador. Ningún método captura errores: los propaga para que el callback y el guard
 *   apliquen políticas distintas. La credencial nunca se pasa por parámetro: viaja en la cookie
 *   HttpOnly que `httpClient` manda con `withCredentials`.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-08-05
 */

import httpClient from "../api/httpClient";
import type { ApiEnvelope, AuthMode, SessionUser } from "../interfaces/ISession";
import type { User } from "../interfaces/IUser";

/**
 * Desempaqueta el sobre del ecosistema.
 * @param response respuesta de httpClient
 * @returns el contenido de `data`
 */
function unwrap<TData>(response: { data: ApiEnvelope<TData> }): TData {
  return response.data.data;
}

export const AuthSessionService = {
  /**
   * Modo de autenticación vigente en el backend (fuente única de verdad).
   * @returns `{ authCentralEnabled }`
   */
  async getMode(): Promise<AuthMode> {
    const response =
      await httpClient.get<ApiEnvelope<AuthMode>>("/auth/mode");

    return unwrap(response);
  },

  /**
   * Usuario de la sesión vigente según la cookie. Un 401 aquí es una respuesta normal: significa que
   * no hay sesión.
   * @returns el usuario del contrato de sesión
   */
  async getSession(): Promise<SessionUser> {
    const response =
      await httpClient.get<ApiEnvelope<{ user: SessionUser }>>("/auth/session");

    return unwrap(response).user;
  },

  /**
   * Canjea el código de un solo uso que devuelve Auth central por la cookie de sesión del módulo.
   * @param code código de un solo uso recibido en el callback
   * @returns el usuario del contrato de sesión
   */
  async exchange(code: string): Promise<SessionUser> {
    const response = await httpClient.post<ApiEnvelope<{ user: SessionUser }>>(
      "/auth/session/exchange",
      { code },
    );

    return unwrap(response).user;
  },

  /**
   * Perfil de autorización del usuario de la sesión: rol, módulos, submenús y actividades. Es el
   * único punto de hidratación del perfil, igual en los dos modos.
   * @returns el usuario con su perfil de autorización
   */
  async getMe(): Promise<User> {
    const response =
      await httpClient.get<ApiEnvelope<{ user: User }>>("/auth/me");

    return unwrap(response).user;
  },

  /**
   * Cierra la sesión del módulo: el backend limpia la cookie.
   */
  async logout(): Promise<void> {
    await httpClient.post("/auth/session/logout");
  },
};

export default AuthSessionService;
