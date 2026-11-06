/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/dashboard (frontend)
 * Feature: Indicadores de gestión con alcance por rol
 * Archivo: DashboardCargaChart.tsx
 * Responsabilidad: La carga por persona, medida en EXPEDIENTES, con el plazo de aceptación vencido
 *   como señal de presión.
 *
 *   ── SUSTITUYE A `DashboardWorkloadChart`, Y NO ES UN RENOMBRADO ──────────────────────────────
 *   Aquél medía en «pts» y en «% de capacidad» sobre una `teamCapacity` de 188. 🔴 Las tres cosas
 *   son del clon de Resolución: en EjecucionDB **no hay puntos ni capacidad declarada** en ninguna
 *   tabla —se buscó en el esquema completo el 2026-10-02—, así que ese porcentaje no podía salir de
 *   ningún dato. Aquí:
 *     · la barra es **expedientes activos**, que es la carga de verdad;
 *     · la cifra de presión es la **aceptación vencida**, el único reloj del módulo que es una
 *       expresión SQL pura y que ya gobierna la bandeja del decisor;
 *     · «capacidad» pasa a **concentración**: qué parte del trabajo repartido lleva esa persona.
 *
 *   🔴 LA CONCENTRACIÓN SE OCULTA CON UNA SOLA PERSONA EN EL ALCANCE. A un decisor le saldría
 *   siempre «100 % de concentración», que no significa nada y se lee como una alarma.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-10-02
 */
import type { CargaPorPersona } from "../../services/DashboardService";

type DashboardCargaChartProps = {
  personas: CargaPorPersona[];
  /** Falso cuando el alcance es de una sola persona: el porcentaje no diría nada. */
  mostrarConcentracion: boolean;
};

const DashboardCargaChart = ({
  personas,
  mostrarConcentracion,
}: DashboardCargaChartProps) => {
  const conExpedientes = personas.filter((p) => p.llevaExpedientes);
  const sinExpedientes = personas.filter((p) => !p.llevaExpedientes);

  // El `1` evita dividir por cero cuando nadie tiene carga todavía.
  const maximo = Math.max(...conExpedientes.map((p) => p.expedientesActivos), 1);

  return (
    <section className="rounded-[1.55rem] border border-base-300 bg-base-100 p-4 md:p-5 shadow-[0_12px_32px_rgba(15,23,42,0.12)]">
      <div>
        <h2 className="text-base font-semibold text-base-content md:text-lg">
          Carga por decisor
        </h2>
        <p className="mt-1 text-[0.82rem] leading-5 text-base-content/70 md:text-sm">
          Expedientes activos a cargo de cada persona, y cuántos tienen el plazo
          de aceptación del sorteo ya vencido.
        </p>
      </div>

      {conExpedientes.length === 0 ? (
        <p className="mt-4 rounded-[1.2rem] border border-dashed border-base-300 px-4 py-6 text-center text-[0.85rem] text-base-content/60">
          Nadie de este alcance lleva expedientes todavía.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {conExpedientes.map((persona) => {
            const ancho = (persona.expedientesActivos / maximo) * 100;
            const tienePresion = persona.aceptacionVencida > 0;

            return (
              <li
                key={persona.usuarioId}
                className="rounded-[1.2rem] border border-base-300 px-3 py-2.5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-base-content">
                      {persona.nombre || `Usuario ${persona.usuarioId}`}
                    </span>
                    {persona.esUsuarioActual && (
                      <span className="badge badge-ghost badge-sm rounded-full text-[0.6rem] font-semibold uppercase tracking-[0.14em]">
                        Usted
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {mostrarConcentracion && (
                      <span className="badge badge-ghost badge-sm rounded-full text-[0.62rem] font-semibold">
                        {persona.concentracionPorcentaje}% de la carga
                      </span>
                    )}
                    {tienePresion && (
                      <span className="badge badge-warning badge-outline badge-sm rounded-full text-[0.62rem] font-semibold">
                        {persona.aceptacionVencida} sin aceptar a tiempo
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-base-200">
                  <div
                    aria-hidden="true"
                    className="h-full rounded-full"
                    style={{
                      width: `${ancho}%`,
                      backgroundColor: tienePresion
                        ? "var(--color-warning)"
                        : "var(--color-primary)",
                    }}
                  />
                </div>

                <p className="mt-1.5 text-[0.78rem] text-base-content/70">
                  <span className="font-semibold text-base-content">
                    {persona.expedientesActivos}
                  </span>{" "}
                  expedientes activos · {persona.actosUltimos30Dias} actos en
                  los últimos 30 días
                </p>
              </li>
            );
          })}
        </ul>
      )}

      {/*
        Quien no lleva expedientes —secretario, director, administrador— no puede medirse por carga.
        Va en su propio bloque y se mide por ACTOS en la bitácora, que es lo único que deja rastro
        de su trabajo. Meterlos en la lista de arriba los pintaría con cero carga, como si no
        hicieran nada.
      */}
      {sinExpedientes.length > 0 && (
        <div className="mt-4 border-t border-base-300 pt-3">
          <h3 className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-base-content/58">
            Actividad de quien no lleva expedientes
          </h3>
          <ul className="mt-2 space-y-1.5">
            {sinExpedientes.map((persona) => (
              <li
                key={persona.usuarioId}
                className="flex flex-wrap items-baseline justify-between gap-2 text-[0.82rem]"
              >
                <span className="text-base-content">
                  {persona.nombre || `Usuario ${persona.usuarioId}`}
                  <span className="ml-1.5 text-base-content/55">
                    {persona.rol}
                  </span>
                  {persona.esUsuarioActual && (
                    <span className="ml-1.5 badge badge-ghost badge-sm rounded-full text-[0.6rem] font-semibold uppercase tracking-[0.14em]">
                      Usted
                    </span>
                  )}
                </span>
                <span className="text-base-content/70">
                  <span className="font-semibold text-base-content">
                    {persona.actosUltimos30Dias}
                  </span>{" "}
                  actos / 30 días
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
};

export default DashboardCargaChart;
