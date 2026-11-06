/**
 * Microservicio: resolucion
 * Módulo: documentacion
 * Feature: Utilidades de generación de documentos
 * Archivo: documentGeneration.util.ts
 * Responsabilidad: Construir FormData y ejecutar upload según contrato del backend
 * Desarrollador: Johan Freire
 * Fecha: 2026-06-08
 */

import { mensajeParaUsuario } from "../api/mensajeParaUsuario";
import {
  getDocumentSubtypeConfig,
  isDocumentSubtypeSlug,
  type DocumentSubtypeDefinition,
} from "../config/documentGenerationConfig";
import type { DocumentFormValues } from "../config/validationSchemas";
import type {
  ICreateDocumentBase,
  IDocument,
  IDocumentType,
} from "../interfaces/IDocument";
import { DocumentService } from "../services/DocumentService";

export type CreateDocumentResult =
  | { ok: true; document: IDocument }
  | { ok: false; message: string };

export function buildUploadFormData(
  base: ICreateDocumentBase,
  values: DocumentFormValues,
  subtypeConfig: DocumentSubtypeDefinition,
): FormData {
  const formData = new FormData();

  formData.append("file", base.file);
  formData.append("tsdocId", String(base.tsdocId));

  for (const eresId of base.eresIds) {
    formData.append("eresIds[]", String(eresId));
  }

  if (base.docName) {
    formData.append("docName", base.docName);
  }

  if (base.docObservacion) {
    formData.append("docObservacion", base.docObservacion);
  }

  subtypeConfig.appendFormDataEntries(formData, values);

  return formData;
}

export function buildCreateDocumentBase(
  values: DocumentFormValues,
  eresIds: number[],
): ICreateDocumentBase | null {
  if (
    !values.file ||
    !values.tsdocId ||
    !values.tdocType ||
    !values.tsdocSubtype ||
    !isDocumentSubtypeSlug(values.tsdocSubtype)
  ) {
    return null;
  }

  return {
    file: values.file,
    tsdocId: Number(values.tsdocId),
    eresIds,
    tdocType: values.tdocType as IDocumentType,
    tsdocSubtype: values.tsdocSubtype,
    docName: values.docName || `Document_${Date.now()}`,
    docObservacion: values.docObservacion ?? null,
  };
}

export async function executeCreateDocument(
  values: DocumentFormValues,
  eresIds: number[],
): Promise<CreateDocumentResult> {
  const base = buildCreateDocumentBase(values, eresIds);

  if (!base) {
    return {
      ok: false,
      message: "Los datos del documento están incompletos.",
    };
  }

  try {
    const subtypeConfig = getDocumentSubtypeConfig(base.tsdocSubtype);
    const formData = buildUploadFormData(base, values, subtypeConfig);
    // console.log("formData", formData);
    const document = await DocumentService.createDocument(formData);

    return { ok: true, document };
  } catch (error) {
    console.error("Error creating document:", error);

    const message =
      mensajeParaUsuario(error, "Error al guardar el documento");

    return { ok: false, message };
  }
}
