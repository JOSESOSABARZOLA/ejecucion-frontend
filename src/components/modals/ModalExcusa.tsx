/**
 * Microservicio: ejecucion
 * Módulo: Sorteo / Asignación (DME)
 * Feature: Modal de excusa del decisor (causal del catálogo + hecho concreto opcional ≤500 +
 *   escrito GENERADO desde plantilla) — RECE-07
 * Archivo: ModalExcusa.tsx
 * Responsabilidad: Capturar la CAUSAL de la excusa del decisor asignado y el HECHO CONCRETO, y
 *   enviar al backend la causal, el detalle y el ESCRITO ya redactado
 *   (SorteoService.excusar → POST /sorteo/:cassId/excusa, JSON). Patrón parent-owns-error: el error
 *   se dice en el aviso flotante y el modal permanece abierto; solo se cierra tras éxito. También el
 *   FALLO DE FIRMA (Fase 03.21): «No se presentó la excusa. <texto del servidor>» en el aviso
 *   flotante, la causal y el escrito redactado se conservan y la clave se borra; si fue la clave, se
 *   dice SOLO bajo el campo, que vuelve marcado y con el foco para reintentar. La causal y el
 *   escrito obligatorios se dicen bajo su campo (regla de mensajes 261028-kmg).
 *
 *   ── LA FIRMA DEL ESCRITO (Fase 03.21, D-19) ──────────────────────────────────────────────────
 *   Con el firmador encendido, el escrito se firma con la clave del DECISOR en el mismo acto de
 *   presentar la excusa: la pide el campo único (`CampoClaveCertificado`), encima de las acciones, y
 *   viaja SOLO como quinto argumento de `SorteoService.excusar`. 🔴 Nunca en la vista previa: el
 *   borrador no se firma. La clave vive en el estado del hook, se borra al terminar cada envío (con
 *   éxito o con error) y no va al almacenamiento del navegador, a la consola ni a ningún aviso.
 *
 *   ── EL DECISOR YA NO SUBE NADA (D-03, 2026-09-16) ────────────────────────────────────────────
 *   Lo que subía era un escrito que redactaba ÉL MISMO, no una prueba de terceros. Así que el
 *   sistema se lo da hecho: la plantilla `ESCRITO_EXCUSA` de `t_plantilla_documento` llega
 *   precargada en el editor, con los siete tokens resueltos, y él solo añade el hecho concreto. El
 *   PDF lo genera el servidor.
 *
 *   ── LOS DOS CAMPOS, Y POR QUÉ NO SE ESCRIBE DOS VECES ────────────────────────────────────────
 *   El textarea del hecho concreto SIGUE SIENDO `reason`, y eso no es duplicación:
 *     · `reason` es lo que viaja a Asignaciones (`motivoParaAsignaciones`) y lo que se persiste en
 *       `epsor_excusa_reason` para la bandeja del director. Quitarlo degradaría dos consumidores que
 *       no tienen nada que ver con el PDF.
 *     · El EDITOR se RECOMPONE solo desde ese textarea mientras el decisor no lo haya tocado a mano.
 *   Es decir: se escribe en un sitio y aparece en los dos.
 *
 *   🔴 Y EN CUANTO EL DECISOR EDITA EL EDITOR, LA RECOMPOSICIÓN SE DETIENE (`editorTocado`). Sin
 *   eso, redactaría su escrito, tocaría el detalle y vería cómo el sistema le borra lo que acababa
 *   de escribir. Funciona sin trucos porque `RichTextEditor` usa
 *   `setContent(value, { emitUpdate: false })` para los cambios externos: su `onChange` solo se
 *   dispara con tecleo humano.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-07-10
 * Modificado por: Andrés Miño — 2026-09-01 (el escrito que sustenta la excusa pasa a ser obligatorio).
 * Modificado por: Andrés Miño — 2026-09-15 (el motivo tecleado se parte en causal del catálogo +
 *   detalle opcional — punto 4 del acta del 2026-09-11).
 * Modificado por: Andrés Miño — 2026-09-16 (Quick 260916-kwg, D-03/D-04/D-05: fuera el input de
 *   archivo; entra la plantilla precargada en el editor, con vista previa del borrador).
 * Modificado por: Andrés Miño — 2026-10-26 (Fase 03.21, Plan 14: la clave de firma con el campo
 *   único y su gate, el fallo de firma que vuelve al campo, y el aviso de éxito según
 *   `escritoFirmado`).
 * Modificado por: Andrés Miño — 2026-10-27 (revisión 03.21, WR-03: un fallo al refrescar la bandeja
 *   tras presentar la excusa ya no se pinta como fallo del envío.)
 * Modificado por: Andrés Miño — 2026-10-28 (quick 261028-kmg: sin aviso en línea; la clave rechazada
 *   solo en el estado E del campo, el resto de fallos en el aviso flotante, y la causal y el escrito
 *   obligatorios bajo su campo, con aria-invalid y el foco.)
 */
import { mensajeParaUsuario } from "../../api/mensajeParaUsuario";
import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { useCierreModal } from "../../hooks/useCierreModal";
import Alert from "../common/Alert";
import Loading from "../common/Loading";
import { useToast } from "../../hooks/useToast";
import { useUser } from "../../context/UserContext";
import {
  SorteoService,
  type CausalExcusa,
  type MiEpasAsignado,
} from "../../services/SorteoService";
import { PlantillaService } from "../../services/PlantillaService";
import { componerEscritoExcusa } from "../../config/escritoExcusaComposicion";
import { tieneContenido } from "../../config/providenciaComposicion";
import { DatetimeUtil } from "../../utils/datetime.util";
import RichTextEditor from "../providencia/RichTextEditor";
import { PDFViewer } from "../pdf/PDFViewer";
import CampoClaveCertificado from "../sorteo/CampoClaveCertificado";
import { useClaveDeFirma } from "../../hooks/useClaveDeFirma";
import {
  AVISO_LISTA_NO_ACTUALIZADA,
  AVISO_SIN_FIRMADOR,
  CONSECUENCIA_FALLO_FIRMA,
  ERROR_CLAVE_INCORRECTA,
  esClaveIncorrecta,
  esErrorDeFirma,
  exitoExcusa,
  mensajeDeFalloDeFirma,
} from "../../config/firmaCopy";

export const MODAL_KEY = "excusarme" as const;

/** Máximo de caracteres del detalle (coincide con ExcusaDto.reason @MaxLength(500) del backend). */
const MOTIVO_MAX_LENGTH = 500;

/** Clave de la plantilla en `t_plantilla_documento`. Espeja la fila sembrada por la migración. */
const CLAVE_PLANTILLA = "ESCRITO_EXCUSA";

/** Retardo del refresco del borrador. Mismo criterio que `EmitirProvidenciaModal`. */
const RETARDO_PREVIA_MS = 1500;

interface ModalExcusaProps {
  caseData: MiEpasAsignado;
  onClose: () => void;
  refetchFn?: () => Promise<void>;
}

const ModalExcusa: React.FC<ModalExcusaProps> = ({
  caseData,
  onClose,
  refetchFn,
}) => {
  const { addToast } = useToast();
  const { user } = useUser();
  const { cassId, expNumber, eejeId } = caseData;

  const [causales, setCausales] = useState<CausalExcusa[]>([]);
  const [causal, setCausal] = useState("");
  const [motivo, setMotivo] = useState("");
  const [cargandoCausales, setCargandoCausales] = useState(true);
  const [catalogoCaido, setCatalogoCaido] = useState(false);

  // La plantilla y el escrito. `plantillaHtml` es la fuente; `escritoHtml` es lo que se ve y lo que
  // se manda. `editorTocado` decide cuál de los dos manda a partir de cierto momento.
  const [plantillaHtml, setPlantillaHtml] = useState<string | null>(null);
  const [escritoHtml, setEscritoHtml] = useState("");
  const [editorTocado, setEditorTocado] = useState(false);
  const [plantillaCaida, setPlantillaCaida] = useState(false);

  const [previaAbierta, setPreviaAbierta] = useState(false);
  const [previa, setPrevia] = useState<string | null>(null);
  const [previaDesfasada, setPreviaDesfasada] = useState<string | null>(null);
  const [generandoPrevia, setGenerandoPrevia] = useState(false);

  const [isSaving, setIsSaving] = useState(false);
  // Errores de CAMPO (regla de mensajes 261028-kmg): se dicen bajo su control y se retiran al editar.
  const [errorCausal, setErrorCausal] = useState<string | null>(null);
  const [errorEscrito, setErrorEscrito] = useState<string | null>(null);
  const causalRef = useRef<HTMLSelectElement>(null);
  const escritoRef = useRef<HTMLDivElement>(null);
  const idBase = useId();
  const idErrorCausal = `${idBase}-error-causal`;
  const idErrorEscrito = `${idBase}-error-escrito`;

  // La clave de firma del decisor (Fase 03.21, D-19). `errorFirma` es el último fallo de firma:
  // `claveIncorrecta` enciende el estado E del campo (lo único que se dice de una clave rechazada);
  // cualquier otro fallo ya se dijo en el aviso flotante.
  const clave = useClaveDeFirma();
  const campoClaveRef = useRef<HTMLInputElement>(null);
  const [errorFirma, setErrorFirma] = useState<{
    mensaje: string;
    claveIncorrecta: boolean;
  } | null>(null);

  // Estado E: tras un rechazo de la clave, el foco vuelve al campo en cuanto el envío terminó (antes
  // está deshabilitado y no lo aceptaría).
  useEffect(() => {
    if (errorFirma?.claveIncorrecta && !isSaving) {
      campoClaveRef.current?.focus();
    }
  }, [errorFirma, isSaving]);

  // Cierre al pulsar fuera (quick 261019-mcf): la causal elegida, el motivo o el escrito retocado son
  // trabajo del decisor; la plantilla recién cargada no lo es, por eso cuenta `editorTocado`.
  useCierreModal({
    hayCambios: causal !== "" || motivo.trim() !== "" || editorTocado,
    ocupado: isSaving,
  });

  // El catálogo se lee al abrir. Si no llega, el desplegable se queda vacío y sin explicación:
  // `catalogoCaido` existe para que el decisor lea POR QUÉ no puede excusarse, en vez de mirar un
  // botón apagado. No hay camino de escape a texto libre — la causal es lo único agrupable, y
  // permitir excusarse sin ella devolvería el problema que este cambio vino a resolver.
  useEffect(() => {
    let vigente = true;
    void (async () => {
      try {
        const data = await SorteoService.causalesExcusa();
        if (vigente) setCausales(data);
      } catch {
        if (vigente) setCatalogoCaido(true);
      } finally {
        if (vigente) setCargandoCausales(false);
      }
    })();
    return () => {
      vigente = false;
    };
  }, []);

  // La plantilla se lee EN PARALELO con el catálogo.
  //
  // 🔴 SI NO LLEGA, SE AVISA PERO **NO SE BLOQUEA EL ENVÍO**, y es distinto de lo que se hace con
  // las causales. Sin causal la excusa no puede existir: la fija la norma y es lo único agrupable.
  // Sin plantilla SÍ puede existir, porque el escrito es texto del DECISOR y la plantilla solo le
  // ahorra teclearlo. Bloquear aquí dejaría a un funcionario sin poder apartarse de un expediente en
  // el que tiene conflicto de interés porque una fila de catálogo no llegó.
  useEffect(() => {
    let vigente = true;
    void (async () => {
      try {
        const plantilla = await PlantillaService.leer(CLAVE_PLANTILLA);
        if (vigente) setPlantillaHtml(plantilla.html ?? "");
      } catch {
        if (vigente) setPlantillaCaida(true);
      }
    })();
    return () => {
      vigente = false;
    };
  }, []);

  /**
   * Los tres tokens que NO viven en el caso. El título sale de la fila ya cargada en `causales`:
   * sin llamada nueva, porque el catálogo ya lo trae.
   */
  const contexto = useMemo(
    () => ({
      causal: causales.find((c) => c.codigo === causal)?.titulo,
      decisor: user?.usuFullName,
      fecha: DatetimeUtil.formatFechaLarga(),
    }),
    [causales, causal, user?.usuFullName],
  );

  // RECOMPOSICIÓN. Mientras el decisor no haya tocado el editor, el escrito se rehace desde la
  // plantilla cada vez que cambia algo que entra en él: la causal elegida, el hecho concreto o el
  // propio texto de la plantilla cuando termina de llegar.
  useEffect(() => {
    if (editorTocado || plantillaHtml === null) return;
    setEscritoHtml(
      componerEscritoExcusa(plantillaHtml, caseData, contexto, motivo),
    );
  }, [editorTocado, plantillaHtml, caseData, contexto, motivo]);

  /**
   * REFRESCO AUTOMÁTICO del borrador, con retardo y cancelando la petición anterior.
   *
   * Se copia el mecanismo de `EmitirProvidenciaModal` en vez de inventar otro: aquel ya resolvió los
   * tres modos de fallo —una petición por tecla, borradores que nadie mira, y una respuesta vieja
   * que llega después de la nueva y deja en pantalla un texto anterior al del editor—.
   */
  useEffect(() => {
    if (!previaAbierta || !tieneContenido(escritoHtml) || cassId == null) return;

    const control = new AbortController();
    const temporizador = setTimeout(() => {
      setGenerandoPrevia(true);
      SorteoService.vistaPreviaEscritoExcusa(
        cassId,
        escritoHtml,
        control.signal,
      )
        .then((url) => {
          setPrevia((anterior) => {
            if (anterior) URL.revokeObjectURL(anterior);
            return url;
          });
          setPreviaDesfasada(null);
        })
        .catch((err: unknown) => {
          if (control.signal.aborted) return;
          // ⚠️ El borrador anterior se QUEDA en pantalla. Vaciarlo por un fallo pasajero —o porque
          // el texto está a medio escribir— sería castigar al que redacta; se avisa de que lo que
          // se ve no es lo último y ya está.
          setPreviaDesfasada(
            mensajeParaUsuario(err, "No se pudo actualizar."),
          );
        })
        .finally(() => {
          if (!control.signal.aborted) setGenerandoPrevia(false);
        });
    }, RETARDO_PREVIA_MS);

    return () => {
      clearTimeout(temporizador);
      control.abort();
    };
  }, [previaAbierta, escritoHtml, cassId]);

  /** Suelta el blob al cerrar: cada borrador retiene memoria hasta que se revoca. */
  const cerrarPrevia = () => {
    setPreviaAbierta(false);
    setPreviaDesfasada(null);
    setPrevia((anterior) => {
      if (anterior) URL.revokeObjectURL(anterior);
      return null;
    });
  };

  const causalValida = causal !== "";
  // Los dos requisitos: la causal (norma) y que HAYA ESCRITO. El acta del 28-08 no se relaja —solo
  // cambia quién produce el escrito—, y `tieneContenido` sabe que un Tiptap vacío trae `<p></p>`.
  const puedeEnviar = causalValida && tieneContenido(escritoHtml);

  /** Escribir en el campo retira el fallo de firma anterior: es un intento nuevo. */
  const editarClave = (valor: string) => {
    clave.setClave(valor);
    if (errorFirma) setErrorFirma(null);
  };

  const handleConfirm = async () => {
    setErrorFirma(null);

    // Guardas defensivas: el botón ya está apagado sin causal o sin escrito (`puedeEnviar`). Si se
    // llegara aquí, el error se dice bajo su campo y el foco va a él.
    if (!causalValida) {
      setErrorCausal("La causal es requerida.");
      causalRef.current?.focus();
      return;
    }
    if (!tieneContenido(escritoHtml)) {
      setErrorEscrito("El escrito que sustenta la excusa no puede estar vacío.");
      escritoRef.current
        ?.querySelector<HTMLElement>('[contenteditable="true"]')
        ?.focus();
      return;
    }
    if (cassId == null) {
      addToast("error", "No se pudo identificar la asignación a excusar.");
      return;
    }

    setIsSaving(true);
    try {
      const respuesta = await SorteoService.excusar(
        cassId,
        causal,
        escritoHtml,
        motivo.trim(),
        clave.claveParaEnviar,
      );
      // El aviso dice si el escrito salió FIRMADO (UI-SPEC §10.7): solo `true` cuenta como firmado.
      const escritoFirmado =
        (respuesta as { escritoFirmado?: unknown } | null)?.escritoFirmado ===
        true;
      addToast("success", exitoExcusa(escritoFirmado));
      // La excusa YA se presentó: si lo que falla es refrescar la bandeja, no es un fallo del envío y
      // no puede caer en el `catch` de abajo (empujaría a presentarla otra vez).
      if (refetchFn) {
        try {
          await refetchFn();
        } catch {
          addToast("info", AVISO_LISTA_NO_ACTUALIZADA);
        }
      }
      onClose();
    } catch (error) {
      if (esErrorDeFirma(error)) {
        // D-07: no se presentó nada. Se dice qué no se hizo y por qué; la causal y el escrito se
        // quedan como estaban para reintentar, y el modal sigue abierto.
        // Si fue la clave, SOLO el estado E del campo; si no, el aviso flotante.
        const mensaje = mensajeDeFalloDeFirma(
          CONSECUENCIA_FALLO_FIRMA.excusa,
          error,
        );
        const claveIncorrecta = esClaveIncorrecta(error);
        if (!claveIncorrecta) addToast("error", mensaje);
        setErrorFirma({ mensaje, claveIncorrecta });
      } else {
        addToast(
          "error",
          mensajeParaUsuario(error, "No se pudo enviar la solicitud de excusa. Intente más tarde."),
        );
      }
    } finally {
      // 🔴 La clave se borra en los DOS finales, con éxito y con error (UI-SPEC §2.3, regla 2).
      clave.limpiar();
      setIsSaving(false);
    }
  };

  return (
    // El modal se ENSANCHA al abrir el borrador: con el ancho de siempre, la columna del documento
    // dejaría el formulario en un canal ilegible. Mismo criterio que `EmitirProvidenciaModal`.
    <div
      className={`modal-box relative p-0 ${
        previaAbierta ? "max-w-[95vw] xl:max-w-7xl" : "w-fit max-w-3xl"
      }`}
    >
      <div className="w-full max-h-[90vh] overflow-y-auto">
        <div className="app-modules-modal-header flex flex-col gap-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              {/* Fase 03.19, Plan 17: el kicker dice de dónde se abrió el modal, así que tiene que
                  decir el nombre que la pantalla lleva ahora («Mis Expedientes»). */}
              <p className="app-modules-modal-kicker">Mis Expedientes</p>
              <h2 className="app-modules-modal-title">Declarar excusa</h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="app-modules-modal-close shrink-0"
              aria-label="Cerrar modal"
              disabled={isSaving}
            >
              ×
            </button>
          </div>
        </div>

        <div className="app-modules-modal-body">
          <div
            className={
              previaAbierta ? "flex flex-col gap-4 lg:flex-row" : undefined
            }
          >
            <div
              className={
                previaAbierta ? "min-w-0 flex-1 overflow-y-auto pr-1" : undefined
              }
            >
              <div className="app-modules-modal-content flex flex-col gap-4">
                <div className="app-modules-review-row">
                  <span className="app-modules-review-row-label">
                    Expediente
                  </span>
                  <span className="app-modules-review-row-value">
                    {expNumber ?? `EPAS #${eejeId ?? "—"}`}
                  </span>
                </div>

                <p className="app-modules-review-copy text-sm">
                  Elija la causal de excusa o conflicto de interés que
                  corresponda. El expediente se reasignará a otro funcionario.
                </p>

                {/* LA CAUSAL, requerida (punto 4 del acta del 2026-09-11). Las seis salen del
                    catálogo `RAZONES_EXCUSA` adoptado por la «Resolución de Protocolo de Recusación
                    y Excusa», el mismo que ya rige en Instrucción.

                    ⚠️ PENDIENTE DE CONFIRMACIÓN POR EL SUPERVISOR DE LA AMC, y quien lea esto no
                    debe darlo por cerrado: la redacción exacta de las seis, que sea UNA sola causal
                    y no varias (Instrucción sí admite varias), y que NO exista una opción «Otra
                    causal» son las RECOMENDACIONES de
                    PROPUESTA-2026-09-14-causales-de-excusa.md §3, no una decisión aprobada. */}
                <label className="flex flex-col gap-1">
                  <span className="text-sm">Causal de la excusa (requerida)</span>
                  <select
                    ref={causalRef}
                    className={`select select-bordered w-full${errorCausal ? " select-error" : ""}`}
                    value={causal}
                    onChange={(e) => {
                      setCausal(e.target.value);
                      setErrorCausal(null);
                    }}
                    disabled={isSaving || cargandoCausales || catalogoCaido}
                    aria-invalid={errorCausal ? true : undefined}
                    aria-describedby={errorCausal ? idErrorCausal : undefined}
                  >
                    <option value="" disabled>
                      {cargandoCausales
                        ? "Cargando causales…"
                        : "Seleccione la causal"}
                    </option>
                    {causales.map((c) => (
                      <option key={c.codigo} value={c.codigo}>
                        {c.titulo}
                      </option>
                    ))}
                  </select>
                  {errorCausal && (
                    <span id={idErrorCausal} className="text-sm text-error">
                      {errorCausal}
                    </span>
                  )}
                  {catalogoCaido && (
                    <span className="text-xs text-error">
                      No se pudieron cargar las causales de excusa. Cierre el
                      modal e inténtelo de nuevo; si persiste, avise a soporte:
                      sin causal no es posible declarar la excusa.
                    </span>
                  )}
                </label>

                {/* El HECHO CONCRETO. Sigue siendo `reason` —es lo que viaja a Asignaciones y lo que
                    lee el director en su bandeja— y ADEMÁS se inserta en el escrito. Se escribe
                    aquí, aparece en los dos sitios. */}
                <label className="floating-label">
                  <span>Hecho concreto (opcional) — se inserta en el escrito</span>
                  <textarea
                    className="textarea textarea-bordered w-full"
                    rows={3}
                    value={motivo}
                    maxLength={MOTIVO_MAX_LENGTH}
                    onChange={(e) => setMotivo(e.target.value)}
                    placeholder="Describa el hecho concreto que sustenta la causal"
                    disabled={isSaving}
                  />
                </label>
                <span className="text-xs opacity-70 text-right">
                  {motivo.length}/{MOTIVO_MAX_LENGTH}
                </span>

                {/* EL ESCRITO. Ya no se sube: se redacta aquí, sobre la plantilla. */}
                <label className="flex flex-col gap-1">
                  <span className="text-sm">
                    Escrito que sustenta la excusa
                  </span>
                  {plantillaCaida && (
                    <span className="text-xs text-warning">
                      No se pudo cargar la plantilla del escrito. Puede
                      redactarlo directamente aquí: la excusa se envía igual.
                    </span>
                  )}
                  <div
                    ref={escritoRef}
                    aria-invalid={errorEscrito ? true : undefined}
                    aria-describedby={errorEscrito ? idErrorEscrito : undefined}
                  >
                    <RichTextEditor
                      value={escritoHtml}
                      onChange={(html) => {
                        setEditorTocado(true);
                        setEscritoHtml(html);
                        setErrorEscrito(null);
                      }}
                      placeholder="Redacte el escrito con que sustenta su excusa…"
                    />
                  </div>
                  {errorEscrito && (
                    <span id={idErrorEscrito} className="text-sm text-error">
                      {errorEscrito}
                    </span>
                  )}
                  <span className="text-xs opacity-70">
                    Lo genera el sistema en PDF y queda como anexo del
                    expediente: es lo que el director lee para resolver.
                  </span>
                </label>

                {/* LA CLAVE DE FIRMA (Fase 03.21, D-19): el último dato antes del botón que
                    presenta. Con el firmador apagado pinta el aviso de que el escrito saldrá sin
                    firma; sin sesión central, el aviso de que así no se puede firmar. */}
                <CampoClaveCertificado
                  requerida={clave.requerida}
                  value={clave.clave}
                  onChange={editarClave}
                  disabled={isSaving}
                  error={
                    errorFirma?.claveIncorrecta
                      ? ERROR_CLAVE_INCORRECTA
                      : undefined
                  }
                  inputRef={campoClaveRef}
                  avisoSinFirmador={AVISO_SIN_FIRMADOR.excusa}
                  sesionCentral={clave.sesionCentral}
                  cargando={clave.cargando}
                  errorModo={clave.errorModo}
                  onReintentarModo={clave.reintentarModo}
                />
              </div>

              <div className="app-modules-modal-actions">
                <button
                  type="button"
                  onClick={onClose}
                  className="app-modules-modal-cancel btn"
                  disabled={isSaving}
                >
                  Cancelar
                </button>
                {/* Abre el panel del borrador; a partir de ahí se refresca solo al dejar de escribir.
                    Ojo — que salga NO significa que la excusa se pueda enviar. */}
                <button
                  type="button"
                  className="btn btn-outline"
                  disabled={isSaving || !tieneContenido(escritoHtml)}
                  onClick={() =>
                    previaAbierta ? cerrarPrevia() : setPreviaAbierta(true)
                  }
                >
                  {previaAbierta ? "Ocultar borrador" : "Ver borrador"}
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  className="app-modules-modal-submit btn"
                  disabled={isSaving || !puedeEnviar || !clave.listaParaEnviar}
                >
                  {isSaving ? "Enviando…" : "Enviar excusa"}
                </button>
              </div>
            </div>

            {/* COLUMNA DERECHA — el borrador, mientras se redacta. */}
            {previaAbierta && (
              <aside className="flex w-full shrink-0 flex-col overflow-hidden rounded-xl border border-base-300 lg:w-[46%]">
                <div className="flex items-center justify-between gap-2 border-b border-base-300 bg-base-200 px-3 py-2">
                  <span className="text-xs font-bold uppercase tracking-[0.14em] text-warning">
                    Borrador — todavía NO presentado
                    {generandoPrevia && " · actualizando…"}
                  </span>
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs"
                    onClick={cerrarPrevia}
                    aria-label="Ocultar la vista previa"
                  >
                    Ocultar
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-2">
                  {/* 🔴 Cuando el refresco falla, el borrador anterior SIGUE en pantalla — y
                      entonces hay que decir que lo que se ve no es lo último escrito. */}
                  {previaDesfasada && (
                    <Alert
                      variant="error"
                      message={`Lo que se ve NO refleja lo último escrito: ${previaDesfasada}`}
                    />
                  )}

                  {previa ? (
                    <div className="overflow-x-auto">
                      <PDFViewer
                        document={
                          {
                            docName: "Escrito de excusa (borrador)",
                            docUrl: previa,
                          } as never
                        }
                        loading={false}
                        width={430}
                      />
                    </div>
                  ) : (
                    <p className="p-6 text-sm text-base-content/70">
                      Armando el borrador…
                    </p>
                  )}

                  <p className="mt-2 px-2 text-[11px] leading-snug text-base-content/70">
                    No se ha presentado ni consta en el expediente. Que se vea
                    bien no significa que se pueda enviar — eso lo comprueba
                    «Enviar excusa».
                  </p>
                </div>
              </aside>
            )}
          </div>
        </div>
      </div>
      {isSaving && <Loading />}
    </div>
  );
};

export default ModalExcusa;
