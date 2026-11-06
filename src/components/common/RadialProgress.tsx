/**
 * Microservicio: resolucion
 * Módulo: N/A
 * Feature: Indicador radial de progreso
 * Archivo: RadialProgress.tsx
 * Responsabilidad: Renderizar un radial-progress DaisyUI con colores según porcentaje
 * Desarrollador: Johan Freire
 * Fecha: 2026-06-22
 */
import { type CSSProperties, type FC } from "react";

const PROGRESS_COLOR_CLASSES = {
  low: "bg-error text-error-content border-error",
  medium: "bg-warning text-warning-content border-warning",
  high: "bg-success text-success-content border-success",
} as const;

type RadialProgressProps = {
  resolvePercentage: () => number;
  className?: string;
};

function resolveColorTier(value: number): keyof typeof PROGRESS_COLOR_CLASSES {
  if (value < 25) return "low";
  if (value < 75) return "medium";
  return "high";
}

function clampPercentage(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value)));
}

const RadialProgress: FC<RadialProgressProps> = ({
  resolvePercentage,
  className = "",
}) => {
  const value = clampPercentage(resolvePercentage());
  const colorTier = resolveColorTier(value);
  const colorClasses = PROGRESS_COLOR_CLASSES[colorTier];

  return (
    <div
      className={`radial-progress border-4 h-10 w-10 text-xs ${colorClasses} ${className}`.trim()}
      style={{ "--value": value, "--thickness": "0.25rem" } as CSSProperties}
      aria-valuenow={value}
      aria-label={`${value}% completado`}
      role="progressbar"
    >
      {value}%
    </div>
  );
};

export default RadialProgress;
