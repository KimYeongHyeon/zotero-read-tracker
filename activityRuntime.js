/* Zotero 10 host adapter. Activity data never modifies library item contents. */
var ResearchActivity = {
    tabs: new Map(), inputs: new Map(), readerBindings: new Map(), windows: new Map(),
    store: null, snapshot: null, error: null, running: false,
    _saveQueue: Promise.resolve(), _refreshQueue: Promise.resolve(),

    async init({ id, version, rootURI }) {
        this.id = id;
        this.rootURI = rootURI;
        this.version = version;
        this.chromeHandle = Cc['@mozilla.org/addons/addon-manager-startup;1']
            .getService(Ci.amIAddonManagerStartup).registerChrome(
                Services.io.newURI(rootURI + 'manifest.json'),
                [['content', 'research-activity', './']]);
        this.path = PathUtils.join(Zotero.DataDirectory.dir, 'research-activity.json');
        this.running = true;
        this.clock = Zotero.getMainWindow();
        this.notifier = Zotero.Notifier.registerObserver(this, ['item', 'collection', 'collection-item', 'tab'], id);
        this.lastTick = Date.now();
        this.previousKey = null;
        await this.refresh();
        this.timer = this.clock.setInterval(() => this.tick(), 1000);
        this.saveTimer = this.clock.setInterval(() => this.save().catch(e => this.fail(e)), 10000);
    },

    fail(error) {
        this.error = String(error);
        Zotero.logError(error);
        for (const entry of this.tabs.values()) this.view(entry)?.error(this.error);
    },

    async load() {
        if (this.store) return;
        const data = await IOUtils.exists(this.path)
            ? await IOUtils.readJSON(this.path) : ResearchActivityModel.emptyStore();
        ResearchActivityModel.validateStore(data);
        this.store = data;
    },

    save() {
        if (!this.store) return Promise.resolve();
        this._saveQueue = this._saveQueue.catch(() => {}).then(() => {
            ResearchActivityModel.validateStore(this.store);
            return IOUtils.writeUTF8(this.path, JSON.stringify(this.store), { tmpPath: this.path + '.tmp' });
        });
        return this._saveQueue;
    },

    notify(event, type, ids) {
        if (!this.running) return;
        if (type === 'tab') {
            // Flush at the boundary, never bridge time from one foreground document to another.
            this.previousKey = null;
            this.lastTick = Date.now();
            this.save().catch(e => this.fail(e));
            if (event === 'select') this.scheduleRefresh();
            return;
        }
        if (type === 'item' && event === 'add' && this.store) {
            for (const id of ids) {
                const item = Zotero.Items.get(id);
                if (item && item.libraryID === Zotero.Libraries.userLibraryID) {
                    ResearchActivityModel.addOrigin(this.store, this.key(item), 'observed');
                }
            }
        }
        this.scheduleRefresh();
    },

    scheduleRefresh() {
        if (!this.running) return;
        this.clock.clearTimeout(this.refreshTimer);
        this.refreshTimer = this.clock.setTimeout(() => this.refresh(), 300);
    },

    refresh() {
        this._refreshQueue = this._refreshQueue.catch(() => {}).then(async () => {
            if (!this.running) return;
            try {
                await this.load();
                this.snapshot = await this.collect();
                await this.save();
                this.error = null;
                this.render();
            } catch (e) { this.fail(e); }
        });
        return this._refreshQueue;
    },

    key(item) { return item.libraryID + '/' + item.key; },

    async collect() {
        const libraryID = Zotero.Libraries.userLibraryID;
        const all = await Zotero.Items.getAll(libraryID, false, true);
        await Zotero.Items.loadDataTypes(all);
        const byID = new Map(all.map(item => [item.id, item]));
        const rootOf = item => {
            const seen = new Set();
            while (item) {
                if (item.deleted || seen.has(item.id)) return null;
                seen.add(item.id);
                if (!item.parentID) return item;
                item = byID.get(item.parentID);
            }
            return null;
        };
        const collectionObjects = Zotero.Collections.getByLibrary(libraryID, true);
        const collections = collectionObjects.filter(c => !c.deleted).map(c => ({
            key: libraryID + '/' + c.key, name: c.name,
            parentKey: c.parentKey ? libraryID + '/' + c.parentKey : null
        }));
        const collectionByID = new Map(collectionObjects.map(c => [c.id, libraryID + '/' + c.key]));
        const items = [], records = [], warnings = [];
        const warning = (title, field) => warnings.push('“' + title + '”: invalid ' + field + '. This activity was excluded.');
        for (const item of all) {
            const root = rootOf(item);
            if (!root) continue;
            const key = this.key(item), parentKey = this.key(root);
            const title = item.isNote() ? item.getNoteTitle() || 'Untitled note'
                : item.isAnnotation() ? (item.annotationComment || item.annotationText || 'Annotation').slice(0,180)
                : item.getField('title') || 'Untitled item';
            if (item === root) {
                let completedDate = null;
                if (item.isRegularItem() && ZoteroReadTracker.getReadStatus(item)) {
                    const extra = item.getField('extra') || '';
                    const match = extra.match(/^Read-Date:\s*(.+?)\s*$/im);
                    if (match) {
                        try {
                            completedDate = ResearchActivityModel.parseDateAdded(match[1] + 'T12:00:00');
                        } catch (e) {
                            warning(title, 'completion date');
                        }
                    }
                }
                items.push({ key, title, collections: item.getCollections().map(id => collectionByID.get(id)).filter(Boolean), completedDate });
            }
            const type = item.isRegularItem() && !item.parentID ? 'save'
                : item.isNote() || item.isAnnotation() ? 'note' : null;
            if (!type) continue;
            ResearchActivityModel.addOrigin(this.store, key, 'restored');
            let date;
            try {
                date = ResearchActivityModel.parseDateAdded(item.getField('dateAdded'));
            } catch (e) {
                warning(title, 'creation date');
                continue;
            }
            records.push({ id: type + ':' + key, key, parentKey, type,
                subtype: item.isAnnotation() ? 'annotation' : item.isNote() ? 'note' : null,
                title, date,
                source: this.store.origins[key] });
        }
        records.push(...ResearchActivityModel.readingRecords(this.store, items));
        const validKeys = new Set(items.map(i => i.key)), reading = [];
        for (const [key, days] of Object.entries(this.store.reading)) {
            if (!validKeys.has(key)) continue;
            for (const [date, seconds] of Object.entries(days)) reading.push({ key, date, seconds });
        }
        return { records, items, reading, collections, warnings, today: ResearchActivityModel.localDate(new Date()) };
    },

    detachInput(win, listener) {
        // Zotero destroys Reader frames when attachments are trashed or closed.
        if (Cu.isDeadWrapper(win)) return;
        for (const type of ['pointerdown','keydown','wheel']) win.removeEventListener(type, listener, true);
    },

    attachReaders() {
        const readers = Zotero.Reader._readers.filter(r => r.type === 'pdf');
        for (const [reader, bindings] of this.readerBindings) {
            if (!readers.includes(reader)) {
                for (const [win, listener] of bindings) this.detachInput(win, listener);
                this.readerBindings.delete(reader);
                this.inputs.delete(reader);
            }
        }
        for (const reader of readers) {
            let bindings = this.readerBindings.get(reader);
            if (!bindings) { bindings = []; this.readerBindings.set(reader, bindings); }
            const frames = [reader._iframeWindow, reader._internalReader?._primaryView?._iframeWindow, reader._internalReader?._secondaryView?._iframeWindow].filter(win => win && !Cu.isDeadWrapper(win));
            for (const win of frames) {
                if (bindings.some(b => b[0] === win)) continue;
                const listener = event => {
                    if (!event.isTrusted || this.activeReader() !== reader) return;
                    // Typing a note/comment is not PDF reading input.
                    if (event.target?.closest?.('input,textarea,[contenteditable="true"]')) return;
                    this.inputs.set(reader, Date.now());
                };
                for (const type of ['pointerdown','keydown','wheel']) win.addEventListener(type, listener, true);
                bindings.push([win, listener]);
            }
        }
    },

    activeReader() {
        for (const reader of Zotero.Reader._readers) {
            if (reader.type !== 'pdf' || !reader._window || Cu.isDeadWrapper(reader._window) || !reader._window.document.hasFocus()) continue;
            if (reader.tabID && reader._window.Zotero_Tabs?.selectedID !== reader.tabID) continue;
            return reader;
        }
        return null;
    },

    tick() {
        if (!this.running || !this.store || this.error) return;
        try {
            this.attachReaders();
            const now = Date.now(), reader = this.activeReader();
            let item = reader && Zotero.Items.get(reader.itemID);
            if (item?.parentID) item = Zotero.Items.get(item.parentID);
            const key = item && !item.deleted && item.libraryID === Zotero.Libraries.userLibraryID ? this.key(item) : null;
            const interval = ResearchActivityModel.creditedInterval(this.previousKey, key, this.inputs.get(reader) || 0, this.lastTick, now);
            this.lastTick = now;
            this.previousKey = key;
            if (interval) {
                ResearchActivityModel.addReading(this.store, key, interval.startMs, interval.endMs);
                if (now - (this.lastLiveRefresh || 0) >= 10000 && this.tabs.size) {
                    this.lastLiveRefresh = now;
                    this.scheduleRefresh();
                }
            }
        } catch (e) { this.fail(e); }
    },

    addWindow(win) {
        if (this.windows.has(win)) return;
        const onBlur = () => {
            this.previousKey = null;
            this.lastTick = Date.now();
            this.save().catch(e => this.fail(e));
        };
        win.addEventListener('blur', onBlur);
        // Zotero's session restorer accepts only built-in tab types. Keep this
        // ephemeral dashboard out of session.json; its filters live in preferences.
        const originalGetState = win.Zotero_Tabs.getState;
        const getState = function () {
            return originalGetState.call(this).filter(tab => tab.type !== 'research-activity');
        };
        win.Zotero_Tabs.getState = getState;
        this.windows.set(win, { onBlur, originalGetState, getState });
    },

    removeWindow(win) {
        const binding = this.windows.get(win);
        if (binding) {
            win.removeEventListener('blur', binding.onBlur);
            if (win.Zotero_Tabs.getState === binding.getState) win.Zotero_Tabs.getState = binding.originalGetState;
        }
        this.windows.delete(win);
        this.tabs.delete(win);
    },

    view(entry) { return entry.frame.contentWindow?.wrappedJSObject?.ResearchActivityView; },

    render() {
        for (const entry of this.tabs.values()) {
            const view = this.view(entry);
            if (!view) continue;
            if (this.error) view.error(this.error);
            else if (this.snapshot) view.render(Cu.cloneInto(this.snapshot, entry.frame.contentWindow));
        }
    },

    async open(win = Zotero.getMainWindow()) {
        const existing = this.tabs.get(win);
        if (existing && win.document.getElementById(existing.id)) {
            win.Zotero_Tabs.select(existing.id);
            await this.refresh();
            return existing.id;
        }
        const { id, container } = win.Zotero_Tabs.add({
            type: 'research-activity', title: 'Research Activity', data: {}, select: true,
            onClose: () => { this.tabs.delete(win); }
        });
        const frame = win.document.createElementNS('http://www.w3.org/1999/xhtml', 'iframe');
        frame.style.cssText = 'width:100%;height:100%;border:0;flex:1;';
        const entry = { id, frame };
        this.tabs.set(win, entry);
        frame.addEventListener('load', async () => {
            const page = frame.contentWindow;
            const view = this.view(entry);
            if (!view || entry.connected) return;
            entry.connected = true;
            page.addEventListener('activity-action', event => {
                const detail = event.detail?.wrappedJSObject || event.detail;
                if (detail.action === 'state') {
                    Zotero.Prefs.set('researchActivity.viewState', JSON.stringify(detail.state));
                } else if (detail.action === 'retry') this.refresh();
                else this.navigate(detail.action, detail.key, win).catch(e => this.fail(e));
            }, false, true); // Accept CustomEvent dispatched by this packaged HTML document.
            try {
                const saved = Zotero.Prefs.get('researchActivity.viewState');
                if (saved) view.setState(Cu.cloneInto(JSON.parse(saved), page));
            } catch (e) { Zotero.logError(e); }
            await this.refresh();
        }, true);
        frame.src = 'chrome://research-activity/content/activity.html?v=' + encodeURIComponent(this.version);
        container.appendChild(frame);
        return id;
    },

    async navigate(action, key, win) {
        if (!['select','open','annotation'].includes(action)) throw new Error('Unsupported activity action.');
        const match = /^(\d+)\/([A-Z0-9]{8})$/.exec(key || '');
        if (!match || +match[1] !== Zotero.Libraries.userLibraryID) throw new Error('Invalid item identifier.');
        const item = await Zotero.Items.getByLibraryAndKeyAsync(+match[1], match[2]);
        if (!item || item.deleted) throw new Error('Item not found. It may have been deleted.');
        if (action === 'select') {
            win.Zotero_Tabs.select('zotero-pane');
            await win.ZoteroPane.selectItem(item.id);
        } else if (item.isAnnotation()) {
            await Zotero.Reader.open(item.parentID, { annotationID: item.key });
        } else if (item.isNote()) {
            win.ZoteroPane.openNoteWindow(item.id);
        } else {
            const attachment = item.isAttachment() ? item : await item.getBestAttachment();
            if (!attachment || attachment.attachmentContentType !== 'application/pdf') throw new Error('No PDF is available for this item.');
            await Zotero.Reader.open(attachment.id);
        }
    },

    async shutdown() {
        this.tick();
        this.running = false;
        this.clock.clearInterval(this.timer);
        this.clock.clearInterval(this.saveTimer);
        this.clock.clearTimeout(this.refreshTimer);
        Zotero.Notifier.unregisterObserver(this.notifier);
        for (const [reader, bindings] of this.readerBindings) {
            for (const [win, listener] of bindings) this.detachInput(win, listener);
        }
        this.readerBindings.clear();
        this.inputs.clear();
        for (const [win, entry] of this.tabs) if (!win.closed) win.Zotero_Tabs.close(entry.id);
        this.tabs.clear();
        for (const win of Array.from(this.windows.keys())) this.removeWindow(win);
        await this._refreshQueue;
        try { await this.save(); } finally { this.chromeHandle?.destruct(); }
    }
};
