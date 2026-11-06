/**
 * Microservicio: ejecucion
 * Módulo: Sorteo / Asignación (DME)
 * Feature: Modal de FIRMA del acta D2 con VISTA PREVIA — RECE-05 / FEND-03, Fase 3.5
 * Archivo: ModalFirmaActa.tsx
 * Responsabilidad: Mostrar el acta de sorteo (D2) como vista previa (PDFViewer) y firmarla EN EL MISMO
 *   modal. Es el acto de firma del DECISOR (orden-1) y del DIRECTOR (orden-3) sobre el sublote
 *   `(amasId, decisorUserId)` (Camino Y): la firma es la MISMA llamada `SorteoService.firmarLote`; el
 *   backend deriva el ORDEN del rol del JWT (el rol/actor NUNCA viajan en el body). El acta se carga por
 *   par con `actaDeLote`; si la vista previa no carga se avisa y el botón NO se apaga: quien decide si
 *   el acta se puede firmar es el servidor. En fallo el modal queda abierto: la clave rechazada se dice
 *   solo bajo el campo (estado E, con el foco) y cualquier otro fallo en el aviso flotante; solo en
 *   éxito hace toast + refetchFn + onClose. COPY HONESTO: el aviso de éxito dice
 *   si la firma digital se aplicó (`firmado`) y, con el firmador apagado, que el acta quedó SIN firma
 *   criptográfica — nunca promete una firma posterior.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-07-27
 * Modificado por: Andrés Miño — 2026-10-26 (Fase 03.21, Plan 08: el campo de clave recibe el aviso
 *   del firmador apagado del acta y `sesionCentral`.)
 * Modificado por: Andrés Miño — 2026-10-26 (Fase 03.21, Plan 15 — D-10/D-11/D-16, C5/C6: la clave
 *   se borra al terminar el envío también tras un error; un fallo `APP-FIRMA-*` antepone la
 *   consecuencia del rol (el director: el lote tampoco se aprobó) y la clave incorrecta activa el
 *   estado E con el foco; los avisos de éxito son los de UI-SPEC §10.7 y se retira la promesa de una
 *   firma «pendiente»; con el firmador encendido, la vista previa fallida avisa con §10.8.)
 * Modificado por: Andrés Miño — 2026-10-27 (revisión 03.21, WR-03: un fallo al refrescar la bandeja
 *   tras una firma aplicada ya no se pinta como fallo de firma.)
 * Modificado por: Andrés Miño — 2026-10-27 (revisión 03.21, WR-04: el aspa se apaga con la firma en
 *   vuelo, como «Cancelar», el fondo y Escape.)
 * Modificado por: Andrés Miño — 2026-10-28 (quick 261028-kmg: sin aviso en línea; la clave rechazada
 *   solo en el estado E del campo y el resto de fallos en el aviso flotante.)
 */
import { mensajeParaUsuario } from "../../api/mensajeParaUsuario";
import React, { useEffect, useRef, useState } from "react";
import { useCierreModal } from "../../hooks/useCierreModal";
import Alert from "../common/Alert";
import Loading from "../common/Loading";
import Boton from "../common/Boton";
import { PDFViewer } from "../pdf/PDFViewer";
import { useToast } from "../../hooks/useToast";
import { useUser } from "../../context/UserContext";
import { SorteoService } from "../../services/SorteoService";
import type { IDocument } from "../../interfaces/IDocument";
import CampoClaveCertificado from "../sorteo/CampoClaveCertificado";
import { useClaveDeFirma } from "../../hooks/useClaveDeFirma";
import {
  AVISO_ACTA_SIN_VISTA_PREVIA,
  AVISO_LISTA_NO_ACTUALIZADA,
  AVISO_SIN_FIRMADOR,
  CONSECUENCIA_FALLO_FIRMA,
  ERROR_CLAVE_INCORRECTA,
  esClaveIncorrecta,
  esErrorDeFirma,
  exitoFirmaActa,
  mensajeDeFalloDeFirma,
} from "../../config/firmaCopy";

export const MODAL_KEY = "firmaActa" as const;

/** Datos con los que se abre el modal: el par del sublote a firmar. */
interface FirmaActaData {
  amasId: number;
  decisorUserId?: number;
}

interface ModalFirmaActaProps {
  caseData: FirmaActaData;
  onClose: () => void;
  refetchFn?: () => Promise<void>;
}

/** ¿Firma el director (orden 3)? Su firma es además la aprobación del lote en Asignaciones. */
const esRolDirector = (rolName: string): boolean =>
  (rolName ?? "").trim().toLowerCase() === "director";

// Copy por rol del FIRMANTE (el backend deriva el orden real del JWT; esto solo es UX).
const firmaCopyPorRol = (
  rolName: string,
): { titulo: string; boton: string; botonLoading: string } => {
  const r = (rolName ?? "").trim().toLowerCase();
  if (esRolDirector(rolName)) {
    return {
      titulo: "Aprobar y firmar el acta (director)",
      boton: "Sí, aprobar y firmar",
      botonLoading: "Firmando…",
    };
  }
  if (r === "secretario abogado") {
    return {
      titulo: "Firmar el acta (secretario)",
      boton: "Sí, firmar",
      botonLoading: "Firmando…",
    };
  }
  return {
    titulo: "Firmar el acta (decisor)",
    boton: "Sí, firmar",
    botonLoading: "Firmando…",
  };
};

const ModalFirmaActa: React.FC<ModalFirmaActaProps> = ({
  caseData,
  onClose,
  refetchFn,
}) => {
  const { addToast } = useToast();
  const { user } = useUser();
  const { amasId, decisorUserId } = caseData;

  const [acta, setActa] = useState<{ docName?: string; docUrl?: string } | null>(
    null,
  );
  const [actaLoading, setActaLoading] = useState(true);
  const [actaError, setActaError] = useState(false);
  const [isSigning, setIsSigning] = useState(false);
  // Clave del certificado: se pide SOLO si el firmador está encendido; si no, ni se dibuja el campo.
  const clave = useClaveDeFirma();
  const campoClaveRef = useRef<HTMLInputElement>(null);
  // Estado E: la última firma se rechazó por la clave (`APP-FIRMA-CLAVE-001`). Es lo ÚNICO que se
  // dice de ese rechazo (regla de mensajes 261028-kmg): ni caja ni aviso flotante.
  const [errorClave, setErrorClave] = useState(false);

  // Cierre al pulsar fuera (quick 261019-mcf): la clave no es trabajo que perder (se descarta al
  // firmar de todos modos); lo que se protege es la firma en curso.
  useCierreModal({ ocupado: isSigning });

  // GUARDA: la firma se sella por el par (amasId, decisorUserId). Sin decisor resuelto no se puede firmar
  // (evita PATCH /sorteo/:amasId/undefined/firmar).
  const parCompleto = decisorUserId != null;
  const copy = firmaCopyPorRol(user?.rolName ?? "");
  const esDirector = esRolDirector(user?.rolName ?? "");

  // Estado E: tras un rechazo de la clave, el foco vuelve al campo en cuanto el envío terminó (antes
  // está deshabilitado y no lo aceptaría).
  useEffect(() => {
    if (errorClave && !isSigning) {
      campoClaveRef.current?.focus();
    }
  }, [errorClave, isSigning]);

  // Carga la vista previa del acta por par (borrador o definitiva, lo que exista a este momento).
  useEffect(() => {
    if (!parCompleto) {
      setActaLoading(false);
      setActaError(true);
      return;
    }
    let vivo = true;
    setActaLoading(true);
    setActaError(false);
    SorteoService.actaDeLote(amasId, decisorUserId as number)
      .then((a) => {
        if (vivo)
          setActa({
            docName: a?.docName ?? "Acta de Sorteo (D2)",
            docUrl: a?.docUrl,
          });
      })
      .catch(() => {
        if (vivo) setActaError(true);
      })
      .finally(() => {
        if (vivo) setActaLoading(false);
      });
    return () => {
      vivo = false;
    };
  }, [amasId, decisorUserId, parCompleto]);

  /** Escribir en el campo retira el estado E. */
  const editarClave = (valor: string) => {
    clave.setClave(valor);
    setErrorClave(false);
  };

  const handleFirmar = async () => {
    setErrorClave(false);
    if (!parCompleto) {
      addToast(
        "error",
        "No se pudo identificar el decisor del sublote; no es posible firmar.",
      );
      return;
    }
    setIsSigning(true);
    try {
      const res = await SorteoService.firmarLote(
        amasId,
        decisorUserId as number,
        undefined,
        clave.claveParaEnviar,
      );
      addToast("success", exitoFirmaActa(res?.firmado === true, esDirector));
      // La firma YA se aplicó: si lo que falla es refrescar la bandeja, no es un fallo de firma y no
      // puede caer en el `catch` de abajo (empujaría a firmar —o aprobar— otra vez).
      if (refetchFn) {
        try {
          await refetchFn();
        } catch {
          addToast("info", AVISO_LISTA_NO_ACTUALIZADA);
        }
      }
      onClose();
    } catch (err) {
      if (esClaveIncorrecta(err)) {
        // Estado E: el campo vuelve vacío, marcado, con su línea y con el foco. Nada más.
        setErrorClave(true);
      } else if (esErrorDeFirma(err)) {
        // Todo o nada (D-10): ni el acta se firmó ni, en el director, el lote se aprobó. La frase de
        // su rol va delante del texto del servidor (UI-SPEC §10.1), en el aviso flotante.
        addToast(
          "error",
          mensajeDeFalloDeFirma(
            esDirector
              ? CONSECUENCIA_FALLO_FIRMA.actaDirector
              : CONSECUENCIA_FALLO_FIRMA.actaDecisorSecretario,
            err,
          ),
        );
      } else {
        addToast(
          "error",
          mensajeParaUsuario(err, "No se pudo firmar el acta. Intente más tarde."),
        );
      }
    } finally {
      // La clave no sobrevive al intento, con éxito O con error (UI-SPEC §2.3 regla 2, C5): tras un
      // fallo el campo siempre está vacío y para reintentar se escribe de nuevo.
      clave.limpiar();
      setIsSigning(false);
    }
  };

  return (
    <div className="modal-box max-w-5xl w-11/12 relative p-0">
      <div className="w-full max-h-[90vh] overflow-y-auto">
        <div className="app-modules-modal-header">
          <div className="min-w-0">
            <p className="app-modules-modal-kicker">Ejecución — DME</p>
            <h2 className="app-modules-modal-title">{copy.titulo}</h2>
          </div>
          <div className="app-modules-modal-meta">
            <button
              type="button"
              className="app-modules-modal-close"
              onClick={onClose}
              aria-label="Cerrar modal de firma"
              // Como «Cancelar», el fondo y Escape: con la firma en vuelo no se cierra. Cerrar a mitad
              // desmontaría el modal y el resultado —p. ej. que el lote NO se aprobó— no se vería.
              disabled={isSigning}
            >
              ×
            </button>
          </div>
        </div>

        <div className="app-modules-modal-body">
          <div className="app-modules-modal-content flex flex-col gap-3">
            {/* Vista previa del acta */}
            {actaLoading && <Loading />}
            {/* Con el firmador encendido ya no se firma sin acta (DOCUMENTO_NO_FIRMABLE), así que no se
                promete que «aún puede firmar» (§10.8). El botón no se apaga: decide el servidor. */}
            {!actaLoading && actaError && (
              <Alert
                variant="warning"
                message={
                  clave.requerida
                    ? AVISO_ACTA_SIN_VISTA_PREVIA
                    : "El acta todavía no está disponible para vista previa. Aún puede firmar; el acta se generará/actualizará en breve."
                }
              />
            )}
            {!actaLoading && !actaError && acta?.docUrl && (
              <PDFViewer
                document={
                  {
                    docName: acta.docName,
                    docUrl: acta.docUrl,
                  } as unknown as IDocument
                }
                loading={false}
              />
            )}
            {!actaLoading && !actaError && !acta?.docUrl && (
              <Alert
                variant="info"
                message="No hay un PDF de acta para mostrar; puede firmar de todas formas."
              />
            )}

            {/* La clave solo aparece si el firmador está encendido (GET /sorteo/firma/modo). */}
            <CampoClaveCertificado
              requerida={clave.requerida}
              value={clave.clave}
              onChange={editarClave}
              disabled={isSigning}
              error={errorClave ? ERROR_CLAVE_INCORRECTA : undefined}
              inputRef={campoClaveRef}
              avisoSinFirmador={AVISO_SIN_FIRMADOR.acta}
              sesionCentral={clave.sesionCentral}
              cargando={clave.cargando}
              errorModo={clave.errorModo}
              onReintentarModo={clave.reintentarModo}
            />
          </div>
        </div>

        {/* Acciones: firmar viendo el acta. Semántica de la app: Cancelar en error, Firmar en primary. */}
        <div className="flex justify-end gap-2 border-t border-base-300 p-4">
          <Boton
            estilos="btn btn-sm btn-outline btn-error"
            texto="Cancelar"
            deshabilitado={isSigning}
            onClick={onClose}
          />
          <Boton
            estilos="btn btn-sm btn-primary"
            texto={isSigning ? copy.botonLoading : copy.boton}
            deshabilitado={isSigning || !parCompleto || !clave.listaParaEnviar}
            onClick={handleFirmar}
          />
        </div>
      </div>
    </div>
  );
};

export default ModalFirmaActa;
