/**
 * Microservicio: resolucion
 * Módulo: Documentacion
 * Feature: Tabla de documentos por tipo
 * Archivo: TableByDocumentType.tsx
 * Responsabilidad: Renderizar la tabla de documentos filtrada por tipo de documento
 * Desarrollador: Johan Freire
 * Fecha: 2026-06-10
 */

import { useCallback, useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import Table, { type PaginationAndFilters } from "../tabla/Table";
import type { IDocument, IDocumentType } from "../../interfaces/IDocument";
import { DocumentService } from "../../services/DocumentService";
import { DatetimeUtil } from "../../utils/datetime.util";
import { useUser } from "../../context/UserContext";
import type { UserActions } from "../../interfaces/IUser";
import Loading from "../common/Loading";

export const CONTEXT_TABLE_ACTIONS = "table" as const;

type TableByDocumentTypeProps = {
  documentType: IDocumentType;
};

/**
 * Componente para renderizar la tabla de documentos por tipo
 * @param documentType - Tipo de documento
 * @returns Componente para renderizar la tabla de documentos por tipo
 */
const TableByDocumentType = ({ documentType }: TableByDocumentTypeProps) => {
  const { user } = useUser();
  const [isLoading, setIsLoading] = useState(false);

  if (!user) {
    return null;
  }

  const { actividades } = user;

  const tableOptions = actividades
    .filter(
      (act: UserActions) =>
        act.actiContext === CONTEXT_TABLE_ACTIONS && act.submId === 14,
    )
    .map((act: UserActions) => ({
      ...act,
      actiIsDisabled: false,
    }));

  // Definición de columnas de la tabla con useMemo para evitar recalculaciones innecesarias
  const columnsDocuments = useMemo<ColumnDef<IDocument, any>[]>(
    () => [
      {
        accessorFn: (row) => row.tdocTypeName,
        id: "docType",
        cell: (info) => (
          <span className="font-semibold text-primary">
            {String(info.getValue() ?? "")}
          </span>
        ),
        header: "Tipo",
        enableColumnFilter: false,
      },
      {
        accessorFn: (row) => row.docName,
        id: "docName",
        cell: (info) => info.getValue() || "-",
        header: "Nombre del Documento",
      },
      // {
      //   accessorFn: (row) => row.docObservacion,
      //   id: "docObservacion",
      //   cell: (info) => (
      //     <span className="truncate">{info.getValue() || "-"}</span>
      //   ),
      //   header: "Observaciones",
      // },
      {
        accessorFn: (row) => row.docSize,
        id: "docSize",
        cell: (info) => {
          const sizeInMB = (
            (info.getValue() as number) /
            (1024 * 1024)
          ).toFixed(2);
          return `${sizeInMB} MB`;
        },
        header: "Tamaño",
      },
      {
        accessorFn: (row) => row.docUploadedAt,
        id: "docUploadedAt",
        cell: (info) => {
          const date = info.getValue() as Date | undefined;
          return date ? DatetimeUtil.formatDate(date) : "-";
        },
        header: "Fecha de Carga",
      },
      {
        accessorFn: (row) => row.docUploadedBy,
        id: "docUploadedBy",
        cell: (info) => info.getValue() || "-",
        header: "Cargado por",
      },
      {
        accessorFn: (row) => row.docIsActive,
        id: "docIsActive",
        cell: (info) => (
          <span
            className={`badge ${
              info.getValue() ? "badge-success" : "badge-error"
            }`}
          >
            {info.getValue() ? "Activo" : "Inactivo"}
          </span>
        ),
        header: "Estado",
      },
    ],
    [],
  );

  // Función para resolver las acciones por fila, se pasa a la tabla para que la ejecute por cada fila y deshabilite las acciones que no correspondan según propiedades del documento
  const resolveActionsPerRow = useCallback(
    (row: IDocument, actions: UserActions[]) => {
      if (row.docIsActive) {
        return actions.map((action) => ({
          ...action,
          actiIsDisabled: false,
        }));
      }
      return actions;
    },
    [documentType],
  );

  // Función para obtener los documentos por tipo con paginación y filtros, se pasa a la tabla para que la ejecute cuando sea necesario
  const findRecordsFn = useCallback(
    async (params: PaginationAndFilters) => {
      setIsLoading(true);
      try {
        const { pageIndex, pageSize, filterParams } = params;
        const response = await DocumentService.getDocuments(
          pageIndex,
          pageSize,
          {
            ...filterParams,
            tdocType: documentType,
          },
        );
        return {
          data: response.data as IDocument[],
          total: response.total,
        };
      } catch (error) {
        console.error("Error al obtener los documentos por tipo:", error);
        return {
          data: [],
          total: 0,
        };
      } finally {
        setIsLoading(false);
      }
    },
    [documentType],
  );

  return (
    <>
      <Table
        styles={{
          containerStyle: "overflow-x-auto min-h-96",
          tableStyle: "table mt-0 w-full text-sm md:text-base",
        }}
        dataT={[]}
        columns={columnsDocuments}
        findRecordsFn={findRecordsFn}
        resolveActionsPerRow={resolveActionsPerRow}
        tableOptions={tableOptions}
      />
      {isLoading && <Loading />}
    </>
  );
};

export default TableByDocumentType;
