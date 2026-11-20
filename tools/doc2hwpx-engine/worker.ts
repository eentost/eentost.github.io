/**
 * Browser-side HWP/HWPX, PDF and DOCX to HWPX converter.
 * IeumOffice upstream revision: 18cfc7150a2028487a2ae669a324d02bae93570a
 * Original upstream source files are not modified.
 */
import { HwpEngine, docxToHwp } from "@genoffice/docx2hwp";
import { HwpDocument } from "@rhwp/core";

type Job = { id: number; fileName: string; data: ArrayBuffer };
type Loss = { feature: string; kind: "dropped" | "changed"; count: number };

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
        throw new Error("rhwp WebAssembly 파일을 불러오지 못했습니다. 엔진 파일 배포가 완료되지 않았습니다.");
      }
      const stream = response.body.pipeThrough(new DecompressionStream("gzip"));
      const wasm = new Uint8Array(await new Response(stream).arrayBuffer());
      if (wasm.length < 1024 || wasm[0] !== 0 || wasm[1] !== 97 || wasm[2] !== 115 || wasm[3] !== 109) {
        throw new Error("rhwp WebAssembly 파일이 손상되었거나 올바른 WASM 형식이 아닙니다.");
      }
      return HwpEngine.start(wasm);
    })().catch((error) => {
      enginePromise = null;
      throw error;
    });
  }
  return enginePromise;
}

function nativeHwpExport(input: Uint8Array) {
  const document = new HwpDocument(input);
  let output: ReturnType<HwpDocument["exportHwpxWithReport"]> | null = null;
  try {
    output = document.exportHwpxWithReport();
    const lossReport = output.contentLoss();
    const bytes = output.takeBytes();
    const verification = new HwpDocument(bytes);
    let pages = 0;
    try {
      pages = verification.pageCount();
      if (!Number.isFinite(pages) || pages < 1) {
        throw new Error("변환된 HWPX를 다시 열었지만 유효한 페이지가 확인되지 않았습니다.");
      }
    } finally {
      verification.free();
    }
    const warnings = lossReport && lossReport !== "[]" && lossReport !== "{}"
      ? ["한글 엔진 콘텐츠 손실 보고: " + lossReport]
      : [];
    return { bytes, losses: [] as Loss[], warnings, pages, verified: true };
  } finally {
    output?.free();
    document.free();
  }
}

self.addEventListener("message", async (event: MessageEvent<Job>) => {
  const { id, fileName, data } = event.data;
  try {
    if (!(data instanceof ArrayBuffer) || data.byteLength === 0) {
      throw new Error("입력 파일 데이터가 비어 있습니다.");
    }
    if (data.byteLength > MAX_FILE_BYTES) {
      throw new Error("파일당 50 MiB 제한을 초과했습니다.");
    }
    const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
    const input = new Uint8Array(data);
    let result: {
      bytes: Uint8Array;
      losses: Loss[];
      warnings: string[];
      pages?: number;
      verified: boolean;
    };
    if (ext === "hwp" || ext === "hwpx") {
      await loadEngine();
      result = nativeHwpExport(input);
    } else if (ext === "pdf") {
      await loadEngine();
      const document = HwpDocument.importPdf(input, {});
      let output: ReturnType<HwpDocument["exportHwpxWithReport"]> | null = null;
      try {
        output = document.exportHwpxWithReport();
        const lossReport = output.contentLoss();
        const bytes = output.takeBytes();
        const verification = new HwpDocument(bytes);
        let pages = 0;
        try {
          pages = verification.pageCount();
          if (!Number.isFinite(pages) || pages < 1) {
            throw new Error("PDF에서 생성된 HWPX를 다시 열었지만 페이지 검증에 실패했습니다.");
          }
        } finally {
          verification.free();
        }
        result = {
          bytes,
          losses: [],
          warnings: lossReport && lossReport !== "[]" && lossReport !== "{}" ? ["PDF 콘텐츠 손실 보고: " + lossReport] : [],
          pages,
          verified: true,
        };
      } finally {
        output?.free();
        document.free();
      }
    } else if (ext === "docx") {
      const converted = await docxToHwp(input, "hwpx", await loadEngine(), { look: "word" });
      result = { bytes: converted.bytes, losses: converted.losses as Loss[], warnings: [], verified: true };
    } else {
      throw new Error("현재 이 페이지에서 실제 변환이 구현된 형식은 HWP, HWPX, PDF, DOCX입니다. 나머지 형식은 변환 완료로 표시하지 않습니다.");
    }

    self.postMessage({
      id,
      ok: true,
      bytes: result.bytes.buffer,
      losses: result.losses,
      warnings: result.warnings,
      pages: result.pages,
      verified: result.verified,
    }, [result.bytes.buffer as ArrayBuffer]);
  } catch (error) {
    self.postMessage({
      id,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});
