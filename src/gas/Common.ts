import { CoinName, enumKeys, StableUSDCoin } from "../lib";

export const SECONDS_IN_MIN = 60;
export const SECONDS_IN_HOUR = SECONDS_IN_MIN * 60;
export const TICK_INTERVAL_MIN = 1;

export interface ExecParams {
  context?: any;
  runnable: (arg0: any) => any;
  interval?: number;
  attempts?: number;
}

export const INTERRUPT = `INTERRUPT`;
export const SERVICE_LIMIT = `Service invoked too many times`;

export function execute({
  context,
  runnable,
  interval = 500,
  attempts = 5,
}: ExecParams): any {
  let err: Error | any;
  do {
    try {
      err = null;
      return runnable(context);
    } catch (e: any) {
      err = e;
      if (e.message.includes(INTERRUPT) || e.message.includes(SERVICE_LIMIT)) {
        break;
      }
    }
    if (attempts > 0) {
      Utilities.sleep(interval);
    }
  } while (--attempts > 0);

  if (err) {
    throw err;
  }
}

export enum LogLevel {
  NONE,
  ALERT,
  ERROR,
  INFO,
  DEBUG,
}

export class Log {
  private static readonly infoLog: string[] = [];
  private static readonly debugLog: any[] = [];
  private static readonly errLog: Error[] = [];
  private static readonly alerts: string[] = [];

  static level: LogLevel = LogLevel.INFO;

  static alert(msg: string): void {
    this.level >= LogLevel.ALERT && this.alerts.push(msg);
  }

  static info(msg: string): void {
    this.level >= LogLevel.INFO && this.infoLog.push(msg);
  }

  static debug(arg: any): void {
    this.level >= LogLevel.DEBUG && this.debugLog.push(JSON.stringify(arg));
  }

  static error(err: Error | any): void {
    this.level >= LogLevel.ERROR &&
      this.errLog.push(new Error(`${err?.stack?.slice(0, 1000)}`));
  }

  static print(): string {
    return `${this.alerts.length > 0 ? `${this.alerts.join(`\n`)}\n` : ``}
${
  this.errLog.length > 0
    ? `Errors:\n${this.errLog.map((e) => `Stack: ${e.stack}`).join(`\n`)}\n`
    : ``
}
${this.infoLog.length > 0 ? `Info:\n${this.infoLog.join(`\n`)}\n` : ``}
${this.debugLog.length > 0 ? `Debug:\n${this.debugLog.join(`\n\n`)}` : ``}
`;
  }

  static ifUsefulDumpAsEmail(): void {
    const email = Session.getEffectiveUser().getEmail();
    if (this.alerts.length > 0 || this.errLog.length > 0) {
      const subject = `Trading Helper ${
        this.errLog.length ? `Error` : `Alert`
      }`;
      try {
        GmailApp.sendEmail(email, subject, this.print());
      } catch (e) {
        Log.error(e);
        GmailApp.createDraft(email, subject, this.print());
      }
    }
  }
}

export class StableCoinMatcher {
  private readonly symbol: string;
  private readonly match: RegExpMatchArray | null;

  constructor(symbol: string) {
    this.symbol = symbol.toUpperCase();
    this.match = this.symbol.match(
      new RegExp(`^(\\w+)(${enumKeys(StableUSDCoin).join(`|`)})$`)
    );
  }

  get matched(): boolean {
    return !!this.match;
  }

  get coinName(): CoinName | null {
    return this.match ? this.match[1] : null;
  }

  get stableCoin(): StableUSDCoin | null {
    return this.match ? (this.match[2] as StableUSDCoin) : null;
  }
}

export class StopWatch {
  private startTime: number;
  private stopTime: number;
  private prefix = ``;
  private readonly printer?: (msg: string) => void;

  constructor(printer?: (msg: string) => void) {
    this.startTime = 0;
    this.stopTime = 0;
    this.printer = printer;
  }

  start(prefix: string): void {
    this.prefix = prefix;
    this.startTime = new Date().getTime();
  }

  stop(): void {
    this.stopTime = new Date().getTime();
    this.printer?.(this.printElapsed());
  }

  printElapsed(): string {
    return `${this.prefix} took ${this.getElapsedTime()}ms`;
  }

  getElapsedTime(): number {
    return this.stopTime - this.startTime;
  }
}

export const CoinCacheKeys = {
  PD_TRACKING: (coin) => `${coin}-pump-dump-tracking`,
  START_PRICE: (coin) => `${coin}-start-price`,
};
