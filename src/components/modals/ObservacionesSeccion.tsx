/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/epas (frontend)
 * Feature: Panel lateral de observaciones por campo y por documento
 * Archivo: ObservacionesSeccion.tsx
 * Responsabilidad: El panel de la derecha de la ficha del expediente — la caja donde se escribe la
 *   observación del objetivo pulsado, el recuento, la lista de lo anotado con su ✕ por fila, y los
 *   dos botones que persisten o borran el conjunto.
 *
 *   🔴 ES PRESENTACIONAL Y NO LLAMA AL SERVICIO. Recibe todo por props y avisa hacia arriba: quien
 *   persiste es la ficha. No es purismo — es lo que permite probar las cuatro conductas del panel
 *   (elegir objetivo, guardar borrador, impedir el duplicado, borrar fila) sin montar red ni modal.
 *
 *   Portado de `resolucion-frontend/src/features/case-detail/components/ObservationSeccion.tsx`, con
 *   la lista tipada del backend de Ejecución en lugar de los dos `Record` de allí.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-09-18
 * Modificado por: Andrés Miño — 2026-10-19 (UAT 03.23-14: fuera el botoncito de «añadir a la lista»
 *   junto al rótulo, que nadie veía; lo escrito viaja con «Guardar observaciones» o al cambiar de
 *   objetivo, y eso lo resuelve la ficha con `conBorrador`)
 * Modificado por: Andrés Miño — 2026-10-21 (Fase 03.24, cierre de huecos G-01)
 */
import { useState, type FC } from "react";
import { format, isValid, parseISO } from "date-fns";
import Boton from "../common/Boton";
import {
  buscarObjetivo,
  contarVerificaciones,
  estadoDe,
  type IObservacion,
  type IObservacionBorrador,
  type ObservacionVerificacion,
} from "../../interfaces/ICaseObservations";

// ── Textos de UI-SPEC §6.1 (G-01), exportados para que las pruebas los importen y no los copien ──

/** Rótulo del grupo de la devolución anterior; el recuento « · N por verificar» se añade aparte. */
export const ROTULO_ANTERIORES = "Observaciones de la devolución anterior";
/** Rótulo de las nuevas. Solo se pinta cuando hay grupo anterior. */
export const ROTULO_NUEVAS = "Observaciones nuevas";
export const PISTA_ANTERIORES_DIRECTOR =
  "Resolución volvió a enviar el expediente. Marque cada observación como cumplida o no cumplida; no se pueden editar.";
export const PISTA_ANTERIORES_SECRETARIO =
  "Las verifica el director. No se pueden editar.";
export const PISTA_OBJETIVO_ANTERIOR =
  "Este campo o documento tiene una observación de la devolución anterior. Se verifica en su grupo y no se puede editar ni borrar.";
/** El badge de cada estado de verificación. El color nunca va solo: el texto dice el estado. */
export const BADGE_VERIFICACION = {
  POR_VERIFICAR: "Por verificar",
  CUMPLIDA: "Cumplida",
  NO_CUMPLIDA: "No cumplida",
} as const;

const CLASE_BADGE_VERIFICACION: Record<ObservacionVerificacion, string> = {
  POR_VERIFICAR: "badge badge-sm badge-ghost",
  CUMPLIDA: "badge badge-sm badge-success",
  NO_CUMPLIDA: "badge badge-sm badge-error",
};

/** «Observaciones nuevas guardadas: N». Solo con grupo anterior; sin él, el texto de siempre. */
const totalNuevasTexto = (n: number) => `Observaciones nuevas guardadas: ${n}`;

/**
 * «Verificada por {nombre} el {dd/mm/aaaa}», o nada. Sin nombre o sin fecha válida no se pinta
 * la línea: nunca un «undefined» delante del usuario.
 */
const autoriaVerificacion = (observacion: IObservacion): string | null => {
  if (!observacion.verificadaPorNombre || !observacion.verificadaAt) return null;
  const fecha = parseISO(observacion.verificadaAt);
  if (!isValid(fecha)) return null;
  return `Verificada por ${observacion.verificadaPorNombre} el ${format(fecha, "dd/MM/yyyy")}`;
};

interface ObservacionesSeccionProps {
  /** Lo que se está escribiendo. Sin `clave`, no hay objetivo elegido y la caja se deshabilita. */
  borrador: IObservacionBorrador;
  /** Lo que la ficha muestra ahora mismo (puede tener cambios sin guardar). */
  observaciones: IObservacion[];
  onBorradorChange: (borrador: IObservacionBorrador) => void;
  onOcultar: () => void;
  /** Quita UNA observación de la lista, por su objetivo. */
  onBorrar: (tipo: IObservacion["tipo"], clave: string) => void;
  /** Manda la lista al servidor, con lo escrito en la caja incluido (lo añade la ficha). */
  onGuardar: () => void;
  /** Manda una lista vacía al servidor (borrado total). */
  onBorrarTodas: () => void;
  /** En curso: los dos botones de abajo se apagan mientras la petición vuela. */
  guardando?: boolean;
  /**
   * ¿Quien mira es DIRECTOR? Entonces el panel deja de ser solo de escritura y ofrece el veredicto:
   * ✓ / ✗ por fila (2026-09-18, encargo del área — «cuando el director revisa las observaciones, se
   * le debe levantar el mismo modal que cuando se agregan»).
   *
   * 🔴 ES EL MISMO PANEL Y NO OTRO. Antes la revisión vivía en un diálogo propio de la Bandeja de
   * Salida: dos pantallas para el mismo objeto, y quien anotaba no veía nunca dónde se decidía. Aquí
   * el director mira la ficha —el campo mal escrito, el documento ilegible— y decide con eso delante.
   */
  puedeRevisar?: boolean;
  /** `usu_id` de quien mira. Sobre lo que él mismo anotó NO hay veredicto: ya nació consentido. */
  usuarioId?: number;
  /** Aprueba una observación. Solo se ofrece si `puedeRevisar` y la observación es de otro. */
  onAprobar?: (obseId: number) => void;
  /** La rechaza, con el motivo que el secretario va a leer. El motivo es obligatorio. */
  onRechazar?: (obseId: number, motivo: string) => void;
  /** En vuelo: apaga los veredictos mientras la petición viaja. */
  revisando?: boolean;
  /**
   * Las observaciones de la DEVOLUCIÓN ANTERIOR de un expediente reingresado (Fase 03.24, G-01).
   * Son de SOLO LECTURA: se pintan como texto en su propio grupo, encima de la caja, sin `✕` y
   * fuera de «Borrar observaciones». `observaciones` lleva entonces solo las nuevas.
   */
  anteriores?: IObservacion[];
  /**
   * El director se pronuncia sobre UNA observación anterior: ¿la DMR la cumplió? Solo se ofrece con
   * `puedeRevisar`, y también sobre lo que él mismo anotó: comprobar si la DMR cumplió no es
   * aprobarse a sí mismo (UI-SPEC §1.1).
   */
  onVerificar?: (
    obseId: number,
    verificacion: "CUMPLIDA" | "NO_CUMPLIDA",
  ) => void;
  /** En vuelo: apaga todo el grupo de verificación y marca la lista con `aria-busy`. */
  verificando?: boolean;
}

const ObservacionesSeccion: FC<ObservacionesSeccionProps> = ({
  borrador,
  observaciones,
  onBorradorChange,
  onOcultar,
  onBorrar,
  onGuardar,
  onBorrarTodas,
  guardando = false,
  puedeRevisar = false,
  usuarioId,
  onAprobar,
  onRechazar,
  revisando = false,
  anteriores = [],
  onVerificar,
  verificando = false,
}) => {
  /**
   * La fila que el director está rechazando ahora mismo, con su motivo a medias. Es estado de UI y
   * NADA MÁS —el panel sigue sin llamar al servicio—, pero tiene que vivir aquí: la caja del motivo
   * se abre BAJO su propia fila, y subirlo a la ficha obligaría a que la ficha supiera qué fila está
   * abierta, que es justo lo que no le importa.
   */
  const [rechazando, setRechazando] = useState<{
    obseId: number;
    motivo: string;
  } | null>(null);

  /** ¿Se puede dar veredicto sobre esta? Ni sobre lo propio, ni sobre lo que aún no tiene id. */
  const revisable = (observacion: IObservacion) =>
    puedeRevisar &&
    observacion.obseId != null &&
    observacion.createdBy !== usuarioId;

  const hayAnteriores = anteriores.length > 0;
  const recuento = contarVerificaciones(anteriores);

  const hayObjetivo = Boolean(borrador.clave);
  /** El objetivo elegido tiene una observación de la devolución anterior: ni se edita ni se borra. */
  const objetivoAnterior =
    hayObjetivo &&
    Boolean(buscarObjetivo(anteriores, borrador.tipo, borrador.clave));
  const yaObservado =
    hayObjetivo &&
    !objetivoAnterior &&
    Boolean(buscarObjetivo(observaciones, borrador.tipo, borrador.clave));

  /** Pulsar el botón ya pulsado no hace nada: no vuelve a «Por verificar» (UI-SPEC §1.4). */
  const pulsarVerificacion = (
    observacion: IObservacion,
    verificacion: "CUMPLIDA" | "NO_CUMPLIDA",
  ) => {
    if (observacion.obseId == null || verificando) return;
    if ((observacion.verificacion ?? "POR_VERIFICAR") === verificacion) return;
    onVerificar?.(observacion.obseId, verificacion);
  };

  return (
    <aside className="app-modules-case-observation-panel">
      <div className="app-modules-docs-preview-header">
        <h4 className="app-modules-docs-preview-title">Observaciones</h4>
        <button
          type="button"
          className="app-modules-docs-preview-hide btn btn-sm"
          onClick={onOcultar}
          aria-label="Ocultar observaciones"
        >
          Ocultar
        </button>
      </div>

      {/* EL GRUPO DE LA DEVOLUCIÓN ANTERIOR (Fase 03.24, G-01 / L-1). Va ENCIMA de las nuevas y es
          de SOLO LECTURA: el texto se pinta como texto, no como un campo apagado (UI-SPEC §1.3,
          R7), sin ✕ y fuera de «Borrar observaciones». Sin anteriores, el grupo no se monta. */}
      {hayAnteriores && (
        <section
          aria-labelledby="obs-anteriores-titulo"
          className="mb-4 flex flex-col gap-1"
        >
          <h5
            id="obs-anteriores-titulo"
            className="text-xs font-semibold uppercase tracking-[0.12em] py-2"
          >
            {ROTULO_ANTERIORES}
            {recuento.porVerificar > 0 &&
              ` · ${recuento.porVerificar} por verificar`}
          </h5>
          <p className="text-sm text-base-content/75">
            {puedeRevisar
              ? PISTA_ANTERIORES_DIRECTOR
              : PISTA_ANTERIORES_SECRETARIO}
          </p>
          <ul
            className="app-item-list app-item-list--observations border border-gray-200 rounded"
            aria-busy={verificando}
          >
            {anteriores.map((observacion, indice) => {
              const verificacion: ObservacionVerificacion =
                observacion.verificacion ?? "POR_VERIFICAR";
              const autoria = autoriaVerificacion(observacion);
              return (
                <li
                  key={`anterior-${observacion.tipo}-${observacion.clave}`}
                  className="app-item-list-row flex-col items-stretch gap-1"
                >
                  <div className="flex w-full items-start gap-2">
                    <span className="app-item-list-index">{indice + 1}.</span>
                    <div className="app-item-list-primary">
                      <div className="app-item-list-identifying">
                        {observacion.etiqueta}
                      </div>
                      <div className="app-item-list-complementary">
                        {observacion.texto}
                      </div>
                    </div>
                    <div className="app-item-list-secondary">
                      <span className="app-item-list-info--media">
                        {observacion.tipo}
                      </span>
                      <span className={CLASE_BADGE_VERIFICACION[verificacion]}>
                        {BADGE_VERIFICACION[verificacion]}
                      </span>
                    </div>
                  </div>

                  {/* El par de interruptores del director (UI-SPEC §1.4): dos <button> con
                      aria-pressed y no radios, para que las flechas no disparen peticiones. Sin
                      pulsar es el `btn` neutro; el color solo aparece en el pulsado. Se ofrece
                      también sobre lo que él mismo anotó: aquí no hay «Suya». */}
                  {puedeRevisar && (
                    <div
                      role="group"
                      aria-label={`Verificación de la observación de ${observacion.etiqueta}`}
                      className="join mt-1 pl-8"
                    >
                      <button
                        type="button"
                        aria-pressed={verificacion === "CUMPLIDA"}
                        className={`btn btn-sm join-item ${
                          verificacion === "CUMPLIDA" ? "btn-success" : ""
                        }`}
                        aria-label={`Marcar como cumplida la observación de ${observacion.etiqueta}`}
                        disabled={verificando}
                        onClick={() =>
                          pulsarVerificacion(observacion, "CUMPLIDA")
                        }
                      >
                        Cumplida
                      </button>
                      <button
                        type="button"
                        aria-pressed={verificacion === "NO_CUMPLIDA"}
                        className={`btn btn-sm join-item ${
                          verificacion === "NO_CUMPLIDA" ? "btn-error" : ""
                        }`}
                        aria-label={`Marcar como no cumplida la observación de ${observacion.etiqueta}`}
                        disabled={verificando}
                        onClick={() =>
                          pulsarVerificacion(observacion, "NO_CUMPLIDA")
                        }
                      >
                        No cumplida
                      </button>
                    </div>
                  )}

                  {autoria && (
                    <p className="text-xs text-base-content/75 mt-1 pl-8">
                      {autoria}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {hayAnteriores && (
        <h5 className="text-xs font-semibold uppercase tracking-[0.12em] py-2">
          {ROTULO_NUEVAS}
        </h5>
      )}

      <div className="app-modules-case-observation-form-card">
        <div className="app-modules-modal-field form-control w-full">
          <label className="label py-1 justify-between gap-2">
            {/* El rótulo de la caja es la ETIQUETA del objetivo pulsado: es lo que dice al usuario
                sobre qué está escribiendo, y es exactamente lo que saldrá impreso en el memorando. */}
            <span className="app-modules-modal-label label-text font-medium min-w-0 wrap-break-word">
              {borrador.etiqueta || "Observación"}
            </span>
          </label>
          <textarea
            value={borrador.texto}
            onChange={(event) =>
              onBorradorChange({ ...borrador, texto: event.target.value })
            }
            placeholder={
              hayObjetivo
                ? "Escriba la observación…"
                : "Seleccione un campo o documento…"
            }
            disabled={!hayObjetivo || yaObservado || objetivoAnterior}
            aria-label="Texto de la observación"
            className="app-modules-modal-input textarea textarea-bordered w-full transition-all focus:textarea-primary"
            rows={2}
          />
        </div>

        {yaObservado && (
          <p className="app-modules-case-observation-duplicate-hint">
            Este campo o documento ya tiene una observación registrada. Bórrela
            para escribir otra.
          </p>
        )}
        {/* Sobre una observación anterior, «Bórrela» sería imposible: se dice dónde se verifica. */}
        {objetivoAnterior && (
          <p className="app-modules-case-observation-duplicate-hint">
            {PISTA_OBJETIVO_ANTERIOR}
          </p>
        )}
      </div>

      <p className="app-modules-case-observation-total-label">
        {hayAnteriores
          ? totalNuevasTexto(observaciones.length)
          : `Total de observaciones guardadas: ${observaciones.length}`}
      </p>

      <div className="app-modules-case-observation-list">
        {observaciones.length > 0 ? (
          <ul className="app-item-list app-item-list--observations border border-gray-200 rounded">
            {observaciones.map((observacion, indice) => (
              <li
                key={`${observacion.tipo}-${observacion.clave}`}
                className="app-item-list-row flex-col items-stretch gap-2"
              >
                <div className="flex w-full items-start gap-2">
                <span className="app-item-list-index">{indice + 1}.</span>
                <div className="app-item-list-primary">
                  <div className="app-item-list-identifying">
                    {observacion.etiqueta}
                  </div>
                  <div className="app-item-list-complementary">
                    {observacion.texto}
                  </div>
                  {/* El motivo del rechazo, bajo la observación que desechó. Es la CONTESTACIÓN al
                      secretario: sin ella el rechazo sería una casilla que le apaga el trabajo sin
                      decirle qué hacer. */}
                  {estadoDe(observacion) === "RECHAZADA" &&
                    observacion.motivoRechazo && (
                      <div className="app-item-list-complementary italic opacity-80">
                        Motivo del rechazo: {observacion.motivoRechazo}
                      </div>
                    )}
                </div>
                <div className="app-item-list-secondary">
                  {/* CAMPO o DOCUMENTO se dice en la fila: sin eso, «Acta de inspección» en medio de
                      una lista de campos parece un campo más del expediente. */}
                  <span className="app-item-list-info--media">
                    {observacion.tipo}
                  </span>
                  {/* EL VEREDICTO DEL DIRECTOR (2026-09-18), en la ficha del secretario.
                      🔴 Sin esto el rechazo sería invisible para quien lo escribió: la observación
                      seguiría en su lista y él creería que va a viajar, cuando el memorando ya no la
                      va a imprimir. Lo PENDIENTE no se pinta —es lo normal mientras nadie revisa— y
                      un badge en cada fila recién escrita solo sería ruido. */}
                  {estadoDe(observacion) === "APROBADA" && (
                    <span className="badge badge-sm badge-success">
                      Aprobada
                    </span>
                  )}
                  {estadoDe(observacion) === "RECHAZADA" && (
                    <span
                      className="badge badge-sm badge-error"
                      title={
                        observacion.motivoRechazo
                          ? `El director la rechazó: ${observacion.motivoRechazo}`
                          : "El director la rechazó"
                      }
                    >
                      Rechazada
                    </span>
                  )}
                </div>
                <div className="app-item-list-actions flex gap-1">
                  {/* EL VEREDICTO DEL DIRECTOR, EN LA MISMA FILA EN QUE SE ESCRIBIÓ (2026-09-18).
                      Solo sobre lo que anotó OTRO: lo suyo nació consentido y no se revisa a sí
                      mismo. Sobre lo propio se pinta «Suya», para que el hueco no parezca un fallo. */}
                  {revisable(observacion) && (
                    <>
                      <Boton
                        estilos={`btn btn-xs ${
                          estadoDe(observacion) === "APROBADA"
                            ? "btn-success"
                            : "btn-outline btn-success"
                        }`}
                        texto="Aprobar"
                        deshabilitado={revisando}
                        onClick={() => onAprobar?.(observacion.obseId!)}
                      />
                      <Boton
                        estilos={`btn btn-xs ${
                          estadoDe(observacion) === "RECHAZADA"
                            ? "btn-error"
                            : "btn-outline btn-error"
                        }`}
                        texto="Rechazar"
                        deshabilitado={revisando}
                        onClick={() =>
                          setRechazando({
                            obseId: observacion.obseId!,
                            motivo: "",
                          })
                        }
                      />
                    </>
                  )}
                  {puedeRevisar &&
                    observacion.obseId != null &&
                    observacion.createdBy === usuarioId && (
                      <span
                        className="badge badge-sm badge-info whitespace-nowrap"
                        title="La anotó usted: ya consta aprobada por usted y no necesita revisión."
                      >
                        Suya
                      </span>
                    )}
                  <span
                    title={`Borrar la observación de ${observacion.etiqueta}`}
                  >
                    <Boton
                      deshabilitado={guardando}
                      estilos="btn btn-xs btn-ghost btn-error"
                      icono="cerrar"
                      onClick={() =>
                        onBorrar(observacion.tipo, observacion.clave)
                      }
                    />
                  </span>
                </div>
                </div>

                {/* La caja del motivo se abre BAJO su propia fila, y solo al rechazar. El botón de
                    confirmar no se enciende sin texto: el servidor lo exige igual, y pedirlo aquí
                    ahorra el viaje y dice por qué. */}
                {rechazando != null &&
                  rechazando.obseId === observacion.obseId && (
                  <label className="form-control w-full pl-8">
                    <span className="label-text mb-1 text-xs font-semibold uppercase tracking-[0.12em] text-error">
                      Por qué la rechaza (obligatorio)
                    </span>
                    <textarea
                      className="textarea textarea-bordered textarea-sm w-full"
                      rows={2}
                      maxLength={1000}
                      value={rechazando.motivo}
                      disabled={revisando}
                      onChange={(e) =>
                        setRechazando({
                          obseId: rechazando.obseId,
                          motivo: e.target.value,
                        })
                      }
                      placeholder="Lo que el secretario abogado va a leer en esta misma ficha"
                      aria-label={`Motivo del rechazo de ${observacion.etiqueta}`}
                    />
                    <div className="mt-1 flex gap-2">
                      <Boton
                        estilos="btn btn-xs btn-error"
                        texto="Confirmar rechazo"
                        deshabilitado={
                          revisando || rechazando.motivo.trim().length === 0
                        }
                        onClick={() => {
                          onRechazar?.(
                            rechazando.obseId,
                            rechazando.motivo.trim(),
                          );
                          setRechazando(null);
                        }}
                      />
                      <Boton
                        estilos="btn btn-xs btn-ghost"
                        texto="Cancelar"
                        deshabilitado={revisando}
                        onClick={() => setRechazando(null)}
                      />
                    </div>
                  </label>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="app-modules-case-observation-empty">
            No hay observaciones registradas
          </p>
        )}
      </div>

      <div className="app-modules-case-observation-panel-actions">
        <Boton
          deshabilitado={guardando}
          estilos="btn btn-sm btn-primary"
          texto="Guardar observaciones"
          onClick={onGuardar}
        />
        <Boton
          deshabilitado={guardando || observaciones.length === 0}
          estilos="btn btn-sm btn-outline btn-error"
          texto="Borrar observaciones"
          onClick={onBorrarTodas}
        />
      </div>
    </aside>
  );
};

export default ObservacionesSeccion;
