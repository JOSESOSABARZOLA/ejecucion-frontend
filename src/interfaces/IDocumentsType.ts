export interface IDocumentsType {
  tdocId: number;
  tdocType: string;
  tdocTypeName: string;
  subtypes: Subtype[];
}

export interface Subtype {
  tsdocId: number;
  tsdocSubtype: string;
  tsdocSubtypeName: string;
}
