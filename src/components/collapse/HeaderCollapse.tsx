import type { FC } from "react";
import BadgePriority, { type StatusAndPriority } from "../common/BadgePriority";
import { DatetimeUtil } from "../../utils/datetime.util";

interface HeaderCollapseProps {
  index: number;
  title: string;
  date: Date;
  priority?: StatusAndPriority;
}

const HeaderCollapse: FC<HeaderCollapseProps> = ({
  index,
  title,
  date,
  priority,
}) => {
  return (
    <div className="app-collapse-alert-header">
      {/* Left side: Index, Title, Priority */}
      <div className="app-collapse-alert-header-left">
        <span className="app-collapse-alert-index">{index + 1}.</span>
        <span className="app-collapse-alert-title">{title}</span>
        {priority && (
          <div className="app-collapse-alert-priority">
            <BadgePriority
              text={priority}
              priority={priority}
              size="xs"
            />
          </div>
        )}
      </div>

      {/* Right side: Date and Chevron */}
      <div className="app-collapse-alert-header-right">
        <span className="app-collapse-alert-date">
          {DatetimeUtil.formatDate(date)}
        </span>
        <span className="app-collapse-alert-chevron">
          <svg
            className="app-collapse-alert-chevron-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </span>
      </div>
    </div>
  );
};

export default HeaderCollapse;
