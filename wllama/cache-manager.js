import { isSafari, isSafariMobile } from './utils.js';
;
/**
 * Cache implementation using OPFS (Origin private file system)
 */
export const CacheManager = {
    /**
     * Convert a given URL into file name in cache.
     *
     * Format of the file name: `${hashSHA1(fullURL)}_${fileName}`
     */
    async getNameFromURL(url) {
        return await toFileName(url);
    },
    /**
     * Write a new file to cache. This will overwrite existing file.
     *
     * @param name The file name returned by `getNameFromURL()` or `list()`
     */
    async write(name, stream) {
        return await opfsWrite(name, stream);
    },
    /**
     * Open a file in cache for reading
     *
     * @param name The file name returned by `getNameFromURL()` or `list()`
     * @returns ReadableStream, or null if file does not exist
     */
    async open(name) {
        return await opfsOpen(name);
    },
    /**
     * Get the size of a file in cache
     *
     * @param name The file name returned by `getNameFromURL()` or `list()`
     * @returns number of bytes, or -1 if file does not exist
     */
    async getSize(name) {
        return await opfsFileSize(name);
    },
    /**
     * List all files currently in cache
     */
    async list() {
        const cacheDir = await getCacheDir();
        const result = [];
        // @ts-ignore
        for await (let [name, handler] of cacheDir.entries()) {
            if (handler.kind === 'file') {
                result.push({
                    name,
                    size: await handler.getFile().then(f => f.size),
                });
            }
        }
        return result;
    },
    /**
     * Clear all files currently in cache
     */
    async clear() {
        await CacheManager.deleteMany(() => true);
    },
    /**
     * Delete a single file in cache
     *
     * @param nameOrURL Can be either an URL or a name returned by `getNameFromURL()` or `list()`
     */
    async delete(nameOrURL) {
        const name2 = await CacheManager.getNameFromURL(nameOrURL);
        await CacheManager.deleteMany((entry) => (entry.name === nameOrURL || entry.name === name2));
    },
    /**
     * Delete multiple files in cache.
     *
     * @param predicate A predicate like `array.filter(item => boolean)`
     */
    async deleteMany(predicate) {
        const cacheDir = await getCacheDir();
        const list = await CacheManager.list();
        for (const item of list) {
            if (predicate(item)) {
                cacheDir.removeEntry(item.name);
            }
        }
    },
};
/**
 * Write to OPFS file from ReadableStream
 */
async function opfsWrite(key, stream) {
    try {
        const cacheDir = await getCacheDir();
        const fileName = await toFileName(key);
        const writable = isSafari()
            ? await opfsWriteViaWorker(fileName)
            : await cacheDir.getFileHandle(fileName, { create: true }).then(h => h.createWritable());
        await writable.truncate(0); // clear file content
        const reader = stream.getReader();
        while (true) {
            const { done, value } = await reader.read();
            if (done)
                break;
            await writable.write(value);
        }
        await writable.close();
    }
    catch (e) {
        console.error('opfsWrite', e);
    }
}
/**
 * Opens a file in OPFS for reading
 * @returns ReadableStream
 */
async function opfsOpen(key) {
    try {
        const cacheDir = await getCacheDir();
        const fileName = await toFileName(key);
        const fileHandler = await cacheDir.getFileHandle(fileName);
        const file = await fileHandler.getFile();
        return file.stream();
    }
    catch (e) {
        // TODO: check if exception is NotFoundError
        return null;
    }
}
/**
 * Get file size of a file in OPFS
 * @returns number of bytes, or -1 if file does not exist
 */
async function opfsFileSize(key) {
    try {
        const cacheDir = await getCacheDir();
        const fileName = await toFileName(key);
        const fileHandler = await cacheDir.getFileHandle(fileName);
        const file = await fileHandler.getFile();
        return file.size;
    }
    catch (e) {
        // TODO: check if exception is NotFoundError
        return -1;
    }
}
async function toFileName(str) {
    const hashBuffer = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(str));
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return `${hashHex}_${str.split('/').pop()}`;
}
async function getCacheDir() {
    const opfsRoot = await navigator.storage.getDirectory();
    const cacheDir = await opfsRoot.getDirectoryHandle('cache', { create: true });
    return cacheDir;
}
/**
 * Because safari does not support createWritable(), we need to use createSyncAccessHandle() which requires to be run from a web worker.
 * See: https://bugs.webkit.org/show_bug.cgi?id=231706
 */
const WORKER_CODE = `
const msg = (data) => postMessage(data);
let accessHandle;

onmessage = async (e) => {
  try {
    if (!e.data) return;
    const {
      open,  // name of file to open
      value, // value to be written
      done,  // indicates when to close the file
    } = e.data;

    if (open) {
      const opfsRoot = await navigator.storage.getDirectory();
      const cacheDir = await opfsRoot.getDirectoryHandle('cache', { create: true });
      const fileHandler = await cacheDir.getFileHandle(open, { create: true });
      accessHandle = await fileHandler.createSyncAccessHandle();
      accessHandle.truncate(0); // clear file content
      return msg({ ok: true });

    } else if (value) {
      accessHandle.write(value);
      return msg({ ok: true });

    } else if (done) {
      accessHandle.flush();
      accessHandle.close();
      return msg({ ok: true });
    }

    throw new Error('OPFS Worker: Invalid state');
  } catch (err) {
    return msg({ err });
  }
};
`;
async function opfsWriteViaWorker(fileName) {
    const workerURL = window.URL.createObjectURL(new Blob([WORKER_CODE], { type: 'text/javascript' }));
    const worker = new Worker(workerURL);
    let pResolve;
    let pReject;
    worker.onmessage = (e) => {
        if (e.data.ok)
            pResolve(null);
        else if (e.data.err)
            pReject(e.data.err);
    };
    const workerExec = (data) => new Promise((resolve, reject) => {
        pResolve = resolve;
        pReject = reject;
        // TODO @ngxson : Safari mobile doesn't support transferable ArrayBuffer
        worker.postMessage(data, isSafariMobile() ? undefined : {
            transfer: data.value ? [data.value.buffer] : [],
        });
    });
    await workerExec({ open: fileName });
    return {
        truncate: async () => { },
        write: (value) => workerExec({ value }),
        close: async () => {
            await workerExec({ done: true });
            worker.terminate();
        },
    };
}
;
//# sourceMappingURL=cache-manager.js.map