interface ExecParams {
  context: any;
  runnable: (any) => any;
  interval?: number;
  attempts?: number;
}

const INTERRUPT = 'INTERRUPT';

function execute({context, runnable, interval = 2000, attempts = 5}: ExecParams) {
  let err: Error;
  do {
    try {
      return runnable(context);
    } catch (e) {
      err = e;
      if (e.message.includes(INTERRUPT)) {
        break;
      }
    }
    if (attempts > 0) {
      Utilities.sleep(interval)
    }
  } while (--attempts > 0);

  Log.error(new Error(`All attempts failed. Context: ${JSON.stringify(context)}. Error message: ${err.message}`));
  throw err;
}

class Log {
  private static readonly infoLog = []
  private static readonly debugLog = []
  private static readonly errLog: Error[] = []

  static alert(msg: string) {
    try {
      GmailApp.sendEmail(Session.getEffectiveUser().getEmail(), "Trader-bot alert", msg)
    } catch (e) {
      Log.error(e)
    }
  }

  static info(arg) {
    this.infoLog.push(arg)
  }

  static debug(arg) {
    this.debugLog.push(arg)
  }

  static error(err: Error) {
    this.errLog.push(err)
  }

  static dump(): string {
    return `
Info:
${this.infoLog.map(val => JSON.stringify(val)).join("\n")}

${this.errLog.length ? "Errors:\n" + this.errLog.join("\n") : ""}

${this.debugLog.length ? "Debug:\n" + this.debugLog.map(val => JSON.stringify(val)).join("\n") : ""}
`
  }

  static ifUsefulDumpAsEmail() {
    if (this.infoLog.length > 0 || this.debugLog.length > 0 || this.errLog.some(e => !e.message.includes("IP banned until"))) {
      GmailApp.createDraft(Session.getEffectiveUser().getEmail(), "Trader-bot log", this.dump())
    }
  }
}

function preciseAverage(a: number, b: number): number {
  const ave = (a + b) / 2;
  const precision = Math.max(getPrecision(a), getPrecision(b));
  return +ave.toFixed(precision)
}

function getPrecision(a: number): number {
  if (!isFinite(a)) return 0;
  let e = 1, p = 0;
  while (Math.round(a * e) / e !== a) { e *= 10; p++; }
  return p;
}
