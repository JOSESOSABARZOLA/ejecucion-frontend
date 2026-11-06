/**
 * Microservicio: resolucion
 * Módulo: Modales
 * Feature: Visualización de Documentos PDF
 * Archivo: ModalDocumentViewer.tsx
 * Responsabilidad: Modal para visualizar documentos PDF en pantalla completa
 * Descripción: Proporciona una interfaz limpia para ver PDFs dentro de un modal
 *              con encabezado simple (título y botón cerrar) y el visualizador de PDF
 * Desarrollador: GitHub Copilot
 * Fecha: 2026-05-28
 */

import React from "react";
import type { IDocument } from "../../interfaces/IDocument";
import { PDFViewer } from "../pdf/PDFViewer";

interface ModalDocumentViewerProps {
  caseData: IDocument;
  onClose: () => void;
}

/**
 * Modal para visualizar documentos PDF
 *
 * Características:
 * - Encabezado simple con kicker, título y botón de cierre
 * - Reutiliza el componente PDFViewer existente
 * - Diseño minimalista para máximo enfoque en el documento
 * - Usa patrones CSS estándar de modalidad de la aplicación
 *
 * @param document - Objeto del documento a visualizar
 * @param onClose - Callback ejecutado al cerrar el modal
 *
 * @example
 * const { openModal } = useModal();
 * openModal("documentViewer", documentObject);
 */
export const ModalDocumentViewer: React.FC<ModalDocumentViewerProps> = ({
  caseData,
  onClose,
}) => {
  // Usar docName como título principal, fallback a docType si no existe
  const documentTitle = caseData.docName || "Documento";
  console.log("ModalDocumentViewer - caseData completo:", caseData);
  console.log("ModalDocumentViewer - docUrl:", caseData.docUrl);
  console.log("ModalDocumentViewer - docUrl type:", typeof caseData.docUrl);

  return (
    <div className="modal-box max-w-5xl w-11/12 relative p-0">
      <div className="w-full max-h-[90vh] overflow-y-auto">
        {/* HEADER: Encabezado del modal con kicker, título y botón cerrar */}
        <div className="app-modules-modal-header">
          <div className="min-w-0">
            <p className="app-modules-modal-kicker">Expediente</p>
            <h2 className="app-modules-modal-title">{documentTitle}</h2>
          </div>
          <div className="app-modules-modal-meta">
            <button
              type="button"
              className="app-modules-modal-close"
              onClick={onClose}
              aria-label="Cerrar modal de documento"
            >
              ×
            </button>
          </div>
        </div>

        {/* BODY: Cuerpo del modal con el visualizador de PDF */}
        <div className="app-modules-modal-body">
          <div className="app-modules-modal-content">
            <PDFViewer
              document={caseData}
              loading={false}
            />
          </div>
        </div>
        {/* NOTA: Sin sección de acciones (modal de solo lectura) */}
      </div>
    </div>
  );
};
