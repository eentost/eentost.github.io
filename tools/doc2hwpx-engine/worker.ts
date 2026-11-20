/**
 * Browser document conversion worker.
 *
 * Upstream IeumOffice DOCX/HWP conversion code is pinned at
 * 18cfc7150a2028487a2ae669a324d02bae93570a. Original upstream modules are
 * imported without editing. This worker adapts other formats into the
 * upstream DOCX -> HWPX pipeline or uses rhwp's native PDF/HWP import.
 */
import { HwpEngine, docxToHwp } from "@genoffice/docx2hwp";
import { HwpDocument } from "@rhwp/core";
import { convertLegacyDocToDocx } from "../../ieumoffice/packages/doc2docx/src/index.ts";
import { odtToDocx } from "../../ieumoffice/packages/odt-engine/src/index.ts";
import { pptxToText } from "../../ieumoffice/packages/file-parse/src/pptx.ts";
import { xlsxToText } from "../../ieumoffice/packages/file-parse/src/xlsx.ts";
import { epubToText } from "../../ieumoffice/packages/file-parse/src/epub.ts";
import { xmindToText } from "../../ieumoffice/packages/file-parse/src/xmind.ts";
import { convertPptToPptx } from "../../ieumoffice/packages/ppt2pptx/src/index.ts";
import * as XLSX from "xlsx";

type Block =
  | { kind: "p"; text: string }
  | { kind: "h"; level: number; text: string }
  | { kind: "table"; rows: string[][] };

type Loss = { feature: string; kind: "dropped" | "changed"; count: number };
type Job = { id: number; fileName: string; data?: ArrayBuffer; blocks?: Block[] };

let enginePromise: Promise<HwpEngine> | null = null;
const MAX_FILE_BYTES = 50 * 1024 * 1024;

async function loadEngine(): Promise<HwpEngine> {
  if (!enginePromise) {
    enginePromise = (async () => {
      if (typeof DecompressionStream === "undefined") {
        throw new Error("이 브라우저는 gzip 스트림 압축 해제를 지원하지 않습니다. 최신 Chrome 또는 Edge를 이용하세요.");
      }
      const response = await fetch(new URL("/tools/doc2hwpx-assets/rhwp_bg.wasm.gz", self.location.origin));
      if (!response.ok || !response.body) {
        throw new Error("rhwp WebAssembly 파일을 불러오지 못했습니다. 배포 상태를 확인하세요.");
      }
      const stream = response.body.pipeThrough(new DecompressionStream("gzip"));
      const wasm = new Uint8Array(await new Response(stream).arrayBuffer());
      if (wasm.length < 1024 || wasm[0] !== 0 || wasm[1] !== 97 || wasm[2] !== 115 || wasm[3] !== 109) {
        throw new Error("rhwp WebAssembly 파일의 형식 검증에 실패했습니다.");
      }
      return HwpEngine.start(wasm);
    })().catch((error) => {
      enginePromise = null;
      throw error;
    });
  }
  return enginePromise;
}

function decodeText(bytes: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes).replace(/^\uFEFF/, "");
  } catch {
    try {
      return new TextDecoder("euc-kr").decode(bytes).replace(/^\uFEFF/, "");
    } catch {
      return new TextDecoder().decode(bytes).replace(/^\uFEFF/, "");
    }
  }
}

function parseMarkdown(raw: string): Block[] {
  const lines = raw.replace(/\r\n?/g, "\n").split("\n");
  const out: Block[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      out.push({ kind: "h", level: heading[1].length, text: heading[2] });
      continue;
    }
    if (line.trim().startsWith("|")) {
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        const row = lines[i].trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map(x => x.trim());
        if (!row.every(v => /^:?-{3,}:?$/.test(v))) rows.push(row);
        i++;
      }
      i--;
      if (rows.length) out.push({ kind: "table", rows });
      continue;
    }
    const bullet = line.match(/^\s*(?:[-*+]\s+|\d+[.)]\s+)(.*)$/);
    out.push({ kind: "p", text: bullet ? "• " + bullet[1] : line });
  }
  return out;
}

function parseCsv(raw: string): Block[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (quoted) {
      if (ch === '"' && raw[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n") { row.push(cell.replace(/\r$/, "")); rows.push(row); row = []; cell = ""; }
    else cell += ch;
  }
  row.push(cell.replace(/\r$/, ""));
  if (row.some(x => x !== "") || rows.length === 0) rows.push(row);
  return rows.length ? [{ kind: "table", rows }] : [];
}

function xml(value: unknown): string {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function le16(value: number): number[] { return [value & 255, (value >>> 8) & 255]; }
function le32(value: number): number[] { return [value & 255, (value >>> 8) & 255, (value >>> 16) & 255, (value >>> 24) & 255]; }
const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let i = 0; i < 8; i++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function concat(parts: Uint8Array[]): Uint8Array {
  const result = new Uint8Array(parts.reduce((n, part) => n + part.length, 0));
  let offset = 0;
  for (const part of parts) { result.set(part, offset); offset += part.length; }
  return result;
}

/** Minimal standards-compliant DOCX package; all text is XML-escaped. */
function buildDocx(blocks: Block[]): Uint8Array {
  const enc = new TextEncoder();
  const para = (text: string, style = "") =>
    "<w:p>" + (style ? "<w:pPr><w:pStyle w:val=\"" + style + "\"/></w:pPr>" : "") +
    "<w:r><w:t xml:space=\"preserve\">" + xml(text) + "</w:t></w:r></w:p>";
  const table = (rows: string[][]) => {
    const cols = Math.max(1, ...rows.map(r => r.length));
    const grid = Array.from({ length: cols }, () => "<w:gridCol w:w=\"1800\"/>").join("");
    const body = rows.map((row, ri) => "<w:tr>" +
      Array.from({ length: cols }, (_, ci) => {
        const fill = ri === 0 ? "<w:shd w:fill=\"1F3B5B\"/>" : "";
        const color = ri === 0 ? "<w:color w:val=\"FFFFFF\"/><w:b/>" : "";
        return "<w:tc><w:tcPr><w:tcW w:w=\"1800\" w:type=\"dxa\"/>" + fill +
          "<w:tcMar><w:top w:w=\"80\" w:type=\"dxa\"/><w:bottom w:w=\"80\" w:type=\"dxa\"/><w:start w:w=\"100\" w:type=\"dxa\"/><w:end w:w=\"100\" w:type=\"dxa\"/></w:tcMar></w:tcPr>" +
          "<w:p><w:r><w:rPr>" + color + "</w:rPr><w:t xml:space=\"preserve\">" + xml(row[ci] ?? "") + "</w:t></w:r></w:p></w:tc>";
      }).join("") + "</w:tr>").join("");
    return "<w:tbl><w:tblPr><w:tblW w:w=\"0\" w:type=\"auto\"/><w:tblBorders>" +
      ["top","left","bottom","right","insideH","insideV"].map(side => "<w:" + side + " w:val=\"single\" w:sz=\"4\" w:space=\"0\" w:color=\"C8D3E0\"/>").join("") +
      "</w:tblBorders></w:tblPr><w:tblGrid>" + grid + "</w:tblGrid>" + body + "</w:tbl>";
  };
  const body = blocks.map(block => {
    if (block.kind === "table") return table(block.rows);
    if (block.kind === "h") return para(block.text, "Heading" + Math.min(6, Math.max(1, block.level)));
    return para(block.text);
  }).join("");
  const documentXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' +
    body + '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708"/></w:sectPr></w:body></w:document>';
  const stylesXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
    '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="Malgun Gothic"/><w:sz w:val="22"/></w:rPr></w:style>' +
    [1,2,3,4,5,6].map(n => '<w:style w:type="paragraph" w:styleId="Heading' + n + '"><w:name w:val="heading ' + n + '"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:keepLines/></w:pPr><w:rPr><w:b/><w:sz w:val="' + (n === 1 ? 34 : n === 2 ? 30 : 26) + '"/></w:rPr></w:style>').join("") +
    '</w:styles>';
  const entries: Array<[string, string]> = [
    ["[Content_Types].xml", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>'],
    ["_rels/.rels", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'],
    ["word/document.xml", documentXml],
    ["word/styles.xml", stylesXml],
    ["word/_rels/document.xml.rels", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'],
  ];
  const locals: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const [name, text] of entries) {
    const nameBytes = enc.encode(name);
    const data = enc.encode(text);
    const crc = crc32(data);
    const header = new Uint8Array([
      ...le32(0x04034b50), ...le16(20), ...le16(0x0800), ...le16(0),
      ...le16(0), ...le16(0), ...le32(crc), ...le32(data.length),
      ...le32(data.length), ...le16(nameBytes.length), ...le16(0),
    ]);
    locals.push(header, nameBytes, data);
    const dir = new Uint8Array([
      ...le32(0x02014b50), ...le16(20), ...le16(20), ...le16(0x0800),
      ...le16(0), ...le16(0), ...le16(0), ...le32(crc),
      ...le32(data.length), ...le32(data.length), ...le16(nameBytes.length),
      ...le16(0), ...le16(0), ...le16(0), ...le16(0), ...le32(0), ...le32(offset),
    ]);
    central.push(dir, nameBytes);
    offset += header.length + nameBytes.length + data.length;
  }
  const centralBytes = concat(central);
  const end = new Uint8Array([
    ...le32(0x06054b50), ...le16(0), ...le16(0), ...le16(entries.length),
    ...le16(entries.length), ...le32(centralBytes.length), ...le32(offset), ...le16(0),
  ]);
  return concat([...locals, centralBytes, end]);
}

function textToBlocks(text: string): Block[] {
  const blocks = parseMarkdown(text);
  return blocks.length ? blocks : [{ kind: "p", text: "" }];
}

function blocksFromFile(fileName: string, bytes: Uint8Array): Block[] {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  const text = decodeText(bytes);
  if (["md", "markdown", "txt", "html", "htm"].includes(ext)) {
    if (ext === "md" || ext === "markdown") return textToBlocks(text);
    if (ext === "html" || ext === "htm") {
      const stripped = text
        .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
        .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
        .replace(/<br\s*\/?\s*>/gi, "\n")
        .replace(/<\/(p|div|section|article|li|h[1-6]|tr)>/gi, "\n")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/gi, " ")
        .replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">")
        .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
      return textToBlocks(stripped.split(/\n+/).map(x => x.trim()).filter(Boolean).join("\n\n"));
    }
    return textToBlocks(text);
  }
  if (ext === "csv") return parseCsv(text);
  return [];
}

function sheetBlocks(bytes: Uint8Array): Block[] {
  const workbook = XLSX.read(bytes, { type: "array", cellDates: true, cellNF: false, cellText: true });
  const blocks: Block[] = [];
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    blocks.push({ kind: "h", level: 1, text: sheetName });
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: "" }) as unknown[][];
    const normalized = rows.map(row => row.map(cell => String(cell ?? "")));
    if (normalized.length) blocks.push({ kind: "table", rows: normalized });
  }
  return blocks;
}

function normalizeWarnings(warnings: string[] = []): string[] {
  return [...new Set(warnings.filter(Boolean))];
}

function exportNativeDocument(document: HwpDocument): { bytes: Uint8Array; pages: number; contentLoss: number } {
  let output: ReturnType<HwpDocument["exportHwpxWithReport"]> | null = null;
  try {
    output = document.exportHwpxWithReport();
    let report: unknown = {};
    try { report = JSON.parse(output.contentLoss()); } catch { report = {}; }
    const bytes = output.takeBytes();
    const contentLoss = typeof report === "object" && report !== null && "count" in report
      ? Number((report as { count: unknown }).count) || 0 : 0;
    const check = new HwpDocument(bytes);
    try {
      const pages = check.pageCount();
      if (!Number.isFinite(pages) || pages < 1) throw new Error("생성된 HWPX에서 유효한 페이지를 확인하지 못했습니다.");
      return { bytes, pages, contentLoss };
    } finally {
      check.free();
    }
  } finally {
    output?.free();
    document.free();
  }
}

async function toDocx(fileName: string, bytes: Uint8Array, warnings: string[]): Promise<{ docx: Uint8Array; look: "word" | "hangul" }> {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "doc" || ext === "dot") {
    const converted = await convertLegacyDocToDocx(bytes);
    warnings.push(...converted.warnings);
    return { docx: converted.docx, look: "word" };
  }
  if (ext === "odt") {
    const converted = await odtToDocx(bytes);
    warnings.push(...(converted.report?.items?.map((x: { message?: string }) => x.message || "") ?? []));
    return { docx: converted.docxBytes, look: "word" };
  }
  if (["pptx", "pptm", "ppsx", "xlsx", "xlsm", "xlsb", "ods", "ppt"].includes(ext)) {
    let text: string;
    if (ext === "ppt") {
      const pptx = await convertPptToPptx(bytes);
      warnings.push(...pptx.warnings);
      text = await pptxToText(pptx.bytes);
    } else if (["pptx", "pptm", "ppsx"].includes(ext)) {
      text = await pptxToText(bytes);
    } else if (ext === "xlsx" || ext === "xlsm" || ext === "xlsb" || ext === "ods") {
      const blocks = sheetBlocks(bytes);
      return { docx: buildDocx(blocks), look: "hangul" };
    } else {
      text = "";
    }
    warnings.push("슬라이드 파일은 슬라이드별 텍스트와 읽을 수 있는 표 중심으로 변환했습니다. 애니메이션, 전환 효과, 일부 도형·미디어는 HWPX에 그대로 옮기지 않습니다.");
    return { docx: buildDocx(textToBlocks(text)), look: "hangul" };
  }
  if (ext === "epub") {
    const text = await epubToText(bytes);
    warnings.push("EPUB은 목차와 장별 텍스트 중심으로 변환했습니다. 책의 고정 레이아웃과 일부 삽화는 보존하지 않습니다.");
    return { docx: buildDocx(textToBlocks(text)), look: "hangul" };
  }
  if (ext === "xmind") {
    const text = await xmindToText(bytes);
    warnings.push("마인드맵은 계층형 텍스트로 변환했습니다. 노드 배치와 테마는 HWPX에 그대로 옮기지 않습니다.");
    return { docx: buildDocx(textToBlocks(text)), look: "hangul" };
  }
  const blocks = blocksFromFile(fileName, bytes);
  if (blocks.length) return { docx: buildDocx(blocks), look: "hangul" };
  throw new Error("지원하지 않는 입력 형식입니다. DOC/DOCX, PDF, XLSX/XLSM/XLSB/ODS, PPT/PPTX/PPTM/PPSX, ODT, EPUB, HWP/HWPX, XMind, MD, HTML, TXT, CSV 파일을 선택하세요.");
}

async function convert(job: Job) {
  const warnings: string[] = [];
  const fileName = job.fileName || "document";
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  const data = job.data ? new Uint8Array(job.data) : new Uint8Array();
  if (data.byteLength > MAX_FILE_BYTES) throw new Error("파일당 50 MiB 제한을 초과했습니다.");
  if (job.blocks?.length) {
    const docx = buildDocx(job.blocks);
    const converted = await docxToHwp(docx, "hwpx", await loadEngine(), { look: "hangul" });
    return { bytes: converted.bytes, losses: converted.losses as Loss[], warnings, pages: undefined, verified: true };
  }
  if (ext === "pdf") {
    const engine = await loadEngine();
    const document = HwpDocument.importPdf(data, {});
    const native = exportNativeDocument(document);
    if (native.contentLoss) warnings.push("PDF 가져오기 엔진이 일부 콘텐츠 손실을 보고했습니다 (" + native.contentLoss + "건).");
    return { ...native, losses: [], warnings, verified: true };
  }
  if (ext === "hwp" || ext === "hwpx") {
    await loadEngine();
    const document = new HwpDocument(data);
    const native = exportNativeDocument(document);
    if (native.contentLoss) warnings.push("원본 HWP/HWPX를 HWPX로 다시 저장하면서 엔진이 콘텐츠 손실 " + native.contentLoss + "건을 보고했습니다.");
    return { ...native, losses: [], warnings, verified: true };
  }
  if (!data.length) throw new Error("입력 파일 데이터가 비어 있습니다.");
  const converted = await toDocx(fileName, data, warnings);
  const result = await docxToHwp(converted.docx, "hwpx", await loadEngine(), { look: converted.look });
  if (ext === "docm") warnings.push("DOCM의 VBA 매크로 프로젝트는 HWPX에 포함되지 않습니다.");
  return {
    bytes: result.bytes,
    losses: result.losses as Loss[],
    warnings: normalizeWarnings(warnings),
    verified: true,
  };
}

self.addEventListener("message", async (event: MessageEvent<Job>) => {
  const job = event.data;
  try {
    if (job.blocks?.length && !job.data) await loadEngine();
    const result = await convert(job);
    self.postMessage({
      id: job.id,
      ok: true,
      bytes: result.bytes.buffer,
      losses: result.losses,
      warnings: result.warnings,
      pages: result.pages,
      verified: result.verified,
    }, [result.bytes.buffer as ArrayBuffer]);
  } catch (error) {
    self.postMessage({
      id: job.id,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});
