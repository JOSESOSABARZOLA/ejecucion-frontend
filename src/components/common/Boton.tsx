/**
 * Microservicio: resolucion
 * Módulo: N/A
 * Feature: Boton
 * Archivo: Boton.tsx
 * Responsabilidad: Renderizar el botón corespondiente a las configuraciones enviadas
 * Desarrollador: Johan Freire
 * Fecha: 2026-03-19
 * Modificado por: Andrés Miño — 2026-09-21 (Fase 03.19, Plan 08: dos props OPCIONALES para poder
 *   nombrar un botón que solo lleva icono. Sin ellas, `<Boton icono="mirar" />` se anuncia
 *   literalmente «botón» y la columna ACCIONES de la bandeja es «botón, botón, botón» para quien
 *   usa lector de pantalla. Son aditivas: ninguno de sus consumidores actuales cambia.)
 */
import { type FC, type MouseEvent } from "react";
import Iconos from "./Iconos";

type BotonProps = {
  indicativo?: { activo: boolean; cantidad: number };
  deshabilitado: boolean;
  estilos: string;
  icono?: string;
  /**
   * Nombre accesible del botón (`aria-label`). OBLIGATORIO en la práctica cuando no hay `texto`:
   * un botón de solo icono sin esto no se puede nombrar, ni buscar, ni decir en voz alta.
   */
  etiquetaAccesible?: string;
  /** Lo que se ve al pasar el ratón (`title`). Complementa a `etiquetaAccesible`, no lo sustituye. */
  titulo?: string;
  // El evento se expone (opcional) para que el consumidor pueda p. ej. preventDefault/stopPropagation
  // cuando el botón vive dentro de un <summary> (cards colapsables). Compatible con handlers `() => void`.
  onClick?: (e?: MouseEvent<HTMLButtonElement>) => void;
  texto?: string;
};

const Boton: FC<BotonProps> = ({
  indicativo,
  deshabilitado,
  estilos,
  icono,
  onClick,
  texto,
  etiquetaAccesible,
  titulo,
}) => {
  // console.log("Renderizado Boton");

  return (
    <>
      <button
        onClick={onClick}
        className={estilos}
        disabled={deshabilitado}
        aria-label={etiquetaAccesible}
        // `aria-disabled` además de `disabled`: el primero apaga el control, el segundo es lo que
        // hace que el lector lo ANUNCIE apagado en vez de callárselo.
        aria-disabled={deshabilitado ? true : undefined}
        title={titulo}
      >
        {icono && <Iconos nombre={icono} />}
        {texto && <span>{texto}</span>}

        {/* Este indicativo solo sirve para mostrar el número de avisos que no han sido leidos */}
        {indicativo?.activo && indicativo.cantidad > 0 && (
          <div className="badge badge-warning badge-xs absolute top-0 right-0">
            {/* <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-75"></span> */}
            {/* {indicativo.cantidad > 5 ? "+5" : indicativo.cantidad} */}
            {indicativo.cantidad}
          </div>
        )}
      </button>
    </>
  );
};

export default Boton;
