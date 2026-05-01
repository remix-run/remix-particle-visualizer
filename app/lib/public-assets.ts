function deploymentBase(): string {
  return import.meta.env?.BASE_URL ?? "/";
}

export function publicAssetPath(path: string): string {
  const base = deploymentBase();
  const normalizedBase = base.endsWith("/") ? base : `${base}/`;
  const normalizedPath = path.replace(/^\/+/, "");

  return `${normalizedBase}${normalizedPath}`;
}
