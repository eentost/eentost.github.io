/**
 * Worker bridges for the IeumOffice conversion engine and native HWP/HWPX viewer.
 * Upstream revision: 18cfc7150a2028487a2ae669a324d02bae93570a
 */
type ConversionReply = {
  bytes: Uint8Array;
  losses: Array<{ feature: string; kind: "dropped" | "changed"; count: number }>;
  warnings: string[];
  pages?: number;
  verified: boolean;
  engine: string;
};

type Pending<T> = {
  resolve: (value: T) => void;
  reject: (reason: Error) => void;
};

type ViewerReply = {
  session: number;
  fileName: string;
  pageCount: number;
  pageIndex: number;
  svg: string;
};

declare global {
  interface Window {
    doc2hwpxIeumOffice?: {
      version: string;
      convertFile(fileName: string, input: ArrayBuffer | Uint8Array): Promise<ConversionReply>;
      openViewer(fileName: string, input: ArrayBuffer | Uint8Array): Promise<ViewerReply>;
      renderViewerPage(session: number, pageIndex: number): Promise<ViewerReply>;
      closeViewer(session: number): Promise<void>;
    };
  }
}

const worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
const viewerWorker = new Worker(new URL("./viewer-worker.ts", import.meta.url), { type: "module" });
const pending = new Map<number, Pending<ConversionReply>>();
const viewerPending = new Map<number, Pending<ViewerReply | { closed: boolean }>>();
let sequence = 0;
let viewerSequence = 0;
let viewerSessionSequence = 0;

worker.addEventListener("message", (event: MessageEvent) => {
  const data = event.data as {
    id: number; ok: boolean; bytes?: ArrayBuffer; losses?: ConversionReply["losses"];
    warnings?: string[]; pages?: number; verified?: boolean; error?: string;
  };
  const task = pending.get(data.id);
  if (!task) return;
  pending.delete(data.id);
  if (!data.ok || !data.bytes) {
    task.reject(new Error(data.error || "문서 변환 엔진에서 오류가 발생했습니다."));
    return;
  }
  task.resolve({
    bytes: new Uint8Array(data.bytes),
    losses: data.losses || [],
    warnings: data.warnings || [],
    pages: data.pages,
    verified: data.verified === true,
    engine: "IeumOffice docx2hwp + rhwp WebAssembly",
  });
});

worker.addEventListener("error", (event) => {
  const error = new Error(event.message || "문서 변환 Worker가 중단되었습니다.");
  for (const task of pending.values()) task.reject(error);
  pending.clear();
});

viewerWorker.addEventListener("message", (event: MessageEvent) => {
  const data = event.data as {
    id: number; ok: boolean; session?: number; fileName?: string; pageCount?: number;
    pageIndex?: number; svg?: string; closed?: boolean; error?: string;
  };
  const task = viewerPending.get(data.id);
  if (!task) return;
  viewerPending.delete(data.id);
  if (!data.ok) {
    task.reject(new Error(data.error || "HWP/HWPX 뷰어에서 오류가 발생했습니다."));
    return;
  }
  if (data.closed) {
    task.resolve({ closed: true });
    return;
  }
  if (typeof data.session !== "number" || typeof data.pageCount !== "number" || typeof data.svg !== "string") {
    task.reject(new Error("HWP 뷰어에서 올바르지 않은 응답을 받았습니다."));
    return;
  }
  task.resolve({
    session: data.session,
    fileName: data.fileName || "",
    pageCount: data.pageCount,
    pageIndex: data.pageIndex || 0,
    svg: data.svg,
  });
});

viewerWorker.addEventListener("error", (event) => {
  const error = new Error(event.message || "HWP/HWPX 뷰어 Worker가 중단되었습니다.");
  for (const task of viewerPending.values()) task.reject(error);
  viewerPending.clear();
});

function viewerRequest<T extends ViewerReply | { closed: boolean }>(
  payload: Record<string, unknown>,
  transfer: Transferable[] = [],
): Promise<T> {
  const id = ++viewerSequence;
  return new Promise<T>((resolve, reject) => {
    viewerPending.set(id, { resolve: resolve as (value: ViewerReply | { closed: boolean }) => void, reject });
    viewerWorker.postMessage({ ...payload, id }, transfer);
  });
}

window.doc2hwpxIeumOffice = {
  version: "ieumoffice-18cfc715-hwp-pdf-docx-viewer",
  convertFile(fileName, input) {
    const bytes = input instanceof Uint8Array ? input.slice() : new Uint8Array(input.slice(0));
    const id = ++sequence;
    return new Promise<ConversionReply>((resolve, reject) => {
      pending.set(id, { resolve, reject });
      const buffer = bytes.buffer as ArrayBuffer;
      worker.postMessage({ id, fileName, data: buffer }, [buffer]);
    });
  },
  async openViewer(fileName, input) {
    const bytes = input instanceof Uint8Array ? input.slice() : new Uint8Array(input.slice(0));
    const session = ++viewerSessionSequence;
    const buffer = bytes.buffer as ArrayBuffer;
    const reply = await viewerRequest<ViewerReply>(
      { kind: "open", session, fileName, data: buffer },
      [buffer],
    );
    return reply;
  },
  renderViewerPage(session, pageIndex) {
    return viewerRequest<ViewerReply>({ kind: "render", session, pageIndex });
  },
  async closeViewer(session) {
    await viewerRequest<{ closed: boolean }>({ kind: "close", session });
  },
};

window.dispatchEvent(new Event("doc2hwpx-ieum-ready"));
