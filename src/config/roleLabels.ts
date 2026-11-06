/**
 * Microservicio: ejecucion
 * Módulo: App Shell
 * Feature: Etiquetas de rol para presentación (D-04)
 * Archivo: roleLabels.ts
 * Responsabilidad: Mapear el `rol_name` EXACTO que emite el backend a la etiqueta que ve el usuario
 *   en el perfil. Es SOLO presentación: el contrato de `rol_name` (@Roles/JWT/DTO) NO cambia. El caso
 *   que motiva este mapa es que el rol 'funcionario decisor' debe mostrarse como "Funcionario
 *   Ejecutor" en Ejecución sin renombrar nada en el backend.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-07-23
 */

/**
 * Mapa de `rol_name` → etiqueta de render.
 *
 * IMPORTANTE: las claves son la cadena EXACTA del backend (minúsculas, tal cual la manda `usu_get_user`
 * / el JWT): 'funcionario decisor', NO 'Funcionario Decisor'. No las "corrijas" a Title Case o el
 * lookup fallará y se caerá al passthrough. Los roles no listados se muestran sin cambios.
 */
export const ROLE_LABELS: Record<string, string> = {
  "funcionario decisor": "Funcionario Ejecutor",
  "secretario abogado": "Secretario",
  director: "Director",
};

/**
 * Devuelve la etiqueta de render de un rol. Passthrough para roles sin etiqueta explícita: se muestra
 * el `rol_name` crudo tal cual lo entrega el backend.
 */
export const roleLabel = (rolName: string): string =>
  ROLE_LABELS[rolName] ?? rolName;
