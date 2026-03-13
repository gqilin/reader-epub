type Handler<T = unknown> = (payload: T) => void;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class TypedEventEmitter<TEvents extends Record<string, any>> {
  private _listeners = new Map<keyof TEvents, Set<Handler>>();

  on<K extends keyof TEvents>(event: K, handler: Handler<TEvents[K]>): () => void {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, new Set());
    }
    this._listeners.get(event)!.add(handler as Handler);
    return () => this.off(event, handler);
  }

  once<K extends keyof TEvents>(event: K, handler: Handler<TEvents[K]>): () => void {
    const wrapper: Handler<TEvents[K]> = (payload) => {
      this.off(event, wrapper);
      handler(payload);
    };
    return this.on(event, wrapper);
  }

  off<K extends keyof TEvents>(event: K, handler: Handler<TEvents[K]>): void {
    this._listeners.get(event)?.delete(handler as Handler);
  }

  protected emit<K extends keyof TEvents>(event: K, payload: TEvents[K]): void {
    this._listeners.get(event)?.forEach((handler) => {
      handler(payload);
    });
  }

  removeAllListeners(event?: keyof TEvents): void {
    if (event) {
      this._listeners.delete(event);
    } else {
      this._listeners.clear();
    }
  }
}
