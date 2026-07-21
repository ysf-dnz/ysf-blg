/** site config'ine göre mutlak URL üretir. */
export function absoluteUrl(path: string, site: URL | string): string {
  return new URL(path, site).toString();
}

export const KUTUPHANEM_URL = "https://ysf-dnz.github.io/kutuphanem";
