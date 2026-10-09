export interface WorkerLike {
  onmessage: ((event: MessageEvent) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  postMessage(message: unknown): void;
  terminate(): void;
}
export class JobRunner {
  private stop?: () => void;
  constructor(private factory: () => WorkerLike, private timeout = 30_000) {}
  cancel() { this.stop?.(); }
  run<T>(message: unknown, progress: (stage: string) => void): Promise<T> {
    this.cancel();
    return new Promise<T>((resolve,reject)=> {
      const worker=this.factory(); let ended=false;
      const finish=(error?: Error, result?: T)=> { if(ended)return; ended=true; clearTimeout(timer); worker.onmessage=null;worker.onerror=null;worker.terminate(); if(this.stop===cancel)this.stop=undefined; if(error)reject(error); else resolve(result as T); };
      const cancel=()=>finish(new DOMException('Cancelled. Your original file is unchanged.','AbortError'));
      const timer=setTimeout(()=>finish(new Error('Processing timed out. Try a smaller image.')),this.timeout);
      this.stop=cancel;
      worker.onmessage=(e: MessageEvent<{kind:string;stage:string;error:string;result:T}>)=> {
        if(e.data.kind==='progress') progress(e.data.stage);
        else if(e.data.kind==='done') finish(undefined,e.data.result);
        else if(e.data.kind==='error') finish(new Error(e.data.error));
        else finish(new Error('The image worker returned an invalid response.'));
      };
      worker.onerror=()=>finish(new Error('The image worker stopped unexpectedly. Try a smaller file.'));
      try { worker.postMessage(message); } catch { finish(new Error('Unable to start this image job.')); }
    });
  }
}
export class ObjectUrlSlot {
  value = '';
  constructor(private api = URL) {}
  set(blob: Blob) { this.clear(); this.value = this.api.createObjectURL(blob); return this.value; }
  clear() { if(this.value) this.api.revokeObjectURL(this.value); this.value=''; }
}
