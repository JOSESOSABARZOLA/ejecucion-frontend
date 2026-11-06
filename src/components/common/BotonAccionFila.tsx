/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/sorteo (frontend)
 * Feature: Los botones de icono de la columna ACCIONES de la bandeja (Fase 03.19, Plan 08, D-11)
 * Archivo: BotonAccionFila.tsx
 * Responsabilidad: Ser el `👁` y el `⑂` de la fila —y cualquier otro botón de solo icono que una
 *   tabla necesite— con las dos cosas que `ActionButton` no hacía y que no se ven mirando la
 *   pantalla:
 *
 *   ── 🔴 1. NOMBRE ACCESIBLE, SIEMPRE ─────────────────────────────────────────────────────────
 *   Un `<button>` sin texto y sin `aria-label` se anuncia «botón». La columna ACCIONES de la
 *   bandeja es hoy, literalmente, «botón, botón, botón» para quien usa lector de pantalla: las
 *   tres acciones existen, se pueden pulsar y ninguna dice cuál es. La etiqueta lleva además el
 *   número de expediente («Ver expediente EXP-183») porque en una tabla de veinte filas «Ver
 *   expediente» a secas tampoco distingue nada.
 *
 *   ── 🔴 2. EL TOOLTIP APARECE CUANDO HACE FALTA, QUE ES AL REVÉS DE HOY ──────────────────────
 *   `ActionButton.tsx` vacía el texto del tooltip cuando la acción está deshabilitada, que es el
 *   ÚNICO momento en que el usuario pregunta «¿por qué no puedo?». Aquí la regla es la inversa:
 *   **motivo cuando está apagada, etiqueta cuando no**. Y el `data-tip` va en el DIV ENVOLTORIO,
 *   no en el botón: un `<button disabled>` no recibe eventos de puntero, así que un tooltip
 *   colgado de él no se dispararía nunca por mucho texto que tuviera.
 *
 *   ── EL MOTIVO VIENE DE FUERA ────────────────────────────────────────────────────────────────
 *   Igual que en `MenuAccionesCaso`: quien apaga la acción sabe por qué —el motor, con el motivo
 *   de su catálogo—. Este componente no decide ni redacta; lo pinta.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-09-21
 */
import type { FC } from "react";
import Boton from "./Boton";

type BotonAccionFilaProps = {
  /** Nombre del `iconoMap` (`Iconos.tsx`). */
  icono: string;
  /**
   * Lo que el botón ES, en palabras. Va al `aria-label` y al `title`, y es el tooltip mientras la
   * acción está habilitada. Incluya el identificador de la fila: «Ver expediente EXP-183».
   */
  etiqueta: string;
  onClick: () => void;
  deshabilitado?: boolean;
  /** Por qué está apagada. Sustituye a la etiqueta en el tooltip mientras lo esté. */
  motivo?: string;
  /**
   * Hacia dónde sale el tooltip. `tooltip-left` para el botón que queda pegado al borde derecho de
   * la columna fijada, donde uno hacia abajo o hacia la derecha se saldría de la tabla.
   *
   * 🔴 Y dentro de una tabla con columnas fijadas, `tooltip-left` no es sólo para el botón del
   * borde: es para TODOS (Fase 03.22, Plan 08, gap 4 del UAT). El valor por defecto saca la burbuja
   * a 0,5rem por DEBAJO del botón, y una fila no tiene tanto relleno: la burbuja cae entera en la
   * banda de la fila SIGUIENTE, donde su celda fija empata en capa y gana por orden del documento
   * —se ve cubierta—, y en la última fila visible cruza el borde del contenedor con scroll —se ve
   * cortada—. Saliendo de lado queda centrada en el botón y no abandona la banda de su fila.
   * El valor por defecto NO se cambia: lo comparten pantallas sin columnas fijadas.
   */
  posicionTooltip?:
    | "tooltip-bottom"
    | "tooltip-top"
    | "tooltip-left"
    | "tooltip-right";
  /** Para el caso raro en que una tabla necesite otro tamaño o tono. Por defecto, el de la fase. */
  estilos?: string;
};

/**
 * 40×40 (`btn-md`) y no `btn-sm`: es el destino táctil mínimo. El UI-SPEC lo deja escrito porque la
 * tentación, cuando la fila se ve apretada, es justamente bajarlo.
 */
const ESTILOS_POR_DEFECTO = "btn btn-soft btn-primary btn-md";

const BotonAccionFila: FC<BotonAccionFilaProps> = ({
  icono,
  etiqueta,
  onClick,
  deshabilitado = false,
  motivo,
  posicionTooltip = "tooltip-bottom",
  estilos = ESTILOS_POR_DEFECTO,
}) => (
  // 🔴 El `data-tip` va AQUÍ, en el envoltorio, no en el botón. Ver la cabecera.
  <div
    className={`tooltip ${posicionTooltip}`}
    data-tip={deshabilitado ? (motivo ?? etiqueta) : etiqueta}
  >
    <Boton
      estilos={estilos}
      icono={icono}
      deshabilitado={deshabilitado}
      etiquetaAccesible={etiqueta}
      titulo={etiqueta}
      onClick={(e) => {
        // Estos botones viven en la celda de una fila que, según la pantalla, puede tener su propio
        // manejador de clic (abrir la ficha, desplegar la card). El clic de la acción se queda aquí.
        e?.stopPropagation();
        onClick();
      }}
    />
  </div>
);

export default BotonAccionFila;
