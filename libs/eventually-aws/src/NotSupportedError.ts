export class NotSupportedError extends Error {
  constructor(public readonly description: string) {
    super(description);
    this.name = "Not supported";
  }
}
