/**
 * Microservicio: resolucion
 * Módulo: N/A
 * Feature: Información del perfil de usuario
 * Archivo: UserInfoPerfil.tsx
 * Responsabilidad: Mostrar el nombre completo y rol del usuario en el panel de perfil
 * Desarrollador: Johan Freire
 * Fecha: 2026-06-01
 */

import { useUser } from "../../context/UserContext";
import { roleLabel } from "../../config/roleLabels";

export default function UserInfoPerfil() {
  const { user } = useUser();

  if (!user) {
    return null;
  }

  const { usuFullName, rolName } = user;
  // Etiqueta de presentación: 'funcionario decisor' → "Funcionario Ejecutor" (D-04). El rol_name
  // crudo del backend NO cambia; esto es SOLO render. Roles sin etiqueta se muestran tal cual.
  const rolLabel = roleLabel(rolName);

  return (
    <div className="app-profile-panel-theme">
      <div className="app-profile-panel-theme-copy">
        <p className="app-profile-panel-theme-label">Usuario</p>
        <p className="app-profile-panel-theme-value capitalize">{usuFullName}</p>
      </div>
      <div className="app-profile-panel-theme-copy">
        <p className="app-profile-panel-theme-label">Rol</p>
        <p className="app-profile-panel-theme-value capitalize">{rolLabel}</p>
      </div>
    </div>
  );
}
