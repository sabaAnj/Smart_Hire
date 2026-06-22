// Client-only helper to extract plain text from a resume file.
// Supports .txt / .md (any text/*) directly, and .pdf via pdfjs-dist.

export async function extractResumeText(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  const isPdf = name.endsWith(".pdf") || file.type === "application/pdf";
  if (isPdf) return extractPdfText(file);

  // Treat everything else as text. Browsers happily decode .txt/.md/.rtf-ish.
  return await file.text();
}

async function extractPdfText(file: File): Promise<string> {
  // Lazy import so the PDF engine never enters the SSR bundle.
  // @ts-expect-error - no bundled types for the ESM build path
  const pdfjs: any = await import("pdfjs-dist/build/pdf.mjs");
  // Use a CDN-hosted worker matching the installed version.
  const workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
  pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buf }).promise;
  const chunks: string[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    chunks.push(content.items.map((it: any) => ("str" in it ? it.str : "")).join(" "));
  }
  return chunks.join("\n\n").trim();
}