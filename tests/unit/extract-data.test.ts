import { describe, expect, it } from "vitest";
import { extractConstObject } from "../../scripts/lib/extract-data.ts";

const fixture = `
<html><script>
const OTHER = {"x": 1};
const DATA = {"nodes": [{"id": "a", "name": "İç {süslü} ve \\"tırnak\\""}], "links": [{"source": "a", "target": "b"}]};
render(DATA);
</script></html>`;

describe("extractConstObject", () => {
  it("gömülü JSON'u dengeli parantezle çıkarır", () => {
    const data = extractConstObject(fixture, "DATA") as {
      nodes: { id: string; name: string }[];
      links: unknown[];
    };
    expect(data.nodes).toHaveLength(1);
    expect(data.links).toHaveLength(1);
  });

  it("string içindeki süslü parantez ve kaçışlı tırnakları atlar", () => {
    const data = extractConstObject(fixture, "DATA") as {
      nodes: { name: string }[];
    };
    expect(data.nodes[0]!.name).toBe('İç {süslü} ve "tırnak"');
  });

  it("doğru sabiti seçer", () => {
    const other = extractConstObject(fixture, "OTHER") as { x: number };
    expect(other.x).toBe(1);
  });

  it("bulunamayan sabit için anlaşılır hata verir", () => {
    expect(() => extractConstObject(fixture, "YOK")).toThrow(
      /Gömülü veri bulunamadı/,
    );
  });

  it("dengesiz parantezde hata verir", () => {
    expect(() =>
      extractConstObject('const DATA = {"a": {', "DATA"),
    ).toThrow(/dengeli/);
  });
});
