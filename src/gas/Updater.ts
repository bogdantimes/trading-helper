// Upgrade functionality requires the additional library and scopes in appsscript.json:
// Scopes:
// "https://www.googleapis.com/auth/drive",
// "https://www.googleapis.com/auth/drive.scripts"
// Libraries:
// GASProjectApp (1to51j1yqDvtTrJIoHzgOffCnZOK9MTCcSkky6niwRJlTLTNpxIfj3bI-)

import { Log } from "./Common";
import { UpgradeInfo } from "../lib/index";

export class Updater {
  static OTAUpdate(): string {
    // @ts-expect-error
    const curVer = VERSION;
    const { files, newVersion, URL }: UpgradeInfo =
      global.TradingHelperLibrary.getUpgrades(curVer);

    if (newVersion === curVer || !files?.length) {
      Log.alert(`ℹ️ Trading Helper is up to date.`);
      return `ℹ️ Trading Helper is up to date.`;
    }

    Log.alert(`ℹ️ Upgrading to version ${newVersion}`);

    const scriptId = ScriptApp.getScriptId();
    const response = global.GASProjectApp.getProject(scriptId).getContentText();
    const projectFiles = JSON.parse(response).files;

    if (!projectFiles) {
      const errMsg = `❌ Upgrade failed: couldn't get project files from the Drive.`;
      Log.alert(errMsg);
      return errMsg;
    }

    files.forEach((f) => {
      const existingFile = projectFiles.find((pf) => pf.name === f.name);
      if (existingFile) f.id = existingFile.id;
    });

    const update = {
      fileId: scriptId,
      body: { files },
      fields: `name`,
    };

    try {
      const result =
        global.GASProjectApp.updateProject(update).getContentText();
      if (result.startsWith(`{`) && JSON.parse(result).error) {
        const errMsg = `❌ Upgrade failed: ${result}`;
        Log.alert(errMsg);
        return errMsg;
      }
    } catch (e) {
      const errMsg = `❌ Upgrade failed: ${e.message}`;
      Log.alert(errMsg);
      return errMsg;
    }

    const msg = `✅ Upgrade done. New version: ${newVersion}. Release notes: ${URL}.`;
    Log.alert(msg);
    return msg + ` Please reload the webpage.`;
  }
}
