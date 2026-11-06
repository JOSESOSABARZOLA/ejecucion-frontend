/**
 * App: Administraciï¿½n
 * Mï¿½dulo: App Shell
 * Feature: Navigation
 * Archivo: navigation.ts
 * Responsabilidad: Define la configuraciï¿½n estructural del menï¿½ lateral del sistema.
 * Desarrollador: Cristian Alberto Proaï¿½o Estï¿½vez
 * Fecha: 2026-03-27
 */

// import type { PermissionKey, RoleKey } from "../../features/auth/types/User";
import { RUTA_GESTION_NOTIFICACIONES_HIJA } from "./rutasGestionNotificaciones";

export type NavigationItem = {
  id: number | string;
  label: string;
  path: string;
  icon?: string;
  children?: NavigationItem[];
  defaultOpen?: boolean;
  parentId?: number | string;
  requiredRole?: string;
  //   requiredPermissions?: PermissionKey[];
  // requiredPermissions?: any;
};

/**
 * Fase 3 — entradas de navegación de las bandejas de sorteo por rol.
 *
 * NOTA: el menú lateral (MenuDropdownParts.Content) se construye a partir de `user.modulos` /
 * `user.submenus` que provee el backend de autorización — NO de este archivo. Estas entradas son el
 * CONTRATO de las rutas (path/label/icon/rol) que el backend debe sembrar como submenús para que la
 * bandeja aparezca en el sidebar; los `path` coinciden con los registrados en `routes.tsx`.
 */
export const sorteoNavigationItems: NavigationItem[] = [
  {
    id: "sorteo",
    label: "Bandeja de Sorteo",
    path: "sorteo",
    icon: "recepcion",
    requiredRole: "secretario abogado",
  },
  {
    id: "aprobacion-sorteo",
    label: "Aprobación de Sorteos",
    path: "aprobacion-sorteo",
    icon: "resolucion",
    requiredRole: "director",
  },
  {
    // Fase 03.22, Plan 04 — D-01: aquí estaba declarada la bandeja APARTE de órdenes de pago, y se
    // retiró junto con su ruta. Este archivo no pinta el menú (ver la nota de arriba), así que
    // quitarla no cambia nada de lo que el usuario ve —eso lo hace el grant de la base, en la
    // migración del 2026-09-24 de `ejecucion-db`—; se quita porque es el CONTRATO de la ruta, y una
    // entrada que apunta a una ruta que ya no está registrada es una mentira en el contrato.
    //
    // Fase 03.19, Plan 17: la pantalla pasa a llamarse «Mis Expedientes», y el nombre se alinea en
    // los TRES sitios donde se escribía —esta entrada, el título de la página y el kicker del modal
    // de excusa— o queda con tres nombres. El rótulo anterior nombraba el EPAS, que es la entidad
    // interna; éste es además el que la BASE siembra para el submenú
    // (`t_submenus.subm_name = 'Mis expedientes'`): hasta hoy el contrato de la ruta y el menú real
    // decían cosas distintas.
    id: "mis-asignados",
    label: "Mis Expedientes",
    path: "mis-asignados",
    icon: "expediente",
    requiredRole: "funcionario decisor",
  },
  {
    // Bandeja de SOLO CONSULTA: todo lo que el secretario sorteó, con su estado real (pendiente de
    // aprobación / aprobado / rechazado + motivo). Antes, entre que sorteaba y el director resolvía,
    // el lote le desaparecía de la vista. La ve el SECRETARIO (es su trabajo) y también el DIRECTOR
    // (el efecto de lo que aprobó/rechazó) — de ahí que el submenú 6 se siembre con grants a ambos.
    id: "sorteados",
    label: "Sorteados",
    path: "sorteados",
    icon: "mirar",
    requiredRole: "secretario abogado",
  },
  {
    // Fase 03.20 — el Gestor de Notificaciones: la lectura TRANSVERSAL de todas las notificaciones
    // del módulo con el estado de cada despacho. No es una bandeja de rol.
    //
    // 🔴 `requiredRole` dice el SECRETARIO ABOGADO porque es quien reenvía —la única acción con
    // consecuencia de la pantalla—; el DIRECTOR también la recibe por grant (los grants 46/47 a los
    // roles 2 y 3 de `migrations/2026-09-25-menu-gestion-notificaciones.sql`), y es ese GRANT lo que
    // decide de verdad quién la ve. Este archivo es el CONTRATO de la ruta, no el menú: el menú lo
    // arma `usu_get_user` en la base. Es la misma nota que tenía la bandeja de
    // solicitudes de sello, retirada el 2026-10-08.
    //
    // 🔴 EL CAMINO SALE DE LA CONSTANTE, no de una cadena a mano, y va SIN `/home/` como sus seis
    // hermanas: la parte absoluta la pone quien pinta el menú.
    //
    // ⚠️ El rótulo va CON TILDES. La siembra lo escribe en ASCII (`Gestion de Notificaciones`)
    // porque ésa es la grafía de las nueve filas vivas de `t_submenus`; eso es un defecto del dato,
    // no un estilo que propagar al contrato.
    id: "gestion-notificaciones",
    label: "Gestión de Notificaciones",
    path: RUTA_GESTION_NOTIFICACIONES_HIJA,
    icon: "notificacion",
    requiredRole: "secretario abogado",
  },
];

// export const shellNavigationItems: NavigationItem[] = [
//   {
//     id: "dashboard",
//     label: "Indicadores de Gestión",
//     path: "dashboard",
//     icon: "dashboard",
//   },
//   {
//     id: "alerts",
//     label: "Alertas de Gestión",
//     path: "alerts",
//     icon: "alertasGestion",
//   },
//   {
//     id: "reception",
//     label: "Recepción y Asignación",
//     path: "reception",
//     icon: "recepcion",
//     defaultOpen: false,
//     requiredRole: "funcionario_decisor",
//     children: [
//       {
//         id: "inbox-cases",
//         label: "Bandeja de Entrada",
//         path: "inbox",
//         icon: "inbox",
//         // requiredPermissions: ["ver_expediente"],
//       },
//       {
//         id: "reception-cases",
//         label: "Mis Expedientes",
//         path: "reception",
//         icon: "expediente",
//         // requiredPermissions: ["ver_expediente"],
//       },
//       // {
//       //   id: "reception-avisos",
//       //   label: "Avisos del sistema",
//       //   path: "avisos",
//       //   icon: "aviso",
//       //   // requiredPermissions: ["ver_aviso"],
//       // },
//     ],
//   },
//   {
//     id: "seguimiento",
//     label: "Seguimiento y Control",
//     path: "seguimiento",
//     icon: "seguimiento",
//     defaultOpen: false,
//     children: [
//       {
//         id: "seguimiento-documentacion",
//         label: "Documentos Generados",
//         path: "documentacion",
//         icon: "documentacion",
//       },
//       {
//         id: "seguimiento-notificaciones",
//         label: "Gestión de Notificaciones",
//         path: "seguimiento/notificaciones",
//         icon: "notificacion",
//       },
//     ],
//   },
// ];
