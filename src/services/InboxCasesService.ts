/**
 * Microservicio: resolucion
 * M�dulo: N/A
 * Feature: Servicio para la consulta de expediente
 * Archivo: CaseService.ts
 * Responsabilidad: Realizar consultas de información de expedientes para el modulo
 * Desarrollador: Johan Freire
 * Fecha: 2026-04-06
 */
import httpClient from "../api/httpClient";
import type { IInboxCases } from "../interfaces/IInboxCases";

/** Conteo de lo sembrado (POST /seed). `casos` = EPAS creados; `expedientes` = sus contenedores. */
export interface SeedResult {
  expedientes: number;
  casos: number;
}

/** Filas eliminadas por la purga (PATCH /seed/reset), por tabla. */
export interface SeedPurgeResult {
  sorteos: number;
  expedienteDocumento: number;
  documentos: number;
  epas: number;
  administrados: number;
  expedientes: number;
}

/** Nº de EXPEDIENTES demo por defecto (cada uno con 1..3 casos). Espeja SEED_DEFAULT_EXPEDIENTES. */
export const SEED_DEFAULT_EXPEDIENTES = 5;

export const InboxCasesService = {
  /**
   * ¿Permite este entorno sembrar/purgar datos demo? El backend lo gatea con SEED_ENABLED (default
   * false). Se consulta ANTES de pintar los botones: ofrecer una acción que va a responder 403 es
   * peor que no ofrecerla.
   * @returns true si POST /seed y PATCH /seed/reset están habilitados.
   */
  async isSeedEnabled(): Promise<boolean> {
    const { data } = await httpClient.get<{ enabled: boolean }>(`/seed/status`);
    return data.enabled;
  },

  /**
   * Siembra datos demo: expedientes MULTI-CASO (cada uno con 1..3 casos/EPAS) en RECIBIDO y SIN
   * remitir, es decir, en la bandeja del DIRECTOR (paso 1 de RECE-08).
   *
   * POST (antes apuntaba a /document-administration/ingreso-expedientes, y el /seed del backend era
   * un @Get() con body — que axios no puede enviar).
   *
   * @param amountOfRecords Nº de EXPEDIENTES a sembrar (no de casos).
   * @returns Conteo de expedientes y casos sembrados.
   */
  async generateSeed(
    amountOfRecords: number = SEED_DEFAULT_EXPEDIENTES,
  ): Promise<SeedResult> {
    const { data } = await httpClient.post<SeedResult>(`/seed`, {
      amountOfRecords,
    });
    return data;
  },

  async getInboxCases(
    pageIndex: number,
    pageSize: number,
    filterParams: Record<string, unknown>,
  ): Promise<IInboxCases[]> {
    // Creamos objeto con los primeros parametros que siempre llegan para paginacion
    const params: URLSearchParams = new URLSearchParams({
      limit: String(pageSize),
      offset: String(pageIndex),
    });

    // Validamos los filtros que puedan llegar
    for (const [key, value] of Object.entries(filterParams)) {
      if (value !== null && value !== undefined && value !== "") {
        params.append(key, String(value));
      }
    }
    const { data } = await httpClient.get<IInboxCases[]>(
      `/document-administration/document-cases-income?${params.toString()}`,
    );
    console.log("Respuesta del backend inbox cases:", data);

    return data;
  },

  /**
   * PURGA los datos operativos de la BD de Ejecución (EPAS, expedientes, administrados, documentos y
   * reflejos de sorteo). NO toca catálogos, usuarios, roles ni submenús. Destructivo: la vista debe
   * confirmarlo con el usuario antes de llamarlo.
   * @returns Filas eliminadas por tabla.
   */
  async resetInboxCases(): Promise<SeedPurgeResult> {
    const { data } = await httpClient.patch<SeedPurgeResult>(`/seed/reset`);
    return data;
  },

  /**
   * Triage del director (RECE-08, Fase 3): "aprobar y enviar al sorteo" un memorando de ingreso.
   * Avanza el memorando de `recibido` a `en sorteo`, dejándolo visible para el secretario abogado.
   * Solo el director (el backend lo gatea con @Roles('director')); el actor sale del JWT, nunca del
   * body. PATCH /document-administration/:docId/triage-sorteo.
   */
  async enviarASorteo(docId: number): Promise<void> {
    await httpClient.patch(`/document-administration/${docId}/triage-sorteo`, {});
  },
};
