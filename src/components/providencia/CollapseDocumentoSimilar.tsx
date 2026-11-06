/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/providencias (frontend)
 * Feature: Basarse en un documento anterior (Fase 03.19, Plan 15 · D-04)
 * Archivo: CollapseDocumentoSimilar.tsx
 * Responsabilidad: Una providencia anterior, plegada: qué expediente, qué día, de qué clase y de
 *   qué habla — lo justo para reconocerla antes de partir de ella.
 *
 *   Se copió la ESTRUCTURA de `CollapseSimilarDocument.tsx` de la rama de Resolución (una tarjeta
 *   plegable sobre el `Collapse` compartido, con sus acciones en la cabecera); el contenido es
 *   otro. Allí el cuerpo de la tarjeta lista los casos relacionados del documento; aquí no hay tal
 *   cosa —la providencia pertenece a UN expediente— y lo que hace falta ver es de qué habla el
 *   texto que se va a importar.
 *
 *   ── 🔴 EL EXTRACTO ES TEXTO. NUNCA MARCADO INTERPRETADO ─────────────────────────────────────
 *   `docStructure.secciones[].html` es HTML REDACTADO POR UN USUARIO Y ALMACENADO (T-03.19-20 /
 *   T-03.19-64): lo escribió un funcionario en otra sesión y vuelve aquí sin pasar por ningún
 *   saneador. El único sitio donde puede volver a interpretarse es el EDITOR, que lo sanea al
 *   montarlo. Por eso `extractoLegible` quita las etiquetas y lo que se pinta es una cadena, hija
 *   normal de JSX — y por eso en este archivo no hay, ni puede haber, ninguna inserción de HTML
 *   crudo. En todo el frontend hay CERO, y esa cuenta se afirma en el cierre del plan.
 *
 *   ⚠️ Ese recorte de etiquetas es SOLO para mirar. Lo que se importa al editor va por
 *   `similarDocumentImport.util.ts`, que respeta el HTML entero: si alguien reutilizara esta
 *   función para alimentar el editor, la providencia se emitiría sin formato. De ahí el nombre —
 *   «legible», no «convertir»— y de ahí que viva aquí, en la tarjeta, y no en la utilidad.
 *
 *   ── EL NÚMERO DE EXPEDIENTE PUEDE FALTAR ────────────────────────────────────────────────────
 *   El plan 05 lo midió contra la base: 9 de 258 documentos reales no tienen fila en la tabla que
 *   los une a su expediente. La entrada NO se esconde por eso —seguiría siendo una providencia
 *   reutilizable— y NO se pinta `undefined`: se degrada con palabras.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-09-22
 */

import type { FC, ReactNode } from "react";
import type { ProvidenciaSimilar } from "../../services/ProvidenciaService";
import { DatetimeUtil } from "../../utils/datetime.util";
import Collapse from "../collapse/Collapse";

/** El `Collapse` compartido pide permisos por zona; esta tarjeta no tiene acciones por permiso. */
const SIN_ACCIONES = {
  collapseHeader: [],
  collapseBody: [],
  collapseBodyItem: [],
};

/** Lo que se enseña cuando la providencia no tiene expediente asociado en la base. */
export const SIN_EXPEDIENTE = "Expediente no disponible";

/** Cuánto extracto cabe en la cabecera sin convertirla en un párrafo. */
const LARGO_EXTRACTO_CABECERA = 140;

/** Y cuánto en el cuerpo desplegado, que es donde se mira de verdad antes de decidir. */
const LARGO_EXTRACTO_CUERPO = 1200;

/**
 * Deja el contenido almacenado en TEXTO legible para poder mirarlo: quita las etiquetas, devuelve
 * las cuatro entidades que aparecen de verdad en un acto administrativo y colapsa los espacios.
 *
 * 🔴 Para MIRAR, no para importar. Ver la cabecera de este archivo.
 */
// No se exporta: la regla de recarga en caliente del repo solo tolera exportar componentes y
// constantes en mayúsculas junto a un componente, y añadir un hallazgo al lint por comodidad es
// dejarle el trabajo a otro. Su conducta queda cubierta por la prueba de la sección.
const extractoLegible = (html: string, largo: number): string => {
  const texto = html
    // Los bloques se separan con un espacio: sin esto, «…archivo.</p><p>SEGUNDO…» se leería pegado.
    .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, " ")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();

  return texto.length > largo ? `${texto.slice(0, largo).trimEnd()}…` : texto;
};

/** Junta el contenido de todas las secciones almacenadas para el extracto. */
const cuerpoCompleto = (documento: ProvidenciaSimilar): string =>
  (documento.docStructure?.secciones ?? [])
    .map((seccion) => seccion.html ?? "")
    .join(" ");

export interface PropsCollapseDocumentoSimilar {
  documento: ProvidenciaSimilar;
  /** Posición en la lista, para numerar la tarjeta. */
  indice?: number;
  /** Cómo se llama esta clase de providencia en el catálogo. Ausente ⇒ se enseña su código. */
  nombreTipo?: string;
  onUsarComoBase: (documento: ProvidenciaSimilar) => void;
  /** Apagado del botón de importar. */
  deshabilitado?: boolean;
  /**
   * Por qué está apagado. Va al `title` del botón (UI-SPEC §6/A9): un control apagado sin motivo es
   * una pantalla que no dice nada.
   */
  motivoDeshabilitado?: string;
}

const CollapseDocumentoSimilar: FC<PropsCollapseDocumentoSimilar> = ({
  documento,
  indice = 0,
  nombreTipo,
  onUsarComoBase,
  deshabilitado = false,
  motivoDeshabilitado,
}) => {
  const texto = cuerpoCompleto(documento);

  const cabecera = (item: ProvidenciaSimilar, posicion: number): ReactNode => (
    <div className="flex w-full flex-wrap items-start justify-between gap-3">
      <div className="min-w-0 flex flex-col gap-1">
        <h4 className="flex items-baseline gap-2 text-sm font-semibold text-base-content">
          <span className="opacity-60">{posicion + 1}.</span>
          <span className="truncate">{item.docName}</span>
        </h4>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs opacity-70">
          <span>{item.expNumber ?? SIN_EXPEDIENTE}</span>
          <span>{DatetimeUtil.formatDate(item.docCreatedAt)}</span>
          <span>{nombreTipo ?? item.tipoCodigo}</span>
        </div>

        {/* Extracto: TEXTO. Nunca marcado interpretado (T-03.19-64). */}
        <p className="max-w-prose text-xs opacity-60">
          {extractoLegible(texto, LARGO_EXTRACTO_CABECERA)}
        </p>
      </div>

      {/* El botón vive dentro del `<summary>`: sin esto, pulsarlo plegaría además la tarjeta. */}
      <div
        className="flex shrink-0 items-center gap-2"
        onClick={(evento) => evento.stopPropagation()}
      >
        <button
          type="button"
          className="btn btn-sm btn-primary"
          disabled={deshabilitado}
          title={deshabilitado ? motivoDeshabilitado : undefined}
          onClick={() => onUsarComoBase(item)}
        >
          Usar como base
        </button>
      </div>
    </div>
  );

  const cuerpo = (): ReactNode => (
    <div className="max-h-72 overflow-y-auto whitespace-pre-line px-1 py-2 text-sm leading-relaxed">
      {extractoLegible(texto, LARGO_EXTRACTO_CUERPO) || "Sin contenido."}
    </div>
  );

  return (
    <Collapse<ProvidenciaSimilar>
      data={documento}
      index={indice}
      permittedActions={SIN_ACCIONES}
      headerRender={(item, posicion) => cabecera(item, posicion)}
      contentRender={() => cuerpo()}
      className="rounded-box border border-base-300 bg-base-100"
      summaryClassName="p-3"
      contentClassName="border-t border-base-300 px-3 pb-3"
    />
  );
};

export default CollapseDocumentoSimilar;
