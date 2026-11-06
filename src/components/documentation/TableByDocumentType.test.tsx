/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/documentacion (frontend)
 * Feature: Red de seguridad de D-01 — 2.º consumidor de `Table.tsx` (Fase 03.19, Plan 01)
 * Archivo: TableByDocumentType.test.tsx
 * Responsabilidad: Prueba de humo de render. No prueba ninguna regla de negocio: este componente es
 *   un consumidor HEREDADO de `Table.tsx` que llegó sin test, y su única función aquí es **delatar
 *   una regresión de firma o de render** cuando D-01 sustituya la tabla. Si el componente deja de
 *   pedir sus documentos, o deja de pintarlos, esto sale en rojo.
 *
 *   Dos conductas y nada más: que al montar se pida la lista UNA vez, y que una celda con dato real
 *   llegue al documento.
 *
 *   ── 🔴 ESTA PRUEBA PUEDE SER TEMPORAL ────────────────────────────────────────────────────────
 *   `DocumentationPage` —la pantalla que monta este componente— está en «Deferred» y hoy no tiene
 *   entrada de menú. Si el usuario confirma que esa pantalla se retira, este archivo se retira con
 *   ella: no tiene valor propio, sólo cubre el flanco mientras la tabla cambia debajo.
 *
 *   ── POR QUÉ EL CONTEO SE MIDE NADA MÁS PINTAR LA FILA ────────────────────────────────────────
 *   Medio segundo después del montaje, `FilterByColumn` provoca una petición idéntica por cada
 *   columna filtrable —y aquí hay cinco—. Es deuda de `Table.tsx` documentada en `Table.test.tsx`
 *   (its `it.todo` (a)); aquí se mide lo que importa a esta pantalla: que el montaje pide una vez.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-09-21
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { DocumentResponse, IDocument } from "../../interfaces/IDocument";
import TableByDocumentType from "./TableByDocumentType";

const mocks = vi.hoisted(() => ({
  getDocuments: vi.fn(),
}));

vi.mock("../../services/DocumentService", () => ({
  DocumentService: { getDocuments: mocks.getDocuments },
}));

// La columna de acciones sí se pinta en este componente, pero `RowActions` exige `ToastProvider` y
// `ModalProvider` y arrastra los 16 modales del registro. Lo que esta prueba mira de esa columna es
// nada: sólo que su presencia no impida pintar el resto.
vi.mock("../tabla/RowActions", () => ({ default: () => null }));

// El componente se rinde (`return null`) si no hay usuario, y de él sólo lee `actividades` para
// componer las acciones de fila. Vacío: esta pantalla no ofrece ninguna en la prueba.
vi.mock("../../context/UserContext", () => ({
  useUser: () => ({
    user: {
      usuId: 7,
      usuFullName: "Usuaria de Prueba",
      usuEmail: "prueba@ejemplo.local",
      rolName: "secretario abogado",
      modulos: [],
      submenus: [],
      actividades: [],
    },
    sessionState: "authenticated",
  }),
}));

/** UN documento con nombre reconocible: es el dato que tiene que llegar a la celda. */
const DOCUMENTO: IDocument = {
  tsdocId: 12,
  tdocType: "provideProvidence",
  tdocTypeName: "Providencia",
  tsdocSubtypeName: "Providencia de inicio",
  tsdocSubtype: "startExecution",
  docId: 901,
  docName: "Providencia de inicio EPAS-2026-04101.pdf",
  docSize: 1_048_576,
  docUploadedAt: new Date("2026-09-03T11:15:00.000Z"),
  docUploadedBy: 6389,
  docIsActive: true,
  docUrl: "/api/fileserver/ejecucion/providencias/2026/10/providencia-901.pdf",
  docIsLocked: false,
  docStatus: "emitida",
  docVersion: 1,
  docIsCurrent: true,
  docMetadata: {},
  docParentId: 0,
};

const RESPUESTA: DocumentResponse = {
  data: [DOCUMENTO],
  total: 1,
  limit: 10,
  offset: 0,
  page: 1,
  pages: 1,
};

describe("TableByDocumentType — humo de render sobre `Table.tsx` (2.º consumidor)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getDocuments.mockResolvedValue(RESPUESTA);
  });

  it("al montar pide los documentos de su tipo UNA vez y los pinta", async () => {
    render(<TableByDocumentType documentType="provideProvidence" />);

    expect(
      await screen.findByText("Providencia de inicio EPAS-2026-04101.pdf"),
    ).toBeInTheDocument();
    expect(mocks.getDocuments).toHaveBeenCalledTimes(1);

    // El tipo viaja en los filtros: es lo que distingue esta tabla de la del resto de tipos.
    expect(mocks.getDocuments.mock.calls[0][2]).toMatchObject({
      tdocType: "provideProvidence",
    });
  });
});
