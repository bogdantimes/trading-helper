interface Params {
	alerts: string[];
	errLog: Error[];
	debugLog: any[];
}

export default function getEmailTemplate({
	alerts,
	errLog,
	debugLog,
}: Params): string {
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
                    <p
                      style="font-size:16px;line-height:26px;margin:16px 0;font-family:&#x27;Open Sans&#x27;, &#x27;HelveticaNeue-Light&#x27;, &#x27;Helvetica Neue Light&#x27;, &#x27;Helvetica Neue&#x27;, Helvetica, Arial, &#x27;Lucida Grande&#x27;, sans-serif;font-weight:300;color:#404040">
                      ${
												alerts.length > 0
													? `${alerts.join(`<br />`)}<br /><br />`
													: ``
											}</p>
  
                    ${
											errLog.length > 0
												? `<p
                      style="font-size:16px;line-height:26px;margin:16px 0;font-family:&#x27;Open Sans&#x27;, &#x27;HelveticaNeue-Light&#x27;, &#x27;Helvetica Neue Light&#x27;, &#x27;Helvetica Neue&#x27;, Helvetica, Arial, &#x27;Lucida Grande&#x27;, sans-serif;font-weight:300;color:#404040">
                      Errors:<br /></p>
                    <code
                      style="display:inline-block;padding:16px 4.5%;width:90.5%;background-color:#f4f4f4;border-radius:5px;border:1px solid #eee;color:#333">${`${errLog
												.map((e) => `Stack: ${e.stack}`)
												.join(`<br/>`)}<br/><br/>`}</code>`
												: ``
										}
  
                    <p
                      style="font-size:16px;line-height:26px;margin:16px 0;font-family:&#x27;Open Sans&#x27;, &#x27;HelveticaNeue-Light&#x27;, &#x27;Helvetica Neue Light&#x27;, &#x27;Helvetica Neue&#x27;, Helvetica, Arial, &#x27;Lucida Grande&#x27;, sans-serif;font-weight:300;color:#404040">
                      ${
												debugLog.length > 0
													? `Debug info:<br />${debugLog.join(`<br /><br />`)}`
													: ``
											}</p>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div><!--[if mso | IE]>
                </td><td></td></tr></table>
                <![endif]--></div>
        </td>
      </tr>
    </tbody>
  </table>
  
  </html>`;
}
