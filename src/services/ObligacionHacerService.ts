/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/obligacion-hacer (frontend)
 * Feature: Contrato de la rama del correctivo
 * Archivo: ObligacionHacerService.ts
 * Responsabilidad: La PUERTA a los trece endpoints de `/obligacion-hacer`. Un método por ruta, en el
 *   orden del controlador, con el cuerpo exacto que su DTO admite. No decide nada: ni calcula plazos,
 *   ni deriva peldaños, ni aplica recargos.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-09-15
 * Modificado por: Andrés Miño — 2026-10-14 (quick 261014-jcy: salen la lectura y el registro de los
 *   actos del sello de clausura; el backend retiró sus dos rutas)
 *
 * ── LAS ADVERTENCIAS NO SON ERRORES, Y SE DICE UNA SOLA VEZ AQUÍ ──────────────────────────────
 * 🔴 Tres de estos actos pueden devolver `advertencias` DENTRO de una respuesta 2xx, sobre un
 * hecho YA CONSUMADO: el acto se registró. Quien las recibe las pinta como AVISO **después** del
 * éxito — nunca como fallo, nunca como bloqueo. La doctrina del módulo es avisar, no impedir: la
 * rama de hacer no lleva guards por decisión del área usuaria, y convertir un aviso en un bloqueo
 * en la pantalla reabriría esa decisión de tapadillo. Si el campo no viene, es que no hay avisos:
 * el servidor nunca manda un array vacío.
 *
 * ── LO QUE ESTE ARCHIVO NO CALCULA ────────────────────────────────────────────────────────────
 * · El RECARGO del 20 % del art. 239: se manda `valor` (la base) y el servidor devuelve `base`,
 *   `recargoPct`, `recargoValor` y `total`. Dos cálculos serían dos importes para una deuda que se
 *   cobra por coactiva.
 * · El ORDINAL del peldaño del art. 240 y el TÉRMINO del art. 10: llegan derivados de las lecturas.
 *
 * ── EL ACTOR NO VIAJA ─────────────────────────────────────────────────────────────────────────
 * 🔴 Quién firma el acto lo deriva el servidor del JWT. Ningún cuerpo de aquí lleva identificador de
 * usuario, y el `ValidationPipe` del backend corre con `whitelist` y `forbidNonWhitelisted`: un
 * campo de más no se ignora, se rechaza con un 400. Este servicio manda exactamente lo que el DTO
 * declara y nada más.
 *
 * ── D-3: LOS TRECE ENDPOINTS NO SE TOCAN (eran quince; se retiraron dos) ──────────────────────
 * Se consumen tal cual. Este archivo es el cliente, no el contrato.
 */
import httpClient from "../api/httpClient";
import type {
  ConAdvertencias,
  DiligenciaSustitutoria,
  ObligacionHacerDetalle,
  ResultadoAdjuntarDocumento,
  ResultadoGastosSustitutoria,
  ResultadoOrdenarSustitutoria,
  ResultadoRegistrarAlegacion,
  ResultadoRegistrarDiligencia,
  ResultadoDiligencia,
} from "../interfaces/IObligacionHacer";

/**
 * Timeout PROPIO de las cuatro subidas. El global del `httpClient` es de 5 s y aquí viaja un PDF
 * escaneado por una red municipal: si el cliente aborta a medias, el backend puede haber creado ya
 * el documento. Mismo criterio y mismo valor que el resto de multipart del módulo.
 */
export const SUBIDA_TIMEOUT_MS = 45000;

/** Las cabeceras y el timeout con que viajan los cuatro multipart de la rama. */
const OPCIONES_SUBIDA = {
  headers: { "Content-Type": "multipart/form-data" },
  timeout: SUBIDA_TIMEOUT_MS,
};

export const ObligacionHacerService = {
  // ═══════════════════════════════════════════════════════════════════════════════════════════
  // LECTURAS — `funcionario decisor`, `secretario abogado` y `director`
  // ═══════════════════════════════════════════════════════════════════════════════════════════

  /**
   * El detalle de la rama → `GET /obligacion-hacer/:eejeId`.
   *
   * ⚠️ **ES LA ÚNICA LECTURA QUE TRAE EL PELDAÑO.** Las bandejas traen el bloque sin él, así que una
   * condición sobre `serieCompulsorias.peldano` solo es decidible aquí.
   */
  async detalle(eejeId: number): Promise<ObligacionHacerDetalle> {
    const { data } = await httpClient.get<ObligacionHacerDetalle>(
      `/obligacion-hacer/${eejeId}`,
    );
    return data;
  },

  /**
   * La serie de diligencias de la ejecución sustitutoria →
   * `GET /obligacion-hacer/:eejeId/diligencias`.
   *
   * Los intentos en orden: cuántos hubo, cuáles fallaron y por qué.
   */
  async diligencias(eejeId: number): Promise<DiligenciaSustitutoria[]> {
    const { data } = await httpClient.get<DiligenciaSustitutoria[]>(
      `/obligacion-hacer/${eejeId}/diligencias`,
    );
    return data;
  },

  // ═══════════════════════════════════════════════════════════════════════════════════════════
  // ACTOS — `funcionario decisor`, y solo sobre SU expediente
  //
  // El rol lo comprueba el guard; la PERTENENCIA la impone el servicio del backend. Son dos
  // preguntas distintas y la segunda no se puede deducir del rol: la pantalla no lo intenta.
  // ═══════════════════════════════════════════════════════════════════════════════════════════

  /**
   * Declara que el expediente lleva correctivo → `POST /obligacion-hacer/:eejeId/declarar`.
   *
   * `observaciones` es contexto libre del decisor y es opcional: va al log, no a una columna.
   */
  async declarar(
    eejeId: number,
    datos: { observaciones?: string } = {},
  ): Promise<void> {
    await httpClient.post(`/obligacion-hacer/${eejeId}/declarar`, datos);
  },

  /**
   * Deshace la declaración → `POST /obligacion-hacer/:eejeId/deshacer`.
   *
   * 🔴 **`motivo` ES OBLIGATORIO**, y el backend le exige longitud mínima. Este servicio NO lo
   * suple, NO lo recorta y NO inventa uno por defecto: deshacer borra un hecho del expediente, y sin
   * el porqué la bitácora solo diría que alguien lo borró. Un motivo corto se rechaza con un 400 y
   * eso es lo correcto — el mínimo separa un motivo de un tecleo.
   */
  async deshacer(eejeId: number, datos: { motivo: string }): Promise<void> {
    await httpClient.post(`/obligacion-hacer/${eejeId}/deshacer`, datos);
  },

  /**
   * Sube el informe técnico del control de verificación →
   * `POST /obligacion-hacer/:eejeId/informe`.
   *
   * 🔴 **NO SE MANDA NOMBRE DE FICHERO.** El nombre del archivo servido lo genera el SERVIDOR: dejar
   * que lo eligiera el cliente sería dejarle elegir la ruta del fichero que después se sirve como
   * estático. La única clave de archivo es `file`.
   */
  async adjuntarInforme(
    eejeId: number,
    informe: File,
  ): Promise<ResultadoAdjuntarDocumento> {
    const formData = new FormData();
    formData.append("file", informe);

    const { data } = await httpClient.post<ResultadoAdjuntarDocumento>(
      `/obligacion-hacer/${eejeId}/informe`,
      formData,
      OPCIONES_SUBIDA,
    );
    return data;
  },

  /**
   * Acredita el cumplimiento del correctivo → `POST /obligacion-hacer/:eejeId/acreditar`.
   *
   * `docId` es OBLIGATORIO: el informe es la PRUEBA y el acto es la DECISIÓN. Acreditar sin señalar
   * el documento que lo sustenta sería firmar en el aire, y acreditar es justo lo que desbloquea el
   * archivo del expediente.
   */
  async acreditar(eejeId: number, datos: { docId: number }): Promise<void> {
    await httpClient.post(`/obligacion-hacer/${eejeId}/acreditar`, datos);
  },

  /**
   * Constata el incumplimiento → `POST /obligacion-hacer/:eejeId/incumplimiento`.
   *
   * No mueve el expediente: queda en la bitácora. `docId` es OBLIGATORIO por lo mismo que en
   * `acreditar` — el informe desfavorable es la prueba de lo que se constata.
   */
  async constatarIncumplimiento(
    eejeId: number,
    datos: { docId: number },
  ): Promise<void> {
    await httpClient.post(`/obligacion-hacer/${eejeId}/incumplimiento`, datos);
  },

  /**
   * Ordena la ejecución sustitutoria → `POST /obligacion-hacer/:eejeId/sustitutoria`.
   *
   * ⚠️ Es la ORDEN, no la diligencia. Puede devolver el aviso de que no constan las tres multas del
   * art. 240 y **NUNCA bloquea**: el acto se registra en los cuatro casos (0, 1, 2 y 3 multas). El
   * número de multas registradas viaja siempre, haya aviso o no.
   */
  async ordenarSustitutoria(
    eejeId: number,
    datos: { docId: number; motivo?: string },
  ): Promise<ResultadoOrdenarSustitutoria & ConAdvertencias> {
    const { data } = await httpClient.post<
      ResultadoOrdenarSustitutoria & ConAdvertencias
    >(`/obligacion-hacer/${eejeId}/sustitutoria`, datos);
    return data;
  },

  /**
   * Registra la diligencia física de la sustitutoria con su acta →
   * `POST /obligacion-hacer/:eejeId/diligencia`.
   *
   * Un intento FALLIDO se registra IGUAL que uno ejecutado: es lo único que sirve si el administrado
   * alega más tarde que nunca fue una cuadrilla a su predio. El acta es obligatoria y viaja en el
   * multipart; `resultado` y `motivo` van como texto en el mismo cuerpo.
   *
   * 🔴 **NO SE MANDA NOMBRE DE FICHERO**, por la misma razón que en el informe.
   */
  async registrarDiligencia(
    eejeId: number,
    datos: { resultado: ResultadoDiligencia; motivo: string },
    acta: File,
  ): Promise<ResultadoRegistrarDiligencia & ConAdvertencias> {
    const formData = new FormData();
    formData.append("file", acta);
    formData.append("resultado", datos.resultado);
    formData.append("motivo", datos.motivo);

    const { data } = await httpClient.post<
      ResultadoRegistrarDiligencia & ConAdvertencias
    >(`/obligacion-hacer/${eejeId}/diligencia`, formData, OPCIONES_SUBIDA);
    return data;
  },

  /**
   * Ingresa el escrito con que el administrado alega sobre el informe →
   * `POST /obligacion-hacer/:eejeId/alegacion`.
   *
   * ⚠️ El papel es DE PARTE, pero quien lo INGRESA es el funcionario decisor: el administrado no
   * tiene sesión en este módulo. El escrito ES el hecho, así que el PDF es obligatorio.
   *
   * 🔴 **NI NOMBRE DE FICHERO NI FECHA.** La fecha de ingreso la pone el servidor, y de ella depende
   * que el término conste usado o no: mandarla desde aquí sería dejar que quien sube el escrito
   * decida si alegó a tiempo. `observaciones` es lo único opcional que se acepta, y solo viaja si
   * viene — un campo vacío inyectado en el cuerpo sería ruido en la bitácora.
   */
  async registrarAlegacion(
    eejeId: number,
    datos: { observaciones?: string },
    escrito: File,
  ): Promise<ResultadoRegistrarAlegacion> {
    const formData = new FormData();
    formData.append("file", escrito);
    if (datos.observaciones) {
      formData.append("observaciones", datos.observaciones);
    }

    const { data } = await httpClient.post<ResultadoRegistrarAlegacion>(
      `/obligacion-hacer/${eejeId}/alegacion`,
      formData,
      OPCIONES_SUBIDA,
    );
    return data;
  },

  /**
   * Sube el RESPALDO DEL COSTO de la sustitutoria →
   * `POST /obligacion-hacer/:eejeId/respaldo-costos`.
   *
   * 🔴 **PRIMER PASO DE UN TRÁMITE DE DOS.** Devuelve un `docId` y ese valor es exactamente el
   * `respaldoDocId` que exige `registrarGastosSustitutoria`, el método que va justo debajo. Mismo
   * patrón que `adjuntarInforme` → `acreditar`.
   *
   * ⚠️ **NO SE LLAMA «FACTURA», Y ES DELIBERADO.** La ejecución sustitutoria municipal la hace
   * muchas veces otra entidad del Municipio, y lo que llega es un oficio o un informe de liquidación
   * —también vale una planilla o un acta de entrega-recepción—. Bautizarlo con el nombre del caso
   * privado dejaría fuera el inter-institucional, que probablemente sea el más frecuente.
   *
   * 🔴 **NO SE MANDA NOMBRE DE FICHERO.**
   */
  async respaldoCostos(
    eejeId: number,
    respaldo: File,
  ): Promise<ResultadoAdjuntarDocumento> {
    const formData = new FormData();
    formData.append("file", respaldo);

    const { data } = await httpClient.post<ResultadoAdjuntarDocumento>(
      `/obligacion-hacer/${eejeId}/respaldo-costos`,
      formData,
      OPCIONES_SUBIDA,
    );
    return data;
  },

  /**
   * Liquida los costos de la sustitutoria y los traslada al obligado →
   * `POST /obligacion-hacer/:eejeId/gastos-sustitutoria`.
   *
   * 🔴 **SEGUNDO PASO DEL TRÁMITE: `respaldoDocId` ES OBLIGATORIO** y sale del `docId` que devolvió
   * `respaldoCostos`. Es OTRO documento que `docId`: aquél dice QUÉ SE DISPONE (la providencia que
   * ordena el traslado), éste dice QUÉ COSTÓ. Un cliente que no lo mande recibe un 400.
   *
   * 🔴 **PERO QUE SEAN DISTINTOS NO LO COMPRUEBA EL SERVIDOR** (medido en CR-02): el repositorio
   * llama a `assertDocumentoDelExpediente` por separado para cada uno y comprueba PERTENENCIA al
   * expediente, nunca distinción — un mismo documento pasa las dos comprobaciones y deja una orden
   * de pago en la que los dos papeles del art. 239 son el mismo. Mientras eso siga así, quien lo
   * impide es `ModalGastosSustitutoria`, y ningún llamador nuevo de este método puede darlo por
   * hecho: tiene que comprobarlo él.
   *
   * 🔴 **AQUÍ NO SE CALCULA NINGÚN IMPORTE.** Se envía `valor`, que es la BASE, y el servidor
   * devuelve `base`, `recargoPct`, `recargoValor`, `total` y `epasReabierto`. La pantalla los pinta
   * tal cual: el porcentaje del art. 239 es una cifra de LEY y aceptarla del cliente sería dejar que
   * quien llama a la API decida cuánto se le cobra a un ciudadano.
   *
   * ⚠️ El `total` que vuelve NO ES EL TOTAL ADEUDADO: no incluye el interés legal ni la
   * indemnización del art. 239, que la DME liquida a mano fuera del módulo.
   *
   * Puede devolver avisos —la reapertura que no salió, o la última diligencia sin ejecutar— y el
   * importe queda registrado igual.
   */
  async registrarGastosSustitutoria(
    eejeId: number,
    datos: {
      valor: number;
      numeroOrden: string;
      docId: number;
      respaldoDocId: number;
    },
  ): Promise<ResultadoGastosSustitutoria & ConAdvertencias> {
    const { data } = await httpClient.post<
      ResultadoGastosSustitutoria & ConAdvertencias
    >(`/obligacion-hacer/${eejeId}/gastos-sustitutoria`, datos);
    return data;
  },
};

export default ObligacionHacerService;
