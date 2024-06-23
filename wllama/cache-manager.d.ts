export interface CacheEntry {
    /**
     * File name in OPFS, in the format: `${hashSHA1(fullURL)}_${fileName}`
     */
    name: string;
    /**
     * Size of file (in bytes)
     */
    size: number;
}
/**
 * Cache implementation using OPFS (Origin private file system)
 */
export declare const CacheManager: {
    /**
     * Write a new file to cache. This will overwrite existing file.
     */
    write(key: string, stream: ReadableStream): Promise<void>;
    /**
     * Open a file in cache for reading
     * @returns ReadableStream, or null if file does not exist
     */
    open(key: string): Promise<ReadableStream | null>;
    /**
     * Get the size of a file in cache
     * @returns number of bytes, or -1 if file does not exist
     */
    getSize(key: string): Promise<number>;
    /**
     * List all files currently in cache
     */
    list(): Promise<CacheEntry[]>;
    /**
     * Clear all files currently in cache
     */
    clear(): Promise<void>;
};
