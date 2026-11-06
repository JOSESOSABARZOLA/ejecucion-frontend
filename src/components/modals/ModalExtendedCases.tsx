import React, { useCallback, useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import Table from "../tabla/Table";
import type { PaginationAndFilters } from "../tabla/Table";
import type { ICaseExtended } from "../../interfaces/ICaseExtended";
import { CaseService } from "../../services/CaseService";
import { DatetimeUtil } from "../../utils/datetime.util";



interface ModalExtendedCasesProps {
  onClose: () => void;
}

export const MODAL_KEY = "seeExtendedCases" as const;

const ModalExtendedCases: React.FC<ModalExtendedCasesProps> = ({ onClose }) => {

  // Definición de columnas de la tabla con useMemo para evitar recalculaciones innecesarias
  const columnsTable = useMemo<ColumnDef<ICaseExtended, any>[]>(() => {
    return [
      {
        accessorFn: (row) => row.expedientNumber,
        id: "expedientNumber",
        cell: (info) => info.getValue(),
        header: "Expediente",
        enableColumnFilter: true,
      },
      {
        accessorFn: (row) => row.administradoName,
        id: "administradoName",
        cell: (info) => info.getValue(),
        header: "Nombres",
        enableColumnFilter: true,
      },
      {
        accessorFn: (row) => row.administradoLastName,
        id: "administradoLastName",
        cell: (info) => info.getValue(),
        header: "Apellidos",
        enableColumnFilter: true,
      },
      {
        accessorFn: (row) => row.administradoIdentification,
        id: "administradoIdentification",
        cell: (info) => info.getValue(),
        header: "CI/RUC",
        enableColumnFilter: true,
      },
      {
        accessorFn: (row) => row.extensionDaysAdded,
        id: "extensionDaysAdded",
        cell: (info) => info.getValue(),
        header: "Días Adicionales",
      },
      {
        accessorFn: (row) => row.extensionNewDeadline,
        id: "extensionNewDeadline",
        cell: (info) => DatetimeUtil.formatDate(info.getValue()),
        header: "Nueva Fecha Límite",
      },
      {
        accessorFn: (row) => row.extensionReason,
        id: "extensionReason",
        cell: (info) => info.getValue(),
        header: "Motivo de Extensión",
      },
      {
        accessorFn: (row) => row.extensionStatus,
        id: "extensionStatus",
        cell: (info) => info.getValue(),
        header: "Estatus de Extensión",
      },
    ];
  }, []);

  // Función para obtener los expedientes ampliados con paginación y filtros
  const findRecordsFn = useCallback(async (params: PaginationAndFilters) => {
    const { pageIndex, pageSize, filterParams } = params;
    const response = await CaseService.getAllExtendedCases(
      pageIndex,
      pageSize,
      filterParams,
    );
    // Aquí había un `console.log("Response extended cases:", response)` que volcaba la respuesta
    // ENTERA —nombres y cédulas de los administrados de la página— a la consola del navegador, en
    // cada carga y en cada filtrado. Lo detectó el Plan 01 de la Fase 03.19 y lo retira el Plan 06,
    // que es el que toca este árbol: es la misma familia que T-03.19-25, la mitigación que prohíbe
    // portar ninguna línea de volcado a consola desde la rama. Un dato personal en la consola es un
    // dato personal expuesto: queda en el historial del navegador, lo ve cualquiera que abra las
    // herramientas de desarrollo y lo recoge cualquier extensión instalada.
    return response;
  }, []);

  // Configuración de props para la tabla
  const propsTable = {
    styles: {
      containerStyle: "relative overflow-x-auto",
      tableStyle: "table mt-0 w-full h-full text-sm",
    },
    dataT: [],
    columns: columnsTable,
    findRecordsFn,
    resolveActionsPerRow: () => [],
    tableOptions: [],
  };

  return (
    <div className="modal-box max-w-4xl w-11/12 relative p-0">
      <div className="w-full max-h-[90vh] overflow-y-auto">
        <div className="app-modules-modal-header">
          <div className="min-w-0">
            <p className="app-modules-modal-kicker">Recepción</p>
            <h2
              id="extended-cases-modal-title"
              className="app-modules-modal-title"
            >
              Expedientes ampliados
            </h2>
          </div>
          <div className="app-modules-modal-meta">
            <button
              type="button"
              onClick={onClose}
              className="app-modules-modal-close"
              aria-label="Cerrar modal de expedientes ampliados"
            >
              ×
            </button>
          </div>
        </div>

        <div className="app-data-panel-body px-2 pb-4 pt-2 md:px-4">
          <Table {...propsTable} />
        </div>
      </div>
    </div>
  );
};

export default ModalExtendedCases;
