// Adapted from https://github.com/huggingface/huggingface.js/blob/main/packages/hub/src/utils/WebBlob.ts
import { CacheManager } from '../cache-manager.js';
export class GGUFRemoteBlob extends Blob {
    static async create(url, opts) {
        const customFetch = opts?.fetch ?? fetch;
        
        const cacheKey = url.toString();
        const cacheFileSize = await CacheManager.getSize(cacheKey);
        const skipCache = opts?.useCache === false;
		
		let size = 0;
		let contentType = '';
		let supportRange = false;
		if(window.internet === false && cacheFileSize){
			size = cacheFileSize;
		}
		else{
			const response = await customFetch(url, { method: 'HEAD' });
	        size = Number(response.headers.get('content-length'));
	        contentType = response.headers.get('content-type') || '';
	        supportRange = response.headers.get('accept-ranges') === 'bytes';
		}
		
        if (size !== 0 && size === cacheFileSize && !skipCache) {
            opts?.logger?.debug(`Using cached file ${cacheKey}`);
            const cachedFile = await CacheManager.open(cacheKey);
            (opts?.startSignal ?? Promise.resolve()).then(() => {
                opts?.progressCallback?.({
                    loaded: cacheFileSize,
                    total: cacheFileSize,
                });
            });
            return new GGUFRemoteBlob(url, 0, cacheFileSize, '', true, customFetch, {
                cachedStream: cachedFile,
                progressCallback: () => { }, // unused
            });
        }
        else {
            if (cacheFileSize > 0) {
                opts?.logger?.debug(`Cache file is present, but size mismatch (cache = ${cacheFileSize} bytes, real = ${size} bytes)`);
            }
            opts?.logger?.debug(`NOT using cache for ${cacheKey}`);
            return new GGUFRemoteBlob(url, 0, size, contentType, true, customFetch, {
                progressCallback: opts?.progressCallback ?? (() => { }),
                startSignal: opts?.startSignal,
            });
        }
    }
    url;
    start;
    end;
    contentType;
    full;
    fetch;
    cachedStream;
    progressCallback;
    startSignal;
    constructor(url, start, end, contentType, full, customFetch, additionals) {
        super([]);
        this.url = url;
        this.start = start;
        this.end = end;
        this.contentType = contentType;
        this.full = full;
        this.fetch = customFetch;
        this.cachedStream = additionals.cachedStream;
        this.progressCallback = additionals.progressCallback;
        this.startSignal = additionals.startSignal;
    }
    get size() {
        return this.end - this.start;
    }
    get type() {
        return this.contentType;
    }
    slice() {
        throw new Error('Unsupported operation');
    }
    async arrayBuffer() {
        throw new Error('Unsupported operation');
    }
    async text() {
        throw new Error('Unsupported operation');
    }
    stream() {
        if (this.cachedStream) {
            return this.cachedStream;
        }
        const self = this;
        let loaded = 0;
        const stream = new TransformStream({
            transform(chunk, controller) {
                controller.enqueue(chunk);
                loaded += chunk.byteLength;
                self.progressCallback({
                    loaded,
                    total: self.size,
                });
            },
            flush(controller) {
                self.progressCallback({
                    loaded: self.size,
                    total: self.size,
                });
            },
        });
        (async () => {
            if (this.startSignal) {
                await this.startSignal;
            }
            this.fetchRange()
                .then((response) => {
                const [src0, src1] = response.body.tee();
                src0.pipeThrough(stream);
                CacheManager.write(this.url.toString(), src1);
            })
                .catch((error) => stream.writable.abort(error.message));
        })();
        return stream.readable;
    }
    fetchRange() {
        const fetch = this.fetch; // to avoid this.fetch() which is bound to the instance instead of globalThis
        if (this.full) {
            return fetch(this.url);
        }
        return fetch(this.url, {
            headers: {
                Range: `bytes=${this.start}-${this.end - 1}`,
            },
        });
    }
}
//# sourceMappingURL=remote-blob.js.map