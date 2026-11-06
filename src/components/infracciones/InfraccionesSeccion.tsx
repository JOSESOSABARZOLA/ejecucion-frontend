/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/infracciones (frontend)
 * Feature: La infracción manda — la pestaña «Infracciones» de la ficha (Fase 03.23, Plan 13, D-16/D-08)
 * Archivo: InfraccionesSeccion.tsx
 * Responsabilidad: Pintar, dentro de la ficha del expediente (la misma desde las dos bandejas), la
 *   lista de infracciones del EPAS —código, base legal (referencia y tipificación de CORE), materia y
 *   submateria deducidas, sanción, multa, si admite trabajo comunitario y por qué no, y la
 *   obligación de hacer—, el estado de la lectura de CORE con
 *   su fecha, los avisos que calculó el servidor y el resumen de la multa y de lo compensable.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-10-16
 *
 * ── 🔴 PEDIR LA FICHA ES EL «USO» QUE REFRESCA CORE (D-08) ────────────────────────────────────
 * `GET /epas/:eejeId/infracciones` vuelve a leer CORE (con el TTL y la deduplicación del servidor).
 * Por eso este componente se monta SOLO cuando la pestaña está activa: la ficha sigue sin pedir nada
 * al abrirse, y CORE no se consulta por cada ojo que se pulsa en una bandeja. Si CORE no responde,
 * el servidor devuelve la última lectura con un aviso (`CORE_NO_DISPONIBLE`), y aquí se pinta tal
 * cual: no es un error de la ficha.
 *
 * ── 🔴 ESTA PESTAÑA NO DECIDE NADA. TRADUCE ───────────────────────────────────────────────────
 * `admiteTc`, `motivoNoAdmite`, `alertas` y `evaluacionTc` llegan decididos del servidor, que es el
 * único que conoce la foto de CORE y la regla de aptitud (T-03.23-16). Lo único que se hace aquí es
 * elegir el COLOR de cada aviso y no repetir en el resumen un motivo que ya se dijo como aviso.
 *
 * ── LA BANDERA `vivo` ─────────────────────────────────────────────────────────────────────────
 * Mismo patrón que las observaciones de la ficha: si se cambia de pestaña o se cierra la ficha antes
 * de que el servidor conteste, la respuesta se descarta en vez de escribir sobre un componente que
 * ya no existe.
 * Modificado por: Andrés Miño — 2026-11-04 (quick 261104-jh1: la materia y la submateria son las de
 *   Sorteo; una fila sin materia dice «Sin materia», la cabecera `Materia:` lo añade con
 *   `etiquetaConSinMateria`, y la alerta SIN_MATERIA se pinta como las demás)
 * Modificado por: Andrés Miño — 2026-11-05 (quick 261105-cvq — los importes con `formatearUsd`,
 *   «USD 920,00»; el hueco sin dato se conserva)
 * Modificado por: Andrés Miño — 2026-11-06 (quick 261106-bo0: columna «Base legal» con la referencia
 *   y la tipificación de CORE)
 * Modificado por: Andrés Miño — 2026-11-06 (los textos largos de CORE —sanción de más de 1000
 *   caracteres, obligación de hacer, tipificación— se recortan a tres líneas con «Ver más»; las
 *   celdas se alinean arriba y las columnas de texto tienen ancho mínimo, para que la fila no se
 *   vuelva una columna altísima con el resto de celdas fuera de la vista)
 */
import { useEffect, useState, type FC } from "react";
import Alert, { type AlertVariant } from "../common/Alert";
import { formatearUsd } from "../../utils/importe.util";
import { referenciaLegal } from "../../utils/baseLegal.util";
import { DatetimeUtil } from "../../utils/datetime.util";
import {
  ETIQUETA_SIN_MATERIA,
  etiquetaConSinMateria,
} from "../../utils/materia.util";
import {
  ETIQUETA_ESTADO_CORE,
  InfraccionesService,
  type CodigoAlertaInfracciones,
  type FichaInfracciones,
  type InfraccionFicha,
  type TipoPersona,
} from "../../services/InfraccionesService";

type InfraccionesSeccionProps = {
  /** El EPAS aterrizado cuya ficha de infracciones se pide. */
  eejeId: number;
};

/** Hueco VISIBLE de un dato que el servidor no trae. Nunca se inventa nada. */
const SIN_DATO = "—";

const MENSAJE_ERROR = "No se pudieron cargar las infracciones del expediente.";

/**
 * El color de cada aviso. Es PRESENTACIÓN, no regla: qué avisos hay y qué dicen lo decide el
 * servidor. El conflicto es lo más grave —nada de lo que se deduzca de los códigos es fiable hasta
 * aclararlo—; lo que espera a CORE o no tiene infracciones es informativo.
 */
const VARIANTE_ALERTA: Record<CodigoAlertaInfracciones, AlertVariant> = {
  PENDIENTE_CORE: "info",
  SIN_INFRACCIONES: "info",
  CONFLICTO_CODIGOS: "error",
  DESCUADRE: "warning",
  SIN_MATERIA: "warning",
  CORE_NO_DISPONIBLE: "warning",
  CORE_CAMBIO_TRAS_SELLO: "warning",
  IDENTIFICACION_NO_RECONOCIDA: "warning",
};

/** El tipo de persona en palabras: explica por qué una infracción «solo persona natural» no suma. */
const ETIQUETA_TIPO_PERSONA: Record<TipoPersona, string> = {
  NATURAL: "Persona natural",
  SOCIEDAD: "Sociedad",
  PUBLICA: "Entidad pública",
};

/** Lo que contestó el servidor, atado al expediente por el que se preguntó. */
type Resultado = {
  eejeId: number;
  ficha: FichaInfracciones | null;
  error: string | null;
};

/** A partir de este largo un texto de CORE se recorta a tres líneas con «Ver más». */
const LARGO_PARA_RECORTAR = 160;

/**
 * Un texto de CORE que puede ser muy largo (la sanción pasa de 1000 caracteres): entero si es corto;
 * si no, recortado a tres líneas con un botón «Ver más» / «Ver menos». Texto plano: React lo escapa.
 */
const TextoLargo: FC<{ texto: string; className?: string }> = ({
  texto,
  className,
}) => {
  const [abierto, setAbierto] = useState(false);
  if (texto.length <= LARGO_PARA_RECORTAR) {
    return <span className={className}>{texto}</span>;
  }
  return (
    <div className="flex flex-col items-start gap-1">
      <span className={`${className ?? ""} ${abierto ? "" : "line-clamp-3"}`}>
        {texto}
      </span>
      <button
        type="button"
        className="link link-primary text-xs"
        aria-expanded={abierto}
        onClick={() => setAbierto((v) => !v)}
      >
        {abierto ? "Ver menos" : "Ver más"}
      </button>
    </div>
  );
};

/** Un importe del servidor, o el hueco visible si no lo hay. */
const importe = (valor: number | null): string =>
  valor == null ? SIN_DATO : formatearUsd(valor);

/**
 * La celda «Base legal» (quick 261106-bo0): la referencia («Art. 316, num. 1») y, debajo y en
 * pequeño, la tipificación; el hueco visible si no hay ninguna. Texto plano: React lo escapa.
 */
const BaseLegal: FC<{ inf: InfraccionFicha }> = ({ inf }) => {
  const referencia = referenciaLegal(inf);
  const tipificacion =
    typeof inf.tipificacion === "string" && inf.tipificacion.trim().length > 0
      ? inf.tipificacion
      : null;
  if (referencia === null && tipificacion === null) return <>{SIN_DATO}</>;
  return (
    <div className="flex flex-col">
      {referencia && <span>{referencia}</span>}
      {tipificacion && (
        <TextoLargo
          texto={tipificacion}
          className="text-xs text-base-content/70"
        />
      )}
    </div>
  );
};

const InfraccionesSeccion: FC<InfraccionesSeccionProps> = ({ eejeId }) => {
  // UN solo estado con el `eejeId` al que responde: «cargando» se DEDUCE (no hay respuesta para el
  // expediente que se mira) en vez de encenderse a mano dentro del efecto.
  const [resultado, setResultado] = useState<Resultado | null>(null);

  useEffect(() => {
    let vivo = true;
    InfraccionesService.ficha(eejeId)
      .then((ficha) => {
        if (!vivo) return;
        setResultado({ eejeId, ficha, error: null });
      })
      .catch(() => {
        if (!vivo) return;
        setResultado({ eejeId, ficha: null, error: MENSAJE_ERROR });
      });
    return () => {
      vivo = false;
    };
  }, [eejeId]);

  const cargando = resultado?.eejeId !== eejeId;
  const ficha = cargando ? null : resultado.ficha;
  const error = cargando ? null : resultado.error;

  if (cargando) {
    return (
      <span className="text-xs text-base-content/70">
        Cargando las infracciones del expediente…
      </span>
    );
  }
  if (error || !ficha) {
    return <Alert variant="error" message={error ?? MENSAJE_ERROR} />;
  }

  const { evaluacionTc } = ficha;
  const fechaLectura = ficha.coreLeidoAt
    ? ` · última lectura: ${DatetimeUtil.formatDate(ficha.coreLeidoAt)}`
    : "";
  // Los motivos de bloqueo que el servidor YA convirtió en aviso no se repiten en el resumen: se
  // dicen una vez, arriba. Los demás (p. ej. «ninguna infracción admite TC») solo viven aquí.
  const codigosAvisados = new Set<string>(ficha.alertas.map((a) => a.codigo));
  const motivosPropios =
    evaluacionTc.estado === "BLOQUEADA"
      ? evaluacionTc.motivos.filter((m) => !codigosAvisados.has(m.codigo))
      : [];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-1 text-sm">
        <span className="font-semibold">
          {ETIQUETA_ESTADO_CORE[ficha.estadoCore]}
          {fechaLectura}
        </span>
        <span className="text-base-content/70">
          {`Materia: ${etiquetaConSinMateria(
            ficha.materia,
            ficha.infraccionesSinMateria > 0,
          )}`}
          {ficha.submaterias.length > 0 &&
            ` · Submateria: ${ficha.submaterias.join(", ")}`}
          {` · ${ETIQUETA_TIPO_PERSONA[ficha.tipoPersona]}`}
        </span>
      </div>

      {ficha.alertas.map((alerta) => (
        <Alert
          key={`${alerta.codigo}-${alerta.mensaje}`}
          variant={VARIANTE_ALERTA[alerta.codigo]}
          message={alerta.mensaje}
        />
      ))}

      {ficha.infracciones.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-base-300">
          <table className="table table-sm w-full [&_td]:align-top">
            <thead>
              <tr>
                <th>Código</th>
                <th className="min-w-[12rem]">Base legal</th>
                <th className="min-w-[10rem]">Materia · Submateria</th>
                <th className="min-w-[18rem]">Sanción</th>
                <th>Multa</th>
                <th>Admite trabajo comunitario</th>
                <th className="min-w-[16rem]">Obligación de hacer</th>
              </tr>
            </thead>
            <tbody>
              {ficha.infracciones.map((inf) => (
                <tr key={inf.codigo}>
                  <td className="font-mono whitespace-nowrap">{inf.codigo}</td>
                  <td>
                    <BaseLegal inf={inf} />
                  </td>
                  <td>
                    {inf.sinMateria
                      ? ETIQUETA_SIN_MATERIA
                      : `${inf.materia ?? SIN_DATO} · ${inf.submateria ?? SIN_DATO}`}
                  </td>
                  <td>
                    {inf.sancion ? (
                      <TextoLargo texto={inf.sancion} />
                    ) : (
                      SIN_DATO
                    )}
                  </td>
                  <td className="whitespace-nowrap">{importe(inf.multa)}</td>
                  <td>
                    {inf.admiteTc ? (
                      "Sí"
                    ) : (
                      <div className="flex flex-col">
                        <span>No</span>
                        {inf.motivoNoAdmite && (
                          <span className="text-xs text-base-content/70">
                            {inf.motivoNoAdmite}
                          </span>
                        )}
                      </div>
                    )}
                  </td>
                  <td>
                    {inf.obligacionHacer ? (
                      <TextoLargo texto={inf.obligacionHacer} />
                    ) : (
                      SIN_DATO
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 text-sm md:grid-cols-2">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-primary/80">
            Multa total
          </span>
          <span>{importe(ficha.multaTotal)}</span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-primary/80">
            Suma por infracción
          </span>
          <span>{importe(ficha.sumaMultas)}</span>
        </div>
      </div>

      {evaluacionTc.estado === "APTA" ? (
        <p className="text-sm font-semibold">
          {`Susceptible de compensación: ${importe(evaluacionTc.multaConmutable)}`}
        </p>
      ) : (
        <div className="space-y-1 text-sm">
          <p className="font-semibold">Trabajo comunitario: no procede.</p>
          {motivosPropios.length > 0 && (
            <ul className="list-disc pl-5">
              {motivosPropios.map((motivo) => (
                <li key={`${motivo.codigo}-${motivo.mensaje}`}>
                  {motivo.mensaje}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

export default InfraccionesSeccion;
