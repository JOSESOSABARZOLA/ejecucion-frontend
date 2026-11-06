/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/bandejas (frontend)
 * Archivo: BadgePriority.tsx
 * Responsabilidad: EL sistema de etiquetas del módulo. Un solo mapa, `BADGE_GROUPS`, del que salen
 *   todos los chips de todas las bandejas.
 * Modificado por: Andrés Miño — 2026-09-25 (Fase 03.20, Plan 02 — C4 del contrato de UI: el
 *   escalón de 12px, la píldora pálida y `pendiente` mapeado. Los tres cambios son ADITIVOS:
 *   `size` sigue por defecto en `md`, las dos uniones sólo crecen y ninguna clave del mapa
 *   desaparece, así que ningún consumidor actual cambia de aspecto.)
 * Modificado por: Andrés Miño — 2026-09-21 (los 15 estados del EPAS entran en el mapa, D-10)
 * Modificado por: Andrés Miño — 2026-11-04 (revisión 261030-m29, IN-09: `como="span"` para pintarlo
 *   dentro de un botón, donde un `div` no es contenido válido. ADITIVO: por defecto sigue `div`.)
 */
import { type FC } from "react";
import type { Priority } from "../../interfaces/IAlert";
import type { StatusMemorandum } from "../../interfaces/IDocument";
import { CHIP_ESTADO_EPAS, type EstadoEpas } from "../../config/estadosEpas";

type BadgetType =
  | "badge-error"
  | "badge-warning"
  | "badge-success"
  | "badge-primary"
  | "badge-secondary"
  | "badge-neutral"
  | "badge-info"
  | "badge-ghost"
  | "badge-soft badge-info";

/**
 * 🔴 `sm` lo añade la Fase 03.20 (C4 del contrato de UI), y no es una preferencia: entre `xs` y
 * `md` NO HABÍA escalón. Medido en daisyUI 5.5.19 (`components/badge.css`): `xs` son 16px de alto
 * con letra de 10px, `md` son 24px con letra de 14px, y `sm` —el que faltaba— son 20px con letra
 * de **12px**. La regla B11 del contrato padre 03.22 prohíbe por escrito cualquier cosa por debajo
 * de 12px, así que sin este escalón el chip de la tarjeta de despacho sólo podía ser ilegal (10px)
 * o desproporcionado (14px, más grande que el texto que lo acompaña dentro de 88px de alto).
 */
type sizes = "xs" | "sm" | "md" | "lg";

type Status =
  | "caducado"
  | "notificado"
  | "resuelto"
  | "enviado"
  | "asignado"
  | "reasignado"
  | "finalizado"
  | "por asignar";

/**
 * Señales de la CABECERA de las bandejas de Ejecución. No son estados del EPAS (esos llegan como
 * string libre y caen al badge "default" si no están mapeados): son marcas que el usuario necesita
 * ver SIN abrir el expediente.
 *   - "medida cautelar" → error/rojo: es la señal que CAMBIA LA PRIORIDAD del expediente.
 *   - "remitido"        → success: el gate RECE-08 (el director ya lo remitió al secretario).
 *   - "bloqueado"       → warning: el EPAS está bloqueado.
 */
type SenalBandeja = "medida cautelar" | "remitido" | "bloqueado";

/**
 * El estado de un DESPACHO de notificación (Fase 03.20). Son tres —`pendiente`, `notificado` y
 * `rechazado`— y los otros dos ya eran claves de este mapa por otras vías (`notificado` es una
 * señal de bandeja, `rechazado` un estado de memorando), así que el único que falta es éste.
 * Se declara aparte en vez de colarlo en `Status` porque no es un estado del EPAS ni una señal de
 * cabecera: es de la fila expandida del Gestor de Notificaciones, y su procedencia importa el día
 * que alguien se pregunte por qué existe la clave.
 */
type EstadoDespachoChip = "pendiente";

export type StatusAndPriority =
  | Priority
  | Status
  | StatusMemorandum
  | SenalBandeja
  | EstadoDespachoChip
  | EstadoEpas
  | "default";

export const BADGE_GROUPS: Record<StatusAndPriority, BadgetType> = {
  /**
   * 🔴 LOS 15 ESTADOS DEL EPAS, EN MAYÚSCULAS Y CON SUS GUIONES BAJOS (Fase 03.19, Plan 07, D-10).
   *
   * Hasta hoy ninguna clave de este mapa casaba con un estado del EPAS: las de abajo están en
   * minúsculas y sin guion bajo (`recibido`, `sorteado`), y el estado llega como
   * `EN_VERIFICACION_PAGO`. Los consumidores antiguos lo apañan pasando
   * `String(eejeStatus).toLowerCase()`, que cubre cuatro estados de quince y manda los otros once
   * al `?? BADGE_GROUPS.default` — el azul pálido, sin que nada falle.
   *
   * Se EXTIENDE este mapa, no se crea un segundo: es la doctrina escrita de `ObligacionesVivas`.
   * Los valores se vuelcan desde `CHIP_ESTADO_EPAS`, que vive junto a las etiquetas legibles en
   * `src/config/estadosEpas.ts`, para que color y texto del mismo estado no puedan separarse.
   *
   * ⚠️ Las claves en minúscula de abajo NO son estados del EPAS y se conservan: son las señales de
   * cabecera de las bandejas (`asignado`, `resuelto`, `remitido`…). Que `recibido` y `RECIBIDO`
   * convivan no es una duplicación — la primera es una señal, la segunda es el estado.
   *
   * ⚠️ Quien pinte uno de estos estados tiene que pasar `capitalize={false}`: varias etiquetas son
   * frases («En verificación de pago») y el `capitalize` por defecto las rompe en «En Verificación
   * De Pago». La columna ESTATUS de la bandeja la cablea el Plan 17.
   */
  ...CHIP_ESTADO_EPAS,
  /**
   * 🔴 `pendiente` — LA PÍLDORA PÁLIDA, Y NO EL CHIP POR DEFECTO (Fase 03.20, C4). Tres razones,
   * y la segunda es la que importa:
   *
   *   1. Es lo que la captura enseña: píldora pálida, sin color, texto oscuro.
   *   2. 🔴 Dejarlo caer al chip POR DEFECTO sería PEOR que no mapearlo. El chip por defecto es el
   *      de «no conozco este estado»; dándoselo a `pendiente`, un estado desconocido —o mal
   *      escrito— se vería IDÉNTICO al único estado sobre el que el secretario tiene que actuar.
   *      Es el modo de fallo que RESEARCH P-13 anticipa, movido un paso en vez de evitado. Hay una
   *      prueba con nombre propio que afirma que los dos chips NO son el mismo.
   *   3. Contraste MEDIDO a 12px: 10,6:1 en tema claro (`#26365f` sobre `#f1f3f6`) y 14,7:1 en
   *      oscuro (`#edf4ff` sobre `#121f40`). Y el significado no depende del color: lo lleva la
   *      palabra.
   */
  pendiente: "badge-ghost",
  caducado: "badge-error",
  notificado: "badge-secondary",
  resuelto: "badge-success",
  enviado: "badge-success",
  asignado: "badge-neutral",
  reasignado: "badge-warning",
  finalizado: "badge-info",
  "por asignar": "badge-warning",
  alta: "badge-error",
  media: "badge-warning",
  baja: "badge-success",
  default: "badge-soft badge-info",
  recibido: "badge-neutral",
  "en revisión": "badge-warning",
  "en sorteo": "badge-warning",
  sorteado: "badge-info",
  aprobado: "badge-success",
  rechazado: "badge-error",
  "medida cautelar": "badge-error",
  remitido: "badge-success",
  bloqueado: "badge-warning",
};

type badgePriorityProps = {
  text: string | undefined;
  // Se acepta cualquier string (p. ej. estados EPAS dinámicos: recibido, verificado,
  // sorteado, …); los no mapeados caen al badge "default".
  priority: string;
  size?: sizes;
  /**
   * Los badges de ESTADO son una palabra y se ven mejor capitalizados (default, sin cambios). Los de
   * la cabecera de las bandejas son FRASES ("Remitido por el director", "Retiro de bienes/productos");
   * con `capitalize` el CSS los rompe en "Remitido Por El Director". `false` los deja tal cual.
   */
  capitalize?: boolean;
  /**
   * Elemento que lo envuelve. `span` dentro de un `<button>` (un `div` no es contenido válido de un
   * botón); por defecto `div`, así que ningún consumidor actual cambia.
   */
  como?: "div" | "span";
};

const BadgePriority: FC<badgePriorityProps> = ({
  text,
  priority,
  size = "md",
  capitalize = true,
  como: Elemento = "div",
}) => {
  if (!text) {
    return null;
  }

  const badgeType =
    BADGE_GROUPS[priority as StatusAndPriority] ?? BADGE_GROUPS.default;

  return (
    <Elemento
      className={`badge ${badgeType} badge-${size} ${capitalize ? "capitalize" : ""} whitespace-nowrap h-auto`}
    >
      {text}
    </Elemento>
  );
};

export default BadgePriority;
