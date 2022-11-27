import { CoinName, enumKeys, StableUSDCoin } from "../lib";

export const SECONDS_IN_MIN = 60;
export const SECONDS_IN_HOUR = SECONDS_IN_MIN * 60;
export const TICK_INTERVAL_MIN = 1;

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

  // @ts-expect-error
  static level: LogLevel = LogLevel[LOG_LEVEL];

  static alert(msg: string): void {
    this.level >= LogLevel.ALERT && this.alerts.push(msg);
  }

  static info(msg: string): void {
    this.level >= LogLevel.INFO && this.infoLog.push(msg);
  }

  static debug(arg: any): void {
    this.level >= LogLevel.DEBUG && this.debugLog.push(JSON.stringify(arg));
  }

  static error(err: Error): void {
    this.level >= LogLevel.ERROR &&
      this.errLog.push(new Error(`${err?.stack?.slice(0, 1000)}`));
  }

  static print(): string {
    return `${
      this.alerts.length > 0 ? `${this.alerts.join(`<br/>`)}<br/><br/>` : ``
    }
${
  this.errLog.length > 0
    ? `Errors:<br/>${this.errLog
        .map((e) => `Stack: ${e.stack}`)
        .join(`<br/>`)}<br/><br/>`
    : ``
}
${
  this.infoLog.length > 0
    ? `Info:<br/>${this.infoLog.join(`<br/>`)}<br/><br/>`
    : ``
}
${
  this.debugLog.length > 0
    ? `Debug:<br/>${this.debugLog.join(`<br/><br/>`)}`
    : ``
}
`;
  }

  static ifUsefulDumpAsEmail(): void {
    const email = Session.getEffectiveUser().getEmail();
    if (this.alerts.length > 0 || this.errLog.length > 0) {
      const subject = `Trading Helper ${
        this.errLog.length ? `Error` : `Alert`
      }`;
      try {
        GmailApp.sendEmail(email, subject, ``, { htmlBody: this.print() });
      } catch (e) {
        Log.error(e);
        GmailApp.createDraft(email, subject, ``, { htmlBody: this.print() });
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

  get coinName(): CoinName | null {
    return this.match ? this.match[1] : null;
  }

  get stableCoin(): StableUSDCoin | null {
    return this.match ? (this.match[2] as StableUSDCoin) : null;
  }
}
