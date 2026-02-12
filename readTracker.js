var ZoteroReadTracker = {
    _id: null,
    _version: null,
    _rootURI: null,
    _initialized: false,
    _addedElementIDs: [],
    _registeredColumnID: null,

    // ───────────────── Init ─────────────────

    init: function(opts) {
        if (this._initialized) return;
        this._id = opts.id;
        this._version = opts.version;
        this._rootURI = opts.rootURI;
        this._initialized = true;
        this.log("Initialized v" + opts.version);
    },

    log: function(msg) {
        Zotero.debug("ZoteroReadTracker: " + msg);
    },

    // ───────────────── Data helpers ─────────────────

    /**
     * Get the read status of an item from its Extra field.
     *
     * @param {Zotero.Item} item
     * @return {boolean}
     */
    getReadStatus: function(item) {
        try {
            if (!item || !item.isRegularItem()) {
                return false;
            }
            var extra = item.getField("extra") || "";
            var match = extra.match(
                /^Read:\s*(true|false)\s*$/im
            );
            return match
                ? match[1].toLowerCase() === "true"
                : false;
        } catch (e) {
            this.log("getReadStatus error: " + e);
            return false;
        }
    },

    /**
     * Toggle the read status of an item.
     *
     * @param {Zotero.Item} item
     */
    toggleRead: async function(item) {
        try {
            var currentStatus = this.getReadStatus(item);
            var newStatus = !currentStatus;
            var extra = item.getField("extra") || "";

            extra = extra
                .split("\n")
                .filter(function(line) {
                    return !line.match(/^Read:/i)
                        && !line.match(/^Read-Date:/i);
                })
                .join("\n")
                .trim();

            if (newStatus) {
                var today = new Date().toISOString()
                    .split("T")[0];
                extra += "\nRead: true\nRead-Date: "
                    + today;
            } else {
                extra += "\nRead: false";
            }

            item.setField("extra", extra.trim());
            await item.saveTx();
            this.log("Toggled item " + item.id
                + " -> Read: " + newStatus);
        } catch (e) {
            this.log("toggleRead error: " + e);
        }
    },

    /**
     * Collect all Read-Date entries from the library.
     *
     * @return {Object} Map of date strings to counts
     */
    getReadDateCounts: async function() {
        var counts = {};
        try {
            var libraryID =
                Zotero.Libraries.userLibraryID;
            var items =
                await Zotero.Items.getAll(libraryID);
            for (var i = 0; i < items.length; i++) {
                var item = items[i];
                if (!item.isRegularItem()) continue;
                var extra = item.getField("extra") || "";
                var match = extra.match(
                    /^Read-Date:\s*([\d-]+)\s*$/im
                );
                if (match) {
                    var date = match[1];
                    counts[date] =
                        (counts[date] || 0) + 1;
                }
            }
        } catch (e) {
            this.log("getReadDateCounts error: " + e);
        }
        return counts;
    },

    // ───────────────── Streak calculator ─────────────────

    /**
     * Calculate the current reading streak.
     *
     * @param {Object} counts - Date count map
     * @return {number}
     */
    calcStreak: function(counts) {
        var today = new Date();
        var streak = 0;
        var d = new Date(today);

        var todayStr = d.toISOString().split("T")[0];
        if (!counts[todayStr]) {
            d.setDate(d.getDate() - 1);
        }

        while (true) {
            var key = d.toISOString().split("T")[0];
            if (counts[key] && counts[key] > 0) {
                streak++;
                d.setDate(d.getDate() - 1);
            } else {
                break;
            }
        }
        return streak;
    },

    // ───────────────── Column ─────────────────

    registerColumn: async function() {
        try {
            var self = this;
            this._registeredColumnID =
                await Zotero.ItemTreeManager
                    .registerColumns({
                        dataKey: "readStatus",
                        label: "Read Status",
                        pluginID: this._id,
                        dataProvider: function(item) {
                            try {
                                return self
                                    .getReadStatus(item)
                                    ? "\u2713" : "";
                            } catch (e) {
                                return "";
                            }
                        },
                    });
            this.log("Column registered");
        } catch (e) {
            this.log("registerColumn error: " + e);
        }
    },

    unregisterColumn: function() {
        try {
            if (this._registeredColumnID) {
                Zotero.ItemTreeManager.unregisterColumns(
                    this._registeredColumnID
                );
                this._registeredColumnID = null;
                this.log("Column unregistered");
            }
        } catch (e) {
            this.log("unregisterColumn error: " + e);
        }
    },

    // ───────────────── Open heatmap ─────────────────

    /**
     * Open the heatmap in the default browser.
     */
    openHeatmap: async function() {
        try {
            var counts = await this.getReadDateCounts();
            var streak = this.calcStreak(counts);
            this.log("Opening heatmap with "
                + Object.keys(counts).length + " dates, "
                + "streak: " + streak);

            var html = ZoteroReadTrackerHeatmap.buildHTML(
                counts, streak
            );

            var tmpFile = Zotero.getTempDirectory();
            tmpFile.append("readtracker_heatmap.html");
            await Zotero.File.putContentsAsync(
                tmpFile, html
            );

            var fileURI =
                Services.io.newFileURI(tmpFile).spec;
            this.log("Heatmap URI: " + fileURI);
            Zotero.launchURL(fileURI);
        } catch (e) {
            this.log("openHeatmap error: " + e);
        }
    },

    // ───────────────── Per-window UI ─────────────────

    addToWindow: function(window) {
        this.log("addToWindow");
        this._addContextMenu(window);
        this._addToolsMenu(window);
    },

    removeFromWindow: function(window) {
        this.log("removeFromWindow");
        var doc = window.document;
        for (var i = 0;
             i < this._addedElementIDs.length; i++) {
            var el = doc.getElementById(
                this._addedElementIDs[i]
            );
            if (el) el.remove();
        }
        this._addedElementIDs = [];
    },

    // ───────────────── Context menu ─────────────────

    _addContextMenu: function(window) {
        var doc = window.document;
        var menuID = "readtracker-toggle-read";

        var menu = doc.getElementById("zotero-itemmenu");
        if (!menu) {
            this.log("zotero-itemmenu not found");
            return;
        }
        if (doc.getElementById(menuID)) return;

        var menuItem = doc.createXULElement("menuitem");
        menuItem.id = menuID;
        menuItem.setAttribute("label",
            "Toggle Read Status");

        var self = this;

        menu.addEventListener("popupshowing",
            function() {
                try {
                    var zoteroPane =
                        Zotero.getActiveZoteroPane();
                    var items =
                        zoteroPane.getSelectedItems();
                    if (items && items.length === 1
                        && items[0].isRegularItem()) {
                        menuItem.setAttribute("checked",
                            self.getReadStatus(items[0])
                                .toString()
                        );
                    }
                } catch (e) {
                    self.log(
                        "popupshowing error: " + e
                    );
                }
            });

        menuItem.addEventListener("command",
            async function() {
                try {
                    var zoteroPane =
                        Zotero.getActiveZoteroPane();
                    var items =
                        zoteroPane.getSelectedItems();
                    if (!items || items.length === 0) {
                        return;
                    }
                    for (var i = 0;
                         i < items.length; i++) {
                        if (items[i].isRegularItem()) {
                            await self.toggleRead(
                                items[i]
                            );
                        }
                    }
                } catch (e) {
                    self.log(
                        "Toggle command error: " + e
                    );
                }
            });

        menu.appendChild(menuItem);
        this._addedElementIDs.push(menuID);
        this.log("Context menu added");
    },

    // ───────────────── Tools menu ─────────────────

    _addToolsMenu: function(window) {
        var doc = window.document;
        var menuID = "readtracker-heatmap-menuitem";

        var toolsMenu =
            doc.getElementById("menu_ToolsPopup");
        if (!toolsMenu) {
            this.log("Tools menu not found");
            return;
        }
        if (doc.getElementById(menuID)) return;

        var menuItem = doc.createXULElement("menuitem");
        menuItem.id = menuID;
        menuItem.setAttribute("label",
            "Plot Reading Heatmap");

        var self = this;
        menuItem.addEventListener("command",
            async function() {
                await self.openHeatmap();
            });

        toolsMenu.appendChild(menuItem);
        this._addedElementIDs.push(menuID);
        this.log("Tools menu item added");
    }
};