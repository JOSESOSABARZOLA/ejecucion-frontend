/**
 * Microservicio: ejecucion
 * Módulo: Alertas
 * Feature: Aviso desplegable de la página Avisos
 * Archivo: CollapseAlert.tsx
 * Responsabilidad: Pintar un aviso (título, prioridad, fecha, mensaje y lectura) como desplegable.
 * Desarrollador: Johan Freire
 * Fecha: 2026-03-19
 * Modificado por: Andrés Miño — 2026-10-30 (quick 261030-m29: ranura opcional `accion` al pie del
 *   cuerpo, donde Avisos pone «Ir» cuando el aviso lleva a un expediente)
 */
import type { FC, ReactNode } from "react";
import type { IAlert } from "../../interfaces/IAlert";
import { DatetimeUtil } from "../../utils/datetime.util";
import HeaderCollapse from "./HeaderCollapse";
import Collapse from "./Collapse";

interface CollapseAlertProps {
  alert: IAlert;
  index?: number;
  /** Acción opcional al pie del cuerpo (p. ej. «Ir» al expediente del aviso). */
  accion?: ReactNode;
}

const CollapseAlert: FC<CollapseAlertProps> = ({
  alert,
  index = 0,
  accion,
}) => {
  const renderAlertHeader = (item: IAlert, itemIndex: number): ReactNode => (
    <HeaderCollapse
      index={itemIndex}
      title={item.aresTitle}
      date={new Date(item.aresCreatedAt)}
      priority={item.aresPriority}
    />
  );

  const renderAlertContent = (item: IAlert): ReactNode => (
    <div className="app-collapse-alert-body">
      {/* Message */}
      <div className="app-collapse-alert-message">
        <p>{item.aresMessage}</p>
      </div>

      {/* Metadata */}
      <div className="app-collapse-alert-metadata">
        {item.ualeRead && item.ualeReadAt && (
          <div className="app-collapse-alert-read-info">
            <span className="label">Leído:</span>
            <span className="value">
              {item.ualeReadAt
                ? DatetimeUtil.formatDate(item.ualeReadAt)
                : "No leído"}
            </span>
          </div>
        )}
        {item.elapsedTime && (
          <div className="app-collapse-alert-elapsed">
            <span className="label">Tiempo transcurrido:</span>
            <span className="value">{item.elapsedTime}</span>
          </div>
        )}
      </div>

      {accion && <div className="mt-3 flex justify-end">{accion}</div>}
    </div>
  );

  return (
    <Collapse<IAlert>
      data={alert}
      index={index}
      permittedActions={{
        collapseHeader: [],
        collapseBody: [],
        collapseBodyItem: [],
      }}
      headerRender={renderAlertHeader}
      contentRender={renderAlertContent}
      className="app-collapse-alert app-avisos-alert-item"
      summaryClassName="app-collapse-alert-summary"
      contentClassName="app-collapse-alert-content"
    />
  );
};

export default CollapseAlert;
