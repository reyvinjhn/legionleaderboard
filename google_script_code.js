function doGet(e) {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var data = sheet.getDataRange().getValues();
    var result = [];

    // Skip header row
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
        var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
        var data;

        try {
            data = JSON.parse(e.postData.contents);
        } catch (err) {
            data = e.parameter;
        }

        var name = data.name;
        var score = parseInt(data.score) || 0; // Default 0 for emblem-only adds
        var action = data.action || 'add';
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

            return ContentService.createTextOutput(JSON.stringify({ result: "success", action: "set", score: score }))
                .setMimeType(ContentService.MimeType.JSON);
        }

        else if (action === 'add_emblem') {
            // Update Strategy: Append a new row with the emblem and NO score.
            // This ensures we do not accidentally delete/modify existing score rows.
            // script.js aggregates this correctly.
            sheet.appendRow([targetName, "", emblem]);

            return ContentService.createTextOutput(JSON.stringify({ result: "success", action: "add_emblem", emblem: emblem }))
                .setMimeType(ContentService.MimeType.JSON);
        }

        else {
            // 'add' (Score add)
            sheet.appendRow([targetName, score, ""]); // Add empty string for emblem column
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
