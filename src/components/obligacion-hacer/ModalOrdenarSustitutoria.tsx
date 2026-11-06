/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/obligacion-hacer (frontend)
 * Feature: La rama del correctivo en pantalla — tramo de la ESCALADA (Fase 03.18, Plan 06)
 * Archivo: ModalOrdenarSustitutoria.tsx
 * Responsabilidad: `HACER-04` — dejar constancia de que la DME ORDENÓ la EJECUCIÓN SUSTITUTORIA:
 *   que la Administración ejecute el correctivo por su cuenta y A COSTA DEL OBLIGADO.
 *   `POST /obligacion-hacer/:eejeId/sustitutoria`.
 *
 *   ── ES LA ORDEN, NO LA DILIGENCIA ────────────────────────────────────────────────────────────
 *   Aquí consta que la DME lo DISPUSO. Quién fue al predio, cuándo, con qué medios y con qué acta
 *   es el otro acto —«Registrar la diligencia»—, y el costo que de ahí sale es el tercero
 *   —«Registrar los gastos»—. Los tres son pasos distintos del mismo camino y el expediente los
 *   cuenta por separado a propósito.
 *
 *   ── 🔴 LA ADVERTENCIA DE LAS TRES MULTAS NO BLOQUEA, Y NO PUEDE BLOQUEAR ─────────────────────
 *   El art. 240 del COA prevé una serie de TRES multas compulsorias antes de llegar a la
 *   sustitutoria, y el servidor AVISA si no constan. **Avisa y registra igual, en los cuatro casos
 *   (0, 1, 2 y 3 multas).** La serie de tres DESCRIBE la escalada que la norma prevé; no es una
 *   precondición que el módulo pueda hacer cumplir —puede haber riesgo inminente, orden judicial o
 *   multas impuestas fuera del módulo—, y el acto lo firma el decisor, no el software. Convertir
 *   ese aviso en una puerta cerrada aquí sería reimplementar en pantalla una regla que el servidor
 *   decidió NO tener.
 *
 *   ── EL MODAL NO DECIDE SI LA ACCIÓN PROCEDE ──────────────────────────────────────────────────
 *   🔴 Lo decidió el motor de reglas antes de ofrecer el botón (`ordenarSustitutoria` exige
 *   `tiene === true` y `cumplida === false`, Plan 04). Aquí no se lee el estado del EPAS.
 *
 *   ── SIN PANTALLA DE CONFIRMACIÓN (quick 261014-dmc) ──────────────────────────────────────────
 *   «Ordenar la sustitutoria» ejecuta el acto directamente desde el formulario. Antes había un paso intermedio
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
 */
import { useState } from "react";
import { useCierreModal } from "../../hooks/useCierreModal";
import Alert from "../common/Alert";
import { useToast } from "../../hooks/useToast";
import { ObligacionHacerService } from "../../services/ObligacionHacerService";
import AvisosDeActo from "./AvisosDeActo";
import SelectorDocumentoExpediente from "./SelectorDocumentoExpediente";
import {
  describirAdministrado,
  describirExpediente,
  mensajeDeError,
  type PropsModalRama,
} from "./comunes";
import type { Advertencia } from "../../interfaces/IObligacionHacer";

/** Mismo valor que el nombre de acción declarado en `POLITICA_ACCIONES` (Plan 04). */
export const MODAL_KEY = "ordenarSustitutoria" as const;

/** `@MaxLength(300)` de `OrdenarSustitutoriaDto.motivo`. */
const MOTIVO_MAXIMO = 300;

const ModalOrdenarSustitutoria = ({
  caseData,
  onClose,
  refetchFn,
}: PropsModalRama) => {
  const { addToast } = useToast();
  const { eejeId } = caseData;

  const [docId, setDocId] = useState<number | null>(null);
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<{
    multasCompulsoriasRegistradas: number;
    advertencias?: Advertencia[];
  } | null>(null);

  // Cierre al pulsar fuera (quick 261019-mcf): lo capturado es trabajo sin guardar hasta que hay
  // resultado.
  useCierreModal({
    hayCambios: !resultado && (docId !== null || motivo.trim() !== ""),
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
  const puedeContinuar = docId != null;

  const ordenar = async () => {
    if (enviando) return;
    if (docId == null) return;
    setEnviando(true);
    try {
      const texto = motivo.trim();
      const respuesta = await ObligacionHacerService.ordenarSustitutoria(
        eejeId,
        { docId, ...(texto ? { motivo: texto } : {}) },
      );

      addToast(
        "success",
        `Ejecución sustitutoria ordenada en el expediente ${expediente}.`,
      );
      if (refetchFn) await refetchFn();

      // 🔴 EL ACTO YA SE REGISTRÓ. Se pasa a la pantalla de resultado siempre: aunque no haya
      // avisos, el número de multas que constan es el dato del que sale la escalada y el decisor
      // acaba de firmarla. Cerrar en silencio le quitaría la única vez que lo tiene delante.
      setResultado(respuesta);
    } catch (error) {
      addToast(
        "error",
        mensajeDeError(
          error,
          "No se pudo ordenar la ejecución sustitutoria.",
        ),
      );
    } finally {
      setEnviando(false);
    }
  };

  if (resultado) {
    return (
      <div className="modal-box max-w-2xl">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="app-modules-modal-kicker">
              Ejecución — DME · Ejecución sustitutoria
            </p>
            <h3 className="text-lg font-semibold">
              La orden quedó registrada
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

        <div className="mt-3 rounded-lg border border-base-300 p-3 text-sm">
          <p>
            Constan{" "}
            <strong>{resultado.multasCompulsoriasRegistradas}</strong> multas
            compulsorias en el expediente {expediente}.
          </p>
          <p className="mt-1 opacity-70">
            A partir de aquí la Administración puede ejecutar el correctivo a
            costa del obligado: lo siguiente es registrar la diligencia con su
            acta y, si se ejecutó, trasladar su costo.
          </p>
        </div>

        <AvisosDeActo
          advertencias={resultado.advertencias}
          queSeRegistro={`La orden de ejecución sustitutoria del expediente ${expediente} quedó registrada`}
        />

        <div className="modal-action">
          {/* El acto YA está registrado: no hay vuelta al formulario. «La ficha» porque
              este modal solo se abre desde la página de la obligación de hacer. */}
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
            Ejecución — DME · Ejecución sustitutoria
          </p>
          <h3 className="text-lg font-semibold">
            Ordenar la ejecución sustitutoria
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
            "Ordenar la sustitutoria habilita a la Administración a ejecutar el correctivo por sí " +
            "misma y a cobrarle el costo al obligado: se le traslada con el recargo del art. 239, " +
            "cobrable por coactiva. Es la ORDEN: la diligencia en el predio y su costo se registran " +
            "después, cada uno con su acto."
          }
        />

        <SelectorDocumentoExpediente
          eejeId={eejeId}
          valor={docId}
          onChange={(elegido) => setDocId(elegido)}
          etiqueta="Providencia que ordena la sustitutoria (obligatorio)"
          ayuda="Normalmente la providencia de EJECUCIÓN SUSTITUTORIA ya emitida, o el documento que la soporta. Sin señalar el acto que lo dispone, se estaría firmando en el aire."
        />

        <label className="flex flex-col gap-1">
          <span className="font-medium">Motivo (opcional)</span>
          <textarea
            className="textarea textarea-bordered w-full"
            rows={3}
            maxLength={MOTIVO_MAXIMO}
            value={motivo}
            placeholder="Contexto para quien lea el expediente después (por ejemplo, por qué se adelanta la sustitutoria)"
            disabled={enviando}
            onChange={(e) => setMotivo(e.target.value)}
          />
          <span className="text-sm opacity-70">
            Va a la bitácora del acto, no a una columna. Máximo {MOTIVO_MAXIMO}{" "}
            caracteres; quedan {MOTIVO_MAXIMO - motivo.length}.
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
          onClick={ordenar}
        >
          {enviando ? "Ordenando…" : "Ordenar la sustitutoria"}
        </button>
      </div>
    </div>
  );
};

export default ModalOrdenarSustitutoria;
