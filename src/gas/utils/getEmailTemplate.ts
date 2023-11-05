interface Params {
  alertsLog: string[];
  errLog: Error[];
  infoLog: string[];
  debugLog: any[];
}

export default function getEmailTemplate({
  alertsLog,
  errLog,
  infoLog,
  debugLog,
}: Params): string {
  const style = `"font-size:16px;line-height:26px;margin:16px 0;font-family:&#x27;Open Sans&#x27;, &#x27;HelveticaNeue-Light&#x27;, &#x27;Helvetica Neue Light&#x27;, &#x27;Helvetica Neue&#x27;, Helvetica, Arial, &#x27;Lucida Grande&#x27;, sans-serif;font-weight:300;color:#404040"`;
  const codeStyle = `"display:inline-block;padding:16px 4.5%;width:90.5%;background-color:#f4f4f4;border-radius:5px;border:1px solid #eee;color:#333"`;

  const alerts = `<p style="${style}">${alertsLog.join(`<br/>`)}<br/><br/></p>`;

  const infos = ` <p style="${style}">Info:<br/>${infoLog.join(
    `<br/>`,
  )}<br/><br/></p>`;

  const errors = `<p style="${style}">Errors:</p><br/><code style="${codeStyle}">${errLog
    .map((e) => `Stack: ${e.stack}`)
    .join(`<br/>`)}<br/><br/></code>`;

  const debugs = `<p style="${style}">Debug:<br/></p><code style="${codeStyle}">${debugLog.join(
    `<br/><br/>`,
  )}</code>`;

  const footer = `
    <div style="padding:20px;text-align:center;">
      <p><a href="https://script.google.com/home/projects/${ScriptApp.getScriptId()}" style="text-decoration:none;color:#1a82e2;">Your project on Google Apps Script</a></p>
      <p><a href="https://t.me/tradinghelperblog" style="text-decoration:none;color:#1a82e2;">Trading Helper Telegram</a></p>
    </div>
  `;

  return `<!DOCTYPE htmlPUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
  <html lang="en">
  
  <head>
    <meta http-equiv="Content-Type" content="text/html charset=UTF-8" />
  </head>

  <table style="width:100%;background-color:#f6f9fc;padding:10px 0" align="center" border="0" cellPadding="0"
    cellSpacing="0" role="presentation">
    <tbody>
      <tr>
        <td>
          <div><!--[if mso | IE]>
                  <table role="presentation" width="100%" align="center" style="max-width:37.5em;margin:0 auto;background-color:#ffffff;border:1px solid #f0f0f0;width:600px;padding:45px;"><tr><td></td><td style="width:37.5em;background:#ffffff">
                <![endif]--></div>
          <div
            style="max-width:37.5em;margin:0 auto;background-color:#ffffff;border:1px solid #f0f0f0;width:600px;padding:45px">
            <div style="display:flex;align-items:center;">
              <img alt="Trading Helper Logo"
                src="https://user-images.githubusercontent.com/7527778/167810306-0b882d1b-64b0-4fab-b647-9c3ef01e46b4.png"
                width="50" height="50" style="display:block;outline:none;border:none;text-decoration:none" />
              <h1
                style="margin:0 16px;font-family:&#x27;Open Sans&#x27;, &#x27;HelveticaNeue-Light&#x27;, &#x27;Helvetica Neue Light&#x27;, &#x27;Helvetica Neue&#x27;, Helvetica, Arial, &#x27;Lucida Grande&#x27;, sans-serif;font-weight:300;color:#404040">
                Trading Helper</h1>
            </div>
            <table style="width:100%" align="center" border="0" cellPadding="0" cellSpacing="0" role="presentation">
              <tbody>
                <tr>
                  <td>
                    ${alertsLog.length > 0 ? alerts : ``}</p>
                    ${infoLog.length > 0 ? infos : ``}
                    ${errLog.length > 0 ? errors : ``}
                    ${debugLog.length > 0 ? debugs : ``}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div><!--[if mso | IE]>
                </td><td></td></tr></table>
                <![endif]--></div>
          <!-- Footer content -->
          ${footer}
        </td>
      </tr>
    </tbody>
  </table>
  
  </html>`;
}
