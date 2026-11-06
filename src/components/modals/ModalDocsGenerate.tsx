/**
 * Microservicio: resolucion
 * Módulo: recepcion
 * Feature: Modal generar documentos
 * Archivo: ModalDocsGenerate.tsx
 * Responsabilidad: Orquestar formulario y confirmación de documentos por tipo/subtipo
 * Desarrollador: Johan Freire
 * Fecha: 2026-06-08
 * Modificado por: Andrés Miño — 2026-10-28 (quick 261028-kmg: el tipo de documento y el archivo que
 *   faltan se dicen bajo su campo, con el foco; el fallo al guardar, en el aviso flotante; ya no hay
 *   caja de resultado)
 */

import { mensajeParaUsuario } from "../../api/mensajeParaUsuario";
import React, { useEffect, useMemo, useRef, useState } from "react";
import type { Case } from "../../interfaces/ICase";
import {
  Field,
  Form,
  Formik,
  type FieldProps,
  type FormikHelpers,
} from "formik";
import { SelectInput, TextAreaInput } from "../forms/FormikField";
import FileUploader from "../forms/FilesInput";
import DocumentSubtypeFields from "../forms/DocumentSubtypeFields";
import ResolveSanctionFields from "../forms/ResolveSanctionFields";
import { useUser } from "../../context/UserContext";
import { useToast } from "../../hooks/useToast";
import type { UserActions } from "../../interfaces/IUser";
import type { IDocumentType } from "../../interfaces/IDocument";
import { documentValidationSchema } from "../../config/validationSchemas";
import { DocumentService } from "../../services/DocumentService";
import Alert from "../common/Alert";
import type { DocumentFormValues } from "../../config/validationSchemas";
import {
  buildDocumentCatalogs,
  getAllSubtypeFieldNames,
  getDocumentSubtypeConfig,
  getDocumentTypeConfig,
  getInitialDocumentFormValues,
  isDocumentSubtypeSlug,
  resolveSubtypeFromCatalog,
  type DocumentCatalogs,
  type SubtypeCatalogOption,
} from "../../config/documentGenerationConfig";
import { executeCreateDocument } from "../../utils/documentGeneration.util";
import Loading from "../common/Loading";
import Boton from "../common/Boton";
import { DeclararCierre, DeclararCierreFormik } from "./DeclararCierre";

export const MODAL_KEY = "docsGenerate" as const;

interface ModalDocsGenerateProps {
  caseData: Case;
  onClose: () => void;
  refetchFn?: () => Promise<void>;
}

/**
 * Función para resetear los campos dinámicos
 * @param setFieldValue - Función para establecer el valor de un campo
 */
const resetDynamicFields = (
  setFieldValue: (field: string, value: unknown) => void,
): void => {
  setFieldValue("tsdocId", undefined);
  setFieldValue("tsdocSubtype", "");
  for (const fieldName of getAllSubtypeFieldNames()) {
    setFieldValue(fieldName, undefined);
  }
};

/**
 * Función para aplicar los valores iniciales del subtipo
 * @param setFieldValue - Función para establecer el valor de un campo
 * @param tsdocSubtype - Subtipo del documento
 */
const applySubtypeInitialValues = (
  setFieldValue: (field: string, value: unknown) => void,
  tsdocSubtype: string,
): void => {
  if (!isDocumentSubtypeSlug(tsdocSubtype)) {
    return;
  }

  const config = getDocumentSubtypeConfig(tsdocSubtype);

  for (const [key, value] of Object.entries(config.initialValues)) {
    setFieldValue(key, value);
  }
};

/**
 * Componente para generar documentos
 * @param caseData - Datos del caso
 * @param onClose - Función para cerrar el modal
 * @param refetchFn - Función para refetchar los datos
 * @returns Componente para generar documentos
 */
const ModalDocsGenerate: React.FC<ModalDocsGenerateProps> = ({
  caseData,
  onClose,
  refetchFn,
}) => {
  const { user } = useUser();
  const { addToast } = useToast();
  const [isConfirmStep, setIsConfirmStep] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState<DocumentFormValues | null>(null);
  const [catalogs, setCatalogs] = useState<DocumentCatalogs | null>(null);
  /** Raíz del modal: para llevar el foco al campo que falta (regla de mensajes 261028-kmg). */
  const raizRef = useRef<HTMLDivElement>(null);
  /**
   * El último guardado falló: su motivo ya salió en el aviso flotante y «Sí, guardar» queda apagado
   * hasta volver al formulario (la conducta de antes, sin la caja).
   */
  const [falloGuardar, setFalloGuardar] = useState(false);

  const initialDocument = useMemo(() => getInitialDocumentFormValues(), []);

  // Extrae los documentos permitidos del usuario, proveniente de las actividades configuradas para ese usuario
  const permittedDocuments = useMemo(
    () =>
      user?.actividades
        .filter((act: UserActions) => act.actiContext === MODAL_KEY)
        .map((act: UserActions) => ({
          value: act.actiName,
          label: act.actiLabel,
        })) ?? [],
    [user],
  );

  useEffect(() => {
    const loadCatalogs = async () => {
      const types = await DocumentService.getDocumentTypes();
      setCatalogs(buildDocumentCatalogs(types));
    };

    void loadCatalogs();
  }, []);

  if (!user) {
    return null;
  }

  // Función para manejar el envío del formulario de generación de documentos al paso de confirmación
  const handleFormSubmit = (
    values: DocumentFormValues,
    {
      setSubmitting,
      setFieldError,
      setFieldTouched,
    }: FormikHelpers<DocumentFormValues>,
  ) => {
    try {
      // Errores de CAMPO: se dicen bajo el control (Formik los pinta con `touched && error`) y el
      // foco va al primero que falta.
      if (!values.tdocType || values.tdocType.trim() === "") {
        void setFieldTouched("tdocType", true, false);
        setFieldError("tdocType", "Debe seleccionar un tipo de documento");
        raizRef.current
          ?.querySelector<HTMLElement>('[name="tdocType"]')
          ?.focus();
        setSubmitting(false);
        return;
      }

      if (!values.file) {
        void setFieldTouched("file", true, false);
        setFieldError("file", "Debe adjuntar un archivo para continuar");
        raizRef.current
          ?.querySelector<HTMLElement>('input[type="file"]')
          ?.closest<HTMLElement>("[tabindex]")
          ?.focus();
        setSubmitting(false);
        return;
      }

      setFormData(values);
      setIsConfirmStep(true);
      setSubmitting(false);
    } catch (error) {
      addToast(
        "error",
        mensajeParaUsuario(
          error,
          "No se pudo procesar el formulario. Inténtelo de nuevo.",
        ),
      );
      setSubmitting(false);
    }
  };

  // Función para guardar el documento
  const handleSaveDocument = async () => {
    if (!formData) return;
    setIsSaving(true);
    const result = await executeCreateDocument(formData, [caseData.eresId]);
    console.log("result en handleSaveDocument", result);

    if (!result.ok) {
      addToast("error", result.message);
      setFalloGuardar(true);
      setIsSaving(false);
      return;
    }

    // Solo en caso de éxito, cerrar el modal y mostrar el toast
    onClose();
    addToast("success", "Documento guardado correctamente");
    setIsSaving(false);

    await refetchFn?.();
  };

  // Función para volver al formulario de generación de documentos desde el paso de confirmación
  const handleBackToForm = () => {
    setIsConfirmStep(false);
    setFormData(null);
    setFalloGuardar(false);
  };

  // LLamada a la función para obtener las filas de revisión del documento según el subtipo para el paso de confirmación
  const confirmReviewRows =
    formData &&
    catalogs &&
    formData.tsdocSubtype &&
    isDocumentSubtypeSlug(formData.tsdocSubtype)
      ? getDocumentSubtypeConfig(formData.tsdocSubtype).reviewRows(
          formData,
          catalogs,
        )
      : [];

  return (
    <div ref={raizRef} className="modal-box max-w-3xl w-11/12 relative p-0">
      <div className="w-full max-h-[90vh] overflow-y-auto">
        <div className="app-modules-modal-header">
          <div className="min-w-0">
            <p className="app-modules-modal-kicker">Recepción</p>

            <h2
              id="catalog-detail-modal-title"
              className="app-modules-modal-title"
            >
              Generar Documentos
            </h2>
          </div>

          <div className="app-modules-modal-meta">
            <div
              className="app-modules-stepper"
              aria-label={isConfirmStep ? "Paso 2 de 2" : "Paso 1 de 2"}
            >
              <div
                className={`app-modules-step ${
                  isConfirmStep ? "is-complete" : "is-active"
                }`}
              >
                <span className="app-modules-step-dot">
                  {isConfirmStep ? "✓" : "1"}
                </span>

                <span className="app-modules-step-label">
                  Adjuntar documentación
                </span>
              </div>

              <span
                aria-hidden="true"
                className={`app-modules-step-line ${
                  isConfirmStep ? "is-complete" : ""
                }`}
              />

              <div
                className={`app-modules-step ${
                  isConfirmStep ? "is-active" : "is-pending"
                }`}
              >
                <span className="app-modules-step-dot">2</span>

                <span className="app-modules-step-label">Confirmación</span>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="app-modules-modal-close"
              aria-label="Cerrar modal de expediente"
              disabled={isSaving}
            >
              ×
            </button>
          </div>
        </div>

        {!isConfirmStep ? (
          <div className="app-modules-modal-body">
            <div className="app-modules-modal-content">
              <Formik
                initialValues={initialDocument}
                validationSchema={documentValidationSchema}
                onSubmit={handleFormSubmit}
              >
                {({ isSubmitting, isValid, dirty, values, setFieldValue }) => {
                  const typeConfig = getDocumentTypeConfig(values.tdocType);

                  const subtypeOptions =
                    catalogs?.subtypeOptionsByType[
                      values.tdocType as IDocumentType
                    ] ?? [];

                  const subtypeConfig =
                    values.tsdocSubtype &&
                    isDocumentSubtypeSlug(values.tsdocSubtype)
                      ? getDocumentSubtypeConfig(values.tsdocSubtype)
                      : null;

                  const handleTdocTypeChange = (nextType: string) => {
                    setFieldValue("tdocType", nextType);
                    resetDynamicFields(setFieldValue);
                  };

                  const handleTsdocIdChange = (
                    tsdocId: number,
                    options: SubtypeCatalogOption[],
                  ) => {
                    resetDynamicFields(setFieldValue);

                    setFieldValue("tsdocId", tsdocId);
                    const slug = resolveSubtypeFromCatalog(tsdocId, options);
                    setFieldValue("tsdocSubtype", slug ?? "");

                    if (slug) {
                      applySubtypeInitialValues(setFieldValue, slug);
                    }
                  };

                  return (
                    <Form className="space-y-8">
                      <DeclararCierreFormik ocupado={isSaving} />
                      <div className="space-y-4 mt-1">
                        <Field name="tdocType">
                          {(props: FieldProps) => (
                            <SelectInput
                              {...props}
                              label="Tipo de Documento"
                              options={permittedDocuments}
                              required
                              onValueChange={handleTdocTypeChange}
                            />
                          )}
                        </Field>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <Field name="file">
                            {(props: FieldProps) => (
                              <FileUploader
                                field={props.field}
                                form={props.form}
                                error={props.meta.touched && props.meta.error}
                              />
                            )}
                          </Field>

                          <Field name="docObservacion">
                            {(props: FieldProps) => (
                              <TextAreaInput
                                {...props}
                                label="Observaciones"
                                placeholder="Ej: Observaciones sobre el documento"
                              />
                            )}
                          </Field>
                        </div>

                        {typeConfig && (
                          <div
                            className={`app-modules-conditional-section ${
                              typeConfig.tdocType === "provideProvidence"
                                ? "is-providence"
                                : "is-resolve"
                            }`}
                          >
                            <p>{typeConfig.sectionTitle}</p>

                            <div className="app-modules-conditional-section-stack">
                              <Field name="tsdocId">
                                {(props: FieldProps) => (
                                  <SelectInput
                                    {...props}
                                    label={typeConfig.subtypeSelectLabel}
                                    options={subtypeOptions}
                                    required
                                    onValueChange={(value) => {
                                      if (!value) {
                                        resetDynamicFields(setFieldValue);
                                        return;
                                      }

                                      handleTsdocIdChange(
                                        Number(value),
                                        subtypeOptions,
                                      );
                                    }}
                                  />
                                )}
                              </Field>
                            </div>

                            {subtypeConfig && (
                              <div className="app-modules-conditional-section-stack">
                                {subtypeConfig.tsdocSubtype === "sancion" ? (
                                  <ResolveSanctionFields />
                                ) : (
                                  <DocumentSubtypeFields
                                    fields={subtypeConfig.fields}
                                  />
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {dirty && !isValid && (
                        <Alert
                          variant="warning"
                          message="Por favor, completa todos los campos requeridos antes de continuar."
                        />
                      )}

                      <div className="app-modules-modal-actions">
                        <button
                          type="button"
                          onClick={onClose}
                          className="app-modules-modal-cancel btn"
                          disabled={isSubmitting || isSaving}
                        >
                          Cancelar
                        </button>

                        <button
                          type="submit"
                          className="app-modules-modal-submit btn"
                          disabled={!isValid || isSubmitting || isSaving}
                        >
                          Continuar
                        </button>
                      </div>
                    </Form>
                  );
                }}
              </Formik>
            </div>
          </div>
        ) : (
          <div className="app-modules-modal-body app-modules-modal-body-review">
            {/* En la confirmación el formulario ya se desmontó, pero lo escrito sigue vivo. */}
            <DeclararCierre hayCambios ocupado={isSaving} />

            <div className="app-modules-modal-content app-modules-modal-content-review">
              <div className="app-modules-review-card">
                <div className="app-modules-review-status">
                  <span
                    aria-hidden="true"
                    className="app-modules-review-status-icon"
                  >
                    ✓
                  </span>

                  <span className="app-modules-review-status-copy">
                    Listo para guardar
                  </span>
                </div>

                <p className="app-modules-review-copy">
                  Se guardará un nuevo documento en el expediente{" "}
                  {caseData.expNumber}
                </p>

                <div className="app-modules-review-list">
                  <div className="app-modules-review-row">
                    <span className="app-modules-review-row-label">
                      Tipo de Documento
                    </span>

                    <span className="app-modules-review-row-value">
                      {catalogs?.typeLabels[formData?.tdocType ?? "none"] ||
                        "-"}
                    </span>
                  </div>

                  <div className="app-modules-review-row">
                    <span className="app-modules-review-row-label">
                      Observaciones
                    </span>

                    <span className="app-modules-review-row-value">
                      {formData?.docObservacion || "Sin observaciones"}
                    </span>
                  </div>

                  <div className="app-modules-review-row">
                    <span className="app-modules-review-row-label">
                      Archivo
                    </span>

                    <span className="app-modules-review-row-value">
                      {formData?.file?.name || "-"}
                    </span>
                  </div>

                  <div className="app-modules-review-row">
                    <span className="app-modules-review-row-label">
                      Tamaño del archivo
                    </span>

                    <span className="app-modules-review-row-value">
                      {formData?.file
                        ? `${(formData.file.size / 1024).toFixed(2)} KB`
                        : "-"}
                    </span>
                  </div>

                  {confirmReviewRows.map((row) => (
                    <div
                      key={row.label}
                      className="app-modules-review-row"
                    >
                      <span className="app-modules-review-row-label">
                        {row.label}
                      </span>

                      <span className="app-modules-review-row-value">
                        {row.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="app-modules-modal-actions">
              <Boton
                deshabilitado={isSaving}
                estilos="app-modules-modal-secondary btn"
                texto="Volver"
                onClick={handleBackToForm}
              />
              {/* <button
                type="button"
                onClick={handleBackToForm}
                className="app-modules-modal-secondary btn"
                disabled={isSaving}
              >
                Volver
              </button> */}

              {/* <button
                type="button"
                onClick={handleSaveDocument}
                className="app-modules-modal-submit btn"
                disabled={isSaving || falloGuardar}
              >
                {isSaving ? "Guardando..." : "Sí, guardar"}
              </button> */}

              <Boton
                deshabilitado={isSaving || falloGuardar}
                estilos="app-modules-modal-submit btn"
                texto={isSaving ? "Guardando..." : "Sí, guardar"}
                onClick={handleSaveDocument}
              />
            </div>
          </div>
        )}
      </div>

      {isSaving && <Loading />}
    </div>
  );
};

export default ModalDocsGenerate;
