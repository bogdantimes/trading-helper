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
    return `Error:
${this.errLog.join("\n")}

Info:
${this.infoLog.map(val => JSON.stringify(val)).join("\n")}

Debug:
${this.debugLog.map(val => JSON.stringify(val)).join("\n")}
`
  }

  static ifUsefulDumpAsEmail() {
    if (this.infoLog.length > 0 || this.debugLog.length > 0 || this.errLog.some(e => !e.message.includes("IP banned until"))) {
      GmailApp.sendEmail(Session.getEffectiveUser().getEmail(), "Trader handler log", this.dump())
    }
  }
}
