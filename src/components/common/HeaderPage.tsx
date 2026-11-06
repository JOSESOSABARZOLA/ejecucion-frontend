/**
 * Componente: HeaderPage
 * Responsabilidad: Renderizar un encabezado de página reutilizable con título, subtítulo y botones de acción
 * Desarrollador: Johan Freire
 * Fecha: 2026-05-22
 */

import type { ModalType } from "../../interfaces/IModal";
import type { UserActions } from "../../interfaces/IUser";
import Boton from "./Boton";

interface HeaderPageProps {
  headerKicker: string;
  title: string;
  subtitle: string;
  options?: UserActions[];
  onOptionClick?: (actiName: ModalType) => void;
}

const HeaderPage = ({
  headerKicker,
  title,
  subtitle,
  options = [],
  onOptionClick,
}: HeaderPageProps) => {
  return (
    <div className="page-data-header">
      <div className="flex flex-col flex-1 gap-1.5">
        <p className="page-heading-kicker text-sm font-semibold uppercase tracking-[0.18em]">
          {headerKicker}
        </p>
        <h1 className="page-heading-title">{title}</h1>
        <p className="page-heading-subtitle">{subtitle}</p>
      </div>
      {options.length > 0 && (
        <div className="flex flex-wrap gap-2 items-end">
          {options.map((option) => (
            <Boton
              key={option.actiName}
              deshabilitado={option.actiIsDisabled ?? false}
              estilos="btn btn-outline btn-primary"
              texto={option.actiLabel}
              onClick={() => onOptionClick?.(option.actiName)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default HeaderPage;
