import Sandbox from '../src/sandbox.js';
import { SANDBOX_API, SANDBOX_API_RESPONSE_HANDLERS } from './api.js';
(async () => {
    const userCodeText = await fetch('./userCode.js').then(js => js.text());
    const logElement = document.getElementById('log');
    const taskCounter = document.getElementById('taskCounter');
    const sb = new Sandbox({
        name: 'MySandbox01',
        api: {
            public: SANDBOX_API,
            handlers: SANDBOX_API_RESPONSE_HANDLERS,
        },
        code: userCodeText,
        onTaskCountChange: (taskCount) => taskCounter.textContent = taskCount.toString(),
        autoTerminateAfterMs: 3000,
        debug: (time, sandbox, msg) => {
            const started = msg.match('TASK START');
            const finished = msg.match('TASK FINISH');
            const p = document.createElement('p');
            p.textContent = `${time} - ${sandbox} - ${msg}`;
            const cls = started ? 'started' : (finished ? 'finished' : null);
            if (cls) {
                p.classList.add(cls);
            }
            logElement.appendChild(p);
            logElement.scrollTop = logElement.scrollHeight;
        },
    });
    await sb.start();
    for (let i = 0; i < 20; i++) {
        const delay = Math.round(Math.random() * 5000);
        setTimeout(() => {
            sb.call('addNumbersDelayed', [1, i]);
        }, delay);
    }
    sb.call('mySandboxFunction', ['hello', 'world'], (result) => {
        console.log('callback', result);
    });
    sb.call('addNumbers', [111111111])
        .then(result => console.log('promise.then', result));
    const result = await sb.call('addNumbers', [1, 2, 3, 4, 5]);
    console.log('async-await', result);
})();
//# sourceMappingURL=index.js.map