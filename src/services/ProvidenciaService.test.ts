/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/providencias (frontend) — tests
 * Archivo: ProvidenciaService.test.ts
 * Responsabilidad: Blindar las dos cosas de la vista previa que, si se rompen, no se notan hasta
 *   que alguien firma un documento equivocado.
 *
 *   1. Que la petición viaje CANCELABLE. Con el refresco automático llegan a solaparse varias, y
 *      sin cancelación puede llegar antes la vieja: quedaría en pantalla un borrador ANTERIOR al
 *      texto que ya se ve en el editor. Quitar el `signal` del axios no rompe ningún test obvio —
 *      la vista previa sigue "funcionando"— y por eso hay uno aquí.
 *   2. Que un fallo diga POR QUÉ. El cuerpo del error llega como Blob (`responseType: "blob"`), así
 *      que el normalizador del httpClient no lo entiende y cae en «Request failed with status code
 *      400», que no ayuda a nadie.
 *
 *   Fase 03.15 (Plan 06) añade la tercera: que `emitir` viaje como MULTIPART y `vistaPrevia` NO.
 *   Es la trampa medida de la fase — el modal calcula la firma del borrador serializando el payload
 *   y lo relanza con `JSON.parse`, y un `File` no sobrevive a ese viaje. Si alguien «homologa» los
 *   dos métodos pasando también la vista previa a FormData, el refresco automático del borrador se
 *   rompe entero y nada en el compilador lo dice.
 *
 *   Quick 261006-el5 añade la cuarta: el borrador guardado en el servidor viaja con EXACTAMENTE
 *   `cuerpo` y `tipoCodigo` (D-01). Una clave de más la rechazaría el pipe del backend con un 400
 *   y el autoguardado fallaría entero.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-09-14
 * Modificado por: Andrés Miño — 2026-10-06 (quick 261006-el5 — leerBorrador, guardarBorrador y
 *   descartarBorrador; el doble de httpClient gana put y delete).
 * Modificado por: Andrés Miño — 2026-10-26 (Fase 03.21, Plan 10, D-16: la prueba que prohibía la
 *   clave en el payload se reemplaza por cuatro aserciones — `signPassword` hermano de `payload`,
 *   ausente sin clave, nunca en el payload ni en la vista previa — y `ProvidenciaEmitida.firma`).
 * Modificado por: Andrés Miño — 2026-10-28 (DMI pasa a llamarse DMIT)
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  post: vi.fn(),
  get: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}));

vi.mock("../api/httpClient", () => ({
  default: {
    post: mocks.post,
    get: mocks.get,
    put: mocks.put,
    delete: mocks.delete,
  },
}));

import { ProvidenciaService } from "./ProvidenciaService";
import type {
  EmitirProvidenciaPayload,
  ProvidenciaEmitida,
} from "./ProvidenciaService";
import type { InternalAxiosRequestConfig } from "axios";
import { SUBIDA_TIMEOUT_MS } from "./TrabajoComunitarioService";

const borrador = {
  eejeId: 1,
  tipoCodigo: "TRABAJO_COMUNITARIO",
  cabecera: {},
  secciones: [],
} as unknown as EmitirProvidenciaPayload;

const pdf = (nombre: string) =>
  new File([new Blob(["%PDF"])], nombre, { type: "application/pdf" });

/**
 * Las RUTAS de todos los campos del payload, a cualquier profundidad (`secciones[0].clave`).
 *
 * Se recorre en profundidad y se devuelve la ruta entera, no el nombre suelto, por dos motivos: un
 * campo de más no llegaría como `payload.x`, llegaría escondido dentro de `cabecera` o de un objeto
 * nuevo; y para poder decir DÓNDE está el hallazgo, que es lo que permite distinguir el campo
 * legítimo del que no lo es.
 */
const rutasProfundas = (valor: unknown, prefijo = ""): string[] => {
  if (Array.isArray(valor))
    return valor.flatMap((v, i) => rutasProfundas(v, `${prefijo}[${i}]`));
  if (valor && typeof valor === "object")
    return Object.entries(valor as Record<string, unknown>).flatMap(
      ([k, v]) => {
        const ruta = prefijo ? `${prefijo}.${k}` : k;
        return [ruta, ...rutasProfundas(v, ruta)];
      },
    );
  return [];
};

describe("emitir la providencia — multipart (Fase 03.15, D-5)", () => {
  beforeEach(() => {
    mocks.post.mockReset();
    mocks.post.mockResolvedValue({ data: { docId: 1 } });
  });

  const cuerpoDe = (llamada: number): FormData =>
    mocks.post.mock.calls[llamada][1] as FormData;

  it("🔴 manda un FormData con el borrador entero en el campo de texto `payload`", async () => {
    await ProvidenciaService.emitir(borrador);

    const cuerpo = cuerpoDe(0);
    expect(cuerpo).toBeInstanceOf(FormData);
    // El payload viaja como CADENA en UN solo campo: es lo que permite reutilizar `armarPayload`
    // tal cual y no tocar la firma del borrador.
    expect(JSON.parse(cuerpo.get("payload") as string)).toEqual(borrador);
  });

  it("🔴 la DIRECCIÓN de vuelta viaja DENTRO del `payload`, no como campo suelto del FormData", async () => {
    await ProvidenciaService.emitir({
      ...borrador,
      tipoCodigo: "DEVOLUCION_POR_NULIDAD_DE_AUTORIDAD_COMPETENTE",
      devolucionDestino: "DMIT",
    });

    const cuerpo = cuerpoDe(0);
    // El backend la lee de `body.payload.devolucionDestino`: como campo suelto, el `whitelist` del
    // ValidationPipe la rechazaría y la providencia fallaría diciendo que falta la dirección que el
    // decisor sí eligió.
    const payload = JSON.parse(cuerpo.get("payload") as string) as {
      devolucionDestino?: string;
    };
    expect(payload.devolucionDestino).toBe("DMIT");
    expect(cuerpo.has("devolucionDestino")).toBe(false);
  });

  it("🔴 lleva los DOS ficheros en el mismo acto: es lo que exige el tipo 30 (D-7)", async () => {
    await ProvidenciaService.emitir(borrador, {
      comprobante: pdf("comprobante.pdf"),
      informe: pdf("informe.pdf"),
    });

    const cuerpo = cuerpoDe(0);
    expect((cuerpo.get("comprobante") as File).name).toBe("comprobante.pdf");
    expect((cuerpo.get("informe") as File).name).toBe("informe.pdf");
  });

  it("sin prueba que aportar NO manda campos de fichero vacíos: la providencia solo CITA", async () => {
    await ProvidenciaService.emitir(borrador);

    const cuerpo = cuerpoDe(0);
    expect(cuerpo.has("comprobante")).toBe(false);
    expect(cuerpo.has("informe")).toBe(false);
  });

  it("🔴 declara multipart/form-data: con el application/json por defecto del httpClient, axios convertía el FormData en JSON", async () => {
    await ProvidenciaService.emitir(borrador, { comprobante: pdf("c.pdf") });

    const opciones = mocks.post.mock.calls[0][2] as
      { headers?: Record<string, string> } | undefined;
    expect(opciones?.headers?.["Content-Type"]).toBe("multipart/form-data");
  });

  it("🔴 con ese encabezado el transformRequest real de axios deja pasar el FormData; con application/json lo aplana a JSON", async () => {
    const { default: axiosReal, AxiosHeaders } =
      await vi.importActual<typeof import("axios")>("axios");
    const transformar = (contentType: string) => {
      const cuerpo = new FormData();
      cuerpo.append("comprobante", pdf("c.pdf"));
      const headers = AxiosHeaders.from({ "Content-Type": contentType });
      const transforms = [axiosReal.defaults.transformRequest].flat();
      return transforms.reduce<unknown>(
        (datos, fn) =>
          fn!.call({ headers } as InternalAxiosRequestConfig, datos, headers),
        cuerpo,
      );
    };

    expect(transformar("multipart/form-data")).toBeInstanceOf(FormData);
    // El defecto 03.21 en el 127: el fichero llega como objeto vacío y el ValidationPipe lo rechaza.
    expect(JSON.parse(transformar("application/json") as string)).toEqual({
      comprobante: {},
    });
  });

  it("🔴 el HTML redactado viaja TAL CUAL dentro del payload (Fase 03.19, D-03)", async () => {
    // El contrato del servicio, no el de la pantalla: aquí no se toca el HTML. Si alguien decidiera
    // «normalizar» o aplanar el cuerpo de camino al FormData, el acto administrativo se emitiría sin
    // negrita ni listas y nada en el compilador lo diría. El conversor del backend
    // (`richtext-a-pdfmake`) espera estas etiquetas: son su entrada.
    const cuerpo =
      "<p><strong>Negrita</strong> con acentuación</p><ul><li>Primer ítem</li></ul>";
    await ProvidenciaService.emitir({
      ...borrador,
      secciones: [{ clave: "cuerpo", html: cuerpo }],
    });

    const payload = JSON.parse(
      cuerpoDe(0).get("payload") as string,
    ) as EmitirProvidenciaPayload;
    expect(payload.secciones[0].html).toBe(cuerpo);
  });

  it("🔴 la clave viaja SOLO por el canal de firma: hermana de payload, nunca en payload ni en la vista previa (Fase 03.21, D-16)", async () => {
    // Reemplaza a la prueba de la 03.19 que prohibía cualquier clave en el payload. La frontera ya
    // no está cerrada: la clave del certificado viaja, pero por UN solo canal —el campo
    // `signPassword` del multipart, HERMANO de `payload`— y nunca dentro del borrador, que además
    // se serializa para la vista previa y acabaría en un borrador guardado, en un log o en el
    // historial del navegador. El valor de abajo es un marcador de prueba, no una clave.
    const MARCADOR = "marcador-de-prueba";
    const payloadConTodo: EmitirProvidenciaPayload = {
      ...borrador,
      secciones: [{ clave: "cuerpo", html: "<p>Texto</p>" }],
      cabecera: { asunto: "Impulso", multaImpuesta: 470 },
      prorroga: { concedida: true, motivo: "Motivo suficiente." },
    };

    // (1) y (2) Con clave: el FormData la lleva en `signPassword`, FUERA de `payload`.
    await ProvidenciaService.emitir(
      payloadConTodo,
      { comprobante: pdf("comprobante.pdf") },
      MARCADOR,
    );
    const cuerpo = cuerpoDe(0);
    expect(cuerpo.get("signPassword")).toBe(MARCADOR);
    expect((cuerpo.get("comprobante") as File).name).toBe("comprobante.pdf");
    expect(mocks.post.mock.calls[0][2]).toEqual({
      headers: { "Content-Type": "multipart/form-data" },
      timeout: SUBIDA_TIMEOUT_MS,
    });

    const textoPayload = cuerpo.get("payload") as string;
    expect(textoPayload).not.toContain(MARCADOR);
    const rutas = rutasProfundas(JSON.parse(textoPayload));
    // Nada con forma de secreto, en ninguna parte y a ninguna profundidad.
    expect(
      rutas.filter((r) => /password|contrase|secret|pin\b/i.test(r)),
    ).toEqual([]);
    // «clave» a secas es un HOMÓNIMO desafortunado: `secciones[].clave` es el IDENTIFICADOR de la
    // sección («cuerpo») desde la Fase 03.14. Se enumera exactamente dónde puede aparecer en vez de
    // excluir el patrón, que dejaría pasar un `claveFirma` el día que alguien lo añada.
    expect(rutas.filter((r) => /clave/i.test(r))).toEqual([
      "secciones[0].clave",
    ]);

    // (3) Sin clave —o con una en blanco— no hay entrada `signPassword`: mandar una vacía sería
    //     pedirle al firmador que lo intente con nada.
    await ProvidenciaService.emitir(payloadConTodo);
    await ProvidenciaService.emitir(payloadConTodo, undefined, "");
    await ProvidenciaService.emitir(payloadConTodo, undefined, "   ");
    for (const llamada of [1, 2, 3]) {
      expect(cuerpoDe(llamada).has("signPassword")).toBe(false);
    }

    // (4) La vista previa no la conoce: su cuerpo no la lleva en ningún nivel.
    globalThis.URL.createObjectURL = vi.fn(() => "blob:borrador");
    mocks.post.mockResolvedValue({ data: new Blob(["%PDF"]) });
    await ProvidenciaService.vistaPrevia(payloadConTodo);
    const cuerpoVista = mocks.post.mock.calls[4][1] as unknown;
    expect(cuerpoVista).not.toBeInstanceOf(FormData);
    expect(
      rutasProfundas(cuerpoVista).filter((r) =>
        /signPassword|password|contrase/i.test(r),
      ),
    ).toEqual([]);
    expect(JSON.stringify(cuerpoVista)).not.toContain(MARCADOR);
    // Y la función no admite ese parámetro: su segundo argumento es la señal de cancelación.
    expect(ProvidenciaService.vistaPrevia.length).toBeLessThanOrEqual(2);
  });

  it("devuelve si la firma se aplicó (`firma.aplicada`, Fase 03.21, D-11)", async () => {
    const respuesta: Pick<ProvidenciaEmitida, "docId" | "firma"> = {
      docId: 9,
      firma: { aplicada: true },
    };
    mocks.post.mockResolvedValue({ data: respuesta });

    const emitida = await ProvidenciaService.emitir(borrador);

    expect(emitida.firma).toEqual({ aplicada: true });
  });

  it("devuelve las ADVERTENCIAS que traiga la respuesta (D-6: se avisa, no se bloquea)", async () => {
    mocks.post.mockResolvedValue({
      data: {
        docId: 7,
        advertencias: [
          {
            codigo: "TC_ARCHIVO_TOTAL_SOBRE_CUMPLIMIENTO_PARCIAL",
            mensaje: "El cumplimiento fue parcial.",
          },
        ],
      },
    });

    const emitida = await ProvidenciaService.emitir(borrador);

    expect(emitida.advertencias?.[0].codigo).toBe(
      "TC_ARCHIVO_TOTAL_SOBRE_CUMPLIMIENTO_PARCIAL",
    );
  });
});

describe("vista previa de la providencia", () => {
  beforeEach(() => {
    mocks.post.mockReset();
    globalThis.URL.createObjectURL = vi.fn(() => "blob:borrador");
  });

  it("🔴 la petición viaja CANCELABLE: sin eso, una respuesta vieja puede pisar a la nueva", async () => {
    mocks.post.mockResolvedValue({ data: new Blob(["%PDF"]) });
    const control = new AbortController();

    await ProvidenciaService.vistaPrevia(borrador, control.signal);

    expect(mocks.post).toHaveBeenCalledWith(
      "/providencias/vista-previa",
      borrador,
      expect.objectContaining({
        responseType: "blob",
        signal: control.signal,
      }),
    );
  });

  it("devuelve una URL utilizable por el visor", async () => {
    mocks.post.mockResolvedValue({ data: new Blob(["%PDF"]) });

    expect(await ProvidenciaService.vistaPrevia(borrador)).toBe(
      "blob:borrador",
    );
  });

  it("🔴 SIGUE mandando un objeto JSON, no un FormData: si cambia, el refresco del borrador muere", async () => {
    // El modal calcula la firma del borrador con JSON.stringify(payload) y la relanza con
    // JSON.parse. Un File no sobrevive a ese viaje, así que la vista previa se queda en JSON —
    // y además no lo necesita: no persiste nada.
    mocks.post.mockResolvedValue({ data: new Blob(["%PDF"]) });

    await ProvidenciaService.vistaPrevia(borrador);

    const cuerpo = mocks.post.mock.calls[0][1];
    expect(cuerpo).not.toBeInstanceOf(FormData);
    expect(cuerpo).toBe(borrador);
  });

  it("🔴 un fallo dice POR QUÉ, aunque el servidor lo mande dentro de un Blob", async () => {
    const cuerpo = new Blob([
      JSON.stringify({
        error: { message: 'El tipo "X" no existe en el catálogo.' },
      }),
    ]);
    const err = Object.assign(
      new Error("Request failed with status code 404"),
      {
        isHttpClientError: true,
        originalError: { response: { data: cuerpo } },
      },
    );
    mocks.post.mockRejectedValue(err);

    await expect(ProvidenciaService.vistaPrevia(borrador)).rejects.toThrow(
      /no existe en el catálogo/,
    );
  });

  it("si el cuerpo no se puede leer, NO inventa un motivo", async () => {
    // Devolver un mensaje plausible pero falso sería peor que devolver el genérico: mandaría a
    // buscar un problema que no existe.
    const err = Object.assign(new Error("Network Error"), {
      isHttpClientError: true,
      originalError: { response: { data: new Blob(["esto no es json"]) } },
    });
    mocks.post.mockRejectedValue(err);

    await expect(ProvidenciaService.vistaPrevia(borrador)).rejects.toThrow(
      "Network Error",
    );
  });
});

/**
 * Fase 03.19 (Plan 15, D-04). La lectura de providencias anteriores. Lo que se blinda aquí es la
 * QUERY, porque es donde está la trampa: el `ValidationPipe` del backend corre con `whitelist` y
 * `forbidNonWhitelisted`, así que un parámetro de más —o uno conocido mandado en blanco— **no se
 * ignora: devuelve 400**, y en la pantalla eso se lee como «no se pudieron consultar las
 * providencias anteriores», que es una afirmación distinta y falsa.
 */
describe("providencias similares — la query es el contrato (Fase 03.19, D-04)", () => {
  const sobre = {
    data: [],
    total: 0,
    limit: 10,
    offset: 0,
    page: 1,
    pages: 0,
  };

  beforeEach(() => {
    mocks.get.mockReset();
    mocks.get.mockResolvedValue({ data: sobre });
  });

  const queryDeLaLlamada = (): URLSearchParams =>
    new URLSearchParams(
      (mocks.get.mock.calls[0][0] as string).split("?")[1] ?? "",
    );

  it("🔴 manda `tipoCodigo` y NADA más cuando no se pagina", async () => {
    await ProvidenciaService.similares({ tipoCodigo: "ARCHIVO_POR_PAGO" });

    const query = queryDeLaLlamada();
    // Enumerar las claves presentes, no solo comprobar que está `tipoCodigo`: un `limit=undefined`
    // o un `offset=` vacío colados por el serializador harían fallar la petición entera con un 400
    // sin mensaje útil, y una aserción laxa seguiría en verde.
    expect([...query.keys()]).toEqual(["tipoCodigo"]);
    expect(query.get("tipoCodigo")).toBe("ARCHIVO_POR_PAGO");
  });

  it("manda `limit` y `offset` cuando se paginan, y `offset=0` no se pierde por ser cero", async () => {
    await ProvidenciaService.similares({
      tipoCodigo: "ARCHIVO_POR_PAGO",
      limit: 10,
      offset: 0,
    });

    const query = queryDeLaLlamada();
    expect(query.get("limit")).toBe("10");
    // `0` es un desplazamiento válido: un filtro de vacíos escrito con `if (valor)` lo tiraría.
    expect(query.get("offset")).toBe("0");
  });

  it("🔴 pega a `/providencias/similares` y devuelve el sobre paginado tal cual", async () => {
    const resultado = await ProvidenciaService.similares({
      tipoCodigo: "ARCHIVO_POR_PAGO",
    });

    expect((mocks.get.mock.calls[0][0] as string).split("?")[0]).toBe(
      "/providencias/similares",
    );
    // `pages: 0` con lista vacía es lo que devuelve el backend hoy, y el consumidor lo necesita
    // intacto para no inventarse una página que no existe.
    expect(resultado).toEqual(sobre);
  });
});

describe("el borrador guardado en el servidor (quick 261006-el5)", () => {
  beforeEach(() => {
    mocks.get.mockReset();
    mocks.put.mockReset();
    mocks.delete.mockReset();
  });

  it("leerBorrador hace GET a /providencias/borrador/:eejeId y devuelve data.borrador", async () => {
    const guardado = {
      tipoCodigo: "ATENCION_A_ESCRITO",
      cuerpo: "<p>hola</p>",
      actualizadoAt: "2026-10-06T19:32:00.000Z",
    };
    mocks.get.mockResolvedValue({ data: { borrador: guardado } });

    await expect(ProvidenciaService.leerBorrador(42)).resolves.toEqual(guardado);
    expect(mocks.get).toHaveBeenCalledWith("/providencias/borrador/42");
  });

  it("leerBorrador sin borrador devuelve null", async () => {
    mocks.get.mockResolvedValue({ data: { borrador: null } });

    await expect(ProvidenciaService.leerBorrador(42)).resolves.toBeNull();
  });

  it("🔴 guardarBorrador hace PUT con EXACTAMENTE cuerpo y tipoCodigo (D-01)", async () => {
    mocks.put.mockResolvedValue({
      data: {
        tipoCodigo: "ATENCION_A_ESCRITO",
        cuerpo: "<p>hola</p>",
        actualizadoAt: "2026-10-06T19:32:00.000Z",
      },
    });

    await ProvidenciaService.guardarBorrador(42, {
      cuerpo: "<p>hola</p>",
      tipoCodigo: "ATENCION_A_ESCRITO",
    });

    expect(mocks.put).toHaveBeenCalledTimes(1);
    const [ruta, cuerpo] = mocks.put.mock.calls[0] as [string, object];
    expect(ruta).toBe("/providencias/borrador/42");
    expect(Object.keys(cuerpo).sort()).toEqual(["cuerpo", "tipoCodigo"]);
    expect(cuerpo).toEqual({
      cuerpo: "<p>hola</p>",
      tipoCodigo: "ATENCION_A_ESCRITO",
    });
  });

  it("guardarBorrador manda un tipo vacío como null", async () => {
    mocks.put.mockResolvedValue({ data: {} });

    await ProvidenciaService.guardarBorrador(42, {
      cuerpo: "<p>hola</p>",
      tipoCodigo: "",
    });

    expect(mocks.put.mock.calls[0][1]).toEqual({
      cuerpo: "<p>hola</p>",
      tipoCodigo: null,
    });
  });

  it("descartarBorrador hace DELETE a /providencias/borrador/:eejeId", async () => {
    mocks.delete.mockResolvedValue({ data: { eliminado: true } });

    await expect(ProvidenciaService.descartarBorrador(42)).resolves.toEqual({
      eliminado: true,
    });
    expect(mocks.delete).toHaveBeenCalledWith("/providencias/borrador/42");
  });
});
