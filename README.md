# Sandbox.js - sandboxing and offloading tasks with Web Workers

```ts
const mySandbox = new Sandbox({
    // any string, used for internal bookkeeping
    name: string,
    // any code provided by the user
    code?: string,
    api?: {
        // public API which is made public to the user code
        public: (scope: SandboxScope) => void,
        // callback functions to handle successful API calls
        handlers: {
            [key: string]: (result: any) => any
        },
    },
    onTaskCountChange?: (message: string) => void,
    autoTerminateAfterMs?: number,
    debug?: (timestamp: number, sandboxName: string, message: string) => void,
})
```

- written in TypeScript
- can load arbitrary user code in a Web Worker
- can include custom baked-in APIs
    - these function will be available inside the Sandbox
    - handles async functions
    - you can pass any object as an argument to a function
        - to handle multiple arguments, use an array with named keys, or an array
- can define handlers for custom API calls from the Sandboxed user code
    - these will run whenever an API function is called in the Sandbox
    - it's only argument is the function's return value (if there's any)
- uses an async task flow
    - dynamic promise-based task counter
    - can handle logging with a user-provided 'logger' function
    - log to the console with `console.log` or pass a custom function to log to the DOM, a file, etc
- can call your API functions from the outside
    - `mySandbox.call('myAPIfunction', args)`;
    - the return valiue can be used with a callback function, a Promise, or just `await`ing it:
        - `const result = await mySandbox('myFunction', [1, 2]);`
        - `mySandbox('myFunction', [1, 2]).then(result => /*do something/*);`
        - `mySandbox('myFunction', [1, 2], (result) => {/*do something/*};`
- if configured, waits for all tasks to complete before terminating/destroying after a set time

## Example 1

Let's say I want to create a sandbox. I want to make my `calculateSum` function available inside it. My user should be able to use it with their own scripts.

```ts
function calculateSum(numbers: number[]) {
    return numbers.reduce((a,b) => a + b, 0);
}
```

### Creating a Sandbox

```ts
const mySandbox = new Sandbox({
    name: 'SumCalculator',
    api: {
        public: MY_PUBLIC_API,
        handlers: MY_API_HANDLERS,
    },
})
```

### The Public API

The public API argument should be a function which adds functions to the scope that you want to make available inside the Sandbox. For example:

The scope itself is the `$` (dollar sign) object.
> Note: The scope object's name might change in future versions.

Lets create the API that will contain my `calculateSum` function:

```ts
const MY_PUBLIC_API = ($scope: SandboxScope) => {
    $scope.calculateSum = (numbers: number[]) {
        const result = numbers.reduce((a,b) => a + b, 0);
        return result;
    }
};
```

You could access the Worker's global scope object, named `self`, to disable some features like `fetch`, etc.

Example:
```ts
const MY_PUBLIC_API = $scope: SandboxScope) => {
    // ...

    delete self.fetch;
    // 'fetch' will no longer be available for the user code!
}
```


That's it! You might have noticed an extra parameter: `taskId`. It's used for logging, keeping track of currently running tasks, etc.

### API handlers

Let's say you want to be able to pass data between your app and the Sandbox. This is easy:

Lets create a Public API for it:

```ts
const MY_PUBLIC_API = ($scope: SandboxScope) => {
    // ...
    $scope.postSum = (numbers: number[]) {
        const sum = $scope.calculateSum(numbers);
        postMessage({payload: sum, action: 'postSum'});
    }
};
```

Create the API callback handler object:

```ts
const MY_API_HANDLERS = {
    postSum: (sum: number) {
        console.log(`The sum is ${sum}!`);
    }
}
```

Now, whenever your user call the `postSum` method, you handler will be called with the result as the argument.

> Note: Make sure the function signatures between you Public API functions and your API handler function match!

You can also call the Public API function manually from the outside:

```ts
// mySandbox instance created above ...

mySandbox.call('postSum', [1, 2, 3]);
```

To access the result, you have 3 approaches available to suit different coding styles:

1. Async-await
```ts
await result = mySandbox.call('postSum', [1, 2, 3]);
```

2. Promise.then
```ts
mySandbox.call('postSum', [1, 2, 3])
    .then(sum => /* ... */);
```

3. Callback function
```ts
mySandbox.call('postSum', [1, 2, 3], (sum) => {/* ... */});
```

### Providing user code

To pass arbitrary user code the the Sandbox, just use the `code` argument:

```ts
// This code could be defined inline,
// but the preferred method is to fetch it from an external source:
const userCode = await fetch('path/to/userCode.js').then(file => file.text());

const mySandbox = Sandbox({
    // ...
    code: userCode,
    // ...
});
```

This user code can access the provided Public API throught the `$` (dollar sign) object.

The `$` object and all it's properties are frozen (with `Object.freeze` and `Object.defineProperty`) when creating a new Sandbox instance and upon calling `start`. Attempting to modify the `self.$`/`$` object in the user code will have no effect.

User code example:

```js
// userCode.js

const mySum = $.calculateSum([1, 2, 3]);
// meh, I didn't do anything with this

const myUsefulSum = $.postSum([5, 6, 7]);
// this API call we defined will call the appropriate
// handler callback in my application code
```

### Starting and terminating the Sandbox

To start the Sandbox thread, simply call `start`:

```ts
mySandbox.start();
```

The user code will be wrapped in a `main` method internally, which is called when the Sandbox instance's `start` method is called. When calling `start`
1. the Public API, API handlers and user code is concatenated (and some extra steps)
2. this a URL is created from this string,
3. a Web Worker is created at runtime, which will contain all the code provided

You can inspect the Web Worker's code from the dev tools to see it's structure.

To terminate (destroy) the Sandbox thread, call it's `terminate` method:

```ts
mySandbox.terminate(waitForRunningTasks = false);
```

Calling it with a `true` argument will destroy the thread immediately, leaving all running tasks/code unfinished. Use with caution!
By default, the Sandbox will wait for all currently running tasks to finish before destroying the thread.

To terminate the thread automatically after x milliseconds of inactivity, use the `autoTerminateAfterMs` constructor parameter:

```ts
const mySandbox({
    // ...
    autoTerminateAfter: 5000,
});
```

This will make the thread automatically terminate after 5 seconds of inactivity (no running tasks). Any API handler called will reset this timer, so running tasks won't be interrupted.


## Example 2

A (different) live example: https://thavixt.github.io/sandbox-web-worker/

## TODO

- [x] example in README
- [x] some documentation
- [ ] fix source map url in example/sandbox.js
- [x] fix debug log datetime format
- [ ] testing ?
- [ ] extend default Sandbox API
- [ ] clean up code
