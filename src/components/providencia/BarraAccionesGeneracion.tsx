/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/providencias (frontend)
 * Feature: La barra de acciones de la página de generación (Fase 03.19, Plan 13, D-12)
 * Archivo: BarraAccionesGeneracion.tsx
 * Responsabilidad: Los cinco controles del pie de la página de generación —Cancelar, Atrás, Ver
 *   borrador, Siguiente y Generar documento— con su visibilidad por paso y su jerarquía.
 *
 *   ── DÓNDE VA, Y POR QUÉ NO EN LA CABECERA (UI-SPEC §4.1) ────────────────────────────────────
 *   En la rama de Resolución esta barra se monta dentro de la cabecera de página, por su prop de
 *   acciones. Aquí va **al pie de la sección, fija abajo**, por dos motivos:
 *     · nuestra cabecera de página NO tiene esa prop, y añadírsela toca 24 páginas; y
 *     · el pie es mejor sitio que una esquina superior para el botón que cierra un acto
 *       administrativo —el decisor llega a él leyendo, no buscándolo—.
 *   Es decisión de esta fase y queda escrita aquí para que no se vuelva a discutir.
 *
 *   ── 🔴 UN SOLO BOTÓN PRIMARIO SÓLIDO A LA VEZ (UI-SPEC §4.3) ────────────────────────────────
 *   «Siguiente» y «Generar documento» **nunca coexisten**, y la exclusión no se consigue con dos
 *   condiciones paralelas que un día se solapen: el primario es **UN solo botón**, y lo que cambia
 *   con el paso es su rótulo y su acción. Dos primarios sólidos a la vez dejarían al decisor
 *   eligiendo entre «seguir» y «emitir» con el mismo peso visual, y uno de los dos es irreversible.
 *   («Ver borrador» es primario en su variante de CONTORNO, que es otra jerarquía: no compite.)
 *
 *   ── CÓMO SE CONECTA CON EL COMPOSITOR (para el plan 16) ─────────────────────────────────────
 *   `CompositorProvidencia` acepta `renderBarraAcciones?: (acciones: AccionesCompositor) => ReactNode`
 *   y, cuando la recibe, SUSTITUYE su barra por lo que devuelva. Esta barra está hecha para
 *   encajar ahí sin adaptador: recibe el objeto `AccionesCompositor` ENTERO, tal y como llega.
 *
 *   ```tsx
 *   <CompositorProvidencia
 *     caso={caso}
 *     paso={paso}
 *     onCancelar={pedirAbandono}
 *     renderBarraAcciones={(acciones) => (
 *       <BarraAccionesGeneracion
 *         paso={paso}
 *         acciones={acciones}
 *         onAtras={() => setPaso(anterior(paso))}
 *         onSiguiente={validarYAvanzar}
 *         motivoSiguienteBloqueado={motivoDelPasoSiguiente}
 *       />
 *     )}
 *   />
 *   ```
 *
 *   Lo que la barra toma de `AccionesCompositor` y lo que NO:
 *     · `cancelar`, `alternarPrevia`, `pedirConfirmacion` — se usan tal cual. `pedirConfirmacion`
 *       **abre la confirmación, no emite**: emitir es lo que se confirma dentro del compositor.
 *     · `emitiendo`, `tipoElegido`, `puedeEmitir`, `previaAbierta` — gobiernan apagados y rótulos.
 *     · `motivosNoEmitir` — qué falta para emitir; con «Generar documento» apagado, sus textos van
 *       en el `title` del botón (el texto visible lo pinta la página junto a la barra).
 *     · `onAtras` y `onSiguiente` NO salen del compositor y no pueden salir: el compositor no sabe
 *       en qué paso está la página ni qué la deja avanzar. Los pone la página, que es quien tiene
 *       el stepper.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-09-21
 * Modificado por: Andrés Miño — 2026-10-06 (quick 261006-dw9 — UAT 03.15 paso 8: «Generar documento»
 *   estaba apagado y no decía qué faltaba). Su `title` deja de ser `undefined` en el paso 4: lleva
 *   los motivos de `motivosNoEmitir`. Los pasos 1-3 no cambian.
 */
import type { FC } from "react";
import Boton from "../common/Boton";
import type { AccionesCompositor } from "./CompositorProvidencia";
import type { PasoGeneracion } from "./GeneracionStepper";

/** Texto del primario mientras hay una emisión en vuelo (UI-SPEC §4.3). */
const TEXTO_GENERANDO = "Generando…";

export interface PropsBarraAccionesGeneracion {
  /** El paso en que está la página. Decide qué se ve y qué hace el primario. */
  paso: PasoGeneracion;
  /** Lo que `CompositorProvidencia` entrega a `renderBarraAcciones`, sin tocar. */
  acciones: AccionesCompositor;
  /** Retroceder un paso. Lo resuelve la página: el stepper no guarda estado. */
  onAtras: () => void;
  /** Validar y avanzar. La página decide si se puede; aquí solo se dispara. */
  onSiguiente: () => void;
  /**
   * Por qué «Siguiente» no puede avanzar todavía. Si viene, el botón queda apagado **y lo dice**
   * — apagar un botón sin decir qué falta es el modo de fallo que UI-SPEC §6/A9 prohíbe en el
   * stepper, y no mejora por estar en una barra.
   */
  motivoSiguienteBloqueado?: string;
}

const BarraAccionesGeneracion: FC<PropsBarraAccionesGeneracion> = ({
  paso,
  acciones,
  onAtras,
  onSiguiente,
  motivoSiguienteBloqueado,
}) => {
  const { previaAbierta, emitiendo, tipoElegido, puedeEmitir } = acciones;
  const motivosNoEmitir = acciones.motivosNoEmitir ?? [];

  // La visibilidad del contrato (UI-SPEC §4.3): Cancelar 1-4, Atrás 2-4, Ver borrador 2-4,
  // Siguiente 1-3, Generar documento 4.
  const esPasoFinal = paso === 4;
  const verAtras = paso > 1;
  const verBorrador = paso > 1;

  return (
    <div
      // Fija al pie de la sección, no en la cabecera. `sticky` y no `fixed`: la barra pertenece a
      // la sección del formulario, y con `fixed` taparía el pie de página del resto del módulo.
      //
      // Solo utilidades y tokens de tema: NINGUNA clase propia. La barra no necesita más que un
      // fondo opaco y un filete —sin fondo opaco, el formulario se le vería por debajo al hacer
      // scroll—, y una clase nueva en la hoja de estilos por eso sería una clase que mañana nadie
      // sabe para qué está. Los colores salen de `base-100` / `base-300`, así que los dos temas
      // quedan cubiertos sin escribir un solo hex.
      className="sticky bottom-0 z-10 flex flex-wrap items-center justify-end gap-2 rounded-b-xl border-t border-base-300 bg-base-100 px-4 py-3"
    >
      <Boton
        estilos="btn btn-ghost"
        texto="Cancelar"
        deshabilitado={emitiendo}
        onClick={acciones.cancelar}
      />

      {verAtras && (
        <Boton
          estilos="btn btn-outline"
          texto="Atrás"
          deshabilitado={emitiendo}
          onClick={onAtras}
        />
      )}

      {/* Basta con haber elegido el tipo: se previsualiza un borrador a medio llenar, que es justo
          para lo que sirve. Que salga NO significa que se pueda emitir — la vista previa no
          comprueba las reglas del acto. El rótulo alterna, como en el modal, porque un botón que
          cierra el panel llamándose «Ver borrador» miente. */}
      {verBorrador && (
        <Boton
          estilos="btn btn-outline btn-primary"
          texto={previaAbierta ? "Ocultar borrador" : "Ver borrador"}
          deshabilitado={!tipoElegido || emitiendo}
          titulo={
            !tipoElegido
              ? "Elija el tipo de providencia para ver el borrador."
              : undefined
          }
          onClick={acciones.alternarPrevia}
        />
      )}

      {/* 🔴 EL ÚNICO PRIMARIO SÓLIDO. Es un solo control: lo que cambia con el paso es su rótulo,
          su acción y su condición. Así la exclusión no depende de que dos condiciones sigan siendo
          complementarias dentro de seis meses. */}
      <Boton
        estilos="btn btn-primary"
        texto={
          emitiendo
            ? TEXTO_GENERANDO
            : esPasoFinal
              ? "Generar documento"
              : "Siguiente"
        }
        deshabilitado={
          emitiendo ||
          (esPasoFinal ? !puedeEmitir : !!motivoSiguienteBloqueado)
        }
        // El `title` es el canal del RATÓN. El texto visible —que es el que alcanza el teclado y el
        // lector de pantalla— lo pinta la página junto a la barra, para «Siguiente» y para
        // «Generar documento» por igual (quick 261006-dw9). Antes, en el paso 4, aquí iba
        // `undefined` y el botón se apagaba sin decir por qué.
        titulo={
          esPasoFinal
            ? !puedeEmitir && !emitiendo && motivosNoEmitir.length > 0
              ? motivosNoEmitir.map((motivo) => motivo.texto).join(" ")
              : undefined
            : (motivoSiguienteBloqueado ?? undefined)
        }
        onClick={esPasoFinal ? acciones.pedirConfirmacion : onSiguiente}
      />
    </div>
  );
};

export default BarraAccionesGeneracion;
