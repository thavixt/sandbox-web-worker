import Sandbox from './sandbox.js';
import { SANDBOX_API, SANDBOX_API_RESPONSE_HANDLERS } from './api.js';
(async () => {
    const userCodeText = await fetch('./userCode.js').then(js => js.text());
    const taskCounter = document.getElementById('taskCounter');
    const logElement = document.getElementById('log');
    const myLogger = (time, sandbox, msg, task) => {
        const p = document.createElement('p');
        const cls = msg.match('TASK START') ? 'started' : (msg.match('TASK FINISH') ? 'finished' : null);
        if (cls) {
            p.classList.add(cls);
        }
        const date = new Date(time);
        const isoString = date.toISOString();
        p.textContent = `${isoString} - ${sandbox} - ${msg}${task ? ` - ${JSON.stringify(task)}` : ''}`;
        logElement.appendChild(p);
        logElement.scrollTop = logElement.scrollHeight;
    };
    const sb = new Sandbox({
        name: 'MySandbox01',
        api: {
            public: SANDBOX_API,
            handlers: SANDBOX_API_RESPONSE_HANDLERS,
        },
        code: userCodeText,
        onTaskCountChange: (taskCount) => taskCounter.textContent = taskCount.toString(),
        autoTerminateAfterMs: 3000,
        debug: myLogger,
    });
    await sb.start();
    for (let i = 0; i < 20; i++) {
        const delay = Math.round(Math.random() * 5000);
        setTimeout(async () => {
            const result = await sb.call('addNumbersDelayed', [1, i]);
            console.log('await addNumbersDelayed', result);
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