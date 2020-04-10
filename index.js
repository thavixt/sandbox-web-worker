import Sandbox from './sandbox.js';
import { SANDBOX_API, SANDBOX_API_RESPONSE_HANDLERS } from './api.js';
(async () => {
    const taskCounter = document.getElementById('taskCounter');
    const userCodeText = await fetch('./userCode.js').then(js => js.text());
    const logElement = document.getElementById('log');
    function myLogger(msg) {
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
    const sb = new Sandbox({
        name: 'MySandbox01',
        api: {
            public: SANDBOX_API,
            handlers: SANDBOX_API_RESPONSE_HANDLERS,
        },
        code: userCodeText,
        onTaskCountChange: (taskCount) => taskCounter.textContent = taskCount.toString(),
        autoTerminateAfterMs: 1000,
        debug: myLogger,
    });
    await sb.start();
    sb.call('mySandboxFunction', ['hello', 'world'], (result) => {
        console.log('callback', result);
    });
    sb.call('addNumbers', [111111111])
        .then(result => console.log('promise.then', result));
    const result = await sb.call('addNumbers', [1, 2, 3, 4, 5]);
    console.log('async-await', result);
})();
//# sourceMappingURL=index.js.map