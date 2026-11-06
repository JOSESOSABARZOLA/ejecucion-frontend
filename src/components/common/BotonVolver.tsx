/**
 * Microservicio: ejecucion
 * Módulo: App Shell
 * Feature: El botón de vuelta de una página (quick 261014-lhu)
 * Archivo: BotonVolver.tsx
 * Responsabilidad: Pintar el botón de «Volver» de una página con UN solo aspecto en toda la app.
 *
 *   ── POR QUÉ EXISTE ───────────────────────────────────────────────────────────────────────────
 *   Dos páginas ofrecen ya el mismo botón de vuelta: el asistente de generación de documentos y la
 *   ficha de la obligación de hacer. Si cada una escribe su propio marcado, el día que una cambie
 *   de clase el usuario ve dos «Volver» distintos para el mismo gesto. Este componente es el
 *   marcado que pintaba el asistente, tal cual (un `div` que envuelve un `Boton` de contorno
 *   primario, nunca deshabilitado), para que las dos lo compartan.
 *
 *   ── 🔴 NO NAVEGA POR SU CUENTA ───────────────────────────────────────────────────────────────
 *   El componente no sabe de rutas: recibe `onVolver` y lo llama. El DESTINO lo decide cada página
 *   —el asistente, por el origen que trae en la query; la ficha, por el rol de quien la lee—, que
 *   es quien tiene los datos para decidirlo. Meter aquí la navegación obligaría a este componente a
 *   conocer las dos reglas, y a la siguiente página a tocarlo para añadir la suya.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-10-14
 */
import Boton from "./Boton";

type BotonVolverProps = {
  /** El rótulo del botón, que dice A DÓNDE se vuelve (p. ej. «Volver a Mis Expedientes»). */
  texto: string;
  /** Qué hacer al pulsarlo. La página decide el destino; el componente solo lo dispara. */
  onVolver: () => void;
};

const BotonVolver = ({ texto, onVolver }: BotonVolverProps) => (
  <div>
    <Boton
      estilos="btn btn-outline btn-primary"
      texto={texto}
      deshabilitado={false}
      onClick={() => onVolver()}
    />
  </div>
);

export default BotonVolver;
