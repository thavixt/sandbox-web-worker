import Sandbox from '../src/sandbox.js';
import { SANDBOX_API, SANDBOX_API_RESPONSE_HANDLERS } from './api.js';
(async () => {
    const userCodeText = await fetch('./userCode.js').then(js => js.text());
    const taskCounter = document.getElementById('taskCounter');
    const activityIndicator = document.getElementById('activity');
    const logElement = document.getElementById('log');
    const myLogger = (time, sandbox, msg, task) => {
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
            }
            else {
                p.textContent = `${isoString} ${sandbox} (${task.taskId}) | ${msg} - ${JSON.stringify(task.payload)}}`;
            }
        }
        else {
            p.textContent = `${isoString} ${sandbox} | ${msg}${task ? ` - ${JSON.stringify(task)}` : ''}`;
        }
        logElement.appendChild(p);
        logElement.scrollTop = logElement.scrollHeight;
    };
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
        logger: myLogger,
    });
    await sb.start();
    (async function () {
        for (let i = 1; i < 10; i++) {
            const delay = Math.random() * 5000;
            setTimeout(async () => {
                sb.call('addNumbersDelayed', [Math.random() * 1234, Math.random() * 1234, i, i * 123]);
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
})();
const sleep = async (seconds = 0) => new Promise(resolve => setTimeout(resolve, seconds * 1000));
//# sourceMappingURL=index.js.map