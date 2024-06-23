type ProgressCallback = (opts: {
    loaded: number;
    total: number;
}) => any;
interface Task {
    url: string;
    state: State;
    signalStart: Promise<void>;
    fireStart(): void;
    signalEnd: Promise<void>;
    fireEnd(): void;
    blob: Blob;
    loaded: number;
}
declare enum State {
    READY = 0,
    WORKING = 1,
    FINISHED = 2
}
export declare class MultiDownloads {
    private tasks;
    private maxParallel;
    private progressCallback?;
    private logger;
    private useCache;
    private totalBytes;
    constructor(logger: any, urls: string[], maxParallel: number, opts: {
        progressCallback?: ProgressCallback;
        useCache: boolean;
    });
    run(): Promise<Blob[]>;
    updateProgress(task: Task): void;
    dispatcher(): Promise<void>;
}
export {};
