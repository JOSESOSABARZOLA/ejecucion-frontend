/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/infracciones (frontend)
 * Feature: El lote de Resolución, de verdad — el aviso de datos de Resolución incompletos
 *   (Fase 03.24, Plan 11, D-05)
 * Archivo: AvisoDatosResolucion.tsx
 * Responsabilidad: Pintar «Datos de Resolución incompletos» (D-05) cuando el SERVIDOR dice que a un
 *   EPAS venido de Resolución le faltan datos, con la lista de lo que falta. Lo montan la Bandeja de
 *   Entrada y «Mis expedientes» (variante `badge`, en la celda de infracciones) y la ficha del
 *   expediente (variante `alerta`, al principio de la pestaña de información).
 * Desarrollador: Andrés Miño
 * Fecha: 2026-10-20
 *
 * ── 🔴 ESTE COMPONENTE NO DECIDE NADA. TRADUCE ────────────────────────────────────────────────
 * Qué falta lo calcula el backend en UN fragmento SQL (`resolucion-faltantes.sql.ts`, Plan 10) y lo
 * manda como `datosResolucionFaltantes`: `null` si el EPAS no vino de Resolución, `[]` si vino y no
 * falta nada, y una lista de códigos si falta algo. Aquí no se mira ningún importe, ninguna fecha ni
 * ningún campo del expediente: si mañana cambia la regla, cambia en el servidor y este archivo no se
 * entera. Una prueba lee este fuente para afirmarlo.
 *
 * ── CONVIVE CON `CeldaInfracciones`, NO LA SUSTITUYE ──────────────────────────────────────────
 * «Sin caso enlazado» / «Sin infracciones» / «Descuadre» siguen saliendo de `CeldaInfracciones`
 * (Fase 03.23). Este aviso va DEBAJO, en la misma celda, y solo informa: no bloquea nada por sí
 * mismo (el trabajo comunitario sin infracciones lo sigue bloqueando la regla de la 03.23).
 *
 * ── TEXTOS Y COLORES ─────────────────────────────────────────────────────────────────────────
 * El badge es `BadgePriority` con la ranura `media`, como el «Descuadre»: no se inventa otro sistema
 * de etiquetas. La alerta es el `Alert` común en variante `warning`. Los textos viven en
 * `datosResolucion.ts`, porque exportarlos desde aquí dispara `react-refresh/only-export-components`.
 * Un código que no está en `ETIQUETA_FALTANTE_RESOLUCION` se enseña tal cual (degradación honesta):
 * React lo escapa como texto, así que un código raro nunca se interpreta como marcado (T-03.24-40).
 */
import type { FC } from "react";
import Alert from "../common/Alert";
import BadgePriority from "../common/BadgePriority";
import {
  ETIQUETA_FALTANTE_RESOLUCION,
  TEXTO_DATOS_RESOLUCION_INCOMPLETOS,
} from "./datosResolucion";

type AvisoDatosResolucionProps = {
  /**
   * `datosResolucionFaltantes` tal como lo mandó el servidor. Ausente (caso THIN), `null` (no vino
   * de Resolución) o vacío (no falta nada) ⇒ no se pinta nada.
   */
  faltantes?: string[] | null;
  /** `badge` en las filas de las bandejas (por defecto); `alerta` en la ficha. */
  variante?: "badge" | "alerta";
};

/** Traduce un código; el desconocido se devuelve tal cual. */
const etiqueta = (codigo: string): string =>
  ETIQUETA_FALTANTE_RESOLUCION[codigo] ?? codigo;

/** El aviso de D-05: no pinta nada si no hay nada que avisar. */
const AvisoDatosResolucion: FC<AvisoDatosResolucionProps> = ({
  faltantes,
  variante = "badge",
}) => {
  if (!faltantes || faltantes.length === 0) {
    return null;
  }

  const lista = faltantes.map(etiqueta).join(", ");
  const detalle = `Falta: ${lista}`;

  if (variante === "alerta") {
    return (
      <Alert
        variant="warning"
        message={`${TEXTO_DATOS_RESOLUCION_INCOMPLETOS}. ${detalle}.`}
      />
    );
  }

  return (
    <span
      className="inline-flex items-center"
      title={`${TEXTO_DATOS_RESOLUCION_INCOMPLETOS}. ${detalle}`}
    >
      <BadgePriority
        text={TEXTO_DATOS_RESOLUCION_INCOMPLETOS}
        priority="media"
        size="sm"
        capitalize={false}
      />
      <span className="sr-only">{`${detalle}.`}</span>
    </span>
  );
};

export default AvisoDatosResolucion;
