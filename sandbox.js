;
const DEFAULT_API_HANDLERS = {
    setName: () => { },
    start: (runningTime) => {
        console.info(`Sandbox.main code ran in ${runningTime}ms.`);
    }
};
const DEFAULT_SANDBOX_API = () => {
    const worker = self;
    const sandbox = self.$;
    sandbox.setName = ({ name }, taskId) => {
        sandbox.name = name;
        worker.postMessage({ action: 'setName', payload: name, taskId });
    };
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
            throw new Error(`Function main() is undefined in the ${self.name} Worker namespace.`);
        }
    };
    worker.onmessage = (message) => {
        const { taskId, action, payload = null } = message.data;
        if (sandbox[action]) {
            sandbox[action](payload, taskId);
        }
        else {
            throw new Error(`Function ${action} is undefined in the ${self.name} Worker namespace.`);
        }
    };
    Object.defineProperty(self, "setName", { configurable: false, writable: false });
    Object.defineProperty(self, "start", { configurable: false, writable: false });
    Object.defineProperty(self, "onmessage", { configurable: false, writable: false });
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
                console.warn(`${this.name} was already started and is running.`);
                return;
            }
            this.thread = new Worker(this.blobURL);
            if (this.debug) {
                this.log(`SANDBOX CREATED.`);
            }
            this.thread.onmessage = (message) => {
                const { taskId, action, payload = null } = message.data;
                if (this.debug) {
                    this.log(`TASK FINISHED: ${JSON.stringify(message.data)} `);
                }
                if (this.handlers.hasOwnProperty(action)) {
                    if (!taskId) {
                        console.info(`No taskId for current message. (method: ${action}) - probably called from sandbox code.`);
                        this.handlers[action](payload);
                        return;
                    }
                    const task = this.runningTasks.get(taskId);
                    if (!task) {
                        console.warn(`Task #${taskId} not found. (method: ${action})`);
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
                    console.warn(`Unrecognized action '${action} finished from ${this.name}`, message.data);
                }
            };
            this.thread.onerror = (e) => {
            };
            await this.call('setName', { name: this.name });
            await this.call('start');
        };
        this.call = async (action, payload, callback) => {
            if (!this.thread) {
                console.error(`${this.name} is not started yet. Call <SandboxObject>.start() first.`);
                return Promise.reject(`${this.name} is not started yet. Call <SandboxObject>.start() first.`);
            }
            if (this.markedForTermination) {
                console.warn(`${this.name} is marked for termination and cannot post new messages. Waiting until all tasks finish and terminating Sandbox ...`);
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
                this.log(`TASK STARTED: ${JSON.stringify({ action, payload, taskId })}`);
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
                console.warn(`${this.name} terminated forcefully. ${taskCount} tasks were abandoned.`);
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
            `self.$={};\n`,
            `(${DEFAULT_SANDBOX_API.toString()})();\n`,
            `(${(api.public || {}).toString()})($);\n`,
            `$.main=async()=>{${code.toString()}};`,
        ]);
        this.handlers = Object.assign(DEFAULT_API_HANDLERS, api.handlers || {});
        this.onTaskCountChange = onTaskCountChange;
    }
    log(message) {
        if (this.debug) {
            this.debug(message);
        }
    }
}
function createBlobURL(blobParts) {
    return URL.createObjectURL(new Blob(blobParts));
}
function getRandomId() {
    return Math.random().toString(36).substr(2, 9);
}
;
export default Sandbox;
//# sourceMappingURL=sandbox.js.map