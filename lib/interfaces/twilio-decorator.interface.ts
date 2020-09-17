export interface TwilioDecorator {
  (
    target: Record<string, unknown>,
    key: string | symbol,
    index?: number | undefined,
  ): void;
}
