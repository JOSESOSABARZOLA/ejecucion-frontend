/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/obligacion-hacer (frontend)
 * Feature: La rama del correctivo en pantalla — tramo del CUMPLIMIENTO (Fase 03.18, Plan 05)
 * Archivo: SelectorDocumentoExpediente.tsx
 * Responsabilidad: Elegir el `docId` que un acto de la rama cita, de la LISTA de documentos del
 *   expediente (`EpasService.getDocumentos`), nunca de una caja de número.
 *
 *   ── POR QUÉ NO ES UN `type="number"` ─────────────────────────────────────────────────────────
 *   🔴 Dos endpoints de este plan —`acreditar` e `incumplimiento`— exigen un `docId`. Pedirle a un
 *   decisor que teclee un identificador interno es pedirle que se equivoque EN SILENCIO: un dígito
 *   de más apunta a otro documento, y el acto queda firmado citando una prueba que no es la suya.
 *   Es la mitigación de T-0318-20 en la pantalla; la PERTENENCIA del documento al expediente la
 *   vuelve a comprobar el servidor, que es donde de verdad se impone.
 *
 *   ── LO QUE ESTE SELECTOR NO PUEDE HACER, Y POR QUÉ (medido) ──────────────────────────────────
 *   ⚠️ `GET /epas/:eejeId/documentos` **NO expone el SUBTIPO documental**. Su consulta
 *   (`EpasRepository.findDocumentos`) hace el JOIN contra `t_subtipo_documento` pero solo proyecta
 *   `td.tdoc_type_name` —el TIPO—, así que `ExpedienteDocumento` llega sin `tsdoc_subtype`. El
 *   subtipo del informe de control y verificación EXISTE en la base y otra consulta del MISMO
 *   repositorio —`findPiezasExportables`— sí lo proyecta (`ts.tsdoc_subtype_name`): falta una línea
 *   de SELECT, no un dato.
 *
 *   Consecuencia: aquí NO se puede filtrar ni preseleccionar por subtipo. Se ofrecen TODOS los
 *   documentos activos del expediente con su nombre, su tipo y su fecha, que es lo que el decisor
 *   reconoce. Queda anotado como defecto de backend FUERA DE ALCANCE (D-3): esta fase no toca
 *   `ejecucion-backend/src`.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-09-15
 */
import { useEffect, useState } from "react";
import {
  EpasService,
  type ExpedienteDocumento,
} from "../../services/EpasService";
import { describirDocumento } from "./comunes";

/** Las tres situaciones en que puede estar la lista. Un solo estado: nunca se contradicen. */
type EstadoLista =
  | { fase: "cargando" }
  | { fase: "listo"; docs: ExpedienteDocumento[] }
  | { fase: "error" };

interface Props {
  /** EPAS cuyo expediente se lista. */
  eejeId: number;
  /** El documento elegido, o `null` mientras no se elija ninguno. */
  valor: number | null;
  /** Avisa del documento elegido y de su descripción, para que el padre la pinte al confirmar. */
  onChange: (docId: number | null, descripcion: string) => void;
  /** Texto de la etiqueta: cada acto cita el documento por una razón distinta. */
  etiqueta: string;
  /** La frase que explica QUÉ documento hay que elegir. */
  ayuda: string;
  deshabilitado?: boolean;
}

export const SelectorDocumentoExpediente = ({
  eejeId,
  valor,
  onChange,
  etiqueta,
  ayuda,
  deshabilitado = false,
}: Props) => {
  // Un único estado en vez de tres banderas, y que arranca YA en «cargando»: así el efecto no
  // llama a `setState` en su cuerpo —lo que encadena renders— sino solo en las respuestas.
  const [estado, setEstado] = useState<EstadoLista>({ fase: "cargando" });

  useEffect(() => {
    let vivo = true;
    EpasService.getDocumentos(eejeId)
      .then((data) => {
        if (vivo) {
          setEstado({ fase: "listo", docs: Array.isArray(data) ? data : [] });
        }
      })
      .catch(() => {
        if (vivo) setEstado({ fase: "error" });
      });
    return () => {
      vivo = false;
    };
  }, [eejeId]);

  const docs = estado.fase === "listo" ? estado.docs : [];
  const vacio = estado.fase === "listo" && docs.length === 0;

  return (
    <label className="flex flex-col gap-1">
      <span className="font-medium">{etiqueta}</span>

      <select
        className="select select-bordered w-full"
        aria-label={etiqueta}
        value={valor ?? ""}
        disabled={deshabilitado || estado.fase !== "listo" || vacio}
        onChange={(e) => {
          const elegido = e.target.value ? Number(e.target.value) : null;
          const doc = docs.find((d) => d.docId === elegido);
          onChange(elegido, doc ? describirDocumento(doc) : "—");
        }}
      >
        {/* 🔴 SIN PRESELECCIÓN. Preseleccionar el primero haría que un decisor apurado citara como
            prueba el documento que la lista puso arriba, no el que él eligió. */}
        <option value="">
          {estado.fase === "cargando"
            ? "Cargando los documentos del expediente…"
            : "Elija el documento del expediente"}
        </option>
        {docs.map((doc) => (
          <option
            key={doc.docId}
            value={doc.docId}
          >
            {describirDocumento(doc)}
          </option>
        ))}
      </select>

      <span className="text-sm opacity-70">{ayuda}</span>

      {estado.fase === "error" && (
        <span className="text-sm text-error">
          No se pudieron cargar los documentos del expediente (integración
          pendiente). Sin la lista no se puede citar el documento: vuelva a
          intentarlo más tarde.
        </span>
      )}

      {vacio && (
        <span className="text-sm text-error">
          El expediente no tiene documentos registrados. Primero hay que subir
          el documento que sustenta el acto.
        </span>
      )}
    </label>
  );
};

export default SelectorDocumentoExpediente;
