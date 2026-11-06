/**
 * Microservicio: resolucion
 * Módulo: N/A
 * Feature: Servicio para la gestión de documentos
 * Archivo: DocumentService.ts
 * Responsabilidad: Realizar operaciones de documentos del expediente
 * Desarrollador: Johan Freire
 * Fecha: 2026-04-29
 */
import httpClient from "../api/httpClient";
import { ErrorParaUsuario } from "../api/mensajeParaUsuario";
import type { IDocument, DocumentResponse } from "../interfaces/IDocument";
import type { IDocumentsType } from "../interfaces/IDocumentsType";

export const DocumentService = {
  /**
   * Obtiene todos los documentos con paginación y filtros
   * @param pageIndex Índice de la página
   * @param pageSize Cantidad de registros por página
   * @param filterParams Parámetros de filtro (docType, eresId, etc.)
   * @returns Lista de documentos paginada
   */
  async getDocuments(
    pageIndex: number,
    pageSize: number,
    filterParams: Record<string, unknown>,
  ): Promise<DocumentResponse> {
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

    const { data } = await httpClient.get<DocumentResponse>(
      `/document-administration?${params.toString()}`,
    );
    return data;
  },

  /**
   * Obtiene todos los documentos de un expediente
   * @param caseId ID del expediente (eresId)
   * @returns Lista de documentos
   */
  async getDocumentsByCase(caseId: number): Promise<IDocument[]> {
    const { data } = await httpClient.get<IDocument[]>(
      `/document-administration/case/${caseId}`,
    );
    return data;
  },

  /**
   * Obtiene los tipos de documentos disponibles en el sistema
   * @returns Lista de tipos de documentos con sus subtipos
   */
  async getDocumentTypes(): Promise<IDocumentsType[]> {
    const { data } = await httpClient.get<IDocumentsType[]>(
      `/document-administration/documents-types`,
    );
    return data;
  },

  /**
   * Guarda un nuevo documento para uno o más expedientes
   * @param formData FormData con file, tsdocId, eresIds[] y campos opcionales del subtipo
   * @returns Documento creado
   */
  async createDocument(formData: FormData): Promise<IDocument> {
    const { data } = await httpClient.post<IDocument>(
      "/document-administration/upload",
      formData,
      {
        headers: { "Content-Type": "multipart/form-data" },
      },
    );

    if (!data) {
      throw new ErrorParaUsuario("No se pudo guardar el documento.");
    }

    return data;
  },

  /**
   * Actualiza un documento existente
   * @param docId ID del documento
   * @param document Datos actualizados del documento
   * @returns Documento actualizado
   */
  async updateDocument(
    docId: number,
    document: Partial<IDocument>,
  ): Promise<IDocument> {
    const { data } = await httpClient.patch<IDocument>(
      `/document-administration/${docId}`,
      document,
    );

    if (!data) {
      throw new ErrorParaUsuario("No se pudo actualizar el documento.");
    }

    return data;
  },

  /**
   * Elimina un documento
   * @param docId ID del documento a eliminar
   */
  async deleteDocument(docId: number): Promise<void> {
    await httpClient.delete(`/document-administration/${docId}`);
  },
};
