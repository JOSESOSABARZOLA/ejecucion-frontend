/**
 * Microservicio: ejecucion
 * Módulo: Expediente (compartido)
 * Feature: Documentos del expediente de los OTROS módulos (Inspección, Instrucción, Resolución y
 *   Secretaría General)
 * Archivo: DocumentosOtrosModulos.tsx
 * Responsabilidad: Pedir `GET /epas/:eejeId/documentos-externos` y listar, agrupados por módulo y
 *   en el orden que manda el backend, los documentos emitidos que cada módulo tiene del mismo caso
 *   de Core. Cada módulo dice su estado: documentos, «Sin documentos emitidos.», su error o su
 *   motivo de deshabilitado; y la insignia «Simulado» mientras ese módulo no publique su servicio.
 *   Los documentos se abren como los propios: con `onAbrirDocumento` (dentro de la ficha) o en el
 *   modal del visor.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-10-30
 * Modificado por: Andrés Miño — 2026-11-04 (quick 261030-m29: un documento con `nuevo: true` lleva
 *   `MarcaNuevo`; abrirlo marca su lectura —con su módulo y su docId— en segundo plano, lo deja
 *   `nuevo: false` en la vista y llama a `onLeido`)
 */
import { useEffect, useState } from "react";
import { mensajeParaUsuario } from "../../api/mensajeParaUsuario";
import { useModal } from "../../hooks/useModal";
import type {
  IDocumentoExterno,
  IModuloDocumentosExternos,
  ModuloExternoCodigo,
} from "../../interfaces/IDocumentosExternos";
import { DocumentosLecturaService } from "../../services/DocumentosLecturaService";
import { EpasService } from "../../services/EpasService";
import MarcaNuevo from "../common/MarcaNuevo";
import { DatetimeUtil } from "../../utils/datetime.util";

interface DocumentosOtrosModulosProps {
  eejeId: number;
  /** Señal de recarga de la página: cada valor NUEVO vuelve a pedir la lista. */
  recargaSenal?: number;
  /** Quién muestra el documento pulsado (dentro de otro modal). Sin él, el modal del visor. */
  onAbrirDocumento?: (doc: IDocumentoExterno) => void;
  /** `archivoUrl` del documento que se está mostrando, para resaltar su fila. */
  urlAbierta?: string;
  /** Se llama una vez por cada documento con la marca «Nuevo» que se abre (quick 261030-m29). */
  onLeido?: () => void;
}

const MENSAJE_FALLO_TOTAL =
  "No se pudieron consultar los documentos de otros módulos.";

const DocumentosOtrosModulos = ({
  eejeId,
  recargaSenal = 0,
  onAbrirDocumento,
  urlAbierta,
  onLeido,
}: DocumentosOtrosModulosProps) => {
  const { openModal } = useModal();
  // El resultado lleva la CLAVE de la consulta que lo produjo: «cargando» se DERIVA de que la clave
  // actual aún no tiene resultado. Así el efecto no llama a ningún setter de forma síncrona (regla
  // `react-hooks/set-state-in-effect`) y una respuesta vieja nunca pisa la de otra consulta.
  const clave = `${eejeId}:${recargaSenal}`;
  const [resultado, setResultado] = useState<{
    clave: string;
    modulos: IModuloDocumentosExternos[];
    error: string | null;
  } | null>(null);

  useEffect(() => {
    let vivo = true;
    const consulta = `${eejeId}:${recargaSenal}`;
    EpasService.getDocumentosExternos(eejeId)
      .then((data) => {
        if (vivo) {
          setResultado({
            clave: consulta,
            modulos: Array.isArray(data?.modulos) ? data.modulos : [],
            error: null,
          });
        }
      })
      .catch((e: unknown) => {
        if (vivo) {
          setResultado({
            clave: consulta,
            modulos: [],
            error: mensajeParaUsuario(e, MENSAJE_FALLO_TOTAL),
          });
        }
      });
    return () => {
      vivo = false;
    };
  }, [eejeId, recargaSenal]);

  const cargando = resultado?.clave !== clave;
  const error = cargando ? null : resultado.error;
  const modulos = cargando ? [] : resultado.modulos;

  if (cargando) {
    return (
      <span className="text-xs text-base-content/70">
        Cargando documentos de otros módulos…
      </span>
    );
  }
  if (error) {
    return <span className="text-xs text-error">{error}</span>;
  }

  /**
   * Abre el documento y, si era nuevo para el usuario, lo deja leído en la vista, marca la lectura
   * en segundo plano y avisa con `onLeido`. El fallo al marcar solo va a la consola (sin datos): el
   * documento ya se abrió y la próxima carga lo volverá a enseñar como nuevo.
   */
  const abrir = (modulo: ModuloExternoCodigo, doc: IDocumentoExterno) => {
    if (doc.nuevo === true) {
      setResultado((previo) =>
        previo
          ? {
              ...previo,
              modulos: previo.modulos.map((m) =>
                m.modulo !== modulo
                  ? m
                  : {
                      ...m,
                      documentos: m.documentos.map((d) =>
                        d.docId === doc.docId ? { ...d, nuevo: false } : d,
                      ),
                    },
              ),
            }
          : previo,
      );
      DocumentosLecturaService.marcarExterno(eejeId, modulo, doc.docId).catch(
        () => {
          console.warn("No se pudo registrar la lectura del documento.");
        },
      );
      onLeido?.();
    }
    if (onAbrirDocumento) {
      onAbrirDocumento(doc);
    } else {
      openModal("documentViewer", {
        docName: doc.nombre,
        docUrl: doc.archivoUrl,
      });
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {modulos.map((modulo) => (
        <section
          key={modulo.modulo}
          aria-label={modulo.nombre}
          className="flex flex-col gap-1"
        >
          <h4 className="flex items-center gap-2 text-sm font-semibold">
            {modulo.nombre}
            {modulo.simulado && (
              <span className="badge badge-warning badge-sm">Simulado</span>
            )}
          </h4>
          <ContenidoModulo
            modulo={modulo}
            urlAbierta={urlAbierta}
            onAbrir={(doc) => abrir(modulo.modulo, doc)}
          />
        </section>
      ))}
    </div>
  );
};

interface ContenidoModuloProps {
  modulo: IModuloDocumentosExternos;
  urlAbierta?: string;
  onAbrir: (doc: IDocumentoExterno) => void;
}

/** Lo de UN módulo según su estado. */
const ContenidoModulo = ({ modulo, urlAbierta, onAbrir }: ContenidoModuloProps) => {
  if (modulo.estado === "error") {
    return (
      <span className="text-xs text-error">
        {modulo.mensaje ?? "No se pudo consultar este módulo."}
      </span>
    );
  }
  if (modulo.estado === "deshabilitado") {
    return (
      <span className="text-xs text-base-content/70">
        {modulo.mensaje ?? "La consulta a este módulo no está habilitada."}
      </span>
    );
  }
  if (modulo.documentos.length === 0) {
    return (
      <span className="text-xs text-base-content/70">
        Sin documentos emitidos.
      </span>
    );
  }

  return (
    <ul className="flex flex-col gap-1">
      {modulo.documentos.map((doc) => {
        const abierto = urlAbierta !== undefined && urlAbierta === doc.archivoUrl;
        return (
          <li key={doc.docId} className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <button
                type="button"
                className={`link link-primary text-left text-sm${
                  abierto ? " font-semibold" : ""
                }`}
                aria-current={abierto ? "true" : undefined}
                onClick={() => onAbrir(doc)}
              >
                {doc.nombre}
              </button>
              {/* Fuera del botón: no cambia su nombre accesible. */}
              {doc.nuevo === true && <MarcaNuevo />}
              {doc.tipo && (
                <span className="badge badge-outline badge-sm">{doc.tipo}</span>
              )}
            </div>
            {doc.firmantes.map((firmante, indice) => (
              <span
                key={`${firmante.nombre ?? ""}-${firmante.fecha ?? ""}-${indice}`}
                className="text-xs text-base-content/70"
              >
                Firmado por {firmante.nombre ?? "firmante sin nombre registrado"}
                {firmante.rol ? ` (${firmante.rol})` : ""}
                {firmante.fecha
                  ? ` · ${DatetimeUtil.formatFechaHoraCorta(firmante.fecha)}`
                  : ""}
              </span>
            ))}
          </li>
        );
      })}
    </ul>
  );
};

export default DocumentosOtrosModulos;
