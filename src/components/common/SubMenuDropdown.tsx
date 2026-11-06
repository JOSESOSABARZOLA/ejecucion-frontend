/**
 * Microservicio: resolucion
 * Módulo: N/A
 * Feature: Submenu desplegable
 * Archivo: SubMenuDropdown.tsx
 * Responsabilidad: Renderizar cualquier tipo de submenu con opciones seleccionables
 * Desarrollador: Johan Freire
 * Fecha: 2026-03-19
 */
import { useState, type ReactNode } from "react";
import Boton from "./Boton";
import UserProfileButton from "./UserProfileButton";
// import PortalDropdown from "./PortalDropdown";

type MenuDesplegableProps<T> = {
  botonProps?: { estilos: string; icono: string; deshabilitado: boolean };
  menuClassName?: string;
  items: T[];
  renderItem: (items: T[]) => ReactNode;
};

const SubMenuDropdown = <T,>({
  botonProps,
  menuClassName,
  items,
  renderItem,
}: MenuDesplegableProps<T>) => {

  // Controla la apertura del menu, cuando se de click al botón asignado
  const [abierto, setAbierto] = useState<boolean>(false);

  const handleMenu = () => {
    setAbierto(!abierto);
  };


  const dropdownContent = (
    <ul
      tabIndex={-1}
      className={`app-shell-surface app-dropdown-surface dropdown-content menu z-70 mt-2 min-w-56 rounded-2xl border border-base-300 bg-base-100 p-2 text-sm text-base-content shadow-[0_20px_45px_rgba(15,23,42,0.20)] ${menuClassName ?? ""}`}
    >
      {renderItem(items)}
    </ul>
  );

  return (
    <div
      className="dropdown dropdown-end"
    >
      <div
        tabIndex={0}
        role="button"
      >
        {botonProps ? (
          <Boton
            onClick={handleMenu}
            {...botonProps}
          />
        ) : (
          <UserProfileButton onClick={handleMenu} />
        )}
      </div>
      {/* Menu que se presentara al dar click en el boton anterior */}
      { !botonProps?.deshabilitado && dropdownContent}
    </div>
  );
};

export default SubMenuDropdown;
