import type { ReactNode } from "react";
import React from "react";
import type { UserActions } from "../../interfaces/IUser";

export const CONTEXT_COLLAPSE_ACTIONS = [
  "collapseHeader",
  "collapseBody",
  "collapseBodyItem",
];

interface CollapseProps<T> {
  data: T;
  index?: number;
  permittedActions: Record<
    (typeof CONTEXT_COLLAPSE_ACTIONS)[number],
    UserActions[]
  >;
  headerRender: (
    item: T,
    index: number,
    headerActions: UserActions[],
  ) => ReactNode;
  contentRender: (item: T, contentActions: UserActions[]) => ReactNode;
  className?: string;
  summaryClassName?: string;
  contentClassName?: string;
  onChange?: (e: React.ChangeEvent<HTMLDetailsElement>) => void;
}

const Collapse = <T,>({
  data,
  index = 0,
  permittedActions,
  headerRender,
  contentRender,
  className = "app-collapse-item",
  summaryClassName = "app-collapse-summary",
  contentClassName = "app-collapse-content",
  onChange,
}: CollapseProps<T>) => {
  const handleToggle = (e: React.ChangeEvent<HTMLDetailsElement>) => {
    if (onChange) {
      onChange(e);
    }
  };

  return (
    <details
      className={className}
      onChange={handleToggle}
    >
      <summary className={`${summaryClassName} cursor-pointer select-none`}>
        {/* {headerRender(data, index)} */}
        {headerRender(data, index, permittedActions.collapseHeader)}
      </summary>
      <div className={contentClassName}>
        {contentRender(data, [
          ...permittedActions.collapseBody,
          ...permittedActions.collapseBodyItem,
        ])}
      </div>
    </details>
  );
};

export default Collapse;
