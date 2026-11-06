/**
 * Microservicio: ejecucion
 * Módulo: documentacion
 * Feature: Documentación del expediente agrupada por Dirección metropolitana (acordeón)
 * Archivo: CaseDirectionDocumentsList.tsx
 * Responsabilidad: Orquestar los cinco collapses por Dirección con CARGA BAJO DEMANDA: al abrir
 *   uno pide SUS documentos (una vez; `loaded` evita repetir la consulta) y los demás quedan
 *   intactos. Modo acordeón — abrir una cierra la anterior.
 *
 *   🔴 DE DÓNDE SALEN LOS DOCUMENTOS (quick 261030-dun). Los de EJECUCIÓN, de su propia base
 *   (`GET /epas/:eejeId/documentos`). Los de Inspección, Instrucción, Resolución y Secretaría
 *   General viven en sus módulos y los trae el AGREGADO del backend (`GET /epas/:eejeId/
 *   documentos-externos`): UNA sola llamada al abrir la primera de esas cuatro Direcciones llena las
 *   cuatro. Mientras un módulo no publique su servicio, el backend sirve documentos SIMULADOS y la
 *   Dirección lo avisa; un módulo caído sale con su error y uno sin configurar, con su motivo, sin
 *   afectar a los demás.
 *
 *   Portado de Resolución (`features/documentation/components/CaseDirectionDocumentsList.tsx`).
 * Desarrollador: Andrés Miño
 * Fecha: 2026-09-17
 * Modificado por: Andrés Miño — 2026-10-26 (Fase 03.21, Plan 11, D-15, C10: `aDocumento` se
 *   exporta y conserva `firmas` y `firmaRequerida`, para que la tarjeta pinte el sello «Firmado»).
 * Modificado por: Andrés Miño — 2026-10-30 (quick 261030-dun: las cuatro Direcciones ajenas —con
 *   Secretaría General como quinta— se llenan con `getDocumentosExternos` en una sola llamada
 *   (`repartirModulos`, `aDocumentoExterno`); `selectedDocumentUrl` evita que ids de módulos
 *   distintos choquen al resaltar; la acción por documento —observar— solo en los de Ejecución)
 * Modificado por: Andrés Miño — 2026-11-04 (quick 261030-m29: marca «Nuevo» POR USUARIO en las cinco
 *   Direcciones. Los propios, con `GET /documentos-lectura/epas/:eejeId`; los de otros módulos, con
 *   el `nuevo` que ya trae cada documento del agregado. La marca entra por la ranura
 *   `accionPorDocumento` COMPUESTA con la que llegue por props —observar sigue solo en Ejecución— y
 *   al pulsar «Ver» un documento marcado se registra su lectura (propia o externa según su origen),
 *   se quita la marca y se avisa con `onLeido`. Si las lecturas fallan, todo se ve igual sin marcas)
 */
import { mensajeParaUsuario } from "../../api/mensajeParaUsuario";
import {
  useCallback,
  useEffect,
  useState,
  type FC,
  type ReactNode,
} from "react";
import { CASE_DIRECTIONS } from "../../config/caseDirections";
import { DocumentosLecturaService } from "../../services/DocumentosLecturaService";
import MarcaNuevo from "../common/MarcaNuevo";
import type {
  CaseDirectionCode,
  ICaseDirectionDocumentsState,
} from "../../interfaces/ICaseDirection";
import type { IDocument } from "../../interfaces/IDocument";
import type {
  IDocumentoExterno,
  IDocumentosExternosDelExpediente,
  ModuloExternoCodigo,
} from "../../interfaces/IDocumentosExternos";
import {
  EpasService,
  type ExpedienteDocumento,
  type FirmaDocumento,
} from "../../services/EpasService";
import CollapseCaseDirection from "./CollapseCaseDirection";
import type { DocumentoConFirmas } from "./DocumentsCards";

interface CaseDirectionDocumentsListProps {
  /** eeje_id del EPAS cuyos documentos se listan. */
  eejeId: number;
  selectedDocumentId?: number;
  /**
   * `docUrl` del documento abierto (quick 261030-dun). Con él, solo la Dirección que CONTIENE ese
   * documento resalta su tarjeta: los documentos de otros módulos llevan ids negativos por
   * Dirección, que se repiten entre Direcciones. Sin él, conducta de siempre.
   */
  selectedDocumentUrl?: string;
  onSelectDocument: (document: IDocument) => void;
  /**
   * Señal de recarga: cada valor NUEVO invalida lo ya cargado. La sube la página cuando se anexa un
   * documento, para que la Dirección de Ejecución vuelva a pedir su lista.
   */
  recargaSenal?: number;
  /**
   * Nodo a pintar en la fila de cada documento (2026-09-18). Lo usa la ficha de la Bandeja de
   * Entrada para colgar ahí el icono de observar. Solo en los documentos de EJECUCIÓN: los de otros
   * módulos no son de este expediente de Ejecución y no se observan aquí.
   *
   * 🔴 LA LISTA NO SABE QUÉ ES UNA OBSERVACIÓN: recibe un nodo y lo pinta. Así sigue sirviendo a
   * las pantallas que no observan nada, que son todas las demás.
   */
  accionPorDocumento?: (document: IDocument) => ReactNode;
  /**
   * Se llama una vez por cada documento con la marca «Nuevo» que se abre con «Ver» (quick
   * 261030-m29). La ficha lo usa para bajar el contador de su pestaña.
   */
  onLeido?: () => void;
}

/**
 * Lo que hace falta para marcar como leído un documento de OTRO módulo, indexado por su URL del
 * proxy: el `docId` del adaptador es un negativo por posición y no identifica nada fuera de la
 * Dirección, mientras que la URL lleva el módulo y el id real y no se repite.
 */
interface ExternoLectura {
  modulo: ModuloExternoCodigo;
  docId: string;
  nuevo: boolean;
}

/** Índice URL → externo, a partir de la respuesta del agregado. */
const indexarExternos = (
  respuesta: IDocumentosExternosDelExpediente,
): Record<string, ExternoLectura> => {
  const indice: Record<string, ExternoLectura> = {};
  for (const modulo of respuesta?.modulos ?? []) {
    for (const doc of modulo.documentos ?? []) {
      indice[doc.archivoUrl] = {
        modulo: modulo.modulo,
        docId: doc.docId,
        nuevo: doc.nuevo === true,
      };
    }
  }
  return indice;
};

const estadoInicial = (): Record<
  CaseDirectionCode,
  ICaseDirectionDocumentsState
> => ({
  inspeccion: { documents: [], loading: false, loaded: false, error: null },
  instruccion: { documents: [], loading: false, loaded: false, error: null },
  resolucion: { documents: [], loading: false, loaded: false, error: null },
  ejecucion: { documents: [], loading: false, loaded: false, error: null },
  sg: { documents: [], loading: false, loaded: false, error: null },
});

/** Módulo del agregado del backend → Dirección del acordeón (DMIT es Instrucción). */
const DIRECCION_POR_MODULO: Record<ModuloExternoCodigo, CaseDirectionCode> = {
  inspeccion: "inspeccion",
  dmit: "instruccion",
  resolucion: "resolucion",
  sg: "sg",
};

/** Las cuatro Direcciones que llena el agregado (todas menos Ejecución). */
const DIRECCIONES_EXTERNAS: CaseDirectionCode[] = [
  "inspeccion",
  "instruccion",
  "resolucion",
  "sg",
];

/** Aviso de una Dirección cuyos documentos sirve el simulador del backend. */
export const AVISO_SIMULADO =
  "Documentos SIMULADOS: el módulo aún no publica su servicio.";

/**
 * Adapta un documento de OTRO módulo a lo que `DocumentCards` sabe pintar.
 *
 * El `docId` es NEGATIVO (`-(indice + 1)`): el id del otro módulo es texto opaco y `IDocument` pide
 * un número; negativo no coincide nunca con un documento propio. Se repite entre Direcciones, por eso
 * el resaltado se decide por `selectedDocumentUrl`. Las firmas sin fecha no se pintan (el sello
 * necesita el instante); el rol llega ya legible y `SelloFirma` lo escribe tal cual.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function aDocumentoExterno(
  doc: IDocumentoExterno,
  indice: number,
): DocumentoConFirmas {
  return {
    docId: -(indice + 1),
    docName: doc.nombre,
    docSize: 0,
    docUploadedAt: doc.fecha ? new Date(doc.fecha) : new Date(),
    docUploadedBy: 0,
    docIsActive: true,
    docUrl: doc.archivoUrl,
    docIsLocked: false,
    docStatus: doc.estado,
    docVersion: 1,
    docIsCurrent: true,
    docMetadata: {},
    docParentId: 0,
    tsdocId: 0,
    tdocType: doc.tipo ?? "",
    tdocTypeName: doc.tipo ?? "",
    tsdocSubtypeName: doc.subtipo ?? "",
    tsdocSubtype: "",
    firmas: doc.firmantes
      .filter((f) => typeof f.fecha === "string" && f.fecha !== "")
      .map((f) => ({
        // Rol libre del otro módulo («Inspector», «Director»…): `SelloFirma` lo pinta tal cual.
        rol: (f.rol ?? "Firmante") as FirmaDocumento["rol"],
        nombre: f.nombre,
        at: f.fecha as string,
      })),
  };
}

/**
 * Reparte la respuesta del agregado entre las cuatro Direcciones ajenas: `ok` ⇒ sus documentos (y
 * el aviso de SIMULADOS si lo son); `deshabilitado` ⇒ vacía con su motivo como aviso; `error` ⇒ su
 * mensaje como error. Una Dirección que el backend no mande queda cargada y vacía.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function repartirModulos(
  respuesta: IDocumentosExternosDelExpediente,
): Partial<Record<CaseDirectionCode, ICaseDirectionDocumentsState>> {
  const reparto: Partial<
    Record<CaseDirectionCode, ICaseDirectionDocumentsState>
  > = {};
  for (const modulo of respuesta?.modulos ?? []) {
    const direccion = DIRECCION_POR_MODULO[modulo.modulo];
    if (!direccion) continue;
    if (modulo.estado === "error") {
      reparto[direccion] = {
        documents: [],
        loading: false,
        loaded: true,
        error: modulo.mensaje ?? "No se pudo consultar este módulo.",
        aviso: null,
      };
    } else if (modulo.estado === "deshabilitado") {
      reparto[direccion] = {
        documents: [],
        loading: false,
        loaded: true,
        error: null,
        aviso: modulo.mensaje ?? "La consulta a este módulo no está habilitada.",
      };
    } else {
      reparto[direccion] = {
        documents: (modulo.documentos ?? []).map(aDocumentoExterno),
        loading: false,
        loaded: true,
        error: null,
        aviso: modulo.simulado ? AVISO_SIMULADO : null,
      };
    }
  }
  for (const direccion of DIRECCIONES_EXTERNAS) {
    reparto[direccion] ??= {
      documents: [],
      loading: false,
      loaded: true,
      error: null,
      aviso: null,
    };
  }
  return reparto;
}

/**
 * Adapta un `ExpedienteDocumento` (lo que devuelve `GET /epas/:id/documentos`) a `IDocument`, que es
 * lo que `DocumentCards` sabe pintar. Los campos que el endpoint no trae se rellenan con valores
 * neutros: `DocumentCards` omite sola la línea del tamaño cuando es 0, y la fecha ausente se
 * sustituye por la de hoy solo para que `formatDate` no reciba `undefined`.
 *
 * 🔴 CONSERVA `firmas` Y `firmaRequerida` (Fase 03.21, C10). El adaptador construye el documento
 * campo por campo, así que lo que no nombra se pierde: sin estas dos líneas la tarjeta pintaría sin
 * sello un documento que en las otras dos listas del expediente sale «Firmado».
 *
 * Se exporta solo para su prueba (`CaseDirectionDocumentsList.test.ts`); su conducta no cambia.
 */
// La regla que se silencia es de ergonomía del recarga-en-caliente del servidor de desarrollo, no
// de correctitud (mismo criterio que `RowActions.tsx`): el adaptador es de esta lista y sacarlo a
// otro archivo solo para probarlo pondría a dos archivos de acuerdo sobre una sola decisión.
// eslint-disable-next-line react-refresh/only-export-components
export function aDocumento(doc: ExpedienteDocumento): DocumentoConFirmas {
  return {
    docId: doc.docId,
    docName: doc.docName,
    docSize: 0,
    docUploadedAt: doc.docUploadedAt ? new Date(doc.docUploadedAt) : new Date(),
    docUploadedBy: 0,
    docIsActive: true,
    docUrl: doc.docUrl ?? "",
    docIsLocked: false,
    docStatus: doc.docStatus ?? null,
    docVersion: 1,
    docIsCurrent: true,
    docMetadata: {},
    docParentId: 0,
    tsdocId: 0,
    tdocType: doc.tdocTypeName ?? "",
    tdocTypeName: doc.tdocTypeName ?? "",
    tsdocSubtypeName: "",
    tsdocSubtype: "",
    firmas: doc.firmas,
    firmaRequerida: doc.firmaRequerida,
  };
}

const CaseDirectionDocumentsList: FC<CaseDirectionDocumentsListProps> = ({
  eejeId,
  selectedDocumentId,
  selectedDocumentUrl,
  onSelectDocument,
  recargaSenal = 0,
  accionPorDocumento,
  onLeido,
}) => {
  const [openDirection, setOpenDirection] = useState<CaseDirectionCode | null>(
    // La de EJECUCIÓN abierta de entrada: es la única que hoy tiene documentos, y dejar las cuatro
    // cerradas obligaría a adivinar cuál abrir para ver algo.
    "ejecucion",
  );
  const [directionState, setDirectionState] =
    useState<Record<CaseDirectionCode, ICaseDirectionDocumentsState>>(
      estadoInicial,
    );
  /**
   * `doc_id` propios sin leer por el usuario, con la clave de la consulta que los produjo (una
   * respuesta de otro expediente no marca nada aquí).
   */
  const claveLectura = `${eejeId}:${recargaSenal}`;
  const [propiosNoLeidos, setPropiosNoLeidos] = useState<{
    clave: string;
    ids: ReadonlySet<number>;
  } | null>(null);
  const propiosNoLeidosVigentes =
    propiosNoLeidos?.clave === claveLectura ? propiosNoLeidos.ids : null;
  /** Los documentos de otros módulos ya cargados, por URL (ver `ExternoLectura`). */
  const [externos, setExternos] = useState<Record<string, ExternoLectura>>({});

  /**
   * Las cuatro Direcciones ajenas en UNA llamada al agregado del backend: se marcan las cuatro
   * cargando (así abrir otra mientras tanto no repite la consulta) y se reparten al volver.
   */
  const cargarExternos = useCallback(async () => {
    setDirectionState((prev) => {
      const siguiente = { ...prev };
      for (const direccion of DIRECCIONES_EXTERNAS) {
        siguiente[direccion] = {
          ...prev[direccion],
          loading: true,
          error: null,
        };
      }
      return siguiente;
    });

    try {
      const respuesta = await EpasService.getDocumentosExternos(eejeId);
      const reparto = repartirModulos(respuesta);
      setDirectionState((prev) => ({ ...prev, ...reparto }));
      setExternos(indexarExternos(respuesta));
    } catch (error) {
      const mensaje = mensajeParaUsuario(
        error,
        "No se pudieron consultar los documentos de otros módulos.",
      );
      setDirectionState((prev) => {
        const siguiente = { ...prev };
        for (const direccion of DIRECCIONES_EXTERNAS) {
          siguiente[direccion] = {
            documents: [],
            loading: false,
            loaded: true,
            error: mensaje,
            aviso: null,
          };
        }
        return siguiente;
      });
    }
  }, [eejeId]);

  const loadDocuments = useCallback(
    async (direction: CaseDirectionCode) => {
      // Las cuatro Direcciones ajenas salen del agregado, en una sola llamada. Ver la cabecera.
      if (direction !== "ejecucion") {
        await cargarExternos();
        return;
      }

      setDirectionState((prev) => ({
        ...prev,
        [direction]: { ...prev[direction], loading: true, error: null },
      }));

      try {
        const docs = await EpasService.getDocumentos(eejeId);
        setDirectionState((prev) => ({
          ...prev,
          [direction]: {
            documents: (Array.isArray(docs) ? docs : []).map(aDocumento),
            loading: false,
            loaded: true,
            error: null,
          },
        }));
      } catch (error) {
        setDirectionState((prev) => ({
          ...prev,
          [direction]: {
            documents: [],
            loading: false,
            loaded: true,
            error:
              mensajeParaUsuario(error, "No se pudieron cargar los documentos."),
          },
        }));
      }
    },
    [eejeId, cargarExternos],
  );

  // Carga inicial de la Dirección que nace abierta, y recarga cuando sube `recargaSenal` (un anexo
  // nuevo) o cambia el expediente. Se rehace el estado ENTERO: los documentos del expediente
  // anterior no tienen nada que hacer en el nuevo, y dejar `loaded: true` haría que sus Direcciones
  // se dieran por cargadas con la lista de otro.
  useEffect(() => {
    setDirectionState(estadoInicial());
    setExternos({});
    setOpenDirection("ejecucion");
    void loadDocuments("ejecucion");
  }, [eejeId, recargaSenal, loadDocuments]);

  // Las lecturas de los propios, por su cuenta: su fallo no toca la lista (sin marcas y ya).
  useEffect(() => {
    let vivo = true;
    const consulta = `${eejeId}:${recargaSenal}`;
    DocumentosLecturaService.noLeidosDelEpas(eejeId)
      .then((data) => {
        if (!vivo) return;
        const propios = Array.isArray(data?.propios) ? data.propios : [];
        setPropiosNoLeidos({ clave: consulta, ids: new Set(propios) });
      })
      .catch(() => {
        if (vivo) setPropiosNoLeidos({ clave: consulta, ids: new Set() });
      });
    return () => {
      vivo = false;
    };
  }, [eejeId, recargaSenal]);

  /** ¿El documento de esa Dirección lleva la marca «Nuevo»? */
  const esNuevo = (direccion: CaseDirectionCode, documento: IDocument) =>
    direccion === "ejecucion"
      ? propiosNoLeidosVigentes?.has(documento.docId) === true
      : externos[documento.docUrl]?.nuevo === true;

  /**
   * «Ver»: si el documento era nuevo, se quita la marca, se registra la lectura en segundo plano
   * —propia o externa según la Dirección— y se avisa con `onLeido`; después, lo de siempre. El fallo
   * al marcar solo va a la consola (sin datos): el documento ya se abrió.
   */
  const seleccionar = (direccion: CaseDirectionCode, documento: IDocument) => {
    if (esNuevo(direccion, documento)) {
      const avisarFallo = () =>
        console.warn("No se pudo registrar la lectura del documento.");
      if (direccion === "ejecucion") {
        setPropiosNoLeidos((previo) => {
          if (!previo) return previo;
          const ids = new Set(previo.ids);
          ids.delete(documento.docId);
          return { ...previo, ids };
        });
        DocumentosLecturaService.marcarPropio(eejeId, documento.docId).catch(
          avisarFallo,
        );
      } else {
        const externo = externos[documento.docUrl];
        setExternos((previo) => ({
          ...previo,
          [documento.docUrl]: { ...externo, nuevo: false },
        }));
        DocumentosLecturaService.marcarExterno(
          eejeId,
          externo.modulo,
          externo.docId,
        ).catch(avisarFallo);
      }
      onLeido?.();
    }
    onSelectDocument(documento);
  };

  const handleToggle = useCallback(
    (direction: CaseDirectionCode) => {
      if (openDirection === direction) {
        setOpenDirection(null);
        return;
      }
      setOpenDirection(direction);
      setDirectionState((prev) => {
        const actual = prev[direction];
        if (!actual.loaded && !actual.loading) {
          void loadDocuments(direction);
        }
        return prev;
      });
    },
    [loadDocuments, openDirection],
  );

  return (
    <div className="app-modules-case-modal-docs-directions">
      {CASE_DIRECTIONS.map((direction, index) => {
        const state = directionState[direction.code];
        // Con `selectedDocumentUrl`, solo resalta la Dirección que CONTIENE el documento abierto.
        const resaltar =
          selectedDocumentUrl === undefined ||
          state.documents.some((d) => d.docUrl === selectedDocumentUrl);
        return (
          <CollapseCaseDirection
            key={direction.code}
            direction={direction}
            index={index}
            isOpen={openDirection === direction.code}
            documents={state.documents}
            loading={state.loading}
            error={state.error}
            aviso={state.aviso}
            selectedDocumentId={resaltar ? selectedDocumentId : undefined}
            onToggle={handleToggle}
            onSelectDocument={(documento) =>
              seleccionar(direction.code, documento)
            }
            // La marca «Nuevo» en TODAS las Direcciones, COMPUESTA con la acción que llegue por
            // props; esa acción (observar) sigue solo en los documentos de Ejecución.
            accionPorDocumento={(documento) => (
              <>
                {esNuevo(direction.code, documento) && <MarcaNuevo />}
                {direction.code === "ejecucion"
                  ? accionPorDocumento?.(documento)
                  : null}
              </>
            )}
          />
        );
      })}
    </div>
  );
};

export default CaseDirectionDocumentsList;
