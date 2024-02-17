import Sandbox, { TaskParams } from '../src/sandbox.js';
import { SANDBOX_API, SANDBOX_API_RESPONSE_HANDLERS } from './api.js';

(async () => {
    // Get arbitrary user code from external source
    const userCodeText = await fetch('./userCode.js').then(js => js.text());

    // Used for logging the current task count to the DOM
    const taskCounter = document.getElementById('taskCounter');
    const activityIndicator = document.getElementById('activity');
    // Set up a custom logger function
    const logElement = document.getElementById('log');
    const myLogger = (time: number, sandbox: string, msg: string, task?: TaskParams) => {
        const isFinished = msg.match('TASK START') ? true : false;
        const p = document.createElement('p');
        const cls = isFinished ? 'started' : task?.taskId ? 'finished' : 'userCode';

        if (cls) {
            p.classList.add(cls);
        }

        const date = new Date(time);
        const isoString = date.toISOString();

        if (task?.taskId && task?.payload) {
            if (task.payload.result) {
                p.textContent = `${isoString} ${sandbox} (${task.taskId}) | ${msg} - ${JSON.stringify(task.payload.result)}}`;
            } else {
                p.textContent = `${isoString} ${sandbox} (${task.taskId}) | ${msg} - ${JSON.stringify(task.payload)}}`;
            }
        } else {
            p.textContent = `${isoString} ${sandbox} | ${msg}${task ? ` - ${JSON.stringify(task)}` : ''}`;
        }
        logElement.appendChild(p);
        logElement.scrollTop = logElement.scrollHeight;
    };

    // Create a new Sandbox Worker thread
    const sb = new Sandbox({
        name: 'DemoSandbox',
        api: {
            public: SANDBOX_API,
            handlers: SANDBOX_API_RESPONSE_HANDLERS,
        },
        code: userCodeText,
        onTaskCountChange: (taskCount) => taskCounter.textContent = taskCount.toString(),
        onStart: () => activityIndicator.textContent = 'true',
        onTermination: () => activityIndicator.textContent = 'false',
        autoTerminateAfterMs: 5000,
        logger: myLogger, // could also use the native console.log
    });

    // Wait for thread creation, API setup etc
    // This will also wait until all function calls in the user provided code has run
    await sb.start();

    /* 
     * Demo 1
     *
     * Simulate user interaction with some function calls
     * These will resolve aftera a random time emulating an async task
     */
    // for (let i = 0; i < 20; i++) {
    //     const delay = Math.round(Math.random() * 5000);
    //     setTimeout(async () => {
    //         const result = await sb.call('addNumbersDelayed', [1, i]);
    //         console.log('await addNumbersDelayed', result);
    //     }, delay);
    // }

    /*
     * Demo 2
     * Stress test
     */
    // for (let i = 1; i < 1000; i++) {
    //     const delay = Math.random() * 5_000;
    //     setTimeout(async () => {
    //         sb.call('addNumbersDelayed', [Math.random() * 1234, Math.random() * 1234, i ,i * 123]);
    //         sb.call('multiplyNumbersDelayed', [Math.random() * 1234, Math.random() * 1234, i + 1, (i + 1) * 123]);
    //     }, delay);
    // }

    /*
     * Demo 3
     * Calculate digits of PI
     */
    // (async function() {
    //     await sb.call('getDigitsOfPi', [10]);
    //     await sb.call('getDigitsOfPi', [100]);
    //     await sb.call('getDigitsOfPi', [1000]);
    //     await sb.call('getDigitsOfPi', [2000]);
    //     await sb.call('getDigitsOfPi', [5000]);
    //     await sb.call('getDigitsOfPi', [10000]);
    //     await sb.call('getDigitsOfPi', [30000]);
    //     await sb.call('getDigitsOfPi', [50000]);
    //     sb.call('getDigitsOfPi', [100000]);
    //     await sleep(1);
    //     sb.terminate();
    // })();

    /*
     * Demo 4
     * Calculate later number digits of PI while doing other stuff, but abandon abrubtly
     */
    (async function() {
        // Do something else in parallel
        for (let i = 1; i < 10; i++) {
            const delay = Math.random() * 5_000;
            setTimeout(async () => {
                sb.call('addNumbersDelayed', [Math.random() * 1234, Math.random() * 1234, i ,i * 123]);
                sb.call('multiplyNumbersDelayed', [Math.random() * 1234, Math.random() * 1234, i + 1, (i + 1) * 123]);
            }, delay);
        }
        await sb.call('getDigitsOfPi', [10]);
        await sb.call('getDigitsOfPi', [100]);
        await sb.call('getDigitsOfPi', [200]);
        await sb.call('getDigitsOfPi', [300]);
        await sb.call('getDigitsOfPi', [500]);
        sb.call('getDigitsOfPi', [1000000]);
        await sleep(1);
        sb.terminate(false);
    })();

    // Callback function example
    // sb.call('mySandboxFunction', ['hello', 'world'], (result) => {
    //     console.log('callback', result);
    // });

    // Promise.then example
    // sb.call('addNumbers', [111111111])
    //     .then(result => console.log('promise.then', result));

    // Async-await example
    // const result = await sb.call('addNumbers', [1, 2, 3, 4, 5]);
    // console.log('async-await', result);

    // Terminate manually
    // Use if the argument 'autoTerminateAfterMs' is not given
    // await sb.terminate(false); // don't wait for running tasks to finish
    // await sb.terminate();

    // Losing the instance reference is safe now, the worker thread is deleted
})();

const sleep = async (seconds = 0) => new Promise(resolve => setTimeout(resolve, seconds * 1000));