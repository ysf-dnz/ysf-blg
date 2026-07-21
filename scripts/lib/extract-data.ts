/**
 * HTML içine gömülü `const <AD> = {...}` ifadesinden dengeli süslü parantez
 * taramasıyla JSON çıkarır. Regex kullanılmaz: iç içe nesneler ve string
 * içindeki parantezler güvenle atlanır.
 */
export function extractConstObject(html: string, name: string): unknown {
  const marker = `const ${name} = `;
  const idx = html.indexOf(marker);
  if (idx === -1) {
    throw new Error(`Gömülü veri bulunamadı: "${marker}"`);
  }
  const start = html.indexOf("{", idx);
  if (start === -1) {
    throw new Error(`"${marker}" sonrası '{' bulunamadı`);
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < html.length; i++) {
    const ch = html[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        return JSON.parse(html.slice(start, i + 1));
      }
    }
  }
  throw new Error(`"${marker}" için dengeli '}' bulunamadı`);
}
