/**
 * Microservicio: resolucion
 * Módulo: N/A
 * Feature: Alert
 * Archivo: Alert.tsx
 * Responsabilidad: Renderizar alertas reutilizables con variantes parametrizables (error, warning, success, info)
 * Desarrollador: Johan Freire
 * Fecha: 2026-04-14
 * Modificado por: Andrés Miño — 2026-10-21 (Fase 03.24, cierre de huecos G-01)
 * Modificado por: Andrés Miño — 2026-10-28 (quick 261028-kmg: la regla de mensajes, escrita aquí; el
 *   componente no cambia)
 *
 * REGLA DE MENSAJES (quick 261028-kmg, decisión del usuario 2026-10-28)
 *   Que el usuario sepa siempre dónde mirar —el campo si el remedio es teclear, el aviso flotante si
 *   es el resultado de lo que pulsó— y que nada se le diga dos veces.
 *   1. CAMPO — un error que pertenece a un campo (validación, dato obligatorio, la clave de firma
 *      rechazada APP-FIRMA-CLAVE-001) se dice SOLO bajo ese campo, con `aria-invalid` y el foco en
 *      él, y se retira al editarlo.
 *   2. FLOTANTE — todo lo demás que es RESULTADO de una acción (éxito, error del servidor o de
 *      negocio) se dice SOLO en el aviso flotante (`useToast().addToast`), que sale por encima de los
 *      modales. Los de error y advertencia se quedan hasta que el usuario los cierra; los de éxito e
 *      información se van solos.
 *   3. Ninguna caja de este componente informa del resultado de una acción. Alert solo sirve para:
 *      3a. ESTADO — avisos que describen el caso o la vista (están ahí al abrir, o cambian con el
 *          contenido y no con lo último pulsado): informativos, guardas del caso, la previa
 *          desfasada, las notas de una vista de RESULTADO que enseña datos calculados por el
 *          servidor.
 *      3b. CARGA — el fallo al CARGAR lo que la vista enseña (una lista, un panel, los datos de un
 *          modal al abrirse) va EN EL HUECO de ese contenido, una vez, con «Reintentar» si existe, y
 *          NO se repite en un aviso flotante; mientras falla no se pinta el vacío («No hay…»).
 */
import { type FC } from "react";
import Iconos from "./Iconos";
import Boton from "./Boton";

export type AlertVariant = "error" | "warning" | "success" | "info";

type AlertProps = {
  variant: AlertVariant;
  message: string;
  className?: string;
  icon?: string;
  buttonFunction?: () => void;
  /**
   * El `role` del contenedor (Fase 03.24, IN-02). Por defecto `"alert"`, que es asertivo: el lector
   * de pantalla interrumpe lo que esté diciendo. Un aviso que ya está ahí al abrir no es un evento
   * y va con `"note"`; uno que cambia por lo que el usuario acaba de pulsar va con `"status"`, que
   * se anuncia sin interrumpir. Es aditivo: los llamadores que no lo pasan no cambian.
   */
  rol?: "alert" | "status" | "note";
};

// Mapeo de variantes a clases Tailwind DaisyUI
const VARIANT_CLASSES: Record<AlertVariant, string> = {
  error: "alert alert-error",
  warning: "alert alert-warning",
  success: "alert alert-success",
  info: "alert alert-info",
};

const BUTTON_CLASSES: Record<AlertVariant, string> = {
  error: "btn-error",
  warning: "btn-warning",
  success: "btn-success",
  info: "btn-info",
};

// Mapeo de variantes a iconos predeterminados
const VARIANT_ICONS: Record<AlertVariant, string> = {
  error: "cerrar", // faCircleXmark
  warning: "advertencia", // puedes cambiar a otro ícono disponible
  success: "resolucion", // faFileCircleCheck
  info: "informacion", // será mapeado a otro ícono si es necesario
};

const Alert: FC<AlertProps> = ({
  variant,
  message,
  className,
  icon,
  buttonFunction,
  rol = "alert",
}) => {
  const alertClass = className || VARIANT_CLASSES[variant];
  const iconName = icon || VARIANT_ICONS[variant];
  const buttonClass = BUTTON_CLASSES[variant];

  return (
    <div
      role={rol}
      className={alertClass}
    >
      <Iconos nombre={iconName} />
      <span>{message}</span>

      {buttonFunction && (
        <Boton
          texto="Reintentar"
          estilos={`btn btn-sm  ${buttonClass}`}
          onClick={buttonFunction}
          deshabilitado={false}
        />
      )}
    </div>
  );
};

export default Alert;
