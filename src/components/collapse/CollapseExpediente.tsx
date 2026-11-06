/**
 * Microservicio: ejecucion
 * Módulo: Recepción (DME)
 * Feature: Card colapsable de un EPAS (expediente o caso) en la bandeja
 * Archivo: CollapseExpediente.tsx
 * Responsabilidad: Renderizar un EPAS como card colapsable (estilo Resolución): header con su
 * identidad, estado, checkbox de selección opcional y acciones; al expandir, carga on-demand los
 * documentos del expediente (módulo de Resolución vía proxy de Ejecución).
 *
 * Un EPAS es un CASO: un administrado DENTRO de un expediente. Por eso la card tiene dos variantes
 * (prop `variant`): "caso" (anidada en CollapseExpedienteGrupo, se titula con el administrado) y
 * "expediente" (uso histórico/plano, se titula con el número de expediente). Misma card, mismo
 * checkbox controlado, misma carga de documentos — solo cambia qué campo encabeza.
 *
 * La cabecera del CASO dice lo que distingue a un administrado de otro y lo que decide qué se puede
 * hacer con él, sin abrir nada:
 *   - IDENTIDAD: la RAZÓN SOCIAL si es persona jurídica (una empresa no tiene apellido), si no
 *     nombre + apellido.
 *   - "Remitido por el director" (eejeDirectorApprovedAt): el gate RECE-08. NO es un estado —el EPAS
 *     sigue RECIBIDO—, así que el badge de estado no puede decirlo, y sin embargo es lo que habilita
 *     que el secretario lo marque revisado y lo sortee.
 *   - "Bloqueado" (eejeIsLocked) y la ANTIGÜEDAD ("hace 6 días", no una fecha que haya que restar).
 *
 * El checkbox de selección NO vive dentro del <summary>, sino en un gutter a su izquierda (ver la
 * FILA en el render). Dentro del <summary> cualquier click despliega el <details>, y la única forma
 * de evitarlo sería preventDefault() — que en un checkbox cancela TAMBIÉN su toggle nativo y su
 * evento `change`. Sacándolo del <summary>, el input es un checkbox CONTROLADO normal (`checked` +
 * `onChange`), sin trucos sobre el DOM.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-07-13
 * Modificado por: Andrés Miño — 2026-10-26 (Fase 03.21, Plan 11, D-15/D-26, UI-SPEC §8.2: cada
 *   documento del plegable monta `SelloFirma` junto a su chip de tipo; el de `docStatus` no cambia).
 */
import { useState, type FC, type SyntheticEvent } from "react";
import BadgePriority from "../common/BadgePriority";
import { DatetimeUtil } from "../../utils/datetime.util";
import {
  EpasService,
  type EpasListItem,
  type ExpedienteDocumento,
} from "../../services/EpasService";
import type { UserActions } from "../../interfaces/IUser";
import { useModal } from "../../hooks/useModal";
import ResolucionOrigen from "../common/ResolucionOrigen";
import { etiquetaEstadoEpas } from "../../config/estadosEpas";
import SelloFirma from "../expediente/SelloFirma";

interface CollapseExpedienteProps {
  epas: EpasListItem;
  index: number;
  /** Acciones ya resueltas/visibles para esta fila (gating por rol/estado hecho por el padre). */
  actions: UserActions[];
  /** Dispara la acción (abre su modal) con el EPAS de la fila. */
  onAction: (actiName: string, epas: EpasListItem) => void;
  /**
   * Qué representa esta card:
   *   - "expediente" (por defecto): el EPAS se titula con su número de expediente. Uso histórico.
   *   - "caso": la card es UN CASO (un administrado) DENTRO de un expediente, y va anidada en
   *     CollapseExpedienteGrupo. Como el número de expediente y el zonal ya los muestra la cabecera
   *     del grupo, aquí el título es el ADMINISTRADO (que es lo que distingue a un caso de otro).
   * La chrome de la card, los documentos on-demand y la selección son idénticos en ambos casos.
   */
  variant?: "expediente" | "caso";
  /**
   * Selección multi-fila opcional (bandeja de Sorteo: armar la tanda del sorteo en lote con los
   * casos ya revisados). Cuando `selectable` es true, la fila muestra un checkbox a la izquierda de
   * la card. El estado de selección lo gobierna el padre (controlado); si no se pasa, la card se
   * comporta como una card de solo lectura.
   */
  selectable?: boolean;
  selected?: boolean;
  onToggleSelected?: (epas: EpasListItem) => void;
  /**
   * Checkbox visible pero NO seleccionable (p. ej. un caso que aún no está revisado: no es sorteable,
   * pero ocultarle el checkbox escondería por qué no se puede sortear). `selectHint` explica el motivo.
   */
  selectDisabled?: boolean;
  /** Motivo por el que no se puede seleccionar; se muestra como tooltip del checkbox deshabilitado. */
  selectHint?: string;
}

const CollapseExpediente: FC<CollapseExpedienteProps> = ({
  epas,
  index,
  actions,
  onAction,
  variant = "expediente",
  selectable = false,
  selected = false,
  onToggleSelected,
  selectDisabled = false,
  selectHint,
}) => {
  const { openModal } = useModal();
  const [docs, setDocs] = useState<ExpedienteDocumento[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  // IDENTIDAD del administrado. Si tiene RAZÓN SOCIAL es una PERSONA JURÍDICA, y entonces la razón
  // social ES su identidad: armar el título con admiName + admiLastname describiría, en el mejor de
  // los casos, a su representante — y en el peor saldría vacío (una empresa no tiene apellido).
  const administrado =
    epas.admiBusinessName?.trim() ||
    [epas.admiName, epas.admiLastname].filter(Boolean).join(" ") ||
    "Sin administrado";

  // Card de un CASO (administrado) anidado en su expediente vs. card de expediente (uso histórico).
  const esCaso = variant === "caso";

  // ANTIGÜEDAD ("hace 6 días") en vez de la fecha cruda: lo que decide es cuánto lleva esperando.
  const antiguedad = DatetimeUtil.formatTimeAgo(epas.eejeIncomeAt);

  // Gate RECE-08: el DIRECTOR ya lo aprobó y lo REMITIÓ al secretario. No es un estado (el EPAS sigue
  // RECIBIDO), así que el badge de estado NO lo dice — y sin embargo es lo que habilita el sorteo.
  const remitidoPorDirector = Boolean(epas.eejeDirectorApprovedAt);

  // Carga perezosa de documentos: solo la primera vez que se expande el card.
  const loadDocs = async () => {
    if (loaded || loading) return;
    setLoading(true);
    setError(null);
    try {
      const data = await EpasService.getDocumentos(epas.eejeId);
      setDocs(data);
      setLoaded(true);
    } catch {
      // El proxy hacia Resolución aún no está cableado → estado neutro, no error rojo.
      setError(
        "Documentación pendiente de integración con Resolución (por exp_id).",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = (e: SyntheticEvent<HTMLDetailsElement>) => {
    if (e.currentTarget.open) void loadDocs();
  };

  return (
    // FILA = [checkbox en el gutter izquierdo] + [card ocupando el resto del ancho].
    // El checkbox queda FUERA del <details> a propósito: así un click en él no puede desplegar la
    // card y no hace falta preventDefault() (que en un checkbox cancelaría su propio toggle nativo y
    // su evento `change`). Es un checkbox CONTROLADO normal: `checked` + `onChange`, sin tocar el DOM.
    <div className="app-inbox-alert-row flex items-center gap-3">
      {selectable && (
        // El `title` va en el <span>, no en el <input>: un input deshabilitado no recibe eventos de
        // puntero, así que su propio tooltip nunca llegaría a mostrarse.
        <span
          className="app-collapse-select inline-flex shrink-0 items-center"
          title={selectHint}
        >
          <input
            type="checkbox"
            className="checkbox checkbox-primary checkbox-sm"
            checked={selected}
            disabled={selectDisabled}
            aria-label={
              esCaso
                ? `Seleccionar el expediente de ${administrado}`
                : `Seleccionar expediente ${epas.expNumber ?? epas.eejeId}`
            }
            onChange={() => {
              if (selectDisabled) return;
              onToggleSelected?.(epas);
            }}
          />
        </span>
      )}

      <details
        className="app-collapse-alert app-inbox-alert-card min-w-0 flex-1"
        onToggle={handleToggle}
      >
        <summary className="app-collapse-alert-summary cursor-pointer select-none">
          <div className="app-collapse-alert-header">
            {/* Izquierda: identidad del expediente */}
            <div className="app-inbox-document-header-left flex min-w-0 flex-row items-center gap-3">
              <div className="app-inbox-document-info">
                <h3 className="app-collapse-alert-title app-inbox-document-name">
                  <span className="app-collapse-alert-index">{index + 1}.</span>
                  {esCaso ? administrado : (epas.expNumber ?? `EPAS #${epas.eejeId}`)}
                </h3>
                <div className="app-inbox-document-meta">
                  {/* En un CASO, el administrado ya es el título y el zonal lo muestra el grupo. */}
                  {!esCaso && (
                    <span className="app-inbox-document-type">{administrado}</span>
                  )}
                  {epas.admiIdentification && (
                    <span className="app-inbox-document-date">
                      {epas.admiIdentification}
                    </span>
                  )}
                  {!esCaso && epas.expZone && (
                    <span className="app-inbox-document-count">{epas.expZone}</span>
                  )}
                  {/* 2026-09-08: la multa y la resolución de origen. Van en la CABECERA, junto a la
                      identificación, y no en el detalle desplegable: el pedido era verlas sin abrir
                      el expediente. Se omiten solas cuando el dato falta. */}
                  <ResolucionOrigen
                    multa={epas.eejeMultaImpuesta}
                    numero={epas.eejeResolucionNumero}
                    fecha={epas.eejeResolucionFecha}
                  />
                  {antiguedad && (
                    // La fecha exacta queda en el tooltip: en la cabecera pesa más la antigüedad.
                    <span
                      className="app-inbox-document-date"
                      title={`Ingresó el ${DatetimeUtil.formatDate(epas.eejeIncomeAt)}`}
                    >
                      {antiguedad}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Derecha: acciones + señales (remitido/bloqueado) + badge de estado + chevron.
                flex-wrap: la columna de señales creció; en móvil se envuelve en vez de desbordar. */}
            <div className="app-collapse-alert-header-right app-inbox-document-header-right flex-wrap justify-end">
              {actions.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {actions.map((action) => (
                    // El title va en un <span> envolvente, no en el <button>: un botón deshabilitado no
                    // recibe eventos de puntero, así que su propio tooltip no llegaría a mostrarse. Mismo
                    // patrón que la CTA de la cabecera de la Bandeja de Sorteo.
                    <span
                      key={action.actiName}
                      title={
                        action.actiIsDisabled ? action.actiDisabledHint : undefined
                      }
                    >
                      <button
                        type="button"
                        className="btn btn-sm btn-outline btn-primary"
                        disabled={action.actiIsDisabled ?? false}
                        onClick={(e) => {
                          // El botón SÍ vive dentro del <summary>: sin preventDefault() su click
                          // desplegaría/plegaría la card. A diferencia del checkbox, un <button> no
                          // tiene comportamiento nativo por defecto que preventDefault() rompa.
                          e.preventDefault();
                          e.stopPropagation();
                          onAction(action.actiName, epas);
                        }}
                      >
                        <span>{action.actiLabel}</span>
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {/* Chips de SEÑAL, a la izquierda del estado. No son estados: son marcas que el badge
                  de estado NO puede decir (el EPAS remitido sigue RECIBIDO) y que deciden qué se
                  puede hacer con el caso. Cada uno solo aparece cuando aplica. */}
              {remitidoPorDirector && (
                <BadgePriority
                  text="Remitido por el director"
                  priority="remitido"
                  size="md"
                  capitalize={false}
                />
              )}

              {epas.eejeIsLocked && (
                <BadgePriority
                  text="Bloqueado"
                  priority="bloqueado"
                  size="md"
                  capitalize={false}
                />
              )}

              {/* 🔴 EL `toLowerCase()` ERA EL FALLO, no un detalle de estilo (quick 260929-mbo).
                  `BADGE_GROUPS` lleva los quince estados CON sus guiones bajos y en MAYÚSCULAS; en
                  minúsculas solo acertaban cuatro y los otros once caían al `?? default`, el azul
                  pálido, sin que nada fallara. Lo diagnostica la cabecera de `BadgePriority`.
                  `capitalize={false}` porque varias etiquetas son frases («En verificación de
                  pago») y el capitalize por defecto las rompe. */}
              <BadgePriority
                text={etiquetaEstadoEpas(epas.eejeStatus)}
                priority={epas.eejeStatus ?? ""}
                size="md"
                capitalize={false}
              />

              <span className="app-collapse-alert-chevron">
                <svg
                  className="app-collapse-alert-chevron-icon"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </span>
            </div>
          </div>
        </summary>

        <div className="app-collapse-alert-content">
          <div className="app-collapse-alert-body max-h-96 overflow-y-auto">
            <div className="app-inbox-cases-list">
              {loading && (
                <span className="text-sm opacity-70">Cargando documentos…</span>
              )}
              {!loading && error && (
                <span className="text-sm opacity-70">{error}</span>
              )}
              {!loading && !error && docs && docs.length === 0 && (
                <span className="text-sm opacity-70">
                  Sin documentos registrados para este expediente.
                </span>
              )}
              {!loading &&
                !error &&
                docs?.map((doc, i) => (
                  <div
                    key={doc.docId}
                    className="app-inbox-case-item border border-base-300 rounded"
                  >
                    <span className="app-collapse-alert-index">{i + 1}.</span>
                    <div className="app-inbox-case-info">
                      <div className="app-inbox-case-number">
                        <strong>{doc.docName}</strong>
                      </div>
                      <div className="app-inbox-case-details">
                        {doc.tdocTypeName && (
                          <span className="app-inbox-case-administrado">
                            {doc.tdocTypeName}
                          </span>
                        )}
                        {/* Fase 03.21, D-15 (UI-SPEC §8.2): el sello junto al chip de tipo. Se
                            deriva de `firmas`; el chip de `docStatus`, más abajo, NO se toca. */}
                        <SelloFirma
                          firmas={doc.firmas}
                          firmaRequerida={doc.firmaRequerida}
                        />
                        {doc.docUploadedAt && (
                          <span className="app-inbox-case-zone">
                            {DatetimeUtil.formatDate(doc.docUploadedAt)}
                          </span>
                        )}
                      </div>
                      <div className="app-inbox-case-status">
                        {doc.docStatus && (
                          <span className="app-inbox-case-status-badge">
                            {doc.docStatus}
                          </span>
                        )}
                      </div>
                      <div className="app-inbox-case-actions flex flex-wrap gap-2">
                        <div className="app-inbox-case-created">
                          {doc.docUrl && (
                            <button
                              type="button"
                              className="btn btn-sm btn-outline btn-primary"
                              onClick={() => openModal("documentViewer", doc)}
                            >
                              Ver documento
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </details>
    </div>
  );
};

export default CollapseExpediente;
