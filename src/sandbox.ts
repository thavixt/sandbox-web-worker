interface SandboxArguments {
    name: string,
    code?: string,
    api?: {
        public: (scope: SandboxScope, signalResult: SignalApiResponse) => void | Promise<void>,
        handlers: {
            [key: string]: (result: any) => any,
        },
    },
    onTaskCountChange?: TaskCountChangeCallback,
    onStart?: () => void,
    onTermination?: () => void,
    autoTerminateAfterMs?: number,
    logger?: LoggerFunction,
}
export interface SandboxScope {
    main: () => Promise<void>;
    [key: string]: (payload: any, taskId: string) => void | Promise<void>;
};

interface Task<T = any> {
    _promiseObj: Promise<T>,
    promise: {
        resolve: (value: T) => Promise<void>,
        reject: (reason: unknown) => Promise<void>,
    },
    callback?: (result: T) => void,
}

export interface TaskParams {
    action: string,
    payload?: any,
    taskId?: string
}

export interface WorkerScope extends WindowOrWorkerGlobalScope {
    $: SandboxScope;
    onmessage: (message: { data: TaskParams }) => void;
    postMessage(message: TaskParams): void;
}

type LoggerFunction = (timestamp: number, sandboxName: string, message: string, task?: TaskParams, result?: unknown) => void;

export type SignalApiResponse = ({ action, payload, taskId }: TaskParams) => void;

type TaskCountChangeCallback = (count: number) => void;

const DEFAULT_SANDBOX_API = (name: string) => {
    const worker: WorkerScope = self as any;
    const sandbox: SandboxScope = (self as unknown as WorkerScope).$;

    sandbox.start = async (payload, taskId) => {
        if (sandbox.main) {
            const startTime = Date.now();
            await sandbox.main();
            worker.postMessage({
                action: 'start',
                payload: Date.now() - startTime,
                taskId,
            });
        } else {
            throw new Error(`Function 'main' is undefined in the ${name} Sandbox namespace.`);
        }
    };
    worker.onmessage = (message) => {
        const { taskId, action, payload = null } = message.data;
        if (sandbox[action]) {
            sandbox[action](payload, taskId);
        } else {
            throw new Error(`Function '${action}' is undefined in the ${name} Sandbox namespace.`)
        }
    };

    Object.defineProperty(worker, "onmessage", { configurable: false, writable: false });
    Object.defineProperty(worker, "postMessage", { configurable: false, writable: false });
};

const FREEZE_API = ($scope: SandboxScope) => {
    Object.keys($scope)
        .filter(key => key !== 'main')
        .forEach(key => {
            Object.defineProperty($scope, key, {
                configurable: false,
                writable: false,
            });
        });
}

class Sandbox {
    autoTerminateAfterMs: number | null = null;
    autoTerminationTimerId: number | null = null;
    blobURL: string;
    logger?: LoggerFunction;
    handlers: {
        [key: string]: (...args: any[]) => any,
    }
    markedForTermination = false;
    name: string = 'Sandbox' + getRandomId();
    runningTasks = new Map<string, Task>();
    thread: Worker | null = null;
    onTaskCountChange: TaskCountChangeCallback | null = null;
    onStart: () => void | null = null;
    onTermination: () => void | null = null;

    constructor({
        name,
        code = '',
        api = { public: () => { }, handlers: {} },
        onTaskCountChange = () => {},
        onStart = () => {},
        onTermination = () => {},
        autoTerminateAfterMs = -1,
        logger = console.log
    }: SandboxArguments) {
        if (typeof name === 'undefined') {
            console.error(`Property 'name' is undefined`);
        }

        this.logger = logger;
        this.autoTerminateAfterMs = autoTerminateAfterMs;
        this.name = `Sandbox#${name}`
        this.blobURL = createBlobURL([
            `'use strict';\n`,
            minify(`self.$={};`),
            minify(`(${DEFAULT_SANDBOX_API.toString()})('${this.name}');`),
            minify(`(${(api.public || {}).toString()})($, self.postMessage);`),
            minify(`(${FREEZE_API})(self.$);`),
            `$.main=async()=>{{${code.toString()}}Object.freeze(self.$);};`,
        ]);
        this.handlers = Object.assign({
            start: (runningTime: number) => {
                this.log(`User code IIFE finished in ${runningTime}ms.`);
            }
        }, api.handlers || {});
        this.onTaskCountChange = onTaskCountChange;
        this.onStart = onStart;
        this.onTermination = onTermination;
    }

    public start = async () => {
        if (this.thread) {
            console.warn(`${this.name} is already started and is running.`);
            return;
        }

        this.thread = new Worker(this.blobURL);

        this.onStart();
        this.log(`SANDBOX STARTED`);

        this.thread.onmessage = (message) => {
            const { taskId, action, payload } = message.data;

            this.log(`TASK FINISHED: '${action}'`, message.data);

            if (this.handlers.hasOwnProperty(action)) {
                if (!taskId) {
                    // this.log(`No taskId for current message. (method: ${action}) - probably called from sandbox code.`);
                    this.handlers[action](payload);
                    return;
                }

                const task = this.runningTasks.get(taskId);
                if (!task) {
                    this.log(`Task #${taskId} not found. (method: ${action})`);
                } else {
                    task.promise.resolve(payload);
                    if (task.callback) {
                        task.callback(payload);
                    }
                    this.runningTasks.delete(taskId);
                    this.onTaskCountChange(this.runningTasks.size);
                }

                this.handlers[action](payload);

                if (this.autoTerminateAfterMs > 0 && this.thread) {
                    clearInterval(this.autoTerminationTimerId);
                    this.autoTerminationTimerId = setTimeout(() => {
                        if (this.thread) {
                            this.log(`Terminating sandbox after ${this.autoTerminateAfterMs}ms of inactivity.`);
                            this.terminate();
                        }
                    }, this.autoTerminateAfterMs);
                }
            } else {
                this.log(`Unrecognized action '${action} finished from ${this.name}`, message.data);
            }
        }

        this.thread.onerror = (e) => {
            this.log(`Sandbox error (${this.name})`);
            throw e;
        }

        await this.call('start');
    }

    public call = async (action: string, payload?: any, callback?: (...args: any[]) => void) => {
        if (!this.thread) {
            console.error(`${this.name} is not started yet. Call <SandboxObject>.start() first.`);

            return Promise.reject(`${this.name} is not started yet. Call <SandboxObject>.start() first.`);
        }

        if (this.markedForTermination) {
            this.log(`${this.name} is marked for termination and cannot post new messages. Waiting until all tasks finish and terminating Sandbox ...`);
        }

        if (this.autoTerminationTimerId) {
            clearInterval(this.autoTerminationTimerId);
            this.autoTerminationTimerId = null;
        }

        const taskId = getRandomId();

        let resolveFn;
        let rejectFn;
        const promise = new Promise<unknown>((resolve, reject) => {
            resolveFn = resolve;
            rejectFn = reject;
        });
        this.runningTasks.set(taskId, {
            _promiseObj: promise,
            promise: { resolve: resolveFn, reject: rejectFn },
            callback,
        });

        this.log(`TASK STARTED: '${action}'`, { action, payload, taskId });

        this.thread.postMessage({ action, payload, taskId });
        this.onTaskCountChange(this.runningTasks.size);

        return promise;
    }

    public terminate = async (waitForTasksToFinish = true) => {
        if (!this.thread) {
            console.warn(`${this.name} has not been started yet and thus cannot be terminated.`);
            return;
        }

        const taskCount = this.runningTasks.size;
        if (taskCount > 0 && waitForTasksToFinish) {
            this.markedForTermination = true;

            if (!this.autoTerminateAfterMs) {
                console.warn(`${this.name} has ${taskCount} active tasks remaining and cannot be terminated. Waiting until all tasks finish...\n\nCall <SandboxObject>.terminate(false) to skip waiting for running tasks to finish.\nSettings the 'autoTerminateAfterMs' argument will always wait until there are no running tasks before automatically terminating the Sandbox.`);
                this.log(`SANDBOX TERMINATION - WAITING FOR ${taskCount} RUNNING TASKS TO FINISH ...`);
            }

            const runningTasks = Array.from(this.runningTasks.values(), (task) => task._promiseObj);
            await Promise.all(runningTasks)
        }

        this.thread.terminate();
        this.thread = null;
        this.markedForTermination = false;

        if (!waitForTasksToFinish) {
            this.log(`${this.name} manually terminated. Number of tasks abandoned: ${taskCount}.`);
        }

        this.log(`SANDBOX TERMINATED`);
        this.onTermination();

        return;
    }

    private log(message: string, task?: TaskParams) {
        this.logger((new Date()).getTime(), this.name, message, task);
    }
}

function createBlobURL(blobParts: string[]) {
    return URL.createObjectURL(new Blob(blobParts));
}

function minify(text: string) {
    return text.replace(/  /g, '').replace(/(\r\n|\n|\r)/gm, '');
}

function getRandomId() {
    return Math.random().toString(36).substr(2, 9);
};

export default Sandbox;
