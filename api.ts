import { SandboxScope, SignalApiResponse } from '../src/sandbox';

export const SANDBOX_API_RESPONSE_HANDLERS = {
    mySandboxFunction: (result: any) => {
        // console.log('[SANDBOX_API_RESPONSE_HANDLERS] mySandboxFunctionSuccess', result);
    },
    addNumbers: (result: number) => {
        // console.log('[SANDBOX_API_RESPONSE_HANDLERS] addNumbersSuccess', result);
    },
    addNumbersDelayed: (result: number) => {
        // console.log('[SANDBOX_API_RESPONSE_HANDLERS] addNumbersDelayedSuccess', result);
    },
    multiplyNumbersDelayed: (result: number) => {
        // console.log('[SANDBOX_API_RESPONSE_HANDLERS] multiplyNumbersDelayed', result);
    },
    getDigitsOfPi: (result: number) => {
        // console.log('[SANDBOX_API_RESPONSE_HANDLERS] getDigitsOfPi', result);
    },
};

export const SANDBOX_API = function ($scope: SandboxScope, signalResult: SignalApiResponse) {
    $scope.mySandboxFunction = (args, taskId) => {
        signalResult({ action: 'mySandboxFunction', payload: JSON.stringify(args), taskId });
    }
    $scope.addNumbers = (args: number[], taskId) => {
        const result = args.reduce((prev, curr) => prev + curr, 0);
        signalResult({ action: 'addNumbers', payload: {args, result}, taskId });
    }
    $scope.addNumbersDelayed = (args: number[], taskId) => {
        const result = args.reduce((prev, curr) => prev + curr, 0);
        const delay = Math.round(Math.random() * 3000);
        self.setTimeout(() => {
            signalResult({ action: 'addNumbersDelayed', payload: {args, result}, taskId });
        }, delay);
    }
    $scope.multiplyNumbersDelayed = (args: number[], taskId) => {
        const result = args.reduce((prev, curr) => prev * curr, 1);
        const delay = Math.round(Math.random() * 3000);
        self.setTimeout(() => {
            signalResult({ action: 'multiplyNumbersDelayed', payload: {args, result}, taskId });
        }, delay);
    }
    $scope.getDigitsOfPi = (args: number[], taskId) => {
        function * generateDigitsOfPi() {
            let q = 1n;
            let r = 180n;
            let t = 60n;
            let i = 2n;
            while (true) {
                let digit = ((i * 27n - 12n) * q + r * 5n) / (t * 5n);
                yield Number(digit);
                let u = i * 3n;
                u = (u + 1n) * 3n * (u + 2n);
                r = u * 10n * (q * (i * 5n - 2n) + r - t * digit);
                q *= 10n * i * (i++ * 2n - 1n);
                t *= u;
            }
        }
        let digits = "";
        const iter = generateDigitsOfPi();
        for (let i = 0; i < args[0]; i++) digits += iter.next().value;

        const result = digits;
        const delay = Math.round(Math.random() * 3000);
        self.setTimeout(() => {
            signalResult({ action: 'getDigitsOfPi', payload: {args, result}, taskId });
        }, delay);
    }
};
