/**
 * Next's client modules (e.g. next/navigation, pulled in through feature index files) read `process.env`,
 * which Next defines when it bundles the app but a browser test run does not.
 */
globalThis.process ??= { env: {} } as NodeJS.Process;
