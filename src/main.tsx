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
import { Layout, Menu, ConfigProvider, Result, Button, App as AntdApp, Spin } from "antd";

// Import components
import Catalog from "./components/Catalog";
import Credentials from "./components/Credentials";
import Editor from "./components/Editor";
import Execution from "./components/Execution";
import ExecutionDetail from "./components/ExecutionDetail";
import GatewayLogin from "./components/GatewayLogin";
import GatewayAssistant from "./components/GatewayAssistant";
import UserManagement from "./components/UserManagement";
import {
  AppstoreOutlined,
  CodeOutlined,
  DatabaseOutlined,
  EyeOutlined,
  KeyOutlined,
  LogoutOutlined,
  TeamOutlined,
} from "@ant-design/icons";

// Import auth functions
import { isAuthenticated, getUserInfo, validateSession, logout, isDevSkipAuth, type GatewayUser } from "./services/gatewayAuth";
import { isEnvTrue } from "./services/runtimeEnv";

// Import styles
import "antd/dist/reset.css";
import "../static/css/main.css";

const { Header, Content, Footer } = Layout;

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
const AuthenticatedApp: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState<GatewayUser | null>(null);
  const [loading, setLoading] = useState(true);

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

  const activeMenuKey = useMemo(() => {
    // Find the menu item that matches current path
    const match = visibleMenuItems.find((item) => location.pathname.startsWith(item.key));
    return match?.key || "";
  }, [location.pathname, visibleMenuItems]);

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  const menuItems = useMemo(() => {
    const sectionOrder: MenuItem["section"][] = ["Catalog", "Build", "Operate", "Admin"];
    return [
      ...sectionOrder
        .map((section) => {
          const children = visibleMenuItems
            .filter((item) => item.section === section)
            .map((item) => ({
              key: item.key,
              icon: item.icon,
              label: item.label,
              onClick: () => navigate(item.path),
            }));
          if (children.length === 0) return null;
          return {
            key: `section:${section}`,
            label: section,
            children,
          };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null),
      {
        key: "logout",
        icon: <LogoutOutlined />,
        label: "Logout",
        onClick: handleLogout,
        style: { marginLeft: "auto" },
      },
    ];
  }, [visibleMenuItems, navigate]);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <Layout className="app terminal-app" style={{ minHeight: "100vh" }}>
      <Header className="app-header">
        <div className="header-inner">
          <div className="logo">NOETL://LOCAL</div>
          <Menu
            theme="light"
            mode="horizontal"
            selectedKeys={[activeMenuKey]}
            className="centered-menu"
            items={menuItems}
          />
        </div>
      </Header>
      <Content className="terminal-content">
        <div className="AppRoutesContent terminal-panel">
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
      </Content>
      <Footer
        style={{
          textAlign: "center",
          background: "transparent",
          color: "#8c8c8c",
          fontSize: "14px",
        }}
      >
        [ noetl console :: 2026 ]
      </Footer>
    </Layout>
  );
};

// Root App component - handles routing between login and authenticated app
const App: React.FC = () => {
  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: "#1890ff",
          borderRadius: 0,
          colorBgContainer: "#071007",
          colorBgLayout: "#050805",
          colorText: "#9cff9c",
          colorBorder: "#2f6f2f",
        },
      }}
    >
      <AntdApp>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/*" element={<AuthenticatedApp />} />
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
