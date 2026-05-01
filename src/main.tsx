import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import type React from "react";
import { createRoot } from "react-dom/client";
import {
  createBrowserRouter,
  RouterProvider,
  Routes,
  Route,
  useNavigate,
  useLocation,
  Navigate,
} from "react-router-dom";
import { Layout, ConfigProvider, Result, Button, App as AntdApp, Spin, Segmented, Tooltip } from "antd";

// Import components
import Catalog from "./components/Catalog";
import Credentials from "./components/Credentials";
import Editor from "./components/Editor";
import Execution from "./components/Execution";
import ExecutionDetail from "./components/ExecutionDetail";
import GatewayLogin from "./components/GatewayLogin";
import GatewayAssistant from "./components/GatewayAssistant";
import NoetlPrompt from "./components/NoetlPrompt";
import UserManagement from "./components/UserManagement";
import { ViewToolbarContext } from "./components/ViewToolbarContext";
import {
  AppstoreOutlined,
  CodeOutlined,
  ColumnHeightOutlined,
  DatabaseOutlined,
  ExpandAltOutlined,
  EyeInvisibleOutlined,
  EyeOutlined,
  FullscreenExitOutlined,
  FullscreenOutlined,
  KeyOutlined,
  LogoutOutlined,
  MonitorOutlined,
  PlaySquareOutlined,
  QuestionCircleOutlined,
  TeamOutlined,
} from "@ant-design/icons";

// Import auth functions
import { isAuthenticated, getUserInfo, validateSession, logout, isDevSkipAuth, isSkipAuthAllowed, type GatewayUser } from "./services/gatewayAuth";
import { apiService } from "./services/api";

// Import styles
import "antd/dist/reset.css";
import "../static/css/main.css";

const { Header, Content, Footer } = Layout;
type AppTheme = "dark" | "light";
type PaneMode = "split" | "terminal" | "dashboard";
const THEME_STORAGE_KEY = "noetl-ui-theme";
const TERMINAL_HEIGHT_STORAGE_KEY = "noetl-terminal-pane-height";
const MIN_TERMINAL_HEIGHT = 150;
const MIN_DASHBOARD_HEIGHT = 180;
const DEFAULT_TERMINAL_HEIGHT = 340;
const WORKSPACE_FIXED_VERTICAL_GAP = 20;

function readStoredTheme(): AppTheme {
  if (typeof window === "undefined") return "dark";
  return window.localStorage.getItem(THEME_STORAGE_KEY) === "light" ? "light" : "dark";
}

function readStoredTerminalHeight(): number {
  if (typeof window === "undefined") return DEFAULT_TERMINAL_HEIGHT;
  const stored = Number(window.localStorage.getItem(TERMINAL_HEIGHT_STORAGE_KEY));
  return Number.isFinite(stored) && stored > 0 ? Math.max(MIN_TERMINAL_HEIGHT, stored) : DEFAULT_TERMINAL_HEIGHT;
}

// Antd ConfigProvider tokens — kept in lockstep with the --mc-* CSS variables
// in static/css/main.css. The chrome (header/menu/dialog) reads from antd
// tokens; the terminal pane and tabular data rely on the CSS variables for the
// nushell-style typed-value palette.
const appThemeTokens: Record<AppTheme, {
  colorBgContainer: string;
  colorBgLayout: string;
  colorBorder: string;
  colorPrimary: string;
  colorText: string;
}> = {
  dark: {
    colorPrimary: "#4eb960",       // nushell signature green
    colorBgContainer: "#232633",   // raised surface
    colorBgLayout: "#181a23",      // app background (slate)
    colorText: "#e2e8f5",          // cool off-white
    colorBorder: "#353a4c",        // muted border
  },
  light: {
    colorPrimary: "#1a7f5a",       // deep teal-green
    colorBgContainer: "#ffffff",
    colorBgLayout: "#fbf6ec",      // warm cream
    colorText: "#1a1f2e",
    colorBorder: "#d8d0bb",        // warm beige
  },
};

// Define menu items with required roles
// admin: sees all, developer: sees noetl tools, analyst/viewer: sees travel only
type MenuItem = {
  key: string;
  label: string;
  path: string;
  section: "Catalog" | "Build" | "Operate" | "Admin";
  icon: React.ReactNode;
  roles: string[]; // empty array means all authenticated users, specific roles restrict access
  adminOnly?: boolean; // if true, only admin can see
};

const ALL_MENU_ITEMS: MenuItem[] = [
  { key: "/catalog", label: "catalog", path: "/catalog", section: "Catalog", icon: <AppstoreOutlined />, roles: [], adminOnly: true },
  { key: "/execution", label: "execution", path: "/execution", section: "Operate", icon: <EyeOutlined />, roles: [], adminOnly: true },
  { key: "/users", label: "users", path: "/users", section: "Admin", icon: <TeamOutlined />, roles: [], adminOnly: true },
  { key: "/editor", label: "edit", path: "/editor", section: "Build", icon: <CodeOutlined />, roles: [], adminOnly: true },
  { key: "/credentials", label: "secrets", path: "/credentials", section: "Admin", icon: <KeyOutlined />, roles: [], adminOnly: true },
  { key: "/travel", label: "travel", path: "/travel", section: "Operate", icon: <DatabaseOutlined />, roles: ["analyst", "viewer", "developer", "admin"] },
];

function hasAccess(item: MenuItem, userRoles: string[]): boolean {
  // Admin has access to everything
  if (userRoles.includes("admin")) {
    return true;
  }
  // Admin-only items are not accessible to non-admins
  if (item.adminOnly) {
    return false;
  }
  // If no roles specified, all authenticated users have access
  if (item.roles.length === 0) {
    return true;
  }
  // Check if user has any of the required roles
  return item.roles.some((role) => userRoles.includes(role));
}

// 404 Not Found component
const NotFound: React.FC = () => {
  const navigate = useNavigate();

  return (
    <Result
      status="404"
      title="404"
      subTitle="Sorry, the page you visited does not exist."
      extra={
        <Button type="primary" onClick={() => navigate("/")}>
          Back Home
        </Button>
      }
    />
  );
};

// Access Denied component
const AccessDenied: React.FC = () => {
  const navigate = useNavigate();

  return (
    <Result
      status="403"
      title="Access Denied"
      subTitle="You don't have permission to access this page."
      extra={
        <Button type="primary" onClick={() => navigate("/")}>
          Back Home
        </Button>
      }
    />
  );
};

const ChromeIconButton: React.FC<{
  active?: boolean;
  danger?: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}> = ({ active, danger, icon, label, onClick }) => (
  <Tooltip title={label}>
    <button
      type="button"
      aria-label={label}
      className={[
        "mc-fkey",
        "mc-icon-button",
        active ? "active" : "",
        danger ? "mc-fkey-danger" : "",
      ].filter(Boolean).join(" ")}
      onClick={onClick}
    >
      {icon}
    </button>
  </Tooltip>
);

// Login page wrapper (no layout/menu)
const LoginPage: React.FC<{ appTheme: AppTheme }> = ({ appTheme }) => {
  return (
    <div className={`login-shell theme-${appTheme}`}>
      <GatewayLogin />
    </div>
  );
};

// Main authenticated app with menu
const AuthenticatedApp: React.FC<{ appTheme: AppTheme; onThemeChange: (theme: AppTheme) => void }> = ({
  appTheme,
  onThemeChange,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState<GatewayUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [consoleVisible, setConsoleVisible] = useState(true);
  const [dashboardVisible, setDashboardVisible] = useState(true);
  const [paneMode, setPaneMode] = useState<PaneMode>("split");
  const [terminalHeight, setTerminalHeight] = useState(readStoredTerminalHeight);
  const [footerHeight, setFooterHeight] = useState(28);
  const [viewToolbarActions, setViewToolbarActions] = useState<React.ReactNode>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const resizerRef = useRef<HTMLDivElement>(null);
  const footerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const checkAuth = async () => {
      if (!isAuthenticated()) {
        navigate("/login", { replace: true });
        return;
      }

      if (isSkipAuthAllowed() && isDevSkipAuth()) {
        setUser(getUserInfo());
        setLoading(false);
        return;
      }

      try {
        const valid = await validateSession();
        if (!valid) {
          logout();
          navigate("/login", { replace: true });
          return;
        }
        setUser(getUserInfo());
      } catch {
        logout();
        navigate("/login", { replace: true });
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [navigate]);

  const userRoles = useMemo(() => {
    return user?.roles || [];
  }, [user]);

  const visibleMenuItems = useMemo(() => {
    return ALL_MENU_ITEMS.filter((item) => hasAccess(item, userRoles));
  }, [userRoles]);

  const primaryMenuItems = useMemo(() => {
    return visibleMenuItems.filter((item) => item.key !== "/users");
  }, [visibleMenuItems]);

  const footerMenuItems = useMemo(() => {
    const footerLabels: Record<string, string> = {
      "/catalog": "Catalog",
      "/execution": "Execution",
      "/editor": "Edit",
      "/credentials": "Creds",
      "/users": "Users",
    };
    return visibleMenuItems
      .filter((item) => footerLabels[item.path])
      .map((item) => ({ path: item.path, label: footerLabels[item.path] }));
  }, [visibleMenuItems]);

  const activeRoute = useMemo(() => {
    return visibleMenuItems.find((item) => location.pathname === item.path || location.pathname.startsWith(`${item.path}/`));
  }, [location.pathname, visibleMenuItems]);

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  const clearViewToolbarActions = useCallback(() => setViewToolbarActions(null), []);

  const terminalPaneVisible = consoleVisible && paneMode !== "dashboard";
  const dashboardPaneVisible = dashboardVisible && paneMode !== "terminal";
  const canResizePanes = terminalPaneVisible && dashboardPaneVisible;
  const terminalFullHeight = terminalPaneVisible && !dashboardPaneVisible;
  const dashboardFullHeight = dashboardPaneVisible && !terminalPaneVisible;

  useEffect(() => {
    const footer = footerRef.current;
    if (!footer) return;

    const updateFooterHeight = () => {
      setFooterHeight(Math.ceil(footer.getBoundingClientRect().height));
    };

    updateFooterHeight();
    const observer = new ResizeObserver(updateFooterHeight);
    observer.observe(footer);
    window.addEventListener("resize", updateFooterHeight);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateFooterHeight);
    };
  }, []);

  const restoreSplit = useCallback(() => {
    setConsoleVisible(true);
    setDashboardVisible(true);
    setPaneMode("split");
  }, []);

  const maximizeTerminal = useCallback(() => {
    setConsoleVisible(true);
    setPaneMode("terminal");
  }, []);

  const maximizeDashboard = useCallback(() => {
    setDashboardVisible(true);
    setPaneMode("dashboard");
  }, []);

  const toggleTerminalPane = useCallback(() => {
    if (terminalPaneVisible) {
      setConsoleVisible(false);
      if (!dashboardVisible) {
        setDashboardVisible(true);
      }
      setPaneMode("split");
      return;
    }

    setConsoleVisible(true);
    if (paneMode === "dashboard") {
      setPaneMode("split");
    }
  }, [dashboardVisible, paneMode, terminalPaneVisible]);

  const toggleDashboardPane = useCallback(() => {
    if (dashboardPaneVisible) {
      setDashboardVisible(false);
      if (!consoleVisible) {
        setConsoleVisible(true);
      }
      setPaneMode("split");
      return;
    }

    setDashboardVisible(true);
    if (paneMode === "terminal") {
      setPaneMode("split");
    }
  }, [consoleVisible, dashboardPaneVisible, paneMode]);

  const getMaxTerminalHeight = useCallback(() => {
    if (typeof window === "undefined") return DEFAULT_TERMINAL_HEIGHT;
    const shellTop = shellRef.current?.getBoundingClientRect().top ?? 0;
    const measuredFooterHeight = footerRef.current?.getBoundingClientRect().height ?? footerHeight;
    const resizerHeight = resizerRef.current?.getBoundingClientRect().height ?? 0;
    return Math.max(
      MIN_TERMINAL_HEIGHT,
      window.innerHeight
        - shellTop
        - measuredFooterHeight
        - resizerHeight
        - WORKSPACE_FIXED_VERTICAL_GAP
        - MIN_DASHBOARD_HEIGHT,
    );
  }, [footerHeight]);

  const clampTerminalHeight = useCallback((height: number) => {
    return Math.round(Math.min(getMaxTerminalHeight(), Math.max(MIN_TERMINAL_HEIGHT, height)));
  }, [getMaxTerminalHeight]);

  const persistTerminalHeight = useCallback((height: number) => {
    window.localStorage.setItem(TERMINAL_HEIGHT_STORAGE_KEY, String(height));
  }, []);

  const setClampedTerminalHeight = useCallback((height: number) => {
    const next = clampTerminalHeight(height);
    setTerminalHeight(next);
    persistTerminalHeight(next);
  }, [clampTerminalHeight, persistTerminalHeight]);

  useEffect(() => {
    if (!canResizePanes) return;

    const handleResize = () => {
      setTerminalHeight((current) => clampTerminalHeight(current));
    };

    window.addEventListener("resize", handleResize);
    handleResize();
    return () => window.removeEventListener("resize", handleResize);
  }, [canResizePanes, clampTerminalHeight]);

  const handleWorkspaceResizeStart = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!canResizePanes) return;

    event.preventDefault();
    let nextHeight = terminalHeight;

    const updateFromPointer = (clientY: number) => {
      const shellTop = shellRef.current?.getBoundingClientRect().top ?? 0;
      nextHeight = clampTerminalHeight(clientY - shellTop);
      setTerminalHeight(nextHeight);
    };

    const handlePointerMove = (moveEvent: PointerEvent) => {
      updateFromPointer(moveEvent.clientY);
    };

    const handlePointerUp = () => {
      document.body.classList.remove("workspace-resizing");
      persistTerminalHeight(nextHeight);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };

    document.body.classList.add("workspace-resizing");
    updateFromPointer(event.clientY);
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);
  }, [canResizePanes, clampTerminalHeight, persistTerminalHeight, terminalHeight]);

  const handleWorkspaceResizeKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!canResizePanes) return;

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setClampedTerminalHeight(terminalHeight - 24);
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      setClampedTerminalHeight(terminalHeight + 24);
    } else if (event.key === "Home") {
      event.preventDefault();
      setClampedTerminalHeight(MIN_TERMINAL_HEIGHT);
    } else if (event.key === "End") {
      event.preventDefault();
      setClampedTerminalHeight(getMaxTerminalHeight());
    }
  }, [canResizePanes, getMaxTerminalHeight, setClampedTerminalHeight, terminalHeight]);

  const viewToolbarValue = useMemo(() => ({
    actions: viewToolbarActions,
    setActions: setViewToolbarActions,
    clearActions: clearViewToolbarActions,
  }), [clearViewToolbarActions, viewToolbarActions]);

  const runtimeContext = useMemo(() => apiService.getRuntimeContext(), []);
  const runtimeLabel = runtimeContext.displayName.toUpperCase();
  const terminalHeaderStyle = useMemo<React.CSSProperties | undefined>(() => {
    if (terminalFullHeight) {
      return {
        flex: "1 1 0",
        height: 0,
        maxHeight: "none",
        minHeight: 0,
      };
    }
    if (!canResizePanes) return undefined;
    return {
      flex: `0 0 ${terminalHeight}px`,
      height: terminalHeight,
    };
  }, [canResizePanes, terminalFullHeight, terminalHeight]);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <Layout
      ref={shellRef}
      className={`app terminal-app theme-${appTheme}`}
      style={{ "--mc-footer-space": `${footerHeight}px`, minHeight: "100vh" } as React.CSSProperties}
    >
      <Header
        className={[
          "app-header",
          "console-header",
          terminalPaneVisible ? "console-header-visible" : "console-header-collapsed",
          canResizePanes ? "console-header-resized" : "",
          terminalFullHeight ? "console-header-full" : "",
        ].filter(Boolean).join(" ")}
        style={terminalHeaderStyle}
      >
        <div className="header-inner mc-top-line">
          <div className="logo">NOETL://{runtimeLabel}</div>
          <nav className="mc-menubar" aria-label="NoETL workspace menu">
            {primaryMenuItems.map((item) => (
              <button
                key={item.key}
                type="button"
                className={`mc-menu-item ${activeRoute?.key === item.key ? "active" : ""}`}
                onClick={() => navigate(item.path)}
              >
                <span className="mc-menu-hotkey">{item.label.slice(0, 1)}</span>{item.label.slice(1)}
              </button>
            ))}
          </nav>
          <div className="mc-command-line" aria-label="NoETL command bar">
            <ChromeIconButton
              active={terminalPaneVisible}
              icon={terminalPaneVisible ? <EyeInvisibleOutlined /> : <CodeOutlined />}
              label={terminalPaneVisible ? "Hide terminal" : "Show terminal"}
              onClick={toggleTerminalPane}
            />
            <ChromeIconButton
              active={dashboardPaneVisible}
              icon={dashboardPaneVisible ? <EyeInvisibleOutlined /> : <MonitorOutlined />}
              label={dashboardPaneVisible ? "Hide dashboard" : "Show dashboard"}
              onClick={toggleDashboardPane}
            />
            <ChromeIconButton
              active={paneMode === "split" && consoleVisible && dashboardVisible}
              icon={<ColumnHeightOutlined />}
              label="Split panes"
              onClick={restoreSplit}
            />
            <ChromeIconButton
              active={terminalFullHeight}
              icon={terminalFullHeight ? <FullscreenExitOutlined /> : <ExpandAltOutlined />}
              label={terminalFullHeight ? "Restore split view" : "Maximize terminal"}
              onClick={terminalFullHeight ? restoreSplit : maximizeTerminal}
            />
            <ChromeIconButton
              active={dashboardFullHeight}
              icon={dashboardFullHeight ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
              label={dashboardFullHeight ? "Restore split view" : "Maximize dashboard"}
              onClick={dashboardFullHeight ? restoreSplit : maximizeDashboard}
            />
            <ChromeIconButton
              icon={<PlaySquareOutlined />}
              label="Execution"
              onClick={() => navigate("/execution")}
            />
            {userRoles.includes("admin") && (
              <ChromeIconButton
                icon={<TeamOutlined />}
                label="Users"
                onClick={() => navigate("/users")}
              />
            )}
            <ChromeIconButton
              icon={<QuestionCircleOutlined />}
              label="Help"
              onClick={() => {
                setConsoleVisible(true);
                if (paneMode === "dashboard") {
                  setPaneMode("split");
                }
              }}
            />
            <ChromeIconButton
              danger
              icon={<LogoutOutlined />}
              label="Logout"
              onClick={handleLogout}
            />
          </div>
          <span className="mc-context">kind:{activeRoute?.label || "workspace"}</span>
          <Segmented<AppTheme>
            className="theme-switch"
            size="small"
            value={appTheme}
            options={[
              { label: "dark", value: "dark" },
              { label: "white", value: "light" },
            ]}
            onChange={onThemeChange}
          />
        </div>
        {terminalPaneVisible && <NoetlPrompt className="header-prompt" />}
      </Header>
      {canResizePanes && (
        <div
          ref={resizerRef}
          aria-label="Resize terminal and dashboard panes"
          aria-orientation="horizontal"
          aria-valuemax={getMaxTerminalHeight()}
          aria-valuemin={MIN_TERMINAL_HEIGHT}
          aria-valuenow={terminalHeight}
          className="workspace-resizer"
          onKeyDown={handleWorkspaceResizeKeyDown}
          onPointerDown={handleWorkspaceResizeStart}
          role="separator"
          tabIndex={0}
          title="drag to resize terminal and dashboard"
        />
      )}
      <ViewToolbarContext.Provider value={viewToolbarValue}>
        <Content className={`terminal-content ${dashboardPaneVisible ? "" : "dashboard-hidden-content"}`}>
          {dashboardPaneVisible ? (
            <>
              <div className="dashboard-window-bar">
                <span className="mc-panel-title">VIEW::{location.pathname || "/"}</span>
                {viewToolbarActions && <div className="dashboard-window-actions">{viewToolbarActions}</div>}
                <Tooltip title={dashboardFullHeight ? "Restore split view" : "Maximize dashboard"}>
                  <Button
                    aria-label={dashboardFullHeight ? "Restore split view" : "Maximize dashboard"}
                    className="mc-menu-button"
                    icon={dashboardFullHeight ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
                    size="small"
                    onClick={dashboardFullHeight ? restoreSplit : maximizeDashboard}
                  />
                </Tooltip>
                <Tooltip title="Hide dashboard">
                  <Button
                    aria-label="Hide dashboard"
                    className="mc-menu-button"
                    icon={<EyeInvisibleOutlined />}
                    size="small"
                    onClick={toggleDashboardPane}
                  />
                </Tooltip>
              </div>
              <div className="AppRoutesContent terminal-panel dashboard-window">
                <Routes>
                  <Route
                    path="/"
                    element={
                      visibleMenuItems[0] ? (
                        <Navigate to={visibleMenuItems[0].path} replace />
                      ) : (
                        <AccessDenied />
                      )
                    }
                  />
                  <Route path="/catalog" element={userRoles.includes("admin") ? <Catalog /> : <AccessDenied />} />
                  <Route path="/credentials" element={userRoles.includes("admin") ? <Credentials /> : <AccessDenied />} />
                  <Route path="/editor" element={userRoles.includes("admin") ? <Editor /> : <AccessDenied />} />
                  <Route path="/execution" element={userRoles.includes("admin") ? <Execution /> : <AccessDenied />} />
                  <Route path="/execution/:id" element={userRoles.includes("admin") ? <ExecutionDetail /> : <AccessDenied />} />
                  <Route path="/travel" element={<GatewayAssistant />} />
                  <Route path="/users" element={userRoles.includes("admin") ? <UserManagement /> : <AccessDenied />} />
                  {/* Catch-all route for 404 */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </div>
            </>
          ) : null}
        </Content>
      </ViewToolbarContext.Provider>
      <Footer ref={footerRef} className="mc-function-footer">
        <button
          type="button"
          onClick={() => {
            setConsoleVisible(true);
            if (paneMode === "dashboard") {
              setPaneMode("split");
            }
          }}
        >
          Help
        </button>
        <button type="button" onClick={maximizeTerminal}>Terminal</button>
        <button type="button" onClick={maximizeDashboard}>Dashboard</button>
        {footerMenuItems.map((item) => (
          <button key={item.path} type="button" onClick={() => navigate(item.path)}>
            {item.label}
          </button>
        ))}
        <button type="button" onClick={() => onThemeChange(appTheme === "dark" ? "light" : "dark")}>Theme</button>
        <button type="button" onClick={handleLogout}>Quit</button>
      </Footer>
    </Layout>
  );
};

// Root App component - handles routing between login and authenticated app
const App: React.FC = () => {
  const [appTheme, setAppTheme] = useState<AppTheme>(() => readStoredTheme());
  const tokens = appThemeTokens[appTheme];

  useEffect(() => {
    window.localStorage.setItem(THEME_STORAGE_KEY, appTheme);
    document.documentElement.dataset.noetlTheme = appTheme;
  }, [appTheme]);

  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: tokens.colorPrimary,
          borderRadius: 0,
          colorBgContainer: tokens.colorBgContainer,
          colorBgLayout: tokens.colorBgLayout,
          colorText: tokens.colorText,
          colorBorder: tokens.colorBorder,
        },
      }}
    >
      <AntdApp>
        <Routes>
          <Route path="/login" element={<LoginPage appTheme={appTheme} />} />
          <Route path="/*" element={<AuthenticatedApp appTheme={appTheme} onThemeChange={setAppTheme} />} />
        </Routes>
      </AntdApp>
    </ConfigProvider>
  );
};

// Mount the app
const root = createRoot(document.getElementById("root") as HTMLElement);
const router = createBrowserRouter(
  [
    {
      path: "/*",
      element: <App />,
    },
  ],
  // Opt-in to v7 behaviors to avoid future flag warnings. Cast to any to satisfy TS.
  ({
    future: {
      v7_startTransition: true,
      v7_relativeSplatPath: true,
    },
  } as any),
);

root.render(<RouterProvider router={router} />);
