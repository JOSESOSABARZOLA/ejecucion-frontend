/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/obligacion-hacer (frontend)
 * Feature: La rama del correctivo en pantalla — tramo de la ESCALADA (Fase 03.18, Plan 06)
 * Archivo: ModalGastosSustitutoria.tsx
 * Responsabilidad: `HACER-05`, segundo paso — liquidar los costos de la ejecución sustitutoria y
 *   TRASLADÁRSELOS AL OBLIGADO (art. 239 del COA).
 *   `POST /obligacion-hacer/:eejeId/gastos-sustitutoria`.
 *
 *   ── 🔴 ESTA PANTALLA NO MULTIPLICA NADA (T-0318-24) ──────────────────────────────────────────
 *   Se envía la BASE —lo que costó la diligencia, sin recargo— y el SERVIDOR devuelve `base`,
 *   `recargoPct`, `recargoValor` y `total`. El recargo del art. 239 es una cifra de LEY: calcularlo
 *   también aquí daría DOS importes para UNA deuda que se cobra por vía coactiva a una persona
 *   concreta, y el día que los dos no coincidieran —por un redondeo, por una norma que cambió en el
 *   servidor y no en el navegador— nadie sabría cuál de los dos es el que se le notificó.
 *
 *   El porcentaje que el artículo fija es del 20 %, y citarlo en este comentario no es calcularlo:
 *   `base × 0.2` no aparece en ninguna línea de código de este archivo, y hay un caso de prueba que
 *   lee el fuente para que siga siendo así.
 *
 *   ⚠️ El `total` que vuelve **NO ES EL TOTAL ADEUDADO**: no incluye el interés legal ni la
 *   indemnización por daños del art. 239, que la DME liquida a mano fuera del módulo (Q-04). La
 *   pantalla lo dice, porque un «total» que no es el total, sin decirlo, es una cifra que alguien
 *   acabará copiando en un oficio.
 *
 *   ── 🔴 LA REAPERTURA TIENE TRES CASOS, NO DOS (T-0318-28) ────────────────────────────────────
 *   Éste es el punto en que un expediente **CUMPLIDO vuelve a deber**: la multa se pagó, pero la
 *   Administración ejecutó el correctivo a su costa y hay una deuda nueva.
 *
 *   · `epasReabierto: true` → el expediente volvió a `EN_VERIFICACION_PAGO`. Se dice.
 *   · `epasReabierto: false` **CON** el aviso `SUSTITUTORIA_GASTOS_SIN_REAPERTURA` → la deuda
 *     quedó registrada pero la reapertura **FALLÓ**: otra sesión movió el estado mientras se
 *     registraba. Alguien tiene que mirar el expediente, y 🔴 **la deuda NO hay que volver a
 *     crearla** — hacerlo sería un doble cobro.
 *   · `epasReabierto: false` **SIN** ese aviso → no había nada que reabrir: el expediente ya debía.
 *     La pantalla **calla**, porque inventar un aviso aquí enseñaría a ignorarlos.
 *
 *   Colapsar los dos últimos en un «no pasó nada» escondería justo el que se puede corregir.
 *
 *   🔴 Este modal NO lee ni compara el estado del EPAS (criterio 7): lo que cuenta de la reapertura
 *   es lo que el servidor le dijo que pasó, no una comparación propia.
 *
 *   ── SIN PANTALLA DE CONFIRMACIÓN (quick 261014-dmc) ──────────────────────────────────────────
 *   «Registrar los gastos» ejecuta el acto directamente desde el formulario. Antes había un paso intermedio
 *   («Continuar» → revisar → confirmar) que el usuario pidió quitar el 2026-10-14 por exceso de
 *   confirmaciones: la validación ya ocurre en el formulario, la consecuencia jurídica la dice su
 *   alerta, el error sale en el aviso flotante y el acto queda en la bitácora. `enviando` impide el doble
 *   envío y bloquea Cancelar y la × mientras corre.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-09-15
 * Modificado por: Andrés Miño — 2026-10-14 (quick 261014-lhu: el resultado se cierra con «Volver a la
 *   ficha» o la ×)
 * Modificado por: Andrés Miño — 2026-10-28 (quick 261028-kmg: el fallo del servidor al registrar se
 *   dice en el aviso flotante, ya no en una caja del modal)
 * Modificado por: Andrés Miño — 2026-11-05 (quick 261105-cvq — el desglose se pinta con
 *   `formatearUsd` y la casilla de la base es de texto con teclado decimal, leída con
 *   `parsearImporte`: «4.820,55» viaja como 4820.55 y «4820.55» se rechaza bajo la casilla)
 */
import { useId, useState } from "react";
import { useCierreModal } from "../../hooks/useCierreModal";
import Alert from "../common/Alert";
import { useToast } from "../../hooks/useToast";
import { ObligacionHacerService } from "../../services/ObligacionHacerService";
import AvisosDeActo from "./AvisosDeActo";
import SelectorDocumentoExpediente from "./SelectorDocumentoExpediente";
import { formatearUsd, parsearImporte } from "../../utils/importe.util";
import {
  describirAdministrado,
  describirExpediente,
  mensajeDeError,
  type PropsModalRama,
} from "./comunes";
import type {
  Advertencia,
  ResultadoGastosSustitutoria,
} from "../../interfaces/IObligacionHacer";

/** Mismo valor que el nombre de acción declarado en `POLITICA_ACCIONES` (Plan 04). */
export const MODAL_KEY = "registrarGastosSustitutoria" as const;

/** `@MinLength(3)` / `@MaxLength(60)` de `RegistrarGastosSustitutoriaDto.numeroOrden`. */
const ORDEN_MINIMO = 3;
const ORDEN_MAXIMO = 60;
/** `@Matches(/^[A-Za-z0-9/-]+$/)` del mismo campo: lo produce el SAO, se acota el alfabeto. */
const ORDEN_ALFABETO = /^[A-Za-z0-9/-]+$/;

/**
 * El código de la advertencia con que el servidor cuenta que la reapertura NO se completó.
 *
 * 🔴 Se compara por CÓDIGO y no por texto: el código es lo estable —lo dice el catálogo cerrado del
 * backend—, y la frase se reescribe cuando hace falta porque es para leer. Reconocer el caso por su
 * mensaje haría que una coma cambiada apagara el aviso más importante de esta pantalla.
 */
const CODIGO_SIN_REAPERTURA = "SUSTITUTORIA_GASTOS_SIN_REAPERTURA";


/** Los tres casos de la reapertura, resueltos en un solo sitio y con nombre. */
type CasoReapertura = "REABIERTO" | "FALLO_LA_REAPERTURA" | "NADA_QUE_REABRIR";

const casoDeReapertura = (
  epasReabierto: boolean,
  advertencias?: Advertencia[],
): CasoReapertura => {
  if (epasReabierto) return "REABIERTO";
  // Sin reapertura, lo que distingue «falló» de «no hacía falta» es la PRESENCIA del aviso. Son dos
  // hechos distintos y sólo juntos —el booleano y el aviso— significan algo.
  const fallo = advertencias?.some((a) => a.codigo === CODIGO_SIN_REAPERTURA);
  return fallo ? "FALLO_LA_REAPERTURA" : "NADA_QUE_REABRIR";
};

const ModalGastosSustitutoria = ({
  caseData,
  onClose,
  refetchFn,
}: PropsModalRama) => {
  const { addToast } = useToast();
  const { eejeId } = caseData;

  const [base, setBase] = useState("");
  const [numeroOrden, setNumeroOrden] = useState("");
  const [docId, setDocId] = useState<number | null>(null);
  const [respaldoDocId, setRespaldoDocId] = useState<number | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<
    (ResultadoGastosSustitutoria & { advertencias?: Advertencia[] }) | null
  >(null);

  // Cierre al pulsar fuera (quick 261019-mcf): lo capturado es trabajo sin guardar hasta que hay
  // resultado.
  useCierreModal({
    hayCambios:
      !resultado &&
      (base.trim() !== "" ||
        numeroOrden.trim() !== "" ||
        docId !== null ||
        respaldoDocId !== null),
    ocupado: enviando,
  });
  // Antes de cualquier `return`: los hooks no pueden depender de una rama.
  const idAvisoBase = useId();

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

  const expediente = describirExpediente(caseData);
  const administrado = describirAdministrado(caseData);

  // Formato ecuatoriano (quick 261105-cvq): «4.820,55» ⇒ 4820.55; «4820.55» no se reinterpreta.
  const baseNumero = parsearImporte(base);
  const baseValida = baseNumero !== undefined && baseNumero > 0;
  const avisoBase =
    base.trim() === ""
      ? null
      : baseNumero === undefined
        ? "Escriba la base en dólares con coma para los centavos, por ejemplo 4.820,55 (el punto separa los miles)."
        : baseNumero <= 0
          ? "La base tiene que ser un importe mayor que cero: una orden de pago por cero no es una deuda."
          : null;

  const ordenLimpia = numeroOrden.trim();
  const ordenValida =
    ordenLimpia.length >= ORDEN_MINIMO && ORDEN_ALFABETO.test(ordenLimpia);
  const avisoOrden =
    numeroOrden !== "" && !ordenValida
      ? `El número de la orden lo emite el SAO: mínimo ${ORDEN_MINIMO} caracteres, y sólo letras, dígitos, guion y barra.`
      : null;

  // ── 🔴 LOS DOS DOCUMENTOS DEL ART. 239 SON DOS, Y AQUÍ ES DONDE SE COMPRUEBA (CR-02) ─────────
  // El artículo exige poder enseñar DOS papeles distintos: la providencia dice QUÉ SE DISPONE y el
  // respaldo dice QUÉ COSTÓ. Los dos selectores leen la MISMA lista de documentos del expediente,
  // así que nada impedía elegir el mismo en los dos.
  //
  // Y el servidor no lo rechaza: `obligacion-hacer.repository.ts` llama a
  // `assertDocumentoDelExpediente` por separado para `docId` y para `respaldoDocId` y comprueba
  // PERTENENCIA al expediente, nunca que sean distintos — un mismo PDF pasa las dos comprobaciones.
  // Lo que quedaría persistido es una orden de pago `GASTOS_SUSTITUTORIA`, cobrable por vía
  // coactiva a una persona concreta, en la que «qué se dispone» y «qué costó» son el mismo papel.
  //
  // Mientras el backend no lo compruebe, esta pantalla es el ÚNICO sitio donde se puede impedir.
  const documentosDistintos = docId !== respaldoDocId;
  const avisoDocumentos =
    docId != null && respaldoDocId != null && !documentosDistintos
      ? "La providencia que dispone el traslado y el respaldo del costo tienen que ser DOS documentos distintos: uno dice QUÉ SE DISPONE y el otro QUÉ COSTÓ. Si eligió el mismo, revise cuál le falta."
      : null;

  const puedeContinuar =
    baseValida &&
    ordenValida &&
    docId != null &&
    respaldoDocId != null &&
    documentosDistintos;

  const registrar = async () => {
    if (enviando) return;
    // La misma guarda, en el punto de envío: el botón puede estar apagado y aun así llegarse aquí
    // si un día se añade otra vía de disparo. Un acto de cobro no se manda mal formado.
    if (
      docId == null ||
      respaldoDocId == null ||
      docId === respaldoDocId ||
      baseNumero === undefined ||
      baseNumero <= 0
    ) {
      return;
    }
    setEnviando(true);
    try {
      // 🔴 LO ÚNICO QUE VIAJA DEL DINERO ES LA BASE. Ni recargo, ni total: los calcula el servidor.
      const respuesta =
        await ObligacionHacerService.registrarGastosSustitutoria(eejeId, {
          valor: baseNumero,
          numeroOrden: ordenLimpia,
          docId,
          respaldoDocId,
        });

      addToast(
        "success",
        `Costos de la ejecución sustitutoria registrados en el expediente ${expediente} (orden de pago ${ordenLimpia}).`,
      );
      if (refetchFn) await refetchFn();

      // Siempre se pasa a la pantalla de resultado: el desglose y la reapertura son lo que el
      // decisor tiene que ver, y cerrar en silencio se los quitaría.
      setResultado(respuesta);
    } catch (error) {
      addToast(
        "error",
        mensajeDeError(
          error,
          "No se pudieron registrar los costos de la ejecución sustitutoria.",
        ),
      );
    } finally {
      setEnviando(false);
    }
  };

  if (resultado) {
    const caso = casoDeReapertura(
      resultado.epasReabierto,
      resultado.advertencias,
    );

    return (
      <div className="modal-box max-w-2xl">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="app-modules-modal-kicker">
              Ejecución — DME · Costos de la sustitutoria
            </p>
            <h3 className="text-lg font-semibold">
              Paso 2 de 2 · El costo quedó trasladado
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="app-modules-modal-close shrink-0"
            aria-label="Cerrar modal"
          >
            ×
          </button>
        </div>

        {/* El desglose, TAL Y COMO LLEGÓ. Ni una operación aritmética en este bloque. */}
        <div className="mt-3 rounded-lg border border-base-300 p-3">
          <p className="text-xs font-medium uppercase opacity-70">
            Desglose calculado por el servidor (art. 239 del COA)
          </p>
          <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
            <span className="opacity-70">Gastos de la diligencia (base)</span>
            <span>{formatearUsd(resultado.base)}</span>

            <span className="opacity-70">Recargo aplicado</span>
            <span>{resultado.recargoPct} %</span>

            <span className="opacity-70">Valor del recargo</span>
            <span>{formatearUsd(resultado.recargoValor)}</span>

            <span className="font-medium">Total de la orden</span>
            <span className="font-medium">{formatearUsd(resultado.total)}</span>

            <span className="opacity-70">Orden de pago</span>
            <span>
              {ordenLimpia} · #{resultado.ordpId}
            </span>
          </div>
          <p className="mt-2 text-xs opacity-70">
            Ese total es gastos más recargo y{" "}
            <strong>no es el total adeudado</strong>: no incluye el interés
            legal ni la indemnización por daños del art. 239, que la DME liquida
            aparte.
          </p>
        </div>

        {/* 🔴 LOS TRES CASOS. El tercero no pinta nada, y ése es su comportamiento. */}
        {caso === "REABIERTO" && (
          <div className="mt-3">
            <Alert
              variant="warning"
              message={`El expediente ${expediente} estaba CUMPLIDO y vuelve a deber: se reabrió a EN VERIFICACIÓN DE PAGO por esta deuda.`}
            />
          </div>
        )}

        {caso === "FALLO_LA_REAPERTURA" && (
          <div className="mt-3">
            <Alert
              variant="warning"
              message={`La deuda quedó registrada, pero la reapertura no se completó: el estado del expediente ${expediente} cambió mientras se registraba. Revise el expediente y déjelo donde corresponda — 🔴 la deuda NO hay que volver a crearla, sería un doble cobro.`}
            />
          </div>
        )}

        <AvisosDeActo
          advertencias={resultado.advertencias}
          queSeRegistro={`Los costos de la ejecución sustitutoria del expediente ${expediente} quedaron registrados`}
        />

        <div className="modal-action">
          {/* El acto YA está registrado: no hay vuelta al formulario (reenviar sería un doble
              cobro). «La ficha» porque este modal solo se abre desde la página de la obligación
              de hacer. */}
          <button
            type="button"
            className="app-modules-modal-submit btn"
            onClick={onClose}
          >
            Volver a la ficha
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-box max-w-2xl">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="app-modules-modal-kicker">
            Ejecución — DME · Costos de la sustitutoria
          </p>
          <h3 className="text-lg font-semibold">
            Paso 2 de 2 · Registrar los gastos de la sustitutoria
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
        <Alert
          variant="info"
          message={
            "Teclee sólo lo que COSTÓ la diligencia. El recargo del art. 239 y el total los calcula " +
            "el servidor y se le mostrarán al terminar: aquí no se suma ni se multiplica nada, " +
            "porque la deuda que sale de esto se cobra por vía coactiva. Se crea una ORDEN DE PAGO " +
            "a nombre del administrado y, si el expediente estaba CUMPLIDO, volverá a deber."
          }
        />

        <label className="flex flex-col gap-1">
          <span className="font-medium">
            Gastos de la diligencia, base sin recargo (obligatorio)
          </span>
          {/* Texto con teclado decimal, no el tipo numérico del navegador: ése no acepta
              «4.820,55» de forma fiable y puede leer «1.234» como 1,234 (quick 261105-cvq). */}
          <input
            type="text"
            inputMode="decimal"
            autoComplete="off"
            className={`input input-bordered w-full${avisoBase ? " input-error" : ""}`}
            aria-label="Gastos de la diligencia, base de los gastos sin recargo"
            aria-invalid={avisoBase ? true : undefined}
            aria-describedby={avisoBase ? idAvisoBase : undefined}
            value={base}
            placeholder="4.820,55"
            disabled={enviando}
            onChange={(e) => setBase(e.target.value)}
          />
          {avisoBase ? (
            <span id={idAvisoBase} className="text-sm text-error">
              {avisoBase}
            </span>
          ) : (
            <span className="text-sm opacity-70">
              En dólares, con coma para los centavos (por ejemplo 4.820,55). Sin
              recargo: lo que costó la diligencia y nada más.
            </span>
          )}
        </label>

        <label className="flex flex-col gap-1">
          <span className="font-medium">
            Número de la orden de pago (obligatorio)
          </span>
          <input
            type="text"
            className="input input-bordered w-full"
            aria-label="Número de la orden de pago"
            maxLength={ORDEN_MAXIMO}
            value={numeroOrden}
            placeholder="OP-2026-00412"
            disabled={enviando}
            onChange={(e) => setNumeroOrden(e.target.value)}
          />
          {avisoOrden ? (
            <span className="text-sm text-error">{avisoOrden}</span>
          ) : (
            <span className="text-sm opacity-70">
              Tal y como lo emite el SAO. Va impreso en la providencia que se le
              notifica al administrado: un «pendiente» tecleado aquí acabaría
              impreso.
            </span>
          )}
        </label>

        <SelectorDocumentoExpediente
          eejeId={eejeId}
          valor={docId}
          onChange={(elegido) => setDocId(elegido)}
          etiqueta="Providencia que dispone el traslado (obligatorio)"
          ayuda="La providencia de COBRO DE VALORES POR EJECUCIÓN SUSTITUTORIA. Dice QUÉ SE DISPONE."
        />

        <SelectorDocumentoExpediente
          eejeId={eejeId}
          valor={respaldoDocId}
          onChange={(elegido) => setRespaldoDocId(elegido)}
          etiqueta="Respaldo del costo (obligatorio)"
          ayuda="El documento que subió en el paso 1: dice QUÉ COSTÓ. Es OTRO documento que la providencia. El servidor comprueba que los dos pertenezcan a este expediente; que sean distintos se comprueba aquí."
        />

        {/* 🔴 El motivo se dice en el formulario, no sólo apagando el botón: un botón apagado sin
            explicación deja al decisor adivinando cuál de los dos campos está mal. Mismo patrón
            `text-error` que `avisoBase` y `avisoOrden`. */}
        {avisoDocumentos && (
          <span className="text-sm text-error">{avisoDocumentos}</span>
        )}
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
          {enviando ? "Registrando…" : "Registrar los gastos"}
        </button>
      </div>
    </div>
  );
};

export default ModalGastosSustitutoria;
