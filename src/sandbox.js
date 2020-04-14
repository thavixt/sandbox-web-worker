;
const DEFAULT_SANDBOX_API = (name) => {
    const worker = self;
    const sandbox = self.$;
    sandbox.start = async (payload, taskId) => {
        if (sandbox.main) {
            const startTime = Date.now();
            await sandbox.main();
            worker.postMessage({
                action: 'start',
                payload: Date.now() - startTime,
                taskId,
            });
        }
        else {
            throw new Error(`Function 'main' is undefined in the ${name} Sandbox namespace.`);
        }
    };
    worker.onmessage = (message) => {
        const { taskId, action, payload = null } = message.data;
        if (sandbox[action]) {
            sandbox[action](payload, taskId);
        }
        else {
            throw new Error(`Function '${action}' is undefined in the ${name} Sandbox namespace.`);
        }
    };
    Object.defineProperty(worker, "onmessage", { configurable: false, writable: false });
    Object.defineProperty(worker, "postMessage", { configurable: false, writable: false });
};
const FREEZE_API = ($scope) => {
    Object.keys($scope)
        .filter(key => key !== 'main')
        .forEach(key => {
        Object.defineProperty($scope, key, {
            configurable: false,
            writable: false,
        });
    });
};
class Sandbox {
    constructor({ name, code = '', api = { public: () => { }, handlers: {} }, onTaskCountChange = function () { }, autoTerminateAfterMs = -1, debug = null }) {
        this.autoTerminateAfterMs = null;
        this.autoTerminationTimerId = null;
        this.debug = null;
        this.markedForTermination = false;
        this.name = 'Sandbox' + getRandomId();
        this.runningTasks = new Map();
        this.thread = null;
        this.onTaskCountChange = null;
        this.start = async () => {
            if (this.thread) {
                console.warn(`${this.name} is already started and is running.`);
                return;
            }
            this.thread = new Worker(this.blobURL);
            if (this.debug) {
                this.log(`SANDBOX CREATED.`);
            }
            this.thread.onmessage = (message) => {
                const { taskId, action, payload = null } = message.data;
                if (this.debug) {
                    this.log(`TASK FINISHED: '${action}'`, message.data);
                }
                if (this.handlers.hasOwnProperty(action)) {
                    if (!taskId) {
                        this.log(`No taskId for current message. (method: ${action}) - probably called from sandbox code.`);
                        this.handlers[action](payload);
                        return;
                    }
                    const task = this.runningTasks.get(taskId);
                    if (!task) {
                        this.log(`Task #${taskId} not found. (method: ${action})`);
                    }
                    else {
                        task.promise.resolve(payload);
                        if (task.callback) {
                            task.callback(payload);
                        }
                        this.runningTasks.delete(taskId);
                        this.onTaskCountChange(this.runningTasks.size);
                    }
                    this.handlers[action](payload);
                    if (this.autoTerminateAfterMs >= 0 && this.thread) {
                        clearInterval(this.autoTerminationTimerId);
                        this.autoTerminationTimerId = setTimeout(() => {
                            if (this.thread) {
                                this.terminate();
                            }
                        }, this.autoTerminateAfterMs);
                    }
                }
                else {
                    this.log(`Unrecognized action '${action} finished from ${this.name}`, message.data);
                }
            };
            this.thread.onerror = (e) => {
                this.log(`Sandbox error (${this.name})`);
                throw e;
            };
            await this.call('start');
        };
        this.call = async (action, payload, callback) => {
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
            const promise = new Promise((resolve, reject) => {
                resolveFn = resolve;
                rejectFn = reject;
            });
            this.runningTasks.set(taskId, {
                _promiseObj: promise,
                promise: { resolve: resolveFn, reject: rejectFn },
                callback,
            });
            if (this.debug) {
                this.log(`TASK STARTED: '${action}'`, { action, payload, taskId });
            }
            this.thread.postMessage({ action, payload, taskId });
            this.onTaskCountChange(this.runningTasks.size);
            return promise;
        };
        this.terminate = async (waitForTasksToFinish = true) => {
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
                await Promise.all(runningTasks);
            }
            this.thread.terminate();
            this.thread = null;
            this.markedForTermination = false;
            if (!waitForTasksToFinish) {
                this.log(`${this.name} terminated forcefully. ${taskCount} tasks were abandoned.`);
            }
            if (this.debug) {
                this.log(`SANDBOX TERMINATED.`);
            }
            return;
        };
        if (typeof name === 'undefined') {
            console.error(`Property 'name' is undefined`);
        }
        this.debug = debug;
        this.autoTerminateAfterMs = autoTerminateAfterMs;
        this.name = `Sandbox#${name}`;
        this.blobURL = createBlobURL([
            `'use strict';\n`,
            minify(`self.$={};`),
            minify(`(${DEFAULT_SANDBOX_API.toString()})('${this.name}');`),
            minify(`(${(api.public || {}).toString()})($, self.postMessage);`),
            minify(`(${FREEZE_API})(self.$);`),
            `$.main=async()=>{{${code.toString()}}Object.freeze(self.$);};`,
        ]);
        this.handlers = Object.assign({
            start: (runningTime) => {
                this.log(`User code IIFE finished in ${runningTime}ms.`);
            }
        }, api.handlers || {});
        this.onTaskCountChange = onTaskCountChange;
    }
    log(message, task) {
        if (this.debug) {
            this.debug((new Date()).getTime(), this.name, message, task);
        }
    }
}
function createBlobURL(blobParts) {
    return URL.createObjectURL(new Blob(blobParts));
}
function minify(text) {
    return text.replace(/  /g, '').replace(/(\r\n|\n|\r)/gm, '');
}
function getRandomId() {
    return Math.random().toString(36).substr(2, 9);
}
;
export default Sandbox;
//# sourceMappingURL=sandbox.js.map