/**
 * Interface para casos extendidos (expedientes ampliados)
 * Utilizado en el modal de expedientes ampliados
 */
export interface ICaseExtended {
  expedientNumber: string;
  administradoName: string;
  administradoLastName: string;
  administradoIdentification: string;
  extensionDaysAdded: number;
  extensionNewDeadline: Date;
  extensionReason: string;
  extensionStatus: string;
}

/**
 * Respuesta paginada de expedientes ampliados
 */
export interface CaseExtendedResponse {
  data: ICaseExtended[];
  total: number;
  limit: number;
  offset: number;
  page: number;
  pages: number;
}
