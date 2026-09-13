export class SeededRandom {
  private state: number;

  constructor(seed: number) {
    const normalized = Math.trunc(seed) >>> 0;
    this.state = normalized === 0 ? 0x6d2b79f5 : normalized;
  }

  next(): number {
    let value = (this.state += 0x6d2b79f5);
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  }

  integer(min: number, max: number): number {
    const low = Math.ceil(min);
    const high = Math.floor(max);
    if (high < low) {
      throw new RangeError(`Invalid random range: ${min}–${max}`);
    }
    return low + Math.floor(this.next() * (high - low + 1));
  }

  getState(): number {
    return this.state >>> 0;
  }

  setState(state: number): void {
    this.state = Math.trunc(state) >>> 0 || 0x6d2b79f5;
  }
}