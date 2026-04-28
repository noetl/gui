/// <reference types="vite/client" />

declare global {
  interface Window {
    __NOETL_ENV__?: Record<string, string | undefined>;
  }

  interface ImportMetaEnv {
    readonly VITE_GATEWAY_URL?: string;
    readonly VITE_API_MODE?: string;
    readonly VITE_API_BASE_URL?: string;
    readonly VITE_ALLOW_SKIP_AUTH?: string;
    readonly VITE_AUTH0_DOMAIN?: string;
    readonly VITE_AUTH0_CLIENT_ID?: string;
    readonly VITE_AUTH0_REDIRECT_URI?: string;
    readonly VITE_APP_VERSION?: string;
  }
}
