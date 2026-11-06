/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/providencias (frontend) — pruebas
 * Feature: Basarse en un documento anterior (Fase 03.19, Plan 15 · D-04)
 * Archivo: SeccionDocumentosSimilares.test.tsx
 * Responsabilidad: Fijar las cuatro reglas de esta sección que, si se pierden, se pierden callando.
 *
 *   1. 🔴 EL VACÍO DICE POR QUÉ ESTÁ VACÍO. Hoy el vacío es el estado ÚNICO —la base desplegada no
 *      tiene ni una providencia emitida con contenido (plan 05: 258 documentos, 0 con contenido)—,
 *      así que esto es literalmente lo único que se va a ver en la UAT. Un genérico «No hay
 *      resultados» haría parecer que la función está rota o que hay un filtro mal puesto.
 *   2. 🔴 VACÍO Y AVERIADO SON DOS COSAS DISTINTAS. Si una consulta que falló se pintara como «no
 *      hay providencias anteriores», la pantalla afirmaría algo falso y además taparía la avería.
 *      Y un fallo NUNCA bloquea: la sección sigue siendo operable y se puede seguir redactando.
 *   3. 🔴 IMPORTAR NO APLANA. Lo que se levanta al padre conserva sus etiquetas, byte por byte.
 *   4. 🔴 IMPORTAR SOBRE UN CUERPO ESCRITO NO PISA NADA EN SILENCIO: pide confirmación nombrando el
 *      expediente y la fecha del documento de origen, y lo aplicado se puede deshacer.
 *
 *   ⚠️ Lo que estas pruebas NO dicen: nada sobre APARIENCIA. jsdom no carga CSS, así que el
 *   plegado, el atenuado del botón deshabilitado y la separación de los estados no están
 *   verificados aquí — lo que sí está es la ESTRUCTURA (`aria-expanded`, `disabled`, qué nodos
 *   existen), que es lo que un lector de pantalla y el teclado usan de verdad.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-09-22
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SeccionDocumentosSimilares from "./SeccionDocumentosSimilares";
import { DatetimeUtil } from "../../utils/datetime.util";
import type { ProvidenciaSimilar } from "../../services/ProvidenciaService";

const mocks = vi.hoisted(() => ({ similares: vi.fn() }));

vi.mock("../../services/ProvidenciaService", async (importOriginal) => {
  const real =
    await importOriginal<typeof import("../../services/ProvidenciaService")>();
  return {
    ...real,
    ProvidenciaService: { ...real.ProvidenciaService, similares: mocks.similares },
  };
});

/**
 * 🔴 EL COPY, COPIADO A MANO DE UI-SPEC §5.6 Y NO IMPORTADO DEL COMPONENTE.
 * Importar sus constantes haría que la prueba dijera «el componente pinta lo que el componente
 * dice», que es verdad siempre y no prueba nada. Esto es el contrato.
 */
const COPY = {
  vacioTitulo: "No hay providencias anteriores reutilizables",
  vacioPista:
    "Las providencias emitidas antes de esta versión guardaron solo el PDF, no su contenido. Desde ahora, las que usted emita quedarán disponibles aquí.",
  fallo:
    "No se pudieron consultar las providencias anteriores. Puede seguir redactando con normalidad.",
  rotulo: "Basarse en un documento anterior",
};

const TIPO = "ARCHIVO_POR_PAGO_O_CONVENIO_DE_PAGO";

/** El HTML redactado, con negrita y lista: es lo que tiene que sobrevivir entero a la importación. */
const CUERPO_ANTERIOR =
  "<p><strong>PRIMERO:</strong> se dispone el archivo.</p>" +
  "<ul><li>Primer ítem</li><li>Segundo ítem</li></ul>";

const providencia = (
  parcial: Partial<ProvidenciaSimilar> = {},
): ProvidenciaSimilar => ({
  docId: 260,
  docName: "Archivo por pago - EPAS 105",
  docCreatedAt: "2026-09-18T15:00:00.000Z",
  tipoCodigo: TIPO,
  expNumber: "001-2026",
  docStructure: {
    version: 1,
    tipoCodigo: TIPO,
    secciones: [{ clave: "cuerpo", html: CUERPO_ANTERIOR }],
  },
  ...parcial,
});

/** El sobre paginado del backend. `pages: 0` cuando no hay resultados — no 1. */
const sobre = (data: ProvidenciaSimilar[], extra: Record<string, number> = {}) => ({
  data,
  total: data.length,
  limit: 10,
  offset: 0,
  page: data.length > 0 ? 1 : 1,
  pages: data.length > 0 ? 1 : 0,
  ...extra,
});

const montar = (props: Partial<Parameters<typeof SeccionDocumentosSimilares>[0]> = {}) => {
  const onImportar = vi.fn();
  render(
    <SeccionDocumentosSimilares
      tipoCodigo={TIPO}
      cuerpoActual=""
      onImportar={onImportar}
      {...props}
    />,
  );
  return { onImportar };
};

/** La sección nace PLEGADA: hasta que no se despliega no se pide nada. */
const desplegar = () =>
  fireEvent.click(screen.getByRole("button", { name: new RegExp(COPY.rotulo) }));

beforeEach(() => {
  mocks.similares.mockReset();
  mocks.similares.mockResolvedValue(sobre([]));
});

describe("la sección nace plegada y no pide nada hasta que se abre", () => {
  it("🔴 no consulta al montar: sería una petición por cada apertura de la página", () => {
    montar();

    expect(mocks.similares).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: new RegExp(COPY.rotulo) }),
    ).toHaveAttribute("aria-expanded", "false");
  });

  it("consulta UNA vez al desplegar, y plegar y volver a abrir no repite la consulta", async () => {
    mocks.similares.mockResolvedValue(sobre([providencia()]));
    montar();

    desplegar();
    await waitFor(() => expect(mocks.similares).toHaveBeenCalledTimes(1));

    desplegar(); // plegar
    desplegar(); // volver a abrir
    await waitFor(() =>
      expect(screen.getByText(/Archivo por pago/)).toBeInTheDocument(),
    );
    expect(mocks.similares).toHaveBeenCalledTimes(1);
  });
});

describe("el vacío honesto — hoy el estado ÚNICO", () => {
  it("🔴 dice el encabezado y la pista LITERALES del contrato, no un genérico", async () => {
    montar();
    desplegar();

    expect(await screen.findByText(COPY.vacioTitulo)).toBeInTheDocument();
    expect(screen.getByText(COPY.vacioPista)).toBeInTheDocument();
    // Lo que NO puede aparecer: el genérico haría creer que hay un filtro mal puesto.
    expect(screen.queryByText(/No hay resultados/i)).toBeNull();
    expect(screen.queryByText(/No se encontraron documentos/i)).toBeNull();
  });
});

describe("el fallo — se dice dentro de la sección y NUNCA bloquea", () => {
  it("🔴 pinta el aviso literal y NO afirma que no haya providencias anteriores", async () => {
    mocks.similares.mockRejectedValue(new Error("500"));
    montar();
    desplegar();

    expect(await screen.findByText(COPY.fallo)).toBeInTheDocument();
    // La distinción que esta fase persigue: una consulta averiada no es una lista vacía.
    expect(screen.queryByText(COPY.vacioTitulo)).toBeNull();
  });

  it("la sección sigue siendo operable: se puede reintentar y la consulta se repite", async () => {
    mocks.similares.mockRejectedValueOnce(new Error("500"));
    mocks.similares.mockResolvedValue(sobre([providencia()]));
    montar();
    desplegar();

    fireEvent.click(await screen.findByRole("button", { name: "Reintentar" }));

    expect(await screen.findByText(/Archivo por pago/)).toBeInTheDocument();
    expect(screen.queryByText(COPY.fallo)).toBeNull();
  });
});

describe("importar — el formato sobrevive y nada se pisa en silencio", () => {
  it("🔴 sobre un cuerpo VACÍO no pregunta y levanta el HTML con sus etiquetas INTACTAS", async () => {
    mocks.similares.mockResolvedValue(sobre([providencia()]));
    const { onImportar } = montar({ cuerpoActual: "" });
    desplegar();

    fireEvent.click(await screen.findByRole("button", { name: "Usar como base" }));

    // Igualdad estricta: si alguien «normalizara» el contenido de camino al editor, el acto
    // administrativo saldría sin negrita ni listas y nada en el compilador lo diría.
    expect(onImportar).toHaveBeenCalledWith(CUERPO_ANTERIOR);
  });

  it("🔴 sobre un cuerpo ESCRITO pide confirmación nombrando expediente y fecha, y no importa hasta confirmar", async () => {
    mocks.similares.mockResolvedValue(sobre([providencia()]));
    const { onImportar } = montar({ cuerpoActual: "<p>Lo que ya escribí</p>" });
    desplegar();

    fireEvent.click(await screen.findByRole("button", { name: "Usar como base" }));

    const fecha = DatetimeUtil.formatDate("2026-09-18T15:00:00.000Z");
    expect(
      screen.getByText(
        `Va a reemplazar el texto que ya escribió con el de la providencia 001-2026 del ${fecha}. ¿Desea continuar?`,
      ),
    ).toBeInTheDocument();
    expect(onImportar).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Reemplazar" }));
    expect(onImportar).toHaveBeenCalledWith(CUERPO_ANTERIOR);
  });

  it("«Cancelar» en la confirmación deja el cuerpo como estaba", async () => {
    mocks.similares.mockResolvedValue(sobre([providencia()]));
    const { onImportar } = montar({ cuerpoActual: "<p>Lo que ya escribí</p>" });
    desplegar();

    fireEvent.click(await screen.findByRole("button", { name: "Usar como base" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(onImportar).not.toHaveBeenCalled();
    expect(screen.queryByText(/Va a reemplazar el texto/)).toBeNull();
  });

  it("🔴 lo importado se puede DESHACER: devuelve el cuerpo que había antes", async () => {
    mocks.similares.mockResolvedValue(sobre([providencia()]));
    const { onImportar } = montar({ cuerpoActual: "<p>Lo que ya escribí</p>" });
    desplegar();

    fireEvent.click(await screen.findByRole("button", { name: "Usar como base" }));
    fireEvent.click(screen.getByRole("button", { name: "Reemplazar" }));
    fireEvent.click(screen.getByRole("button", { name: "Deshacer" }));

    expect(onImportar).toHaveBeenLastCalledWith("<p>Lo que ya escribí</p>");
  });

  it("🔴 una providencia guardada con una VERSIÓN desconocida no se puede importar, y dice por qué", async () => {
    mocks.similares.mockResolvedValue(
      sobre([
        providencia({
          docStructure: {
            version: 99,
            tipoCodigo: TIPO,
            secciones: [{ clave: "cuerpo", html: CUERPO_ANTERIOR }],
          },
        }),
      ]),
    );
    const { onImportar } = montar();
    desplegar();

    const boton = await screen.findByRole("button", { name: "Usar como base" });
    expect(boton).toBeDisabled();
    // No basta con apagarlo: un botón apagado sin motivo es una pantalla que no dice nada.
    expect(boton).toHaveAttribute("title", expect.stringContaining("versión"));

    fireEvent.click(boton);
    expect(onImportar).not.toHaveBeenCalled();
  });
});

describe("degradación y paginado", () => {
  it("🔴 una providencia SIN número de expediente se enseña igual y NO pinta «undefined»", async () => {
    mocks.similares.mockResolvedValue(
      sobre([providencia({ expNumber: undefined })]),
    );
    montar();
    desplegar();

    expect(await screen.findByText(/Archivo por pago/)).toBeInTheDocument();
    expect(screen.getByText(/Expediente no disponible/i)).toBeInTheDocument();
    expect(screen.queryByText(/undefined/)).toBeNull();
  });

  it("🔴 la página siguiente se pide con el `limit` que dijo la RESPUESTA, no con el que se mandó", async () => {
    // El backend acota el tamaño de página a 100 en silencio. Paginar con un tamaño que el
    // servidor no aplicó se salta registros sin avisar a nadie.
    mocks.similares.mockResolvedValueOnce({
      data: [providencia()],
      total: 2,
      limit: 1, // ← el servidor aplicó 1, no los 10 que se pidieron
      offset: 0,
      page: 1,
      pages: 2,
    });
    mocks.similares.mockResolvedValueOnce({
      data: [providencia({ docId: 261, docName: "Segunda providencia" })],
      total: 2,
      limit: 1,
      offset: 1,
      page: 2,
      pages: 2,
    });
    montar();
    desplegar();

    fireEvent.click(await screen.findByRole("button", { name: "Cargar más" }));

    await waitFor(() => expect(mocks.similares).toHaveBeenCalledTimes(2));
    expect(mocks.similares).toHaveBeenLastCalledWith({
      tipoCodigo: TIPO,
      limit: 1,
      offset: 1,
    });
    expect(await screen.findByText(/Segunda providencia/)).toBeInTheDocument();
  });

  it("el extracto de la tarjeta se pinta como TEXTO, no como marcado interpretado", async () => {
    mocks.similares.mockResolvedValue(sobre([providencia()]));
    montar();
    desplegar();

    // El extracto lleva el texto del cuerpo sin sus etiquetas; lo que NO puede haber en el DOM de
    // la tarjeta es un `<strong>` nacido del HTML almacenado (T-03.19-64). El contenido vuelve al
    // editor, que es quien lo sanea: aquí es una cadena y nada más.
    const tarjeta = (await screen.findByText(/Archivo por pago/)).closest(
      "details",
    ) as HTMLElement;
    expect(tarjeta).not.toBeNull();
    expect(tarjeta.querySelector("strong")).toBeNull();
    expect(tarjeta.querySelector("ul")).toBeNull();
    expect(tarjeta.textContent).toContain("PRIMERO: se dispone el archivo.");
  });
});
