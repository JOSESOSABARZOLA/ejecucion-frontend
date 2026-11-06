/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/providencias (frontend)
 * Feature: Barra completa del editor de richtext (Quick 260917-bqt)
 * Archivo: RichTextEditor.test.tsx
 * Responsabilidad: Fijar que CADA control de la barra produce marcado que el conversor del backend
 *   sabe imprimir, y que lo que el conversor NO sabe imprimir no es alcanzable desde aquí.
 *
 *   ── 🔴 POR QUÉ ESTE ARCHIVO EXISTE ───────────────────────────────────────────────────────────
 *   Un botón que el PDF no respeta es una TRAMPA en un acto administrativo: el decisor marca algo en
 *   pantalla, firma un documento donde eso no está, y nadie le avisa. Este proyecto ya tuvo dos
 *   pérdidas de esa clase —el `<hr>` que se evaporaba y la cita que perdía la sangría—, las dos
 *   cerradas el 2026-09-17 en `ejecucion-backend`.
 *
 *   Por eso los casos de abajo no comprueban «que el botón exista»: comprueban QUÉ ETIQUETA EMITE,
 *   porque esa etiqueta es el contrato con `richtext-a-pdfmake.ts`. Si alguien añade mañana un
 *   control cuya etiqueta el conversor no traduzca, tiene que añadirla allí primero.
 *
 *   ── POR QUÉ SE TECLEA A TRAVÉS DEL EDITOR Y NO DEL DOM ───────────────────────────────────────
 *   Tiptap monta ProseMirror sobre un `contenteditable`, que en jsdom no admite escritura fiable. La
 *   selección se prepara con comandos del propio editor (que es lo que hace el cursor del usuario) y
 *   lo que se pulsa de verdad son los BOTONES, que es la superficie que este componente ofrece.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-09-17
 */

// Los globals de vitest funcionan al correr los tests, pero `npm run build` pasa `tsc` por este
// fichero y allí no existen. Se importan explícitamente, como en el resto de specs del repo.
import { describe, it, expect } from "vitest";
import { useCallback, useState, type FC } from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import type { Editor } from "@tiptap/react";
import RichTextEditor from "./RichTextEditor";

/**
 * Relleno de geometría para jsdom.
 *
 * Al insertar la línea horizontal, ProseMirror lleva el cursor al nodo nuevo y para eso mide dónde
 * cae (`coordsAtPos` → `Range.getClientRects`). jsdom no implementa la geometría de `Range`, así que
 * ese `scrollIntoView` reventaba DESPUÉS de que el caso hubiera terminado: los asertos pasaban y el
 * runner acababa marcando un error suelto que no era de este componente. Se devuelven medidas nulas
 * —en jsdom nada se dibuja— y el desplazamiento se convierte en una operación sin efecto.
 */
const rectanguloNulo = {
  x: 0,
  y: 0,
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  width: 0,
  height: 0,
  toJSON: () => ({}),
} as DOMRect;

if (!Range.prototype.getClientRects) {
  Range.prototype.getClientRects = () =>
    Object.assign([], {
      item: () => null,
    }) as unknown as DOMRectList;
}
if (!Range.prototype.getBoundingClientRect) {
  Range.prototype.getBoundingClientRect = () => rectanguloNulo;
}

/**
 * Anfitrión controlado: replica lo que hacen `ModalExcusa` y `EmitirProvidenciaModal` —guardar el
 * HTML en estado y devolvérselo al editor— y lo publica en un `<output>` para poder afirmar sobre él.
 */
const Anfitrion: FC<{
  inicial?: string;
  alEditor?: (editor: Editor) => void;
}> = ({ inicial = "<p>Texto de prueba</p>", alEditor }) => {
  const [html, setHtml] = useState(inicial);
  const recibirEditor = useCallback(
    (editor: Editor) => alEditor?.(editor),
    [alEditor],
  );

  return (
    <>
      <RichTextEditor
        value={html}
        onChange={setHtml}
        onEditorReady={recibirEditor}
      />
      <output data-testid="html">{html}</output>
    </>
  );
};

/** Monta el editor y devuelve la instancia real de Tiptap, ya lista. */
const montar = async (inicial?: string) => {
  let editor: Editor | null = null;
  render(
    <Anfitrion
      inicial={inicial}
      alEditor={(e) => {
        editor = e;
      }}
    />,
  );

  await waitFor(() => expect(editor).not.toBeNull());
  return editor as unknown as Editor;
};

const htmlEmitido = () => screen.getByTestId("html").textContent ?? "";

/** Coloca el cursor sobre todo el contenido, que es lo que hace el usuario antes de marcar. */
const seleccionarTodo = (editor: Editor) =>
  act(() => {
    editor.commands.selectAll();
  });

const pulsar = (etiqueta: string) =>
  fireEvent.click(screen.getByLabelText(etiqueta));

describe("RichTextEditor — la barra ofrece lo que el PDF dibuja", () => {
  it("expone TODOS los controles acordados, cada uno con su nombre accesible", async () => {
    await montar();

    for (const etiqueta of [
      "Negrilla",
      "Cursiva",
      "Subrayado",
      "Tachado",
      "Título 1",
      "Título 2",
      "Título 3",
      "Lista numerada",
      "Viñetas",
      "Cita",
      "Línea horizontal",
      "Deshacer",
      "Rehacer",
    ]) {
      expect(screen.getByLabelText(etiqueta)).toBeInTheDocument();
    }
  });

  it.each([
    ["Negrilla", "<strong>"],
    ["Cursiva", "<em>"],
    ["Subrayado", "<u>"],
    ["Tachado", "<s>"],
  ])(
    "«%s» emite %s — una etiqueta que el conversor traduce a marca de pdfmake",
    async (etiqueta: string, tag: string) => {
      const editor = await montar();
      seleccionarTodo(editor);

      pulsar(etiqueta);

      await waitFor(() => expect(htmlEmitido()).toContain(tag));
    },
  );

  it.each([
    ["Título 1", "<h1"],
    ["Título 2", "<h2"],
    ["Título 3", "<h3"],
  ])("«%s» emite %s — el conversor respeta h1–h6", async (etiqueta: string, tag: string) => {
    const editor = await montar();
    seleccionarTodo(editor);

    pulsar(etiqueta);

    await waitFor(() => expect(htmlEmitido()).toContain(tag));
  });

  it.each([
    ["Lista numerada", "<ol"],
    ["Viñetas", "<ul"],
  ])("«%s» emite %s", async (etiqueta: string, tag: string) => {
    const editor = await montar();
    seleccionarTodo(editor);

    pulsar(etiqueta);

    await waitFor(() => expect(htmlEmitido()).toContain(tag));
  });

  it("🔴 «Cita» emite `<blockquote><p>` — la forma anidada que el conversor ya sangra", async () => {
    const editor = await montar();
    seleccionarTodo(editor);

    pulsar("Cita");

    // La forma ANIDADA es la única que produce Tiptap, y es justo la que hasta el 2026-09-16 perdía
    // la sangría en el PDF. Se afirma sobre ella para que quede atado a lo que el conversor arregló:
    // si Tiptap cambiara de forma, esta prueba avisa antes de que la cita salga sin sangrar.
    await waitFor(() => expect(htmlEmitido()).toContain("<blockquote>"));
    expect(htmlEmitido()).toMatch(/<blockquote>\s*<p>/);
  });

  it("🔴 «Línea horizontal» emite `<hr>` — que el conversor dibuja desde el 2026-09-17", async () => {
    await montar();

    pulsar("Línea horizontal");

    await waitFor(() => expect(htmlEmitido()).toContain("<hr"));
  });

  it("los botones reflejan si la marca está ACTIVA en la posición del cursor", async () => {
    const editor = await montar();
    seleccionarTodo(editor);

    expect(screen.getByLabelText("Negrilla")).toHaveAttribute(
      "aria-pressed",
      "false",
    );

    pulsar("Negrilla");

    await waitFor(() =>
      expect(screen.getByLabelText("Negrilla")).toHaveAttribute(
        "aria-pressed",
        "true",
      ),
    );
  });
});

describe("RichTextEditor — deshacer y rehacer", () => {
  it("arrancan DESHABILITADOS: sin historial no hay nada que deshacer", async () => {
    await montar();

    expect(screen.getByLabelText("Deshacer")).toBeDisabled();
    expect(screen.getByLabelText("Rehacer")).toBeDisabled();
  });

  it("«Deshacer» revierte el último cambio, y «Rehacer» lo devuelve", async () => {
    const editor = await montar();
    seleccionarTodo(editor);

    pulsar("Negrilla");
    await waitFor(() => expect(htmlEmitido()).toContain("<strong>"));

    await waitFor(() =>
      expect(screen.getByLabelText("Deshacer")).not.toBeDisabled(),
    );
    pulsar("Deshacer");
    await waitFor(() => expect(htmlEmitido()).not.toContain("<strong>"));

    await waitFor(() =>
      expect(screen.getByLabelText("Rehacer")).not.toBeDisabled(),
    );
    pulsar("Rehacer");
    await waitFor(() => expect(htmlEmitido()).toContain("<strong>"));
  });

  it("no llevan `aria-pressed`: no son un estado, son una acción", async () => {
    await montar();

    expect(screen.getByLabelText("Deshacer")).not.toHaveAttribute(
      "aria-pressed",
    );
    expect(screen.getByLabelText("Rehacer")).not.toHaveAttribute(
      "aria-pressed",
    );
  });
});

describe("RichTextEditor — 🔴 las puertas que el PDF no cruza están cerradas", () => {
  // Estas tres no tienen botón, pero SIN apagarlas son alcanzables tecleando: `code` y `codeBlock`
  // con acentos graves, y el enlace con solo escribir una URL (`autolink` viene activado). El
  // conversor no emite ninguna de las tres, así que su formato desaparecería del acto administrativo
  // sin avisar. No están retiradas por gusto: están retiradas porque mienten.

  it("`code` y `codeBlock` no existen en el editor", async () => {
    const editor = await montar();

    expect(editor.can().toggleCode?.()).toBeFalsy();
    expect(editor.can().toggleCodeBlock?.()).toBeFalsy();
  });

  it("los enlaces no existen: el conversor no emite `<a>`", async () => {
    const editor = await montar();

    expect(editor.extensionManager.extensions.map((e) => e.name)).not.toContain(
      "link",
    );
  });
});
