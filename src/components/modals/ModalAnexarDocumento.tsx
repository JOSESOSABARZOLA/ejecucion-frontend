/**
 * Microservicio: ejecucion
 * Módulo: Expediente (compartido)
 * Feature: Anexo libre de documentos al expediente de un EPAS, desde un MODAL
 * Archivo: ModalAnexarDocumento.tsx
 * Responsabilidad: Capturar la DESCRIPCIÓN y el PDF de un anexo libre y subirlo
 *   (`EpasService.adjuntarAnexo` → POST /epas/:eejeId/documentos, multipart). Al terminar avisa con
 *   un toast, cierra y dispara el `onSuccess` con que la página abrió el modal — que es lo que hace
 *   que la lista de documentos de la fila se vuelva a pedir.
 *
 *   ── POR QUÉ DEJÓ DE SER UN FORMULARIO INCRUSTADO (encargo del usuario, 2026-09-17) ───────────
 *   Vivía dentro de `ExpedienteDocumentos`, debajo de la lista, y se repetía en cada fila abierta
 *   de cada bandeja: cuatro controles permanentes para un acto ocasional. Ahora es un BOTÓN en la
 *   cabecera de la fila, junto a las demás acciones del expediente, y un modal detrás. El gesto es
 *   el mismo en las dos pantallas que lo ofrecen.
 *
 *   ── 🔴 EL MENSAJE DEL SERVIDOR SE MUESTRA TAL CUAL ──────────────────────────────────────────
 *   La ventana en que se puede anexar la decide el BACKEND (desde que hay decisor asignado hasta la
 *   remisión a SG) y aquí NO se replica esa regla. Cuando rechaza, su frase es la que explica CUÁL
 *   de las dos puertas está cerrada; sustituirla por un «No se pudo adjuntar el documento» genérico
 *   escondería la razón real y dejaría al funcionario reintentando a ciegas. El texto propio solo
 *   aparece cuando el error viene mudo (sin `message`).
 * Desarrollador: Andrés Miño
 * Fecha: 2026-09-17
 * Modificado por: Andrés Miño — 2026-10-28 (quick 261028-kmg: la subida fallida se dice en el aviso
 *   flotante, con el texto del servidor tal cual; el aviso del archivo inválido sigue bajo su campo)
 */
import { mensajeParaUsuario } from "../../api/mensajeParaUsuario";
import { useState } from "react";
import { useCierreModal } from "../../hooks/useCierreModal";
import { useModal } from "../../hooks/useModal";
import { useToast } from "../../hooks/useToast";
import { EpasService } from "../../services/EpasService";
import { validarPdf } from "../obligacion-hacer/comunes";

export const MODAL_KEY = "anexarDocumento" as const;

/** Mínimo de la descripción. Mismo valor que tenía el formulario incrustado. */
const DESCRIPCION_MINIMA = 4;

/**
 * La fila tal y como llega por `openModal(MODAL_KEY, { eejeId }, { onSuccess })` → `ModalContainer`
 * → `caseData`. Solo hace falta el EPAS: sin él no hay ruta a la que llamar.
 */
interface FilaConEpas {
  eejeId?: number;
  expNumber?: string;
}

interface ModalAnexarDocumentoProps {
  caseData: FilaConEpas;
  onClose: () => void;
  refetchFn?: () => Promise<void> | undefined;
}

const ModalAnexarDocumento = ({
  caseData,
  onClose,
  refetchFn,
}: ModalAnexarDocumentoProps) => {
  const { addToast } = useToast();
  // `triggerSuccess` dispara el `onSuccess` de la página Y cierra: es el canal por el que la lista
  // de documentos —que ahora vive FUERA de este modal— se entera de que hay un anexo nuevo.
  const { triggerSuccess } = useModal();
  const { eejeId, expNumber } = caseData;

  const [descripcion, setDescripcion] = useState("");
  const [archivo, setArchivo] = useState<File | null>(null);
  const [subiendo, setSubiendo] = useState(false);

  // Cierre al pulsar fuera (quick 261019-mcf): una descripción o un archivo elegido son trabajo
  // sin guardar; mientras sube, el fondo no cierra.
  useCierreModal({
    hayCambios: descripcion.trim() !== "" || archivo !== null,
    ocupado: subiendo,
  });

  if (eejeId == null) {
    return (
      <div className="modal-box max-w-lg">
        <p className="app-modules-modal-kicker">Ejecución — DME · Expediente</p>
        <h3 className="text-lg font-semibold">Adjuntar documento</h3>
        <p className="mt-2 text-sm">
          No se pudo identificar el EPAS de esta fila. Cierre y vuelva a
          intentarlo.
        </p>
        <div className="modal-action">
          <button
            type="button"
            className="btn"
            onClick={onClose}
          >
            Cerrar
          </button>
        </div>
      </div>
    );
  }

  const expediente = expNumber ?? `EPAS #${eejeId}`;

  /**
   * Lo que falla del archivo, si algo falla. Se reutiliza `validarPdf` de la rama de obligación de
   * hacer en vez de escribir otra comprobación: es la misma regla (PDF y 10 MB), y dos versiones de
   * la misma regla acaban divergiendo el día que el backend mueva el límite.
   *
   * 🔴 El `accept="application/pdf"` del input NO es una validación: es una sugerencia del diálogo
   * del sistema, y el usuario puede saltársela eligiendo «todos los archivos». Sin esto, un `.docx`
   * o un escaneo de 40 MB llegaban al servidor para que los rechazara él — y el aviso aparecía
   * después de esperar la subida entera.
   */
  const avisoArchivo = archivo ? validarPdf(archivo, "El documento") : null;

  const puedeSubir =
    !!archivo &&
    !avisoArchivo &&
    descripcion.trim().length >= DESCRIPCION_MINIMA &&
    !subiendo;

  const subir = async () => {
    if (!archivo || !puedeSubir) return;
    const nombre = descripcion.trim();
    setSubiendo(true);
    try {
      await EpasService.adjuntarAnexo(eejeId, nombre, archivo);
      addToast("success", `Anexo «${nombre}» agregado al expediente.`);
      if (refetchFn) await refetchFn();
      triggerSuccess({ eejeId });
    } catch (err) {
      // El error del backend se muestra TAL CUAL, en el aviso flotante: es el que explica la
      // ventana (sin decisor asignado, o ya remitido a SG) y fingir un mensaje propio ocultaría la
      // razón real.
      addToast(
        "error",
        mensajeParaUsuario(err, "No se pudo adjuntar el documento."),
      );
    } finally {
      setSubiendo(false);
    }
  };

  return (
    <div className="modal-box max-w-2xl">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="app-modules-modal-kicker">
            Ejecución — DME · Expediente
          </p>
          <h3 className="text-lg font-semibold">
            Adjuntar documento al expediente
          </h3>
          <p className="text-sm opacity-70">{expediente}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="app-modules-modal-close shrink-0"
          aria-label="Cerrar modal"
        >
          ×
        </button>
      </div>

      <div className="mt-4 flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="font-medium">
            Descripción del anexo (obligatoria)
          </span>
          <input
            type="text"
            className="input input-bordered w-full"
            placeholder="Qué es el documento (obligatorio)"
            value={descripcion}
            disabled={subiendo}
            onChange={(e) => setDescripcion(e.target.value)}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="font-medium">Documento (PDF, obligatorio)</span>
          <input
            type="file"
            accept="application/pdf"
            className="file-input file-input-bordered w-full"
            disabled={subiendo}
            onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
          />
          <span className="text-sm text-base-content/70">
            Solo PDF. La descripción es lo que se guarda como nombre: un
            «escaneo_004.pdf» no le dice nada a quien abra el expediente dentro
            de seis meses.
          </span>
        </label>

        {/* El aviso del ARCHIVO es de CAMPO: el usuario lo puede arreglar solo, sin esperar a una
            subida que se va a rechazar. El del servidor sale en el aviso flotante. */}
        {avisoArchivo && (
          <span className="text-sm text-error">{avisoArchivo}</span>
        )}
      </div>

      <div className="modal-action">
        <button
          type="button"
          className="app-modules-modal-cancel btn"
          disabled={subiendo}
          onClick={onClose}
        >
          Cancelar
        </button>
        <button
          type="button"
          className="app-modules-modal-submit btn"
          disabled={!puedeSubir}
          onClick={() => void subir()}
        >
          {subiendo ? "Subiendo…" : "Adjuntar"}
        </button>
      </div>
    </div>
  );
};

export default ModalAnexarDocumento;
