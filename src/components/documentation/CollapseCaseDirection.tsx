/**
 * Microservicio: ejecucion
 * Módulo: documentacion
 * Feature: Collapse de UNA Dirección metropolitana en la pestaña «Documentación» del expediente
 * Archivo: CollapseCaseDirection.tsx
 * Responsabilidad: Presentar los documentos de una Dirección dentro de un `<details>` en modo
 *   acordeón. Es PRESENTACIÓN PURA: no pide nada — el padre (`CaseDirectionDocumentsList`) decide
 *   cuándo cargar y le pasa `documents`/`loading`/`error` ya resueltos.
 *
 *   Portado de Resolución (`features/documentation/components/CollapseCaseDirection.tsx`) para que
 *   la pestaña se vea igual en los dos módulos; los estilos (`app-modules-case-modal-*`) viajan en
 *   `administration-modal-case.css`, que se portó con él.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-09-17
 * Modificado por: Andrés Miño — 2026-10-30 (quick 261030-dun: prop `aviso`, texto neutro encima de
 *   las tarjetas —documentos simulados o consulta deshabilitada—)
 */
import type { FC, MouseEvent, ReactNode } from "react";
import type { ICaseDirectionConfig } from "../../interfaces/ICaseDirection";
import type { IDocument } from "../../interfaces/IDocument";
import DocumentCards from "./DocumentsCards";

interface CollapseCaseDirectionProps {
  direction: ICaseDirectionConfig;
  index: number;
  isOpen: boolean;
  documents: IDocument[];
  loading: boolean;
  error: string | null;
  /** Aviso neutro encima de las tarjetas (simulado / deshabilitado). Ver `CaseDirectionDocumentsList`. */
  aviso?: string | null;
  selectedDocumentId?: number;
  onToggle: (code: ICaseDirectionConfig["code"]) => void;
  onSelectDocument: (document: IDocument) => void;
  /** Nodo extra a pintar en la fila de cada documento. Ver `CaseDirectionDocumentsList`. */
  accionPorDocumento?: (document: IDocument) => ReactNode;
}

const CollapseCaseDirection: FC<CollapseCaseDirectionProps> = ({
  direction,
  index,
  isOpen,
  documents,
  loading,
  error,
  aviso,
  selectedDocumentId,
  onToggle,
  onSelectDocument,
  accionPorDocumento,
}) => {
  // El `<details>` se abre solo al pulsarlo; aquí lo gobierna el padre (acordeón: una sola abierta),
  // así que se cancela el comportamiento nativo y se le avisa.
  const handleSummaryClick = (event: MouseEvent<HTMLElement>) => {
    event.preventDefault();
    onToggle(direction.code);
  };

  return (
    <details
      open={isOpen}
      className="app-collapse-alert app-modules-case-modal-direction-item"
    >
      <summary
        className="app-collapse-alert-summary cursor-pointer select-none"
        onClick={handleSummaryClick}
      >
        <div className="app-collapse-alert-header">
          <div className="app-collapse-alert-header-left">
            <span className="app-collapse-alert-index">{index + 1}.</span>
            <span className="app-collapse-alert-title">{direction.label}</span>
          </div>
          <div className="app-collapse-alert-header-right">
            <span className="app-collapse-alert-chevron">
              <svg
                className="app-collapse-alert-chevron-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </span>
          </div>
        </div>
      </summary>

      {isOpen && (
        <div className="app-collapse-alert-content">
          {error ? (
            <p className="app-modules-case-modal-direction-error">{error}</p>
          ) : (
            <div className="app-modules-case-modal-direction-cards">
              {aviso && (
                <p className="text-xs text-base-content/70">{aviso}</p>
              )}
              <DocumentCards
                documents={documents}
                selectedDocumentId={selectedDocumentId}
                onSelectDocument={onSelectDocument}
                loading={loading}
                accionPorDocumento={accionPorDocumento}
              />
            </div>
          )}
        </div>
      )}
    </details>
  );
};

export default CollapseCaseDirection;
