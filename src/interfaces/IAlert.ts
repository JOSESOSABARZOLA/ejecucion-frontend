/**
 * Microservicio: ejecucion
 * Módulo: Alertas
 * Feature: Tipos de las alertas de la campana
 * Archivo: IAlert.ts
 * Responsabilidad: Forma de una alerta del usuario tal y como la sirven GET /alert/unread y
 *   GET /alert/listByUser.
 * Desarrollador: Johan Freire
 * Fecha: 2026-03-19
 * Modificado por: Andrés Miño — 2026-10-30 (quick 261030-m29: la alerta trae el expediente, el tipo
 *   del catálogo y la ruta interna a la que lleva la campana)
 */
export type Priority = "baja" | "media" | "alta";

export interface IAlert {
  ualeId: number;
  ualeRead: boolean;
  ualeReadAt: Date | null;
  receptorId?: number;
  emisorId?: null;
  aresCreatedAt: Date;
  aresTitle: string;
  aresMessage: string;
  aresPriority: Priority;
  elapsedTime: string;
  /** Expediente de ejecución al que se refiere la alerta (null si no es de un expediente). */
  eejeId?: number | null;
  /** Tipo de la alerta (eventType del catálogo de notificaciones). */
  aresTipo?: string | null;
  /**
   * Ruta interna a la que lleva la alerta. El backend ya la filtra, pero la campana la vuelve a
   * validar con `destinoDeAlerta` antes de navegar.
   */
  aresRuta?: string | null;
}

export interface FindAlertsByStatus {
  totalAlerts: number;
  alerts: IAlert[];
}

export interface AlertResponse {
  data: IAlert[];
  total: number;
  limit: number;
  offset: number;
  page: number;
  pages: number;
}
