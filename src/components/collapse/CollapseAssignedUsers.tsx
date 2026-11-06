/**
 * Microservicio: resolucion
 * Módulo: inbox
 * Feature: Collapse de usuarios asignados en resultado de sorteo
 * Archivo: CollapseAssignedUsers.tsx
 * Responsabilidad: Renderizar usuarios asignados y sus resultados en un collapse
 * Desarrollador: Johan Freire
 * Fecha: 2026-06-05
 * Modificado por: Andrés Miño — 2026-10-16 (fix sorteo: la cabecera enseña el nombre completo del
 *   usuario y deja «Usuario ( id )» solo para quien no tiene nombre conocido)
 */

import React, { type ReactNode } from "react";
import type { AssignmentResult } from "../../interfaces/IAssignmentResult";
import type { UserActions } from "../../interfaces/IUser";
import { DatetimeUtil } from "../../utils/datetime.util";
import Collapse, { CONTEXT_COLLAPSE_ACTIONS } from "./Collapse";
import EmptyState from "../common/EmptyState";

export interface AssignedUserCollapseItem {
  userId: number;
  /** Nombre completo del usuario. Ausente ⇒ no se conoce y la cabecera enseña su id. */
  userName?: string;
  results: AssignmentResult[];
}

interface CollapseAssignedUsersProps {
  item: AssignedUserCollapseItem;
  index: number;
}

const EMPTY_COLLAPSE_ACTIONS: Record<
  (typeof CONTEXT_COLLAPSE_ACTIONS)[number],
  UserActions[]
> = {
  collapseHeader: [],
  collapseBody: [],
  collapseBodyItem: [],
};

const formatAssignmentDate = (value: Date | string): string =>
  DatetimeUtil.formatDate(new Date(value));

/**
 * Etiqueta de la cabecera: el nombre completo si se conoce y, si no, «Usuario ( id )» — el usuario
 * nunca desaparece ni recibe un nombre inventado.
 *
 * @param data usuario asignado con su id y, si lo hay, su nombre.
 * @returns el texto que identifica al usuario en la cabecera del collapse.
 */
const assignedUserLabel = (data: AssignedUserCollapseItem): string => {
  const name = data.userName?.trim();
  return name ? name : `Usuario ( ${data.userId} )`;
};

const CollapseAssignedUsers: React.FC<CollapseAssignedUsersProps> = ({
  item,
  index,
}) => {
  const renderHeader = (
    data: AssignedUserCollapseItem,
    idx: number,
  ): ReactNode => {
    const result = data.results[0];
    if (!result) return null;

    return (
      <div className="app-collapse-alert-header">
        <div className="app-inbox-document-header-left min-w-0">
          <h3 className="app-collapse-alert-title">
            <span className="app-collapse-alert-index">{idx + 1}.</span>
            {assignedUserLabel(data)}
          </h3>
          <div className="app-inbox-document-meta flex flex-wrap gap-2">
            <span>Expedientes asignados: { data.results.length }</span>
            <span>Asignado: {formatAssignmentDate(result.assignedAt)}</span>
            {result.approvedAt && <span>Aprobado: {formatAssignmentDate(result.approvedAt)}</span>}
          </div>
        </div>
        <span className="app-collapse-alert-chevron">
          <svg
            className="app-collapse-alert-chevron-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </span>
      </div>
    );
  };

  const renderContent = (data: AssignedUserCollapseItem): ReactNode => (
    <div className="app-collapse-alert-body max-h-96 overflow-y-auto">
      {data.results.length > 0 ? (
        <div className="app-inbox-cases-list mt-4">
          {data.results.map((result, resultIndex) => (
            <div
              key={result.id}
              className="app-inbox-case-item border border-gray-200 rounded mb-2 p-2"
            >
              <span className="app-collapse-alert-index">
                {resultIndex + 1}.
              </span>
              <div className="app-inbox-case-info">
                <strong>{result.subName}</strong>
                <div className="app-inbox-case-details">
                  {result.masterStatusName && <span className="app-inbox-case-administrado">
                    {result.masterStatusName}
                  </span>}
                  {result.assignmentStatusName && (
                    <span className="app-inbox-case-identification">
                      {result.assignmentStatusName}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState text="Detalle de asignación próximamente." />
      )}
    </div>
  );

  if (!item.results[0]) return null;

  return (
    <Collapse<AssignedUserCollapseItem>
      data={item}
      index={index}
      permittedActions={EMPTY_COLLAPSE_ACTIONS}
      headerRender={(data, idx) => renderHeader(data, idx)}
      contentRender={(data) => renderContent(data)}
      className="app-collapse-alert app-inbox-alert-item"
      summaryClassName="app-collapse-alert-summary"
      contentClassName="app-collapse-alert-content"
    />
  );
};

export default CollapseAssignedUsers;
