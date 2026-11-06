/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/coactiva (frontend)
 * Feature: El tramo de la coactiva (Fase 03.14.5)
 * Archivo: CoactivaService.ts
 * Responsabilidad: Consumir `/coactiva`. La coactiva **no se ejecuta en este módulo** —la llevan las
 *   Administraciones Zonales—: aquí solo se registra si la iniciaron y se gobierna la vuelta
 *   mientras no lo hayan hecho.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-08-20
 */
import httpClient from "../api/httpClient";
import { SUBIDA_TIMEOUT_MS } from "./TrabajoComunitarioService";

export type DestinoBaja = "PAGO" | "TRABAJO_COMUNITARIO";

export interface EstadoCoactiva {
  eejeId: number;
  eejeStatus: string;
  /** 🔴 El candado: mientras sea false el administrado puede volver; después, no. */
  iniciada: boolean;
  iniciadaAt?: string;
  registradaBy?: number;
  oficioDocId?: number;
  /** Si tiene fecha, ya tuvo trabajo comunitario y no vuelve a tenerlo. */
  tcYaAutorizadoAt?: string;
}

export interface BajaCoactivaRegistrada {
  eejeId: number;
  destino: DestinoBaja;
  eejeStatus: string;
  oficioDocId: number;
}

/** Qué implica cada destino, para decirlo ANTES de confirmar. */
export const EFECTO_BAJA: Record<DestinoBaja, string> = {
  PAGO: "el expediente vuelve a verificación de pago, y se paga cuando se pague: no hay plazo que vencer",
  TRABAJO_COMUNITARIO:
    "el expediente pasa a trabajo comunitario, y usted deberá autorizar las horas con su providencia",
};

export const CoactivaService = {
  async estado(eejeId: number): Promise<EstadoCoactiva> {
    const { data } = await httpClient.get<EstadoCoactiva>(
      `/coactiva/${eejeId}`,
    );
    return data;
  },

  /** ⚠️ No se deshace: marcarla cierra el derecho del administrado a volver. */
  async marcarIniciada(
    eejeId: number,
    iniciadaAt?: string,
  ): Promise<EstadoCoactiva> {
    const { data } = await httpClient.patch<EstadoCoactiva>(
      `/coactiva/${eejeId}`,
      { iniciadaAt },
    );
    return data;
  },

  async registrarBaja(
    eejeId: number,
    destino: DestinoBaja,
    oficio: File,
  ): Promise<BajaCoactivaRegistrada> {
    const formData = new FormData();
    formData.append("file", oficio);
    formData.append("destino", destino);

    const { data } = await httpClient.post<BajaCoactivaRegistrada>(
      `/coactiva/${eejeId}/baja`,
      formData,
      {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: SUBIDA_TIMEOUT_MS,
      },
    );
    return data;
  },
};

export default CoactivaService;
