/**
 * Microservicio: ejecucion
 * Módulo: Expediente (compartido)
 * Feature: Documentos nuevos sin leer, por usuario (quick 261030-m29)
 * Archivo: DocumentosLecturaService.ts
 * Responsabilidad: Consumir `/documentos-lectura` del backend: qué documentos de un EPAS no ha
 *   abierto todavía el usuario de la sesión, cuántos no ha abierto en varios EPAS a la vez (los
 *   contadores de la bandeja y de la ficha) y la marca de lectura al abrir uno. El usuario lo
 *   deriva SIEMPRE el backend de la sesión: aquí no viaja ningún id de usuario.
 *
 *   🔴 TODO ESTO ES BEST-EFFORT EN LA PANTALLA. La marca «Nuevo» y los contadores informan; si el
 *   servicio falla (p. ej. sin la migración de lecturas aplicada responde 500), la lista de
 *   documentos y la bandeja se ven igual, solo que sin marcas. Por eso los llamadores capturan el
 *   error y no lo convierten en un aviso.
 *
 *   Contrato real del backend (Task 3b): `GET /documentos-lectura/no-leidos` devuelve un ARREGLO
 *   `{ eejeId, noLeidos }[]` y admite de 1 a 100 ids; `contar` lo trocea y lo convierte en mapa.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-11-04
 */
import httpClient from "../api/httpClient";
import type { ModuloExternoCodigo } from "../interfaces/IDocumentosExternos";

/** Un documento de otro módulo que el usuario aún no abrió. */
export interface IExternoNoLeido {
  modulo: ModuloExternoCodigo;
  docId: string;
}

/** Lo que el usuario de la sesión no ha abierto de UN EPAS. */
export interface INoLeidosDelEpas {
  eejeId: number;
  /** `doc_id` de los documentos PROPIOS (de Ejecución) sin abrir, ascendentes. */
  propios: number[];
  /** Documentos de otros módulos sin abrir; `[]` si el EPAS no tiene enlace a Core. */
  externos: IExternoNoLeido[];
  total: number;
}

/** Una fila del conteo, tal y como la manda el backend. */
interface IConteoNoLeidos {
  eejeId: number;
  noLeidos: number;
}

/** Tope de ids por petición de conteo: el mismo que valida el DTO del backend. */
export const MAX_EPAS_POR_CONTEO = 100;

export const DocumentosLecturaService = {
  /**
   * Qué documentos del EPAS no ha abierto el usuario de la sesión.
   *
   * @param eejeId eeje_id del EPAS.
   * @returns Propios (ids) y externos (módulo + docId) sin abrir.
   */
  async noLeidosDelEpas(eejeId: number): Promise<INoLeidosDelEpas> {
    const { data } = await httpClient.get<INoLeidosDelEpas>(
      `/documentos-lectura/epas/${eejeId}`,
    );
    return data;
  },

  /**
   * Cuántos documentos sin abrir tiene el usuario en cada EPAS pedido.
   *
   * Sin ids válidos no sale a la red. Los ids repetidos o que no son enteros positivos se descartan
   * (el backend respondería 400 a la petición entera), y los demás se piden de 100 en 100.
   *
   * @param eejeIds Los EPAS a contar.
   * @returns Mapa eejeId → número de no leídos (0 incluido para los que el backend devuelva).
   */
  async contar(eejeIds: number[]): Promise<Record<number, number>> {
    const ids = [
      ...new Set(eejeIds.filter((id) => Number.isSafeInteger(id) && id > 0)),
    ];
    if (ids.length === 0) return {};

    const trozos: number[][] = [];
    for (let i = 0; i < ids.length; i += MAX_EPAS_POR_CONTEO) {
      trozos.push(ids.slice(i, i + MAX_EPAS_POR_CONTEO));
    }

    const respuestas = await Promise.all(
      trozos.map((trozo) =>
        httpClient.get<IConteoNoLeidos[]>("/documentos-lectura/no-leidos", {
          params: { eejeIds: trozo.join(",") },
        }),
      ),
    );

    const mapa: Record<number, number> = {};
    for (const { data } of respuestas) {
      for (const fila of Array.isArray(data) ? data : []) {
        if (
          typeof fila?.eejeId === "number" &&
          typeof fila?.noLeidos === "number"
        ) {
          mapa[fila.eejeId] = fila.noLeidos;
        }
      }
    }
    return mapa;
  },

  /**
   * Marca como leído un documento PROPIO del EPAS. Idempotente (204).
   *
   * @param eejeId eeje_id del EPAS.
   * @param docId doc_id del documento de Ejecución.
   */
  async marcarPropio(eejeId: number, docId: number): Promise<void> {
    await httpClient.put(`/documentos-lectura/epas/${eejeId}/propios/${docId}`);
  },

  /**
   * Marca como leído un documento de OTRO módulo. Idempotente (204). El docId es texto opaco del
   * otro módulo: viaja codificado.
   *
   * @param eejeId eeje_id del EPAS.
   * @param modulo Código del módulo dueño del documento.
   * @param docId Identificador del documento en su módulo.
   */
  async marcarExterno(
    eejeId: number,
    modulo: ModuloExternoCodigo,
    docId: string,
  ): Promise<void> {
    await httpClient.put(
      `/documentos-lectura/epas/${eejeId}/externos/${modulo}/${encodeURIComponent(docId)}`,
    );
  },
};

export default DocumentosLecturaService;
