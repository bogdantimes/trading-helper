import { CoinName, enumKeys, StableUSDCoin } from "trading-helper-lib"

export const SECONDS_IN_MIN = 60
export const SECONDS_IN_HOUR = SECONDS_IN_MIN * 60
export const TICK_INTERVAL_MIN = 1

export interface ExecParams {
  context?: any
  runnable: (any) => any
  interval?: number
  attempts?: number
}

export const INTERRUPT = `INTERRUPT`
export const SERVICE_LIMIT = `Service invoked too many times`

export function execute({ context, runnable, interval = 500, attempts = 5 }: ExecParams) {
  let err: Error
  do {
    try {
      err = null
      return runnable(context)
    } catch (e) {
      err = e
      if (e.message.includes(INTERRUPT) || e.message.includes(SERVICE_LIMIT)) {
        break
      }
    }
    if (attempts > 0) {
      Utilities.sleep(interval)
    }
  } while (--attempts > 0)

  if (err) {
    throw err
  }
}

export class Log {
  private static readonly infoLog: string[] = []
  private static readonly debugLog = []
  private static readonly errLog: Error[] = []
  private static readonly alerts: string[] = []

  static alert(msg: string) {
    this.alerts.push(msg)
  }

  static info(msg: string) {
    this.infoLog.push(msg)
  }

  static debug(arg) {
    this.debugLog.push(JSON.stringify(arg))
  }

  static error(err: Error) {
    this.errLog.push(new Error(`${err.stack.slice(0, 1000)}`))
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
`
  }

  static ifUsefulDumpAsEmail() {
    const email = Session.getEffectiveUser().getEmail()
    if (this.alerts.length > 0 || this.errLog.length > 0) {
      const subject = `Trading Helper ${this.errLog.length ? `Error` : `Alert`}`
      try {
        GmailApp.sendEmail(email, subject, this.print())
      } catch (e) {
        Log.error(e)
        GmailApp.createDraft(email, subject, this.print())
      }
    }
  }
}

export class StableCoinMatcher {
  private readonly symbol: string
  private readonly match: RegExpMatchArray

  constructor(symbol: string) {
    this.symbol = symbol.toUpperCase()
    this.match = this.symbol.match(new RegExp(`^(\\w+)(${enumKeys(StableUSDCoin).join(`|`)})$`))
  }

  get matched(): boolean {
    return !!this.match
  }

  get coinName(): CoinName | null {
    return this.match ? this.match[1] : null
  }

  get stableCoin(): StableUSDCoin | null {
    return this.match ? (this.match[2] as StableUSDCoin) : null
  }
}

export class StopWatch {
  private startTime: number
  private stopTime: number
  private prefix: string
  private readonly printer: (msg: string) => void

  constructor(printer?: (msg: string) => void) {
    this.startTime = 0
    this.stopTime = 0
    this.printer = printer
  }

  start(prefix: string) {
    this.prefix = prefix
    this.startTime = new Date().getTime()
    this.printer?.(`${prefix} started`)
  }

  stop() {
    this.stopTime = new Date().getTime()
    this.printer?.(this.printElapsed())
  }

  printElapsed() {
    return `${this.prefix} took ${this.getElapsedTime()}ms`
  }

  getElapsedTime() {
    return this.stopTime - this.startTime
  }
}
