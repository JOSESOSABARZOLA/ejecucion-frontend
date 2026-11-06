/**
 * Microservicio: ejecucion
 * Módulo: Impugnación (rama act. 7 de PRO-GEJ-001)
 * Archivo: ImpugnacionAcciones.tsx
 * Responsabilidad: Acciones de la rama de impugnación del decisor sobre un caso YA ACEPTADO, gateadas
 *   por el estado del EPAS y por lo que dice el servidor en GET /epas/:eejeId/impugnacion:
 *     · ASIGNADO_DECISOR + impugnación → "Gestionar impugnación" (→ EN_IMPUGNACION).
 *     · ASIGNADO_DECISOR sin impugnación → "Iniciar acciones de ejecución" (→ EN_VERIFICACION_PAGO)
 *       y, si el servidor lo permite, "Registrar impugnación".
 *     · EN_VERIFICACION_PAGO / EN_TRABAJO_COMUNITARIO / PENDIENTE_COACTIVA → el estado y, si el
 *       servidor lo permite, "Registrar impugnación" con confirmación en dos pasos EN LÍNEA: antes de
 *       confirmar se lee la consecuencia (todo lo que está en curso queda suspendido y a qué estado
 *       vuelve el expediente si el recurso no se acepta). Si no lo permite, su motivo como texto.
 *     · EN_IMPUGNACION → desde cuándo está suspendido y de qué estado viene; adjuntar la Resolución
 *       de la Procuraduría (PDF) y responder "¿se aceptó el recurso?" (Sí → RECURSO_ACEPTADO con
 *       destino; No → el expediente se REANUDA en el estado que tenía, que dice la opción y que
 *       devuelve el servidor). Al marcar "Sí" hay que elegir a dónde se remite el expediente (act.
 *       7.1.1, decisión del usuario del 2026-10-12): Instrucción (DMIT), Resolución (DMR) o Archivo
 *       (Secretaría General); el expediente sale por esa pestaña de la Bandeja de Salida. Al marcar
 *       "No" hay que calificar el recurso (RECHAZADO | INADMITIDO | DESISTIDO): es dato de
 *       REPORTERÍA y NO cambia el estado, por eso ninguna rama de esta UI depende de su valor y
 *       ninguno viene preseleccionado (proponer uno sesgaría la estadística que mide).
 *     · RECURSO_ACEPTADO / ARCHIVADO → estado terminal de esta rama (solo lectura).
 *   El backend hace cumplir los guards (p. ej. no resolver sin resolución adjunta); aquí el
 *   resultado de cada acto va al aviso flotante y el fallo al CARGAR la vista, en su hueco con
 *   «Reintentar» (regla de mensajes de AGENTS.md). Los documentos adjuntos se ven en el detalle del
 *   expediente (ExpedienteDocumentos).
 * Desarrollador: Andrés Miño
 * Fecha: 2026-07-30
 * Modificado por: Andrés Miño — 2026-10-12 (al aceptar se elige Instrucción, Resolución o Archivo)
 * Modificado por: Andrés Miño — 2026-10-28 (DMI pasa a llamarse DMIT)
 * Modificado por: Andrés Miño — 2026-10-28 (tras cada acto la sección muestra ya el estado nuevo y
 *   limpia lo respondido, sin esperar a que el modal se reabra; confirmar sube el PDF elegido)
 * Modificado por: Andrés Miño — 2026-10-29 (quick 261028-mtg: registrar la impugnación en todo estado
 *   activo que el servidor permita; la sección EN_IMPUGNACION dice desde cuándo, de qué estado viene
 *   y a cuál vuelve; tras resolver se queda en el estado que devolvió el servidor)
 */
import { mensajeParaUsuario } from "../../api/mensajeParaUsuario";
import { useCallback, useEffect, useState } from "react";
import { useToast } from "../../hooks/useToast";
import {
  ImpugnacionService,
  RECURSO_DESENLACES,
  RECURSO_DESTINOS,
  type RecursoDesenlace,
  type RecursoDestino,
  type VistaImpugnacion,
} from "../../services/ImpugnacionService";
import type { MiEpasAsignado } from "../../services/SorteoService";
import {
  CHIP_ESTADO_EPAS,
  etiquetaEstadoEpas,
  type EstadoEpas,
} from "../../config/estadosEpas";
import { DatetimeUtil } from "../../utils/datetime.util";
import Alert from "../common/Alert";
import Boton from "../common/Boton";

const ASIGNADO_DECISOR = "ASIGNADO_DECISOR";
const EN_IMPUGNACION = "EN_IMPUGNACION";
const EN_VERIFICACION_PAGO = "EN_VERIFICACION_PAGO";
const ARCHIVADO = "ARCHIVADO";
const RECURSO_ACEPTADO = "RECURSO_ACEPTADO";

/**
 * Los estados de ejecución en curso desde los que se puede registrar la impugnación, además de
 * ASIGNADO_DECISOR (quick 261028-mtg, P-1). 🔴 Esta lista solo decide QUÉ RAMA se pinta; si el botón
 * sale o no lo dice el servidor en `vista.entrada.permitida`. Si el área cambia los estados de
 * entrada, el servidor deja de permitirlo y aquí queda el motivo, sin tocar la pantalla.
 */
const ESTADOS_EN_CURSO: readonly string[] = [
  EN_VERIFICACION_PAGO,
  "EN_TRABAJO_COMUNITARIO",
  "PENDIENTE_COACTIVA",
];

/** «En trabajo comunitario», entre comillas angulares, o un texto neutro si no hay estado. */
const nombreEstado = (estado: string | null | undefined): string =>
  estado ? `«${etiquetaEstadoEpas(estado)}»` : "el estado previo a la impugnación";

interface Props {
  row: MiEpasAsignado;
  /** Recarga la bandeja tras un cambio de estado (el estado del caso cambia). */
  onChanged: () => Promise<void> | void;
}

export const ImpugnacionAcciones = ({ row, onChanged }: Props) => {
  const { addToast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Sin valor inicial en ninguna de las tres: nada se responde por el usuario.
  const [acepta, setAcepta] = useState<boolean | null>(null);
  const [desenlace, setDesenlace] = useState<RecursoDesenlace | null>(null);
  /**
   * A dónde se remite el expediente al ACEPTAR el recurso (2026-10-12).
   *
   * 🔴 ARRANCA EN `null`, SIN PRESELECCIÓN. Un valor por defecto en el campo que decide a dónde SALE
   * el expediente del módulo es una respuesta que nadie dio — el mismo argumento que
   * `destinoDevolucion` del Compositor de providencias. Archivo sería la opción «de siempre» (antes
   * aceptar archivaba) y justo por eso se colaría sin que nadie la eligiera.
   */
  const [destino, setDestino] = useState<RecursoDestino | null>(null);
  /**
   * El estado al que llevó el último acto hecho aquí. 🔴 `row` es la foto con la que se abrió el modal
   * del expediente: `onChanged` recarga la bandeja de atrás, pero el modal sigue con la fila vieja. Sin
   * esto, tras confirmar la resolución del recurso el formulario seguía a la vista y relleno, y se
   * podía mandar otra vez. Con él, la sección pasa en el acto al estado nuevo. Es el estado que
   * DEVOLVIÓ EL SERVIDOR (quick 261028-mtg), no uno fijo: al no aceptar el recurso, el expediente
   * vuelve a donde estaba, y eso solo lo sabe el servidor.
   */
  const [estadoTrasActo, setEstadoTrasActo] = useState<string | null>(null);
  /** Cambia la `key` del selector de archivo para vaciarlo: es un input no controlado. */
  const [selectorArchivo, setSelectorArchivo] = useState(0);
  /** La vista del servidor (GET /epas/:eejeId/impugnacion): se lee al montar y tras cada acto. */
  const [vista, setVista] = useState<VistaImpugnacion | null>(null);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  /** Primer paso del registro hecho: se está leyendo la consecuencia antes de confirmar. */
  const [confirmandoRegistro, setConfirmandoRegistro] = useState(false);

  const eejeId = row.eejeId;

  const cargarVista = useCallback(async () => {
    if (eejeId == null) return;
    setErrorCarga(null);
    try {
      setVista(await ImpugnacionService.leerEstado(eejeId));
    } catch (err) {
      // Fallo de CARGA: en su hueco, con «Reintentar», y nunca repetido en el aviso flotante.
      setVista(null);
      setErrorCarga(
        mensajeParaUsuario(
          err,
          "No se pudo cargar el estado de la impugnación.",
        ),
      );
    }
  }, [eejeId]);

  useEffect(() => {
    void cargarVista();
  }, [cargarVista]);

  if (eejeId == null) return null;
  const estado = estadoTrasActo ?? vista?.eejeStatus ?? row.eejeStatus;

  const limpiarArchivo = () => {
    setFile(null);
    setSelectorArchivo((n) => n + 1);
  };

  /**
   * Ejecuta un acto. Si `accion` devuelve un estado (el `eejeStatus` de la respuesta del servidor),
   * la sección pasa a él; si no, a `estadoNuevo` cuando lo hay. `ok` puede depender de ese estado.
   */
  const run = async (
    accion: () => Promise<string | void>,
    ok: string | ((estadoResultante: string | undefined) => string),
    estadoNuevo?: string,
  ) => {
    setSubmitting(true);
    try {
      const devuelto = await accion();
      const estadoResultante =
        (typeof devuelto === "string" ? devuelto : undefined) ?? estadoNuevo;
      addToast("success", typeof ok === "function" ? ok(estadoResultante) : ok);
      if (estadoResultante) {
        setEstadoTrasActo(estadoResultante);
        setAcepta(null);
        setDesenlace(null);
        setDestino(null);
        setConfirmandoRegistro(false);
        limpiarArchivo();
      }
      await onChanged();
      void cargarVista();
    } catch (err) {
      addToast(
        "error",
        mensajeParaUsuario(err, "No se pudo completar la acción."),
      );
    } finally {
      setSubmitting(false);
    }
  };

  const registrar = () =>
    void run(
      async () =>
        (await ImpugnacionService.registrarImpugnacion(eejeId)).eejeStatus,
      "Impugnación registrada: el expediente queda suspendido. Adjunte la resolución de la Procuraduría.",
      EN_IMPUGNACION,
    );

  /**
   * El registro de la impugnación en un estado en curso. Si el servidor no lo permite, su motivo
   * como texto de estado; si lo permite, el botón y, al pulsarlo, la consecuencia con «Confirmar
   * registro» / «Cancelar» (dos pasos: suspender todo lo que está en curso no se hace de un clic).
   */
  const bloqueRegistro = () => {
    if (errorCarga) {
      return (
        <Alert
          variant="error"
          message={errorCarga}
          buttonFunction={() => void cargarVista()}
        />
      );
    }
    if (!vista) return null;
    if (!vista.entrada.permitida) {
      return vista.entrada.motivo ? (
        <p className="text-sm text-base-content/70">{vista.entrada.motivo}</p>
      ) : null;
    }
    if (!confirmandoRegistro) {
      return (
        <Boton
          estilos="btn btn-sm btn-outline btn-warning"
          texto="Registrar impugnación"
          deshabilitado={submitting}
          onClick={() => setConfirmandoRegistro(true)}
        />
      );
    }
    return (
      <div className="flex w-full flex-col gap-2 rounded-box border border-warning p-3 text-sm">
        <p>
          Al registrar la impugnación, todo lo que está en curso queda
          suspendido hasta que la Procuraduría resuelva; si el recurso no se
          acepta, vuelve a {nombreEstado(vista.entrada.estadoAlReanudar)}.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Boton
            estilos="btn btn-sm btn-warning"
            texto="Confirmar registro"
            deshabilitado={submitting}
            onClick={registrar}
          />
          <Boton
            estilos="btn btn-sm btn-ghost"
            texto="Cancelar"
            deshabilitado={submitting}
            onClick={() => setConfirmandoRegistro(false)}
          />
        </div>
      </div>
    );
  };

  // FASE tras aceptar: decidir la rama según el dato de impugnación del EPAS.
  if (estado === ASIGNADO_DECISOR) {
    return (
      <div className="flex flex-wrap items-center gap-2 border-t border-base-300 p-3">
        {row.tieneImpugnacion ? (
          <>
            <span className="badge badge-warning whitespace-nowrap">
              Con impugnación
            </span>
            <Boton
              estilos="btn btn-sm btn-primary"
              texto="Gestionar impugnación"
              deshabilitado={submitting}
              onClick={registrar}
            />
          </>
        ) : (
          <>
            <Boton
              estilos="btn btn-sm btn-primary"
              texto="Iniciar acciones de ejecución"
              deshabilitado={submitting}
              onClick={() =>
                void run(
                  () => ImpugnacionService.iniciarEjecucion(eejeId),
                  "Se iniciaron las acciones de ejecución.",
                  EN_VERIFICACION_PAGO,
                )
              }
            />
            {bloqueRegistro()}
          </>
        )}
      </div>
    );
  }

  // Ejecución en curso: se puede registrar una impugnación que llega tarde (D-1).
  if (estado && ESTADOS_EN_CURSO.includes(estado)) {
    return (
      <div className="flex flex-wrap items-center gap-2 border-t border-base-300 p-3">
        <span
          className={`badge ${CHIP_ESTADO_EPAS[estado as EstadoEpas]} whitespace-nowrap`}
        >
          {etiquetaEstadoEpas(estado)}
        </span>
        {bloqueRegistro()}
      </div>
    );
  }

  // EN_IMPUGNACION: adjuntar la resolución de la Procuraduría y resolver el recurso.
  if (estado === EN_IMPUGNACION) {
    const suspension = vista?.suspension ?? null;
    return (
      <div className="flex flex-col gap-3 border-t border-base-300 p-3 text-sm">
        <span className="font-semibold text-warning">
          En impugnación — pendiente de la resolución de la Procuraduría
        </span>
        {errorCarga && (
          <Alert
            variant="error"
            message={errorCarga}
            buttonFunction={() => void cargarVista()}
          />
        )}
        {suspension && (
          <p>
            Suspendido desde {DatetimeUtil.formatDate(suspension.desde)} —
            estaba en {nombreEstado(suspension.estadoPrevio)}. Todo lo que
            estaba en curso queda en pausa hasta que se resuelva el recurso.
          </p>
        )}
        {vista && !vista.resolucionAdjunta && (
          <Alert
            variant="warning"
            rol="note"
            message="Falta la resolución de la Procuraduría de esta impugnación: adjúntela para poder resolver el recurso."
          />
        )}
        <div className="flex flex-wrap items-center gap-2">
          <input
            key={selectorArchivo}
            type="file"
            accept="application/pdf"
            className="file-input file-input-sm file-input-bordered"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          <Boton
            estilos="btn btn-sm btn-outline btn-primary"
            texto="Adjuntar resolución"
            deshabilitado={!file || submitting}
            onClick={() =>
              file &&
              void run(async () => {
                await ImpugnacionService.subirResolucion(eejeId, file);
                limpiarArchivo();
              }, "Resolución de la Procuraduría adjuntada.")
            }
          />
        </div>
        <fieldset className="flex flex-col gap-2">
          <legend className="font-medium">
            ¿Se aceptó el recurso de apelación?
          </legend>
          <div className="flex flex-wrap items-center gap-4">
            <label className="label cursor-pointer justify-start gap-2 p-0">
              <input
                type="radio"
                name={`acepta-recurso-${eejeId}`}
                className="radio radio-sm radio-primary"
                checked={acepta === true}
                disabled={submitting}
                onChange={() => {
                  setAcepta(true);
                  // Al aceptar, la calificación deja de tener sentido: se limpia para que no viaje
                  // (el backend la rechaza con 400) ni reaparezca si se vuelve a marcar "No".
                  setDesenlace(null);
                }}
              />
              <span>Sí — el recurso se acepta</span>
            </label>
            <label className="label cursor-pointer justify-start gap-2 p-0">
              <input
                type="radio"
                name={`acepta-recurso-${eejeId}`}
                className="radio radio-sm radio-primary"
                checked={acepta === false}
                disabled={submitting}
                onChange={() => {
                  setAcepta(false);
                  // Espejo del «Sí»: un recurso no aceptado no sale del módulo, así que el destino
                  // se limpia (el backend lo rechaza con 400).
                  setDestino(null);
                }}
              />
              {/* A dónde vuelve lo dice el servidor (la suspensión persistida), nunca un estado fijo. */}
              <span>
                No — se reanuda: vuelve a{" "}
                {nombreEstado(suspension?.estadoAlReanudar)}
              </span>
            </label>
          </div>
        </fieldset>

        {/* Destino del recurso ACEPTADO (act. 7.1.1): solo se pregunta al marcar «Sí» y sin valor
            por defecto. Es el valor de la pestaña de la Bandeja de Salida por la que sale. */}
        {acepta === true && (
          <fieldset className="flex flex-col gap-2">
            <legend className="font-medium">
              ¿A dónde se remite el expediente?
            </legend>
            <div className="flex flex-wrap items-center gap-4">
              {RECURSO_DESTINOS.map(({ valor, etiqueta }) => (
                <label
                  key={valor}
                  className="label cursor-pointer justify-start gap-2 p-0"
                >
                  <input
                    type="radio"
                    name={`destino-recurso-${eejeId}`}
                    className="radio radio-sm radio-primary"
                    checked={destino === valor}
                    disabled={submitting}
                    onChange={() => setDestino(valor)}
                  />
                  <span>{etiqueta}</span>
                </label>
              ))}
            </div>
          </fieldset>
        )}

        {/* Calificación del recurso NO aceptado: solo se pregunta cuando aplica y sin valor por
            defecto. Los tres desenlaces terminan igual (se reanuda el estado previo); es reportería. */}
        {acepta === false && (
          <fieldset className="flex flex-col gap-2">
            <legend className="font-medium">
              Decisión del recurso
            </legend>
            <div className="flex flex-wrap items-center gap-4">
              {RECURSO_DESENLACES.map(({ valor, etiqueta }) => (
                <label
                  key={valor}
                  className="label cursor-pointer justify-start gap-2 p-0"
                >
                  <input
                    type="radio"
                    name={`desenlace-recurso-${eejeId}`}
                    className="radio radio-sm radio-primary"
                    checked={desenlace === valor}
                    disabled={submitting}
                    onChange={() => setDesenlace(valor)}
                  />
                  <span>{etiqueta}</span>
                </label>
              ))}
            </div>
          </fieldset>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Boton
            estilos="btn btn-sm btn-primary"
            texto="Confirmar resolución del recurso"
            deshabilitado={
              submitting ||
              acepta === null ||
              (acepta === false && desenlace === null) ||
              (acepta === true && destino === null)
            }
            onClick={() =>
              void run(
                async () => {
                  // Un PDF elegido y sin «Adjuntar» se sube primero: elegirlo y confirmar es la
                  // lectura natural, y sin esto el backend respondía «Debe adjuntar la resolución».
                  if (file) {
                    await ImpugnacionService.subirResolucion(eejeId, file);
                    limpiarArchivo();
                  }
                  const resultado = await ImpugnacionService.resolverRecurso(
                    eejeId,
                    acepta === true,
                    acepta === false ? (desenlace ?? undefined) : undefined,
                    acepta === true ? (destino ?? undefined) : undefined,
                  );
                  return resultado.eejeStatus;
                },
                (estadoResultante) =>
                  acepta
                    ? `Recurso aceptado: el expediente queda «Recurso aceptado» y sale por la Bandeja de Salida hacia ${
                        RECURSO_DESTINOS.find((d) => d.valor === destino)
                          ?.etiqueta ?? "su destino"
                      }.`
                    : `Recurso no aceptado: el expediente vuelve a ${nombreEstado(estadoResultante)}.`,
                // Solo si la respuesta no trajera estado: el que el grafo da por defecto.
                acepta ? RECURSO_ACEPTADO : EN_VERIFICACION_PAGO,
              )
            }
          />
        </div>
      </div>
    );
  }

  // 2026-10-12: el recurso aceptado espera su lote en la Bandeja de Salida; aquí ya no hay acto.
  if (estado === RECURSO_ACEPTADO) {
    return (
      <div className="border-t border-base-300 p-3">
        <span className="badge badge-error whitespace-nowrap">
          Recurso aceptado — sale por la Bandeja de Salida
        </span>
      </div>
    );
  }
  if (estado === ARCHIVADO) {
    return (
      <div className="border-t border-base-300 p-3">
        <span className="badge badge-success whitespace-nowrap">
          Archivado — remitido a Secretaría General
        </span>
      </div>
    );
  }
  return null;
};
