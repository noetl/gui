import { useState, useEffect, useMemo } from "react";
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
import { Layout, ConfigProvider, Result, Button, App as AntdApp, Spin, Segmented } from "antd";

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
import {
  AppstoreOutlined,
  CodeOutlined,
  DatabaseOutlined,
  EyeOutlined,
  KeyOutlined,
  TeamOutlined,
} from "@ant-design/icons";

// Import auth functions
import { isAuthenticated, getUserInfo, validateSession, logout, isDevSkipAuth, type GatewayUser } from "./services/gatewayAuth";
import { isEnvTrue } from "./services/runtimeEnv";

// Import styles
import "antd/dist/reset.css";
import "../static/css/main.css";

const { Header, Content, Footer } = Layout;
type AppTheme = "dark" | "light";
const THEME_STORAGE_KEY = "noetl-ui-theme";

function readStoredTheme(): AppTheme {
  if (typeof window === "undefined") return "dark";
  return window.localStorage.getItem(THEME_STORAGE_KEY) === "light" ? "light" : "dark";
}

const appThemeTokens: Record<AppTheme, {
  colorBgContainer: string;
  colorBgLayout: string;
  colorBorder: string;
  colorPrimary: string;
  colorText: string;
}> = {
  dark: {
    colorPrimary: "#6fdc6f",
    colorBgContainer: "#071007",
    colorBgLayout: "#050805",
    colorText: "#9cff9c",
    colorBorder: "#2f6f2f",
  },
  light: {
    colorPrimary: "#0f6b3a",
    colorBgContainer: "#ffffff",
    colorBgLayout: "#f5f7f5",
    colorText: "#102010",
    colorBorder: "#c9d8c9",
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
  { key: "/execution", label: "observe", path: "/execution", section: "Operate", icon: <EyeOutlined />, roles: [], adminOnly: true },
  { key: "/editor", label: "edit", path: "/editor", section: "Build", icon: <CodeOutlined />, roles: [], adminOnly: true },
  { key: "/credentials", label: "secrets", path: "/credentials", section: "Admin", icon: <KeyOutlined />, roles: [], adminOnly: true },
  { key: "/travel", label: "travel", path: "/travel", section: "Operate", icon: <DatabaseOutlined />, roles: ["analyst", "viewer", "developer", "admin"] },
  { key: "/users", label: "users", path: "/users", section: "Admin", icon: <TeamOutlined />, roles: [], adminOnly: true },
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

// Login page wrapper (no layout/menu)
const LoginPage: React.FC = () => {
  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: "#1890ff",
          borderRadius: 8,
          colorBgContainer: "#ffffff",
          colorBgLayout: "#f5f5f5",
        },
      }}
    >
      <AntdApp>
        <div style={{ minHeight: "100vh", background: "#050805", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <GatewayLogin />
        </div>
      </AntdApp>
    </ConfigProvider>
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

  useEffect(() => {
    const checkAuth = async () => {
      if (!isAuthenticated()) {
        navigate("/login", { replace: true });
        return;
      }

      if (isEnvTrue("VITE_ALLOW_SKIP_AUTH") && isDevSkipAuth()) {
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

  const activeRoute = useMemo(() => {
    return visibleMenuItems.find((item) => location.pathname === item.path || location.pathname.startsWith(`${item.path}/`));
  }, [location.pathname, visibleMenuItems]);

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <Layout className={`app terminal-app theme-${appTheme}`} style={{ minHeight: "100vh" }}>
      <Header className={`app-header console-header ${consoleVisible ? "" : "console-header-collapsed"}`}>
        <div className="header-inner mc-top-line">
          <div className="logo">NOETL://LOCAL</div>
          <nav className="mc-menubar" aria-label="NoETL workspace menu">
            {visibleMenuItems.map((item) => (
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
            <button type="button" className="mc-fkey" onClick={() => setConsoleVisible((value) => !value)}>
              {consoleVisible ? "Hide CLI" : "Show CLI"}
            </button>
            <button type="button" className="mc-fkey" onClick={() => setDashboardVisible((value) => !value)}>
              {dashboardVisible ? "Hide View" : "Show View"}
            </button>
            <button type="button" className="mc-fkey" onClick={() => navigate("/catalog")}>
              Catalog
            </button>
            <button type="button" className="mc-fkey" onClick={() => navigate("/execution")}>
              Execute
            </button>
            <button type="button" className="mc-fkey mc-fkey-danger" onClick={handleLogout}>
              Logout
            </button>
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
        {consoleVisible && <NoetlPrompt className="header-prompt" />}
      </Header>
      <Content className="terminal-content">
        {dashboardVisible ? (
          <div className="AppRoutesContent terminal-panel dashboard-window">
            <div className="dashboard-window-bar">
              <span className="mc-panel-title">VIEW::{location.pathname || "/"}</span>
              <Button className="mc-menu-button" size="small" onClick={() => setDashboardVisible(false)}>
                hide view
              </Button>
            </div>
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
        ) : (
          <div className="dashboard-window-toggle">
            <span>view window hidden :: {location.pathname || "/"}</span>
            <Button className="mc-menu-button" size="small" onClick={() => setDashboardVisible(true)}>
              show view
            </Button>
          </div>
        )}
      </Content>
      <Footer className="mc-function-footer">
        <button type="button" onClick={() => setConsoleVisible(true)}>Help</button>
        <button type="button" onClick={() => setConsoleVisible((value) => !value)}>CLI</button>
        <button type="button" onClick={() => setDashboardVisible((value) => !value)}>View</button>
        <button type="button" onClick={() => navigate("/catalog")}>Catalog</button>
        <button type="button" onClick={() => navigate("/execution")}>Exec</button>
        <button type="button" onClick={() => navigate("/editor")}>Edit</button>
        <button type="button" onClick={() => navigate("/credentials")}>Creds</button>
        <button type="button" onClick={() => navigate("/users")}>Users</button>
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
          <Route path="/login" element={<LoginPage />} />
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
