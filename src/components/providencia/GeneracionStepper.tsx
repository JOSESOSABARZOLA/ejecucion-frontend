/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/providencias (frontend)
 * Feature: El stepper de 4 pasos de la página de generación de documentos (Fase 03.19, Plan 13)
 * Archivo: GeneracionStepper.tsx
 * Responsabilidad: Enseñar los cuatro pasos del acto —Información General, Edición del Documento,
 *   Notificación y Firma—, decir dónde está el decisor y dejarle volver a lo ya hecho.
 *
 *   ── DE DÓNDE VIENE ──────────────────────────────────────────────────────────────────────────
 *   Porte de `resolucion-frontend @ origin/dev` —
 *   `src/features/document-generation/components/DocumentGenerationStepper.tsx` (98 líneas). Es la
 *   pieza de MENOR superficie de las que esta fase trae de aquella rama: **solo importa React**, no
 *   arrastra la arquitectura de carpetas de aquel repo, ni Redux, ni un servicio. Todo lo que la
 *   pinta es CSS, y ese CSS vive en
 *   `src/styles/administration/administration-docs-generate-page.css`.
 *   (Los alias de esa arquitectura no se citan aquí ni siquiera como ejemplo: la guarda A de
 *   `npm run guard:arquitectura` también lee los comentarios, y con razón — un alias prohibido
 *   escrito en una cabecera es el primer paso para escribirlo en un `import`.)
 *   Lo que se le AÑADIÓ al portarlo está marcado abajo, regla por regla, porque el original no
 *   cumplía dos cosas que UI-SPEC §4.2 y §6 exigen aquí (el motivo del bloqueo y el bloqueo global
 *   mientras se emite).
 *
 *   ── 🔴 EL ESTADO NO VIVE AQUÍ ───────────────────────────────────────────────────────────────
 *   Este componente **no decide** nada del documento: no sabe qué se ha redactado, ni si el tipo
 *   está elegido, ni si el cuerpo está vacío. Todo eso vive en `CompositorProvidencia` y lo
 *   gobierna la página (plan 16). El stepper solo decide **qué se ve**. Y —esto es el contrato que
 *   el plan 16 tiene que respetar— **los pasos ocultos se OCULTAN, no se desmontan**
 *   (`app-modules-docs-page-step-hidden`, `display:none`): desmontarlos perdería lo redactado al
 *   volver atrás, que es justo el modo de fallo que UI-SPEC §4.2 prohíbe.
 *
 *   ── LAS REGLAS DE NAVEGACIÓN, Y SU PORQUÉ (UI-SPEC §4.2) ────────────────────────────────────
 *   · **Hacia atrás, siempre libre** a cualquier paso ya alcanzado. Volver **no borra nada** y **no
 *     baja** `pasoMaximoAlcanzable`, que es **monótono**: una vez ganado un paso, no se pierde. Si
 *     bajara, el decisor que retrocede a corregir una coma perdería el derecho a seguir.
 *   · **Hacia adelante**, solo hasta `pasoMaximoAlcanzable`. Quien impone esa cota es la página, no
 *     este componente; aquí solo se obedece (T-03.19-56: el servidor vuelve a validar al emitir).
 *   · 🔴 **Un paso bloqueado NO desaparece**: se ve, se apaga, se anuncia apagado y **dice qué
 *     falta**. Esconderlo haría creer que el acto termina antes de lo que termina.
 *
 *   ── 🔴 Y EL MOTIVO TIENE QUE PODER OÍRSE ────────────────────────────────────────────────────
 *   El original de la rama ponía el paso en `disabled` y nada más. `title` es un tooltip de ratón:
 *   un botón `disabled` ni recibe el foco, así que por teclado el motivo era inalcanzable. Aquí el
 *   motivo viaja por DOS caminos —`title` para el ratón y un texto asociado con `aria-describedby`
 *   para el lector de pantalla— y los dos dicen lo mismo. Es UI-SPEC §6/A9: «un paso inalcanzable
 *   dice por qué», no «parece apagado».
 *
 *   ⚠️ Los textos de apoyo van FUERA del `<button>`, no dentro: dentro, el nombre accesible del
 *   paso se convertiría en «Edición del Documento Complete «Información General» para continuar.»,
 *   que es una etiqueta, no una descripción.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-09-21
 */
import React, { useId } from "react";

/**
 * Los cuatro pasos del acto. Es el mismo dominio que `PasoCompositor` de
 * `CompositorProvidencia.tsx`, y a propósito: lo que el stepper marca como activo es exactamente lo
 * que el compositor recibe en su prop `paso`.
 */
export type PasoGeneracion = 1 | 2 | 3 | 4;

/** Los rótulos del contrato (UI-SPEC §4.2). El orden ES el del acto: no se reordenan. */
const PASOS: { paso: PasoGeneracion; rotulo: string }[] = [
  { paso: 1, rotulo: "Información General" },
  { paso: 2, rotulo: "Edición del Documento" },
  { paso: 3, rotulo: "Notificación" },
  { paso: 4, rotulo: "Firma" },
];

/** Lo que se dice cuando hay una emisión en vuelo: el stepper entero queda quieto (UI-SPEC §4.3). */
const MOTIVO_GENERANDO = "El documento se está generando; espere a que termine.";

export interface PropsGeneracionStepper {
  /** El paso que se está viendo. Se marca con `aria-current="step"`. */
  pasoActivo: PasoGeneracion;
  /**
   * Hasta dónde se puede llegar AHORA. Este componente no guarda ni corrige nada: lo calcula quien
   * lo monta. En la página de generación lo GANADO es monótono y lo guarda la página, pero lo que
   * llega aquí puede bajar mientras la salida de un paso anterior esté cerrada (quick 261006-dw9).
   */
  pasoMaximoAlcanzable: PasoGeneracion;
  /** Salto a un paso ya alcanzado. Nunca se llama con un paso bloqueado. */
  onCambiarPaso: (paso: PasoGeneracion) => void;
  /**
   * Qué le falta al decisor para alcanzar cada paso. Opcional: sin entrada propia se dice, al
   * menos, cuál es el paso que hay que completar antes —callarse no es una opción—.
   */
  motivosBloqueo?: Partial<Record<PasoGeneracion, string>>;
  /** Hay una emisión en vuelo: todo queda apagado, con su motivo (UI-SPEC §4.3). */
  bloqueado?: boolean;
}

/**
 * Los tres estados del punto (UI-SPEC §4.2). El CSS base de `is-active` / `is-complete` /
 * `is-pending` YA EXISTE en `administration-modal-shared.css` y sus dos temas: aquí no se reinventa.
 */
const estadoDelPaso = (
  paso: PasoGeneracion,
  pasoActivo: PasoGeneracion,
  pasoMaximoAlcanzable: PasoGeneracion,
): "is-active" | "is-complete" | "is-pending" => {
  if (paso === pasoActivo) return "is-active";
  if (paso < pasoMaximoAlcanzable) return "is-complete";
  return "is-pending";
};

/**
 * El motivo por defecto nombra el paso ANTERIOR, que es la condición que de verdad falta: para
 * llegar al 3 hay que haber terminado el 2. «Este paso no está disponible» no sirve de nada.
 */
const motivoPorDefecto = (paso: PasoGeneracion): string => {
  const anterior = PASOS.find((entrada) => entrada.paso === paso - 1);
  return anterior
    ? `Complete «${anterior.rotulo}» para continuar.`
    : "Este paso todavía no está disponible.";
};

const GeneracionStepper: React.FC<PropsGeneracionStepper> = ({
  pasoActivo,
  pasoMaximoAlcanzable,
  onCambiarPaso,
  motivosBloqueo,
  bloqueado = false,
}) => {
  // Un prefijo propio por instancia: si algún día hubiera dos steppers en la pantalla, sus
  // `aria-describedby` no se pisarían.
  const prefijo = useId();

  /**
   * Todo lo derivado se calcula ANTES de pintar: los motivos hay que pintarlos en un sitio
   * (el `<button>`, como `title`) y en otro (el texto asociado, fuera del botón), y calcularlos
   * dentro del `map` obligaría a que el orden de evaluación del JSX fuera el que los junta.
   */
  const pasos = PASOS.map(({ paso, rotulo }, indice) => {
    const inalcanzable = paso > pasoMaximoAlcanzable;
    const apagado = bloqueado || inalcanzable;

    // El motivo: primero el de la emisión en vuelo —que manda sobre todo—, luego el que ponga la
    // página para ese paso, y si no hay ninguno, el que nombra el paso anterior.
    const motivo = apagado
      ? bloqueado
        ? MOTIVO_GENERANDO
        : (motivosBloqueo?.[paso] ?? motivoPorDefecto(paso))
      : undefined;

    return {
      paso,
      rotulo,
      apagado,
      motivo,
      idMotivo: motivo ? `${prefijo}-motivo-${paso}` : undefined,
      estado: estadoDelPaso(paso, pasoActivo, pasoMaximoAlcanzable),
      esUltimo: indice === PASOS.length - 1,
    };
  });

  const descripciones = pasos.filter(
    (entrada): entrada is typeof entrada & { motivo: string; idMotivo: string } =>
      !!entrada.motivo && !!entrada.idMotivo,
  );

  return (
    <div className="app-modules-docs-generate-page-stepper-panel">
      <nav
        className="app-modules-stepper app-modules-stepper--page"
        aria-label={`Paso ${pasoActivo} de ${PASOS.length}`}
      >
        {pasos.map(
          ({ paso, rotulo, apagado, motivo, idMotivo, estado, esUltimo }) => (
            <React.Fragment key={paso}>
              <button
                type="button"
                className={`app-modules-step app-modules-step--page ${
                  apagado
                    ? "app-modules-step--disabled"
                    : "app-modules-step--clickable"
                } ${estado}`}
                // El nombre lleva el número además del rótulo: el «✓» del punto completo es un
                // signo gráfico y no se anuncia, así que sin esto un paso hecho y uno pendiente
                // sonarían igual (UI-SPEC §6/A1).
                aria-label={`Paso ${paso} de ${PASOS.length}: ${rotulo}`}
                aria-current={paso === pasoActivo ? "step" : undefined}
                aria-disabled={apagado || undefined}
                aria-describedby={idMotivo}
                disabled={apagado}
                title={motivo}
                onClick={() => {
                  if (!apagado) onCambiarPaso(paso);
                }}
              >
                <span className="app-modules-step-dot">
                  {estado === "is-complete" ? "✓" : paso}
                </span>
                <span className="app-modules-step-label">{rotulo}</span>
              </button>

              {!esUltimo && (
                <span
                  aria-hidden="true"
                  className={`app-modules-step-line app-modules-step-line--page ${
                    paso < pasoMaximoAlcanzable ? "is-complete" : ""
                  }`}
                />
              )}
            </React.Fragment>
          ),
        )}
      </nav>

      {/* Los motivos, fuera de los botones y visibles solo para quien no ve la pantalla. Van aquí
          —y no dentro del `<button>`— para que el nombre del paso siga siendo el rótulo. */}
      {descripciones.length > 0 && (
        <div className="sr-only">
          {descripciones.map(({ idMotivo, motivo }) => (
            <span key={idMotivo} id={idMotivo}>
              {motivo}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

export default GeneracionStepper;
