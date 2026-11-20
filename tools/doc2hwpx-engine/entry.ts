/**
 * Browser bridge for the pinned IeumOffice conversion engine.
 * Upstream revision: 18cfc7150a2028487a2ae669a324d02bae93570a
 */
type Block =
  | { kind: "p"; text: string }
  | { kind: "h"; level: number; text: string }
  | { kind: "table"; rows: string[][] };

type ConversionReply = {
  bytes: Uint8Array;
  losses: Array<{ feature: string; kind: "dropped" | "changed"; count: number }>;
  warnings: string[];
  pages?: number;
  verified: boolean;
  engine: string;
};

type Pending = {
  resolve: (value: ConversionReply) => void;
  reject: (reason: Error) => void;
};

declare global {
  interface Window {
    doc2hwpxIeumOffice?: {
      version: string;
      convertFile(fileName: string, input: ArrayBuffer | Uint8Array, blocks?: Block[]): Promise<ConversionReply>;
    };
  }
}

const worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
const pending = new Map<number, Pending>();
let sequence = 0;

worker.addEventListener("message", (event: MessageEvent) => {
  const data = event.data as {
    id: number;
    ok: boolean;
    bytes?: ArrayBuffer;
    losses?: ConversionReply["losses"];
    warnings?: string[];
    pages?: number;
    verified?: boolean;
    error?: string;
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

window.doc2hwpxIeumOffice = {
  version: "ieumoffice-18cfc715-multiformat",
  convertFile(fileName, input, blocks) {
    const bytes = input instanceof Uint8Array ? input.slice() : new Uint8Array(input.slice(0));
    const id = ++sequence;
    return new Promise<ConversionReply>((resolve, reject) => {
      pending.set(id, { resolve, reject });
      const payload: { id: number; fileName: string; data?: ArrayBuffer; blocks?: Block[] } = { id, fileName };
      if (bytes.byteLength) payload.data = bytes.buffer as ArrayBuffer;
      if (blocks?.length) payload.blocks = blocks;
      worker.postMessage(payload, payload.data ? [payload.data] : []);
    });
  },
};

window.dispatchEvent(new Event("doc2hwpx-ieum-ready"));
