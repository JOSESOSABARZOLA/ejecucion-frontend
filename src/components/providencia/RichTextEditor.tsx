/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/providencias (frontend)
 * Feature: Composición de providencias (Fase 03.14, Plan 06)
 * Archivo: RichTextEditor.tsx
 * Responsabilidad: Editor de texto enriquecido (Tiptap) para las secciones de la providencia.
 *
 *   PORTADO de `resolucion-frontend` (`origin/dev`, features/document-generation/RichTextEditor.tsx)
 *   con dos añadidos: listas numeradas y viñetas en la toolbar, y una API para insertar texto en el
 *   cursor (los tokens del expediente).
 *
 *   ⚠️ DIFERENCIA DE FONDO CON RESOLUCIÓN: allí este editor es DECORATIVO —el HTML se aplana a texto
 *   plano antes de generar el PDF, así que la negrita que el usuario pone no sale—. Aquí el HTML
 *   viaja al backend y se traduce a nodos pdfmake, así que todo lo que se marque aquí SE IMPRIME:
 *   negrita, cursiva, subrayado, títulos, viñetas y listas numeradas salen tal cual en el PDF.
 *
 *   Desde el 2026-09-03 el sistema ya NO renumera lo que se escribe aquí (antes convertía las listas
 *   numeradas en «1.1» y «2.1 PRIMERO:»): manda el editor. Los títulos y la numeración los pone
 *   quien redacta, y por eso la barra ofrece encabezados.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-08-17
 * Modificado por: Andrés Miño — 2026-09-17 (quick 260917-bqt: barra completa —tachado, tres niveles
 *   de título, cita, línea horizontal, deshacer y rehacer— y cierre de `code`, `codeBlock` y `link`,
 *   que eran alcanzables sin botón y no sobreviven al PDF)
 *
 *   🔴 LA REGLA QUE GOBIERNA ESTA BARRA: un botón que el PDF no respeta es una TRAMPA en un acto
 *   administrativo —el decisor vería en pantalla algo que no está en el documento que firma, y sin
 *   ningún aviso—. Por eso el orden no es negociable: PRIMERO el conversor del backend
 *   (`richtext-a-pdfmake.ts`) aprende a emitir la etiqueta, DESPUÉS aparece el control aquí.
 *   Cualquier añadido futuro a esta barra sigue ese mismo orden.
 */

import { useEffect, useState, type FC } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  /** Entrega el editor al padre para poder insertar tokens en el cursor. */
  onEditorReady?: (editor: Editor) => void;
  placeholder?: string;
}

const RichTextEditor: FC<RichTextEditorProps> = ({
  value,
  onChange,
  onEditorReady,
  placeholder = "Escriba el contenido de la sección…",
}) => {
  // Tiptap muta el editor sin avisar a React: este contador fuerza el re-render para que los botones
  // de la toolbar reflejen si la marca está activa en la posición del cursor.
  const [, setVersion] = useState(0);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // ── 🔴 PUERTAS CERRADAS A PROPÓSITO (no son controles retirados por gusto) ───────────────
        // El conversor del backend (`richtext-a-pdfmake.ts`) traduce una LISTA BLANCA de etiquetas;
        // lo que no está en ella se descarta conservando el texto. Estas tres no tienen botón, pero
        // sin apagarlas son alcanzables SIN QUERER mientras se escribe, y lo que producen
        // desaparecería del acto administrativo sin ningún aviso:
        //
        //   · `code` y `codeBlock` se activan tecleando acentos graves (`` ` `` y ``` ``` ```), que
        //     es un descuido fácil. El bloque de código, además, pierde los saltos de línea al
        //     convertirse: no se degrada, se desordena.
        //   · `link` lo trae `StarterKit` desde Tiptap 3 y viene con `autolink: true`, así que basta
        //     escribir una URL para crear un `<a>`. En pantalla se vería azul y subrayado; en el PDF
        //     saldría texto llano. Y en un documento impreso un enlace no se pulsa.
        //
        // Si alguna vez hacen falta, el orden es el de siempre: PRIMERO el conversor aprende a
        // emitirlas, DESPUÉS se encienden aquí. Nunca al revés.
        code: false,
        codeBlock: false,
        link: false,
      }),
      Underline,
    ],
    content: value,
    editorProps: {
      attributes: {
        class: "app-rich-editor-content",
        "data-placeholder": placeholder,
      },
    },
    onUpdate: ({ editor: actual }) => {
      queueMicrotask(() => {
        onChange(actual.getHTML());
        setVersion((v) => v + 1);
      });
    },
    onSelectionUpdate: () => setVersion((v) => v + 1),
  });

  useEffect(() => {
    if (editor) onEditorReady?.(editor);
  }, [editor, onEditorReady]);

  useEffect(() => {
    if (!editor) return;
    // Solo se reescribe si el valor de fuera difiere: sin esta guarda, cada tecleo reposicionaría el
    // cursor al principio (el padre devuelve el HTML que el propio editor acaba de emitir).
    if (value !== editor.getHTML()) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
  }, [editor, value]);

  if (!editor) {
    return (
      <div className="app-rich-editor">
        <div className="app-rich-editor-loading">Cargando editor…</div>
      </div>
    );
  }

  const boton = (
    activo: boolean,
    etiqueta: string,
    contenido: React.ReactNode,
    accion: () => void,
  ) => (
    <button
      type="button"
      className={`app-rich-editor-btn ${activo ? "is-active" : ""}`}
      onClick={accion}
      aria-label={etiqueta}
      aria-pressed={activo}
    >
      {contenido}
    </button>
  );

  /**
   * Botón de ACCIÓN, sin estado activo — deshacer y rehacer.
   *
   * No usan `boton(...)` porque `aria-pressed` describe un interruptor («la negrita está puesta») y
   * deshacer no es un interruptor: es algo que ocurre y se acaba. Anunciarlo como no pulsado en cada
   * render sería ruido para quien navega con lector de pantalla. Lo que sí tienen es DISPONIBILIDAD,
   * y eso se dice con `disabled`: sin historial no hay nada que deshacer.
   */
  const botonAccion = (
    etiqueta: string,
    contenido: React.ReactNode,
    accion: () => void,
    habilitado: boolean,
  ) => (
    <button
      type="button"
      className="app-rich-editor-btn"
      onClick={accion}
      aria-label={etiqueta}
      disabled={!habilitado}
    >
      {contenido}
    </button>
  );

  return (
    <div className="app-rich-editor">
      <div
        className="app-rich-editor-toolbar"
        role="toolbar"
        aria-label="Formato de texto"
      >
        {boton(editor.isActive("bold"), "Negrilla", <strong>B</strong>, () =>
          editor.chain().focus().toggleBold().run(),
        )}
        {boton(editor.isActive("italic"), "Cursiva", <em>I</em>, () =>
          editor.chain().focus().toggleItalic().run(),
        )}
        {boton(
          editor.isActive("underline"),
          "Subrayado",
          <span className="app-rich-editor-underline">U</span>,
          () => editor.chain().focus().toggleUnderline().run(),
        )}
        {boton(editor.isActive("strike"), "Tachado", <s>S</s>, () =>
          editor.chain().focus().toggleStrike().run(),
        )}
        <span className="app-rich-editor-sep" aria-hidden="true" />
        {/* Encabezados: desde que manda el editor, los títulos del documento («ANTECEDENTES»,
            «DISPOSICIONES») los pone quien redacta, así que tiene que poder marcarlos.

            Los rótulos dicen T1/T2/T3 para h1/h2/h3. Antes h2 se llamaba «Título» y se mostraba como
            «T1»: al aparecer h1 ese rótulo pasaba a señalar el nivel equivocado, y un editor que
            miente sobre el nivel del título es el mismo defecto que esta barra viene a cerrar.

            De h4 a h6 el conversor los respeta, pero NO se exponen: una providencia no anida tanto y
            seis niveles ensucian la barra. Decisión reversible — si hacen falta, basta añadirlos. */}
        {boton(
          editor.isActive("heading", { level: 1 }),
          "Título 1",
          <span>T1</span>,
          () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
        )}
        {boton(
          editor.isActive("heading", { level: 2 }),
          "Título 2",
          <span>T2</span>,
          () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
        )}
        {boton(
          editor.isActive("heading", { level: 3 }),
          "Título 3",
          <span>T3</span>,
          () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
        )}
        <span className="app-rich-editor-sep" aria-hidden="true" />
        {boton(
          editor.isActive("orderedList"),
          "Lista numerada",
          <span>1.</span>,
          () => editor.chain().focus().toggleOrderedList().run(),
        )}
        {boton(editor.isActive("bulletList"), "Viñetas", <span>•</span>, () =>
          editor.chain().focus().toggleBulletList().run(),
        )}
        <span className="app-rich-editor-sep" aria-hidden="true" />
        {/* Cita y línea horizontal: los dos estrenan botón el 2026-09-17, y ni un día antes. Hasta
            esa fecha el conversor del backend perdía la sangría de la cita y se comía el `<hr>` en
            silencio; ofrecerlos aquí habría sido enseñarle al decisor algo que el documento que
            firma no tiene. Primero el PDF aprendió a dibujarlos, después aparecieron aquí. */}
        {boton(editor.isActive("blockquote"), "Cita", <span>«»</span>, () =>
          editor.chain().focus().toggleBlockquote().run(),
        )}
        {/* La raya se INSERTA, no se conmuta: por eso va como acción y no lleva `aria-pressed`. */}
        {botonAccion(
          "Línea horizontal",
          <span>―</span>,
          () => editor.chain().focus().setHorizontalRule().run(),
          editor.can().setHorizontalRule(),
        )}
        <span className="app-rich-editor-sep" aria-hidden="true" />
        {botonAccion(
          "Deshacer",
          <span>↶</span>,
          () => editor.chain().focus().undo().run(),
          editor.can().undo(),
        )}
        {botonAccion(
          "Rehacer",
          <span>↷</span>,
          () => editor.chain().focus().redo().run(),
          editor.can().redo(),
        )}
      </div>

      <EditorContent editor={editor} />
    </div>
  );
};

export default RichTextEditor;
