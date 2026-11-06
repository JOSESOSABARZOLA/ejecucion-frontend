import { useState, useEffect } from "react";
import { Document as PDFDocument, Page, pdfjs } from "react-pdf";
import type { IDocument } from "../../interfaces/IDocument";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import "../../styles/pdf/pdf-viewer.css";

type PDFDocument = IDocument;

// Configurar el worker de pdfjs desde la carpeta public
pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.js";

/**
 * Componente Arrow para los botones de navegación
 * Renderiza una flecha hacia arriba (anterior) o hacia abajo (siguiente)
 */
interface ArrowProps {
  direction: "up" | "down";
}

const Arrow = ({ direction }: ArrowProps) => {
  return (
    <span className={`pdf-arrow pdf-arrow-${direction}`}>
      {direction === "up" ? "↑" : "↓"}
    </span>
  );
};

interface PDFViewerProps {
  document: PDFDocument;
  loading?: boolean;
  /**
   * Ancho BASE de la página, en píxeles. Por defecto 600, que es lo que cabe en un modal a pantalla
   * completa. Se baja cuando el visor vive en una columna lateral —la vista previa del borrador—,
   * donde 600 se sale y obliga a desplazarse en horizontal para leer. El zoom multiplica SOBRE este
   * ancho, así que cada sitio conserva su punto de partida.
   */
  width?: number;
}

/** Límites del zoom: 0,5 entra una página entera; 3 deja leer una cifra del cuadro de horas. */
const ESCALA_MIN = 0.5;
const ESCALA_MAX = 3;
const ESCALA_PASO = 0.25;

export const PDFViewer = ({
  document,
  loading = false,
  width = 600,
}: PDFViewerProps) => {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  /** Multiplicador del ancho. 1 = el ancho base con el que se montó el visor. */
  const [escala, setEscala] = useState(1);

  useEffect(() => {
    setNumPages(null);
    setError(null);
    // 🔴 NI la página NI el zoom se reinician al cambiar el documento, y no es un descuido: la vista
    // previa del borrador se REGENERA sola cada vez que el decisor deja de escribir. Reiniciando,
    // quien estuviera leyendo la página 2 ampliada volvía a la 1 al tamaño de siempre cada segundo y
    // medio. La página se acota al cargar, que es cuando se sabe cuántas hay.
  }, [document]);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    // Acotar y no reiniciar: si el documento nuevo tiene menos páginas, se cae a la última.
    setCurrentPage((previa) => Math.min(Math.max(1, previa), numPages));
  };

  const alejar = () =>
    setEscala((e) =>
      Math.max(ESCALA_MIN, Number((e - ESCALA_PASO).toFixed(2))),
    );

  const acercar = () =>
    setEscala((e) =>
      Math.min(ESCALA_MAX, Number((e + ESCALA_PASO).toFixed(2))),
    );

  const onDocumentLoadError = (error: Error) => {
    console.error("Error loading PDF:", error);
    setError("Error al cargar el PDF. Por favor, intenta de nuevo.");
  };

  const goToPreviousPage = () => {
    setCurrentPage((prev) => Math.max(1, prev - 1));
  };

  const goToNextPage = () => {
    if (numPages) {
      setCurrentPage((prev) => Math.min(numPages, prev + 1));
    }
  };

  const goToPage = (pageNumber: number) => {
    if (numPages && pageNumber > 0 && pageNumber <= numPages) {
      setCurrentPage(pageNumber);
    }
  };

  return (
    <div className="pdf-viewer-container">
      {loading && <div className="pdf-loading">Cargando documento...</div>}

      {error && <div className="pdf-error">{error}</div>}

      {/* <div className="pdf-header">
        <h3 className="pdf-title">{document.documentName}</h3>
        <span className="pdf-type">{document.documentType}</span>
      </div> */}

      <div className="pdf-content">
        {!error && (
          <PDFDocument
            file={document.docUrl}
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={onDocumentLoadError}
            loading={<div className="pdf-loading-spinner">Cargando PDF...</div>}
            error={<div className="pdf-error">Error al cargar el PDF</div>}
          >
            <Page pageNumber={currentPage} width={Math.round(width * escala)} />
          </PDFDocument>
        )}
      </div>

      {/* Zoom. Va SIEMPRE que el documento haya cargado, aunque tenga una sola página: el motivo de
          ampliar no es navegar, es leer el cuadro de horas y las cifras del acto. */}
      {!error && numPages && (
        <div className="pdf-zoom" role="group" aria-label="Zoom del documento">
          <button
            type="button"
            className="pdf-btn pdf-zoom-btn"
            onClick={alejar}
            disabled={escala <= ESCALA_MIN}
            aria-label="Alejar"
            title="Alejar"
          >
            −
          </button>
          <button
            type="button"
            className="pdf-zoom-nivel"
            onClick={() => setEscala(1)}
            disabled={escala === 1}
            aria-label="Restablecer el zoom"
            title="Restablecer el zoom"
          >
            {Math.round(escala * 100)}%
          </button>
          <button
            type="button"
            className="pdf-btn pdf-zoom-btn"
            onClick={acercar}
            disabled={escala >= ESCALA_MAX}
            aria-label="Acercar"
            title="Acercar"
          >
            +
          </button>
        </div>
      )}
      {/* Controles de navegación vertical - FUERA de pdf-content, al nivel del contenedor principal */}
      {!error && numPages && (
        <div className="pdf-controls pdf-controls-vertical">
          {/* Botón página anterior */}
          <button
            type="button"
            className="pdf-btn pdf-btn-nav-vertical pdf-btn-prev"
            onClick={goToPreviousPage}
            disabled={currentPage === 1}
            aria-label="Página anterior"
            title="Página anterior"
          >
            <Arrow direction="up" />
          </button>

          {/* Indicador de página actual */}
          <div className="pdf-page-indicator">
            <input
              type="number"
              min="1"
              max={numPages}
              value={currentPage}
              onChange={(e) => goToPage(parseInt(e.target.value, 10))}
              className="pdf-page-input-vertical"
              aria-label={`Página actual: ${currentPage} de ${numPages}`}
            />
            <span className="pdf-page-divider">/</span>
            <span className="pdf-page-total-vertical">{numPages}</span>
          </div>

          {/* Botón página siguiente */}
          <button
            type="button"
            className="pdf-btn pdf-btn-nav-vertical pdf-btn-next"
            onClick={goToNextPage}
            disabled={currentPage === numPages}
            aria-label="Página siguiente"
            title="Página siguiente"
          >
            <Arrow direction="down" />
          </button>
        </div>
      )}
    </div>
  );
};
