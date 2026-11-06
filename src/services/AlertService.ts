/**
 * Microservicio: resolucion
 * Módulo: N/A
 * Feature: Servicio para la consulta de alertas del sistema
 * Archivo: AlertService.ts
 * Responsabilidad: Realizar consultas para la validación de avisos hacia el usuario logeado que no hayan sido leidos
 * Desarrollador: Johan Freire
 * Fecha: 2026-03-19
 * Modificado por: Andrés Miño — 2026-10-30 (quick 261030-m29: el listado de Avisos deja de caer a
 *   datos simulados cuando el servidor falla — el error sube y Avisos lo dice en su hueco —, y
 *   `markAsRead` ya tiene su ruta en el backend, `PUT /alert/:ualeId/read`)
 */
import type { FindAlertsByStatus, AlertResponse } from "../interfaces/IAlert";
import httpClient from "../api/httpClient";

export const AlertService = {
  /**
   * Las alertas no leídas del usuario autenticado. El receptor lo pone el backend desde la sesión
   * (JWT o cookie), así que no viaja ningún id: el `userId` que recibía antes solo se imprimía.
   */
  async getUnreadAlerts(): Promise<FindAlertsByStatus> {
    const { data } = await httpClient.get(`/alert/unread`);
    return data;
  },

  async getAllAlerts(
    pageIndex: number,
    pageSize: number,
    filterParams: Record<string, unknown> = {},
  ): Promise<AlertResponse> {
    const params = new URLSearchParams({
      limit: String(pageSize),
      offset: String(pageIndex * pageSize),
    });

    // Add filter parameters if provided
    Object.entries(filterParams).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        params.append(key, String(value));
      }
    });

    // Sin caída a datos simulados (quick 261030-m29): un fallo del servidor se propaga y la página
    // lo dice en su hueco. Antes se inventaban avisos que el usuario no tenía.
    const { data } = await httpClient.get<AlertResponse>(
      `/alert/listByUser?${params.toString()}`,
    );

    return data;
  },

  async markAsRead(userAlertId: number): Promise<void> {
    const { data } = await httpClient.put(`/alert/${userAlertId}/read`, {});
    return data;
  },
};
