/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/obligacion-hacer (frontend)
 * Feature: La rama del correctivo en pantalla — tramo del CUMPLIMIENTO (Fase 03.18, Plan 05)
 * Archivo: ModalAdjuntarInforme.tsx
 * Responsabilidad: `HACER-01` — subir el INFORME TÉCNICO DEL CONTROL DE VERIFICACIÓN que emite la
 *   DMIP sobre si el correctivo se cumplió (`POST /obligacion-hacer/:eejeId/informe`) y registrar
 *   qué concluye: acreditar el cumplimiento o constatar el incumplimiento, citando ese informe.
 *
 *   ── DE DÓNDE VIENE ESTE INFORME ──────────────────────────────────────────────────────────────
 *   Lo emite la DMIP en respuesta a la PROVIDENCIA DE TRASLADO que el decisor le dirige. Esa
 *   providencia **sale por el camino genérico que ya existe** —«Emitir providencia» en la bandeja
 *   del decisor—, igual que la multa compulsoria.
 *
 *   🔴 **AQUÍ NO SE CONSTRUYE UN EMISOR DE PROVIDENCIAS.** Un emisor propio duplicaría la
 *   numeración, la notificación y la firma, que es exactamente lo que el backend decidió no hacer
 *   (`obligacion-hacer.controller.ts`, nota sobre `ProvidenciaService.emitir`). Este modal sube un
 *   PDF y nada más.
 *
 *   ── EL NOMBRE DEL FICHERO NO VIAJA (T-0318-19) ───────────────────────────────────────────────
 *   La única clave del multipart es `file`, y el nombre con que se sirve el documento lo genera el
 *   SERVIDOR. Dejarlo elegir al cliente sería dejarle elegir la ruta del fichero que después se
 *   sirve como estático. Lo garantiza `ObligacionHacerService.adjuntarInforme` (Plan 02), que
 *   además usa el tiempo de espera propio de la rama (`SUBIDA_TIMEOUT_MS`).
 *
 *   ── EL INFORME Y SU CONCLUSIÓN, SIN PANTALLAS DE REVISIÓN (quick 261014-dmc) ──────────────────
 *   (a) Subir es UN clic tras elegir el PDF: no hay pantalla de «revise antes de subir». El informe
 *       es una PRUEBA que no decide nada por sí sola, y la validación del PDF ya se hace en el
 *       formulario; repetir la ficha solo añadía un clic.
 *   (b) La conclusión —«Cumple» o «Incumple»— se elige en línea y «Registrar conclusión» ejecuta el
 *       acto directamente (`acreditar` / `constatarIncumplimiento`) citando el `docId` del informe.
 *   (c) Es REABRIBLE: si el bloque de la rama dice `informeSinConclusion`, el modal abre directo en
 *       la conclusión citando `informeDocId`. Así cerrar con la × después de subir no obliga a
 *       subir un PDF duplicado para volver a llegar aquí. Desde la conclusión, «Volver a la subida»
 *       cubre el caso de que el citado no sea el bueno: unifica el antiguo «Subir otro informe»,
 *       que era la MISMA transición con otro rótulo (quick 261014-lhu). Como el informe citado YA
 *       está en el servidor y volver no lo retira, la subida lo DICE y ofrece «Volver a la
 *       conclusión», que lo vuelve a citar sin subir nada. Ninguno de los dos toca el servidor.
 *   (d) Es la ÚNICA entrada a esos dos actos desde la pantalla de la rama: ya no están en su menú.
 *       Los modales sueltos de acreditar/constatar siguen existiendo para el registro de acciones
 *       de otras bandejas, donde la prueba puede ser otro papel.
 *   (e) Criterio 7: el bloque SOLO elige el paso inicial. Si la acción procede lo decidió el motor
 *       (`adjuntarInforme` = decisor + `obligacionHacer.tiene`); este modal no lo vuelve a juzgar.
 *
 *   🔴 Este modal NO lee ni compara el estado del EPAS (criterio 7).
 * Desarrollador: Andrés Miño
 * Fecha: 2026-09-15
 * Modificado por: Andrés Miño — 2026-10-14 (quick 261014-lhu: «Volver a la subida» —que sustituye a
 *   «Subir otro informe»— y «Volver a la conclusión», sin llamar al servicio; la subida avisa de que
 *   el informe citado sigue adjunto)
 * Modificado por: Andrés Miño — 2026-10-28 (quick 261028-kmg: el fallo del servidor al registrar se
 *   dice en el aviso flotante, ya no en una caja del modal)
 */
import { useState } from "react";
import { useCierreModal } from "../../hooks/useCierreModal";
import Alert from "../common/Alert";
import { useToast } from "../../hooks/useToast";
import { ObligacionHacerService } from "../../services/ObligacionHacerService";
import {
  TIPO_PDF,
  describirAdministrado,
  describirExpediente,
  mensajeDeError,
  validarPdf,
  type PropsModalRama,
} from "./comunes";

/** Mismo valor que el nombre de acción declarado en `POLITICA_ACCIONES` (Plan 04). */
export const MODAL_KEY = "adjuntarInforme" as const;

type Conclusion = "cumple" | "incumple";

/** El informe que la conclusión cita: el recién subido o el que quedó pendiente. */
interface InformeCitado {
  docId: number;
  recienSubido: boolean;
}

const OPCIONES: Array<{ valor: Conclusion; titulo: string; explicacion: string }> = [
  {
    valor: "cumple",
    titulo: "Cumple",
    explicacion:
      "Acredita el cumplimiento del correctivo y desbloquea el archivo por el lado del correctivo.",
  },
  {
    valor: "incumple",
    titulo: "Incumple",
    explicacion:
      "Deja constancia en la bitácora; NO mueve el expediente de estado y habilita la escalada.",
  },
];

const ModalAdjuntarInforme = ({
  caseData,
  onClose,
  refetchFn,
}: PropsModalRama) => {
  const { addToast } = useToast();
  const { eejeId } = caseData;

  /**
   * Mientras sea `null` el modal está en el paso de la SUBIDA. Arranca citando el informe pendiente
   * si el bloque lo trae (y solo si trae su `docId`): sin el dato —servidor anterior— degrada a la
   * subida de siempre.
   */
  const [citado, setCitado] = useState<InformeCitado | null>(() => {
    const ob = caseData.obligacionHacer;
    return ob?.informeSinConclusion === true && ob.informeDocId != null
      ? { docId: ob.informeDocId, recienSubido: false }
      : null;
  });
  /**
   * El informe que se citaba al volver a la subida (quick 261014-lhu). Sigue en el servidor —volver
   * no lo retira— y se puede volver a él con «Volver a la conclusión». `null` si no se volvió.
   */
  const [citadoAnterior, setCitadoAnterior] = useState<InformeCitado | null>(
    null,
  );
  const [informe, setInforme] = useState<File | null>(null);
  const [conclusion, setConclusion] = useState<Conclusion | null>(null);
  const [enviando, setEnviando] = useState(false);
  /** Se subió algo en esta apertura: la bandeja tiene que recargarse al salir, sea como sea. */
  const [huboSubida, setHuboSubida] = useState(false);

  // Cierre al pulsar fuera (quick 261019-mcf): el informe o la conclusión elegidos son trabajo sin
  // guardar.
  useCierreModal({
    hayCambios: informe !== null || conclusion !== null,
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

  const expediente = describirExpediente(caseData);
  const administrado = describirAdministrado(caseData);

  /**
   * 🔴 SE VALIDA ANTES DE ENVIAR. El backend vuelve a comprobarlo (`fileFilter` de PDF y 10 MB) y
   * es él quien manda; esto existe para que el decisor se entere EN EL FORMULARIO y no después de
   * cuarenta segundos de subida por la red municipal.
   */
  const avisoArchivo = informe
    ? validarPdf(informe, "El informe de verificación")
    : null;
  const puedeSubir = !!informe && !avisoArchivo;

  /** Toda salida sin acto. Si se subió algo, el informe ya está en el expediente: se recarga. */
  const cerrar = async () => {
    if (enviando) return;
    if (huboSubida && refetchFn) await refetchFn();
    onClose();
  };

  const subir = async () => {
    if (enviando || !informe) return;
    setEnviando(true);
    try {
      const { docId } = await ObligacionHacerService.adjuntarInforme(
        eejeId,
        informe,
      );
      addToast(
        "success",
        `Informe de verificación adjunto al expediente ${expediente} (documento ${docId}).`,
      );
      // 🔴 Sin recargar todavía: la recarga va al cerrar o al registrar la conclusión.
      setHuboSubida(true);
      setConclusion(null);
      setCitadoAnterior(null);
      setCitado({ docId, recienSubido: true });
    } catch (error) {
      addToast(
        "error",
        mensajeDeError(
          error,
          "No se pudo adjuntar el informe de verificación.",
        ),
      );
    } finally {
      setEnviando(false);
    }
  };

  const registrarConclusion = async () => {
    if (enviando || !citado || !conclusion) return;
    setEnviando(true);
    const { docId } = citado;
    try {
      if (conclusion === "cumple") {
        await ObligacionHacerService.acreditar(eejeId, { docId });
        addToast(
          "success",
          `Cumplimiento del correctivo acreditado en el expediente ${expediente} (informe, documento ${docId}).`,
        );
      } else {
        await ObligacionHacerService.constatarIncumplimiento(eejeId, { docId });
        addToast(
          "success",
          `Queda constancia del incumplimiento del correctivo en el expediente ${expediente} (informe, documento ${docId}). El expediente NO cambia de estado.`,
        );
      }
      if (refetchFn) await refetchFn();
      onClose();
    } catch (error) {
      addToast(
        "error",
        mensajeDeError(
          error,
          conclusion === "cumple"
            ? "No se pudo acreditar el cumplimiento del correctivo."
            : "No se pudo registrar la constatación del incumplimiento.",
        ),
      );
    } finally {
      setEnviando(false);
    }
  };

  /**
   * «Volver a la subida»: de la conclusión a la subida, sin tocar el servidor. El informe citado se
   * guarda en `citadoAnterior` porque SIGUE adjunto al expediente y se puede volver a él.
   * `huboSubida` se conserva: si se subió algo, sigue habiendo que recargar al salir.
   */
  const volverALaSubida = () => {
    if (enviando) return;
    setCitadoAnterior(citado);
    setCitado(null);
    setConclusion(null);
    setInforme(null);
  };

  /** «Volver a la conclusión»: vuelve a citar el informe de antes, sin subir nada. */
  const volverALaConclusion = () => {
    if (enviando || !citadoAnterior) return;
    setCitado(citadoAnterior);
    setCitadoAnterior(null);
    setConclusion(null);
    setInforme(null);
  };

  const cabecera = (titulo: string) => (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="app-modules-modal-kicker">
          Ejecución — DME · Obligación de hacer
        </p>
        <h3 className="text-lg font-semibold">{titulo}</h3>
        <p className="text-sm opacity-70">
          {expediente} · {administrado}
        </p>
      </div>
      <button
        type="button"
        onClick={cerrar}
        disabled={enviando}
        className="app-modules-modal-close shrink-0"
        aria-label="Cerrar modal"
      >
        ×
      </button>
    </div>
  );

  if (citado) {
    return (
      <div className="modal-box max-w-2xl">
        {cabecera("¿Qué concluye el informe de verificación?")}

        <div className="mt-4 flex flex-col gap-4">
          {citado.recienSubido ? (
            // Que quedó adjunto ya lo dijo el aviso de éxito de la subida (quick 261028-kmg): aquí solo
            // la guía del paso.
            <Alert
              variant="info"
              message={`Registre qué concluye el informe de verificación (documento ${citado.docId}) según lo que informó la DMIP, citándolo como prueba.`}
            />
          ) : (
            <Alert
              variant="info"
              message={`El expediente tiene un informe de verificación SIN conclusión registrada: Informe de verificación (documento ${citado.docId}). Registre qué concluye, o vuelva a la subida si ese no es el bueno.`}
            />
          )}

          <fieldset className="flex flex-col gap-2">
            <legend className="font-medium">Conclusión de la DMIP</legend>
            {OPCIONES.map((opcion) => (
              <label
                key={opcion.valor}
                className={`flex cursor-pointer items-start gap-2 rounded-lg border p-3 ${
                  conclusion === opcion.valor
                    ? "border-primary bg-primary/5"
                    : "border-base-300"
                }`}
              >
                <input
                  type="radio"
                  className="radio radio-sm mt-1"
                  name="conclusion-informe"
                  value={opcion.valor}
                  checked={conclusion === opcion.valor}
                  disabled={enviando}
                  onChange={() => setConclusion(opcion.valor)}
                />
                <span className="min-w-0">
                  <span className="block font-medium">{opcion.titulo}</span>
                  <span className="block text-sm opacity-70">
                    {opcion.explicacion}
                  </span>
                </span>
              </label>
            ))}
          </fieldset>
        </div>

        <div className="modal-action">
          <button
            type="button"
            className="app-modules-modal-cancel btn"
            disabled={enviando}
            onClick={volverALaSubida}
          >
            Volver a la subida
          </button>
          <button
            type="button"
            className="app-modules-modal-submit btn"
            disabled={!conclusion || enviando}
            onClick={registrarConclusion}
          >
            {enviando ? "Registrando…" : "Registrar conclusión"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-box max-w-2xl">
      {cabecera("Adjuntar el informe de verificación")}

      <div className="mt-4 flex flex-col gap-4">
        {citadoAnterior && (
          <Alert
            variant="info"
            message={`El informe de verificación (documento ${citadoAnterior.docId}) sigue adjunto al expediente: volver a la subida no lo retira. Suba otro solo si ese no es el bueno; la conclusión citará el nuevo.`}
          />
        )}

        <Alert
          variant="info"
          message={
            "Es el informe de control y verificación que emite la DMIP en respuesta a la " +
            "providencia de traslado. La providencia se emite por el camino de siempre —«Emitir " +
            "providencia» en su bandeja—; aquí solo se adjunta el informe que la DMIP devolvió."
          }
        />

        <label className="flex flex-col gap-1">
          <span className="font-medium">
            Informe de verificación (PDF, obligatorio)
          </span>
          <input
            type="file"
            accept={TIPO_PDF}
            className="file-input file-input-bordered w-full"
            disabled={enviando}
            onChange={(e) => setInforme(e.target.files?.[0] ?? null)}
          />
          {avisoArchivo ? (
            <span className="text-sm text-error">{avisoArchivo}</span>
          ) : (
            <span className="text-sm opacity-70">
              Solo PDF, hasta 10 MB. El nombre con que se guarda lo pone el
              sistema. La subida puede tardar: no cierre la ventana mientras
              corre.
            </span>
          )}
        </label>
      </div>

      <div className="modal-action">
        <button
          type="button"
          className="app-modules-modal-cancel btn"
          disabled={enviando}
          onClick={cerrar}
        >
          Cancelar
        </button>
        {citadoAnterior && (
          <button
            type="button"
            className="app-modules-modal-cancel btn"
            disabled={enviando}
            onClick={volverALaConclusion}
          >
            Volver a la conclusión
          </button>
        )}
        <button
          type="button"
          className="app-modules-modal-submit btn"
          disabled={!puedeSubir || enviando}
          onClick={subir}
        >
          {enviando ? "Subiendo… (puede tardar)" : "Subir el informe"}
        </button>
      </div>
    </div>
  );
};

export default ModalAdjuntarInforme;
