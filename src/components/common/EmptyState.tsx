/**
 * Microservicio: ejecucion
 * Módulo: ejecucion (frontend, compartido)
 * Feature: El estado vacío de listas y tablas
 * Archivo: EmptyState.tsx
 * Responsabilidad: Decir que no hay nada que enseñar.
 * Desarrollador: Johan Freire
 * Fecha: 2026-03-19
 * Modificado por: Andrés Miño — 2026-09-21 (Fase 03.19, Plan 08, UI-SPEC §5.1: la prop OPCIONAL
 *   `hint`.)
 *
 *   🔴 POR QUÉ UNA SEGUNDA LÍNEA Y NO UNA FRASE MÁS LARGA. La bandeja del decisor tiene DOS vacíos
 *   que se parecen y no son el mismo: «no tiene expedientes asignados» —no hay nada y no hay nada
 *   que hacer— y «ningún expediente coincide con los filtros» —hay expedientes, y hay un filtro
 *   puesto—. Con doce columnas filtrables y scroll horizontal, confundirlos hace creer que la
 *   bandeja está vacía cuando lo que hay es un filtro olvidado en una columna que ni siquiera se
 *   ve. El encabezado dice QUÉ PASA y tiene que leerse de un golpe; la pista dice QUÉ HACER. En un
 *   solo párrafo, lo segundo se come a lo primero.
 *
 *   Es ADITIVA: los veintiún consumidores actuales siguen pasando solo `text` y no cambian.
 */
interface EmptyStateProps {
  text: string;
  /** Segunda línea, atenuada: qué puede hacer el usuario. Se omite cuando no hay nada que sugerir. */
  hint?: string;
}

const EmptyState = ({ text, hint }: EmptyStateProps) => {
  return (
    <div className="app-avisos-empty">
      <svg
        className="app-avisos-empty-icon"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      {/* El contenedor de arriba separa sus hijos con 1 rem, que entre encabezado y pista los
          leería como dos bloques distintos en vez de como una cosa dicha en dos líneas. */}
      <div className="flex flex-col gap-1">
        <p className="app-avisos-empty-text">{text}</p>
        {hint && (
          <p className="app-avisos-empty-text max-w-prose text-xs whitespace-normal opacity-80">
            {hint}
          </p>
        )}
      </div>
    </div>
  );
};

export default EmptyState;
