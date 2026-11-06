/**
 * Microservicio: resolucion
 * Módulo: N/A
 * Feature: Modal del expediente
 * Archivo: ModalCase.tsx
 * Responsabilidad: Presentar toda la información que tenga un expediente con campos editables usando Formik
 * Desarrollador: Johan Freire
 * Fecha: 2026-04-06
 */

import { mensajeParaUsuario } from "../../api/mensajeParaUsuario";
import React, { useState, useEffect } from "react";
import { Formik, Form, Field } from "formik";
import { DeclararCierreFormik } from "./DeclararCierre";
import type { Case } from "../../interfaces/ICase";
import type { IDocument } from "../../interfaces/IDocument";
import {
  caseValidationSchema,
  type CaseFormValues,
} from "../../config/validationSchemas";
import {
  TextInput,
  NumberInput,
  EmailInput,
  PhoneInput,
  DateInput,
  SelectInput,
  // TextAreaInput,
  CheckboxInput,
} from "../forms/FormikField";
// import { CaseService } from "../../services/CaseService";
import { DocumentService } from "../../services/DocumentService";
import { PDFViewer } from "../pdf/PDFViewer";
// import { DocumentList } from "../pdf/DocumentList";
import { useModal } from "../../hooks/useModal";
import DocumentCards from "../documentation/DocumentsCards";

interface ModalCaseProps {
  caseData: Case;
  // isOpen: boolean;
  onClose: () => void;
  // onSave?: (updatedCase: Case) => void;
}

/**
 * Modal para visualizar y editar información de expediente
 * Utiliza Formik para manejo de estado y validación de formulario
 */
const ModalCase: React.FC<ModalCaseProps> = ({
  caseData,
  // isOpen,
  onClose,
  // onSave,
}) => {
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [selectedDocument, setSelectedDocument] = useState<IDocument | null>(
    null,
  );
  const [documents, setDocuments] = useState<IDocument[]>([]);
  const [loadingDocuments, setLoadingDocuments] = useState(false);
  const [activeTab, setActiveTab] = useState<"informacion" | "documentos">(
    "informacion",
  );

  const isConfirmStep = false;

  // Obtener funciones del contexto modal
  const { triggerSuccess, triggerError } = useModal();

  // Cargar documentos cuando el componente monta o cuando cambia caseData
  useEffect(() => {
    const loadDocuments = async () => {
      setLoadingDocuments(true);
      try {
        // Obtener documentos del servicio usando el ID del expediente
        const response = await DocumentService.getDocumentsByCase(
          caseData.eresId,
        );
        console.log("documentos del expediente", response);

        // Extraer el array de documentos de la respuesta
        setDocuments(response || []);
      } catch (error) {
        console.error("Error loading documents:", error);
        setDocuments([]);
      } finally {
        setLoadingDocuments(false);
      }
    };

    loadDocuments();
  }, [caseData]);

  // Opciones para los selects
  const statusOptions = [
    { value: "pendiente", label: "Pendiente" },
    { value: "resuelto", label: "Resuelto" },
    { value: "apelado", label: "Apelado" },
    { value: "archivado", label: "Archivado" },
  ];

  /**
   * Valores iniciales del formulario basados en los datos del expediente
   */
  const initialValues: CaseFormValues = {
    expNumber: caseData.expNumber || "",
    // caseResolveIdentification: caseData.eresResolveIdentification || "",
    eresStatus: caseData.eresStatus || "pendiente",
    // casePenalty: caseData.eresPenalty || 0,
    eresArticle: caseData.eresArticle || 0,
    eresFojas: caseData.eresFojas || 0,
    expZone: caseData.expZone || "",
    eresMedidaCautelar: caseData.eresMedidaCautelar || "",
    eresHasAppeal: caseData.eresHasAppeal || false,
    eresIsactive: caseData.eresIsactive || true,
    eresIncomeAt: caseData.eresIncomeAt
      ? new Date(caseData.eresIncomeAt)
      : new Date(),
    eresResolveAt: caseData.eresResolveAt
      ? new Date(caseData.eresResolveAt)
      : null,

    // Datos del administrado
    admiName: caseData.admiName || "",
    admiLastname: caseData.admiLastname || "",
    admiBusinessName: caseData.admiBusinessName || "",
    admiIdentification: caseData.admiIdentification || "",
    admiTelephone: caseData.admiTelephone || "",
    admiEmail: caseData.admiEmail || "",
    admiAddress: caseData.admiAddress || "",
    admiJudicialLocker: caseData.admiJudicialLocker || "",
  };

  /**
   * Manejador del envío del formulario
   * Envía los cambios al backend y maneja errores
   */
  const handleSubmit = async (values: CaseFormValues) => {
    setIsSaving(true);
    setSaveMessage(null);

    try {
      // Aquí debes crear un método en CaseService para actualizar el expediente
      // si no existe, descomenta y adapta el siguiente código:
      /*
      const response = await CaseService.updateCase(caseData.caseId, values);

      // Actualizar los datos locales
      const updatedCase: Case = {
        ...caseData,
        ...values,
      };
      */

      // Por ahora, simulamos la actualización
      console.log("Datos a guardar:", values);

      setSaveMessage({
        type: "success",
        text: "Expediente actualizado correctamente",
      });

      // Dispara el callback de éxito del contexto modal
      // Esto cerrará el modal automáticamente
      setTimeout(() => {
        triggerSuccess({
          message: "Expediente actualizado correctamente",
          updatedCase: values,
        });
      }, 1500);

      // Llamar callback si existe
      // if (onSave) {
      // const updatedCase: Case = {
      //   ...caseData,
      //   ...values,
      //   caseIncomeAt: values.caseIncomeAt as any,
      //   caseResolveAt: values.caseResolveAt as any,
      // };
      // onSave(updatedCase);
      // }
    } catch (error) {
      const errorMessage =
        mensajeParaUsuario(error, "Error al actualizar el expediente");

      setSaveMessage({
        type: "error",
        text: errorMessage,
      });

      // Dispara el callback de error del contexto modal
      // El modal permanece abierto
      triggerError({
        message: errorMessage,
        error: error,
      });
    } finally {
      setIsSaving(false);
    }
  };

  // if (!isOpen) return null;

  return (
    <div className="modal-box max-w-7xl w-11/12 relative p-0">
      {/* Formulario con Formik */}
      <div className="w-full max-h-[90vh] overflow-y-auto">
        {/* Encabezado del modal */}
        <div className="app-modules-modal-header">
          <div className="min-w-0">
            <p className="app-modules-modal-kicker">Recepción</p>
            <h2
              id="catalog-detail-modal-title"
              className="app-modules-modal-title"
            >
              {`Expediente # ${caseData.expNumber ?? "Sin numero"}`}
            </h2>
          </div>
          <div className="app-modules-modal-meta">
            {/* <div
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
                  Datos principales
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
                <span className="app-modules-step-label">Documentación</span>
              </div>
            </div> */}
            <button
              type="button"
              onClick={onClose}
              className="app-modules-modal-close"
              aria-label="Cerrar modal de expediente"
              disabled={false}
            >
              ×
            </button>
          </div>
        </div>

        {/* Tabs de Datos del expediente y documentacion */}
        <div className="app-modules-tabs-container border-b border-transparent">
          <div className="flex">
            <button
              type="button"
              onClick={() => setActiveTab("informacion")}
              className={`app-modules-tab-label ${
                activeTab === "informacion" ? "active" : ""
              }`}
            >
              Información del Expediente
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("documentos")}
              className={`app-modules-tab-label ${
                activeTab === "documentos" ? "active" : ""
              }`}
            >
              Documentacion
            </button>
          </div>

          {/* Content for Información del Expediente */}
          {activeTab === "informacion" && (
            <div className="app-modules-tab-content pt-0!">
              {/* <p className="page-heading-kicker text-sm font-semibold uppercase tracking-[0.18em] border-b pb-2">
                Información del Expediente
              </p> */}
              {/* <div className="mt-4 text-center py-8 text-gray-500">
                No hay información cargada para este expediente
              </div> */}
              <div className="app-modules-modal-body">
                <div className="app-modules-modal-content">
                  <Formik
                    className="w-full"
                    initialValues={initialValues}
                    validationSchema={caseValidationSchema}
                    onSubmit={handleSubmit}
                    enableReinitialize={true}
                  >
                    {({ isSubmitting, isValid, dirty }) => (
                      <Form className="space-y-8">
                        <DeclararCierreFormik ocupado={isSaving} />
                        {/* Mensajes de guardado */}
                        {saveMessage && (
                          <div
                            className={`alert alert-${
                              saveMessage.type === "success"
                                ? "success"
                                : "error"
                            }`}
                          >
                            <span>{saveMessage.text}</span>
                          </div>
                        )}

                        {/* Sección: Información del Administrado */}
                        <div className="space-y-4 mt-1">
                          {/* <h4 className="font-semibold text-base border-b pb-2">
                  Datos del Administrado
                </h4> */}

                          <p className="page-heading-kicker text-sm font-semibold uppercase tracking-[0.18em] border-b pb-2">
                            Datos del Administrado
                          </p>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Field name="administradoName">
                              {(props: any) => (
                                <TextInput
                                  {...props}
                                  label="Nombre"
                                  placeholder="Ej: Juan"
                                  required
                                />
                              )}
                            </Field>

                            <Field name="administradoLastName">
                              {(props: any) => (
                                <TextInput
                                  {...props}
                                  label="Apellido"
                                  placeholder="Ej: Pérez"
                                  required
                                />
                              )}
                            </Field>

                            <Field name="administradoBusinessName">
                              {(props: any) => (
                                <TextInput
                                  {...props}
                                  label="Razón Social (Opcional)"
                                  placeholder="Ej: Empresa XYZ S.A."
                                />
                              )}
                            </Field>

                            <Field name="administradoIdentification">
                              {(props: any) => (
                                <TextInput
                                  {...props}
                                  label="Cédula de Identidad"
                                  placeholder="Ej: 1234567890"
                                  required
                                />
                              )}
                            </Field>

                            <Field name="administradoTelephone">
                              {(props: any) => (
                                <PhoneInput
                                  {...props}
                                  label="Teléfono"
                                  placeholder="Ej: +34 912 345 678"
                                  required
                                />
                              )}
                            </Field>

                            <Field name="administradoEmail">
                              {(props: any) => (
                                <EmailInput
                                  {...props}
                                  label="Correo Electrónico"
                                  placeholder="Ej: juan@ejemplo.com"
                                  required
                                />
                              )}
                            </Field>

                            <Field name="administradoAddress">
                              {(props: any) => (
                                <TextInput
                                  {...props}
                                  label="Dirección"
                                  placeholder="Ej: Calle Principal 123, Apto 5"
                                  required
                                />
                              )}
                            </Field>

                            <Field name="administradoJudicialLocker">
                              {(props: any) => (
                                <TextInput
                                  {...props}
                                  label="Casilla Judicial (Opcional)"
                                  placeholder="Ej: Casilla 456"
                                />
                              )}
                            </Field>
                          </div>
                        </div>

                        {/* Sección: Información del Expediente */}
                        <div className="space-y-4 mt-4">
                          {/* <h4 className="font-semibold text-base border-b pb-2">
                  Información del Expediente
                </h4> */}
                          <p className="page-heading-kicker text-sm font-semibold uppercase tracking-[0.18em] border-b pb-2">
                            Información del Expediente
                          </p>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Field name="caseIdentification">
                              {(props: any) => (
                                <TextInput
                                  {...props}
                                  label="Número de Expediente"
                                  placeholder="Ej: EXP-2026-001"
                                  required
                                />
                              )}
                            </Field>

                            <Field name="caseResolveIdentification">
                              {(props: any) => (
                                <TextInput
                                  {...props}
                                  label="Número de Resolución"
                                  placeholder="Ej: RES-2026-001"
                                  required
                                />
                              )}
                            </Field>

                            <Field name="caseStatus">
                              {(props: any) => (
                                <SelectInput
                                  {...props}
                                  label="Estado del Expediente"
                                  options={statusOptions}
                                  required
                                />
                              )}
                            </Field>

                            <Field name="caseArticle">
                              {(props: any) => (
                                <NumberInput
                                  {...props}
                                  label="Artículo"
                                  placeholder="Ej: 123"
                                  required
                                />
                              )}
                            </Field>

                            <Field name="casePenalty">
                              {(props: any) => (
                                <NumberInput
                                  {...props}
                                  label="Monto de la Sanción"
                                  placeholder="Ej: 50000"
                                  required
                                />
                              )}
                            </Field>

                            <Field name="caseFojas">
                              {(props: any) => (
                                <NumberInput
                                  {...props}
                                  label="Número de Folios"
                                  placeholder="Ej: 15"
                                  required
                                />
                              )}
                            </Field>

                            <Field name="caseZone">
                              {(props: any) => (
                                <TextInput
                                  {...props}
                                  label="Zona"
                                  placeholder="Ej: Zona 3"
                                  required
                                />
                              )}
                            </Field>

                            <Field name="caseMedidaCautelar">
                              {(props: any) => (
                                <TextInput
                                  {...props}
                                  label="Medida Cautelar"
                                  placeholder="Opcional"
                                />
                              )}
                            </Field>

                            <Field name="caseIncomeAt">
                              {(props: any) => (
                                <DateInput
                                  {...props}
                                  label="Fecha de Ingreso"
                                  required
                                />
                              )}
                            </Field>

                            <Field name="caseResolveAt">
                              {(props: any) => (
                                <DateInput
                                  {...props}
                                  label="Fecha de Resolución"
                                />
                              )}
                            </Field>
                          </div>

                          {/* Estados boolean */}
                          <div className="flex gap-6 mt-4">
                            <Field name="caseHasAppeal">
                              {(props: any) => (
                                <CheckboxInput
                                  {...props}
                                  label="Tiene Apelación"
                                />
                              )}
                            </Field>

                            <Field name="caseIsActive">
                              {(props: any) => (
                                <CheckboxInput
                                  {...props}
                                  label="Expediente Activo"
                                />
                              )}
                            </Field>
                          </div>
                        </div>

                        <div>{`isValid: ${isValid}, dirty: ${dirty}`}</div>

                        {/* Botones de acción */}
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
                            disabled={isSubmitting}
                          >
                            Continuar
                          </button>
                        </div>
                        {/* <div className="modal-action border-t border-base-300 pt-6 flex justify-end gap-3">
                    <button
                      type="button"
                      className="btn btn-error"
                      onClick={onClose}
                      disabled={isSaving}
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={isSaving || !dirty}
                      title={!dirty ? "Realiza cambios para guardar" : ""}
                    >
                      {isSaving ? (
                        <>
                          <span className="loading loading-spinner loading-sm"></span>
                          Guardando...
                        </>
                      ) : (
                        "Guardar Cambios"
                      )}
                    </button>
                  </div> */}
                      </Form>
                    )}
                  </Formik>
                </div>
              </div>
            </div>
          )}

          {/* Content for Documentacion */}
          {activeTab === "documentos" && (
            <div className="app-modules-tab-content pt-0!">
              {/* <p className="page-heading-kicker text-sm font-semibold uppercase tracking-[0.18em] border-b pb-2">
                Documentacion
              </p> */}
              {/* <div className="mt-4 text-center py-8 text-gray-500">
                No hay documentación cargada para este expediente
              </div> */}
              <div className="space-y-4 mt-4">
                {/* Lista de documentos y visor PDF */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Columna izquierda: Lista de documentos */}
                  <div className="lg:col-span-1">
                    <DocumentCards
                      documents={documents}
                      selectedDocumentId={selectedDocument?.docId}
                      onSelectDocument={setSelectedDocument}
                      loading={loadingDocuments}
                    />
                    {/* <DocumentList
                      documents={documents}
                      selectedDocumentId={selectedDocument?.docId}
                      onSelectDocument={setSelectedDocument}
                      loading={loadingDocuments}
                    /> */}
                  </div>

                  {/* Columna derecha: Visor PDF */}
                  <div className="lg:col-span-2">
                    {selectedDocument ? (
                      <PDFViewer
                        document={selectedDocument}
                        loading={false}
                      />
                    ) : (
                      <div className="bg-gray-100 border border-gray-300 rounded p-12 text-center text-gray-500">
                        Selecciona un documento para visualizarlo
                      </div>
                    )}
                  </div>
                </div>

                {/* Sección original de DocumentCards - mantener para compatibilidad */}
                {/* Comentada por ahora, ya que usamos los nuevos componentes */}
                {/* <DocumentCards
                    onReorder={(reordenados) => {
                      // Aquí manejas la reordenación
                      console.log("Documentos reordenados:", reordenados);
                    }}
                  /> */}
              </div>
            </div>
          )}
        </div>

        {/* Pasos del modal para mejor presentacion de la información y evitar saturar al usuario con demasiados campos a la vez. */}
        {!isConfirmStep ? <div></div> : <div></div>}
      </div>
    </div>
  );
};

export default ModalCase;
