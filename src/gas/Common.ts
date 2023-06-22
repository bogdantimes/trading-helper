import { isNode } from "browser-or-node";
import getEmailTemplate from "./utils/getEmailTemplate";
import { type Signal } from "./traders/plugin/api";

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
  private static readonly alertsLog: string[] = [];

  // @ts-expect-error LOG_LEVEL is injected by esbuild
  static level: LogLevel = isNode ? LogLevel.NONE : LogLevel[LOG_LEVEL];

  static alert(msg: string): void {
    this.level >= LogLevel.ALERT && this.alertsLog.push(msg);
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

  static printEmail(): string {
    return getEmailTemplate({
      alertsLog: this.alertsLog,
      errLog: this.errLog,
      infoLog: this.infoLog,
      debugLog: this.debugLog,
    });
  }

  static printInfos(): string {
    return `${this.alertsLog.join(`\n`)}\n\n${this.infoLog.join(`\n`)}`.trim();
  }

  static ifUsefulDumpAsEmail(): void {
    const email = Session.getEffectiveUser().getEmail();
    if (this.alertsLog.length > 0 || this.errLog.length > 0) {
      const subject = `Trading Helper ${
        this.errLog.length ? `Error` : `Alert`
      }`;
      try {
        GmailApp.sendEmail(email, subject, ``, { htmlBody: this.printEmail() });
      } catch (e) {
        Log.error(e);
        // TODO: communicate to user over the app UI
      }
    }
  }
}

export const tmSorter = isNode
  ? (a, b) => (a.getCoinName() > b.getCoinName() ? 1 : -1)
  : () => Math.random() - 0.5;

export const signalSorter = isNode
  ? (a: Signal, b: Signal) => (a.coin > b.coin ? 1 : -1)
  : () => Math.random() - 0.5;
