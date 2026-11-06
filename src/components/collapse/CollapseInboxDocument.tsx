/**
 * Microservicio: Resolución Frontend
 * Módulo: N/A
 * Feature: Collapse para documentos en el buzón
 * Archivo: CollapseInboxDocument.tsx
 * Responsabilidad: Gestionar la visualización y expansión de documentos en el buzón
 * Desarrollador: Johan Freire
 * Fecha: 2026-04-10
 * Modificado por: Andrés Miño — 2026-10-16 (Fase 03.23, Plan 12, D-14): el expediente ya no tiene id
 *   de materia, así que el caso que se manda a la asignación deja de llevar un `subId` sacado de él;
 *   se borran las dos funciones comentadas que lo usaban (código muerto).
 */

import { mensajeParaUsuario } from "../../api/mensajeParaUsuario";
import { useCallback, type FC, type ReactNode } from "react";
import type { IInboxCases } from "../../interfaces/IInboxCases";
import { DatetimeUtil } from "../../utils/datetime.util";
import Collapse, { CONTEXT_COLLAPSE_ACTIONS } from "./Collapse";
import type { ModalType } from "../../interfaces/IModal";
import Boton from "../common/Boton";
import type { UserActions } from "../../interfaces/IUser";
import { useModal } from "../../hooks/useModal";
import BadgePriority, { type StatusAndPriority } from "../common/BadgePriority";
import { useToast } from "../../hooks/useToast";
import { MODAL_KEY as SEE_ASSIGNMENT_RESULTS } from "../modals/ModalAssignmentResult";
import { AssignmentService } from "../../services/AssignmentService";
import { useUser } from "../../context/UserContext";
import { isInboxActionVisible } from "../../config/inboxActionStatusRules";

interface CollapseInboxDocumentProps {
  document: IInboxCases;
  index?: number;
  permittedActions: Record<
    (typeof CONTEXT_COLLAPSE_ACTIONS)[number],
    UserActions[]
  >;
  refetchInboxCases?: () => Promise<void>;
  setLoading?: (loading: boolean) => void;
  /**
   * Acciones que NO abren un modal del registry sino que ejecutan una llamada directa (p. ej. el
   * triage del director "enviar al secretario", que hace un PATCH y muestra un toast, sin modal). Se
   * indexan por actiName; si el actiName pulsado está aquí, se ejecuta este handler en lugar de
   * openModal. Extensión mínima: no altera el flujo de los consumidores existentes que no la pasan.
   */
  directActions?: Record<string, (document: IInboxCases) => void | Promise<void>>;
}

const CollapseInboxDocument: FC<CollapseInboxDocumentProps> = ({
  document,
  index = 0,
  permittedActions,
  refetchInboxCases,
  setLoading,
  directActions,
}) => {
  const { openModal } = useModal();
  const { addToast } = useToast();
  const { user } = useUser();
  const userRole = user?.rolName ?? "";

  const isActionVisible = useCallback(
    (action: UserActions) =>
      isInboxActionVisible(action.actiName, document.docStatus, userRole),
    [document.docStatus, userRole],
  );

  // const [updating, setUpdating] = useState(false);
  // const [selectedCases, setSelectedCases] = useState<
  //   Map<number, CasesToAssignment>
  // >(new Map());

  // if (updating) return <Loading />;

  // Handle sending selected cases to assignment/sorting
  const handleSendToAssignment = (modalType: ModalType) => {
    // Get the first document (assumes all selected cases are from the same document)
    const firstDocument = document;
    if (!firstDocument) {
      addToast("error", "No se encontró el documento", undefined, 3000);
      return;
    }

    // Generamos un mapa para enviar los casos a como espera el backend para enviar al servicio de asignación de casos.
    //TODO: Provicionalmente se envía el eresId, cuando debería ser el id del expediente que tiene en el core.
    // Fase 03.23 (D-14): sin `subId`. El expediente ya no tiene id de materia del que sacarlo; la
    // materia del reparto la decide el servidor, nunca el cuerpo de la petición.
    const casesToSend = document.casesRelated.reduce((map, caseItem) => {
      map.set(caseItem.eresId, {
        caseId: caseItem.eresId,
      });
      return map;
    }, new Map());

    openModal(
      modalType,
      {
        document: firstDocument,
        selectedCases: casesToSend,
      },
      { refetchFn: refetchInboxCases },
    );
  };

  const handleSeeAssignmentResults = async () => {
    try {
      setLoading?.(true);
      const assignment = await AssignmentService.getAssignmentResults(
        Number(document.docMetadata?.assignmentMasterId) ?? 0,
        document.docStatus ?? "",
      );
      openModal(
        SEE_ASSIGNMENT_RESULTS,
        { document, assignment },
        { refetchFn: refetchInboxCases },
      );
    } catch (error) {
      console.error("Error loading assignment results:", error);
      const errorMsg =
        mensajeParaUsuario(error, "Error al cargar el resultado del sorteo");
      addToast("error", errorMsg, undefined, 3000);
    } finally {
      setLoading?.(false);
    }
  };

  //TODO: Por el momento esta validando por el nombre del modal con ifs anidados, pero debería ser dinámico.
  const handleOpenModal = (modalType: ModalType) => {
    // Acción directa (sin modal): p. ej. el triage del director "enviar al secretario".
    const directHandler = directActions?.[modalType as string];
    if (directHandler) {
      void directHandler(document);
      return;
    }
    if (modalType === "sendCasesToAssignment") {
      handleSendToAssignment(modalType);
    } else if (modalType === SEE_ASSIGNMENT_RESULTS) {
      void handleSeeAssignmentResults();
    } else {
      openModal(modalType, document, { refetchFn: refetchInboxCases });
    }
  };

  // const getSelectedCountForDocument = (cases: Case[]) => {
  //   return cases.filter((c) => selectedCases.has(c.expId)).length;
  // };

  const renderDocumentHeader = (
    item: IInboxCases,
    index: number,
    permittedActions: UserActions[],
  ): ReactNode => (
    <div className="app-collapse-alert-header">
      {/* Left side: Document info */}
      <div className="app-inbox-document-header-left">
        <div className="app-inbox-document-info">
          <h3 className="app-collapse-alert-title app-inbox-document-name">
            <span className="app-collapse-alert-index">{index + 1}.</span>
            {item.docName}
          </h3>
          <div className="app-inbox-document-meta">
            <span className="app-inbox-document-type">{item.tdocTypeName}</span>
            <span className="app-inbox-document-date">
              {DatetimeUtil.formatDate(new Date(item.docUploadedAt))}
            </span>
            <span className="app-inbox-document-count">
              {item.casesRelated.length} caso
              {item.casesRelated.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
      </div>

      {/* Right side: Selection count and chevron */}
      <div className="app-collapse-alert-header-right app-inbox-document-header-right">
        {permittedActions?.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {permittedActions.map((option) =>
              isActionVisible(option) ? (
                <Boton
                  key={option.actiName}
                  deshabilitado={option.actiIsDisabled ?? false}
                  estilos="btn btn-sm btn-outline btn-primary"
                  texto={option.actiLabel}
                  onClick={() => {
                    handleOpenModal(option.actiName);
                  }}
                />
              ) : null,
            )}
          </div>
        )}

        <BadgePriority
          priority={item.docStatus as StatusAndPriority}
          text={item.docStatus ?? "desconocido"}
        />

        {/* 
          <span className="app-collapse-alert-index app-inbox-document-selected">
            {getSelectedCountForDocument(item.casesRelated)}/
            {item.casesRelated.length}
          </span>
        */}
        <span className="app-collapse-alert-chevron">
          <svg
            className="app-collapse-alert-chevron-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </span>
      </div>
    </div>
  );

  const renderDocumentContent = (
    item: IInboxCases,
    contentActions: UserActions[],
  ): ReactNode => (
    <div className="app-collapse-alert-body max-h-96 overflow-y-auto">
      {contentActions?.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {contentActions.map((option) =>
            option.actiContext === "collapseBody" && isActionVisible(option) ? (
              <Boton
                key={option.actiName}
                deshabilitado={option.actiIsDisabled ?? false}
                estilos="btn btn-sm btn-outline btn-primary"
                texto={option.actiLabel}
                onClick={() => {
                  handleOpenModal(option.actiName);
                }}
              />
            ) : null,
          )}
        </div>
      )}

      {/* 
        <div className="app-inbox-cases-header">
          <button
            onClick={() => onSelectAllCases(item.casesRelated)}
            className="app-inbox-select-all-btn"
          >
            <input
              type="checkbox"
              disabled={item.docStatus === "pendiente"}
              checked={
                item.casesRelated.length > 0 &&
                item.casesRelated.every((c) => selectedCases.has(c.expId))
              }
              onChange={() => onSelectAllCases(item.casesRelated)}
              className="app-inbox-checkbox"
            />
            <span>Seleccionar todos ({item.casesRelated.length})</span>
          </button>
        </div>
      */}

      <div className="app-item-list">
        {item.casesRelated.map((caseItem, index) => (
          <div
            key={caseItem.expId}
            className="app-item-list-row app-item-list-row--with-actions border border-gray-200 rounded"
          >
            <span className="app-item-list-index">{index + 1}.</span>

            <div className="app-item-list-primary">
              <div className="app-item-list-identifying">
                {caseItem.expNumber}
              </div>
              <div className="app-item-list-complementary">
                {DatetimeUtil.formatDate(new Date(caseItem.expCreatedAt))}
              </div>
            </div>

            <div className="app-item-list-secondary">
              <span className="app-item-list-info--alta">
                {caseItem.admiName} {caseItem.admiLastname}
              </span>
              <span className="app-item-list-info--baja">
                {caseItem.admiIdentification}
              </span>
              <span className="app-item-list-info--baja">
                {caseItem.expZone}
              </span>
              <span className="app-item-list-info--media">
                {caseItem.admiTelephone}
              </span>
            </div>

            <div className="app-item-list-actions">
              {contentActions.map((option) =>
                option.actiContext === "collapseBodyItem" &&
                isActionVisible(option) ? (
                  <Boton
                    key={option.actiName}
                    deshabilitado={option.actiIsDisabled ?? false}
                    estilos="btn btn-sm btn-primary"
                    icono={option.actiIconName}
                    onClick={() =>
                      openModal(option.actiName, caseItem, {
                        refetchFn: refetchInboxCases,
                      })
                    }
                  />
                ) : null,
              )}
            </div>
          </div>
        ))}
      </div>
      {/* )} */}
    </div>
  );

  return (
    <Collapse<IInboxCases>
      data={document}
      index={index}
      permittedActions={permittedActions}
      headerRender={renderDocumentHeader}
      contentRender={renderDocumentContent}
      className="app-collapse-alert app-inbox-alert-item"
      summaryClassName="app-collapse-alert-summary"
      contentClassName="app-collapse-alert-content"
    />
  );
};

export default CollapseInboxDocument;
