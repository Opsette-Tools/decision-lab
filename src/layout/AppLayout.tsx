import { useEffect, useState } from "react";
import { Layout, Grid, Drawer, Button, Tooltip, Typography } from "antd";
import { MenuOutlined, SunOutlined, MoonOutlined } from "@ant-design/icons";
import { Outlet } from "react-router-dom";
import { OpsetteHeader } from "@/components/opsette-header";
import { OpsetteFooterLogo } from "@/components/opsette-share";
import { useThemeMode } from "@/lib/theme";
import { haptic } from "@/lib/haptics";
import AboutModal from "@/components/AboutModal";
import PrivacyModal from "@/components/PrivacyModal";
import { SideNav } from "./SideNav";
import "./layout.css";

const { Content, Footer } = Layout;
const { Link, Text } = Typography;
const { useBreakpoint } = Grid;

const SIDEBAR_COLLAPSED_KEY = "decision-lab-sidebar-collapsed";

/**
 * The persistent app chrome: header, a collapsible left nav (a Drawer standing
 * in on mobile), and the routed page via <Outlet/>. Every route except NotFound
 * renders inside this.
 *
 * The header stays chrome only — no workspace controls live in it. Anything
 * that acts on the current page belongs on the page, above the content. The
 * mobile nav trigger therefore sits in the page's own top strip, not in the
 * header (OpsetteHeader has no left slot, and adding one would fork the
 * shared component).
 */
export default function AppLayout() {
  const { mode, toggle } = useThemeMode();
  const isDark = mode === "dark";
  const screens = useBreakpoint();
  const isMobile = !screens.md;

  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? "1" : "0");
    } catch {
      /* non-fatal: the collapse state just won't persist */
    }
  }, [collapsed]);

  return (
    <Layout className="dl-layout">
      <OpsetteHeader
        theme={isDark ? "dark" : "light"}
        rightExtra={
          <Tooltip title={isDark ? "Light mode" : "Dark mode"}>
            <Button
              type="text"
              aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
              icon={isDark ? <SunOutlined /> : <MoonOutlined />}
              onClick={() => {
                haptic("tap");
                toggle();
              }}
              className="dl-header-btn"
            />
          </Tooltip>
        }
      />

      <Layout className="dl-body" hasSider={!isMobile}>
        {isMobile ? (
          <Drawer
            open={drawerOpen}
            onClose={() => setDrawerOpen(false)}
            placement="left"
            width={264}
            closable={false}
            styles={{ body: { padding: 0 } }}
          >
            <SideNav collapsed={false} onNavigate={() => setDrawerOpen(false)} />
          </Drawer>
        ) : (
          <SideNav
            collapsed={collapsed}
            onToggleCollapsed={() => {
              haptic("tap");
              setCollapsed((c) => !c);
            }}
          />
        )}

        <Layout className="dl-main">
          <Content className="dl-content">
            {isMobile && (
              <Button
                type="text"
                aria-label="Open navigation"
                icon={<MenuOutlined />}
                onClick={() => {
                  haptic("tap");
                  setDrawerOpen(true);
                }}
                className="dl-nav-trigger"
              />
            )}
            <Outlet />
          </Content>

          <Footer className="dl-footer">
            <div className="dl-footer-inner">
              <OpsetteFooterLogo />
              <div className="dl-footer-links">
                <Link onClick={() => setAboutOpen(true)}>About</Link>
                <Text type="secondary">·</Text>
                <Link onClick={() => setPrivacyOpen(true)}>Privacy</Link>
              </div>
            </div>
          </Footer>
        </Layout>
      </Layout>

      <AboutModal open={aboutOpen} onClose={() => setAboutOpen(false)} />
      <PrivacyModal open={privacyOpen} onClose={() => setPrivacyOpen(false)} />
    </Layout>
  );
}
