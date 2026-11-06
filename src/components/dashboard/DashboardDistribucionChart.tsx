/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/dashboard (frontend)
 * Feature: Indicadores de gestión con alcance por rol
 * Archivo: DashboardDistribucionChart.tsx
 * Responsabilidad: Un reparto en tramos, con su barra, su cuenta y su porcentaje. Genérico a
 *   propósito: lo usan los plazos de aceptación y las excusas por causal.
 *
 *   ── DE DÓNDE SALE, Y POR QUÉ NO SE LLAMA YA «WeightDistribution» ─────────────────────────────
 *   Sustituye a `DashboardWeightDistributionChart`, que pintaba «Peso 1-5» y «puntos ponderados».
 *   🔴 Ese vocabulario es del clon de Resolución: en EjecucionDB **no existe ningún concepto de
 *   peso** —se buscó en el esquema completo el 2026-10-02—, así que aquel gráfico no podía tener
 *   datos reales nunca. La forma (tarjetas con barra) sí servía; el contenido no. Se conserva la
 *   forma y se le da algo que sí se puede medir.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-10-02
 */

export type DashboardTramo = {
  label: string;
  value: number;
  /** Variable CSS de `src/index.css`, p. ej. `--color-warning`. */
  colorToken: string;
  /** Línea secundaria opcional: qué significa el tramo. */
  nota?: string;
};

type DashboardDistribucionChartProps = {
  titulo: string;
  descripcion: string;
  items: DashboardTramo[];
  /** Palabra para la cifra grande («Expedientes», «Excusas»). */
  unidad: string;
  /** Mensaje cuando no hay ni un tramo con valor. */
  vacio: string;
};

const DashboardDistribucionChart = ({
  titulo,
  descripcion,
  items,
  unidad,
  vacio,
}: DashboardDistribucionChartProps) => {
  const total = items.reduce((suma, item) => suma + item.value, 0);
  // Sin esto, un reparto todo-a-cero divide por 0 y las barras salen con `height: NaN%`.
  const maximo = Math.max(...items.map((item) => item.value), 1);

  return (
    <section className="rounded-[1.55rem] border border-base-300 bg-base-100 p-4 md:p-5 shadow-[0_12px_32px_rgba(15,23,42,0.12)]">
      <div className="flex flex-col gap-2.5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-base font-semibold text-base-content md:text-lg">
            {titulo}
          </h2>
          <p className="mt-1 text-[0.82rem] leading-5 text-base-content/70 md:text-sm">
            {descripcion}
          </p>
        </div>

        {total > 0 && (
          <span className="badge badge-ghost rounded-full px-3 text-[0.64rem] font-semibold uppercase tracking-[0.16em]">
            {total} en total
          </span>
        )}
      </div>

      {total === 0 ? (
        <p className="mt-4 rounded-[1.2rem] border border-dashed border-base-300 px-4 py-6 text-center text-[0.85rem] text-base-content/60">
          {vacio}
        </p>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {items.map((item) => {
            const alturaBarra = (item.value / maximo) * 100;
            const porcentaje =
              total > 0 ? ((item.value / total) * 100).toFixed(1) : "0.0";

            return (
              <article
                key={item.label}
                className="rounded-[1.2rem] border border-base-300 bg-base-100 px-3 py-3 shadow-[0_10px_24px_rgba(15,23,42,0.08)]"
              >
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-base-content">
                    {item.label}
                  </h3>
                  <span
                    aria-hidden="true"
                    className="inline-flex h-3 w-3 shrink-0 rounded-full"
                    style={{ backgroundColor: `var(${item.colorToken})` }}
                  />
                </div>

                <div className="mt-3.5 flex h-28 items-end justify-center">
                  <div className="flex h-full w-full max-w-20 items-end rounded-[1.15rem] bg-base-200 px-1.5 py-1.5">
                    <div
                      aria-hidden="true"
                      className="w-full rounded-[1rem_1rem_0.7rem_0.7rem] shadow-[0_12px_22px_rgba(15,23,42,0.16)]"
                      style={{
                        height: `${alturaBarra}%`,
                        backgroundColor: `var(${item.colorToken})`,
                      }}
                    />
                  </div>
                </div>

                <div className="mt-3 space-y-0.5 text-center">
                  <p className="text-2xl font-bold leading-none text-base-content md:text-[1.75rem]">
                    {item.value}
                  </p>
                  <p className="text-[0.64rem] font-semibold uppercase tracking-[0.18em] text-base-content/58">
                    {unidad}
                  </p>
                  <p className="text-[0.82rem] text-base-content/70">
                    {porcentaje}% del total
                  </p>
                  {item.nota && (
                    <p className="text-[0.76rem] leading-4 text-base-content/60">
                      {item.nota}
                    </p>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
};

export default DashboardDistribucionChart;
