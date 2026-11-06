/**
 * Microservicio: Resolución Frontend
 * Módulo: N/A
 * Feature: Modal de confirmación para envío a sorteo
 * Archivo: ModalSendForAssignment.tsx
 * Responsabilidad: Gestionar la confirmación y proceso de envío de un documento a sorteo
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

export const MODAL_KEY = "delegateForAssignment" as const;

interface ModalSendForAssignmentProps {
  caseData: IInboxCases;
  onClose: () => void;
  refetchFn?: () => Promise<void>;
}

const ModalSendForAssignment: React.FC<ModalSendForAssignmentProps> = ({
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
   * Maneja la confirmación de envío del documento a sorteo.
   *
   * FLUJO DE RESPONSABILIDADES:
   * 1. Intenta actualizar el estado del documento a "en sorteo"
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
      // Enviar documento a sorteo
      await DocumentService.updateDocument(caseData.docId, {
        docStatus: "en sorteo",
      });

      // Éxito
      const successMsg = "Documento enviado a sorteo correctamente";
      addToast("success", successMsg);

      // CIERRA MODAL SOLO AQUÍ (éxito confirmado)
      onClose();
      // Llamar a la función de refetch si está disponible
      if (refetchFn) {
        await refetchFn();
      }
    } catch (error) {
      console.error("Error sending document for assignment:", error);
      const errorMsg =
        mensajeParaUsuario(error, "Error al enviar el documento a sorteo");

      setMessage({
        variant: "error",
        message: errorMsg,
      });
      // Permanece abierto para reintentar
    }
  };

  return (
    <ConfirmationDetail
      headerKicker="Envío a sorteo"
      headerTitle="Confirmar envío a sorteo"
      statusCopy="Listo para enviar a sorteo"
      descriptionCopy="Se enviará el documento a sorteo. Esta acción no puede ser revertida."
      informationData={{
        Documento: caseData.docName,
        "Fecha del documento": DatetimeUtil.formatDate(caseData.docUploadedAt),
      }}
      onConfirm={handleConfirm}
      onClose={onClose}
      message={message.message ? message : undefined}
      confirmButtonText="Sí, enviar a sorteo"
      confirmButtonLoadingText="Enviando..."
    />
  );
};

export default ModalSendForAssignment;
