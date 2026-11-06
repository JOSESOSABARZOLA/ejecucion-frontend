import type { Case } from "./ICase";
import type { IDocument } from "./IDocument";

export interface IInboxCases extends IDocument {
  casesRelated: Case[];
}

export interface InboxCasesResponse {
  data: IInboxCases[];
  total: number;
  limit: number;
  offset: number;
  page: number;
  pages: number;
}

export interface SendAssignmentResponse {
  moduleId:           number;
  assignedCasesCount: number;
  message:            string;
}

