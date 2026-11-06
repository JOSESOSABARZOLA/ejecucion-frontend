/**
 * Microservicio: resolucion
 * Módulo: documentacion
 * Feature: Configuración de generación de documentos
 * Archivo: documentGenerationConfig.ts
 * Responsabilidad: Registry declarativo por tdocType y tsdocSubtype (campos, FormData, confirmación)
 * Desarrollador: Johan Freire
 * Fecha: 2026-06-08
 * Modificado por: Andrés Miño — 2026-11-05 (quick 261105-cvq — «Monto» y «Total de Sanción» de la
 *   confirmación con `formatearUsd`, «USD 2.300,00», en vez de «$2300»)
 */

import type { DocumentFormValues } from "./validationSchemas";
import { formatearUsd } from "../utils/importe.util";
import type {
  DocumentSubtypeSlug,
  IDocumentType,
} from "../interfaces/IDocument";

export type DocumentFieldKind = "number" | "text" | "textarea" | "date";

export interface DocumentFieldDefinition {
  name: keyof DocumentFormValues & string;
  formDataKey?: string;
  kind: DocumentFieldKind;
  label: string;
  placeholder?: string;
}

export interface DocumentReviewRow {
  label: string;
  value: string;
}

export interface SubtypeCatalogOption {
  value: number;
  label: string;
  tsdocSubtype: DocumentSubtypeSlug;
}

export interface DocumentCatalogs {
  subtypeOptionsByType: Partial<Record<IDocumentType, SubtypeCatalogOption[]>>;
  typeLabels: Record<string, string>;
}

export interface DocumentTypeDefinition {
  tdocType: IDocumentType;
  sectionTitle: string;
  subtypeSelectLabel: string;
  supportedSubtypes: DocumentSubtypeSlug[];
}

export interface DocumentSubtypeDefinition<
  S extends DocumentSubtypeSlug = DocumentSubtypeSlug,
> {
  tsdocSubtype: S;
  tdocType: "provideProvidence" | "provideResolve";
  fields: DocumentFieldDefinition[];
  initialValues: Partial<DocumentFormValues>;
  appendFormDataEntries: (
    formData: FormData,
    values: DocumentFormValues,
  ) => void;
  reviewRows: (
    values: DocumentFormValues,
    catalogs: DocumentCatalogs,
  ) => DocumentReviewRow[];
}

const appendFormDataField = (
  formData: FormData,
  key: string,
  value: unknown,
): void => {
  if (value === null || value === undefined || value === "") {
    return;
  }

  formData.append(key, String(value));
};

const findSubtypeLabel = (
  values: DocumentFormValues,
  catalogs: DocumentCatalogs,
): string => {
  const tdocType = values.tdocType as IDocumentType;
  const options = catalogs.subtypeOptionsByType[tdocType] ?? [];

  return (
    options.find((option) => option.value === values.tsdocId)?.label ?? "-"
  );
};

// Funcion que define un subtipo de documento, con los campos y valores iniciales
const defineDocumentSubtype = <S extends DocumentSubtypeSlug>(
  config: DocumentSubtypeDefinition<S>,
): DocumentSubtypeDefinition<S> => config;

// Funcion que crea un subtipo de documento stub, con los campos y valores iniciales
// Se usa para los subtipos que no tienen campos y valores iniciales
const createStubSubtype = (
  tsdocSubtype: DocumentSubtypeSlug,
  tdocType: "provideProvidence" | "provideResolve",
): DocumentSubtypeDefinition => ({
  tsdocSubtype,
  tdocType,
  fields: [],
  initialValues: {},
  appendFormDataEntries: () => undefined,
  reviewRows: (values, catalogs) => [
    {
      label:
        tdocType === "provideProvidence"
          ? "Tipo de Providencia"
          : "Tipo de Resolución",
      value: findSubtypeLabel(values, catalogs),
    },
  ],
});

export const DOCUMENT_TYPE_REGISTRY = {
  provideProvidence: {
    tdocType: "provideProvidence",
    sectionTitle: "Tipos de Providencia",
    subtypeSelectLabel: "Seleccione el tipo de providencia",
    supportedSubtypes: ["correctResolution", "excuse", "extensionTerm"],
  },
  provideResolve: {
    tdocType: "provideResolve",
    sectionTitle: "Detalles de la Resolución",
    subtypeSelectLabel: "Tipo de Resolución",
    supportedSubtypes: [
      "sancion",
      "nulidadParcial",
      "nulidadTotal",
      "caducidad",
      "inexistenciaInfraccion",
      "inexistenciaResponsabilidadInfraccion",
      "prescripcion",
      "exencionResponsabilidad",
    ],
  },
} as const satisfies Partial<Record<IDocumentType, DocumentTypeDefinition>>;

// const functionToCalculateNewDeadline = (daysAdded: number): Date => {
//   const today = new Date();
//   const newDeadline = new Date(today);
//   newDeadline.setDate(today.getDate() + daysAdded);
//   return newDeadline;
// };

export const DOCUMENT_SUBTYPE_REGISTRY = {
  correctResolution: createStubSubtype(
    "correctResolution",
    "provideProvidence",
  ),
  excuse: createStubSubtype("excuse", "provideProvidence"),
  extensionTerm: defineDocumentSubtype({
    tsdocSubtype: "extensionTerm",
    tdocType: "provideProvidence",
    fields: [
      {
        name: "epexReason",
        kind: "textarea",
        label: "Motivo",
        placeholder: "Ej: Próximo a caducar",
      },
    ],
    initialValues: {
      epexReason: "",
    },
    appendFormDataEntries: (formData, values) => {
      appendFormDataField(formData, "epexReason", values.epexReason);
    },
    reviewRows: (values, catalogs) => [
      {
        label: "Tipo de Providencia",
        value: findSubtypeLabel(values, catalogs),
      },
      {
        label: "Motivo",
        value: values.epexReason || "-",
      },
    ],
  }),
  sancion: defineDocumentSubtype({
    tsdocSubtype: "sancion",
    tdocType: "provideResolve",
    fields: [],
    initialValues: {
      ersaSanctions: [
        {
          ersaSanctionAmount: undefined,
          ersaArticle: undefined,
          ersaOrdinance: undefined,
        },
      ],
      ersaTotalSanctionAmount: 0,
    },
    appendFormDataEntries: (formData, values) => {
      appendFormDataField(
        formData,
        "ersaTotalSanctionAmount",
        values.ersaTotalSanctionAmount,
      );

      if (values.ersaSanctions?.length) {
        formData.append("ersaSanctions", JSON.stringify(values.ersaSanctions));
      }
      formData.append("docStatus", "aprobado");
    },
    // quick 261105-cvq: los importes con el formateador único. Su consumidor (`ModalDocsGenerate`)
    // no está montado hoy en ninguna pantalla: es un arreglo de texto, sin más.
    reviewRows: (values, catalogs) => {
      const sanctions = values.ersaSanctions ?? [];
      const sanctionRows = sanctions.map((item, index) => ({
        label: `Sanción ${index + 1}`,
        value: `Monto: ${formatearUsd(Number(item.ersaSanctionAmount ?? 0))} | Art. ${item.ersaArticle ?? "-"} | Ord. ${item.ersaOrdinance ?? "-"}`,
      }));

      return [
        {
          label: "Tipo de Resolución",
          value: findSubtypeLabel(values, catalogs),
        },
        ...sanctionRows,
        {
          label: "Total de Sanción",
          value: values.ersaTotalSanctionAmount
            ? formatearUsd(Number(values.ersaTotalSanctionAmount))
            : "-",
        },
      ];
    },
  }),
  nulidadParcial: createStubSubtype("nulidadParcial", "provideResolve"),
  nulidadTotal: createStubSubtype("nulidadTotal", "provideResolve"),
  caducidad: createStubSubtype("caducidad", "provideResolve"),
  inexistenciaInfraccion: createStubSubtype(
    "inexistenciaInfraccion",
    "provideResolve",
  ),
  inexistenciaResponsabilidadInfraccion: createStubSubtype(
    "inexistenciaResponsabilidadInfraccion",
    "provideResolve",
  ),
  prescripcion: createStubSubtype("prescripcion", "provideResolve"),
  exencionResponsabilidad: createStubSubtype(
    "exencionResponsabilidad",
    "provideResolve",
  ),
} as const satisfies Record<DocumentSubtypeSlug, DocumentSubtypeDefinition>;

// Funcion que verifica si un subtipo de documento es valido
export const isDocumentSubtypeSlug = (
  value: string,
): value is DocumentSubtypeSlug => value in DOCUMENT_SUBTYPE_REGISTRY;

// Funcion que obtiene la configuracion de un tipo de documento
export const getDocumentTypeConfig = (
  tdocType: string,
): DocumentTypeDefinition | null =>
  tdocType in DOCUMENT_TYPE_REGISTRY
    ? DOCUMENT_TYPE_REGISTRY[tdocType as keyof typeof DOCUMENT_TYPE_REGISTRY]
    : null;

// Funcion que obtiene la configuracion de un subtipo de documento
export const getDocumentSubtypeConfig = (
  tsdocSubtype: DocumentSubtypeSlug,
): DocumentSubtypeDefinition => DOCUMENT_SUBTYPE_REGISTRY[tsdocSubtype];

// Funcion que resuelve el subtipo de documento desde el catalogo basado en el id
export const resolveSubtypeFromCatalog = (
  tsdocId: number,
  options: SubtypeCatalogOption[],
): DocumentSubtypeSlug | null => {
  const match = options.find((option) => option.value === tsdocId);
  return match?.tsdocSubtype ?? null;
};

// Funcion que obtiene todos los nombres de los campos de los subtipos de documento
export const getAllSubtypeFieldNames = (): (keyof DocumentFormValues)[] => {
  const names = new Set<keyof DocumentFormValues>();

  for (const config of Object.values(DOCUMENT_SUBTYPE_REGISTRY)) {
    for (const field of config.fields) {
      names.add(field.name);
    }

    for (const key of Object.keys(config.initialValues)) {
      names.add(key as keyof DocumentFormValues);
    }
  }

  return [...names];
};

// Funcion que obtiene los valores iniciales del formulario de documentos
export const getInitialDocumentFormValues = (): DocumentFormValues => ({
  file: undefined,
  docName: "",
  tdocType: "",
  tsdocId: undefined,
  tsdocSubtype: "",
  docObservacion: "",
  docSize: 0,
  docUploadedAt: undefined,
  docUploadedBy: undefined,
  docUrl: undefined,
  // epexDaysAdded: undefined,
  // epexNewDeadline: "",
  epexReason: "",
  ersaSanctions: undefined,
  ersaTotalSanctionAmount: undefined,
});

// Funcion que construye los catalogos de documentos
export const buildDocumentCatalogs = (
  apiTypes: Array<{
    tdocType: string;
    tdocTypeName: string;
    subtypes: Array<{
      tsdocId: number;
      tsdocSubtype: string;
      tsdocSubtypeName: string;
    }>;
  }>,
): DocumentCatalogs => {
  const subtypeOptionsByType: Partial<
    Record<IDocumentType, SubtypeCatalogOption[]>
  > = {};
  const typeLabels: Record<string, string> = { none: "Desconocido" };

  for (const docType of apiTypes) {
    typeLabels[docType.tdocType] = docType.tdocTypeName;

    const typeConfig = getDocumentTypeConfig(docType.tdocType);
    if (!typeConfig) {
      continue;
    }

    subtypeOptionsByType[docType.tdocType as IDocumentType] = docType.subtypes
      .filter(
        (subtype) =>
          isDocumentSubtypeSlug(subtype.tsdocSubtype) &&
          typeConfig.supportedSubtypes.includes(subtype.tsdocSubtype),
      )
      .map((subtype) => ({
        value: subtype.tsdocId,
        label: subtype.tsdocSubtypeName,
        tsdocSubtype: subtype.tsdocSubtype as DocumentSubtypeSlug,
      }));
  }

  return { subtypeOptionsByType, typeLabels };
};
