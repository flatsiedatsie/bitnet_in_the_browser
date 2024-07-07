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
     * Convert a given URL into file name in cache.
     *
     * Format of the file name: `${hashSHA1(fullURL)}_${fileName}`
     */
    getNameFromURL(url: string): Promise<string>;
    /**
     * Write a new file to cache. This will overwrite existing file.
     *
     * @param name The file name returned by `getNameFromURL()` or `list()`
     */
    write(name: string, stream: ReadableStream): Promise<void>;
    /**
     * Open a file in cache for reading
     *
     * @param name The file name returned by `getNameFromURL()` or `list()`
     * @returns ReadableStream, or null if file does not exist
     */
    open(name: string): Promise<ReadableStream | null>;
    /**
     * Get the size of a file in cache
     *
     * @param name The file name returned by `getNameFromURL()` or `list()`
     * @returns number of bytes, or -1 if file does not exist
     */
    getSize(name: string): Promise<number>;
    /**
     * List all files currently in cache
     */
    list(): Promise<CacheEntry[]>;
    /**
     * Clear all files currently in cache
     */
    clear(): Promise<void>;
    /**
     * Delete a single file in cache
     *
     * @param nameOrURL Can be either an URL or a name returned by `getNameFromURL()` or `list()`
     */
    delete(nameOrURL: string): Promise<void>;
    /**
     * Delete multiple files in cache.
     *
     * @param predicate A predicate like `array.filter(item => boolean)`
     */
    deleteMany(predicate: (e: CacheEntry) => boolean): Promise<void>;
};
