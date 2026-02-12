var ZoteroReadTracker;
var ZoteroReadTrackerHeatmap;

function log(msg) {
    Zotero.debug("ZoteroReadTracker: " + msg);
}

function install() {
    log("Installed");
}

async function startup({ id, version, rootURI }) {
    log("Starting");

    Services.scriptloader.loadSubScript(
        rootURI + "heatmapBuilder.js"
    );
    Services.scriptloader.loadSubScript(
        rootURI + "readTracker.js"
    );

    ZoteroReadTracker.init({ id, version, rootURI });

    await Zotero.uiReadyPromise;
    await ZoteroReadTracker.registerColumn();

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

function shutdown() {
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