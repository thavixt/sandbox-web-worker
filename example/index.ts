import Sandbox, { TaskParams } from '../src/sandbox.js';
import { SANDBOX_API, SANDBOX_API_RESPONSE_HANDLERS } from './api.js';

(async () => {
    // Get arbitrary user code from external source
    const userCodeText = await fetch('./userCode.js').then(js => js.text());

    // Used for logging the current task count to the DOM
    const taskCounter = document.getElementById('taskCounter');
    // Set up a custom logger function
    const logElement = document.getElementById('log');
    const myLogger = (time: number, sandbox: string, msg: string, task?: TaskParams) => {
        const p = document.createElement('p');
        const cls = msg.match('TASK START') ? 'started' : (
            msg.match('TASK FINISH') ? 'finished' : null
        );

        if (cls) {
            p.classList.add(cls);
        }

        const date = new Date(time);
        const isoString = date.toISOString();

        p.textContent = `${isoString} - ${sandbox} - ${msg}${task ? ` - ${JSON.stringify(task)}` : ''}`;
        logElement.appendChild(p);
        logElement.scrollTop = logElement.scrollHeight;
    };

    // Create a new Sandbox Worker thread
    const sb = new Sandbox({
        name: 'MySandbox01',
        api: {
            public: SANDBOX_API,
            handlers: SANDBOX_API_RESPONSE_HANDLERS,
        },
        code: userCodeText,
        onTaskCountChange: (taskCount) => taskCounter.textContent = taskCount.toString(),
        autoTerminateAfterMs: 3000,
        debug: myLogger, // could also use the native console.log
    });

    // Wait for thread creation, API setup etc
    // This will also wait until all function calls in the user provided code has run
    await sb.start();

    // Simulate user interaction with some function calls
    // These will resolve aftera a random time emulating an async task
    for (let i = 0; i < 20; i++) {
        const delay = Math.round(Math.random() * 5000);
        setTimeout(async () => {
            const result = await sb.call('addNumbersDelayed', [1, i]);
            console.log('await addNumbersDelayed', result);
        }, delay);
    }

    // Callback function example
    sb.call('mySandboxFunction', ['hello', 'world'], (result) => {
        console.log('callback', result);
    });

    // Promise.then example
    sb.call('addNumbers', [111111111])
        .then(result => console.log('promise.then', result));

    // Async-await example
    const result = await sb.call('addNumbers', [1, 2, 3, 4, 5]);
    console.log('async-await', result);

    // Terminate manually
    // Use if the argument 'autoTerminateAfterMs' is not given
    // await sb.terminate(false); // don't wait for running tasks to finish
    // await sb.terminate();

    // Losing the instance reference is safe now, the worker thread is deleted
})();
