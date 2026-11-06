export interface DocumentResponse {
  data: IDocument[];
  total: number;
  limit: number;
  offset: number;
  page: number;
  pages: number;
}

// export interface Document {
//   file?: File;
//   docId?: number;
//   docType: string;
//   eresId: number;
//   docName?: string;
//   docSize: number;
//   docUploadedAt?: Date;
//   docUploadedBy?: string;
//   docIsActive?: boolean;
//   docUrl?: string;
//   docObservacion?: string | null;
//   // Campos condicionales para Providencia
//   providenceType?: number | null;
//   // Campos condicionales para Resolución
//   resolveType?: number | null;
//   sanctionAmount?: number | null;
//   article?: number | null;
//   ordinance?: number | null;
//   // Campos para notificación
//   notifyOfficials?: number[] | null;
// }

export interface IDocumentSubtype {
  tsdocId: number;
  tdocType: string;
  tdocTypeName: string;
  tsdocSubtypeName: string;
  tsdocSubtype: string;
}

/**
 * Un documento tal y como lo sirven los endpoints GENÉRICOS de documentación
 * (`/document-administration/*`). Es el espejo de `DocumentDto` del backend, y desde la Fase 03.19
 * también el de la lista blanca de columnas de su repositorio.
 *
 * ── 🔴 AQUÍ YA NO VAN `docStructure` NI `docHashSegurity` (C-1, Fase 03.19) ────────────────────
 * `doc_structure` guarda el HTML íntegro que el decisor redactó en la providencia. Se servía en
 * TODA lectura genérica de documentos, por un endpoint que solo exige estar autenticado, saltándose
 * los controles de rol y autoría que protegen el contenido redactado. El backend dejó de
 * seleccionar las dos columnas, así que estos dos campos NO llegan en la respuesta.
 *
 * Declararlos como obligatorios después de eso no era un detalle de tipos: era un tipo que MIENTE
 * sobre lo que hay en la red. Hoy no se rompe nada porque nadie los lee —solo se rellenaban con
 * valores inertes en fixtures—, pero el primero que se fíe de la declaración leerá `undefined`
 * donde el tipo le prometió un objeto, y lo hará sin que el compilador le avise.
 *
 * ⚠️ NO CONFUNDIR CON EL CONTENIDO REDACTADO QUE SÍ SE SIRVE. El cuerpo de una providencia se pide
 * por `GET /providencias/similares`, que valida rol y autoría y tiene su propio tipo
 * (`ProvidenciaSimilar.docStructure`, en `ProvidenciaService`). Ese camino es legítimo y no se toca:
 * sus lectores tipan contra él, no contra esta interfaz.
 */
export interface IDocument extends IDocumentSubtype {
  docId: number;
  docName: string;
  docSize: number;
  docUploadedAt: Date;
  docUploadedBy: number;
  docIsActive: boolean;
  docUrl: string;
  docIsLocked: boolean;
  docStatus: string | null;
  docVersion: number;
  docIsCurrent: boolean;
  docMetadata: Record<string, unknown>;
  docParentId: number;
  // docAssignmentMasterId?: number | null;
}

export interface IProvidenceDocument extends IDocument {
  providenceType: number | null;
}

export interface IResolveSanctionItem {
  ersaSanctionAmount?: number;
  ersaArticle?: number;
  ersaOrdinance?: number;
}

export interface IResolveSanctionData {
  ersaSanctions: IResolveSanctionItem[];
  ersaTotalSanctionAmount: number;
}

export interface IResolutionDocument extends IDocument {
  resolveType: number;
  ersaTotalSanctionAmount: number;
  ersaSanctions: IResolveSanctionItem[];
}

export interface ICreateProvidenceDocument extends IProvidenceDocument {
  notifyOfficials: number[];
}

export type IDocumentType =
  | "provideProvidence"
  | "provideResolve"
  | "provideNotification"
  | "provideMemorando";

export type ProvidenceSubtypeSlug =
  | "correctResolution"
  | "excuse"
  | "extensionTerm";

export type ResolveSubtypeSlug =
  | "sancion"
  | "nulidadParcial"
  | "nulidadTotal"
  | "caducidad"
  | "inexistenciaInfraccion"
  | "inexistenciaResponsabilidadInfraccion"
  | "prescripcion"
  | "exencionResponsabilidad";

export type DocumentSubtypeSlug = ProvidenceSubtypeSlug | ResolveSubtypeSlug;

export interface IExtensionTermFields {
  epexDaysAdded: number;
  epexNewDeadline: string;
  epexReason: string;
}

export interface DocumentSubtypeFieldsMap {
  correctResolution: Record<string, never>;
  excuse: Record<string, never>;
  extensionTerm: IExtensionTermFields;
  sancion: IResolveSanctionData;
  nulidadParcial: Record<string, never>;
  nulidadTotal: Record<string, never>;
  caducidad: Record<string, never>;
  inexistenciaInfraccion: Record<string, never>;
  inexistenciaResponsabilidadInfraccion: Record<string, never>;
  prescripcion: Record<string, never>;
  exencionResponsabilidad: Record<string, never>;
}

export interface ICreateDocumentBase {
  file: File;
  tsdocId: number;
  eresIds: number[];
  tdocType: IDocumentType;
  tsdocSubtype: DocumentSubtypeSlug;
  docName?: string;
  docObservacion?: string | null;
}

export type ICreateDocumentPayload<S extends DocumentSubtypeSlug> =
  ICreateDocumentBase & DocumentSubtypeFieldsMap[S];

export type StatusMemorandum =
  | "enviado"
  | "recibido"
  | "en revisión"
  | "en sorteo"
  | "sorteado"
  | "aprobado"
  | "rechazado";
