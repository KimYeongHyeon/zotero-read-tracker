var ZoteroReadTracker;
var ZoteroReadTrackerHeatmap;
var ResearchActivity;
var ResearchActivityModel;

function log(msg) {
    Zotero.debug("ZoteroReadTracker: " + msg);
}

function install() {
    log("Installed");
}

async function startup({ id, version, rootURI }) {
    log("Starting");

    Services.scriptloader.loadSubScript(rootURI + "readTracker.js");
    Services.scriptloader.loadSubScript(rootURI + "heatmapBuilder.js");

    Services.scriptloader.loadSubScript(rootURI + "activityModel.js");
    Services.scriptloader.loadSubScript(rootURI + "activityRuntime.js");
    ZoteroReadTracker.init({ id, version, rootURI });

    await Zotero.uiReadyPromise;
    await ZoteroReadTracker.registerColumn();
    Zotero.ResearchActivity = ResearchActivity;
    await ResearchActivity.init({ id, rootURI });

    var windows = Zotero.getMainWindows();
    for (var i = 0; i < windows.length; i++) {
        if (windows[i].ZoteroPane) {
            ZoteroReadTracker.addToWindow(windows[i]);
        }
    }
}

function onMainWindowLoad({ window }) {
    ZoteroReadTracker.addToWindow(window);
}

function onMainWindowUnload({ window }) {
    ZoteroReadTracker.removeFromWindow(window);
}

async function shutdown() {
    if (ResearchActivity) {
        try { await ResearchActivity.shutdown(); } catch (error) { Zotero.logError(error); }
    }
    delete Zotero.ResearchActivity;
    log("Shutting down");
    if (ZoteroReadTracker) {
        var windows = Zotero.getMainWindows();
        for (var i = 0; i < windows.length; i++) {
            ZoteroReadTracker.removeFromWindow(windows[i]);
        }
        ZoteroReadTracker.unregisterColumn();
        ZoteroReadTracker = undefined;
    }
    if (ZoteroReadTrackerHeatmap) {
        ZoteroReadTrackerHeatmap = undefined;
    }
}

function uninstall() {
    log("Uninstalled");
}