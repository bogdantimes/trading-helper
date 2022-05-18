interface ExecParams {
  context?: any;
  runnable: (any) => any;
  interval?: number;
  attempts?: number;
}

const INTERRUPT = 'INTERRUPT';

function TradeLocked(coinName) {
  return "TradeLocked_" + coinName;
}

function execute({context, runnable, interval = 500, attempts = 5}: ExecParams) {
  let err: Error;
  do {
    try {
      err = null
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

  if (err) {
    throw err;
  }
}

class Log {
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
    this.debugLog.push(arg)
  }

  static error(err: Error) {
    this.errLog.push(new Error(`${err.stack.slice(0, 1000)}`))
  }

  static print(): string {
    return `${this.alerts.length > 0 ? `${this.alerts.join('\n')}\n` : ''}
${this.errLog.length > 0 ? `Errors:\n${this.errLog.map(e => `Stack: ${e.stack}`).join('\n')}\n` : ''}
${this.infoLog.length > 0 ? `Info:\n${this.infoLog.join('\n')}\n` : ''}
${this.debugLog.length > 0 ? `Debug:\n${this.debugLog.map(v => JSON.stringify(v)).join('\n\n')}` : ''}
`
  }

  static ifUsefulDumpAsEmail() {
    const email = Session.getEffectiveUser().getEmail();
    if (this.alerts.length > 0 || this.errLog.length > 0) {
      GmailApp.sendEmail(email, "Trading-helper alert", this.print())
    }
  }
}

function sumWithMaxPrecision(a: number, b: number): number {
  const aSplit = `${a}`.split(".");
  const bSplit = `${b}`.split(".");
  const precision = Math.max(
    (aSplit[1] || aSplit[0]).length,
    (bSplit[1] || bSplit[0]).length
  )
  return +(a + b).toFixed(precision)
}

function getRandomFromList(list) {
  return list[Math.floor(Math.random() * list.length)];
}
