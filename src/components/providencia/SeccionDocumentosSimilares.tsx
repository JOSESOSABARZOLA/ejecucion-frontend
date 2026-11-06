/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/providencias (frontend)
 * Feature: Basarse en un documento anterior (Fase 03.19, Plan 15 · D-04)
 * Archivo: SeccionDocumentosSimilares.tsx
 * Responsabilidad: Ofrecer, dentro del paso 2 y encima del editor, las providencias anteriores de
 *   la misma clase, y dejar partir de una de ellas sin destruir nada por accidente.
 *
 *   Se copió la ESTRUCTURA de `SimilarDocumentsSection.tsx` de la rama de Resolución —sección
 *   plegable, carga incremental, tarjetas— y se reescribieron los cuatro estados y el flujo de
 *   importación. Tres diferencias que no son de estilo:
 *
 *   ── 1. 🔴 EL VACÍO EXPLICA POR QUÉ ESTÁ VACÍO, Y HOY ES EL ESTADO ÚNICO ─────────────────────
 *   El contenido de las providencias ya emitidas no existe en ninguna parte: hasta la Ola 1 de esta
 *   fase solo se guardaba el PDF, y de un PDF no se recupera el cuerpo redactado sino el documento
 *   ya maquetado. El plan 05 lo midió contra la base desplegada: 258 documentos, CERO con
 *   contenido. Así que esta sección va a salir vacía en la UAT y durante un tiempo después, y el
 *   único mensaje que alguien va a leer aquí es el del vacío. Un genérico «No hay resultados» haría
 *   creer que la función está rota o que hay un filtro mal puesto; el copy del contrato (UI-SPEC
 *   §5.6) dice qué pasó y qué va a pasar.
 *
 *   ── 2. 🔴 VACÍO Y AVERIADO NO SE CONFUNDEN ──────────────────────────────────────────────────
 *   Son dos señales distintas del hook (`vacioHonesto` y `fallo`), no la ausencia de datos. Si una
 *   consulta que falló se pintara como «no hay providencias anteriores», la pantalla afirmaría algo
 *   falso y además taparía la avería. El aviso va DENTRO de la sección y con su reintento: un fallo
 *   aquí no bloquea la redacción (T-03.19-67), que es como se han escrito todas las providencias
 *   hasta hoy.
 *
 *   ── 3. 🔴 IMPORTAR NO DESTRUYE NADA EN SILENCIO, Y SE PUEDE DESHACER ────────────────────────
 *   Sobre un cuerpo vacío no pregunta. Sobre un cuerpo ya escrito pide confirmación nombrando el
 *   expediente y la fecha del documento de origen (T-03.19-68) — el original de la rama usaba el
 *   diálogo nativo del navegador, que no se puede estilar, no respeta el tema y no dice CUÁL es el
 *   documento. Y una vez aplicada, la importación deja a mano un «Deshacer» que devuelve el texto
 *   anterior: la confirmación evita el accidente, el deshacer lo repara si aun así ocurre.
 *
 *   ⚠️ El contenido importado se ENTREGA AL EDITOR, que lo sanea al montarlo. En esta sección no se
 *   interpreta ningún marcado: el extracto de la tarjeta es texto (ver `CollapseDocumentoSimilar`).
 * Desarrollador: Andrés Miño
 * Fecha: 2026-09-22
 */

import { useCallback, useId, useState } from "react";
import type { ProvidenciaSimilar } from "../../services/ProvidenciaService";
import { SECCION_CUERPO, tieneContenido } from "../../config/providenciaComposicion";
import {
  esContenidoImportable,
  importarSeccionesDeProvidencia,
} from "../../utils/similarDocumentImport.util";
import { useSimilarDocuments } from "../../hooks/useSimilarDocuments";
import { DatetimeUtil } from "../../utils/datetime.util";
import Alert from "../common/Alert";
import EmptyState from "../common/EmptyState";
import Loading from "../common/Loading";
import CollapseDocumentoSimilar from "./CollapseDocumentoSimilar";

/** Rótulo de la sección (UI-SPEC §4.5). */
export const ROTULO_SECCION_SIMILARES = "Basarse en un documento anterior";

/**
 * El copy, palabra por palabra como lo fija UI-SPEC §5.6.
 *
 * Está aquí y no en el cuerpo del componente para que se lea de un golpe lo que esta sección le
 * dice al decisor: es la parte del trabajo que más se va a ver y la que menos se puede improvisar.
 */
export const COPY_SIMILARES = {
  vacioTitulo: "No hay providencias anteriores reutilizables",
  vacioPista:
    "Las providencias emitidas antes de esta versión guardaron solo el PDF, no su contenido. Desde ahora, las que usted emita quedarán disponibles aquí.",
  fallo:
    "No se pudieron consultar las providencias anteriores. Puede seguir redactando con normalidad.",
  sinClase:
    "Elija primero la clase de providencia: las anteriores se buscan por clase.",
  versionDesconocida:
    "Esta providencia se guardó con una versión de contenido que esta pantalla no sabe leer.",
  sinContenido: "Esta providencia no tiene contenido que se pueda importar.",
} as const;

/** La confirmación de reemplazo (UI-SPEC §5.6), con el documento del que se va a partir. */
// Sin exportar, por el mismo motivo que `extractoLegible` en la tarjeta: el lint del repo solo
// tolera exportar componentes y constantes en mayúsculas junto a un componente.
const copyConfirmarReemplazo = (
  expNumber: string | undefined,
  fecha: string,
): string =>
  `Va a reemplazar el texto que ya escribió con el de la providencia ${
    expNumber ?? "sin número de expediente"
  } del ${fecha}. ¿Desea continuar?`;

/** Las secciones que este compositor sabe colocar. Hoy es una: el cuerpo entero. */
const CLAVES_IMPORTABLES = [SECCION_CUERPO.clave] as const;

export interface PropsSeccionDocumentosSimilares {
  /** La CLASE de providencia que se está redactando. Ausente ⇒ la sección lo dice y no consulta. */
  tipoCodigo: string | undefined;
  /** Lo que hay escrito AHORA en el editor: decide si hay que pedir confirmación. */
  cuerpoActual: string | undefined;
  /** Sube el HTML elegido al padre, que lo entrega al editor. */
  onImportar: (html: string) => void;
  /** Cómo se llama esa clase en el catálogo, para enseñarlo en la tarjeta. */
  nombreTipo?: string;
  /** Hay una emisión en vuelo: la sección entera se apaga. */
  deshabilitado?: boolean;
}

/** Lo que espera una confirmación: el documento de origen y el HTML ya convertido. */
interface Pendiente {
  documento: ProvidenciaSimilar;
  html: string;
}

const SeccionDocumentosSimilares = ({
  tipoCodigo,
  cuerpoActual,
  onImportar,
  nombreTipo,
  deshabilitado = false,
}: PropsSeccionDocumentosSimilares) => {
  const idCuerpo = useId();
  const [abierta, setAbierta] = useState(false);
  const [pendiente, setPendiente] = useState<Pendiente | null>(null);
  /** El texto que había antes de la última importación. Es lo que devuelve «Deshacer». */
  const [previo, setPrevio] = useState<string | null>(null);
  const [importada, setImportada] = useState<ProvidenciaSimilar | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const similares = useSimilarDocuments({ tipoCodigo, activo: abierta });

  const aplicar = useCallback(
    (documento: ProvidenciaSimilar, html: string) => {
      setPrevio(cuerpoActual ?? "");
      setImportada(documento);
      setPendiente(null);
      setAviso(null);
      onImportar(html);
    },
    [cuerpoActual, onImportar],
  );

  const pedirImportar = useCallback(
    (documento: ProvidenciaSimilar) => {
      const importadas = importarSeccionesDeProvidencia(
        documento.docStructure,
        CLAVES_IMPORTABLES,
      );
      const html = importadas[SECCION_CUERPO.clave];

      if (!html) {
        // No se importa un vacío: borraría lo que hubiera escrito y no traería nada a cambio.
        setAviso(COPY_SIMILARES.sinContenido);
        return;
      }

      if (tieneContenido(cuerpoActual)) {
        setPendiente({ documento, html });
        return;
      }

      aplicar(documento, html);
    },
    [aplicar, cuerpoActual],
  );

  const deshacer = useCallback(() => {
    if (previo === null) return;
    onImportar(previo);
    setPrevio(null);
    setImportada(null);
  }, [onImportar, previo]);

  const contador = similares.documentos.length > 0 ? ` (${similares.total})` : "";

  return (
    <section
      className="flex flex-col gap-3 rounded-box border border-base-300 bg-base-100 p-4"
      aria-busy={similares.cargando}
    >
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 text-left"
        aria-expanded={abierta}
        aria-controls={idCuerpo}
        onClick={() => setAbierta((previa) => !previa)}
      >
        <span className="app-section-heading">
          {ROTULO_SECCION_SIMILARES}
          {contador}
        </span>
        <span aria-hidden="true" className="opacity-60">
          {abierta ? "▲" : "▼"}
        </span>
      </button>

      {abierta && (
        <div id={idCuerpo} className="flex flex-col gap-3">
          {!tipoCodigo && (
            <p className="text-sm opacity-70">{COPY_SIMILARES.sinClase}</p>
          )}

          {/* `Loading` se coloca sobre su contenedor: necesita uno posicionado y con alto propio. */}
          {similares.cargando && (
            <div className="relative min-h-32">
              <Loading />
            </div>
          )}

          {/* El aviso va DENTRO de la sección y con reintento. Nunca bloquea la redacción. */}
          {similares.fallo && (
            <Alert
              variant="warning"
              message={COPY_SIMILARES.fallo}
              buttonFunction={similares.reintentar}
            />
          )}

          {aviso && <Alert variant="info" message={aviso} />}

          {/* Se afirma el vacío SOLO cuando se consultó y nada falló. */}
          {similares.vacioHonesto && (
            <EmptyState
              text={COPY_SIMILARES.vacioTitulo}
              hint={COPY_SIMILARES.vacioPista}
            />
          )}

          {similares.documentos.length > 0 && (
            <div className="flex flex-col gap-2">
              {similares.documentos.map((documento, indice) => {
                const importable = esContenidoImportable(documento.docStructure);
                return (
                  <CollapseDocumentoSimilar
                    key={documento.docId}
                    documento={documento}
                    indice={indice}
                    nombreTipo={nombreTipo}
                    onUsarComoBase={pedirImportar}
                    deshabilitado={deshabilitado || !importable}
                    motivoDeshabilitado={
                      importable ? undefined : COPY_SIMILARES.versionDesconocida
                    }
                  />
                );
              })}

              {similares.hayMas && (
                <button
                  type="button"
                  className="btn btn-sm btn-outline btn-primary self-start"
                  disabled={similares.cargandoMas || deshabilitado}
                  onClick={similares.cargarMas}
                >
                  {similares.cargandoMas ? "Cargando…" : "Cargar más"}
                </button>
              )}
            </div>
          )}

          {/* La confirmación: dice CUÁL documento va a pisar lo escrito, no solo que lo va a pisar. */}
          {pendiente && (
            <div
              role="alertdialog"
              aria-label="Confirmar reemplazo del texto redactado"
              className="flex flex-col gap-3 rounded-box border border-warning bg-base-200 p-3"
            >
              <p className="text-sm">
                {copyConfirmarReemplazo(
                  pendiente.documento.expNumber,
                  DatetimeUtil.formatDate(pendiente.documento.docCreatedAt),
                )}
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn btn-sm btn-warning"
                  onClick={() => aplicar(pendiente.documento, pendiente.html)}
                >
                  Reemplazar
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-ghost"
                  onClick={() => setPendiente(null)}
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {/* Reparación, no solo prevención: lo importado se puede devolver. */}
          {importada && previo !== null && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-box bg-base-200 p-3 text-sm">
              <span>
                Se importó el contenido de la providencia{" "}
                {importada.expNumber ?? "sin número de expediente"} del{" "}
                {DatetimeUtil.formatDate(importada.docCreatedAt)}.
              </span>
              <button
                type="button"
                className="btn btn-sm btn-ghost"
                onClick={deshacer}
              >
                Deshacer
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
};

export default SeccionDocumentosSimilares;
