/**
 * Microservicio: ejecucion
 * Módulo: Bandeja (compartido)
 * Archivo: MenuAccionesCaso.test.tsx
 * Responsabilidad: Lo que se protege es que recoger los actos en un menú no los ESCONDA ni los
 *   dispare de más: que un caso sin actos no muestre un menú vacío, que elegir uno lo ejecute UNA
 *   vez y cierre, y —lo que más se rompe— que el clic no llegue al `<summary>` que hay debajo, que
 *   desplegaría la card entera cada vez que alguien abre el menú; y que se dibuja FUERA de la card,
 *   que es lo unico que lo salva del `overflow: hidden` con que las bandejas recortan sus cards.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-08-21
 * Modificado por: Andrés Miño — 2026-09-23 (Fase 03.19, Plan 21, gap 5 del UAT: el ESTADO VISUAL
 *   del apagado. Entran dos bloques y ninguna prueba vigente se toca. El primero afirma que el
 *   `<li>` de una acción apagada lleva la clase con que daisyUI la atenúa —y que la encendida NO
 *   la lleva ni pierde su tono—, que el motivo sigue llegando por sus DOS canales, y que el
 *   recuento cuadra sobre las DOCE entradas: el defecto era del componente compartido, no de dos
 *   acciones. El segundo fija el contrato de `src/styles/ui/menu-acciones-caso.css`, la pieza
 *   INVISIBLE del arreglo: sin esas reglas la clase apaga el color Y el tooltip del motivo, y
 *   como jsdom no calcula CSS nada más podría notar su borrado.
 *
 *   ⚠️ LO QUE ESTE FICHERO NO PUEDE PROBAR, y no hay que leer de otra manera: jsdom no calcula
 *   CSS. Se afirman CLASES y la EXISTENCIA de reglas; nunca un color resuelto, un contraste ni
 *   que el globo del `title` llegue a pintarse. El gris lo cierra la verificación humana.)
 * Modificado por: Andrés Miño — 2026-09-21 (Fase 03.19, Plan 08, D-11: las conductas que sólo
 *   aparecen cuando el menú crece a DOCE entradas — motivo legible sin ratón, lista acotada con
 *   scroll, recorrido por teclado y rótulos de grupo. Las seis pruebas originales NO se tocan.)
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import MenuAccionesCaso from "./MenuAccionesCaso";
// 🔴 LOS FICHEROS DEL ARREGLO, COMO TEXTO. Con el `?raw` de Vite y NO con `node:fs`, por lo
// mismo que en `ObligacionesVivas.test.tsx` y `TerminoAlegacionPlazo.test.tsx`:
// `tsconfig.app.json` fija `"types": ["vite/client"]` a propósito —abrirle `fs` y `process` a
// toda la pantalla es justo lo que el proyecto evita, y por eso el único test que usa `node:fs`
// (`guardasArquitectura.test.ts`) vive en `tsconfig.node.json` y está EXCLUIDO del proyecto de
// la app—. `?raw` lee el fichero de verdad, del disco, sin abrir esa puerta.
//
// ⚠️ Y LA HOJA NECESITA UNA LÍNEA DE `vitest.config.ts` PARA LLEGAR AQUÍ CON CONTENIDO: por omisión
// vitest sustituye toda importación de CSS por una cadena vacía, también con `?raw`, de modo que
// estas aserciones pasarían en verde con la hoja borrada. De ahí el `css: { include: [...] }` con
// esta hoja y ninguna más. Si alguien lo quita, salta la primera prueba del bloque de abajo.
import hojaDelMenu from "../../styles/ui/menu-acciones-caso.css?raw";
import hojaRaiz from "../../index.css?raw";
import fuenteDelMenu from "./MenuAccionesCaso.tsx?raw";
import fuenteDelMenuDeFila from "../tabla/RowActionMenu.tsx?raw";

describe("MenuAccionesCaso", () => {
  it("un caso SIN actos disponibles no muestra un menú vacío", () => {
    const { container } = render(
      <MenuAccionesCaso acciones={[]} etiqueta="Acciones del EPAS 1" />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("los actos están escondidos hasta abrir, y elegir uno lo ejecuta y cierra", () => {
    const emitir = vi.fn();
    render(
      <MenuAccionesCaso
        etiqueta="Acciones del EPAS 1"
        acciones={[
          { id: "emitir", label: "Emitir providencia", onSelect: emitir },
          { id: "pago", label: "Verificar pago", onSelect: vi.fn() },
        ]}
      />,
    );

    expect(screen.queryByText("Emitir providencia")).toBeNull();

    fireEvent.click(screen.getByLabelText("Acciones del EPAS 1"));
    expect(screen.getByText("Verificar pago")).toBeTruthy();

    fireEvent.click(screen.getByText("Emitir providencia"));
    expect(emitir).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Verificar pago")).toBeNull();
  });

  it("🔴 el clic NO llega al <summary> que hay debajo: abrir el menú no despliega la card", () => {
    const desplegarLaCard = vi.fn();
    const abrirModal = vi.fn();

    render(
      // El menú vive dentro del <summary> de una card colapsable. Si el clic se propagara, cada
      // apertura del menú desplegaría o plegaría el expediente entero.
      <details>
        <summary onClick={desplegarLaCard}>
          <MenuAccionesCaso
            etiqueta="Acciones del EPAS 1"
            acciones={[
              { id: "pago", label: "Verificar pago", onSelect: abrirModal },
            ]}
          />
        </summary>
      </details>,
    );

    fireEvent.click(screen.getByLabelText("Acciones del EPAS 1"));
    expect(desplegarLaCard).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText("Verificar pago"));
    expect(abrirModal).toHaveBeenCalledTimes(1);
    expect(desplegarLaCard).not.toHaveBeenCalled();
  });

  it("Escape lo cierra sin ejecutar nada", () => {
    const onSelect = vi.fn();
    render(
      <MenuAccionesCaso
        etiqueta="Acciones del EPAS 1"
        acciones={[{ id: "pago", label: "Verificar pago", onSelect }]}
      />,
    );

    fireEvent.click(screen.getByLabelText("Acciones del EPAS 1"));
    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByText("Verificar pago")).toBeNull();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("🔴 se dibuja FUERA de la card: dentro, el overflow:hidden lo recortaría", () => {
    // Las cards de bandeja llevan `overflow: hidden` para recortar el zebra contra su borde
    // redondeado. Un menú dibujado dentro queda cortado y la card de abajo pinta encima — y ningún
    // z-index lo arregla, porque el recorte ocurre antes del apilamiento. Lo que lo salva es que la
    // lista NO cuelgue de la card.
    const { container } = render(
      <div className="app-inbox-alert-item">
        <MenuAccionesCaso
          etiqueta="Acciones del EPAS 1"
          acciones={[
            { id: "pago", label: "Verificar pago", onSelect: vi.fn() },
          ]}
        />
      </div>,
    );

    fireEvent.click(screen.getByLabelText("Acciones del EPAS 1"));

    const menu = screen.getByRole("menu");
    expect(container.querySelector('[role="menu"]')).toBeNull();
    expect(document.body.contains(menu)).toBe(true);
  });

  it("si no cabe debajo, se abre hacia ARRIBA", () => {
    // El último caso de una lista larga tiene el botón pegado al borde inferior: abrir hacia abajo
    // dejaría el menú fuera de la pantalla, que es otra forma de no verse.
    vi.spyOn(window, "innerHeight", "get").mockReturnValue(600);
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      top: 560,
      bottom: 590,
      right: 900,
      left: 860,
      width: 40,
      height: 30,
      x: 860,
      y: 560,
      toJSON: () => ({}),
    });

    render(
      <MenuAccionesCaso
        etiqueta="Acciones del EPAS 1"
        acciones={[{ id: "pago", label: "Verificar pago", onSelect: vi.fn() }]}
      />,
    );
    fireEvent.click(screen.getByLabelText("Acciones del EPAS 1"));

    // Arriba del botón (top 560), no debajo de su borde inferior (590).
    const top = Number.parseFloat(screen.getByRole("menu").style.top);
    expect(top).toBeLessThan(560);

    vi.restoreAllMocks();
  });

  // ══════════════════════════════════════════════════════════════════════════════════════════════
  // Fase 03.19, Plan 08 (D-11) — lo que hace falta para que el `⋮` sostenga DOCE entradas.
  //
  // Las seis pruebas de arriba se escribieron para un menú de dos o tres actos y siguen valiendo
  // tal cual: ninguna se toca. Lo que sigue son las conductas que aparecen SOLO cuando el menú
  // crece —un motivo que hay que leer sin ratón, una lista más alta que la ventana, un recorrido
  // que no se puede hacer a golpe de clic— y que hoy, medidas, no existen.
  // ══════════════════════════════════════════════════════════════════════════════════════════════

  /** Las doce entradas de D-11, con sus cuatro grupos. Se usa donde el tamaño ES el caso. */
  const doceAcciones = () => [
    { id: "aceptarCaso", grupo: "Hacerse cargo", label: "Aceptar", onSelect: vi.fn() },
    { id: "excusarme", grupo: "Hacerse cargo", label: "Excusarme", onSelect: vi.fn() },
    { id: "adjuntarDocumento", grupo: "El documento", label: "Adjuntar documento", onSelect: vi.fn() },
    { id: "generarDocumento", grupo: "El documento", label: "Generar documento", onSelect: vi.fn() },
    { id: "pago", grupo: "Actos sobre el EPAS", label: "Constancia de pago", onSelect: vi.fn() },
    { id: "acogimiento", grupo: "Actos sobre el EPAS", label: "Respuesta a trabajo comunitario", onSelect: vi.fn() },
    { id: "trabajoComunitario", grupo: "Actos sobre el EPAS", label: "Registrar cumplimiento", onSelect: vi.fn() },
    { id: "prorroga", grupo: "Actos sobre el EPAS", label: "Solicitud de prórroga", onSelect: vi.fn() },
    { id: "obligacionHacer", grupo: "Actos sobre el EPAS", label: "Obligación de hacer", onSelect: vi.fn() },
    { id: "impugnacion", grupo: "Actos sobre el EPAS", label: "Acciones de impugnación", onSelect: vi.fn() },
    { id: "descargarExpediente", grupo: "Salidas", label: "Descargar expediente", onSelect: vi.fn() },
    { id: "coactiva", grupo: "Salidas", label: "Coactiva", onSelect: vi.fn() },
  ];

  it("🔴 el motivo de una acción apagada es TEXTO VISIBLE, además del `title` heredado", () => {
    // El `title` no existe en una tableta —no hay hover que lo dispare— y el motivo es el texto más
    // accionable del menú: es el único que dice QUÉ FALTA para encender la acción. Mientras viva
    // solo en el tooltip, la mitad de los usuarios ve doce entradas grises y ninguna explicación.
    // Por eso se afirma con `getByText` y NO con `toHaveAttribute("title")`: la prueba del segundo
    // canal es que el motivo esté en el árbol como texto.
    const motivo = "Acepte el caso para poder generar documentos.";

    render(
      <MenuAccionesCaso
        etiqueta="Acciones del EPAS 1"
        acciones={[
          {
            id: "generarDocumento",
            label: "Generar documento",
            deshabilitado: true,
            motivo,
            onSelect: vi.fn(),
          },
        ]}
      />,
    );
    fireEvent.click(screen.getByLabelText("Acciones del EPAS 1"));

    expect(screen.getByText(motivo)).toBeTruthy();

    // Y el canal heredado SIGUE ahí: el `title` del `<li>` y el del `<button>` son lo que este
    // mismo archivo lleva localizando desde 2026-08-21. El segundo canal SUMA, no sustituye.
    const opcion = screen.getByRole("menuitem", { name: /Generar documento/ });
    expect(opcion.getAttribute("title")).toBe(motivo);
    expect(opcion.closest("li")?.getAttribute("title")).toBe(motivo);
    expect(opcion.getAttribute("aria-disabled")).toBe("true");
  });

  it("🔴 una acción apagada NO dispara su handler aunque se pulse su etiqueta", () => {
    // La regla de fase es «apagada, no ausente»: la entrada se ve y se puede pulsar con el ratón
    // encima. Si el `onSelect` corriera igualmente, esconder la acción sería más seguro que
    // mostrarla, y toda la doctrina de D-11 se caería.
    const noDebeCorrer = vi.fn();

    render(
      <MenuAccionesCaso
        etiqueta="Acciones del EPAS 1"
        acciones={[
          {
            id: "coactiva",
            label: "Coactiva",
            deshabilitado: true,
            motivo: "Solo procede cuando el expediente está en verificación de pago.",
            onSelect: noDebeCorrer,
          },
        ]}
      />,
    );
    fireEvent.click(screen.getByLabelText("Acciones del EPAS 1"));
    fireEvent.click(screen.getByText("Coactiva"));

    expect(noDebeCorrer).not.toHaveBeenCalled();
    // Y no se cierra: cerrarse haría creer que algo pasó.
    expect(screen.getByRole("menu")).toBeTruthy();
  });

  it("🔴 con DOCE entradas la lista se acota y cabe entera en la ventana", () => {
    // Éste es el defecto que el plan corrige. El cálculo de colocación existía, pero el `<ul>` NO
    // tenía alto máximo ni scroll: con doce entradas, cuatro rótulos y segundas líneas de motivo,
    // el menú medía ~656 px, se salía por abajo y las últimas entradas —«Descargar expediente» y
    // «Coactiva»— eran materialmente inalcanzables. Con el botón a media pantalla no cabe ni
    // arriba ni abajo, que es el caso peor y el que revienta.
    vi.spyOn(window, "innerHeight", "get").mockReturnValue(800);
    vi.spyOn(window, "innerWidth", "get").mockReturnValue(1440);
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      top: 390,
      bottom: 420,
      right: 900,
      left: 860,
      width: 40,
      height: 30,
      x: 860,
      y: 390,
      toJSON: () => ({}),
    });

    render(
      <MenuAccionesCaso etiqueta="Acciones del EPAS 1" acciones={doceAcciones()} />,
    );
    fireEvent.click(screen.getByLabelText("Acciones del EPAS 1"));

    const menu = screen.getByRole("menu");

    // 1) La lista se puede desplazar y el desplazamiento no se contagia a la página de debajo.
    expect(menu.className).toContain("overflow-y-auto");
    expect(menu.className).toContain("overscroll-contain");

    // 2) Hay alto máximo, y no pasa del tope declarado en el UI-SPEC: min(70vh, 26rem).
    const altoMaximo = Number.parseFloat(menu.style.maxHeight);
    expect(Number.isFinite(altoMaximo)).toBe(true);
    expect(altoMaximo).toBeLessThanOrEqual(Math.min(800 * 0.7, 26 * 16));

    // 3) Y —lo que de verdad importa— la caja entera cae DENTRO de la ventana por los dos lados.
    //    Sin el tope, la colocación creía que el menú medía 320 px y lo dejaba desbordando.
    const top = Number.parseFloat(menu.style.top);
    expect(top).toBeGreaterThanOrEqual(0);
    expect(top + altoMaximo).toBeLessThanOrEqual(800);

    // 4) Las doce entradas siguen estando: acotar no es recortar.
    expect(screen.getAllByRole("menuitem")).toHaveLength(12);
    expect(screen.getByText("Coactiva")).toBeTruthy();

    vi.restoreAllMocks();
  });

  it("🔴 Escape cierra y DEVUELVE EL FOCO al disparador", () => {
    // Hoy Escape cierra pero el foco se queda en el `<body>`: quien navega con teclado se cae al
    // principio del documento y tiene que volver a tabular la bandeja entera. Con doce entradas
    // eso deja de ser una molestia y pasa a ser motivo para no usar el menú.
    render(
      <MenuAccionesCaso etiqueta="Acciones del EPAS 1" acciones={doceAcciones()} />,
    );
    const disparador = screen.getByLabelText("Acciones del EPAS 1");

    fireEvent.click(disparador);
    // Al abrir, el foco entra en el menú: si no, las flechas no tendrían desde dónde empezar.
    expect(screen.getByRole("menuitem", { name: "Aceptar" })).toHaveFocus();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("menu")).toBeNull();
    expect(disparador).toHaveFocus();
  });

  it("🔴 las flechas recorren SOLO las entradas habilitadas y hacen ciclo", () => {
    // Saltar las apagadas es lo que hace usable un menú donde la mitad está apagada —que es el
    // estado normal de un EPAS recién asignado—. Si las flechas se pararan en ellas, llegar a
    // «Coactiva» costaría doce pulsaciones y seis de ellas no harían nada.
    render(
      <MenuAccionesCaso
        etiqueta="Acciones del EPAS 1"
        acciones={[
          { id: "aceptarCaso", label: "Aceptar", onSelect: vi.fn() },
          {
            id: "generarDocumento",
            label: "Generar documento",
            deshabilitado: true,
            motivo: "Acepte el caso para poder generar documentos.",
            onSelect: vi.fn(),
          },
          {
            id: "pago",
            label: "Constancia de pago",
            deshabilitado: true,
            motivo: "Solo procede cuando el expediente está en verificación de pago.",
            onSelect: vi.fn(),
          },
          { id: "coactiva", label: "Coactiva", onSelect: vi.fn() },
        ]}
      />,
    );
    fireEvent.click(screen.getByLabelText("Acciones del EPAS 1"));

    const aceptar = screen.getByRole("menuitem", { name: "Aceptar" });
    const coactiva = screen.getByRole("menuitem", { name: "Coactiva" });

    expect(aceptar).toHaveFocus();

    // Abajo: se salta las DOS apagadas de en medio.
    fireEvent.keyDown(document, { key: "ArrowDown" });
    expect(coactiva).toHaveFocus();

    // Y hace ciclo, en vez de quedarse clavada en la última.
    fireEvent.keyDown(document, { key: "ArrowDown" });
    expect(aceptar).toHaveFocus();

    // Arriba, igual y en sentido contrario.
    fireEvent.keyDown(document, { key: "ArrowUp" });
    expect(coactiva).toHaveFocus();

    // Inicio y fin.
    fireEvent.keyDown(document, { key: "Home" });
    expect(aceptar).toHaveFocus();
    fireEvent.keyDown(document, { key: "End" });
    expect(coactiva).toHaveFocus();
  });

  it("🔴 Tab cierra el menú y devuelve el foco a la fila, sin ejecutar nada", () => {
    // Un menú que atrapa el tabulador obliga a usar el ratón para salir de él. Al cerrarse el foco
    // vuelve al `⋮`, que es donde el orden natural de la fila continúa (👁 → ⑂ → ⋮ → siguiente).
    const onSelect = vi.fn();
    render(
      <MenuAccionesCaso
        etiqueta="Acciones del EPAS 1"
        acciones={[{ id: "pago", label: "Verificar pago", onSelect }]}
      />,
    );
    const disparador = screen.getByLabelText("Acciones del EPAS 1");

    fireEvent.click(disparador);
    fireEvent.keyDown(document, { key: "Tab" });

    expect(screen.queryByRole("menu")).toBeNull();
    expect(disparador).toHaveFocus();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("los grupos se dibujan como RÓTULOS de sección, no como opciones elegibles", () => {
    // Doce entradas seguidas y la mitad grises son una lista gris. Los cuatro rótulos son lo que
    // la convierte en una estructura legible. Y tienen que quedar FUERA del recorrido: un lector
    // de pantalla que anunciara «Hacerse cargo» como opción prometería un acto que no existe.
    render(
      <MenuAccionesCaso etiqueta="Acciones del EPAS 1" acciones={doceAcciones()} />,
    );
    fireEvent.click(screen.getByLabelText("Acciones del EPAS 1"));

    const rotulos = Array.from(
      screen.getByRole("menu").querySelectorAll("li.menu-title"),
    );
    expect(rotulos.map((r) => r.textContent)).toEqual([
      "Hacerse cargo",
      "El documento",
      "Actos sobre el EPAS",
      "Salidas",
    ]);
    rotulos.forEach((r) => expect(r.getAttribute("role")).toBe("presentation"));

    // Doce opciones, ni una más: los rótulos no cuentan.
    expect(screen.getAllByRole("menuitem")).toHaveLength(12);
  });

  it("el icono de una acción se pinta y NO se mete en su nombre accesible", () => {
    // El icono es decoración: la etiqueta ya dice lo que hace. Si el `<svg>` entrara en el nombre,
    // las pruebas que localizan por rol y nombre —éstas— se romperían al cambiar de glifo.
    render(
      <MenuAccionesCaso
        etiqueta="Acciones del EPAS 1"
        acciones={[
          { id: "coactiva", label: "Coactiva", icono: "coactiva", onSelect: vi.fn() },
        ]}
      />,
    );
    fireEvent.click(screen.getByLabelText("Acciones del EPAS 1"));

    const opcion = screen.getByRole("menuitem", { name: "Coactiva" });
    expect(opcion.querySelector("svg")).toBeTruthy();
  });

  // ══════════════════════════════════════════════════════════════════════════════════════════════
  // Fase 03.19, Plan 21 (gap 5 del UAT, 2026-09-23) — EL APAGADO SE VE.
  //
  // Lo que reportó el usuario sobre la bandeja del decisor `user_id=4`: «apagr y excusarse no están
  // en color gris aunque no deja pulsar los botones». El comportamiento era —y sigue siendo—
  // correcto: las pruebas de arriba fijan que el handler no corre. Lo que faltaba era el ESTADO
  // VISUAL, y no en dos entradas sino en las DOCE: el `<li>` ya sabía que la acción estaba apagada
  // (le ponía el `title` con el motivo) y no le ponía la clase con que daisyUI la atenúa.
  //
  // ⚠️ LO QUE ESTAS PRUEBAS NO PRUEBAN, Y HAY QUE DECIRLO AQUÍ MISMO. **jsdom no calcula CSS.** Se
  // afirma la CLASE que se aplica y —más abajo— la EXISTENCIA de la regla en la hoja de estilos.
  // Nunca el color resuelto, ni su contraste en cada tema, ni que el globo del `title` llegue a
  // pintarse. Quien lea este bloque no debe concluir que el gris quedó probado: eso lo cierra la
  // verificación humana del plan, y solo ella.
  // ══════════════════════════════════════════════════════════════════════════════════════════════
  describe("🔴 el apagado SE VE, y el motivo se sigue leyendo (gap 5)", () => {
    const abrir = () =>
      fireEvent.click(screen.getByLabelText("Acciones del EPAS 1"));

    it("la entrada apagada lleva la clase de atenuación en su `<li>`; la encendida NO", () => {
      // Las dos afirmaciones van juntas a propósito: el riesgo real de este arreglo no es que falte
      // el gris, es que se lo lleve TODO el menú y la bandeja pierda lo único que existe para pedir.
      render(
        <MenuAccionesCaso
          etiqueta="Acciones del EPAS 1"
          acciones={[
            {
              id: "aceptarCaso",
              label: "Aceptar",
              deshabilitado: true,
              motivo: "El caso ya está aceptado.",
              onSelect: vi.fn(),
            },
            { id: "pago", label: "Constancia de pago", onSelect: vi.fn() },
          ]}
        />,
      );
      abrir();

      const apagada = screen
        .getByRole("menuitem", { name: /Aceptar/ })
        .closest("li");
      const encendida = screen
        .getByRole("menuitem", { name: "Constancia de pago" })
        .closest("li");

      expect(apagada?.classList.contains("menu-disabled")).toBe(true);
      expect(encendida?.classList.contains("menu-disabled")).toBe(false);
    });

    it("🔴 apagar el color NO apaga el porqué: los DOS canales del motivo siguen ahí", () => {
      // Es el criterio de aceptación más importante de este plan, por encima del color. La clase de
      // daisyUI trae `pointer-events: none` en la MISMA declaración que el gris, y el motivo viaja
      // en el `title` del `<li>` — un elemento sin eventos de puntero no muestra el suyo. Que el
      // `title` siga en el árbol es lo que jsdom puede ver; que llegue a PINTARSE depende de la
      // regla de CSS del plan, y eso lo cierra la verificación humana.
      const motivo = "El caso ya está aceptado: no hay nada que aceptar.";

      render(
        <MenuAccionesCaso
          etiqueta="Acciones del EPAS 1"
          acciones={[
            {
              id: "aceptarCaso",
              label: "Aceptar",
              deshabilitado: true,
              motivo,
              onSelect: vi.fn(),
            },
          ]}
        />,
      );
      abrir();

      const opcion = screen.getByRole("menuitem", { name: /Aceptar/ });
      const li = opcion.closest("li");

      // La clase nueva…
      expect(li?.classList.contains("menu-disabled")).toBe(true);
      // …no se come el canal del tooltip…
      expect(li?.getAttribute("title")).toBe(motivo);
      expect(opcion.getAttribute("title")).toBe(motivo);
      // …ni el canal que funciona SIN ratón: el motivo, escrito en pantalla.
      expect(screen.getByText(motivo)).toBeTruthy();
    });

    it("🔴 «Coactiva» apagada suelta su ámbar; encendida lo conserva", () => {
      // El gris de daisyUI se declara sobre el `<li>` y llega al botón por HERENCIA; un `color`
      // declarado sobre el propio botón la vence siempre. `coactiva` es la única de las doce con
      // tono propio (`accionesDelEpas.ts:250`, `text-warning`), así que sin soltarlo esa entrada
      // seguiría en ámbar con el `<li>` atenuado — el defecto de este gap, sobreviviendo en la
      // entrada más llamativa del menú.
      const coactiva = {
        id: "coactiva",
        label: "Coactiva",
        tono: "text-warning",
        onSelect: vi.fn(),
      };

      const apagada = render(
        <MenuAccionesCaso
          etiqueta="Acciones del EPAS 1"
          acciones={[
            {
              ...coactiva,
              deshabilitado: true,
              motivo: "Solo procede en verificación de pago.",
            },
          ]}
        />,
      );
      abrir();
      expect(
        screen.getByRole("menuitem", { name: /Coactiva/ }).className,
      ).not.toContain("text-warning");
      apagada.unmount();

      render(
        <MenuAccionesCaso etiqueta="Acciones del EPAS 1" acciones={[coactiva]} />,
      );
      abrir();
      expect(
        screen.getByRole("menuitem", { name: "Coactiva" }).className,
      ).toContain("text-warning");
    });

    it("sobre las DOCE entradas, el recuento de apagadas cuadra EXACTAMENTE", () => {
      // El defecto no eran «Aceptar» y «Excusarme»: era el componente compartido, y por tanto las
      // doce. Se cuenta sobre la lista entera porque un arreglo que acertara en dos y fallara en
      // diez pasaría las pruebas de arriba.
      const acciones = doceAcciones().map((accion, indice) =>
        indice % 2 === 0
          ? { ...accion, deshabilitado: true, motivo: `Motivo ${indice}.` }
          : accion,
      );

      render(
        <MenuAccionesCaso etiqueta="Acciones del EPAS 1" acciones={acciones} />,
      );
      abrir();

      const opciones = screen.getAllByRole("menuitem");
      expect(opciones).toHaveLength(12);

      const conClase = opciones.filter((o) =>
        o.closest("li")?.classList.contains("menu-disabled"),
      );
      expect(conClase).toHaveLength(6);

      // Y la otra mitad sigue limpia: ni la clase, ni un `title` de motivo que no le corresponde.
      const sinClase = opciones.filter(
        (o) => !o.closest("li")?.classList.contains("menu-disabled"),
      );
      expect(sinClase).toHaveLength(6);
      sinClase.forEach((o) =>
        expect(o.closest("li")?.getAttribute("title")).toBeNull(),
      );
    });
  });
});

// ════════════════════════════════════════════════════════════════════════════════════════════════
// Fase 03.19, Plan 21 — EL CONTRATO DE LA HOJA DE ESTILOS DEL APAGADO.
//
// 🔴 POR QUÉ ESTE BLOQUE EXISTE Y NO ES CEREMONIA. El arreglo del gap 5 tiene una pieza invisible:
// tres reglas de CSS sin las cuales el componente pierde —en silencio y solo en el navegador— el
// canal por el que el funcionario se entera de qué le falta para encender una acción. La clase
// `menu-disabled` de daisyUI trae `pointer-events: none` pegado al gris, y el motivo del apagado
// viaja en el `title` del `<li>`: sin la devolución del puntero se apaga el color Y el porqué.
// Ninguna prueba de jsdom puede notarlo —jsdom no calcula CSS— y `audit:css` tampoco, porque la
// clase seguiría referenciada desde el TSX. Sin este bloque, la próxima limpieza de hojas de estilo
// borra un fichero «que no parece hacer nada» y el defecto vuelve sin que nadie lo vea hasta el
// siguiente UAT humano.
//
// ⚠️ Y LO QUE ESTE BLOQUE NO DEMUESTRA, dicho con todas las letras: que la regla EXISTA no demuestra
// que el navegador la aplique —eso depende de que esta hoja siga fuera de toda capa—, ni que el gris
// tenga contraste suficiente en los dos temas, ni que el globo del `title` llegue a aparecer. Eso es
// materia de la verificación humana del plan. Un lector que encuentre estas aserciones y crea que el
// asunto quedó cubierto por automatización sacaría justo la conclusión equivocada, que es la que
// abrió este gap.
//
// Se afirma sobre el TEXTO, con búsquedas tolerantes a los espacios y a los saltos de línea: lo que
// se fija es la INTENCIÓN —este selector recibe esta declaración—, no el formato del fichero. Una
// prueba que se rompa al reformatear se acaba silenciando, y entonces no protege nada.
// ════════════════════════════════════════════════════════════════════════════════════════════════
describe("MenuAccionesCaso — el contrato de la hoja de estilos del apagado", () => {
  /** El CSS sin comentarios y con los espacios aplanados: así el formato deja de ser el contrato. */
  const cssPlano = hojaDelMenu
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\s+/g, " ")
    .trim();

  /**
   * Las declaraciones que recibe un selector, o cadena vacía si ese selector no está en la hoja. Se
   * busca el selector SEGUIDO de su llave, para que `…[title]` no se confunda con `…[title] > *`,
   * que lo lleva por prefijo.
   */
  const declaracionesDe = (selector: string) => {
    const aguja = `${selector} {`;
    const inicio = cssPlano.indexOf(aguja);
    if (inicio === -1) return "";
    return cssPlano.slice(inicio + aguja.length, cssPlano.indexOf("}", inicio));
  };

  /**
   * La clase de apagado, LEÍDA del fuente en vez de escrita aquí: lo que se protege es que los dos
   * componentes usen LA MISMA, no cuál sea. Si un día se renombra en uno solo, salta esta prueba en
   * vez de salir a producción como medio menú gris.
   */
  const claseApagado = (fuente: string, patron: RegExp, donde: string) => {
    const hallado = fuente.match(patron)?.[1];
    if (!hallado) throw new Error(`No se halló la clase de apagado en ${donde}`);
    return hallado;
  };

  const claseDelMenu = () =>
    claseApagado(
      fuenteDelMenu,
      /className=\{\s*accion\.deshabilitado\s*\?\s*"([^"]+)"/,
      "MenuAccionesCaso.tsx",
    );

  it("la hoja tiene contenido y `src/index.css` la importa", () => {
    // Una regla que no se sirve es una regla que no existe: sin el import, el tooltip muere igual.
    // Que la hoja EXISTA lo prueba el propio `import … ?raw` de arriba: si faltara, este archivo no
    // llegaría a ejecutarse, que es una señal más ruidosa que una aserción.
    expect(cssPlano.length).toBeGreaterThan(0);
    expect(hojaRaiz).toContain("styles/ui/menu-acciones-caso.css");
  });

  it("🔴 devuelve el puntero al `<li>` apagado que lleva motivo", () => {
    // El gancho es `[title]` y no la clase a secas: el `<li>` recibe `title` SOLO cuando la acción
    // está apagada Y trae motivo, así que el puntero vuelve justo donde hay algo que leer y se queda
    // quieto donde no lo hay.
    expect(declaracionesDe(`.menu li.${claseDelMenu()}[title]`)).toMatch(
      /pointer-events\s*:\s*auto/,
    );
  });

  it("🔴 y apaga a mano el resaltado de hover que ese puntero reabre", () => {
    // daisyUI excluye del resaltado por `li:not(.menu-title, .disabled)` —por `.disabled`, NO por
    // `.menu-disabled`—, de modo que lo único que impedía que una entrada apagada se iluminara y
    // mostrara el cursor de «pulsable» era el `pointer-events: none` que la regla de arriba retira.
    // Sin estas dos declaraciones el arreglo se contradiría: gris, y con toda la pinta de pulsable
    // al pasar el ratón, que es la mitad literal de lo que el usuario reportó.
    const clase = claseDelMenu();
    expect(declaracionesDe(`.menu li.${clase}[title] > *`)).toMatch(
      /cursor\s*:\s*not-allowed/,
    );
    expect(declaracionesDe(`.menu li.${clase}[title] > *:hover`)).toMatch(
      /background-color\s*:\s*transparent/,
    );
  });

  it("⚠️ ninguna de esas reglas fuerza su declaración — y si un día lo hace, es una SEÑAL", () => {
    // El arreglo gana por cascada: el CSS de este proyecto es no encapado y daisyUI se sirve dentro
    // de una capa. Forzar una declaración aquí significaría que ese diagnóstico dejó de ser cierto
    // —por ejemplo, porque alguien metió esta hoja en una capa—, y entonces lo que toca es volver a
    // MEDIR la cascada, no subir la fuerza y seguir. Por eso la palabra no aparece en la hoja ni en
    // sus comentarios: un comentario que la citara dejaría esta prueba sin filo.
    expect(hojaDelMenu).not.toContain("!important");
  });

  it("la clase de apagado es la MISMA en el menú del caso y en el menú de fila", () => {
    expect(claseDelMenu()).toBe(
      claseApagado(
        fuenteDelMenuDeFila,
        /actiIsDisabled\s*\?\s*"([^"]+)"/,
        "RowActionMenu.tsx",
      ),
    );
  });
});
