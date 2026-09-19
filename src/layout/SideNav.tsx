import { Tooltip } from "antd";
import {
  HomeOutlined,
  ReconciliationOutlined,
  HistoryOutlined,
  LeftOutlined,
  RightOutlined,
} from "@ant-design/icons";
import { NavLink } from "react-router-dom";
import type { ReactNode } from "react";

interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
  /** An exact match only — otherwise "/" would light up on every route. */
  end?: boolean;
}

const ITEMS: NavItem[] = [
  { to: "/", label: "Home", icon: <HomeOutlined />, end: true },
  { to: "/scorecards", label: "Scorecards", icon: <ReconciliationOutlined /> },
  { to: "/history", label: "Run history", icon: <HistoryOutlined /> },
];

/**
 * The left rail. Collapsible on desktop (icon-only at 72px), and rendered
 * uncollapsed inside a Drawer on mobile — which is why `onToggleCollapsed` is
 * optional: in the Drawer there is nothing to collapse into.
 *
 * Widths and colors come from tokens.css; nothing here is a magic number.
 */
export function SideNav({
  collapsed,
  onToggleCollapsed,
  onNavigate,
}: {
  collapsed: boolean;
  onToggleCollapsed?: () => void;
  onNavigate?: () => void;
}) {
  return (
    <nav className="dl-nav" data-collapsed={collapsed} aria-label="Sections">
      <ul className="dl-nav-list">
        {ITEMS.map((item) => (
          <li key={item.to}>
            <Tooltip title={collapsed ? item.label : undefined} placement="right">
              <NavLink
                to={item.to}
                end={item.end}
                className="dl-nav-item"
                onClick={onNavigate}
              >
                <span className="dl-nav-icon" aria-hidden="true">
                  {item.icon}
                </span>
                {/* Kept in the DOM when collapsed rather than unmounted, so the
                    label is still the accessible name of the link. CSS clips it. */}
                <span className="dl-nav-label">{item.label}</span>
              </NavLink>
            </Tooltip>
          </li>
        ))}
      </ul>

      {onToggleCollapsed && (
        <button
          type="button"
          className="dl-nav-collapse"
          onClick={onToggleCollapsed}
          aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
        >
          <span className="dl-nav-icon" aria-hidden="true">
            {collapsed ? <RightOutlined /> : <LeftOutlined />}
          </span>
          <span className="dl-nav-label">Collapse</span>
        </button>
      )}
    </nav>
  );
}
