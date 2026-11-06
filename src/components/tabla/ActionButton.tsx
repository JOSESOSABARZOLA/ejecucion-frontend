/**
 * Microservicio: resolucion
 * Módulo: N/A
 * Feature: Botones de accion
 * Archivo: ActionButton.tsx
 * Responsabilidad: Renderizar los botones definidos como principales para que se presenten directamente en la fila
 * Desarrollador: Johan Freire
 * Fecha: 2026-03-19
 * Modificado: 2026-04-07 - Pasar nombre de artículo al onClick
 * Modificado por: Andrés Miño — 2026-09-21 (Fase 03.19, Plan 08: dos defectos que este componente
 *   arrastra desde marzo y que reparte por las CUATRO pantallas que montan `Table.tsx`.)
 *
 *   🔴 1. LOS BOTONES NO TENÍAN NOMBRE. Un `<button>` con solo icono y sin `aria-label` se anuncia
 *   «botón»: la columna de acciones era «botón, botón» para quien usa lector de pantalla. Ahora
 *   cada uno lleva su `actiLabel` como nombre accesible y como `title`.
 *
 *   🔴 2. EL TOOLTIP SE VACIABA JUSTO CUANDO HACÍA FALTA. La versión anterior ponía `data-tip=""`
 *   cuando la acción estaba deshabilitada, que es el ÚNICO momento en que el funcionario pregunta
 *   «¿por qué no puedo?». La regla se invierte: **motivo cuando está apagada, etiqueta cuando no**.
 *   El motivo es `actiDisabledHint`, que viaja en los datos desde la Fase 03.18 y hasta hoy no se
 *   pintaba en ninguna parte: el dato existía y la pantalla se lo callaba.
 *
 *   El `data-tip` sigue —y tiene que seguir— en el DIV ENVOLTORIO: un `<button disabled>` no
 *   recibe eventos de puntero, así que en el botón no se dispararía nunca.
 *
 *   La FIRMA no cambia: lo consumen `RowActions` y su prueba de la 03.18.
 */
import { memo, type FC } from "react";
import type { UserActions } from "../../interfaces/IUser";
import Boton from "../common/Boton";
import type { ModalType } from "../../hooks/useModal";

type ActionButtonProps = {
  items: UserActions[];
  onClick?: (modalType: ModalType) => void;
  // disabled: boolean;
};

const ActionButton: FC<ActionButtonProps> = memo(({ items, onClick }) => {
  // console.log("Renderizado AccionesPrincipales");
  // console.log(items);
  // console.log(onClick);

  return (
    <div className="flex flex-row">
      {items.map((prioritario) => {
        const apagada = prioritario?.actiIsDisabled ?? false;

        return (
          <div
            key={prioritario.actiId}
            className="tooltip tooltip-bottom"
            // Motivo cuando está apagada, etiqueta cuando no. Si quien la apagó no dio motivo, se
            // cae a la etiqueta: un tooltip que al menos nombra la acción es mejor que uno vacío.
            data-tip={
              apagada
                ? (prioritario.actiDisabledHint ?? prioritario.actiLabel)
                : prioritario.actiLabel
            }
          >
            <Boton
              onClick={() => onClick?.(prioritario.actiName)}
              estilos="btn btn-soft btn-primary btn-md mr-1"
              icono={prioritario.actiIconName}
              deshabilitado={apagada}
              etiquetaAccesible={prioritario.actiLabel}
              titulo={prioritario.actiLabel}
            />
          </div>
        );
      })}
    </div>
  );
});

export default ActionButton;
