/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/dashboard (frontend)
 * Feature: Indicadores de gestión con alcance por rol
 * Archivo: DashboardPage.tsx
 * Responsabilidad: El tablero del usuario de la sesión, con datos REALES y el alcance que el
 *   servidor le haya resuelto.
 * Desarrollador: Cristian Alberto Proaño Estévez
 * Modificado por: Andrés Miño — 2026-10-02 (quick 261002-gda)
 *
 *   ── QUÉ CAMBIA, Y POR QUÉ NO ERA UN CABLEADO DE DATOS ────────────────────────────────────────
 *   Esta página se alimentaba de `dashboardDemoData.ts`: números inventados, y en el vocabulario
 *   del clon de Resolución. 🔴 «Peso 1-5», «points», «capacity» y «analyst» NO EXISTEN en
 *   EjecucionDB —se buscó en el esquema completo el 2026-10-02—, así que dos de los cuatro gráficos
 *   no podían recibir datos reales nunca: no había de dónde sacarlos. Se sustituyeron por métricas
 *   que sí se pueden medir y defender, no se rellenaron.
 *
 *   ── LO QUE EL SERVIDOR DECIDE Y ESTA PÁGINA NO ──────────────────────────────────────────────
 *   El alcance. `GET /dashboard` no recibe ni un parámetro: el `usu_id` y los roles salen del JWT.
 *   Esta pantalla no sabe —ni tiene por qué— a quién puede ver el usuario.
 *
 *   🔴 EL TABLERO ES LA PÁGINA DE ATERRIZAJE DE TODOS (`/home` → `dashboard`) y la ruta solo está
 *   detrás de `AuthGuard`, sin gate por rol. Así que esta página TIENE que saber caerse bien: un
 *   403 del servidor —el delegado de trabajo comunitario, que no tiene tablero— no es un fallo, es
 *   la respuesta correcta, y se explica en vez de enseñar una pantalla rota.
 */
import { useCallback, useEffect, useState } from "react";
import HeaderPage from "../components/common/HeaderPage";
import DashboardMetricCard, {
  type DashboardMetric,
} from "../components/dashboard/DashboardMetricCard";
import DashboardStatusChart from "../components/dashboard/DashboardStatusChart";
import DashboardCargaChart from "../components/dashboard/DashboardCargaChart";
import DashboardDistribucionChart, {
  type DashboardTramo,
} from "../components/dashboard/DashboardDistribucionChart";
import Loading from "../components/common/Loading";
import { DashboardService, type Tablero } from "../services/DashboardService";
import { agruparPorFamilia } from "../config/estadosEpas";

/** Qué explica cada alcance, para que el usuario sepa qué está mirando. */
const SUBTITULO_POR_ROL: Record<string, string> = {
  "funcionario decisor": "Sus expedientes asignados",
  "secretario abogado": "Sus decisores y los expedientes por repartir",
  director: "Todas las personas de Ejecución",
  administrador: "Su actividad en el módulo",
};

const porcentaje = (valor: number, total: number) =>
  total > 0 ? `${((valor / total) * 100).toFixed(1)}%` : "—";

/**
 * Las tres tarjetas de cabecera. Se eligen por lo que el usuario puede HACER con ellas, no por lo
 * que es fácil de contar: expedientes vivos, lo que está sin repartir (o sin aceptar, si no
 * reparte) y los que se escaparon del plazo.
 */
const construirMetricas = (tablero: Tablero): DashboardMetric[] => {
  const { totales, plazos } = tablero;
  const reparte = totales.sinAsignar > 0 || tablero.alcance.rol !== "funcionario decisor";

  return [
    {
      label: "Expedientes activos",
      value: String(totales.activos),
      helper: `${totales.expedientes} han pasado por aquí · ${totales.archivados} archivados, ${totales.devueltos} devueltos`,
      tone: "primary",
    },
    reparte
      ? {
          label: "Sin repartir",
          value: String(totales.sinAsignar),
          helper: `${porcentaje(totales.sinAsignar, totales.activos)} de los activos espera decisor`,
          tone: totales.sinAsignar > 0 ? "warning" : "success",
        }
      : {
          label: "En trabajo comunitario",
          value: String(plazos.trabajoComunitarioEnCurso),
          helper: "Expedientes suyos cumpliendo horas",
          tone: "info",
        },
    {
      label: "Aceptación vencida",
      value: String(plazos.aceptacionVencida),
      helper:
        plazos.aceptacionVencida > 0
          ? "Sorteados cuyo plazo pasó sin que el decisor los aceptara"
          : "Ningún sorteo se pasó de plazo",
      tone: plazos.aceptacionVencida > 0 ? "warning" : "success",
    },
  ];
};

const tramosDePlazos = (tablero: Tablero): DashboardTramo[] => [
  {
    label: "Aceptación vencida",
    value: tablero.plazos.aceptacionVencida,
    colorToken: "--color-warning",
    nota: "El plazo pasó sin aceptar; cuenta como aceptado de forma implícita.",
  },
  {
    label: "Aceptación en plazo",
    value: tablero.plazos.aceptacionEnPlazo,
    colorToken: "--color-info",
    nota: "Sorteado y todavía dentro del plazo para aceptar.",
  },
  {
    label: "Trabajo comunitario",
    value: tablero.plazos.trabajoComunitarioEnCurso,
    colorToken: "--color-primary",
    // El vencimiento del TC se deriva en el backend desde el cierre de la notificación y no se
    // duplica en el SQL del tablero: aquí se informa el HECHO, no un plazo.
    nota: "En curso. Su vencimiento se consulta en el expediente.",
  },
];

const DashboardPage = () => {
  const [tablero, setTablero] = useState<Tablero | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sinTablero, setSinTablero] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    setSinTablero(false);
    try {
      setTablero(await DashboardService.obtener());
    } catch (e: unknown) {
      // El 403 no es un fallo: es la respuesta correcta para un rol sin tablero. Se distingue del
      // resto porque el remedio del usuario es distinto — ahí no hay nada que reintentar.
      const status = (e as { response?: { status?: number } })?.response?.status;
      if (status === 403) {
        setSinTablero(true);
      } else {
        setError(
          "No se pudieron cargar los indicadores. Vuelva a intentarlo; si persiste, avise a soporte.",
        );
      }
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const subtitulo = tablero
    ? (SUBTITULO_POR_ROL[tablero.alcance.rol] ?? "Indicadores del módulo")
    : "Indicadores de gestión";

  return (
    <div className="app-data-container">
      <HeaderPage
        headerKicker="Indicadores de Gestión"
        title="Dashboard"
        subtitle={subtitulo}
        options={[]}
        onOptionClick={undefined}
      />

      {cargando && <Loading />}

      {!cargando && sinTablero && (
        <div className="mt-4 rounded-[1.55rem] border border-base-300 bg-base-100 p-6 text-center">
          <p className="text-sm font-semibold text-base-content">
            Su rol no tiene tablero de indicadores.
          </p>
          <p className="mt-1 text-[0.85rem] text-base-content/70">
            Use el menú lateral para ir a sus pantallas de trabajo.
          </p>
        </div>
      )}

      {!cargando && error && (
        <div className="mt-4 rounded-[1.55rem] border border-error/40 bg-base-100 p-6 text-center">
          <p className="text-sm font-semibold text-base-content">{error}</p>
          <button
            type="button"
            className="btn btn-sm btn-outline mt-3"
            onClick={() => void cargar()}
          >
            Reintentar
          </button>
        </div>
      )}

      {!cargando && !error && !sinTablero && tablero && (
        <>
          <p className="mt-3 text-[0.78rem] text-base-content/60">
            {tablero.alcance.personas === 1
              ? "Alcance: solo usted."
              : `Alcance: ${tablero.alcance.personas} personas.`}
          </p>

          <div className="mt-3 grid gap-3 md:grid-cols-3">
            {construirMetricas(tablero).map((metric) => (
              <DashboardMetricCard key={metric.label} metric={metric} />
            ))}
          </div>

          {/*
            El administrador tiene tablero pero NO de expedientes: desde
            `2026-08-14-admin-solo-parametros` su único submenú es «Parámetros». Enseñarle anillos a
            cero no es informar, es parecer roto.
          */}
          {tablero.alcance.sinExpedientesPorRol ? (
            <div className="mt-4 rounded-[1.55rem] border border-base-300 bg-base-100 p-6">
              <p className="text-sm font-semibold text-base-content">
                Su rol no lleva expedientes.
              </p>
              <p className="mt-1 text-[0.85rem] text-base-content/70">
                El tablero de expedientes es de los roles que los tramitan. Lo
                suyo es la parametrización del módulo.
              </p>
            </div>
          ) : (
            <>
              <div className="mt-4 grid gap-4 xl:items-stretch xl:grid-cols-[minmax(0,1fr)_minmax(0,1.02fr)]">
                <DashboardStatusChart
                  items={agruparPorFamilia(tablero.porEstado)}
                  totalCases={tablero.totales.expedientes}
                />
                <DashboardCargaChart
                  personas={tablero.carga}
                  mostrarConcentracion={tablero.alcance.personas > 1}
                />
              </div>

              <div className="mt-4">
                <DashboardDistribucionChart
                  titulo="Relojes del expediente"
                  descripcion="El plazo de aceptación del sorteo, y cuántos expedientes están cumpliendo horas de trabajo comunitario."
                  items={tramosDePlazos(tablero)}
                  unidad="Expedientes"
                  vacio="Ningún expediente del alcance tiene un reloj en curso."
                />
              </div>

              {/*
                Las excusas se cuentan por CAUSAL, que es el campo que sobrevive a la resolución del
                director. Es el reporte que pidió el acta del 2026-09-11 («cuántas excusas por
                parentesco hubo este trimestre») y hasta hoy no tenía ninguna pantalla.
              */}
              <div className="mt-4">
                <DashboardDistribucionChart
                  titulo="Excusas por causal"
                  descripcion="Causales invocadas por los decisores del alcance. Se cuentan tanto si el director aprobó la excusa como si la rechazó."
                  items={tablero.excusas.map((excusa, indice) => ({
                    label: excusa.causal,
                    value: excusa.total,
                    colorToken: [
                      "--color-info",
                      "--color-warning",
                      "--color-secondary",
                      "--color-primary",
                      "--color-accent",
                      "--color-neutral",
                    ][indice % 6],
                  }))}
                  unidad="Excusas"
                  vacio="Ningún decisor del alcance se ha excusado."
                />
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
};

export default DashboardPage;
