/**
 * Microservicio: ejecucion
 * Módulo: App Shell
 * Feature: Página placeholder "en construcción" compartida (IA del menú, D-03)
 * Archivo: PlaceholderPage.tsx
 * Responsabilidad: Renderizar una página tonta reutilizable para los submenús cuya bandeja aún no
 *   existe (Bandeja de Entrada 3.8 / Bandeja de Salida 3.9 / Actas de Sorteo 3.5). Sin lógica de
 *   datos: solo reúsa el esqueleto estándar del shell (app-data-container → HeaderPage →
 *   app-data-panel → EmptyState) para que hacer clic en el submenú navegue a una página con título
 *   en vez de caer en una vista vacía o un 404 (RESEARCH Pitfall 3). Una sola página compartida,
 *   parametrizada por `title` (no una por bandeja).
 * Desarrollador: Andrés Miño
 * Fecha: 2026-07-23
 */

import HeaderPage from "../components/common/HeaderPage";
import EmptyState from "../components/common/EmptyState";

interface PlaceholderPageProps {
  /** Título de la bandeja pendiente (p. ej. "Bandeja de Entrada"). Es lo único que varía entre rutas. */
  title: string;
}

/**
 * Página "en construcción" compartida. No hace fetch ni tiene estado: arma el esqueleto estándar del
 * shell con el título recibido y un EmptyState que anuncia que la bandeja llegará en una fase próxima.
 */
const PlaceholderPage = ({ title }: PlaceholderPageProps) => {
  return (
    <div className="app-data-container">
      <HeaderPage
        headerKicker="Ejecución — DME"
        title={title}
        subtitle="Esta bandeja aún no está disponible en Ejecución."
      />

      <section className="app-modules-panel app-data-panel app-shell-surface overflow-visible rounded-3xl border border-base-300 bg-base-100 shadow-[0_12px_32px_rgba(15,23,42,0.12)] backdrop-blur-[2px]">
        <div className="app-data-panel-body px-2 pb-4 pt-2 md:px-4">
          <EmptyState text="Bandeja en construcción — disponible en una próxima fase" />
        </div>
      </section>
    </div>
  );
};

export default PlaceholderPage;
