/**
 * Microservicio: ejecucion
 * Módulo: Sorteo / Asignación (DME)
 * Feature: Modal wizard de CAPTURA de los datos del acta D2 por el SECRETARIO — RECE-05 / FEND-03, Fase 3.5
 * Archivo: ModalActaDatos.tsx
 * Responsabilidad: Capturar los campos del acta D2 (paso form), revisarlos (paso confirm) y, al confirmar,
 *   PERSISTIRLOS vía SorteoService.actaDatos(amasId, decisorUserId, datos) y LUEGO aplicar la firma
 *   ORDEN-2 del secretario vía SorteoService.firmarLote(amasId, decisorUserId). Es la UX del secretario en
 *   su turno del sublote `(amasId, decisorUserId)` (Camino Y). Los campos NO se codifican aquí: se iteran
 *   desde el SLOT declarativo `actaFieldsRegistry` (rellenar PRO-GEJ-001 no toca este modal). Patrón
 *   parent-owns-error: el modal permanece abierto en fallo (aviso flotante; la clave rechazada, solo
 *   bajo su campo); solo se cierra + toast en
 *   éxito, y llama `refetchFn`. COPY HONESTO: el aviso de éxito dice si la firma digital se aplicó
 *   (`exitoFirmaActa`) y, con el firmador apagado, que el acta quedó SIN firma criptográfica — nunca
 *   promete una firma posterior. Si falla, distingue «los datos no se guardaron» de «los datos se
 *   guardaron pero el acta no se firmó». SEMÁNTICA DE BOTONES
 *   INVERTIDA: Cancelar en rojo/error, Enviar/Confirmar en azul/primary. El rol/actor NUNCA viajan en el
 *   body: el backend los deriva del JWT.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-07-24
 * Modificado por: Andrés Miño — 2026-10-26 (Fase 03.21, Plan 08: el campo de clave recibe el aviso
 *   del firmador apagado del acta y `sesionCentral`.)
 * Modificado por: Andrés Miño — 2026-10-27 (revisión 03.21, CR-03: la clave del secretario se borra
 *   tras cualquier intento —también si fallan los datos o la firma— y al volver al formulario.)
 * Modificado por: Andrés Miño — 2026-10-27 (revisión 03.21, WR-02: se retira la promesa de una firma
 *   «pendiente»; el éxito usa `exitoFirmaActa`; un fallo `APP-FIRMA-*` antepone la consecuencia del
 *   secretario con el estado E y el foco si fue la clave; y un fallo de la firma ya no dice que los
 *   datos no se guardaron cuando sí se guardaron.)
 * Modificado por: Andrés Miño — 2026-10-27 (revisión 03.21, WR-03: un fallo al refrescar la bandeja
 *   tras guardar y firmar ya no se pinta como fallo de la firma.)
 * Modificado por: Andrés Miño — 2026-10-28 (quick 261028-kmg: sin aviso en línea; los fallos van al
 *   aviso flotante y la clave rechazada, solo al estado E del campo, con un aviso informativo de que
 *   los datos sí quedaron guardados.)
 */
import { mensajeParaUsuario } from "../../api/mensajeParaUsuario";
import React, { useEffect, useRef, useState } from "react";
import {
  Field,
  Form,
  Formik,
  type FieldProps,
  type FormikHelpers,
} from "formik";
import { DeclararCierre, DeclararCierreFormik } from "./DeclararCierre";
import { TextInput, TextAreaInput } from "../forms/FormikField";
import Alert from "../common/Alert";
import Loading from "../common/Loading";
import { PDFViewer } from "../pdf/PDFViewer";
import { useToast } from "../../hooks/useToast";
import { SorteoService, type SorteoLote } from "../../services/SorteoService";
import type { IDocument } from "../../interfaces/IDocument";
import CampoClaveCertificado from "../sorteo/CampoClaveCertificado";
import { useClaveDeFirma } from "../../hooks/useClaveDeFirma";
import {
  ACTA_FIELDS,
  ACTA_INITIAL_VALUES,
  actaReviewRows,
  actaValidationSchema,
  toActaDatosPayload,
  type ActaFormValues,
} from "../../config/actaFieldsRegistry";
import {
  AVISO_LISTA_NO_ACTUALIZADA,
  AVISO_SIN_FIRMADOR,
  CONSECUENCIA_FALLO_FIRMA,
  ERROR_CLAVE_INCORRECTA,
  esClaveIncorrecta,
  esErrorDeFirma,
  exitoFirmaActa,
  mensajeDeFalloDeFirma,
} from "../../config/firmaCopy";

export const MODAL_KEY = "actaDatos" as const;

interface ModalActaDatosProps {
  caseData: SorteoLote;
  onClose: () => void;
  refetchFn?: () => Promise<void>;
}

const ModalActaDatos: React.FC<ModalActaDatosProps> = ({
  caseData,
  onClose,
  refetchFn,
}) => {
  const { addToast } = useToast();
  const { amasId, decisorUserId } = caseData;

  const [isConfirmStep, setIsConfirmStep] = useState(false);
  const [formValues, setFormValues] = useState<ActaFormValues>(
    ACTA_INITIAL_VALUES,
  );
  const [isSaving, setIsSaving] = useState(false);
  // Clave del certificado del secretario para la firma de ORDEN 2 (solo si el firmador está activo).
  const clave = useClaveDeFirma();
  const campoClaveRef = useRef<HTMLInputElement>(null);
  // Estado E: la última firma se rechazó por la clave (`APP-FIRMA-CLAVE-001`).
  const [errorClave, setErrorClave] = useState(false);

  // GUARDA: el par (amasId, decisorUserId) es obligatorio; sin decisor no se puede firmar el sublote.
  const parCompleto = decisorUserId != null;

  // Estado E: tras un rechazo de la clave, el foco vuelve al campo en cuanto el envío terminó (antes
  // está deshabilitado y no lo aceptaría).
  useEffect(() => {
    if (errorClave && !isSaving) {
      campoClaveRef.current?.focus();
    }
  }, [errorClave, isSaving]);

  // VISTA PREVIA del acta (borrador) para que el secretario firme viéndola. Carga por par; degrada con
  // aviso si aún no está disponible (generación best-effort). No bloquea la captura de datos.
  const [actaPreview, setActaPreview] = useState<{
    docName?: string;
    docUrl?: string;
  } | null>(null);
  const [actaPreviewError, setActaPreviewError] = useState(false);

  useEffect(() => {
    if (decisorUserId == null) return;
    let vivo = true;
    setActaPreviewError(false);
    SorteoService.actaDeLote(amasId, decisorUserId)
      .then((a) => {
        if (vivo)
          setActaPreview({
            docName: a?.docName ?? "Acta de Sorteo (D2)",
            docUrl: a?.docUrl,
          });
      })
      .catch(() => {
        if (vivo) setActaPreviewError(true);
      });
    return () => {
      vivo = false;
    };
  }, [amasId, decisorUserId]);

  // Paso 1 → 2: SOLO valida en cliente (Formik/Yup) y avanza; sin red.
  const handleFormSubmit = (
    values: ActaFormValues,
    { setSubmitting }: FormikHelpers<ActaFormValues>,
  ) => {
    setFormValues(values);
    setIsConfirmStep(true);
    setSubmitting(false);
  };

  const handleBackToForm = () => {
    setIsConfirmStep(false);
    setErrorClave(false);
    // El campo de la clave se desmonta al volver al formulario: la clave no se queda esperando.
    clave.limpiar();
  };

  /** Escribir en el campo es un intento nuevo: retira el estado E. */
  const editarClave = (valor: string) => {
    clave.setClave(valor);
    setErrorClave(false);
  };

  // Paso 2: PERSISTE los datos y LUEGO firma ORDEN-2 (secretario). El padre es dueño del error.
  const handleConfirm = async () => {
    setErrorClave(false);

    if (!parCompleto) {
      addToast(
        "error",
        "No se pudo identificar el decisor del sublote; no es posible firmar.",
      );
      return;
    }

    setIsSaving(true);
    // Son DOS llamadas: si falla la segunda, los datos YA quedaron guardados y el aviso no puede
    // decir lo contrario.
    let datosGuardados = false;
    try {
      await SorteoService.actaDatos(
        amasId,
        decisorUserId,
        toActaDatosPayload(formValues),
      );
      datosGuardados = true;
      const res = await SorteoService.firmarLote(
        amasId,
        decisorUserId,
        undefined,
        clave.claveParaEnviar,
      );

      // COPY HONESTO (UI-SPEC §10.7): dice si la firma digital se aplicó; con el firmador apagado, que
      // el acta quedó SIN firma criptográfica. Ya no se promete una firma «pendiente» (C6).
      addToast(
        "success",
        `Datos del acta guardados. ${exitoFirmaActa(res?.firmado === true, false)}`,
      );

      // Datos y firma YA quedaron: si lo que falla es refrescar la bandeja, no puede caer en el
      // `catch` de abajo, que diría que la firma no se completó.
      if (refetchFn) {
        try {
          await refetchFn();
        } catch {
          addToast("info", AVISO_LISTA_NO_ACTUALIZADA);
        }
      }
      onClose();
    } catch (error) {
      if (!datosGuardados) {
        addToast(
          "error",
          mensajeParaUsuario(
            error,
            "No se pudieron guardar los datos del acta y no se firmó. Intente más tarde.",
          ),
        );
      } else if (esClaveIncorrecta(error)) {
        // Estado E del campo (vacío, marcado, con el foco) y SOLO eso sobre la clave. Lo que el
        // campo no puede decir —que los datos sí quedaron guardados— va en un aviso informativo.
        setErrorClave(true);
        addToast(
          "info",
          "Los datos del acta quedaron guardados; el acta todavía no se firmó.",
        );
      } else if (esErrorDeFirma(error)) {
        // Los datos quedaron guardados; el acta no se firmó (D-10). Se dice primero lo que sí quedó,
        // luego la consecuencia del rol y la causa del servidor (UI-SPEC §10.1).
        addToast(
          "error",
          `Los datos del acta quedaron guardados. ${mensajeDeFalloDeFirma(
            CONSECUENCIA_FALLO_FIRMA.actaDecisorSecretario,
            error,
          )}`,
        );
      } else {
        addToast(
          "error",
          `Los datos del acta quedaron guardados, pero la firma no se completó. ${mensajeParaUsuario(
            error,
            "Intente firmar de nuevo más tarde.",
          )}`,
        );
      }
    } finally {
      // 🔴 La clave no sobrevive al intento, con éxito O con error (UI-SPEC §2.3 regla 2): si
      // `actaDatos` o `firmarLote` fallan, el campo queda vacío y para reintentar se escribe de nuevo.
      clave.limpiar();
      setIsSaving(false);
    }
  };

  const reviewRows = actaReviewRows(formValues);

  return (
    <div className="modal-box max-w-3xl w-11/12 relative p-0">
      <div className="w-full max-h-[90vh] overflow-y-auto">
        <div className="app-modules-modal-header">
          <div className="min-w-0">
            <p className="app-modules-modal-kicker">Sorteo — Acta D2</p>
            <h2 className="app-modules-modal-title">Datos del acta</h2>
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
                <span className="app-modules-step-label">Capturar datos</span>
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
              aria-label="Cerrar modal de datos del acta"
              disabled={isSaving}
            >
              ×
            </button>
          </div>
        </div>

        {!parCompleto && (
          <Alert
            variant="warning"
            message="Este sublote no tiene un decisor identificado; no es posible capturar ni firmar el acta."
          />
        )}

        {!isConfirmStep ? (
          <div className="app-modules-modal-body">
            <div className="app-modules-modal-content">
              <Formik
                initialValues={formValues}
                validationSchema={actaValidationSchema}
                onSubmit={handleFormSubmit}
                enableReinitialize
              >
                {({ isValid }) => (
                  <Form className="space-y-6">
                    <DeclararCierreFormik ocupado={isSaving} />
                    <p className="app-modules-review-copy text-sm">
                      Capture los datos del acta del sorteo. Al confirmar se
                      guardarán y usted firmará el acta (segunda firma de la
                      secuencia).
                    </p>

                    {/* Vista previa del acta que se está por firmar (revísela antes de capturar y firmar). */}
                    <div className="rounded-2xl border border-base-300 bg-base-200/40 p-2">
                      <p className="mb-2 px-1 text-xs font-bold uppercase tracking-[0.14em] text-primary/90">
                        Vista previa del acta
                      </p>
                      {actaPreviewError && (
                        <Alert
                          variant="info"
                          message="El acta aún no está disponible para vista previa; puede capturar y firmar de todas formas."
                        />
                      )}
                      {!actaPreviewError && actaPreview?.docUrl && (
                        <PDFViewer
                          document={
                            {
                              docName: actaPreview.docName,
                              docUrl: actaPreview.docUrl,
                            } as unknown as IDocument
                          }
                          loading={false}
                        />
                      )}
                      {!actaPreviewError && !actaPreview?.docUrl && (
                        <p className="px-1 text-sm text-base-content/70">
                          Cargando vista previa…
                        </p>
                      )}
                    </div>

                    <div className="space-y-4">
                      {ACTA_FIELDS.map((f) => (
                        <Field
                          key={f.name}
                          name={f.name}
                        >
                          {(props: FieldProps) =>
                            f.kind === "textarea" ? (
                              <TextAreaInput
                                {...props}
                                label={f.label}
                                placeholder={f.placeholder}
                                required={f.required}
                                disabled={isSaving}
                              />
                            ) : (
                              <TextInput
                                {...props}
                                label={f.label}
                                placeholder={f.placeholder}
                                required={f.required}
                                disabled={isSaving}
                              />
                            )
                          }
                        </Field>
                      ))}
                    </div>

                    <div className="app-modules-modal-actions">
                      <button
                        type="button"
                        onClick={onClose}
                        className="app-modules-modal-cancel btn btn-error"
                        disabled={isSaving}
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        className="app-modules-modal-submit btn btn-primary"
                        disabled={isSaving || !isValid || !parCompleto}
                      >
                        Continuar
                      </button>
                    </div>
                  </Form>
                )}
              </Formik>
            </div>
          </div>
        ) : (
          <div className="app-modules-modal-body app-modules-modal-body-review">
            {/* En la confirmación el formulario ya se desmontó, pero lo capturado sigue vivo. */}
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
                    Listo para guardar y firmar
                  </span>
                </div>

                <p className="app-modules-review-copy">
                  Se guardarán los datos del acta del sublote y usted aplicará la
                  segunda firma de la secuencia.
                </p>

                <div className="app-modules-review-list">
                  {reviewRows.map((row) => (
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

            {/* La clave solo se pide si el firmador está encendido (GET /sorteo/firma/modo). */}
            <div className="app-modules-modal-content">
              <CampoClaveCertificado
                requerida={clave.requerida}
                value={clave.clave}
                onChange={editarClave}
                disabled={isSaving}
                error={errorClave ? ERROR_CLAVE_INCORRECTA : undefined}
                inputRef={campoClaveRef}
                avisoSinFirmador={AVISO_SIN_FIRMADOR.acta}
                sesionCentral={clave.sesionCentral}
                cargando={clave.cargando}
                errorModo={clave.errorModo}
                onReintentarModo={clave.reintentarModo}
              />
            </div>

            <div className="app-modules-modal-actions">
              <button
                type="button"
                onClick={handleBackToForm}
                className="app-modules-modal-secondary btn"
                disabled={isSaving}
              >
                Volver
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                className="app-modules-modal-submit btn btn-primary"
                disabled={isSaving || !parCompleto || !clave.listaParaEnviar}
              >
                {isSaving ? "Guardando…" : "Guardar y firmar"}
              </button>
            </div>
          </div>
        )}
      </div>

      {isSaving && <Loading />}
    </div>
  );
};

export default ModalActaDatos;
