export const SANDBOX_API_RESPONSE_HANDLERS = {
    mySandboxFunction: (result) => {
    },
    addNumbers: (result) => {
    },
    addNumbersDelayed: (result) => {
    },
};
export const SANDBOX_API = function ($scope) {
    const postMessage = self.postMessage;
    $scope.mySandboxFunction = (args, taskId) => {
        postMessage({ action: 'mySandboxFunction', payload: JSON.stringify(args), taskId });
    };
    $scope.addNumbers = (args, taskId) => {
        const result = args.reduce((prev, curr) => prev + curr, 0);
        postMessage({ action: 'addNumbers', payload: result, taskId });
    };
    $scope.addNumbersDelayed = (args, taskId) => {
        const result = args.reduce((prev, curr) => prev + curr, 0);
        const delay = Math.round(Math.random() * 3000);
        self.setTimeout(() => {
            postMessage({ action: 'addNumbersDelayed', payload: result, taskId });
        }, delay);
    };
};
//# sourceMappingURL=api.js.map