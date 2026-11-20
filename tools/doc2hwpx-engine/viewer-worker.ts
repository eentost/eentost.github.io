/**
 * Additive browser HWP/HWPX viewer worker.
 * Uses IeumOffice's rhwp WebAssembly renderer; no PDF conversion is involved.
 * Upstream revision: 18cfc7150a2028487a2ae669a324d02bae93570a
 */
import { HwpEngine } from "@genoffice/docx2hwp";
import { HwpDocument, HwpViewer } from "@rhwp/core";

type OpenMessage = { kind: "open"; id: number; session: number; fileName: string; data: ArrayBuffer };
type RenderMessage = { kind: "render"; id: number; session: number; pageIndex: number };
type CloseMessage = { kind: "close"; id: number; session: number };
type Message = OpenMessage | RenderMessage | CloseMessage;

let enginePromise: Promise<HwpEngine> | null = null;
let activeSession = 0;
let activeDocument: HwpDocument | null = null;
let activeViewer: HwpViewer | null = null;
let activeFileName = "";

async function loadEngine(): Promise<HwpEngine> {
  if (!enginePromise) {
    enginePromise = (async () => {
      if (typeof DecompressionStream === "undefined") {
        throw new Error("현재 브라우저가 gzip 스트림 해제를 지원하지 않습니다. 최신 Chrome 또는 Edge를 이용하세요.");
      }
      const response = await fetch(new URL("/tools/doc2hwpx-assets/rhwp_bg.wasm.gz", self.location.origin));
      if (!response.ok || !response.body) {
        throw new Error("HWP 뷰어 WebAssembly를 불러오지 못했습니다. 엔진 배포 상태를 확인하세요.");
      }
      const stream = response.body.pipeThrough(new DecompressionStream("gzip"));
      const wasm = new Uint8Array(await new Response(stream).arrayBuffer());
      if (wasm.length < 1024 || wasm[0] !== 0 || wasm[1] !== 97 || wasm[2] !== 115 || wasm[3] !== 109) {
        throw new Error("HWP 뷰어 WebAssembly 파일 검증에 실패했습니다.");
      }
      return HwpEngine.start(wasm);
    })().catch(error => {
      enginePromise = null;
      throw error;
    });
  }
  return enginePromise;
}

function releaseDocument() {
  try { activeViewer?.free(); } catch { /* release best-effort */ }
  activeViewer = null;
  try { activeDocument?.free(); } catch { /* release best-effort */ }
  activeDocument = null;
  activeFileName = "";
}

function postError(id: number, error: unknown) {
  self.postMessage({
    id,
    ok: false,
    error: error instanceof Error ? error.message : String(error),
  });
}

self.addEventListener("message", async (event: MessageEvent<Message>) => {
  const message = event.data;
  try {
    if (message.kind === "open") {
      releaseDocument();
      activeSession = message.session;
      if (!(message.data instanceof ArrayBuffer) || message.data.byteLength === 0) {
        throw new Error("HWP/HWPX 파일 데이터가 비어 있습니다.");
      }
      if (message.data.byteLength > 50 * 1024 * 1024) {
        throw new Error("뷰어 파일 크기는 50 MiB 이하여야 합니다.");
      }
      const extension = message.fileName.split(".").pop()?.toLowerCase();
      if (extension !== "hwp" && extension !== "hwpx") {
        throw new Error("웹 뷰어는 HWP 또는 HWPX 파일을 지원합니다.");
      }
      await loadEngine();
      const document = new HwpDocument(new Uint8Array(message.data));
      const viewer = new HwpViewer(document);
      const pages = viewer.pageCount();
      if (!Number.isInteger(pages) || pages < 1) {
        viewer.free();
        document.free();
        throw new Error("문서에서 유효한 페이지를 확인하지 못했습니다.");
      }
      const firstSvg = viewer.renderPageSvg(0);
      if (typeof firstSvg !== "string" || !firstSvg.includes("<svg")) {
        viewer.free();
        document.free();
        throw new Error("첫 페이지 SVG 렌더링에 실패했습니다.");
      }
      activeDocument = document;
      activeViewer = viewer;
      activeFileName = message.fileName;
      self.postMessage({
        id: message.id,
        ok: true,
        session: activeSession,
        fileName: activeFileName,
        pageCount: pages,
        pageIndex: 0,
        svg: firstSvg,
      });
      return;
    }

    if (message.session !== activeSession) {
      throw new Error("뷰어 세션이 만료되었습니다. 문서를 다시 열어 주세요.");
    }

    if (message.kind === "render") {
      if (!activeViewer) throw new Error("먼저 HWP/HWPX 문서를 열어 주세요.");
      const pageCount = activeViewer.pageCount();
      if (!Number.isInteger(message.pageIndex) || message.pageIndex < 0 || message.pageIndex >= pageCount) {
        throw new Error("요청한 페이지 번호가 범위를 벗어났습니다.");
      }
      const svg = activeViewer.renderPageSvg(message.pageIndex);
      if (typeof svg !== "string" || !svg.includes("<svg")) {
        throw new Error("페이지 SVG 렌더링에 실패했습니다.");
      }
      self.postMessage({
        id: message.id,
        ok: true,
        session: activeSession,
        fileName: activeFileName,
        pageCount,
        pageIndex: message.pageIndex,
        svg,
      });
      return;
    }

    if (message.kind === "close") {
      releaseDocument();
      activeSession = 0;
      self.postMessage({ id: message.id, ok: true, closed: true });
    }
  } catch (error) {
    postError(message.id, error);
  }
});
