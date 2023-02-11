// Upgrade functionality requires the additional library and scopes in appsscript.json:
// Scopes:
// "https://www.googleapis.com/auth/drive",
// "https://www.googleapis.com/auth/drive.scripts"
// Libraries:
// GASProjectApp (1to51j1yqDvtTrJIoHzgOffCnZOK9MTCcSkky6niwRJlTLTNpxIfj3bI-)

import { Log } from "./Common";
import { type UpgradeInfo } from "../lib/index";
import { compare } from "compare-versions";

export const UpgradeDone = `Upgrade done`;

export class Updater {
  static upgrade(): string {
    // @ts-expect-error VERSION is injected by esbuild
    const curVer = `v${VERSION}`;
    const { files, newVersion, URL }: UpgradeInfo =
      global.TradingHelperLibrary.getUpgrades(curVer);

    if (!newVersion || compare(curVer, newVersion, `>=`) || !files?.length) {
      Log.info(`ℹ️ Trading Helper is up to date.`);
      return `ℹ️ Trading Helper is up to date.`;
    }

    Log.alert(`ℹ️ Upgrading to version ${newVersion}`);

    const scriptId = ScriptApp.getScriptId();
    const response = global.GASProjectApp.getProject(scriptId).getContentText();
    const projectFiles = JSON.parse(response).files;

    const nextAttemptMsg = `Next attempt in 6 hours. You can remove "upgrade" trigger in Google Apps Script project to disable it.`;
    if (!projectFiles) {
      const errMsg = `❌ Upgrade failed: couldn't get project files from the Drive. ${nextAttemptMsg}`;
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
        const errMsg = `❌ Upgrade failed: ${result}. ${nextAttemptMsg}`;
        Log.alert(errMsg);
        return errMsg;
      }
    } catch (e) {
      const errMsg = `❌ Upgrade failed: ${e.message}. ${nextAttemptMsg}`;
      Log.alert(errMsg);
      return errMsg;
    }

    const msg = `✅ ${UpgradeDone}. New version: ${newVersion}. Release notes: ${URL}.`;
    Log.alert(msg);
    return msg + ` Please reload the webpage.`;
  }
}
