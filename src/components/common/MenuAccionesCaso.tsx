/**
 * Microservicio: ejecucion
 * Módulo: Bandeja (compartido)
 * Feature: Menú de acciones por caso (⋮)
 * Archivo: MenuAccionesCaso.tsx
 * Responsabilidad: Recoger en un solo desplegable los actos que se pueden hacer sobre UN caso, en
 *   vez de alinearlos como botones sueltos en la cabecera de la card.
 *
 *   ── POR QUÉ VIVE EN SU PROPIO COMPONENTE ─────────────────────────────────────────────────────
 *   Por dos razones, y la segunda no es estética. Primera: el menú lo pide más de una bandeja.
 *   Segunda: `MisAsignadosPage` arrastra `react-hooks/rules-of-hooks` por un `if (!user) return null;`
 *   situado ENCIMA de sus hooks (deuda preexistente), y **cada hook nuevo suma un error**. Los hooks
 *   de este menú viven aquí y no suman ninguno.
 *
 *   🔴 ── POR QUÉ SE DIBUJA EN UN PORTAL, Y NO DENTRO DE LA CARD ─────────────────────────────────
 *   Porque dentro NO SE VE. Las cards de bandeja llevan `overflow: hidden` (inbox-cases.css) para
 *   recortar el fondo del zebra contra su borde redondeado: cualquier cosa que se salga de la card
 *   queda cortada, y la card de abajo pinta encima. Ningún `z-index` arregla eso — el recorte ocurre
 *   antes de que el apilamiento importe. El menú se dibuja en `document.body`, en `position: fixed`,
 *   colocado desde el rectángulo real del botón.
 *
 *   ── POR QUÉ NO USA EL FOCO, QUE SERÍA MÁS CORTO ──────────────────────────────────────────────
 *   El desplegable de daisyUI abre con `:focus-within`, pero este menú vive DENTRO del `<summary>`
 *   de una card colapsable: un elemento enfocable anidado en el `<summary>` pelea con el foco del
 *   propio `<summary>` y el resultado depende del navegador. Con estado explícito no depende de
 *   nada, y todos los clics paran su propagación para que abrir el menú no despliegue la card.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-08-21
 * Modificado por: Andrés Miño — 2026-09-23 (Fase 03.19, Plan 21, gap 5 del UAT: el apagado SE VE.
 *   El componente ponía `disabled`, `aria-disabled` y `title` en el `<button>` —lo apagaba para
 *   ratón, teclado y lector— pero su `className` no llevaba NINGUNA clase de estado, así que una
 *   entrada que no procedía se pintaba igual que una que sí. No afectaba a dos entradas: a las DOCE.
 *   Ahora el `<li>` recibe `menu-disabled` y el botón suelta su tono. Y como esa clase de daisyUI
 *   trae `pointer-events: none` pegado al gris, el puntero se devuelve en
 *   `src/styles/ui/menu-acciones-caso.css` para que el `title` del `<li>` —el único canal con hover
 *   del motivo— siga pudiendo mostrarse: el color se apaga, el porqué no.)
 * Modificado por: Andrés Miño — 2026-09-21 (Fase 03.19, Plan 08, D-11: el menú pasa de tres actos
 *   a DOCE, y a esa escala hacían falta cuatro cosas que a la otra no.)
 *
 *   🔴 ── LO QUE CAMBIA AL PASAR DE TRES ENTRADAS A DOCE ────────────────────────────────────────
 *
 *   1. EL MOTIVO SE LEE SIN RATÓN. Una acción que no procede se apaga con su motivo (nunca se
 *      esconde), y hasta hoy ese motivo vivía SOLO en el `title`. El `title` no existe en una
 *      tableta —no hay hover que lo dispare— y no lo anuncia el lector cuando el elemento ya tiene
 *      nombre propio. Con doce entradas y la mitad apagadas, eso deja al funcionario delante de una
 *      lista gris sin ninguna explicación. Ahora el motivo se pinta además como SEGUNDA LÍNEA
 *      visible. Es el texto más accionable del menú: es el único que dice qué falta para encender
 *      la acción. El `title` del `<li>` y el del `<button>` SE CONSERVAN sin tocar — el segundo
 *      canal suma, no sustituye, y es además donde las pruebas de 2026-08-21 lo localizan.
 *
 *   2. LA LISTA SE ACOTA Y SE DESPLAZA. El cálculo de colocación existía, pero el `<ul>` no tenía
 *      alto máximo ni scroll: doce entradas + cuatro rótulos + segundas líneas miden ~656 px, el
 *      menú se salía de la ventana y «Descargar expediente» y «Coactiva» eran materialmente
 *      inalcanzables. El tope del UI-SPEC es `min(70vh, 26rem)` y la colocación usa AHORA ese mismo
 *      tope, además de acotarlo al hueco real del lado por el que abre: un tope que la colocación
 *      ignora es un tope que no existe.
 *
 *   3. SE OPERA CON EL TECLADO. Al abrir, el foco entra en el primer elemento HABILITADO; las
 *      flechas recorren solo los habilitados y hacen ciclo; inicio/fin van a los extremos; Escape
 *      cierra y DEVUELVE EL FOCO al disparador (antes se perdía en el `<body>`, que con una bandeja
 *      entera por delante obliga a tabularla otra vez); Tab cierra y sigue el orden natural de la
 *      fila. Un menú de doce entradas sin teclado es, en la práctica, un menú de ratón.
 *
 *   4. HAY GRUPOS E ICONOS. `grupo?` emite un rótulo de sección marcado como PRESENTACIÓN —no como
 *      opción, o el lector prometería un acto que no existe— e `icono?` pinta el glifo del
 *      `iconoMap` antes de la etiqueta. Con doce entradas y la mitad grises, la agrupación es lo
 *      que convierte una lista gris en una estructura legible.
 *
 *   🔴 ── LO QUE ESTE COMPONENTE SIGUE SIN HACER, Y NO VA A HACER (T-03.19-32) ───────────────────
 *   No decide si una acción procede y no redacta por qué no procede. `deshabilitado` y `motivo`
 *   llegan del motor con su catálogo. Meter aquí una condición de permiso crearía una segunda
 *   fuente de verdad sobre la misma regla, y el día que discrepara sería este menú —el que no sabe
 *   nada— el que estaría diciendo que sí donde el backend dice que no. Tampoco rehabilita nunca lo
 *   que llega apagado.
 */

import {
  Fragment,
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent,
} from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import Iconos from "./Iconos";

export interface AccionCaso {
  /** Identificador estable; sirve de `key` y de nombre en las pruebas. */
  id: string;
  label: string;
  /** Qué hacer al elegirla. Se omite cuando la acción NAVEGA (ver `to`). */
  onSelect?: () => void;
  /**
   * A dónde lleva, si la acción es una ENTRADA a otra pantalla en vez de un acto sobre el caso.
   *
   * 🔴 SE DIBUJA COMO ENLACE DE VERDAD, no como botón que navega. Dos razones: el funcionario puede
   * abrirla en otra pestaña —que es lo que hace quien quiere mirar el correctivo sin perder la
   * bandeja— y, sobre todo, la página que la ofrece NO necesita un hook de navegación. Eso importa
   * aquí: `MisAsignadosPage` arrastra `react-hooks/rules-of-hooks` por un `if (!user) return null;`
   * situado encima de sus hooks, y **cada hook nuevo suma un error**.
   */
  to?: string;
  /** Clase de daisyUI para los actos que hay que mirar dos veces (p. ej. `text-warning`). */
  tono?: string;
  /**
   * APAGADA, NO AUSENTE (D-7). Una acción que no procede se muestra deshabilitada; esconderla deja
   * al funcionario buscando una opción que ayer estaba y sin saber qué haría falta para recuperarla.
   */
  deshabilitado?: boolean;
  /**
   * Por qué está apagada. Se ve al pasar el ratón y se lee en voz alta.
   *
   * 🔴 EL TEXTO VIENE DE FUERA. Quien apaga la acción sabe por qué —normalmente el motor, con el
   * motivo de su catálogo—; redactarlo aquí sería una segunda fuente de verdad para la misma regla.
   * Sólo tiene efecto con `deshabilitado` en verdadero.
   */
  motivo?: string;
  /**
   * Nombre del `iconoMap` (`Iconos.tsx`). Se pinta ANTES de la etiqueta, y es decoración: la
   * etiqueta ya dice lo que hace la acción, así que el icono queda fuera del nombre accesible.
   * Un nombre que no está en el mapa cae en `sinIcono` y no rompe nada.
   */
  icono?: string;
  /**
   * Rótulo de la sección a la que pertenece. Al cambiar de grupo, el menú emite un
   * `<li className="menu-title" role="presentation">` con este texto.
   *
   * Es una propiedad de la ACCIÓN y no una lista de secciones aparte a propósito: así el orden del
   * menú y su agrupación son el mismo dato y no pueden contradecirse. Las acciones del mismo grupo
   * tienen que ir CONSECUTIVAS —si se separan, el rótulo se repite, que es justo la señal visible
   * de que el orden está mal—.
   */
  grupo?: string;
}

interface Props {
  acciones: AccionCaso[];
  /** Se lee en voz alta y se ve al pasar el ratón: «Acciones de EPAS 183». */
  etiqueta: string;
}

/** Ancho del menú, en píxeles. Vive aquí porque la colocación necesita el número, no la clase. */
const ANCHO = 256;

/**
 * EL TOPE DE ALTO, EN DOS MITADES — `min(70vh, 26rem)` del UI-SPEC §2.2.
 *
 * Se escribe en JavaScript y no como clase de CSS porque la COLOCACIÓN necesita el número: el menú
 * se dibuja en `position: fixed` y hay que saber cuánto va a medir para decidir si abre hacia abajo
 * o hacia arriba. Un tope que solo el CSS conoce es un tope que la colocación ignora, y ése era
 * exactamente el defecto: el `<ul>` crecía sin freno mientras el cálculo creía que medía 320 px.
 */
const TOPE_PROPORCION_VENTANA = 0.7;
const TOPE_REM = 26;
const PX_POR_REM = 16;

/**
 * Estimación del alto del contenido. No hace falta que sea exacta —el alto real lo pone el
 * navegador y el `max-height` lo acota— pero sí que sea del orden correcto: sirve solo para decidir
 * el lado por el que abre.
 */
const ALTO_ENTRADA = 44;
const ALTO_ROTULO = 28;
const RELLENO_VERTICAL = 16;

/** Aire que se le deja a la ventana por los cuatro lados. */
const MARGEN_VENTANA = 12;
const MARGEN_BORDE = 8;

/**
 * Suelo del alto máximo. Sin él, un disparador pegado a un borde en una ventana baja produciría un
 * menú de veinte píxeles: técnicamente dentro de la ventana, y sin embargo inservible. Con suelo,
 * en ese caso el menú prefiere asomar un poco a desaparecer.
 */
const ALTO_MINIMO = 120;

/** Cuántos rótulos de sección va a emitir esta lista: cada cambio de `grupo` produce uno. */
const contarGrupos = (acciones: AccionCaso[]) =>
  acciones.filter(
    (accion, indice) =>
      Boolean(accion.grupo) && accion.grupo !== acciones[indice - 1]?.grupo,
  ).length;

/**
 * Lo que se ve DENTRO de una entrada: el icono (decorativo), la etiqueta y —solo cuando la acción
 * está apagada y trae motivo— la segunda línea que lo dice en pantalla.
 *
 * 🔴 La segunda línea se pinta DENTRO del `<button>`, no al lado: así entra en el nombre accesible
 * del control y el lector lee «Generar documento, Acepte el caso para poder generar documentos,
 * atenuado» de una vez. Fuera del botón sería un texto suelto que nadie relaciona con nada.
 */
const ContenidoAccion = ({
  accion,
  conMotivo,
}: {
  accion: AccionCaso;
  conMotivo: boolean;
}) => (
  <>
    {accion.icono && (
      // `aria-hidden` lo deja fuera del nombre accesible: la etiqueta ya dice lo que hace, y si el
      // glifo entrara, cambiar de icono rompería las pruebas que localizan por rol y nombre.
      <span aria-hidden="true" className="mt-0.5 shrink-0">
        <Iconos nombre={accion.icono} estilo="h-4 w-4" />
      </span>
    )}
    <span className="flex min-w-0 flex-col items-start gap-0.5">
      <span>{accion.label}</span>
      {conMotivo && (
        // 14 px, atenuada y con salto de línea: el motivo son frases («Acepte el caso para poder
        // generar documentos.»), no etiquetas, y truncarlas se come justo la parte que dice qué
        // falta.
        <span className="text-xs whitespace-normal opacity-70">
          {accion.motivo}
        </span>
      )}
    </span>
  </>
);

export const MenuAccionesCaso = ({ acciones, etiqueta }: Props) => {
  const [abierto, setAbierto] = useState(false);
  /** Dónde dibujarlo y cuánto puede crecer, en coordenadas de ventana (`position: fixed`). */
  const [posicion, setPosicion] = useState({
    top: 0,
    left: 0,
    altoMaximo: TOPE_REM * PX_POR_REM,
  });
  const contenedor = useRef<HTMLDivElement>(null);
  const disparador = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLUListElement>(null);

  // Los dos números que la colocación necesita de la lista. Se extraen como PRIMITIVOS a propósito:
  // poner `acciones` en las dependencias del efecto lo volvería a disparar en cada render —quien
  // monta el menú construye el array en línea, así que su identidad cambia siempre— y el efecto
  // llama a `setPosicion`, con lo que el ciclo no pararía nunca.
  const numeroDeAcciones = acciones.length;
  const numeroDeGrupos = contarGrupos(acciones);

  /**
   * Las entradas por las que el teclado puede pasar: las HABILITADAS, en orden de DOM.
   *
   * Se leen del DOM en vez de mantener un array de refs porque el orden que importa es el que ve el
   * usuario, y ése lo tiene el DOM ya resuelto —con sus rótulos de sección intercalados y sus
   * enlaces mezclados con sus botones—. Mantener el índice aparte sería mantener dos veces lo mismo.
   */
  const entradasNavegables = useCallback(
    () =>
      Array.from(
        menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [],
      ).filter(
        (entrada) =>
          !(entrada as HTMLButtonElement).disabled &&
          entrada.getAttribute("aria-disabled") !== "true",
      ),
    [],
  );

  /** Cerrar devolviendo el foco a su sitio. Perderlo en el `<body>` no es cerrar: es abandonar. */
  const cerrarYDevolverFoco = useCallback(() => {
    setAbierto(false);
    disparador.current?.focus();
  }, []);

  // Colocar el menú bajo el botón, y RECOLOCARLO si la página se mueve: al estar en `fixed`, un
  // scroll dejaría el menú quieto mientras su botón se va. El `capture` es necesario para enterarse
  // también del scroll de contenedores internos, que no burbujea.
  useEffect(() => {
    if (!abierto) return;

    const colocar = () => {
      const r = disparador.current?.getBoundingClientRect();
      if (!r) return;
      // Alineado a la DERECHA del botón, y nunca fuera de la ventana.
      const left = Math.max(
        MARGEN_BORDE,
        Math.min(r.right - ANCHO, window.innerWidth - ANCHO - MARGEN_BORDE),
      );

      // EL TOPE DEL UI-SPEC, y el hueco REAL que hay a cada lado del disparador. El alto máximo es
      // el menor de los dos: de nada sirve permitir 26 rem si por ese lado solo hay 200 px de
      // ventana — el menú los ocuparía y saldría por el borde, que es lo que pasaba antes.
      const tope = Math.min(
        window.innerHeight * TOPE_PROPORCION_VENTANA,
        TOPE_REM * PX_POR_REM,
      );
      const huecoDebajo = window.innerHeight - r.bottom - MARGEN_VENTANA;
      const huecoEncima = r.top - MARGEN_VENTANA;
      const altoMaximo = Math.max(
        ALTO_MINIMO,
        Math.min(tope, Math.max(huecoDebajo, huecoEncima)),
      );

      // Lo que el contenido pediría si nadie lo acotara, acotado. Con doce entradas y cuatro
      // rótulos pide ~656 px, y es ahí donde la versión anterior —que creía 320— se equivocaba.
      const alto = Math.min(
        numeroDeAcciones * ALTO_ENTRADA +
          numeroDeGrupos * ALTO_ROTULO +
          RELLENO_VERTICAL,
        altoMaximo,
      );

      // Si abajo no cabe, se abre hacia ARRIBA: en las últimas filas de la tabla, abrir hacia abajo
      // dejaría el menú fuera de la pantalla. Y si arriba tampoco cabe entero, se pega al borde
      // superior y se desplaza por dentro, que es para lo que está el `max-height`.
      const cabeDebajo = alto <= huecoDebajo;
      setPosicion({
        top: cabeDebajo
          ? r.bottom + 4
          : Math.max(MARGEN_BORDE, r.top - alto - 4),
        left,
        altoMaximo,
      });
    };

    colocar();
    window.addEventListener("scroll", colocar, true);
    window.addEventListener("resize", colocar);
    return () => {
      window.removeEventListener("scroll", colocar, true);
      window.removeEventListener("resize", colocar);
    };
  }, [abierto, numeroDeAcciones, numeroDeGrupos]);

  // Al abrir, el foco entra en la primera entrada HABILITADA. Si entrara en una apagada, la primera
  // pulsación del usuario no haría nada y parecería que el menú no responde — y en un EPAS recién
  // asignado la primera mitad de la lista está apagada.
  useEffect(() => {
    if (!abierto) return;
    entradasNavegables()[0]?.focus();
  }, [abierto, entradasNavegables]);

  // Cerrar al hacer clic fuera o con Escape. Sin esto, el menú se queda abierto mientras se navega
  // por el resto de la bandeja.
  useEffect(() => {
    if (!abierto) return;

    const alClicarFuera = (e: globalThis.MouseEvent) => {
      const destino = e.target as Node;
      // El menú ya NO es descendiente del contenedor (vive en el portal): hay que preguntarle
      // también a él, o el primer clic sobre una opción cerraría el menú antes de ejecutarla.
      if (
        !contenedor.current?.contains(destino) &&
        !menu.current?.contains(destino)
      ) {
        setAbierto(false);
      }
    };
    // EL TECLADO DEL MENÚ. Vive en `document` y no en el `<ul>` a propósito: el menú está en un
    // portal y el foco puede salirse de él por medios que este componente no controla; escuchando
    // arriba, Escape sigue cerrando aunque el foco ya no esté dentro. Es además donde las pruebas
    // de 2026-08-21 lo disparan.
    const alPulsarTecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        cerrarYDevolverFoco();
        return;
      }

      // Tab NO se intercepta: se cierra el menú, se devuelve el foco al `⋮` y se deja que el
      // navegador siga desde ahí. Así el tabulador continúa por el orden natural de la fila
      // (👁 → ⑂ → ⋮ → lo siguiente) en vez de quedarse atrapado en un portal que, en el DOM, está
      // al final del documento.
      if (e.key === "Tab") {
        cerrarYDevolverFoco();
        return;
      }

      const navegables = entradasNavegables();
      if (navegables.length === 0) return;

      // −1 cuando el foco todavía no está dentro: entonces «abajo» significa «la primera».
      const actual = navegables.indexOf(document.activeElement as HTMLElement);
      const irA = (indice: number) => {
        e.preventDefault();
        navegables[(indice + navegables.length) % navegables.length]?.focus();
      };

      // Con el foco todavía fuera (−1), «abajo» es la primera y «arriba» es la última: la
      // aritmética del ciclo sola daría la penúltima, que no es lo que nadie espera.
      if (e.key === "ArrowDown") irA(actual < 0 ? 0 : actual + 1);
      else if (e.key === "ArrowUp")
        irA(actual < 0 ? navegables.length - 1 : actual - 1);
      else if (e.key === "Home") irA(0);
      else if (e.key === "End") irA(navegables.length - 1);
    };

    document.addEventListener("mousedown", alClicarFuera);
    document.addEventListener("keydown", alPulsarTecla);
    return () => {
      document.removeEventListener("mousedown", alClicarFuera);
      document.removeEventListener("keydown", alPulsarTecla);
    };
  }, [abierto, cerrarYDevolverFoco, entradasNavegables]);

  // Un caso sin ningún acto disponible no muestra un menú vacío: no muestra menú.
  if (acciones.length === 0) return null;

  /** Todo clic aquí dentro se queda aquí: fuera está el `<summary>` que despliega la card. */
  const contener = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <div className="relative" ref={contenedor}>
      <button
        ref={disparador}
        type="button"
        className="btn btn-sm btn-ghost btn-square"
        aria-label={etiqueta}
        title={etiqueta}
        aria-haspopup="menu"
        aria-expanded={abierto}
        onClick={(e) => {
          contener(e);
          setAbierto((v) => !v);
        }}
      >
        {/* Los tres puntos. SVG y no un carácter «⋮»: el tipo de letra no lo centra igual en todos
            los sistemas y el botón queda torcido. */}
        <svg
          className="h-5 w-5"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
        >
          <circle cx="12" cy="5" r="2" />
          <circle cx="12" cy="12" r="2" />
          <circle cx="12" cy="19" r="2" />
        </svg>
      </button>

      {abierto &&
        createPortal(
          <ul
            ref={menu}
            // `overflow-y-auto` es lo que hace alcanzables las dos últimas entradas de las doce, y
            // `overscroll-contain` evita que al llegar al final de la lista el gesto siga
            // desplazando la tabla de debajo — con la bandeja en `overflow-x-auto overflow-y-auto`,
            // eso mueve el expediente bajo el cursor mientras se elige una acción sobre él.
            // `flex-nowrap` impide que daisyUI comprima las entradas en vez de desplazarlas.
            className="menu fixed z-[100] flex-nowrap overflow-y-auto overscroll-contain rounded-2xl border border-base-300 bg-base-100 p-2 text-sm shadow-[0_20px_45px_rgba(15,23,42,0.20)]"
            style={{
              top: posicion.top,
              left: posicion.left,
              width: ANCHO,
              maxHeight: posicion.altoMaximo,
            }}
            role="menu"
          >
            {acciones.map((accion, indice) => {
              // El rótulo se emite al CAMBIAR de grupo. Si dos acciones del mismo grupo llegaran
              // separadas, el rótulo saldría dos veces: es a propósito: se ve, y lo que hay que
              // arreglar es el orden de la lista, no el menú.
              const abreGrupo =
                Boolean(accion.grupo) &&
                accion.grupo !== acciones[indice - 1]?.grupo;
              const mostrarMotivo = Boolean(
                accion.deshabilitado && accion.motivo,
              );

              return (
                <Fragment key={accion.id}>
                  {abreGrupo && (
                    // `presentation` y no `menuitem`: un rótulo no es elegible, y anunciarlo como
                    // opción prometería un acto que no existe.
                    <li className="menu-title" role="presentation">
                      {accion.grupo}
                    </li>
                  )}
                  {/* El motivo va TAMBIÉN en el `<li>`: un botón deshabilitado no recibe eventos de
                      puntero, así que su propio tooltip nunca llegaría a mostrarse. Mismo apaño que
                      en `CollapseExpediente` y en `ActasSorteoPage`. */}
                  {/* 🔴 LA CLASE VIENE DE daisyUI Y TRAE DOS COSAS. `menu-disabled` es como esta
                      librería atenúa una entrada de menú —por el `<li>`, no por el `disabled` del
                      botón—, y en la 5.5.19 declara el gris Y `pointer-events: none` en la MISMA
                      declaración. Lo segundo mataría el `title` de aquí arriba, que es el apaño
                      declarado en las líneas 465-467 y el único canal con hover que tiene el motivo.
                      El puntero se devuelve en `src/styles/ui/menu-acciones-caso.css`: sin ese
                      fichero, esta clase apaga el color y el porqué a la vez. Misma forma que
                      `RowActionMenu.tsx:48`, que es la convención del repo. */}
                  <li
                    role="none"
                    className={accion.deshabilitado ? "menu-disabled" : undefined}
                    title={accion.deshabilitado ? accion.motivo : undefined}
                  >
                    {accion.to && !accion.deshabilitado ? (
                      // La ENTRADA a otra pantalla. Enlace de verdad: se puede abrir en otra
                      // pestaña, y la página que la ofrece no necesita un hook de navegación.
                      <Link
                        role="menuitem"
                        to={accion.to}
                        title={accion.label}
                        className={`items-start justify-start text-left ${accion.tono ?? ""}`}
                        onClick={(e) => {
                          // Aquí NO se llama a `preventDefault`: eso cancelaría la navegación. Sólo
                          // se corta la propagación, que es lo que evita que el clic llegue al
                          // `<summary>` y despliegue la card entera de camino a la otra pantalla.
                          e.stopPropagation();
                          setAbierto(false);
                          accion.onSelect?.();
                        }}
                      >
                        <ContenidoAccion accion={accion} conMotivo={false} />
                      </Link>
                    ) : (
                      <button
                        type="button"
                        role="menuitem"
                        disabled={accion.deshabilitado ?? false}
                        // `disabled` apaga el botón para el ratón y el teclado; `aria-disabled` es
                        // lo que hace que el lector lo ANUNCIE apagado en vez de callárselo.
                        aria-disabled={accion.deshabilitado ? true : undefined}
                        // 🔴 EL PORQUÉ VIAJA CON EL APAGADO. Un botón deshabilitado sin motivo deja
                        // al funcionario adivinando; con él, la pantalla dice qué falta para
                        // encenderlo. Este `title` NO se toca: es el canal heredado, y el segundo
                        // canal (la línea visible de abajo) se suma a él, no lo sustituye.
                        title={accion.deshabilitado ? accion.motivo : accion.label}
                        // 🔴 EL TONO SE SUELTA AL APAGARSE, Y NO ES COSMÉTICA. El gris de
                        // `menu-disabled` se declara sobre el `<li>` y llega aquí por HERENCIA; un
                        // `color` declarado sobre el propio botón la vence siempre. `coactiva` trae
                        // `tono: "text-warning"` (`accionesDelEpas.ts:250`), así que sin esto esa
                        // entrada seguiría en ámbar con el `<li>` atenuado. Y encaja con el dominio:
                        // el ámbar advierte de un acto que cierra la puerta al trabajo comunitario, y
                        // una acción que no procede no va a ejecutar ningún acto del que advertir.
                        // La rama `<Link>` NO lo necesita: solo se dibuja con la acción ENCENDIDA.
                        className={`items-start justify-start text-left ${accion.deshabilitado ? "" : (accion.tono ?? "")}`}
                        onClick={(e) => {
                          contener(e);
                          if (accion.deshabilitado) return;
                          setAbierto(false);
                          accion.onSelect?.();
                        }}
                      >
                        <ContenidoAccion
                          accion={accion}
                          conMotivo={mostrarMotivo}
                        />
                      </button>
                    )}
                  </li>
                </Fragment>
              );
            })}
          </ul>,
          document.body,
        )}
    </div>
  );
};

export default MenuAccionesCaso;
