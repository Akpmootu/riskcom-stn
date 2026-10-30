import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const SCRIPT_PATH = new URL(
  "../integrations/google-apps-script/Code.gs",
  import.meta.url,
);
const PRIMARY_SHEET_ID = "1Cr6Adjb90nc1a3bIwg_WvbTZ44g31MBmTVc-rlXwcbU";

async function loadAppsScript({ configuredSheetId, spreadsheets }) {
  const source = await readFile(SCRIPT_PATH, "utf8");
  const sandbox = {
    console,
    PropertiesService: {
      getScriptProperties() {
        return {
          getProperty(name) {
            return name === "SATUN_SHEET_ID" ? configuredSheetId : "";
          },
        };
      },
    },
    SpreadsheetApp: {
      openById(id) {
        const spreadsheet = spreadsheets.get(id);
        if (!spreadsheet) throw new Error(`Unknown spreadsheet: ${id}`);
        return spreadsheet;
      },
    },
  };

  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  return sandbox;
}

function spreadsheet(id) {
  return {
    getSheetByName(name) {
      return name === "media" ? { spreadsheetId: id, name } : null;
    },
  };
}

test("media reads stay on the primary Google Sheet when a stale script property points elsewhere", async () => {
  const appsScript = await loadAppsScript({
    configuredSheetId: "stale-empty-sheet",
    spreadsheets: new Map([
      [PRIMARY_SHEET_ID, spreadsheet(PRIMARY_SHEET_ID)],
      ["stale-empty-sheet", spreadsheet("stale-empty-sheet")],
    ]),
  });

  const mediaSheet = appsScript.getFastMediaSheet_();

  assert.equal(mediaSheet.spreadsheetId, PRIMARY_SHEET_ID);
});

