/**
 * App: Administración
 * Módulo: Dashboard
 * Feature: Dashboard
 * Archivo: DashboardStatusChart.tsx
 * Responsabilidad: Renderiza el gráfico demo de distribución general de estados del dashboard.
 * Desarrollador: Cristian Alberto Proaño Estévez
 * Fecha: 2026-04-06
 */

/*
 * ⟳ 2026-10-02 — aquí se montaba `DashboardTeamCapacityChart`, con «capacidad del equipo»,
 * «operativos» y «excepciones». 🔴 Ninguno de los tres existe en EjecucionDB: no hay cupo
 * declarado por persona en ninguna tabla. El sub-gráfico se retiró en vez de rellenarlo con una
 * cifra inventada, y con él la prop `teamCapacity`.
 */
import type { CSSProperties } from "react";
/** Una porción del anillo: una familia de estados del EPAS con su color y su explicación. */
export type DashboardStatusDatum = {
  label: string;
  value: number;
  colorToken: string;
  summary: string;
};

type DashboardStatusChartProps = {
  items: DashboardStatusDatum[];
  totalCases: number;
};

const formatPercentage = (value: number, total: number) =>
  `${((value / total) * 100).toFixed(1)}%`;

const DashboardStatusChart = ({
  items,
  totalCases,
}: DashboardStatusChartProps) => {
  const segments = items.reduce<{
    accumulatedValue: number;
    segmentList: string[];
  }>(
    (result, item) => {
      const start = (result.accumulatedValue / totalCases) * 100;
      const nextAccumulatedValue = result.accumulatedValue + item.value;
      const end = (nextAccumulatedValue / totalCases) * 100;

      return {
        accumulatedValue: nextAccumulatedValue,
        segmentList: [
          ...result.segmentList,
          `var(${item.colorToken}) ${start}% ${end}%`,
        ],
      };
    },
    {
      accumulatedValue: 0,
      segmentList: [],
    },
  );

  const donutStyle: CSSProperties = {
    backgroundImage: `conic-gradient(${segments.segmentList.join(", ")})`,
  };

  return (
    <section className="h-full rounded-[1.55rem] border border-base-300 bg-base-100 p-4 md:p-5 shadow-[0_12px_32px_rgba(15,23,42,0.12)]">
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-base-content md:text-lg">
            Estado general de casos
          </h2>
          <p className="mt-1 text-[0.82rem] leading-5 text-base-content/70 md:text-sm">
            Distribución actual de casos para identificar volumen aprobado,
            pendiente de asignación y en revisión.
          </p>
        </div>

        <span className="rounded-full border border-base-300 bg-base-200 px-3 py-1.5 text-[0.64rem] font-semibold uppercase tracking-[0.18em] text-base-content/70">
          {totalCases} casos registrados
        </span>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[14.5rem_minmax(0,1fr)] lg:items-center">
        <div className="mx-auto flex w-full justify-center">
          <div
            aria-label="Distribución de estados de expedientes"
            className="relative flex h-48 w-48 items-center justify-center rounded-full md:h-52 md:w-52"
            role="img"
            style={donutStyle}
          >
            <div className="flex h-28 w-28 flex-col items-center justify-center rounded-full border border-base-300 bg-base-100 text-center shadow-[0_10px_24px_rgba(15,23,42,0.12)] md:h-32 md:w-32">
              <span className="text-[0.64rem] font-semibold uppercase tracking-[0.18em] text-base-content/60">
                Total
              </span>
              <span className="mt-1.5 text-2xl font-bold text-base-content md:text-3xl">
                {totalCases}
              </span>
              <span className="mt-0.5 text-[0.82rem] text-base-content/65">
                casos
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-2.5">
          {items.map((item) => (
            <article
              key={item.label}
              className="rounded-[1.2rem] border border-base-300 bg-base-200/45 px-3.5 py-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      aria-hidden="true"
                      className="inline-flex h-3 w-3 rounded-full"
                      style={{ backgroundColor: `var(${item.colorToken})` }}
                    />
                    <h3 className="text-sm font-semibold text-base-content">
                      {item.label}
                    </h3>
                  </div>
                  <p className="mt-1.5 text-[0.82rem] leading-5 text-base-content/70">
                    {item.summary}
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-xl font-bold text-base-content md:text-2xl">
                    {item.value}
                  </p>
                  <p className="text-xs font-medium uppercase tracking-[0.16em] text-base-content/60">
                    {formatPercentage(item.value, totalCases)}
                  </p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>

      <div className="mt-4">

      </div>
    </section>
  );
};

export default DashboardStatusChart;
