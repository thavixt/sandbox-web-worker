# Sandboxing and offloading tasks with Web Workers

- can load arbitrary user code in a Web Worker
- can include custom baked-in APIs
    - can pass any object as arguments
    - can define handlers for custom API calls from the Sandboxed user code
- uses an async task flow
    - dynamic promise-based task counter
- handles async code in Sandbox/Web Worker
- waits for all tasks to complete before terminating/destroying
