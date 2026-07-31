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
const USERS_SHEET_NAME = "users";
const SUPER_ADMIN_EMAIL = "akaporn1234@gmail.com";
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
  "uploadedBy",
];
const USER_HEADERS = [
  "id",
  "email",
  "firstName",
  "lastName",
  "position",
  "workplace",
  "phone",
  "role",
  "status",
  "provider",
  "providerAccountId",
  "lineUserId",
  "imageUrl",
  "createdAt",
  "updatedAt",
  "approvedAt",
  "approvedBy",
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
    if (payload.action === "getUser") {
      return jsonOutput_({ ok: true, user: getUser_(payload) });
    }
    if (payload.action === "requestUser") {
      return jsonOutput_({ ok: true, user: requestUser_(payload) });
    }
    if (payload.action === "updateProfile") {
      return jsonOutput_({ ok: true, user: updateProfile_(payload) });
    }
    if (payload.action === "listUsers") {
      return jsonOutput_({ ok: true, users: listUsers_() });
    }
    if (payload.action === "manageUser") {
      return jsonOutput_({ ok: true, user: manageUser_(payload) });
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
  ensureSheetHeaders_(sheet, HEADERS);

  let usersSheet = spreadsheet.getSheetByName(USERS_SHEET_NAME);
  if (!usersSheet) usersSheet = spreadsheet.insertSheet(USERS_SHEET_NAME);
  ensureSheetHeaders_(usersSheet, USER_HEADERS);
  ensureSuperAdmin_(usersSheet);

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
    uploadedBy: String(payload.uploadedBy || ""),
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

function ensureSheetHeaders_(sheet, requiredHeaders) {
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, requiredHeaders.length).setValues([requiredHeaders]);
    sheet.setFrozenRows(1);
    return;
  }

  const lastColumn = Math.max(sheet.getLastColumn(), 1);
  const currentHeaders = sheet
    .getRange(1, 1, 1, lastColumn)
    .getValues()[0]
    .map(String);
  const missingHeaders = requiredHeaders.filter(function (header) {
    return currentHeaders.indexOf(header) < 0;
  });
  if (missingHeaders.length) {
    sheet
      .getRange(1, currentHeaders.length + 1, 1, missingHeaders.length)
      .setValues([missingHeaders]);
  }
  sheet.setFrozenRows(1);
}

function ensureSuperAdmin_(sheet) {
  const state = getSheetState_(sheet);
  const index = findUserIndex_(state.rows, SUPER_ADMIN_EMAIL, "");
  const now = new Date().toISOString();

  if (index < 0) {
    const user = {
      id: Utilities.getUuid(),
      email: SUPER_ADMIN_EMAIL,
      firstName: "Akaporn",
      lastName: "ผู้ดูแลระบบ",
      position: "Super Admin",
      workplace: "สำนักงานสาธารณสุขจังหวัดสตูล",
      phone: "",
      role: "super_admin",
      status: "approved",
      provider: "google",
      providerAccountId: "",
      lineUserId: "",
      imageUrl: "",
      createdAt: now,
      updatedAt: now,
      approvedAt: now,
      approvedBy: "system",
    };
    sheet.appendRow(objectToRow_(user, state.headers));
    return user;
  }

  const user = rowToObject_(state.rows[index], state.headers);
  let changed = false;
  if (user.role !== "super_admin") {
    user.role = "super_admin";
    changed = true;
  }
  if (user.status !== "approved") {
    user.status = "approved";
    changed = true;
  }
  if (user.provider !== "google") {
    user.provider = "google";
    changed = true;
  }
  if (changed) {
    user.updatedAt = now;
    user.approvedAt = user.approvedAt || now;
    user.approvedBy = user.approvedBy || "system";
    writeUserAt_(sheet, index, state.headers, user);
  }
  return user;
}

function getUser_(payload) {
  const resources = ensureResources_();
  const spreadsheet = SpreadsheetApp.openById(resources.spreadsheetId);
  const sheet = spreadsheet.getSheetByName(USERS_SHEET_NAME);
  const email = normalizeEmail_(payload.email);
  const providerAccountId = String(payload.providerAccountId || "");
  const state = getSheetState_(sheet);
  const index = findUserIndex_(state.rows, email, providerAccountId);
  if (index < 0) return null;

  const user = rowToObject_(state.rows[index], state.headers);
  let changed = false;
  if (email === SUPER_ADMIN_EMAIL) {
    if (user.role !== "super_admin") {
      user.role = "super_admin";
      changed = true;
    }
    if (user.status !== "approved") {
      user.status = "approved";
      changed = true;
    }
  }
  if (payload.provider === "google" && email && user.email === email) {
    if (user.provider !== "google") {
      user.provider = "google";
      changed = true;
    }
    if (providerAccountId && user.providerAccountId !== providerAccountId) {
      user.providerAccountId = providerAccountId;
      changed = true;
    }
  }
  const imageUrl = String(payload.imageUrl || "");
  if (imageUrl && user.imageUrl !== imageUrl) {
    user.imageUrl = imageUrl;
    changed = true;
  }
  if (changed) {
    user.updatedAt = new Date().toISOString();
    writeUserAt_(sheet, index, state.headers, user);
  }
  return normalizeUser_(user);
}

function requestUser_(payload) {
  const email = normalizeEmail_(payload.email);
  const firstName = requiredText_(payload.firstName, "firstName");
  const lastName = requiredText_(payload.lastName, "lastName");
  const position = requiredText_(payload.position, "position");
  const workplace = requiredText_(payload.workplace, "workplace");
  const phone = requiredText_(payload.phone, "phone");
  if (!isGmail_(email)) throw new Error("A valid Gmail address is required");

  const resources = ensureResources_();
  const spreadsheet = SpreadsheetApp.openById(resources.spreadsheetId);
  const sheet = spreadsheet.getSheetByName(USERS_SHEET_NAME);
  const state = getSheetState_(sheet);
  const providerAccountId = String(payload.providerAccountId || "");
  const provider = payload.provider === "line" ? "line" : "google";
  const providerIndex = findUserIndex_(state.rows, "", providerAccountId);
  const emailIndex = findUserIndex_(state.rows, email, "");
  if (
    provider === "line" &&
    emailIndex >= 0 &&
    emailIndex !== providerIndex
  ) {
    throw new Error("This Gmail address is already registered");
  }
  if (provider === "line" && email === SUPER_ADMIN_EMAIL) {
    throw new Error("This Gmail address must sign in with Google");
  }
  const index = provider === "line"
    ? providerIndex
    : findUserIndex_(state.rows, email, providerAccountId);
  const now = new Date().toISOString();
  const existing =
    index >= 0 ? rowToObject_(state.rows[index], state.headers) : {};
  const isProtectedSuperAdmin = email === SUPER_ADMIN_EMAIL;
  const user = {
    id: existing.id || Utilities.getUuid(),
    email: email,
    firstName: firstName,
    lastName: lastName,
    position: position,
    workplace: workplace,
    phone: phone,
    role: isProtectedSuperAdmin ? "super_admin" : existing.role || "uploader",
    status: isProtectedSuperAdmin
      ? "approved"
      : existing.status === "approved"
        ? "approved"
        : "pending",
    provider: provider,
    providerAccountId: providerAccountId || existing.providerAccountId || "",
    lineUserId:
      provider === "line"
        ? providerAccountId
        : existing.lineUserId || "",
    imageUrl: String(payload.imageUrl || existing.imageUrl || ""),
    createdAt: existing.createdAt || now,
    updatedAt: now,
    approvedAt: isProtectedSuperAdmin
      ? existing.approvedAt || now
      : existing.approvedAt || "",
    approvedBy: isProtectedSuperAdmin
      ? existing.approvedBy || "system"
      : existing.approvedBy || "",
  };

  if (index < 0) {
    sheet.appendRow(objectToRow_(user, state.headers));
  } else {
    writeUserAt_(sheet, index, state.headers, user);
  }
  return normalizeUser_(user);
}

function updateProfile_(payload) {
  const email = normalizeEmail_(payload.email);
  const resources = ensureResources_();
  const spreadsheet = SpreadsheetApp.openById(resources.spreadsheetId);
  const sheet = spreadsheet.getSheetByName(USERS_SHEET_NAME);
  const state = getSheetState_(sheet);
  const index = findUserIndex_(
    state.rows,
    email,
    String(payload.providerAccountId || ""),
  );
  if (index < 0) throw new Error("User not found");

  const user = rowToObject_(state.rows[index], state.headers);
  user.firstName = requiredText_(payload.firstName, "firstName");
  user.lastName = requiredText_(payload.lastName, "lastName");
  user.position = requiredText_(payload.position, "position");
  user.workplace = requiredText_(payload.workplace, "workplace");
  user.phone = requiredText_(payload.phone, "phone");
  user.imageUrl = String(payload.imageUrl || user.imageUrl || "");
  user.updatedAt = new Date().toISOString();
  writeUserAt_(sheet, index, state.headers, user);
  return normalizeUser_(user);
}

function listUsers_() {
  const resources = ensureResources_();
  const spreadsheet = SpreadsheetApp.openById(resources.spreadsheetId);
  const sheet = spreadsheet.getSheetByName(USERS_SHEET_NAME);
  const state = getSheetState_(sheet);
  const order = { pending: 0, approved: 1, rejected: 2 };
  return state.rows
    .filter(function (row) {
      return String(row[0] || "");
    })
    .map(function (row) {
      return normalizeUser_(rowToObject_(row, state.headers));
    })
    .sort(function (a, b) {
      const statusDifference =
        (order[a.status] === undefined ? 9 : order[a.status]) -
        (order[b.status] === undefined ? 9 : order[b.status]);
      if (statusDifference) return statusDifference;
      return String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""));
    });
}

function manageUser_(payload) {
  const email = normalizeEmail_(payload.email);
  if (!email || email === SUPER_ADMIN_EMAIL) {
    throw new Error("This account cannot be modified");
  }
  const status = String(payload.status || "");
  const role = String(payload.role || "");
  if (["pending", "approved", "rejected"].indexOf(status) < 0) {
    throw new Error("Invalid user status");
  }
  if (["admin", "uploader"].indexOf(role) < 0) {
    throw new Error("Invalid user role");
  }

  const resources = ensureResources_();
  const spreadsheet = SpreadsheetApp.openById(resources.spreadsheetId);
  const sheet = spreadsheet.getSheetByName(USERS_SHEET_NAME);
  const state = getSheetState_(sheet);
  const index = findUserIndex_(state.rows, email, "");
  if (index < 0) throw new Error("User not found");

  const user = rowToObject_(state.rows[index], state.headers);
  const now = new Date().toISOString();
  user.status = status;
  user.role = role;
  user.updatedAt = now;
  if (status === "approved") {
    user.approvedAt = now;
    user.approvedBy = String(payload.approvedBy || "");
  }
  writeUserAt_(sheet, index, state.headers, user);
  return normalizeUser_(user);
}

function getSheetState_(sheet) {
  const values = sheet.getDataRange().getValues();
  return {
    headers: (values[0] || USER_HEADERS).map(String),
    rows: values.slice(1),
  };
}

function findUserIndex_(rows, email, providerAccountId) {
  const emailColumn = USER_HEADERS.indexOf("email");
  const providerColumn = USER_HEADERS.indexOf("providerAccountId");
  for (let index = 0; index < rows.length; index += 1) {
    const rowEmail = normalizeEmail_(rows[index][emailColumn]);
    const rowProviderAccountId = String(rows[index][providerColumn] || "");
    if (
      (email && rowEmail === email) ||
      (providerAccountId && rowProviderAccountId === providerAccountId)
    ) {
      return index;
    }
  }
  return -1;
}

function rowToObject_(row, headers) {
  const item = {};
  headers.forEach(function (header, index) {
    item[header] = row[index];
  });
  return item;
}

function objectToRow_(item, headers) {
  return headers.map(function (header) {
    return item[header] || "";
  });
}

function writeUserAt_(sheet, rowIndex, headers, user) {
  sheet
    .getRange(rowIndex + 2, 1, 1, headers.length)
    .setValues([objectToRow_(user, headers)]);
}

function normalizeUser_(user) {
  const normalized = {};
  USER_HEADERS.forEach(function (header) {
    normalized[header] = String(user[header] || "");
  });
  normalized.email = normalizeEmail_(normalized.email);
  normalized.role =
    ["super_admin", "admin", "uploader"].indexOf(normalized.role) >= 0
      ? normalized.role
      : "uploader";
  normalized.status =
    ["pending", "approved", "rejected"].indexOf(normalized.status) >= 0
      ? normalized.status
      : "pending";
  normalized.provider = normalized.provider === "line" ? "line" : "google";
  return normalized;
}

function normalizeEmail_(value) {
  return String(value || "").trim().toLowerCase();
}

function isGmail_(email) {
  return /^[a-z0-9._%+-]+@gmail\.com$/.test(email);
}

function requiredText_(value, fieldName) {
  const text = String(value || "").trim();
  if (!text) throw new Error("Missing " + fieldName);
  return text;
}

function jsonOutput_(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(
    ContentService.MimeType.JSON,
  );
}
