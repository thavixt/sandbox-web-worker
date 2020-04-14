export const SANDBOX_API_RESPONSE_HANDLERS = {
    mySandboxFunction: (result) => {
    },
    addNumbers: (result) => {
    },
    addNumbersDelayed: (result) => {
    },
};
export const SANDBOX_API = function ($scope, signalResult) {
    $scope.mySandboxFunction = (args, taskId) => {
        signalResult({ action: 'mySandboxFunction', payload: JSON.stringify(args), taskId });
    };
    $scope.addNumbers = (args, taskId) => {
        const result = args.reduce((prev, curr) => prev + curr, 0);
        signalResult({ action: 'addNumbers', payload: result, taskId });
    };
    $scope.addNumbersDelayed = (args, taskId) => {
        const result = args.reduce((prev, curr) => prev + curr, 0);
        const delay = Math.round(Math.random() * 3000);
        self.setTimeout(() => {
            signalResult({ action: 'addNumbersDelayed', payload: result, taskId });
        }, delay);
    };
};
//# sourceMappingURL=api.js.map