export const DEFAULT_PRIMARY_API = "http://localhost:1337";
export const DEFAULT_CATALOG_API = "https://api.tryliner.fun";

export function resolveMusicOnlyMode(value: string | undefined): boolean {
  return value === "true";
}

export function resolveAccountRecommendationsEnabled(
  value: string | undefined,
): boolean {
  return value === "true";
}

export const MUSIC_ONLY_MODE = resolveMusicOnlyMode(
  import.meta.env.VITE_MUSIC_ONLY_MODE as string | undefined,
);

export const ACCOUNT_RECOMMENDATIONS_ENABLED =
  resolveAccountRecommendationsEnabled(
    import.meta.env.VITE_ACCOUNT_RECOMMENDATIONS_ENABLED as string | undefined,
  );

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

export function isSecureBaseUrl(url: string): boolean {
  try {
    const { protocol, hostname } = new URL(url);
    return (
      protocol === "https:" ||
      (protocol === "http:" && LOOPBACK_HOSTS.has(hostname))
    );
  } catch {
    return false;
  }
}

export function resolveApiBaseUrl(
  envUrl: string | undefined,
  fallback = DEFAULT_PRIMARY_API,
): string {
  const clean = envUrl?.trim().replace(/\/+$/, "");
  return clean && isSecureBaseUrl(clean) ? clean : fallback;
}

export function resolveCatalogApiBaseUrl(envUrl: string | undefined): string {
  return resolveApiBaseUrl(envUrl, DEFAULT_CATALOG_API);
}

const productionOrigin =
  typeof window !== "undefined" &&
  import.meta.env.PROD &&
  isSecureBaseUrl(window.location.origin)
    ? window.location.origin
    : undefined;

const baseUrl = resolveApiBaseUrl(
  import.meta.env.VITE_API_URL as string | undefined,
  productionOrigin ?? DEFAULT_PRIMARY_API,
);

export function getApiBaseUrl(): string {
  return baseUrl;
}

const catalogBaseUrl = resolveCatalogApiBaseUrl(
  import.meta.env.VITE_CATALOG_API_URL as string | undefined,
);

export function getCatalogApiBaseUrl(): string {
  return catalogBaseUrl;
}
