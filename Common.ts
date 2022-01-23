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

  Log.error('All attempts failed. Error message: ' + err.message);
  throw err;
}

class Log {
  private static readonly infoLog = []
  private static readonly debugLog = []
  private static readonly errLog = []

  static info(arg) {
    this.infoLog.push(arg)
  }

  static debug(arg) {
    this.debugLog.push(arg)
  }

  static error(arg) {
    this.errLog.push(arg)
  }

  static dump(): string {
    return `Error:
${this.errLog.map(val => JSON.stringify(val)).join("\n")}

Info:
${this.infoLog.map(val => JSON.stringify(val)).join("\n")}

Debug:
${this.debugLog.map(val => JSON.stringify(val)).join("\n")}
`
  }
}
