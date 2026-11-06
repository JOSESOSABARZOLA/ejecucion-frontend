/**
 * Microservicio: Resolución Frontend
 * Módulo: N/A
 * Feature: Modal de confirmación para envío a revisión
 * Archivo: ModalSendForReview.tsx
 * Responsabilidad: Gestionar la confirmación y proceso de envío de un documento a revisión
 * Desarrollador: Johan Freire
 * Fecha: 2026-04-10
 * Modificado por: Andrés Miño — 2026-10-28 (quick 261028-kmg: el éxito se dice solo en el aviso
 *   flotante; el error sigue por `message`, que ConfirmationDetail lleva al flotante)
 */

import { mensajeParaUsuario } from "../../api/mensajeParaUsuario";
import React, { useState } from "react";
import type { AlertVariant } from "../common/Alert";
import type { IInboxCases } from "../../interfaces/IInboxCases";
import { DocumentService } from "../../services/DocumentService";
import { useToast } from "../../hooks/useToast";
import ConfirmationDetail from "./ConfirmationDetail";
import { DatetimeUtil } from "../../utils/datetime.util";

export const MODAL_KEY = "delegateForReview" as const;

interface ModalSendForReviewProps {
  caseData: IInboxCases;
  onClose: () => void;
  refetchFn?: () => Promise<void>;
}

const ModalSendForReview: React.FC<ModalSendForReviewProps> = ({
  caseData,
  onClose,
  refetchFn,
}) => {
  const { addToast } = useToast();
  const [message, setMessage] = useState<{
    variant: AlertVariant;
    message: string;
  }>({
    variant: "info",
    message: "",
  });

  /**
   * Maneja la confirmación de envío del documento a revisión.
   *
   * FLUJO DE RESPONSABILIDADES:
   * 1. Intenta actualizar el estado del documento a "en revisión"
   * 2. Si ERROR (red, servidor, etc.):
   *    - Actualiza `message` con error → ConfirmationDetail lo dice en el aviso flotante y
   *      bloquea el reintento
   *    - Modal permanece abierto para reintentar
   * 3. Si ÉXITO:
   *    - Actualiza el estado del documento
   *    - Dice el éxito en el aviso flotante (una sola vez)
   *    - CIERRA MODAL (llama onClose())
   */
  const handleConfirm = async () => {
    try {
      // Enviar documento a revisión
      await DocumentService.updateDocument(caseData.docId, {
        docStatus: "en revisión",
      });

      // Éxito
      const successMsg = "Documento enviado a revisión correctamente";
      addToast("success", successMsg);

      // CIERRA MODAL SOLO AQUÍ (éxito confirmado)
      onClose();
      // Llamar a la función de refetch si está disponible
      if (refetchFn) {
        await refetchFn();
      }
    } catch (error) {
      console.error("Error sending document for review:", error);
      const errorMsg =
        mensajeParaUsuario(error, "Error al enviar el documento a revisión");

      setMessage({
        variant: "error",
        message: errorMsg,
      });
      // Permanece abierto para reintentar
    }
  };

  return (
    <ConfirmationDetail
      headerKicker="Envío a revisión"
      headerTitle="Confirmar envío a revisión"
      statusCopy="Listo para enviar a revisión"
      descriptionCopy="Se enviará el documento a revisión. Esta acción no puede ser revertida."
      informationData={{
        Documento: caseData.docName,
        "Fecha del documento": DatetimeUtil.formatDate(caseData.docUploadedAt),
      }}
      onConfirm={handleConfirm}
      onClose={onClose}
      message={message.message ? message : undefined}
      confirmButtonText="Sí, enviar a revisión"
      confirmButtonLoadingText="Enviando..."
    />
  );
};

export default ModalSendForReview;
