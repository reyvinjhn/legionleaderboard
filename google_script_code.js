var VALID_USERS = {
    "james": "legiondotcc",
    "maaark": "legiondotcc",
    "jps": "legiondotcc",
    "josh": "legiondotcc",
    "reyvinjohn": "legiondotrj"
};

// --- Helper: Action Logger ---
function logAction(ss, username, action, boardName, details) {
    try {
        var logSheetName = '_ActivityLog';
        var logSheet = ss.getSheetByName(logSheetName);

        // Create the log sheet if it doesn't exist
        if (!logSheet) {
            logSheet = ss.insertSheet(logSheetName);
            logSheet.appendRow(["Timestamp", "Username", "Action", "Board", "Details"]);
            logSheet.getRange("A1:E1").setFontWeight("bold");
            logSheet.setFrozenRows(1);
            // Optional: Hide the log sheet so it doesn't clutter the UI for sheet owners
            logSheet.hideSheet();
        }

        var timestamp = new Date();
        logSheet.appendRow([timestamp, username, action, boardName || "N/A", details || ""]);
    } catch (e) {
        // Silently fail logging rather than breaking the main app
        console.error("Failed to log action: ", e);
    }
}

function doGet(e) {
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    // Action: verify_password
    if (e.parameter.action === 'verify_password') {
        var username = e.parameter.username;
        var password = e.parameter.password;

        if (username && VALID_USERS[username] === password) {
            return ContentService.createTextOutput(JSON.stringify({ result: "success" }))
                .setMimeType(ContentService.MimeType.JSON);
        } else {
            return ContentService.createTextOutput(JSON.stringify({ result: "error", error: "Invalid username or password" }))
                .setMimeType(ContentService.MimeType.JSON);
        }
    }

    // Action: list_boards
    if (e.parameter.action === 'list_boards') {
        var sheets = ss.getSheets();
        var boards = [];
        // Fetch all properties at once to avoid O(N) latency in the loop
        var allProps = PropertiesService.getDocumentProperties().getProperties();

        for (var i = 0; i < sheets.length; i++) {
            var sheet = sheets[i];
            var name = sheet.getName();
            if (name !== '_ActivityLog') {
                // Fetch the creator from memory dictionary
                var creator = allProps["creator_" + name] || "";

                boards.push({
                    name: name,
                    creator: creator
                });
            }
        }
        return ContentService.createTextOutput(JSON.stringify({ boards: boards }))
            .setMimeType(ContentService.MimeType.JSON);
    }

    // Default GET: Fetch board data
    var boardName = e.parameter.board;
    var sheet;

    if (boardName) {
        sheet = ss.getSheetByName(boardName);
    } else {
        sheet = ss.getActiveSheet(); // fallback
    }

    if (!sheet) {
        return ContentService.createTextOutput(JSON.stringify({ error: "Board not found." }))
            .setMimeType(ContentService.MimeType.JSON);
    }

    var data = sheet.getDataRange().getValues();
    var result = [];

    // Skip header row if it exists, but typically we just read from row 2
    for (var i = 1; i < data.length; i++) {
        if (data[i][0]) { // If name exists
            result.push({
                name: data[i][0],
                score: data[i][1],
                emblems: data[i][2] || "" // Column C
            });
        }
    }

    return ContentService.createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
    var lock = LockService.getScriptLock();
    lock.tryLock(10000);

    try {
        var ss = SpreadsheetApp.getActiveSpreadsheet();
        var data;

        try {
            data = JSON.parse(e.postData.contents);
        } catch (err) {
            data = e.parameter;
        }

        var action = data.action || 'add';
        var username = data.username;
        var password = data.password;

        if (!username || VALID_USERS[username] !== password) {
            return ContentService.createTextOutput(JSON.stringify({ result: "error", error: "Unauthorized access: Invalid credentials" }))
                .setMimeType(ContentService.MimeType.JSON);
        }

        var boardName = data.board;
        var sheet;

        // --- Dashboard Actions ---
        if (action === 'create_board') {
            if (!boardName) throw new Error("No board name provided.");
            if (ss.getSheetByName(boardName)) {
                return ContentService.createTextOutput(JSON.stringify({ result: "error", error: "Board already exists." }))
                    .setMimeType(ContentService.MimeType.JSON);
            }
            sheet = ss.insertSheet(boardName);
            // Setup headers
            sheet.appendRow(["Player Name", "Score", "Emblems"]);
            sheet.getRange("A1:C1").setFontWeight("bold");

            // Save creator directly to Document Properties
            PropertiesService.getDocumentProperties().setProperty("creator_" + boardName, username);

            // Log creation
            logAction(ss, username, "Created Board", boardName, "");

            return ContentService.createTextOutput(JSON.stringify({ result: "success", action: "create_board", board: boardName }))
                .setMimeType(ContentService.MimeType.JSON);
        }

        if (action === 'delete_board') {
            if (!boardName) throw new Error("No board name provided.");
            sheet = ss.getSheetByName(boardName);
            if (!sheet) throw new Error("Board not found.");

            // Prevent deleting the very last sheet (or if the only sheets left are the board and the log)
            var visibleSheetsCount = ss.getSheets().filter(function (s) { return s.getName() !== '_ActivityLog'; }).length;
            if (visibleSheetsCount <= 1) {
                return ContentService.createTextOutput(JSON.stringify({ result: "error", error: "Cannot delete the only remaining board." }))
                    .setMimeType(ContentService.MimeType.JSON);
            }

            ss.deleteSheet(sheet);

            // Delete creator from properties
            PropertiesService.getDocumentProperties().deleteProperty("creator_" + boardName);

            // Log deletion
            logAction(ss, username, "Deleted Board", boardName, "");

            return ContentService.createTextOutput(JSON.stringify({ result: "success", action: "delete_board", board: boardName }))
                .setMimeType(ContentService.MimeType.JSON);
        }
        // -------------------------

        // Obtain Sheet Context for standard actions
        if (boardName) {
            sheet = ss.getSheetByName(boardName);
        } else {
            sheet = ss.getActiveSheet();
        }

        if (!sheet) {
            return ContentService.createTextOutput(JSON.stringify({ result: "error", error: "Board not found" }))
                .setMimeType(ContentService.MimeType.JSON);
        }

        var name = data.name;
        var score = parseInt(data.score) || 0; // Default 0 for emblem-only adds
        var emblem = data.emblem || "";

        if (!name) {
            return ContentService.createTextOutput(JSON.stringify({ result: "error", error: "No name provided" }))
                .setMimeType(ContentService.MimeType.JSON);
        }

        var targetName = name.toString().trim();

        // Helper to collect data before delete
        var range = sheet.getDataRange();
        var values = range.getValues();

        if (action === 'delete') {
            var deletedCount = 0;
            for (var i = values.length - 1; i >= 1; i--) {
                var rowName = values[i][0] ? values[i][0].toString().trim() : "";
                if (rowName === targetName) {
                    sheet.deleteRow(i + 1);
                    deletedCount++;
                }
            }

            // Log delete
            logAction(ss, username, "Deleted Player", boardName, "Player: " + targetName);

            return ContentService.createTextOutput(JSON.stringify({ result: "success", message: "Deleted " + deletedCount }))
                .setMimeType(ContentService.MimeType.JSON);
        }

        else if (action === 'set') {
            // "Set Score" - Must preserve existing emblems while resetting score
            var validEmblems = [];

            // 1. Collect existing emblems from rows we are about to delete
            for (var i = values.length - 1; i >= 1; i--) {
                var rowName = values[i][0] ? values[i][0].toString().trim() : "";
                if (rowName === targetName) {
                    var existing = values[i][2]; // Col C
                    if (existing && existing.toString().trim() !== "") {
                        validEmblems.push(existing.toString().trim());
                    }
                    sheet.deleteRow(i + 1);
                }
            }

            // 2. Append new row with preserved emblems
            // Deduplicate emblems just in case
            var uniqueEmblems = [];
            if (validEmblems.length > 0) {
                // Join all, split by comma, filter unique
                var all = validEmblems.join(",").split(",");
                // Filter empty and trim
                var clean = [];
                var seen = {};
                for (var k = 0; k < all.length; k++) {
                    var txt = all[k].trim();
                    if (txt && !seen[txt]) {
                        clean.push(txt);
                        seen[txt] = true;
                    }
                }
                uniqueEmblems = clean;
            }

            var combinedEmblems = uniqueEmblems.join(",");
            sheet.appendRow([targetName, score, combinedEmblems]);

            // Log set score
            logAction(ss, username, "Set Score", boardName, "Player: " + targetName + ", New Score: " + score);

            return ContentService.createTextOutput(JSON.stringify({ result: "success", action: "set", score: score }))
                .setMimeType(ContentService.MimeType.JSON);
        }

        else if (action === 'add_emblem') {
            // Update Strategy: Append a new row with the emblem and NO score.
            sheet.appendRow([targetName, "", emblem]);

            // Log emblem
            logAction(ss, username, "Awarded Emblem", boardName, "Player: " + targetName + ", Emblem: " + emblem);

            return ContentService.createTextOutput(JSON.stringify({ result: "success", action: "add_emblem", emblem: emblem }))
                .setMimeType(ContentService.MimeType.JSON);
        }

        else {
            // 'add' (Score add)
            sheet.appendRow([targetName, score, ""]); // Add empty string for emblem column

            // Log add score
            logAction(ss, username, "Added Score", boardName, "Player: " + targetName + ", Added: " + score);

            return ContentService.createTextOutput(JSON.stringify({ result: "success", action: "add", added: score }))
                .setMimeType(ContentService.MimeType.JSON);
        }

    } catch (e) {
        return ContentService.createTextOutput(JSON.stringify({ result: "error", error: e.toString() }))
            .setMimeType(ContentService.MimeType.JSON);
    } finally {
        lock.releaseLock();
    }
}
