/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/obligacion-hacer (frontend)
 * Feature: La rama del correctivo en pantalla — tramo del CUMPLIMIENTO (Fase 03.18, Plan 05)
 * Archivo: ModalRegistrarAlegacion.tsx
 * Responsabilidad: `HACER-02` (act. 10 del `PRO-GEJ-001`) — ingresar el ESCRITO con que el
 *   administrado alega sobre el informe de verificación, dentro del término del art. 10.
 *   `POST /obligacion-hacer/:eejeId/alegacion`.
 *
 *   ── EL PAPEL ES DEL ADMINISTRADO; QUIEN LO INGRESA ES EL FUNCIONARIO ──────────────────────────
 *   🔴 El endpoint es del `funcionario decisor` y eso NO es un error: el administrado no tiene
 *   sesión en este módulo. El escrito entra por ventanilla y lo registra quien lo recibe. El texto
 *   del modal lo dice, porque de otro modo parece que la pantalla confundió a las dos partes.
 *
 *   ── EL ESCRITO ES EL HECHO: EL PDF ES OBLIGATORIO ────────────────────────────────────────────
 *   Una alegación sin papel es la afirmación de que alguien alegó, y de esa afirmación cuelga que
 *   el término conste USADO (T-03.17-41). El backend lo impone en el controlador; aquí se valida
 *   antes de subir para no hacer esperar en balde.
 *
 *   ── 🔴 AQUÍ NO SE RESTA NI UNA FECHA ─────────────────────────────────────────────────────────
 *   El término se PINTA tal y como el servidor lo derivó (`TerminoAlegacion`, Plan 02): sus días
 *   son HÁBILES y se cuentan contra el calendario de feriados del servidor. `diasHabilesRestantes`
 *   se muestra tal cual, y `calendarioCargadoHasta` se enseña para que contar sin feriados no sea
 *   silencioso. La FECHA DE INGRESO tampoco viaja: la pone el servidor, y de ella depende si se
 *   alegó a tiempo — mandarla desde aquí sería dejarlo decidir a quien sube el escrito.
 *
 *   🔴 Este modal NO lee ni compara el estado del EPAS (criterio 7). El estado del TÉRMINO no es el
 *   estado del EPAS: es un dato derivado que se pinta, y que el motor ya usó para ofrecer el botón.
 *
 *   ── SIN PANTALLA DE CONFIRMACIÓN (quick 261014-dmc) ──────────────────────────────────────────
 *   «Ingresar el escrito» ejecuta el acto directamente desde el formulario. Antes había un paso intermedio
 *   («Continuar» → revisar → confirmar) que el usuario pidió quitar el 2026-10-14 por exceso de
 *   confirmaciones: la validación ya ocurre en el formulario, la consecuencia jurídica la dice su
 *   alerta, el error sale en el aviso flotante y el acto queda en la bitácora. `enviando` impide el doble
 *   envío y bloquea Cancelar y la × mientras corre.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-09-15
 * Modificado por: Andrés Miño — 2026-10-28 (quick 261028-kmg: el fallo del servidor al registrar se
 *   dice en el aviso flotante, ya no en una caja del modal)
 * Modificado por: Andrés Miño — 2026-10-29 (quick 261028-mtg: el término SUSPENDIDO por la
 *   impugnación se lee como tal, con desde cuándo y los días hábiles que le quedaban)
 */
import { useEffect, useState } from "react";
import { useCierreModal } from "../../hooks/useCierreModal";
import Alert from "../common/Alert";
import { useToast } from "../../hooks/useToast";
import { ObligacionHacerService } from "../../services/ObligacionHacerService";
import type {
  EstadoTermino,
  TerminoAlegacion,
} from "../../interfaces/IObligacionHacer";
import { DatetimeUtil } from "../../utils/datetime.util";
import {
  TIPO_PDF,
  describirAdministrado,
  describirExpediente,
  mensajeDeError,
  validarPdf,
  type PropsModalRama,
} from "./comunes";

/** Mismo valor que el nombre de acción declarado en `POLITICA_ACCIONES` (Plan 04). */
export const MODAL_KEY = "registrarAlegacion" as const;

/** Tope del `@MaxLength(300)` de `RegistrarAlegacionDto.observaciones`. */
const MAX_OBSERVACIONES = 300;

/** Los cinco estados del término, en lenguaje del procedimiento. */
const TERMINO_EN_PALABRAS: Record<EstadoTermino, string> = {
  SIN_TRASLADO: "Sin traslado — no consta providencia de traslado del informe",
  SIN_NOTIFICAR: "Emitido, sin notificar — el término todavía no arrancó",
  EN_CURSO: "En curso",
  VENCIDO: "Vencido",
  // quick 261028-mtg: detenido por la impugnación; ni corre ni vence.
  SUSPENDIDO: "Suspendido por la impugnación — no corre hasta que se resuelva el recurso",
};

/** El término, pintado tal cual. Ni una resta: los valores son los que el servidor derivó. */
const FichaDelTermino = ({ termino }: { termino: TerminoAlegacion }) => (
  <div className="rounded-lg border border-base-300 p-3">
    <p className="text-xs font-medium uppercase opacity-70">
      Término de alegación (art. 10)
    </p>

    <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
      <span className="opacity-70">Estado</span>
      <span>{TERMINO_EN_PALABRAS[termino.estado]}</span>

      {termino.motivo && (
        <>
          <span className="opacity-70">Por qué</span>
          <span>{termino.motivo}</span>
        </>
      )}

      {termino.arrancaAt && (
        <>
          <span className="opacity-70">Arrancó</span>
          <span>{DatetimeUtil.formatDate(termino.arrancaAt)}</span>
        </>
      )}

      {termino.plazoDias != null && (
        <>
          <span className="opacity-70">Plazo</span>
          <span>{termino.plazoDias} días hábiles</span>
        </>
      )}

      {termino.venceAt && (
        <>
          <span className="opacity-70">Vence</span>
          <span>{DatetimeUtil.formatDate(termino.venceAt)}</span>
        </>
      )}

      {termino.estado === "SUSPENDIDO" && termino.suspendidoDesde && (
        <>
          <span className="opacity-70">Suspendido desde</span>
          <span>{DatetimeUtil.formatDate(termino.suspendidoDesde)}</span>
        </>
      )}

      {termino.diasHabilesRestantes != null && (
        <>
          {/* Suspendido, los días no se consumen: son los que le QUEDABAN al suspenderse. */}
          <span className="opacity-70">
            {termino.estado === "SUSPENDIDO" ? "Le quedaban" : "Quedan"}
          </span>
          <span>{termino.diasHabilesRestantes} días hábiles</span>
        </>
      )}
    </div>

    {/* El término que arrancó por AGOTAMIENTO de los intentos de notificación corre igual, pero se
        DECLARA: dar por arrancado un plazo de defensa contra quien no se pudo notificar y no
        decirlo es otra cosa. */}
    {termino.arrancoPorAgotamiento && (
      <p className="mt-2 text-sm text-warning">
        El término arrancó porque se agotaron los intentos de notificación, no
        porque el administrado la recibiera.
      </p>
    )}

    {termino.calendarioCargadoHasta == null && (
      <p className="mt-2 text-sm text-warning">
        No hay calendario de feriados cargado: los días hábiles del servidor se
        contaron sin él.
      </p>
    )}
    {termino.calendarioCargadoHasta != null && (
      <p className="mt-2 text-xs opacity-70">
        Calendario de feriados cargado hasta {termino.calendarioCargadoHasta}.
      </p>
    )}

    {termino.terminoUsado && termino.alegacionIngresadaAt && (
      <p className="mt-2 text-sm">
        Ya consta un escrito de alegación ingresado el{" "}
        {DatetimeUtil.formatDate(termino.alegacionIngresadaAt)}.
      </p>
    )}
  </div>
);

const ModalRegistrarAlegacion = ({
  caseData,
  onClose,
  refetchFn,
}: PropsModalRama) => {
  const { addToast } = useToast();
  const { eejeId } = caseData;

  // El término que la FILA ya trae resuelto (las bandejas lo mandan desde la Fase 03.16). Cuando la
  // fila no lo trae se pide el detalle: es la única lectura que hace este modal, y sigue sin
  // calcular nada — pinta lo que el servidor derivó.
  const terminoDeLaFila = caseData.obligacionHacer?.terminoAlegacion ?? null;
  const [terminoPedido, setTerminoPedido] = useState<TerminoAlegacion | null>(
    null,
  );

  const [escrito, setEscrito] = useState<File | null>(null);
  const [observaciones, setObservaciones] = useState("");
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (terminoDeLaFila || eejeId == null) return;
    let vivo = true;
    ObligacionHacerService.detalle(eejeId)
      .then((detalle) => {
        if (vivo) setTerminoPedido(detalle.terminoAlegacion);
      })
      // Si el detalle no se puede leer, el modal sigue siendo utilizable: el término es CONTEXTO,
      // no una puerta. Ingresar el escrito del administrado no depende de que la ficha se pinte.
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [terminoDeLaFila, eejeId]);

  // Cierre al pulsar fuera (quick 261019-mcf): el escrito o las observaciones son trabajo sin
  // guardar.
  useCierreModal({
    hayCambios: escrito !== null || observaciones.trim() !== "",
    ocupado: enviando,
  });

  if (eejeId == null) {
    return (
      <div className="modal-box max-w-lg">
        <Alert
          variant="error"
          message="No se pudo identificar el expediente. Cierre y vuelva a abrir la acción desde la ficha."
        />
        <div className="modal-action">
          <button
            type="button"
            className="btn"
            onClick={onClose}
          >
            Cerrar
          </button>
        </div>
      </div>
    );
  }

  const termino = terminoDeLaFila ?? terminoPedido;
  const expediente = describirExpediente(caseData);
  const administrado = describirAdministrado(caseData);

  const avisoArchivo = escrito
    ? validarPdf(escrito, "El escrito de alegación")
    : null;
  const puedeContinuar = !!escrito && !avisoArchivo;

  const registrar = async () => {
    if (enviando) return;
    if (!escrito) return;
    setEnviando(true);
    try {
      const texto = observaciones.trim();
      await ObligacionHacerService.registrarAlegacion(
        eejeId,
        texto ? { observaciones: texto } : {},
        escrito,
      );
      addToast(
        "success",
        `Escrito de alegación ingresado en el expediente ${expediente}. La fecha de ingreso la pone el sistema.`,
      );
      if (refetchFn) await refetchFn();
      onClose();
    } catch (error) {
      addToast(
        "error",
        mensajeDeError(
          error,
          "No se pudo ingresar el escrito de alegación.",
        ),
      );
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="modal-box max-w-2xl">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="app-modules-modal-kicker">
            Ejecución — DME · Obligación de hacer
          </p>
          <h3 className="text-lg font-semibold">
            Ingresar el escrito de alegación
          </h3>
          <p className="text-sm opacity-70">
            {expediente} · {administrado}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          disabled={enviando}
          className="app-modules-modal-close shrink-0"
          aria-label="Cerrar modal"
        >
          ×
        </button>
      </div>

      <div className="mt-4 flex flex-col gap-4">
        {termino && <FichaDelTermino termino={termino} />}

        <Alert
          variant="info"
          message={
            "El escrito es DEL ADMINISTRADO, pero lo ingresa usted: el administrado no tiene " +
            "sesión en este módulo. Lo que se registra es que el escrito entró — resolverlo es " +
            "otro acto, y va por providencia. Al ingresarlo el término consta USADO, y la FECHA DE " +
            "INGRESO la pone el servidor: no se teclea, porque de ella depende si el administrado " +
            "alegó a tiempo."
          }
        />

        <label className="flex flex-col gap-1">
          <span className="font-medium">
            Escrito de alegación (PDF, obligatorio)
          </span>
          <input
            type="file"
            accept={TIPO_PDF}
            className="file-input file-input-bordered w-full"
            disabled={enviando}
            onChange={(e) => setEscrito(e.target.files?.[0] ?? null)}
          />
          {avisoArchivo ? (
            <span className="text-sm text-error">{avisoArchivo}</span>
          ) : (
            <span className="text-sm opacity-70">
              Solo PDF, hasta 10 MB. Sin el papel no hay alegación que fechar:
              el escrito ES el hecho.
            </span>
          )}
        </label>

        <label className="flex flex-col gap-1">
          <span className="font-medium">Observaciones (opcional)</span>
          <textarea
            className="textarea textarea-bordered w-full"
            rows={2}
            maxLength={MAX_OBSERVACIONES}
            value={observaciones}
            placeholder="Por dónde llegó, número de trámite de ventanilla, si vino con anexos"
            disabled={enviando}
            onChange={(e) => setObservaciones(e.target.value)}
          />
          <span className="text-sm opacity-70">
            Va a la bitácora del acto. Máximo {MAX_OBSERVACIONES} caracteres;
            quedan {MAX_OBSERVACIONES - observaciones.length}.
          </span>
        </label>
      </div>

      <div className="modal-action">
        <button
          type="button"
          className="app-modules-modal-cancel btn"
          disabled={enviando}
          onClick={onClose}
        >
          Cancelar
        </button>
        <button
          type="button"
          className="app-modules-modal-submit btn"
          disabled={!puedeContinuar || enviando}
          onClick={registrar}
        >
          {enviando ? "Subiendo… (puede tardar)" : "Ingresar el escrito"}
        </button>
      </div>
    </div>
  );
};

export default ModalRegistrarAlegacion;
