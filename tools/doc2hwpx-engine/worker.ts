/**
 * Isolated DOCX -> HWPX conversion worker.
 * The upstream HwpEngine and docxToHwp APIs are used without modifying their
 * source. The WASM binary is gzip-compressed for static hosting and expanded
 * only when the first DOCX conversion is requested.
 */
import { HwpEngine, docxToHwp } from "@genoffice/docx2hwp";

type Job = { id: number; docx: ArrayBuffer };

let enginePromise: Promise<HwpEngine> | null = null;

async function loadEngine(): Promise<HwpEngine> {
  if (!enginePromise) {
    enginePromise = (async () => {
      if (typeof DecompressionStream === "undefined") {
        throw new Error("이 브라우저는 gzip 스트림 압축 해제를 지원하지 않습니다. 최신 Chrome, Edge 또는 Firefox를 이용하세요.");
      }
      const url = new URL("/tools/doc2hwpx-assets/rhwp_bg.wasm.gz", self.location.origin);
      const response = await fetch(url);
      if (!response.ok || !response.body) {
        throw new Error("rhwp WebAssembly 파일을 불러오지 못했습니다. 네트워크 또는 배포 상태를 확인하세요.");
      }
      const stream = response.body.pipeThrough(new DecompressionStream("gzip"));
      const wasm = new Uint8Array(await new Response(stream).arrayBuffer());
      if (wasm.length < 1024 || wasm[0] !== 0 || wasm[1] !== 97 || wasm[2] !== 115 || wasm[3] !== 109) {
        throw new Error("rhwp WebAssembly 파일의 압축 또는 형식 검증에 실패했습니다.");
      }
      return HwpEngine.start(wasm);
    })().catch((error) => {
      enginePromise = null;
      throw error;
    });
  }
  return enginePromise;
}

self.addEventListener("message", async (event: MessageEvent<Job>) => {
  const { id, docx } = event.data;
  try {
    if (!(docx instanceof ArrayBuffer) || docx.byteLength === 0) {
      throw new Error("DOCX 입력 데이터가 비어 있습니다.");
    }
    if (docx.byteLength > 10 * 1024 * 1024) {
      throw new Error("파일당 10 MiB 제한을 초과했습니다.");
    }
    const engine = await loadEngine();
    const converted = await docxToHwp(new Uint8Array(docx), "hwpx", engine, { look: "word" });
    const bytes = converted.bytes;
    self.postMessage(
      {
        id,
        ok: true,
        bytes: bytes.buffer,
        losses: converted.losses,
        verified: true,
      },
      [bytes.buffer as ArrayBuffer],
    );
  } catch (error) {
    self.postMessage({
      id,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});
