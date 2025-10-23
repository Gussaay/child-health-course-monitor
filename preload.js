// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

// This script acts as a secure bridge between the powerful Node.js environment
// and the sandboxed web environment of your React application.

// For this application, we don't need to expose any Node.js APIs to the frontend,
// so this file can remain simple. It's included for security best practices.

console.log('Preload script has been loaded successfully.');

