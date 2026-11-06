/**
 * Microservicio: ejecucion
 * Módulo: ejecucion (frontend, compartido)
 * Feature: Envoltorio único de la librería de iconos (`iconoMap`)
 * Archivo: Iconos.tsx
 * Responsabilidad: Ser el ÚNICO sitio del frontend que conoce FontAwesome. El resto de la
 *   aplicación pide iconos por un nombre en español (`mirar`, `providencia`, `coactiva`) y nunca
 *   importa un glifo: así cambiar de librería —o de glifo— es un cambio de una línea aquí y no de
 *   cuarenta pantallas.
 * Desarrollador: Johan Freire
 * Fecha: 2026-03-19
 * Modificado por: Andrés Miño — 2026-09-21 (11 iconos para el submenú del EPAS y el paso de firma,
 *   D-11/D-06)
 * Modificado por: Andrés Miño — 2026-10-26 (Fase 03.21, Plan 11: `firmado`, el icono del sello
 *   «Firmado» de los documentos del expediente, D-15)
 */
import {
  faBars,
  faBell,
  faFileLines,
  faFileImport,
  faCircleQuestion,
  faFolderOpen,
  faEnvelope,
  faTimeline,
  faClock,
  faEye,
  faBan,
  faFileCircleCheck,
  faFileContract,
  faFileCirclePlus,
  faPaperPlane,
  faCircleXmark,
  faChartLine,
  faBinoculars,
  faScroll,
  faTriangleExclamation,
  faCircleInfo,
  faEllipsisVertical,
  faTrashCan,
  faInbox,
  faSun,
  faBullhorn,
  faAngleDown,
  faAngleRight,
  faTag,
  faFloppyDisk,
  faMoon,
  faCheck,
  faUserSlash,
  faPaperclip,
  faMoneyBillWave,
  faHandshake,
  faCircleCheck,
  faClipboardCheck,
  faGavel,
  faFileZipper,
  faScaleBalanced,
  faEyeSlash,
  faSitemap,
  faFileSignature,
  type IconDefinition,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { FC } from "react";

const iconoMap: Record<string, IconDefinition> = {
  menu: faBars,
  subMenu: faEllipsisVertical,
  notificaciones: faBell,
  expediente: faFileLines,
  recepcion: faFileImport,
  documentacion: faFolderOpen,
  notificacion: faEnvelope,
  sinIcono: faCircleQuestion,
  lineaDeTiempo: faTimeline,
  reloj: faClock,
  mirar: faEye,
  rechazar: faBan,
  resolucion: faFileCircleCheck,
  escritos: faFileContract,
  providencia: faFileCirclePlus,
  enviarExpediente: faPaperPlane,
  cerrar: faCircleXmark,
  dashboard: faChartLine,
  papelera: faTrashCan,
  temaClaro: faSun,
  temaOscuro: faMoon,
  seguimiento: faBinoculars,
  verTodaDocumentacion: faScroll,
  advertencia: faTriangleExclamation,
  informacion: faCircleInfo,
  inbox: faInbox,
  alertasGestion: faBullhorn,
  expandir: faAngleDown,
  contraer: faAngleRight,
  // El icono de OBSERVAR (2026-09-18): va junto a cada campo y a cada documento de la ficha del
  // expediente, y es el que abre el panel de observaciones anclado a ESE objetivo.
  etiqueta: faTag,
  // GUARDAR (2026-09-18): el disquete, que es lo que la gente sigue leyendo como «guardar» aunque
  // hace veinte años que nadie usa uno. Lo pidió el usuario para el botón que añade la observación
  // de un campo: antes llevaba el de «documentación», que ahí no significaba nada.
  guardar: faFloppyDisk,

  // ── LOS DOCE ACTOS DEL SUBMENÚ DEL EPAS (Fase 03.19, Plan 08, D-11) ──────────────────────────
  // El `⋮` de la bandeja del decisor pasa a mostrar doce entradas agrupadas y CON ICONO. Diez de
  // las doce no tenían glifo; `providencia` (generar documento) y `reloj` (prórroga) ya estaban y
  // se reutilizan tal cual. Todos salen de `free-solid`, que ya está instalado: esta fase no
  // instala ningún paquete, y si hiciera falta uno sería señal de estar portando la pieza
  // equivocada.
  //
  // Los nombres son del DOMINIO, no del glifo: `coactiva` y no `balanza`. Si mañana la balanza
  // deja de leerse como «coactiva», cambia el glifo y no las doce declaraciones que lo piden.
  aceptar: faCheck,
  excusarme: faUserSlash,
  adjuntar: faPaperclip,
  pago: faMoneyBillWave,
  acogimiento: faHandshake,
  cumplimiento: faCircleCheck,
  obligacionHacer: faClipboardCheck,
  impugnacion: faGavel,
  descargar: faFileZipper,
  coactiva: faScaleBalanced,

  // ── EL PASO DE FIRMA (Fase 03.19, Plan 14, D-06) ─────────────────────────────────────────────
  // El ojo tachado del botón que oculta la clave de firma. Entra AQUÍ, un plan antes de usarse,
  // para que el plan 14 no tenga que abrir este archivo: dos planes tocando el mismo mapa en la
  // misma ola es un conflicto de fusión garantizado.
  ocultarMirada: faEyeSlash,

  // ── EL PANEL DE JERARQUÍA (quick 261002-lds) ─────────────────────────────────────────────────
  // 🔴 La siembra de `migrations/2026-10-02-menu-jerarquia.sql` pone `subm_icon = 'jerarquia'`:
  // esta clave y esa cadena tienen que coincidir EXACTAMENTE o el sidebar pinta el icono vacío
  // (`sinIcono`). No había ninguna clave que sirviera —ni `faSitemap` ni ningún `faUser*` salvo
  // `faUserSlash`—, así que entra aquí. Sale de `free-solid`, que ya está instalado: este quick
  // no instala paquetes.
  jerarquia: faSitemap,

  // ── EL SELLO «FIRMADO» (Fase 03.21, Plan 11, D-15, UI-SPEC §8.1) ─────────────────────────────
  // La ÚNICA clave de icono de la fase. Va dentro del badge del sello con `aria-hidden`: el lector
  // anuncia la palabra «Firmado», no el glifo. Sale de `free-solid`, que ya está instalado.
  firmado: faFileSignature,
};

type Props = {
  nombre: string | undefined;
  estilo?: string;
};

const Iconos: FC<Props> = ({ nombre, estilo }) => {
  // const nombreIcono = nombre || "sinIcono";

  const icono = iconoMap[nombre ?? ""] ?? iconoMap["sinIcono"];

  return (
    <span>
      <FontAwesomeIcon
        icon={icono}
        className={estilo ?? ""}
      />
    </span>
  );
};

export default Iconos;
