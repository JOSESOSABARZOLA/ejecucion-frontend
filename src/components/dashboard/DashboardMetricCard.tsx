/**
 * App: Administración
 * Módulo: Dashboard
 * Feature: Dashboard
 * Archivo: DashboardMetricCard.tsx
 * Responsabilidad: Presentacion tarjeta compacta para métricas ejecutivas demo del dashboard.
 * Desarrollador: Cristian Alberto Proaño Estévez
 * Fecha: 2026-04-06
 */

/**
 * ⟳ 2026-10-02 — estos dos tipos vivían en `dashboardDemoData.ts`, que se borró con los datos
 * ficticios. Este componente era su único consumidor, así que se quedan aquí.
 */
export type DashboardMetricTone =
  | "primary"
  | "secondary"
  | "success"
  | "warning"
  | "info";

export type DashboardMetric = {
  label: string;
  value: string;
  helper: string;
  tone: DashboardMetricTone;
};

type DashboardMetricCardProps = {
  metric: DashboardMetric;
};

const toneStyles: Record<
  DashboardMetricTone,
  { dot: string; value: string }
> = {
  primary: {
    dot: "bg-primary",
    value: "text-primary",
  },
  secondary: {
    dot: "bg-secondary",
    value: "text-secondary",
  },
  success: {
    dot: "bg-success",
    value: "text-success",
  },
  warning: {
    dot: "bg-warning",
    value: "text-warning",
  },
  info: {
    dot: "bg-info",
    value: "text-info",
  },
};

const DashboardMetricCard = ({ metric }: DashboardMetricCardProps) => {
  const tone = toneStyles[metric.tone];

  return (
    <article className="h-full rounded-[1.3rem] border border-base-300 bg-base-100 px-4 py-3.5 shadow-[0_10px_24px_rgba(15,23,42,0.09)]">
      <div className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className={`inline-flex h-2 w-2 rounded-full ${tone.dot}`}
        />
        <p className="text-[0.64rem] font-semibold uppercase tracking-[0.18em] text-base-content/65">
          {metric.label}
        </p>
      </div>

      <p className={`mt-3 text-[1.9rem] font-bold leading-none ${tone.value}`}>
        {metric.value}
      </p>
      <p className="mt-1.5 text-[0.82rem] leading-5 text-base-content/72">
        {metric.helper}
      </p>
    </article>
  );
};

export default DashboardMetricCard;
