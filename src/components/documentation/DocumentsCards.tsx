/**
 * Microservicio: Resolucion
 * Módulo: Documentacion
 * Feature:
 * Archivo: DocumentsCards.tsx
 * Responsabilidad: Renderizar los documentos adjuntos a un expediente en forma de cards, con funcionalidad de arrastrar y soltar para reordenar, y un botón para visualizar cada documento.
 * Desarrollador: Johan Freire
 * Fecha: 23/04/2026
 * Modificado por: Andrés Miño — 2026-10-26 (Fase 03.21, Plan 11, D-15/D-26, UI-SPEC §8.2: la
 *   tarjeta pinta `SelloFirma` dentro de `document-meta`, y el tipo que recibe gana `firmas` y
 *   `firmaRequerida`, opcionales).
 */

import React, { useEffect, useState } from "react";
import type { IDocument } from "../../interfaces/IDocument";
import type { ExpedienteDocumento } from "../../services/EpasService";
import SelloFirma from "../expediente/SelloFirma";

/**
 * Lo que pinta esta lista: un `IDocument` más, OPCIONALES, las dos piezas de la firma que trae
 * `GET /epas/:eejeId/documentos` (Fase 03.21, D-15/D-26). Opcionales porque esta lista también la
 * alimentan lecturas que no las traen; con ellas ausentes el sello no pinta nada.
 *
 * Se amplía AQUÍ y no en `IDocument`: ese es el espejo del `DocumentDto` de los endpoints
 * genéricos de documentación, que no proyectan firmas, y declararlas allí sería un tipo que
 * promete un dato que esa red no manda.
 */
export type DocumentoConFirmas = IDocument &
  Pick<ExpedienteDocumento, "firmas" | "firmaRequerida">;

interface DocumentoCardsProps {
  documents: DocumentoConFirmas[];
  selectedDocumentId?: number;
  onSelectDocument: (document: IDocument) => void;
  onReorder?: (documentosReordenados: IDocument[]) => void;
  loading?: boolean;
  /**
   * Nodo EXTRA a pintar junto al botón «Ver» de cada documento (2026-09-18).
   *
   * 🔴 Esta lista NO sabe qué es una observación: recibe un nodo y lo pinta. Es lo que le permite
   * seguir sirviendo a las pantallas que no observan nada — que son todas menos la ficha de la
   * Bandeja de Entrada— sin enterarse de que la funcionalidad existe.
   */
  accionPorDocumento?: (document: IDocument) => React.ReactNode;
}

const DocumentCards: React.FC<DocumentoCardsProps> = ({
  documents,
  selectedDocumentId,
  onReorder,
  onSelectDocument,
  loading = false,
  accionPorDocumento,
}) => {
  const formatDate = (date: Date | string) => {
    const dateObj = typeof date === "string" ? new Date(date) : date;
    return dateObj.toLocaleDateString("es-ES", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return "";
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + " KB";
    return (bytes / (1024 * 1024)).toFixed(2) + " MB";
  };

  // const documentos = documentosPrueba;
  // Estado para rastrear qué documento se está arrastrando
  const [draggedDocumentId, setDraggedDocumentId] = useState<number | null>(
    null,
  );
  // Estado para rastrear sobre qué documento se está pasando
  const [dragOverDocumentId, setDragOverDocumentId] = useState<number | null>(
    null,
  );
  // Copia local del array para poder manipularlo
  const [localDocumentos, setLocalDocumentos] =
    useState<DocumentoConFirmas[]>(documents);

  /**
   * Resincroniza la copia local cuando el padre cambia la lista.
   *
   * 🔴 SIN ESTO LA CARGA BAJO DEMANDA NO SE VE (2026-09-17). El `useState(documents)` solo lee su
   * argumento en el PRIMER render: el acordeón por Dirección monta este componente con la lista
   * vacía y la rellena después, al terminar la petición — y el componente seguía enseñando el array
   * vacío del montaje. La pestaña «Documentación» se quedaba en blanco con los documentos ya
   * cargados en memoria.
   *
   * Portado de Resolución, que lo tenía y este clon había perdido.
   */
  useEffect(() => {
    setLocalDocumentos(documents);
  }, [documents]);

  /**
   * Se dispara cuando el usuario comienza a arrastrar un elemento
   * Aquí guardamos cuál documento se está arrastrando
   */
  const handleDragStart = (
    event: React.DragEvent<HTMLDivElement>,
    documentoId: number,
  ) => {
    setDraggedDocumentId(documentoId);
    // Establecer el efecto visual del cursor
    event.dataTransfer.effectAllowed = "move";
  };

  /**
   * Se dispara cuando el usuario arrastra sobre otro elemento
   * Permite que el elemento sea un destino válido de drop
   */
  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  };

  /**
   * Se dispara cuando el usuario entra en el área de otro documento
   * Usamos esto para mostrar dónde se soltará el elemento
   */
  const handleDragEnter = (
    event: React.DragEvent<HTMLDivElement>,
    documentoId: number,
  ) => {
    event.preventDefault();
    setDragOverDocumentId(documentoId);
  };

  /**
   * Se dispara cuando el usuario sale de un documento
   */
  const handleDragLeave = () => {
    setDragOverDocumentId(null);
  };

  /**
   * Se dispara cuando el usuario suelta el elemento
   * Aquí es donde ocurre la reordenación real
   */
  const handleDrop = (
    event: React.DragEvent<HTMLDivElement>,
    targetDocumentoId: number,
  ) => {
    event.preventDefault();
    event.stopPropagation();

    if (!draggedDocumentId || draggedDocumentId === targetDocumentoId) {
      setDraggedDocumentId(null);
      setDragOverDocumentId(null);
      return;
    }

    // Encontrar los índices de los documentos involucrados
    const draggedIndex = localDocumentos.findIndex(
      (doc) => doc.docId === draggedDocumentId,
    );
    const targetIndex = localDocumentos.findIndex(
      (doc) => doc.docId === targetDocumentoId,
    );

    // Crear una copia del array y reordenar
    const nuevoArray = [...localDocumentos];
    const [draggedDoc] = nuevoArray.splice(draggedIndex, 1);
    nuevoArray.splice(targetIndex, 0, draggedDoc);

    // Actualizar el estado local
    setLocalDocumentos(nuevoArray);

    // Notificar al componente padre del cambio
    onReorder?.(nuevoArray);

    // Limpiar los estados
    setDraggedDocumentId(null);
    setDragOverDocumentId(null);
  };

  /**
   * Se dispara cuando se termina el arrastre
   */
  const handleDragEnd = () => {
    setDraggedDocumentId(null);
    setDragOverDocumentId(null);
  };

  return (
    <div className="document-list-container">
      {/* Encabezado de la sección */}
      {/* <h4 className="document-list-title">Documentos del Expediente</h4> */}

      {loading && (
        <div className="document-list-loading">Cargando documentos...</div>
      )}

      {!loading && localDocumentos.length === 0 && (
        <div className="document-list-empty">No hay documentos disponibles</div>
      )}
      {/* <div className="flex flex-row justify-between m-0 p-0">
        <p className="page-heading-kicker text-sm font-semibold uppercase tracking-[0.18em] p-0 m-0">
          Documentación Adjunta
        </p>
        <div
          className="tooltip tooltip-left"
          data-tip="Ver toda la documentación"
        >
          <Boton
            deshabilitado={false}
            estilos={"btn btn-soft btn-primary btn-sm"}
            icono={"verTodaDocumentacion"}
          />
        </div>
      </div> */}

      {/* <div className="divider"></div> */}
      {/* Contenedor de cards */}
      {!loading && localDocumentos.length > 0 && (
        <div className="document-list">
          {localDocumentos.map((documento, index) => (
            <div
              key={documento.docId}
              draggable
              onDragStart={(e) => handleDragStart(e, documento.docId!)}
              onDragOver={handleDragOver}
              onDragEnter={(e) => handleDragEnter(e, documento.docId!)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, documento.docId!)}
              onDragEnd={handleDragEnd}
              // Clases dinámicas que cambian con drag
              //   className={`
              //   h-28 relative rounded-lg border-2 cursor-move transition-all duration-200
              //   ${
              //     draggedDocumentId === documento.docId
              //       ? "opacity-50 border-dashed border-primary"
              //       : "border-base-300 hover:border-primary/50"
              //   }
              //   ${
              //     dragOverDocumentId === documento.docId
              //       ? "bg-primary/10 border-primary"
              //       : "bg-base-100"
              //   }
              // `}
              className={`document-card 
                ${selectedDocumentId === documento.docId ? "selected" : ""}
                ${
                  draggedDocumentId === documento.docId
                    ? "opacity-50 border-dashed border-primary"
                    : "border-base-300 hover:border-primary/50"
                }
                ${
                  dragOverDocumentId === documento.docId
                    ? "bg-primary/10 border-primary"
                    : "bg-base-100"
                }
              `}
            >
              {/* Indicador visual de que se puede arrastrar */}
              {/* <div className="flex items-start gap-3 absolute top-4 left-4 w-11/12"> */}
              <div className="document-card-info">
                <h5 className="document-name">
                  {" "}
                  ⋮⋮ {index + 1} - {documento.docName}
                </h5>

                <div className="document-meta">
                  <span className="document-type">{documento.tdocTypeName}</span>
                  <span className="document-date">
                    {formatDate(documento.docUploadedAt!)}
                  </span>
                  {documento.docSize && (
                    <span className="document-size">
                      {formatFileSize(documento.docSize)}
                    </span>
                  )}
                  {/* Fase 03.21, D-15: el sello se deriva de `firmas`, no de `docStatus`. */}
                  <SelloFirma
                    firmas={documento.firmas}
                    firmaRequerida={documento.firmaRequerida}
                  />
                </div>
              </div>

              <div className="document-actions">
                {accionPorDocumento?.(documento)}
                <button
                  type="button"
                  className="btn-view"
                  onClick={() => onSelectDocument(documento)}
                  title="Ver documento"
                >
                  Ver
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DocumentCards;
