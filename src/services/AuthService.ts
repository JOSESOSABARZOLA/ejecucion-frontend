/**
 * Microservicio: ejecucion
 * Módulo: Auth (frontend) — Fase 03.11 / Plan 03
 * Feature: Login local
 * Archivo: AuthService.ts
 * Responsabilidad: Login con credenciales del formulario local, disponible SÓLO cuando el backend
 *   publica `authCentralEnabled: false`. El backend responde `{ user }` y emite la cookie HttpOnly de
 *   sesión: el cuerpo ya NO trae token y el frontend no persiste credencial alguna. La validación de
 *   sesión vive en `AuthSessionService` (`GET /auth/session` y `GET /auth/me`).
 * Desarrollador: Johan Freire / Andrés Miño (Fase 03.11)
 * Fecha: 2026-08-05
 */

import httpClient from "../api/httpClient";
import { ErrorParaUsuario } from "../api/mensajeParaUsuario";
import type { UserFromLogin, UserResponse } from "../interfaces/IUser";

export const authService = {
  /**
   * Autentica con el formulario local y obtiene el perfil de autorización del usuario.
   * @param userFromLogin credenciales del formulario
   * @returns el usuario con su rol, módulos, submenús y actividades
   */
  async getUserAuthorization(
    userFromLogin: UserFromLogin,
  ): Promise<UserResponse> {
    const { data } = await httpClient.post<UserResponse>(`/auth/login`, {
      email: userFromLogin.email,
      password: userFromLogin.password,
    });

    if (!data) {
      throw new ErrorParaUsuario("No se pudo obtener la autorización del usuario.");
    }

    return data;
  },
};
