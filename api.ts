import { SandboxScope, WorkerScope } from '../src/sandbox';

export const SANDBOX_API_RESPONSE_HANDLERS = {
    mySandboxFunction: (result: any) => {
        // console.log('mySandboxFunctionSuccess', result);
    },
    addNumbers: (result: number) => {
        // console.log('addNumbersSuccess', result);
    },
    addNumbersDelayed: (result: number) => {
        // console.log('addNumbersDelayedSuccess', result);
    },
};

export const SANDBOX_API = function ($scope: SandboxScope) {
    const postMessage = (self as unknown as WorkerScope).postMessage;
    $scope.mySandboxFunction = (args, taskId) => {
        postMessage({ action: 'mySandboxFunction', payload: JSON.stringify(args), taskId });
    }
    $scope.addNumbers = (args: number[], taskId) => {
        const result = args.reduce((prev, curr) => prev + curr, 0);
        postMessage({ action: 'addNumbers', payload: result, taskId });
    }
    $scope.addNumbersDelayed = (args: number[], taskId) => {
        const result = args.reduce((prev, curr) => prev + curr, 0);
        const delay = Math.round(Math.random() * 3000);
        self.setTimeout(() => {
            postMessage({ action: 'addNumbersDelayed', payload: result, taskId });
        }, delay);
    }
};
