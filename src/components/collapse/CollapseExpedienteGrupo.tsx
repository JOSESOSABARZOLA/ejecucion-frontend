/**
 * Microservicio: ejecucion
 * Módulo: Recepción / Sorteo (DME)
 * Feature: Card colapsable de un EXPEDIENTE con sus CASOS anidados
 * Archivo: CollapseExpedienteGrupo.tsx
 * Responsabilidad: Renderizar el nivel EXPEDIENTE de las bandejas. La bandeja NO se divide por
 *   administrado: se divide por EXPEDIENTE (exp_number) y, DENTRO de cada expediente, van sus CASOS
 *   (un caso = un administrado de ese expediente = una fila EPAS).
 *
 *     EXPEDIENTE EXP-001      [Aprobar y enviar]  [x] ← acciones y selección del EXPEDIENTE COMPLETO
 *       ├─ caso: Ana Pérez        VERIFICADO     [x] ← selecciona un CASO
 *       ├─ caso: Beto Lara        VERIFICADO     [ ]
 *       └─ caso: Carla Ruiz       RECIBIDO       [-] ← no sorteable aún (deshabilitado)
 *
 *   La CABECERA del expediente lleva lo que cambia una decisión SIN abrirlo — y nada más:
 *     · materia (por su NOMBRE, no el id) · fojas · zona
 *     · MEDIDA CAUTELAR como badge de alerta y SOLO si existe: es la señal que altera la prioridad.
 *     · PROGRESO de la tanda ("2 revisados · 1 por revisar"): el dato del secretario — le dice si
 *       puede sortear el expediente COMPLETO, porque solo lo revisado (VERIFICADO) es sorteable.
 *     · ANTIGÜEDAD del caso que lleva más esperando ("recibido hace 6 días"), no una fecha cruda que
 *       haya que restar mentalmente contra hoy.
 *   Progreso y antigüedad se DERIVAN de `grupo.casos` en el cliente: el backend garantiza que un
 *   expediente nunca llega partido entre páginas, así que el conteo es el del expediente entero.
 *
 *   La card tiene DOS niveles de acción, espejo uno del otro: `casoActions`/`onCasoAction` (dentro,
 *   por administrado) y `grupoActions`/`onGrupoAction` (en la cabecera, sobre el expediente entero).
 *   El director decide por EXPEDIENTE —es como la DMR se lo remite y como razona—, pero conserva el
 *   caso a caso: el nivel de expediente AÑADE una vía, no cierra la otra. El gating y el motivo de una
 *   acción deshabilitada los resuelve el padre (misma máquina isInboxActionVisible en ambos niveles).
 *
 *   Cada caso se renderiza REUSANDO CollapseExpediente (variant="caso"): misma card, mismo checkbox
 *   controlado, mismos documentos on-demand al expandir. Este componente solo aporta el contenedor y
 *   el checkbox de dos niveles con estado INDETERMINADO (selección parcial), que el DOM no expresa por
 *   atributo sino por la propiedad `indeterminate` del input (único motivo del `ref`: `checked` lo
 *   gobierna React, no se escribe a mano).
 *
 *   El checkbox del expediente vive FUERA del <summary>, en un gutter a la izquierda de la card (igual
 *   que el de cada caso). Dentro del <summary>, un click en el checkbox desplegaría el <details>, y la
 *   única defensa sería preventDefault() — que en un checkbox cancela TAMBIÉN su toggle nativo y su
 *   evento `change`, obligando a "controlarlo a mano" contra el DOM. Fuera del <summary> no hace falta
 *   nada de eso: es un checkbox CONTROLADO normal (`checked` + `onChange`).
 *
 *   La selección de "expediente completo" solo abarca los casos SELECCIONABLES (`isCasoSelectable`):
 *   en la Bandeja de Sorteo, los ya revisados (VERIFICADO). Un caso no revisado no es sorteable, así
 *   que marcarlo rompería el gate RECE-08 — se muestra con el checkbox deshabilitado y su motivo, en
 *   vez de ocultarlo (el usuario debe VER por qué no entra en la tanda).
 * Desarrollador: Andrés Miño
 * Fecha: 2026-07-13
 * Modificado por: Andrés Miño — 2026-10-16 (Fase 03.23, Plan 12, D-14/D-17): la materia de la
 *   cabecera es la DEDUCIDA del código de infracción; el expediente ya no tiene id de materia.
 */
import { useState, type FC, type SyntheticEvent } from "react";
import CollapseExpediente from "./CollapseExpediente";
import BadgePriority from "../common/BadgePriority";
import { DatetimeUtil } from "../../utils/datetime.util";
import { EPAS_ESTADO_REVISADO } from "../../config/inboxActionStatusRules";
import type { EpasListItem, ExpedienteGrupo } from "../../services/EpasService";
import type { UserActions } from "../../interfaces/IUser";

interface CollapseExpedienteGrupoProps {
  grupo: ExpedienteGrupo;
  index: number;
  /** Acciones visibles de UN caso (el gating rol+estado lo hace el padre). */
  casoActions: (caso: EpasListItem) => UserActions[];
  /** Dispara la acción de un caso. */
  onCasoAction: (actiName: string, caso: EpasListItem) => void;
  /**
   * Acciones del EXPEDIENTE COMPLETO (espejo de casoActions, un nivel más arriba). El director aprueba
   * y remite —o devuelve— el expediente entero: es como la DMR se lo remite y como él razona. Se
   * renderizan en la cabecera del grupo y NO sustituyen a las de caso, que siguen disponibles dentro.
   * Si se omite, el expediente no ofrece acciones propias (bandejas donde nadie decide por expediente).
   */
  grupoActions?: (grupo: ExpedienteGrupo) => UserActions[];
  /** Dispara la acción del EXPEDIENTE COMPLETO. */
  onGrupoAction?: (actiName: string, grupo: ExpedienteGrupo) => void;
  /**
   * Selección de dos niveles (Bandeja de Sorteo). Si se omite, el grupo es de solo lectura
   * (bandejas de Entrada/Recepción: se agrupa igual, pero no hay tanda que armar).
   */
  selectable?: boolean;
  /** eeje_id de los casos seleccionados (lo gobierna el padre — controlado). */
  selectedCasos?: Set<number>;
  /** ¿Este caso puede entrar en la tanda? (Sorteo: solo los VERIFICADO.) Por defecto, todos. */
  isCasoSelectable?: (caso: EpasListItem) => boolean;
  /** Alterna UN caso. */
  onToggleCaso?: (caso: EpasListItem) => void;
  /** Alterna el EXPEDIENTE COMPLETO: `seleccionar` = true marca todos sus casos seleccionables. */
  onToggleExpediente?: (grupo: ExpedienteGrupo, seleccionar: boolean) => void;
  /** Motivo por el que un caso no es seleccionable (se muestra junto a su checkbox deshabilitado). */
  casoNoSeleccionableHint?: string;
}

const CollapseExpedienteGrupo: FC<CollapseExpedienteGrupoProps> = ({
  grupo,
  index,
  casoActions,
  onCasoAction,
  grupoActions,
  onGrupoAction,
  selectable = false,
  selectedCasos,
  isCasoSelectable = () => true,
  onToggleCaso,
  onToggleExpediente,
  casoNoSeleccionableHint,
}) => {
  // El expediente abre desplegado: sus CASOS son el contenido principal de la bandeja, no un detalle.
  const [open, setOpen] = useState(false);

  // Acciones del EXPEDIENTE COMPLETO (cabecera del grupo). El gating —y el motivo por el que una
  // acción va deshabilitada— lo resuelve el padre, igual que con las de caso.
  const accionesDelExpediente = grupoActions?.(grupo) ?? [];

  const seleccionables = grupo.casos.filter(isCasoSelectable);
  const seleccionados = seleccionables.filter((caso) =>
    selectedCasos?.has(caso.eejeId),
  );

  // PROGRESO DE LA TANDA — el dato del secretario. Le dice, sin abrir el expediente, si puede
  // sortearlo COMPLETO: solo lo revisado (VERIFICADO) es sorteable, así que "1 por revisar" es
  // exactamente lo que le falta. Se deriva de los casos que la bandeja ya trajo (el backend garantiza
  // que un expediente nunca llega partido entre páginas: el conteo es del expediente entero).
  const revisados = grupo.casos.filter(
    (caso) => caso.eejeStatus === EPAS_ESTADO_REVISADO,
  ).length;
  const porRevisar = grupo.casos.length - revisados;
  // Nunca se escribe "0 revisados": un cero no informa, solo ocupa. Se muestran los tramos que existen.
  const progreso = [
    revisados > 0 ? `${revisados} ${revisados === 1 ? "revisado" : "revisados"}` : null,
    porRevisar > 0 ? `${porRevisar} por revisar` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  // ANTIGÜEDAD del expediente = la del caso que lleva MÁS tiempo esperando (el ingreso más antiguo).
  // Es el mismo criterio con el que el backend ordena la bandeja.
  const ingresoMasAntiguo = grupo.casos
    .map((caso) => caso.eejeIncomeAt)
    .filter((fecha): fecha is string => Boolean(fecha))
    .sort()[0];
  const antiguedad = DatetimeUtil.formatTimeAgo(ingresoMasAntiguo);

  // MEDIDA CAUTELAR. El vocabulario del dominio ('Clausura' | 'Retiro de bienes/productos' |
  // 'Sin medida') incluye un valor que significa literalmente NO HAY MEDIDA: tratarlo como "tiene
  // valor" pintaría un badge de ALERTA que dice "Sin medida" — una alarma que anuncia que no pasa
  // nada. Aquí "Sin medida" es lo mismo que null.
  //
  // "true"/"false" son basura HEREDADA: el ingreso declaraba esta columna como booleano (bug
  // corregido en este mismo cambio) y aterrizaba la cadena en una columna descriptiva. Un badge que
  // diga "Medida cautelar: true" no dice CUÁL es la medida, que es lo único que sirve para decidir.
  const NO_ES_MEDIDA = ["sin medida", "true", "false"];
  const medidaCautelarCruda = grupo.expMedidaCautelar?.trim();
  const medidaCautelar =
    medidaCautelarCruda &&
    !NO_ES_MEDIDA.includes(medidaCautelarCruda.toLowerCase())
      ? medidaCautelarCruda
      : null;

  // Estado del checkbox del EXPEDIENTE: todos / algunos (indeterminado) / ninguno.
  const todosSeleccionados =
    seleccionables.length > 0 && seleccionados.length === seleccionables.length;
  const parcial = seleccionados.length > 0 && !todosSeleccionados;
  // Sin casos seleccionables no hay expediente que marcar (p. ej. ningún caso revisado todavía).
  const expedienteSeleccionable = selectable && seleccionables.length > 0;

  const handleToggle = (e: SyntheticEvent<HTMLDetailsElement>) => {
    setOpen(e.currentTarget.open);
  };

  return (
    // FILA = [checkbox del EXPEDIENTE en el gutter] + [card del expediente ocupando el resto].
    <div className="app-inbox-alert-row flex items-center gap-3">
      {selectable && (
        // El `title` va en el <span>, no en el <input>: un input deshabilitado no recibe eventos de
        // puntero, así que su propio tooltip nunca llegaría a mostrarse.
        <span
          className="app-collapse-select inline-flex shrink-0 items-center"
          title={
            expedienteSeleccionable
              ? "Seleccionar el expediente completo (todos sus administrados listos para sortear)"
              : "Este expediente aún no tiene administrados revisados que sortear."
          }
        >
          <input
            type="checkbox"
            className="checkbox checkbox-primary checkbox-sm"
            checked={todosSeleccionados}
            disabled={!expedienteSeleccionable}
            // ÚNICO uso legítimo del ref: `indeterminate` (selección parcial) no existe como atributo
            // HTML, solo como propiedad del nodo, así que React no puede renderizarlo. `checked` NO se
            // escribe aquí: lo gobierna React desde `todosSeleccionados` (checkbox controlado).
            ref={(el) => {
              if (el) el.indeterminate = parcial;
            }}
            aria-label={`Seleccionar todos los administrados del expediente ${grupo.expNumber ?? grupo.expId}`}
            onChange={() => {
              if (!expedienteSeleccionable) return;
              // Parcial o vacío → completar la selección; completo → vaciarla.
              onToggleExpediente?.(grupo, !todosSeleccionados);
            }}
          />
        </span>
      )}

      <details
        className="app-collapse-alert app-inbox-alert-card min-w-0 flex-1"
        open={open}
        onToggle={handleToggle}
      >
        <summary className="app-collapse-alert-summary cursor-pointer select-none">
          <div className="app-collapse-alert-header">
            {/* Izquierda: identidad del EXPEDIENTE. */}
            <div className="app-inbox-document-header-left flex min-w-0 flex-row items-center gap-3">
              <div className="app-inbox-document-info">
              <h3 className="app-collapse-alert-title app-inbox-document-name">
                <span className="app-collapse-alert-index">{index + 1}.</span>
                Expediente {grupo.expNumber ?? `#${grupo.expId}`}
              </h3>
              {/* Meta del EXPEDIENTE: lo que hace falta para decidir sin abrirlo. Los campos son del
                  EXPEDIENTE (no del caso) y por eso viven aquí y no se repiten en cada card de caso. */}
              <div className="app-inbox-document-meta">
                <span className="app-inbox-document-type">
                  {/* 2026-09-08: el nivel de abajo se nombra por lo que ES, el administrado. Decir
                      «3 expedientes» dentro de la card de UN expediente borraría la jerarquía que
                      esta card existe para enseñar; `totalCasos` sigue siendo el nombre del dato
                      porque es el contrato del backend. */}
                  {grupo.totalCasos}{" "}
                  {grupo.totalCasos === 1 ? "administrado" : "administrados"}
                </span>
                {grupo.expZone && (
                  <span className="app-inbox-document-count">
                    {grupo.expZone}
                  </span>
                )}
                {/* MATERIA por su NOMBRE, DEDUCIDA por el servidor del código de las infracciones
                    (Fase 03.23, D-17); ya no hay id de materia. Sin infracciones no viene y aquí
                    simplemente no se pinta (la fila nunca se oculta por eso). */}
                {grupo.expMateria && (
                  <span className="app-inbox-document-count">
                    {grupo.expMateria}
                  </span>
                )}
                {grupo.expFojas != null && (
                  <span className="app-inbox-document-count">
                    {grupo.expFojas} {grupo.expFojas === 1 ? "foja" : "fojas"}
                  </span>
                )}
                {/* PROGRESO de la tanda: si puede sortearse el expediente completo o qué falta. */}
                {progreso && (
                  <span className="app-inbox-document-count font-semibold">
                    {progreso}
                  </span>
                )}
                {/* ANTIGÜEDAD del caso que lleva más esperando (la fecha exacta, en el tooltip). */}
                {antiguedad && (
                  <span
                    className="app-inbox-document-date"
                    title={`Ingreso más antiguo: ${DatetimeUtil.formatDate(ingresoMasAntiguo)}`}
                  >
                    recibido {antiguedad}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Derecha: medida cautelar + acciones del EXPEDIENTE + cuántos casos están en la tanda +
              chevron. flex-wrap: la columna creció; en móvil se envuelve en vez de desbordar. */}
          <div className="app-collapse-alert-header-right app-inbox-document-header-right flex-wrap justify-end">
            {/* MEDIDA CAUTELAR: badge de alerta, y SOLO si existe. Es la señal que cambia la prioridad
                del expediente (hay algo clausurado/retenido mientras esto espera). Pintar un badge
                "Sin medida" en todos los demás la volvería invisible por repetición — por eso el
                valor 'Sin medida' del vocabulario cuenta como NO tener medida. */}
            {medidaCautelar && (
              <BadgePriority
                text={`Medida cautelar: ${medidaCautelar}`}
                priority="medida cautelar"
                size="md"
                capitalize={false}
              />
            )}

            {accionesDelExpediente.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {accionesDelExpediente.map((action) => (
                  // El title va en un <span> envolvente, no en el <button>: un botón deshabilitado no
                  // recibe eventos de puntero, así que su propio tooltip no llegaría a mostrarse. El
                  // motivo se muestra AL PASAR EL CURSOR, no como texto inline (mismo patrón que el
                  // checkbox deshabilitado de un caso y que las acciones de CollapseExpediente).
                  <span
                    key={action.actiName}
                    title={
                      action.actiIsDisabled ? action.actiDisabledHint : undefined
                    }
                  >
                    <button
                      type="button"
                      className="btn btn-sm btn-primary"
                      disabled={action.actiIsDisabled ?? false}
                      onClick={(e) => {
                        // El botón SÍ vive dentro del <summary>: sin preventDefault() su click
                        // desplegaría/plegaría la card. A diferencia de un checkbox, un <button> no
                        // tiene comportamiento nativo por defecto que preventDefault() rompa.
                        e.preventDefault();
                        e.stopPropagation();
                        onGrupoAction?.(action.actiName, grupo);
                      }}
                    >
                      <span>{action.actiLabel}</span>
                    </button>
                  </span>
                ))}
              </div>
            )}

            {expedienteSeleccionable && (
              <span className="badge badge-primary badge-outline whitespace-nowrap">
                {seleccionados.length}/{seleccionables.length} en la tanda
              </span>
            )}

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

        {/* Contenido del expediente: sus CASOS (cada uno con su estado, acciones y documentos). */}
        <div className="app-collapse-alert-content">
          <div className="app-collapse-alert-body">
            <div className="app-data-list">
              {grupo.casos.map((caso, i) => {
                const puedeSeleccionarse = isCasoSelectable(caso);
                return (
                  <CollapseExpediente
                    key={caso.eejeId}
                    epas={caso}
                    index={i}
                    variant="caso"
                    actions={casoActions(caso)}
                    onAction={onCasoAction}
                    selectable={selectable}
                    selected={selectedCasos?.has(caso.eejeId) ?? false}
                    selectDisabled={!puedeSeleccionarse}
                    onToggleSelected={onToggleCaso}
                    selectHint={
                      puedeSeleccionarse ? undefined : casoNoSeleccionableHint
                    }
                  />
                );
              })}
            </div>
          </div>
        </div>
      </details>
    </div>
  );
};

export default CollapseExpedienteGrupo;
