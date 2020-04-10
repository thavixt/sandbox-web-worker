import Sandbox from '../src/sandbox.js';
import { SANDBOX_API, SANDBOX_API_RESPONSE_HANDLERS } from './api.js';

(async () => {
    // TODO: remove. Used for logging to the DOM
    const taskCounter = document.getElementById('taskCounter');

    // Get arbitrary user code from external source
    const userCodeText = await fetch('./userCode.js').then(js => js.text());

    // Set up a logger function
    const logElement = document.getElementById('log');
    function myLogger(msg: string) {
        const started = msg.match('TASK START');
        const finished = msg.match('TASK FINISH');

        const p = document.createElement('p');
        p.textContent = `${(new Date()).getTime()} - ${msg} `;

        const cls = started ? 'started' : (finished ? 'finished' : null);
        if (cls) {
            p.classList.add(cls);
        }

        logElement.appendChild(p);
        logElement.scrollTop = logElement.scrollHeight;
    }


    // Create a new Sandbox Worker thread
    const sb = new Sandbox({
        name: 'MySandbox01',
        api: {
            public: SANDBOX_API,
            handlers: SANDBOX_API_RESPONSE_HANDLERS,
        },
        code: userCodeText,
        onTaskCountChange: (taskCount) => taskCounter.textContent = taskCount.toString(),
        autoTerminateAfterMs: 1000,
        debug: myLogger, // could also use the native console.log
    });

    // Wait for thread creation, API setup etc
    // This will also wait until all function calls in the user provided code has run
    await sb.start();

    // Simulate user interaction with some function calls
    // for (let i = 0; i < 10; i++) {
    //     const delay = Math.round(Math.random() * 5000);
    //     setTimeout(() => {
    //         sb.call('addNumbersDelayed', [1, i]);
    //     }, delay);
    // }

    // sb.call('addNumbersDelayed', [1, 0]);
    // sb.call('addNumbersDelayed', [1, 1]);
    // sb.call('addNumbersDelayed', [1, 2]);
    // sb.call('addNumbersDelayed', [1, 4]);
    // sb.call('addNumbersDelayed', [1, 5]);

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
    // await sb.terminate(false);
    // await sb.terminate();

    // Losing the instance reference is safe now, the worker thread is deleted
})();
