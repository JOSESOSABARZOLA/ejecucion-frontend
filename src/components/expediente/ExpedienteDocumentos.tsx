/**
 * Microservicio: ejecucion
 * Módulo: Expediente (compartido)
 * Feature: Lista de documentos del expediente de un EPAS, que se abren en el ModalDocumentViewer
 * Archivo: ExpedienteDocumentos.tsx
 * Responsabilidad: Cargar on-demand los documentos de un EPAS (GET /epas/:eejeId/documentos) y
 *   listarlos; cada documento abre en el visor PDF en MODAL (openModal("documentViewer", ...)), NO
 *   en pestaña externa. Degrada con gracia: "cargando" / "integración pendiente" (404) / "sin
 *   documentos". Reutilizado por la Bandeja de Entrada, «Actas de Sorteo» y «Mis Expedientes»
 *   para no duplicar la lógica.
 *
 *   ── ESTE COMPONENTE YA NO SUBE NADA (encargo del usuario, 2026-09-17) ────────────────────────
 *   Hasta hoy llevaba incrustado el formulario «Adjuntar documento al expediente», gateado con
 *   `permiteAnexar`. Se fue a `ModalAnexarDocumento`, que se abre desde un botón en la CABECERA DE
 *   LA FILA, junto a las demás acciones del expediente. Con él se fue el prop: ya no gatea nada
 *   —cada página decide si pinta el botón—, así que pedirlo sería pedir un dato que no se usa.
 *
 *   ── `recargaSenal`: cómo se entera la lista de que hubo un anexo ─────────────────────────────
 *   El formulario incrustado tenía un contador interno (`recarga`) y se refrescaba solo. Ahora el
 *   que sube vive FUERA, así que la señal entra por prop: la página lleva el contador y lo
 *   incrementa en el `onSuccess` del modal. Es el mismo mecanismo de siempre —una dependencia más
 *   del `useEffect`—, no un bus de eventos ni un contexto nuevo.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-07-27
 * Modificado por: Andrés Miño — 2026-09-17 (quick 260917-anx: fuera el formulario incrustado y su
 *   prop `permiteAnexar`; entra `recargaSenal`).
 * Modificado por: Andrés Miño — 2026-10-26 (Fase 03.21, Plan 11, D-15/D-26, UI-SPEC §8.2: cada
 *   documento monta `SelloFirma` bajo su fila de nombre + tipo; el `<li>` pasa a columna).
 * Modificado por: Andrés Miño — 2026-10-29 (prop `onAbrirDocumento`: dentro de la ficha del
 *   expediente el documento se ve en la misma pestaña; abrirlo en el modal del visor REEMPLAZABA la
 *   ficha —solo hay un modal a la vez— y al cerrarlo no se volvía a ella)
 * Modificado por: Andrés Miño — 2026-10-30 (quick 261030-dun: con `mostrarOtrosModulos` pinta debajo
 *   «Documentos de otros módulos» —Inspección, Instrucción, Resolución y Secretaría General—; los
 *   estados cargando / error / vacío pasan a ser el contenido de la sección propia para que la de
 *   otros módulos salga también cuando la propia está vacía o falló)
 * Modificado por: Andrés Miño — 2026-11-04 (quick 261030-m29: marca «Nuevo» POR USUARIO. En paralelo
 *   a la lista pide `GET /documentos-lectura/epas/:eejeId`; el documento propio que el usuario no
 *   abrió lleva `MarcaNuevo`, y abrirlo quita la marca, marca la lectura en segundo plano y avisa
 *   con `onLeido` —la ficha baja su contador—. Si las lecturas fallan, la lista sale igual sin
 *   marcas: la marca informa, no gobierna. `onLeido` se reenvía a «Documentos de otros módulos»)
 */
import { useEffect, useState, type ReactElement } from "react";
import { useModal } from "../../hooks/useModal";
import {
  EpasService,
  type ExpedienteDocumento,
} from "../../services/EpasService";
import type { IDocumentoExterno } from "../../interfaces/IDocumentosExternos";
import { DocumentosLecturaService } from "../../services/DocumentosLecturaService";
import MarcaNuevo from "../common/MarcaNuevo";
import DocumentosOtrosModulos from "./DocumentosOtrosModulos";
import SelloFirma from "./SelloFirma";

interface ExpedienteDocumentosProps {
  eejeId: number;
  /**
   * Señal de recarga que manda la página: cada valor NUEVO vuelve a pedir la lista. La incrementa
   * el `onSuccess` del modal de anexos tras una subida correcta.
   */
  recargaSenal?: number;
  /**
   * Quién muestra el documento pulsado. Sin él se abre en el modal del visor, que es lo correcto en
   * una PÁGINA. Desde DENTRO de otro modal (la ficha del expediente) hay que pasarlo: `ModalProvider`
   * sostiene un solo modal, y abrir el visor reemplazaría la ficha sin camino de vuelta.
   */
  onAbrirDocumento?: (doc: ExpedienteDocumento) => void;
  /** docId del documento que se está mostrando, para resaltar su fila. */
  docIdAbierto?: number;
  /**
   * Pinta debajo los documentos de los OTROS módulos (quick 261030-dun). Apagado por defecto:
   * `ActasSorteoPage` monta una lista por caso y no debe multiplicar consultas a cuatro módulos.
   */
  mostrarOtrosModulos?: boolean;
  /** Quién muestra un documento de otro módulo (dentro de la ficha). Sin él, el modal del visor. */
  onAbrirDocumentoExterno?: (doc: IDocumentoExterno) => void;
  /** `archivoUrl` del documento externo que se está mostrando, para resaltar su fila. */
  urlExternaAbierta?: string;
  /**
   * Se llama UNA vez por cada documento con la marca «Nuevo» que el usuario abre aquí —propio o de
   * otro módulo— (quick 261030-m29). La ficha lo usa para bajar el contador de su pestaña.
   */
  onLeido?: () => void;
}

export const ExpedienteDocumentos = ({
  eejeId,
  recargaSenal = 0,
  onAbrirDocumento,
  docIdAbierto,
  mostrarOtrosModulos = false,
  onAbrirDocumentoExterno,
  urlExternaAbierta,
  onLeido,
}: ExpedienteDocumentosProps) => {
  const { openModal } = useModal();
  const [docs, setDocs] = useState<ExpedienteDocumento[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(false);
  /**
   * Los `doc_id` propios que el usuario aún no abrió, con la CLAVE de la consulta que los produjo:
   * si la clave actual no coincide (otro EPAS, o una recarga en vuelo de otro expediente), no se
   * marca nada. Así una respuesta vieja no pinta marcas en la lista de otro expediente y el efecto
   * no llama a ningún setter de forma síncrona.
   */
  const claveLectura = `${eejeId}:${recargaSenal}`;
  const [noLeidos, setNoLeidos] = useState<{
    clave: string;
    ids: ReadonlySet<number>;
  } | null>(null);
  const noLeidosVigentes =
    noLeidos?.clave === claveLectura ? noLeidos.ids : null;

  useEffect(() => {
    let vivo = true;
    setCargando(true);
    setError(false);
    EpasService.getDocumentos(eejeId)
      .then((data) => {
        if (vivo) setDocs(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (vivo) setError(true);
      })
      .finally(() => {
        if (vivo) setCargando(false);
      });
    return () => {
      vivo = false;
    };
  }, [eejeId, recargaSenal]);

  // Las lecturas, en paralelo y por su cuenta: su fallo NO toca la lista (sin marcas y ya).
  useEffect(() => {
    let vivo = true;
    const consulta = `${eejeId}:${recargaSenal}`;
    DocumentosLecturaService.noLeidosDelEpas(eejeId)
      .then((data) => {
        if (!vivo) return;
        const propios = Array.isArray(data?.propios) ? data.propios : [];
        setNoLeidos({ clave: consulta, ids: new Set(propios) });
      })
      .catch(() => {
        if (vivo) setNoLeidos({ clave: consulta, ids: new Set() });
      });
    return () => {
      vivo = false;
    };
  }, [eejeId, recargaSenal]);

  /**
   * Abre el documento y, si llevaba la marca «Nuevo», la quita, marca la lectura en segundo plano y
   * avisa con `onLeido`. Un fallo al marcar no se le dice al usuario —el documento ya se abrió—: se
   * deja en consola sin datos del expediente y la próxima carga lo volverá a marcar como nuevo.
   */
  const abrir = (doc: ExpedienteDocumento) => {
    if (noLeidosVigentes?.has(doc.docId)) {
      setNoLeidos((previo) => {
        if (!previo) return previo;
        const ids = new Set(previo.ids);
        ids.delete(doc.docId);
        return { ...previo, ids };
      });
      DocumentosLecturaService.marcarPropio(eejeId, doc.docId).catch(() => {
        console.warn("No se pudo registrar la lectura del documento.");
      });
      onLeido?.();
    }
    if (onAbrirDocumento) {
      onAbrirDocumento(doc);
    } else {
      openModal("documentViewer", {
        docName: doc.docName,
        docUrl: doc.docUrl,
      });
    }
  };

  // Lo PROPIO: cargando / error / vacío / lista. Antes eran retornos tempranos; ahora son el
  // contenido de la sección propia para que «Documentos de otros módulos» salga igual debajo.
  let propios: ReactElement;
  if (cargando) {
    propios = (
      <span className="text-xs text-base-content/70">Cargando documentos…</span>
    );
  } else if (error) {
    propios = (
      <span className="text-xs text-base-content/70">
        No se pudieron cargar los documentos (integración pendiente).
      </span>
    );
  } else if (docs.length === 0) {
    propios = (
      <span className="text-xs text-base-content/70">
        Sin documentos registrados.
      </span>
    );
  } else {
    propios = (
      <ul className="flex flex-col gap-1">
        {docs.map((doc) => (
          <li
            key={doc.docId}
            className="flex flex-col gap-1"
          >
            {/* Fase 03.21, D-15 (UI-SPEC §8.2): el <li> pasa a columna. Arriba la fila de siempre
                —nombre + chip de tipo—; debajo, el sello «Firmado» con una línea por firma, o el chip
                «Sin firma» de lo que la requería (D-26). Sin firmas ni `firmaRequerida` el sello no
                pinta nada y el documento se ve como antes. */}
            <div className="flex items-center gap-2">
              {doc.docUrl ? (
                <button
                  type="button"
                  className={`link link-primary text-left text-sm${
                    docIdAbierto === doc.docId ? " font-semibold" : ""
                  }`}
                  aria-current={docIdAbierto === doc.docId ? "true" : undefined}
                  onClick={() => abrir(doc)}
                >
                  {doc.docName}
                </button>
              ) : (
                <span className="text-sm">{doc.docName}</span>
              )}
              {/* Fuera del botón: no cambia su nombre accesible. */}
              {noLeidosVigentes?.has(doc.docId) && <MarcaNuevo />}
              {doc.tdocTypeName && (
                <span className="badge badge-outline badge-sm">
                  {doc.tdocTypeName}
                </span>
              )}
            </div>
            <SelloFirma
              firmas={doc.firmas}
              firmaRequerida={doc.firmaRequerida}
            />
          </li>
        ))}
      </ul>
    );
  }

  if (!mostrarOtrosModulos) return propios;

  return (
    <div className="flex flex-col gap-3">
      {propios}
      <div className="divider my-0" />
      <section
        aria-label="Documentos de otros módulos"
        className="flex flex-col gap-2"
      >
        <h3 className="text-sm font-bold">Documentos de otros módulos</h3>
        <DocumentosOtrosModulos
          eejeId={eejeId}
          recargaSenal={recargaSenal}
          onAbrirDocumento={onAbrirDocumentoExterno}
          urlAbierta={urlExternaAbierta}
          onLeido={onLeido}
        />
      </section>
    </div>
  );
};

export default ExpedienteDocumentos;
