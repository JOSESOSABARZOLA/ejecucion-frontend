/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/obligacion-hacer (frontend)
 * Feature: La rama del correctivo en pantalla — tramo de la ESCALADA (Fase 03.18, Plan 06)
 * Archivo: ModalRegistrarDiligencia.tsx
 * Responsabilidad: `HACER-04` — registrar la DILIGENCIA FÍSICA de la ejecución sustitutoria: el
 *   desmontaje, el derrocamiento o el retiro que la cuadrilla ejecutó —o intentó ejecutar— sobre el
 *   predio, con su acta. `POST /obligacion-hacer/:eejeId/diligencia`.
 *
 *   ── 🔴 EL ACTA OBLIGATORIA ES DECISIÓN DEL PROYECTO, NO DE LA NORMA (C-06 / D-09) ────────────
 *   La actividad 14 del `PRO-GEJ-001` es la ÚNICA actividad del procedimiento cuya columna
 *   DOCUMENTO está VACÍA, y el anexo 8.1 no codifica ningún «acta de diligencia». Aquí se endurece
 *   POR ENCIMA de la norma, a sabiendas, y por una razón concreta: este acto termina cobrándose a
 *   una persona por vía coactiva, y lo que se cobra tiene que poder enseñar el papel que lo
 *   sustenta.
 *
 *   La pantalla lo DICE con ese lenguaje, y no por escrúpulo: la diferencia entre «la norma me
 *   obliga» y «aquí decidimos que sin papel no hay fila» es la diferencia entre una conversación
 *   honesta con el área usuaria y una en la que el sistema se escuda en un requisito inventado. El
 *   día que la DME quiera discutirlo, tiene que poder discutirlo con el dato correcto delante.
 *
 *   ── 🔴 `FALLIDA` NO ES UN ERROR, ES UN RESULTADO (D-10, T-0318-26) ───────────────────────────
 *   Una cuadrilla que fue y no pudo entrar produce un acto IGUAL DE VÁLIDO. Se espera FRECUENTE, y
 *   por eso se modela como caso normal y no como excepción. Es además lo ÚNICO que sirve si el
 *   administrado alega más tarde que nunca fue nadie a su predio. Presentarlo con tono de error
 *   conseguiría que el decisor no lo registrara, y entonces el expediente perdería justo la prueba
 *   que protege a la Administración. Aquí las tres opciones se pintan iguales.
 *
 *   ── EL MODAL NO DECIDE SI LA ACCIÓN PROCEDE ──────────────────────────────────────────────────
 *   🔴 `registrarDiligencia` NO se condiciona sobre `sustitutoriaOrdenada` (Plan 04), porque el
 *   backend ante esa situación AVISA y NUNCA BLOQUEA. Aquí tampoco. Ni se lee el estado del EPAS.
 *
 *   ── SIN PANTALLA DE CONFIRMACIÓN (quick 261014-dmc) ──────────────────────────────────────────
 *   «Registrar la diligencia» ejecuta el acto directamente desde el formulario. Antes había un paso intermedio
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
import {
  TIPO_PDF,
  describirAdministrado,
  describirExpediente,
  mensajeDeError,
  validarPdf,
  type PropsModalRama,
} from "./comunes";
import type {
  Advertencia,
  ResultadoDiligencia,
} from "../../interfaces/IObligacionHacer";

/** Mismo valor que el nombre de acción declarado en `POLITICA_ACCIONES` (Plan 04). */
export const MODAL_KEY = "registrarDiligencia" as const;

/** `@MinLength(10)` de `RegistrarDiligenciaDto.motivo`. */
const MOTIVO_MINIMO = 10;
/** `@MaxLength(300)` del mismo campo. */
const MOTIVO_MAXIMO = 300;

/**
 * Los TRES resultados, cada uno con su explicación a la vista y **ninguno con tono de error**.
 *
 * 🔴 No hay un tipo de acto distinto por desenlace, y es deliberado: el expediente tiene que poder
 * mostrar LOS INTENTOS EN ORDEN y por qué acabó cada uno. «Se fue tres veces y a la tercera se
 * ejecutó» es una sola serie ordenada, no tres tablas que alguien tenga que unir por fecha.
 */
const RESULTADOS: ReadonlyArray<{
  resultado: ResultadoDiligencia;
  titulo: string;
  explicacion: string;
}> = [
  {
    resultado: "EJECUTADA",
    titulo: "EJECUTADA — la Administración ejecutó el correctivo",
    explicacion:
      "La cuadrilla entró y ejecutó el correctivo a costa del obligado. Es el único resultado que " +
      "genera costo trasladable al administrado (art. 239 del COA): los otros dos no producen gasto " +
      "que cobrar.",
  },
  {
    resultado: "FALLIDA",
    titulo: "FALLIDA — la cuadrilla fue y no pudo",
    explicacion:
      "Acceso negado o imposibilidad material. Es un resultado NORMAL y frecuente, no un fallo del " +
      "sistema ni un error suyo: el acto vale igual, y su registro es lo único que sirve si el " +
      "administrado alega después que nunca fue nadie a su predio. Registre el intento.",
  },
  {
    resultado: "INNECESARIA",
    titulo: "INNECESARIA — el administrado cumplió antes",
    explicacion:
      "El administrado cumplió antes de que llegara la cuadrilla. No genera costo, y se registra " +
      "igual: la salida se produjo y el expediente tiene que poder contarla.",
  },
];

const ModalRegistrarDiligencia = ({
  caseData,
  onClose,
  refetchFn,
}: PropsModalRama) => {
  const { addToast } = useToast();
  const { eejeId } = caseData;

  const [resultado, setResultado] = useState<ResultadoDiligencia | "">("");
  const [motivo, setMotivo] = useState("");
  const [acta, setActa] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [registrada, setRegistrada] = useState<{
    dsusId: number;
    docId: number;
    advertencias?: Advertencia[];
  } | null>(null);

  // Cierre al pulsar fuera (quick 261019-mcf): lo capturado es trabajo sin guardar hasta que queda
  // registrada.
  useCierreModal({
    hayCambios:
      !registrada &&
      (resultado !== "" || motivo.trim() !== "" || acta !== null),
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

  const elegido = RESULTADOS.find((r) => r.resultado === resultado) ?? null;
  const motivoLimpio = motivo.trim();
  const motivoValido = motivoLimpio.length >= MOTIVO_MINIMO;
  const avisoMotivo =
    motivo !== "" && !motivoValido
      ? `El relato tiene que explicar qué pasó: mínimo ${MOTIVO_MINIMO} caracteres (lleva ${motivoLimpio.length}).`
      : null;

  // 🔴 SE VALIDA ANTES DE ENVIAR. El backend vuelve a comprobarlo y es él quien manda; esto existe
  // para que el decisor se entere EN EL FORMULARIO y no tras cuarenta segundos de subida.
  const avisoActa = acta ? validarPdf(acta, "El acta de la diligencia") : null;
  const puedeContinuar = !!elegido && motivoValido && !!acta && !avisoActa;

  const registrar = async () => {
    if (enviando) return;
    if (!elegido || !acta) return;
    setEnviando(true);
    try {
      const respuesta = await ObligacionHacerService.registrarDiligencia(
        eejeId,
        { resultado: elegido.resultado, motivo: motivoLimpio },
        acta,
      );

      addToast(
        "success",
        `Diligencia de ejecución sustitutoria (${elegido.resultado}) registrada en el expediente ${expediente}.`,
      );
      if (refetchFn) await refetchFn();

      // 🔴 EL ACTO YA SE REGISTRÓ. La pantalla de resultado canta el acta creada y, si el servidor
      // avisó de que no consta la providencia que ordena la sustitutoria, lo PINTA — no lo impide.
      setRegistrada(respuesta);
    } catch (error) {
      addToast(
        "error",
        mensajeDeError(
          error,
          "No se pudo registrar la diligencia de ejecución sustitutoria.",
        ),
      );
    } finally {
      setEnviando(false);
    }
  };

  if (registrada) {
    return (
      <div className="modal-box max-w-2xl">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="app-modules-modal-kicker">
              Ejecución — DME · Diligencia de la sustitutoria
            </p>
            <h3 className="text-lg font-semibold">
              La diligencia quedó registrada
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
            Acto <strong>#{registrada.dsusId}</strong> del expediente{" "}
            {expediente}, con su acta incorporada como documento{" "}
            <strong>{registrada.docId}</strong>.
          </p>
        </div>

        <AvisosDeActo
          advertencias={registrada.advertencias}
          queSeRegistro={`La diligencia del expediente ${expediente} quedó registrada con su acta`}
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
            Ejecución — DME · Diligencia de la sustitutoria
          </p>
          <h3 className="text-lg font-semibold">
            Registrar la diligencia de ejecución sustitutoria
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
            "Es la salida física al predio: lo que la cuadrilla hizo, o intentó hacer. Los tres " +
            "resultados valen lo mismo para el expediente — lo que no vale es una salida que no " +
            "conste."
          }
        />

        <fieldset className="flex flex-col gap-2">
          <legend className="font-medium">Cómo acabó la diligencia</legend>
          {RESULTADOS.map((opcion) => (
            <label
              key={opcion.resultado}
              className="flex cursor-pointer items-start gap-2 rounded-lg border border-base-300 p-2"
            >
              <input
                type="radio"
                className="radio radio-sm mt-1"
                name="resultado-diligencia"
                value={opcion.resultado}
                checked={resultado === opcion.resultado}
                disabled={enviando}
                onChange={() => setResultado(opcion.resultado)}
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

        <label className="flex flex-col gap-1">
          <span className="font-medium">Qué pasó (obligatorio)</span>
          <textarea
            className="textarea textarea-bordered w-full"
            rows={3}
            maxLength={MOTIVO_MAXIMO}
            value={motivo}
            placeholder="Qué se ejecutó, o por qué no se pudo: quién impidió el acceso, qué se encontró en el predio"
            disabled={enviando}
            onChange={(e) => setMotivo(e.target.value)}
          />
          {avisoMotivo ? (
            <span className="text-sm text-error">{avisoMotivo}</span>
          ) : (
            <span className="text-sm opacity-70">
              Mínimo {MOTIVO_MINIMO} caracteres, máximo {MOTIVO_MAXIMO}. En un
              intento que no prosperó, este relato ES el contenido del acto.
            </span>
          )}
        </label>

        <label className="flex flex-col gap-1">
          <span className="font-medium">
            Acta de la diligencia (PDF, obligatoria)
          </span>
          <input
            type="file"
            accept={TIPO_PDF}
            className="file-input file-input-bordered w-full"
            disabled={enviando}
            onChange={(e) => setActa(e.target.files?.[0] ?? null)}
          />
          {avisoActa ? (
            <span className="text-sm text-error">{avisoActa}</span>
          ) : (
            <span className="text-sm opacity-70">
              Solo PDF, hasta 10 MB. El nombre con que se guarda lo pone el
              sistema.
            </span>
          )}
          {/* 🔴 El lenguaje importa: se dice de quién es la exigencia. */}
          <span className="text-sm opacity-80">
            El acta la exige <strong>el proyecto</strong>, no el procedimiento:
            la actividad 14 del PRO-GEJ-001 es la única cuya columna de documento
            está vacía, y aquí se endurece a propósito. La razón es que el costo
            de esta diligencia puede acabar cobrándose por coactiva, y lo que se
            cobra tiene que poder enseñar el papel que lo sustenta. Sin acta no
            hay fila.
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
          {enviando ? "Registrando… (puede tardar)" : "Registrar la diligencia"}
        </button>
      </div>
    </div>
  );
};

export default ModalRegistrarDiligencia;
