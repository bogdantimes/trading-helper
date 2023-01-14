import { CoinName, enumKeys, StableUSDCoin } from "../lib";
import { isNode } from "browser-or-node";
import getEmailTemplate from "./utils/getEmailTemplate";

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
  static level: LogLevel = isNode ? LogLevel.NONE : LogLevel[LOG_LEVEL];

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
    console.error(err);
    this.level >= LogLevel.ERROR &&
      this.errLog.push(new Error(`${err?.stack?.slice(0, 1000)}`));
  }

  static print(): string {
    return getEmailTemplate({
      alerts: this.alerts,
      errLog: this.errLog,
      debugLog: this.debugLog,
    });
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
        // TODO: communicate to user over the app UI
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

export const backTestSorter = isNode
  ? (a, b) => (a.getCoinName() > b.getCoinName() ? 1 : -1)
  : () => Math.random() - 0.5;
