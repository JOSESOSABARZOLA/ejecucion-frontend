/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/multas-compulsorias (frontend)
 * Feature: Historial de multas compulsorias del expediente (2026-09-03)
 * Archivo: MultasCompulsoriasExpediente.tsx
 * Responsabilidad: Ver la SERIE de multas compulsorias de un expediente y registrar una nueva con la
 *   resolución que la impuso.
 *
 *   ── ESTO NO IMPONE LA MULTA ──────────────────────────────────────────────────────────────────
 *   La impone una resolución de la DME, fuera de esta pantalla. Aquí se REGISTRA lo que esa
 *   resolución dice —su número, su fecha y su valor— y se adjunta el PDF. Por eso el botón dice
 *   «Registrar» y el valor se teclea: lo fija la resolución, el sistema no lo calcula (decisión del
 *   área usuaria, 2026-09-03).
 *
 *   El ORDINAL —1.ª, 2.ª, 3.ª— no se pide: lo deriva el servidor del orden de la serie, que es el
 *   mismo número que la providencia imprime en su cabecera. Si se tecleara, un día dirían cosas
 *   distintas el expediente y el documento notificado.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-09-03
 * Modificado por: Andrés Miño — 2026-10-28 (quick 261028-kmg: el fallo al cargar la serie se dice en
 *   su hueco, con «Reintentar» y sin afirmar que no hay multas; lo que falta del formulario se dice
 *   bajo cada campo, con aria-invalid y el foco en el primero; el fallo al registrar sigue en el
 *   aviso flotante)
 * Modificado por: Andrés Miño — 2026-11-05 (quick 261105-cvq — la serie se pinta con `formatearUsd`
 *   y la casilla «Valor (USD)» es de texto con teclado decimal y se lee con `parsearImporte`:
 *   «1.250,50» llega como 1250.5 y «1250.50» se rechaza bajo el campo con un ejemplo)
 */
import { mensajeParaUsuario } from "../../api/mensajeParaUsuario";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useToast } from "../../hooks/useToast";
import Alert from "../common/Alert";
import Boton from "../common/Boton";
import Loading from "../common/Loading";
import {
  MultaCompulsoriaService,
  type MultaCompulsoria,
} from "../../services/MultaCompulsoriaService";
import { DatetimeUtil } from "../../utils/datetime.util";
import { formatearUsd, parsearImporte } from "../../utils/importe.util";

interface Props {
  eejeId: number;
  /**
   * Solo el decisor del expediente registra; el resto ve la serie. Lo impone el backend.
   *
   * 🔴 ESTE COMPONENTE NO LO DECIDE, LO RECIBE. Lo resuelve el MOTOR de acciones con la regla de
   * `registrarMultaCompulsoria`, sobre el hecho que el backend deriva. Deducirlo aquí sería tener
   * dos versiones de la misma regla, y un día dirían cosas distintas.
   */
  permiteRegistrar?: boolean;
  /**
   * POR QUÉ no se puede registrar. Se muestra en el tooltip del botón APAGADO.
   *
   * 🔴 APAGAR Y NO ESCONDER (D-7, criterio de toda la Fase 03.18). Hasta hoy el botón desaparecía
   * cuando el permiso era falso; ahora se queda a la vista, apagado y con su porqué. Un botón que se
   * esfuma deja al funcionario buscando una opción que ayer estaba, sin la pregunta de qué haría
   * falta para recuperarla.
   *
   * 🔴 Y EL TEXTO VIENE DE FUERA. Lo pone quien apagó la acción —el catálogo de motivos del motor—;
   * redactarlo aquí sería una tercera fuente de verdad para una regla que ya tiene dueño.
   */
  motivoNoRegistrar?: string;
}

const ORDINALES = [
  "1.ª",
  "2.ª",
  "3.ª",
  "4.ª",
  "5.ª",
  "6.ª",
  "7.ª",
  "8.ª",
  "9.ª",
];

/** El ordinal en letra corta; a partir del noveno, el número a secas. */
const ordinal = (n: number) => ORDINALES[n - 1] ?? `${n}.ª`;

/** Los campos del formulario que pueden faltar, en el orden en que se pintan (el foco va al primero). */
type CampoMulta = "numero" | "fecha" | "valor" | "archivo";
type ErroresMulta = Partial<Record<CampoMulta, string>>;
const ORDEN_CAMPOS: CampoMulta[] = ["numero", "fecha", "valor", "archivo"];

/** El valor escrito no es un importe en formato ecuatoriano (p. ej. «1250.50»). */
const MENSAJE_FORMATO_VALOR =
  "Escriba el valor en dólares con coma para los centavos, por ejemplo 1.250,50 (el punto separa los miles).";

export const MultasCompulsoriasExpediente = ({
  eejeId,
  permiteRegistrar = false,
  motivoNoRegistrar,
}: Props) => {
  const { addToast } = useToast();

  const [serie, setSerie] = useState<MultaCompulsoria[]>([]);
  const [cargando, setCargando] = useState(true);
  const [abierto, setAbierto] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const [resolucionNumero, setResolucionNumero] = useState("");
  const [resolucionFecha, setResolucionFecha] = useState("");
  const [valor, setValor] = useState("");
  const [archivo, setArchivo] = useState<File | null>(null);
  /**
   * Fallo al CARGAR la serie: se dice en su hueco, con «Reintentar», y mientras falla no se afirma
   * que el expediente no tiene multas (regla 3b de 261028-kmg).
   */
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  /** Errores de CAMPO del formulario: bajo cada control; se retiran al editarlo. */
  const [errores, setErrores] = useState<ErroresMulta>({});
  const idBase = useId();
  const idError = (campo: CampoMulta) => `${idBase}-error-${campo}`;
  const refs = {
    numero: useRef<HTMLInputElement>(null),
    fecha: useRef<HTMLInputElement>(null),
    valor: useRef<HTMLInputElement>(null),
    archivo: useRef<HTMLInputElement>(null),
  };
  const quitarError = (campo: CampoMulta) =>
    setErrores((previos) => {
      if (!previos[campo]) return previos;
      const siguientes = { ...previos };
      delete siguientes[campo];
      return siguientes;
    });
  /** Las props de accesibilidad del control de un campo con su posible error. */
  const aria = (campo: CampoMulta) =>
    errores[campo]
      ? { "aria-invalid": true, "aria-describedby": idError(campo) }
      : {};
  const lineaError = (campo: CampoMulta) =>
    errores[campo] ? (
      <span id={idError(campo)} className="text-sm text-error">
        {errores[campo]}
      </span>
    ) : null;

  const cargar = useCallback(async () => {
    setCargando(true);
    setErrorCarga(null);
    try {
      setSerie(await MultaCompulsoriaService.serie(eejeId));
    } catch (err) {
      setErrorCarga(
        mensajeParaUsuario(err, "No se pudieron cargar las multas compulsorias."),
      );
    } finally {
      setCargando(false);
    }
  }, [eejeId]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const limpiar = () => {
    setResolucionNumero("");
    setResolucionFecha("");
    setValor("");
    setArchivo(null);
    setErrores({});
    setAbierto(false);
  };

  const registrar = async () => {
    // Formato ecuatoriano (quick 261105-cvq): «1.250,50» ⇒ 1250.5; «1250.50» no se reinterpreta.
    const importeNumerico = parsearImporte(valor);
    const faltan: ErroresMulta = {};
    if (!resolucionNumero.trim()) {
      faltan.numero = "Escriba el número de la resolución.";
    }
    if (!resolucionFecha) faltan.fecha = "Indique la fecha de la resolución.";
    if (valor.trim() !== "" && importeNumerico === undefined) {
      faltan.valor = MENSAJE_FORMATO_VALOR;
    } else if (importeNumerico === undefined || importeNumerico <= 0) {
      faltan.valor = "El valor de la multa debe ser mayor que cero.";
    }
    if (!archivo) faltan.archivo = "Adjunte el PDF de la resolución.";
    setErrores(faltan);
    const primero = ORDEN_CAMPOS.find((campo) => faltan[campo]);
    if (primero || !archivo || importeNumerico === undefined) {
      if (primero) refs[primero].current?.focus();
      return;
    }

    setGuardando(true);
    try {
      await MultaCompulsoriaService.registrar(
        eejeId,
        {
          resolucionNumero: resolucionNumero.trim(),
          resolucionFecha,
          valor: importeNumerico,
        },
        archivo,
      );
      addToast("success", "Multa compulsoria registrada");
      limpiar();
      await cargar();
    } catch (err) {
      addToast(
        "error",
        mensajeParaUsuario(err, "No se pudo registrar la multa compulsoria."),
      );
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium">Multas compulsorias</span>
        {/* 🔴 EL BOTÓN NO DESAPARECE CUANDO NO PROCEDE: se apaga con su motivo (D-7). El `<span>`
            con el título no es adorno — un botón deshabilitado no recibe eventos de puntero y su
            propio tooltip nunca llegaría a mostrarse.

            🔴 Y EL TÉRMINO VENCIDO **HABILITA** LA MULTA, **NO LA DISPARA** (frase del propio
            backend). No hay job, no hay planificador y nadie emite nada por su cuenta: un botón
            encendido no es una orden. La multa la impone una resolución de la DME fuera de esta
            pantalla, y aquí sólo se REGISTRA lo que esa resolución dice. */}
        {!abierto && (
          <span
            title={permiteRegistrar ? undefined : motivoNoRegistrar}
            className="inline-flex"
          >
            <Boton
              estilos="btn btn-sm"
              texto="Registrar multa"
              deshabilitado={cargando || !permiteRegistrar}
              onClick={() => setAbierto(true)}
            />
          </span>
        )}
      </div>

      {cargando && <Loading />}

      {!cargando && errorCarga && (
        <Alert
          variant="error"
          message={errorCarga}
          buttonFunction={() => void cargar()}
        />
      )}

      {!cargando && !errorCarga && serie.length === 0 && (
        <span className="text-sm opacity-70">
          Este expediente no tiene multas compulsorias registradas.
        </span>
      )}

      {!cargando && !errorCarga && serie.length > 0 && (
        <div className="overflow-x-auto">
          <table className="table table-sm">
            <thead>
              <tr>
                <th>#</th>
                <th>Resolución</th>
                <th>Fecha</th>
                <th className="text-right">Valor</th>
                <th>N.º orden de pago</th>
                <th>Documento</th>
              </tr>
            </thead>
            <tbody>
              {serie.map((multa) => (
                <tr key={multa.mcomId}>
                  <td>{ordinal(multa.ordinal)}</td>
                  <td className="font-mono">{multa.resolucionNumero}</td>
                  <td>{DatetimeUtil.formatDate(multa.resolucionFecha)}</td>
                  <td className="text-right font-mono">
                    {formatearUsd(multa.valor)}
                  </td>
                  <td className="font-mono">
                    {/* La orden de CADA multa, no la del expediente: son distintas y el
                        administrado paga cada una por la suya. */}
                    {multa.orden?.numero ?? (
                      <span className="opacity-60">Pendiente</span>
                    )}
                  </td>
                  <td>
                    {multa.docUrl ? (
                      <a
                        className="link"
                        href={multa.docUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Ver resolución
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {abierto && (
        <div className="flex flex-col gap-2 rounded-lg border border-base-300 p-3">
          <span className="text-sm opacity-70">
            Registre la resolución de la DME que impone la multa. El ordinal lo
            pone el sistema por la fecha de resolución.
          </span>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <label className="flex flex-col gap-1">
              <span className="text-sm">N.º de resolución</span>
              <input
                ref={refs.numero}
                className={`input input-bordered input-sm${errores.numero ? " input-error" : ""}`}
                placeholder="GADDMQ-AMC-DME-2026-000"
                value={resolucionNumero}
                disabled={guardando}
                onChange={(e) => {
                  setResolucionNumero(e.target.value);
                  quitarError("numero");
                }}
                {...aria("numero")}
              />
              {lineaError("numero")}
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm">Fecha de la resolución</span>
              <input
                ref={refs.fecha}
                type="date"
                className={`input input-bordered input-sm${errores.fecha ? " input-error" : ""}`}
                value={resolucionFecha}
                disabled={guardando}
                onChange={(e) => {
                  setResolucionFecha(e.target.value);
                  quitarError("fecha");
                }}
                {...aria("fecha")}
              />
              {lineaError("fecha")}
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm">Valor (USD)</span>
              {/* Texto con teclado decimal, no el tipo numérico del navegador: ése no acepta
                  «1.234,56» de forma fiable y puede leer «1.234» como 1,234 (quick 261105-cvq). */}
              <input
                type="text"
                inputMode="decimal"
                autoComplete="off"
                placeholder="1.250,50"
                ref={refs.valor}
                className={`input input-bordered input-sm${errores.valor ? " input-error" : ""}`}
                value={valor}
                disabled={guardando}
                onChange={(e) => {
                  setValor(e.target.value);
                  quitarError("valor");
                }}
                {...aria("valor")}
              />
              {lineaError("valor")}
            </label>
          </div>
          <label className="flex flex-col gap-1">
            <span className="text-sm">Resolución escaneada (PDF)</span>
            <input
              ref={refs.archivo}
              type="file"
              accept="application/pdf"
              className={`file-input file-input-bordered file-input-sm w-full${errores.archivo ? " file-input-error" : ""}`}
              disabled={guardando}
              onChange={(e) => {
                setArchivo(e.target.files?.[0] ?? null);
                quitarError("archivo");
              }}
              {...aria("archivo")}
            />
            {lineaError("archivo")}
          </label>
          <div className="flex justify-end gap-2">
            <Boton
              estilos="btn btn-sm btn-ghost"
              texto="Cancelar"
              deshabilitado={guardando}
              onClick={limpiar}
            />
            <Boton
              estilos="btn btn-sm btn-primary"
              texto={guardando ? "Registrando…" : "Registrar"}
              deshabilitado={guardando}
              onClick={() => void registrar()}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default MultasCompulsoriasExpediente;
