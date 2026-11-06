/**
 * Microservicio: Resolución Frontend
 * Módulo: N/A
 * Feature: Modal de confirmación para asignación de casos
 * Archivo: ModalAssignmentConfirmation.tsx
 * Responsabilidad: Gestionar la confirmación y proceso de asignación de casos
 * Desarrollador: Johan Freire
 * Fecha: 2026-04-10
 * Modificado por: Andrés Miño — 2026-10-28 (quick 261028-kmg: el éxito se dice solo en el aviso
 *   flotante; error y advertencia siguen por `message`, que ConfirmationDetail lleva al flotante)
 */

import { mensajeParaUsuario } from "../../api/mensajeParaUsuario";
import React, { useState } from "react";
import type { AlertVariant } from "../common/Alert";
import type { IInboxCases } from "../../interfaces/IInboxCases";
import { CaseService } from "../../services/CaseService";
import type { CasesToAssignment } from "../../interfaces/ICase";
import { useToast } from "../../hooks/useToast";
import { DocumentService } from "../../services/DocumentService";
import ConfirmationDetail from "./ConfirmationDetail";
import { DatetimeUtil } from "../../utils/datetime.util";

export const MODAL_KEY = "sendCasesToAssignment" as const;

interface ModalAssignmentConfirmationData {
  document: IInboxCases;
  selectedCases: Map<number, Record<string, any>>;
}

interface ModalAssignmentConfirmationProps {
  caseData: ModalAssignmentConfirmationData;
  onClose: () => void;
  refetchFn?: () => Promise<void>;
}

// Componente principal para mostrar el modal de confirmación de envío de casos a sorteo
const ModalAssignmentConfirmation: React.FC<
  ModalAssignmentConfirmationProps
> = ({ caseData, onClose, refetchFn }) => {
  const { addToast } = useToast();
  const [message, setMessage] = useState<{
    variant: AlertVariant;
    message: string;
  }>({
    variant: "info",
    message: "",
  });

  const { document, selectedCases } = caseData;

  // Obtener los casos seleccionados con sus datos
  const selectedCasesData = Array.from(selectedCases.values());
  const totalCasesInDocument = document.casesRelated.length;

  // Función para manejar la confirmación de envío de casos a sorteo, si existe algún error o comportamiento inesperado pone `message` (ConfirmationDetail lo dice en el aviso flotante) y permanece el modal abierto hasta que el usuario lo cierre. Caso contrario, si el envío de casos es exitoso, se cierra el modal.
  const handleConfirm = async () => {
    try {
      const assignmentMasterResponse = await CaseService.sendCasesToAssignment({
        cases: selectedCasesData as CasesToAssignment[],
      });

      console.log("response de asignación de casos", assignmentMasterResponse);

      // Respuesta nula del servidor
      if (!assignmentMasterResponse) {
        const errorMsg = "No se recibió respuesta del servidor";
        setMessage({
          variant: "error",
          message: errorMsg,
        });
        return;
      }

      // Éxito completo - asignados todos los casos
      if (assignmentMasterResponse.id > 0) {
        // Actualiza el estado del documento a "sorteado"
        await DocumentService.updateDocument(document.docId, {
          docStatus: "sorteado",
          docMetadata: {
            ...(document.docMetadata || {}),
            assignmentMasterId: assignmentMasterResponse.id,
          },
          // docAssignmentMasterId: assignmentMasterResponse.id,
        });

        addToast(
          "success",
          `Expedientes asignados correctamente, ${assignmentMasterResponse.sdetName}`,
        );

        // El éxito se dice solo en el aviso flotante. Cierra el modal y refetch la función de refetch si está disponible
        onClose();
        if (refetchFn) {
          await refetchFn();
        }
      }
      // Éxito parcial - asignados algunos casos
      else {
        const warningMsg = `No se pudo asignar los expedientes correctamente`;
        setMessage({
          variant: "warning",
          message: warningMsg,
        });
      }
    } catch (error) {
      console.error("Error confirming assignment:", error);
      const errorMsg =
        mensajeParaUsuario(error, "Error al enviar los expedientes a sorteo");

      setMessage({
        variant: "error",
        message: errorMsg,
      });
    }
  };

  return (
    <ConfirmationDetail
      headerKicker="Sorteo de expedientes"
      headerTitle="Confirmar envío a sorteo"
      statusCopy="Listo para enviar a sorteo"
      descriptionCopy="Se enviarán los expedientes seleccionados a sorteo. Esta acción no puede ser revertida."
      informationData={{
        Documento: document.docName,
        "Fecha del documento": DatetimeUtil.formatDate(document.docUploadedAt),
        "Total de expedientes del lote": totalCasesInDocument,
        "Total de expedientes a enviar": selectedCases.size,
      }}
      onConfirm={handleConfirm}
      onClose={onClose}
      message={message.message ? message : undefined}
      confirmButtonText="Sí, enviar a sorteo"
      confirmButtonLoadingText="Enviando..."
    />
  );
};

export default ModalAssignmentConfirmation;
