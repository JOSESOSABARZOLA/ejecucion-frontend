/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/multas-compulsorias (frontend)
 * Feature: Historial de multas compulsorias del expediente (2026-09-03)
 * Archivo: MultaCompulsoriaService.ts
 * Responsabilidad: Consumir `/multas-compulsorias`. El ORDINAL llega calculado por el servidor: la
 *   pantalla no lo deduce ni lo teclea nadie, porque es el mismo número que imprime la providencia.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-09-03
 */
import httpClient from "../api/httpClient";
import type { OrdenPago } from "./OrdenPagoService";

/**
 * Timeout PROPIO del registro. El global del httpClient es de 5 s y aquí se sube el PDF escaneado de
 * una resolución por una red municipal: mismo criterio que el informe de trabajo comunitario y el
 * oficio de baja de coactiva.
 */
export const SUBIDA_TIMEOUT_MS = 45000;

export interface MultaCompulsoria {
  mcomId: number;
  eejeId: number;
  /** 1, 2, 3… Lo deriva el servidor del orden de la serie. */
  ordinal: number;
  resolucionNumero: string;
  resolucionFecha: string;
  valor: number;
  docId: number;
  docUrl?: string;
  registradaAt: string;
  registradaBy: number;
  registradaPor?: string;
  /** Su orden de pago vigente, si ya se registró. Cada multa lleva la suya. */
  orden?: OrdenPago;
}

export const MultaCompulsoriaService = {
  /** La serie del expediente → GET /multas-compulsorias/:eejeId. */
  async serie(eejeId: number): Promise<MultaCompulsoria[]> {
    const { data } = await httpClient.get<MultaCompulsoria[]>(
      `/multas-compulsorias/${eejeId}`,
    );
    return data;
  },

  /**
   * Registra una multa con la resolución que la impuso → POST /multas-compulsorias/:eejeId.
   *
   * Multipart porque el PDF es obligatorio: el backend rechaza la multa sin él. El actor sale del
   * JWT, nunca del cuerpo.
   */
  async registrar(
    eejeId: number,
    datos: {
      resolucionNumero: string;
      resolucionFecha: string;
      valor: number;
    },
    resolucion: File,
  ): Promise<{ mcomId: number }> {
    const formData = new FormData();
    formData.append("file", resolucion);
    formData.append("resolucionNumero", datos.resolucionNumero);
    formData.append("resolucionFecha", datos.resolucionFecha);
    formData.append("valor", String(datos.valor));

    const { data } = await httpClient.post<{ mcomId: number }>(
      `/multas-compulsorias/${eejeId}`,
      formData,
      {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: SUBIDA_TIMEOUT_MS,
      },
    );
    return data;
  },
};

export default MultaCompulsoriaService;
