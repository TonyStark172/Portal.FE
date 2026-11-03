import { vi } from "vitest";
import type { IHttpConnectionOptions, IRetryPolicy } from "@microsoft/signalr";

/** A hub connection that does nothing on its own: a test makes it signal, reconnect or close. */
export class FakeHubConnection {
  readonly handlers = new Map<string, (...args: unknown[]) => void>();
  readonly reconnected: (() => void)[] = [];
  readonly closed: ((error?: Error) => void)[] = [];
  readonly start = vi.fn(async () => {
    if (fakeHub.failingStarts > 0) {
      fakeHub.failingStarts--;
      throw new Error("Failed to start the connection");
    }
  });
  readonly stop = vi.fn(async () => {});

  constructor(
    readonly url: string,
    readonly options: IHttpConnectionOptions,
    readonly policy: IRetryPolicy | null,
  ) {}

  on(method: string, handler: (...args: unknown[]) => void) {
    this.handlers.set(method, handler);
  }
  onreconnected(handler: () => void) {
    this.reconnected.push(handler);
  }
  onclose(handler: (error?: Error) => void) {
    this.closed.push(handler);
  }

  /** The server telling the page its bell changed. */
  signal(kind: string, broadcast = false) {
    this.handlers.get("notificationsChanged")?.({ kind, broadcast });
  }
  /** The library getting the connection back after losing it. */
  reconnect() {
    this.reconnected.forEach((handler) => handler());
  }
  /** The server ending the connection for good (a token that ran out, say). */
  close() {
    this.closed.forEach((handler) => handler());
  }
}

export const fakeHub = {
  connections: [] as FakeHubConnection[],
  /** How many of the next `start()` calls, on any connection, fail. */
  failingStarts: 0,
  get last() {
    return this.connections[this.connections.length - 1];
  },
  reset() {
    this.connections = [];
    this.failingStarts = 0;
  },
};

/** Stands in for the library's `HubConnectionBuilder`: see `vi.mock("@microsoft/signalr")` in the tests. */
export class FakeHubConnectionBuilder {
  private url = "";
  private options: IHttpConnectionOptions = {};
  private policy: IRetryPolicy | null = null;

  withUrl(url: string, options: IHttpConnectionOptions) {
    this.url = url;
    this.options = options;
    return this;
  }
  withAutomaticReconnect(policy: IRetryPolicy) {
    this.policy = policy;
    return this;
  }
  configureLogging() {
    return this;
  }
  build() {
    const connection = new FakeHubConnection(this.url, this.options, this.policy);
    fakeHub.connections.push(connection);
    return connection;
  }
}
