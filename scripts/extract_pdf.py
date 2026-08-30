import json
import sys

try:
    from pypdf import PdfReader
except Exception as exc:
    print(json.dumps({"ok": False, "error": f"pypdf is unavailable: {exc}"}))
    sys.exit(0)

if len(sys.argv) < 2:
    print(json.dumps({"ok": False, "error": "Missing PDF path."}))
    sys.exit(0)

path = sys.argv[1]

try:
    reader = PdfReader(path)
    pages = []
    for index, page in enumerate(reader.pages, start=1):
        text = page.extract_text() or ""
        pages.append({"pageNumber": index, "text": text})
    ocr_status = "not_needed" if any(page["text"].strip() for page in pages) else "ocr_not_configured"
    print(json.dumps({"ok": True, "pages": pages, "ocrStatus": ocr_status}))
except Exception as exc:
    print(json.dumps({"ok": False, "error": str(exc), "ocrStatus": "failed"}))
