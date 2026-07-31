/**
 * Google Apps Script backend for:
 * คลังสื่อสารความเสี่ยง สำนักงานสาธารณสุขจังหวัดสตูล
 *
 * 1) Replace WEBHOOK_SECRET with a long random value.
 * 2) Run setupSatunRiskGallery() once and grant permissions.
 * 3) Deploy as a Web app: Execute as "Me", access "Anyone".
 * 4) Add the deployment URL and the same secret to the website settings.
 */

const WEBHOOK_SECRET = "CHANGE_ME_TO_A_LONG_RANDOM_SECRET";
const FOLDER_NAME = "คลังสื่อสารความเสี่ยง สสจ.สตูล";
const SPREADSHEET_NAME = "ฐานข้อมูลคลังสื่อสารความเสี่ยง สสจ.สตูล";
const SHEET_NAME = "media";
const HEADERS = [
  "id",
  "title",
  "description",
  "phase",
  "category",
  "eventDate",
  "location",
  "keywords",
  "altText",
  "thumbnailUrl",
  "downloadUrl",
  "driveFileId",
  "fileName",
  "fileType",
  "status",
  "createdAt",
];

function setupSatunRiskGallery() {
  const resources = ensureResources_();
  console.log(JSON.stringify(resources));
  return resources;
}

function doGet(event) {
  try {
    const action = String((event && event.parameter && event.parameter.action) || "list");
    if (action === "list") {
      const status = String((event.parameter && event.parameter.status) || "published");
      return jsonOutput_({ ok: true, items: listMedia_(status) });
    }
    return jsonOutput_({ ok: false, error: "Unknown action" });
  } catch (error) {
    return jsonOutput_({ ok: false, error: String(error && error.message ? error.message : error) });
  }
}

function doPost(event) {
  try {
    const payload = JSON.parse((event && event.postData && event.postData.contents) || "{}");
    if (!WEBHOOK_SECRET || WEBHOOK_SECRET.indexOf("CHANGE_ME") === 0) {
      throw new Error("Please configure WEBHOOK_SECRET before deployment.");
    }
    if (payload.secret !== WEBHOOK_SECRET) {
      throw new Error("Unauthorized");
    }

    if (payload.action === "status") {
      const resources = ensureResources_();
      return jsonOutput_({
        ok: true,
        folderName: resources.folderName,
        sheetName: resources.sheetName,
      });
    }
    if (payload.action === "upload") {
      return jsonOutput_({ ok: true, item: uploadMedia_(payload) });
    }
    if (payload.action === "delete") {
      deleteMedia_(String(payload.id || ""));
      return jsonOutput_({ ok: true });
    }
    throw new Error("Unknown action");
  } catch (error) {
    return jsonOutput_({ ok: false, error: String(error && error.message ? error.message : error) });
  }
}

function ensureResources_() {
  const properties = PropertiesService.getScriptProperties();
  let folderId = properties.getProperty("SATUN_FOLDER_ID");
  let spreadsheetId = properties.getProperty("SATUN_SHEET_ID");
  let folder;
  let spreadsheet;

  try {
    folder = folderId ? DriveApp.getFolderById(folderId) : null;
  } catch (_) {
    folder = null;
  }
  if (!folder) {
    folder = DriveApp.createFolder(FOLDER_NAME);
    folderId = folder.getId();
    properties.setProperty("SATUN_FOLDER_ID", folderId);
  }

  try {
    spreadsheet = spreadsheetId ? SpreadsheetApp.openById(spreadsheetId) : null;
  } catch (_) {
    spreadsheet = null;
  }
  if (!spreadsheet) {
    spreadsheet = SpreadsheetApp.create(SPREADSHEET_NAME);
    spreadsheetId = spreadsheet.getId();
    properties.setProperty("SATUN_SHEET_ID", spreadsheetId);
  }

  let sheet = spreadsheet.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = spreadsheet.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    sheet.setFrozenRows(1);
  }

  return {
    folderId: folderId,
    spreadsheetId: spreadsheetId,
    folderName: folder.getName(),
    sheetName: spreadsheet.getName(),
  };
}

function listMedia_(status) {
  const resources = ensureResources_();
  const spreadsheet = SpreadsheetApp.openById(resources.spreadsheetId);
  const sheet = spreadsheet.getSheetByName(SHEET_NAME);
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];

  const headers = values[0].map(String);
  return values
    .slice(1)
    .map(function (row) {
      const item = {};
      headers.forEach(function (header, index) {
        item[header] = row[index];
      });
      item.keywords = String(item.keywords || "")
        .split("|")
        .filter(Boolean);
      return item;
    })
    .filter(function (item) {
      return !status || item.status === status;
    })
    .sort(function (a, b) {
      return String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
    });
}

function uploadMedia_(payload) {
  const resources = ensureResources_();
  const folder = DriveApp.getFolderById(resources.folderId);
  const filePayload = payload.file || {};
  const bytes = Utilities.base64Decode(String(filePayload.base64 || ""));
  const blob = Utilities.newBlob(bytes, String(filePayload.type || "application/octet-stream"), String(filePayload.name || "upload"));
  const file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  const now = new Date().toISOString();
  const id = Utilities.getUuid();
  const item = {
    id: id,
    title: String(payload.title || ""),
    description: String(payload.description || ""),
    phase: String(payload.phase || "before"),
    category: String(payload.category || "อื่นๆ"),
    eventDate: String(payload.eventDate || ""),
    location: String(payload.location || "จังหวัดสตูล"),
    keywords: Array.isArray(payload.keywords) ? payload.keywords : [],
    altText: String(payload.altText || ""),
    thumbnailUrl: "https://drive.google.com/thumbnail?id=" + file.getId() + "&sz=w1600",
    downloadUrl: "https://drive.google.com/uc?export=download&id=" + file.getId(),
    driveFileId: file.getId(),
    fileName: file.getName(),
    fileType: file.getMimeType(),
    status: payload.status === "draft" ? "draft" : "published",
    createdAt: now,
  };

  const spreadsheet = SpreadsheetApp.openById(resources.spreadsheetId);
  const sheet = spreadsheet.getSheetByName(SHEET_NAME);
  sheet.appendRow(
    HEADERS.map(function (header) {
      if (header === "keywords") return item.keywords.join("|");
      return item[header] || "";
    }),
  );
  return item;
}

function deleteMedia_(id) {
  if (!id) throw new Error("Missing media id");
  const resources = ensureResources_();
  const spreadsheet = SpreadsheetApp.openById(resources.spreadsheetId);
  const sheet = spreadsheet.getSheetByName(SHEET_NAME);
  const values = sheet.getDataRange().getValues();
  const idColumn = HEADERS.indexOf("id");
  const fileColumn = HEADERS.indexOf("driveFileId");
  const statusColumn = HEADERS.indexOf("status");

  for (let rowIndex = 1; rowIndex < values.length; rowIndex += 1) {
    if (String(values[rowIndex][idColumn]) === id) {
      const fileId = String(values[rowIndex][fileColumn] || "");
      if (fileId) {
        try {
          DriveApp.getFileById(fileId).setTrashed(true);
        } catch (_) {}
      }
      sheet.getRange(rowIndex + 1, statusColumn + 1).setValue("deleted");
      return;
    }
  }
  throw new Error("Media not found");
}

function jsonOutput_(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(
    ContentService.MimeType.JSON,
  );
}
