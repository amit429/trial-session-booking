export interface Clock {
  now(): Date;
}

export class SystemClock implements Clock {
  now() {
    return new Date();
  }
}

/** Deterministic clock for tests and seeding. */
export class FixedClock implements Clock {
  constructor(private current: Date) {}
  now() {
    return new Date(this.current);
  }
  set(d: Date) {
    this.current = new Date(d);
  }
}
