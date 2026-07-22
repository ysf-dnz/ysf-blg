#!/usr/bin/env python3
"""
NotebookLM sorgu aracı (kitap-ozet/kitap-analiz için).

notebooklm skill'inin stealth tarayıcı altyapısını KÜTÜPHANE olarak kullanır
(skill dosyalarına dokunmaz); farkı: soruyu gerçek sohbet kutusuna yazdığını
DOĞRULAR (kullanıcı mesajı balonu DOM'da görünmeli) ve cevabı o mesajdan
sonra gelen yanıttan okur. Skill'in bilinen hatası — soru iletilmeyince
önerilen sorunun cevabının dönmesi — burada yapısal olarak imkânsız.

Kullanım:
  ~/.claude/skills/notebooklm/.venv/bin/python scripts/nb-sor.py <notebook-url> <soru-dosyası> [çıktı-dosyası]
"""
import sys
import time
import re
from pathlib import Path

SKILL_SCRIPTS = Path.home() / ".claude/skills/notebooklm/scripts"
sys.path.insert(0, str(SKILL_SCRIPTS))

from patchright.sync_api import sync_playwright  # noqa: E402
from browser_utils import BrowserFactory  # noqa: E402


def main() -> int:
    notebook_url = sys.argv[1]
    question = Path(sys.argv[2]).read_text().strip()
    out_path = Path(sys.argv[3]) if len(sys.argv) > 3 else None

    marker = question[:60]

    with sync_playwright() as pw:
        ctx = BrowserFactory.launch_persistent_context(pw, headless=True)
        page = ctx.new_page()
        page.goto(notebook_url, wait_until="domcontentloaded")
        page.wait_for_url(re.compile(r"^https://notebooklm\.google\.com/notebook/"), timeout=20000)
        page.wait_for_timeout(6000)

        # Gerçek sohbet kutusu: placeholder/aria-label'ında yazma çağrısı olan
        # görünür textbox (arama kutusu DEĞİL)
        box = None
        for sel in [
            'textarea[aria-label*="uery" i]',
            'textarea[placeholder]',
            'div[contenteditable="true"][role="textbox"]',
            'textarea',
        ]:
            for el in page.query_selector_all(sel):
                if el.is_visible():
                    box = el
                    break
            if box:
                break
        if not box:
            print("HATA: sohbet kutusu bulunamadı")
            page.screenshot(path="/tmp/nb-sor-fail.png")
            ctx.close()
            return 1

        box.click()
        # Uzun metni güvenilir gönderim: karakter karakter değil, insert ile
        page.keyboard.insert_text(question)
        page.wait_for_timeout(800)
        page.keyboard.press("Enter")

        # 1) Sorumuz kullanıcı mesajı olarak DOM'a düştü mü? (gönderim kanıtı)
        sent = False
        for _ in range(20):
            page.wait_for_timeout(500)
            if page.get_by_text(marker, exact=False).count() > 0:
                sent = True
                break
        if not sent:
            # gönder butonu fallback
            btn = page.query_selector('button[aria-label*="ubmit" i], button[type="submit"]')
            if btn:
                btn.click()
                for _ in range(20):
                    page.wait_for_timeout(500)
                    if page.get_by_text(marker, exact=False).count() > 0:
                        sent = True
                        break
        if not sent:
            print("HATA: soru sohbete düşmedi (gönderim başarısız)")
            page.screenshot(path="/tmp/nb-sor-fail.png")
            ctx.close()
            return 2
        print("✓ soru sohbete düştü, cevap bekleniyor…")

        # 2) Cevabı bekle: tüm gövde metninde sorumuzdan SONRA oluşan,
        #    büyüyen ve sabitlenen metin bloğu
        def answer_text() -> str:
            body = page.inner_text("body")
            idx = body.find(marker)
            return body[idx + len(question):].strip() if idx >= 0 else ""

        last, stable = "", 0
        deadline = time.time() + 240
        while time.time() < deadline:
            page.wait_for_timeout(2000)
            cur = answer_text()
            if len(cur) > 80:
                if cur == last:
                    stable += 1
                    if stable >= 3:
                        break
                else:
                    stable = 0
                    last = cur
        ctx.close()

    if not last:
        print("HATA: cevap zaman aşımı")
        return 3

    # UI kırpıntılarını temizle: ilk arayüz işaretinden sonrasını at,
    # satır içi kaynak numarası satırlarını düşür
    answer = last
    for marker_ui in [
        "\nkeep_pin", "\nNotlara kaydet", "\nSave to note", "\ncopy_all",
        "\nthumb_up", "\nGemini Notebook", "\nYanıt hazır",
    ]:
        idx = answer.find(marker_ui)
        if idx > 0:
            answer = answer[:idx]
    answer = re.sub(r"\n\d{1,2}\n", "\n", answer + "\n").strip()
    if out_path:
        out_path.write_text(answer)
        print(f"✓ cevap yazıldı: {out_path} ({len(answer)} karakter)")
    else:
        print(answer[:2000])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
