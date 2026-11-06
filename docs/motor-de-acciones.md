# El motor de acciones de Ejecución — qué decide, qué no, y por qué se quedó donde se quedó

> **Microservicio:** ejecucion (frontend)
> **Módulo:** `src/config/` — `inboxActionStatusRules.ts` + `accionesHechos.ts`
> **Escrito:** 2026-09-15, al cerrar la Fase 03.18 (Plan 10)
> **Desarrollador:** Andrés Miño
> **Para quién:** para usted, que abre `inboxActionStatusRules.ts` dentro de un año, ve 986 líneas de
> tabla y se pregunta por qué no está esto en la base de datos con su pantalla de administración,
> como en Instrucción. La respuesta está aquí, y no es que se olvidara.

---

## 1. Qué decide este motor y qué no

El motor decide **qué acciones se ofrecen** en una fila o en una pantalla, y **en qué estado se
ofrecen**: habilitada, o **apagada con su motivo**.

Eso es todo lo que decide.

**No decide si el acto se ejecuta.** Eso lo deciden, en este orden: el `@Roles` del endpoint del
backend, y las reglas de negocio del servicio que hay detrás. Una regla mal escrita en esta tabla
puede **ofrecer** un botón que no debería ofrecerse; **nunca** puede conceder un acto. Quien pulse
ese botón recibirá un 403 o un 400 del servidor, que es quien de verdad autoriza.

🔴 **El gate del frontend es cosmético.** No es una figura retórica: es la doctrina que este
repositorio ya tenía escrita antes de esta fase, en la cabecera de `src/config/entradaGating.ts`:

> *«El gating de UI es CONVENIENCIA, NO seguridad: la autorización real vive en el backend
> (`@Roles` + gate fino)»* — T-03.8-08, Fase 3.8, 2026-07-23.

Este documento **la cita, no la reinventa**. Si alguna vez lee un cambio que justifique saltarse una
comprobación del backend «porque el motor ya lo impide», está leyendo un fallo de seguridad.

**Lo que el motor sí le compra**, y no es poco:

- que un paso del procedimiento **exista en pantalla** aunque todavía no toque, en vez de aparecer
  de la nada cuando el expediente cambia de estado;
- que el porqué de un botón apagado esté **escrito en la tabla**, y no repartido en `if` sueltos por
  quince páginas;
- que añadir una acción sin decidir su política **no compile**.

### El vocabulario, en una tabla

| Pieza | Dónde vive | Qué es |
|---|---|---|
| `InboxActionName` | `inboxActionStatusRules.ts` | El union de las **51 acciones** del módulo. |
| `POLITICA_ACCIONES` | `inboxActionStatusRules.ts` | `Record` **total** sobre ese union: una política por acción, impuesta por el compilador. |
| `InboxActionStatusRule` | `inboxActionStatusRules.ts` | `{ roles?, status?, condiciones?, motivoPersonalizado? }` — tres filtros en cascada. |
| `HechoAccionKey` | `accionesHechos.ts` | El catálogo **cerrado** de **17 hechos derivados** sobre los que una condición puede preguntar. |
| `resolverAccion` / `aplicarVeredicto` | `inboxActionStatusRules.ts` | El evaluador y su proyección sobre una lista de acciones. |
| `VeredictoAccion` | `inboxActionStatusRules.ts` | `{ visible, habilitada, motivo? }`. |
| `hechosDeObligacionHacer` / `hechosDeLote` | `accionesHechos.ts` | Los adaptadores: del DTO del backend a la bolsa plana de hechos. |

Estado a 2026-09-15: **51 acciones** con política total — **49 con regla** (15 de ellas con regla
vacía deliberada, que es una decisión escrita y no un olvido) y **2 ocultas**. De las que gatean,
**34** filtran por rol, **16** por estado EPAS y **15** por condiciones sobre hechos derivados.

La quincuagésima primera es `verObligacionHacer`, que añadió la corrección de CR-01: la puerta de
LECTURA de la rama del correctivo. Es la única acción de lectura de la tabla y existe porque
«¿puedo entrar a leer el correctivo?» no es la misma pregunta que «¿procede este acto?» —
confundirlas dejó, durante toda la fase, la acción que ABRE la rama sin ninguna vía de interfaz.

---

## 2. Las dos dimensiones y las dos convenciones

### Las dimensiones

Una regla filtra en **cascada**, y el orden **es la conducta**, no una casualidad de implementación:

1. **Rol** (`roles`) — el rol operativo del usuario, normalizado a minúsculas.
2. **Estado** (`status`) — el enum EPAS, y **solo** el enum EPAS.
3. **Condiciones** (`condiciones`) — una conjunción de predicados sobre **hechos derivados** que el
   backend ya envía: `obligacionHacer.tiene`, `obligacionHacer.sello.solicitudPendiente`,
   `obligacionHacer.terminoAlegacion.estado`, `lote.firmaSecretario`…

El motivo que se muestra es el del **primer filtro que falla**, porque ése es el más accionable para
quien mira la pantalla. Si a un secretario se le dijera «el expediente no está en el estado que este
paso requiere» cuando el paso ni siquiera es suyo, se le mandaría a mirar el expediente en vez de a
mirar quién debe actuar.

Las condiciones son **catálogo cerrado y tipado**, no JSON libre. Un JSONB sin esquema parece datos
pero no se puede comprobar, y es exactamente la vía por la que las reglas de Instrucción acabaron
divergiendo de su propio código. Aquí, escribir una clave que no está en `HechoAccionKey` es un
error de compilación, no un `undefined` que se evalúa en producción.

El lenguaje de condiciones tiene **dos operadores y ninguno más**: igualdad (`es`) y pertenencia
(`en`). No hay disyunción ni anidamiento: un caso que necesite alternativa se resuelve con **dos
reglas**, no con un árbol de expresiones.

### Las dos convenciones, adoptadas de Instrucción

🔴 **«Apagar y no esconder».** Una acción que no procede se muestra **deshabilitada y con su
motivo**; no se oculta. La razón, textual, es de Instrucción: *«el Instructor tiene que saber que un
paso existe aunque todavía no le toque»*. En un procedimiento administrativo eso es más defendible
que esconder — el decisor tiene derecho a ver el procedimiento entero.

Con **una excepción deliberada**: el botón que **nunca** va a servir en este módulo sí se oculta
(política `oculta`, con su `porque` obligatorio), porque un botón apagado en un sitio donde jamás se
encenderá solo genera la duda de qué habría que hacer para encenderlo. Hoy la tienen exactamente dos
acciones, `returnMemo` y `returnCases`, heredadas de Resolución y **medidas** sin un solo consumidor
en `src/` ni un solo rastro en el backend de Ejecución.

**Lo indecidible se apaga.** Si el hecho que una condición necesita **no viene** en el contexto, la
acción sale apagada con «falta el dato». No se adivina. El caso canónico está medido y documentado:
`obligacionHacer.peldano.ordinalSiguiente` **no viaja en las bandejas** —solo en
`GET /obligacion-hacer/:eejeId`—, de modo que una acción que lo exija queda apagada en una fila de
bandeja y encendida en la pantalla del expediente. Esa asimetría no es un defecto: es la convención
funcionando.

🔴 Y el **defecto invertido** (D-5, matizado por D-7): **sin regla escrita, se niega**. Antes era al
revés y estaba escrito textualmente en este mismo archivo — *«si una acción no está aquí, se muestra
siempre que el backend la entregue»*—, lo que convertía el olvido de un desarrollador en una acción
ofrecida a todos los roles en todos los estados. Hoy el olvido se manifiesta como un botón apagado:
visible, preguntable, depurable.

---

## 3. Lo que queda fuera, y por qué (D-6)

El motor gobierna **gates de botón**, y nada más. Estos tres quedan fuera **a propósito**, y se
escribe aquí porque **un límite no declarado se lee después como defecto**, y alguien lo «arregla»
sin saber qué está deshaciendo.

| Qué | Dónde | Por qué queda fuera |
|---|---|---|
| Los predicados de seleccionabilidad y los contadores | `ActasSorteoPage`, `SorteoPage` | No deciden si una acción se ofrece: deciden si una **fila** entra en una selección o en un recuento. Son otra pregunta. `resolveDecisorFirmaGate` es el ejemplo: es una compuerta *advisory* sobre un **grupo** de casos, y el motor decide sobre **una** acción con los hechos de **una** fila. |
| `ImpugnacionAcciones.tsx:50` | `src/components/` | No gatea un botón: **ramifica el render completo**. No cabe en el modelo — y además la impugnación está fuera de alcance desde D-4 de la Fase 03.15. |
| `entradaGating.ts` y `salidaGating.ts` | `src/config/` | Resuelven otra cosa: son **role-only** sobre un universo de acciones **cerrado y conocido**, y ya hacen *default deny*. Absorberlos triplicaría la superficie y tocaría bandejas que hoy funcionan. |

Hay además un **adaptador superviviente** que conviene no confundir con una excepción:
`loteTurnActions.ts` ya **no** decide nada —su lógica la absorbió el motor en el Plan 09— pero sigue
existiendo como función que devuelve las acciones **habilitadas** de un lote. Sus consumidores son
predicados (el combo de firma y el filtro de la bandeja), no renderizadores de botones, y con
«apagar y no esconder» las tres firmas son **visibles casi siempre**: devolverles las visibles
habría vuelto seleccionables todos los lotes del combo.

---

## 4. Lo que la Opción A NO resuelve

Tres frases, sin suavizar.

**Primera: sigue habiendo dos fuentes de verdad sobre qué se puede hacer.** La de la pantalla —esta
tabla— y la del servidor —los `@Roles` y las reglas de negocio—. **Pueden divergir**, y el día que
diverjan el usuario verá un botón encendido que el backend rechaza, o un botón apagado sobre un acto
que el backend habría admitido. El principio está articulado en el propio código de esta rama, a
propósito de otra cosa: *«dos fuentes del mismo dato acaban contradiciéndose»*.

**Segunda: A reduce los mecanismos de tres a dos; no elimina la duplicación.** Antes de esta fase, en
el frontend decidían qué acciones se ofrecen: (a) esta tabla de reglas, (b) `loteTurnActions.ts` para
el turno de firma del acta, y (c) condicionales sueltos sobre `eejeStatus` repartidos por las
páginas. Hoy queda **un** mecanismo en el frontend y **uno** en el backend. Eso es una mejora real y
medible; no es la meta.

**Tercera: las reglas NO son editables sin redespliegue.** Bajo la Opción A las reglas son TypeScript
tipado. Quitar un estado de una regla **sí** retira la acción de la pantalla sin tocar un solo
condicional —eso es la primera mitad del criterio 9 del ROADMAP, y está entregada y probada—, pero
exige **redespliegue**. La segunda mitad del criterio original —«y las reglas son editables sin
redespliegue»— **no se entrega en esta fase**, y el ROADMAP lo recoge como criterio **9 bis,
diferido**, en vez de dejarlo incumplido a sabiendas.

Y el corolario incómodo, para que nadie lo descubra por su cuenta: **el gate del frontend sigue
siendo cosmético después de esta fase exactamente igual que antes**. Lo que cambió es que ahora es
*legible*, *total* y *comprobable*, no que ahora autorice.

---

## 5. Por qué NO hay pantalla de administración de reglas

**No la hay, y no se construye. Es una decisión, no un pendiente.**

La razón es de una sola línea: **bajo la Opción A no hay nada administrable en tiempo de ejecución**.
Las reglas son constantes compiladas en el bundle. Una pantalla que «administre» constantes
compiladas es una pantalla sin nada detrás: el administrador guardaría un cambio, la base lo
almacenaría, y la pantalla del decisor seguiría comportándose igual hasta el siguiente despliegue.
Eso no es administrar: es un criterio verificable **en apariencia y falso en la práctica**.

Y hay precedente de a dónde lleva. El motor de reglas de Instrucción **sí** tiene su tabla en la base
(`t_activity_regla`) y **sí** tiene su `AdminReglasAccionesPage.tsx`, y a día de hoy:

- **no lo consume nadie** — su propio frontend no lee las reglas de esa tabla;
- lleva el badge **«Solo lectura»** escrito en la pantalla;
- y **ya divergió de su propio código**: tres acciones existen en el código y no están en el seed, y
  dos están sembradas con trece estados que el código oculta en todos.

Copiar eso habría entregado el criterio 9 completo sobre el papel y nada en la realidad.

**Si algún día hay algo administrable de verdad, el modelo a seguir está en casa, no en Instrucción.**
La **Fase 03.13** de este mismo módulo construyó parámetros y catálogos administrables sin
redespliegue, y lo hizo bien: guard de administrador **incluso en la lectura**, histórico de cambios
en la bitácora (quién, cuándo, de qué valor a cuál — art. 82 CRE), actor tomado del JWT y no del
cuerpo de la petición, y origen del valor trazado. Es **estrictamente superior** al precedente de
Instrucción, que no tiene ni guard. Ése es el listón.

---

## 6. El camino a la Opción D

**La Opción D** —que el **backend** calcule `accionesPermitidas` de un expediente y el frontend solo
**pinte** lo que le llega— sigue siendo el destino correcto a largo plazo.

No porque sea más elegante, sino porque **mata la segunda fuente de verdad en vez de darle mejor
forma**. Con D, el problema del apartado 4 deja de existir: no hay dos tablas que puedan divergir
porque solo hay una, y está del lado que autoriza.

🔴 **La Opción A es un paso hacia D, no un desvío**, y esto es medible y no una promesa:

- **Las condiciones definidas ahora son las mismas que un backend evaluaría entonces.** No se han
  inventado predicados de pantalla: cada clave de `HechoAccionKey` nombra el **camino real del dato
  en el DTO del backend** (`obligacionHacer.sello.solicitudPendiente`,
  `obligacionHacer.terminoAlegacion.estado`, `lote.firmaDecisor`). Esa notación de ruta es
  deliberada: quien lea una condición puede ir a buscar el campo sin traductor de por medio.
- **El catálogo de 17 hechos es la lista literal de lo que ese endpoint tendría que resolver.** No
  hay que descubrirla: está escrita, tipada y con su carga jurídica anotada clave por clave.

### Qué habría que mover, y qué ya está hecho

| Pieza | Estado hoy | Qué pasaría con D |
|---|---|---|
| Catálogo de hechos (17 claves) | ✅ escrito y tipado en `accionesHechos.ts` | **Se mueve tal cual** al backend: es su lista de trabajo. |
| Tabla de reglas (51 acciones, política total) | ✅ escrita en `inboxActionStatusRules.ts` | **Se traduce** a filas de una tabla administrable. La forma es la misma: rol + estado + condiciones. |
| Evaluador (`resolverRegla`, cascada de tres filtros, motivo del primero que falla) | ✅ escrito y probado | **Se reimplementa** en el servicio del backend. La conducta ya está especificada por las pruebas. |
| Adaptadores (`hechosDeObligacionHacer`, `hechosDeLote`) | ✅ escritos | **Desaparecen**: con D el backend ya tiene los hechos, no hay que derivarlos de un DTO. |
| Endpoint `GET …/acciones-permitidas` | ❌ no existe | **Hay que construirlo.** Es el único trabajo de backend nuevo. |
| Pintado de `VeredictoAccion` en las filas (`aplicarVeredicto`, tooltips de motivo) | ✅ hecho y en producción | **No cambia.** El frontend ya pinta veredictos; solo cambiaría de dónde vienen. |
| Pantalla de administración | ❌ no existe (apartado 5) | **Entonces sí tendría sentido**, con el modelo de la Fase 03.13. |

Dicho de otro modo: de las siete piezas, **cinco ya están**, una se tira porque sobra, y solo una hay
que construir. Eso es lo que significa «A fue una elección de coste, no de arquitectura».

---

## 7. Cómo se añade una acción

Cuatro puntos. Si se salta el segundo, **no compila**, y eso es a propósito.

1. **El nombre, en el union.** Añada la cadena a `InboxActionName` en `inboxActionStatusRules.ts`
   (o, si la acción abre un modal del registry, a `ModalType` en `src/interfaces/IModal.ts`, que el
   union absorbe entero).
2. **La política, en el mapa.** Añada su entrada a `POLITICA_ACCIONES`. Decida entre:
   - `{ tipo: "regla", regla: { … } }` — lo normal. La regla puede ser **vacía** (`{}`), y eso
     también es una decisión legítima: dice «a ésta no la gatea el motor, la gatea quien la abre»
     —típico de los modales que no son acciones de fila: el visor de documentos, la línea de tiempo,
     el detalle del caso—. **Regla vacía no es lo mismo que sin regla**: la primera está escrita, la
     segunda es un olvido, y el compilador solo puede distinguirlas si usted la escribe.
   - `{ tipo: "oculta", porque: "…" }` — **solo** si la acción no va a servir **nunca** en este
     módulo. El `porque` es obligatorio.

   > 🔴 No hay una tercera política. Hubo una, `externa` («el gate vive en otro mecanismo»), y el
   > Plan 09 la **retiró del union entero**, no solo de las tres entradas que la usaban: mientras el
   > tipo existiera, cualquiera podría volver a sacar una acción del motor sin un plan que lo
   > respaldara. Hoy la ausencia de exenciones **la impone el compilador**.

3. **La traducción a modal, si abre uno.** Añada su entrada en `ACCION_A_MODAL`
   (`src/components/tabla/RowActions.tsx`), que es lo que convierte el nombre de la acción en el
   `ModalType` que el contenedor sabe abrir.
4. **La entrada en el registro.** Añada el componente a `modalRegistry`
   (`src/components/modals/ModalContainer.tsx`). Sin esto, el botón sale, se pulsa, y el usuario ve
   el toast «Acción no disponible» — que es el fallo que las pruebas de los modales de la rama
   existen para impedir.

**La garantía:** `POLITICA_ACCIONES` es `Record<InboxActionName, PoliticaAccion>` y **no**
`Partial<…>`. Si añade el nombre y olvida la política, TypeScript se lo dice con nombre y apellido
(`error TS2741: Property 'loQueSea' is missing in type … but required in type
'Record<InboxActionName, PoliticaAccion>'`) y el build falla. Los pasos 3 y 4 no los protege el
compilador: los protegen las pruebas.

---

## 8. Estado de la barrera de fase — 2026-09-15

Medido al cerrar la Fase 03.18 (Plan 10, Tarea 2), **no estimado**. La próxima fase compara contra
estas cifras: si alguna sube, la regresión es de quien la subió.

| Comprobación | Línea base (Plan 01, antes de la fase) | Al cerrar la fase | Veredicto |
|---|---|---|---|
| `npx vitest run` (`ejecucion-frontend`) | 368 casos / 35 archivos | **476 casos / 45 archivos, todos en verde** | ✅ +108 casos, 0 fallos |
| `npm run build` (`ejecucion-frontend`) | exit 0, **0 errores** | **exit 0, 0 errores** | ✅ igual |
| `npx eslint src` (`ejecucion-frontend`) | **202 problemas** (195 errores, 7 avisos) | **199 problemas** (193 errores, 6 avisos) | ✅ **−3**, ninguno nuevo |
| `npx eslint src/pages/MisAsignadosPage.tsx` | 12 errores | **12 errores** | ✅ igual |
| `npx eslint src/pages/ActasSorteoPage.tsx` | 17 errores | **17 errores** | ✅ igual |
| `npm test` (`ejecucion-backend`) | verde | **108 suites / 1.729 casos, verde** | ✅ |
| `git status --porcelain src/` (`ejecucion-backend`) | vacío | **vacío** | ✅ D-3 respetado |
| `git status --porcelain` (`ejecucion-db`) | vacío | **vacío** | ✅ |
| `verificar-migraciones.sql` (base local) | — | **BASE AL DIA — 54 de 54 aplicadas** | ✅ |
| `assert-menu-role-matrix.sql` (base local) | fallaba en la propia línea base (matriz del 2026-07-23, puesta al día por el Plan 07) | **TODAS las aserciones PASARON**, incluida la negativa | ✅ |

🔴 **Los ~200 problemas de lint son PREEXISTENTES y están diferidos a propósito**: hooks
condicionales en `SorteoPage` y `MisAsignadosPage`, `no-explicit-any` repartidos, y el
`react-refresh/only-export-components` de `src/config/routes.tsx`. **No se arreglan** en esta fase —
lo que no se admite es **añadir**. La bajada de 3 no es una limpieza: es consecuencia del `as any`
que el Plan 05 pudo retirar al dar tipo real a los modales de la rama.

⚠️ **La migración del menú del Plan 07** (`2026-09-15-menu-rama-obligacion-hacer.sql`) está aplicada
**solo en LOCAL**. En el SERVIDOR hay que aplicarla a mano (DBGate) o la bandeja de solicitudes de
retiro del sello de clausura **no aparece en el menú lateral** para ninguno de los tres roles. Es
idempotente: aplicarla dos veces no rompe nada.

⚠️ **`npx tsc --noEmit` NO verifica nada en este repositorio.** El `tsconfig.json` raíz declara
`"files": []`, así que ese comando sale 0 siempre sin compilar un solo archivo. **La verificación
real del frontend es `npm run build`** (`tsc -b`). En el backend el comando sí sirve.

---

## Referencias

- `src/config/inboxActionStatusRules.ts` — el union, la política total, el evaluador.
- `src/config/accionesHechos.ts` — el catálogo de hechos, el lenguaje de condiciones, los adaptadores.
- `src/config/entradaGating.ts` — la doctrina «el gating de UI es conveniencia, no seguridad»,
  escrita en este repositorio desde el 2026-07-23.
- `.planning/phases/03.18-…/03.18-CONTEXT.md` — D-3, D-5, D-6 y **D-7** íntegros.
- `.planning/ROADMAP.md` — criterio 9 (entregado) y criterio **9 bis** (diferido).
