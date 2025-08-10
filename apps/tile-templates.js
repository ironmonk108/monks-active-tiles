import { MonksActiveTiles, log, error, setting, i18n, makeid } from '../monks-active-tiles.js';
import { TemplateConfig } from '../apps/template-config.js';

class TemplatesFolderConfig extends foundry.applications.sheets.FolderConfig {
    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        const folder = context.document;
        context.name = context.namePlaceholder = folder._source.name;
        context.buttons = [{ type: "submit", icon: "fa-solid fa-floppy-disk", label: "FOLDER.Update" }];

        return context;
    }

    _processSubmitData = async (event, form, submitData, options) => {
        if (!submitData.name?.trim()) submitData.name = Folder.implementation.defaultName();
        let folders = MonksActiveTiles.tile_directory.folders;
        delete submitData.type;
        if (submitData.folder == "") submitData.folder = null;

        let folder = folders.find(f => f._id == this.options.document._id);

        foundry.utils.mergeObject(folder, submitData, { inline: true });
        await game.settings.set("monks-active-tiles", "tile-template-folders", folders);
        MonksActiveTiles.tile_directory.render(true);
    }
}

export class TileTemplates extends foundry.applications.sidebar.DocumentDirectory {
    constructor(options = {}) {
        super(options);
        this._original = {};

        const sortingModes = game.settings.get("core", "collectionSortingModes");
        this.constructor.sortingMode = sortingModes["Tiles"] || "m";

        this.folders = setting("tile-template-folders") || [];

        // Fix any folders that have no ids
        let checkFolders = this.folders.filter(f => {
            if (f.folder == "") f.folder = null;
            if (!this.folders.find(t => t._id == f.folder)) f.folder = null;
            return f._id;
        });
        if (checkFolders.length != this.folders.length)
            game.settings.set("monks-active-tiles", "tile-template-folders", checkFolders);
    }

    static DEFAULT_OPTIONS = {
        id: "tile-template",
        classes: ["tile-templates"],
        window: {
            icon: "fa-solid fa-cube",
            resizable: false,
            title: "MonksActiveTiles.TileTemplates",
        },
        position: {
            width: 300
        }
    };

    static tabName = "tiles";

    async _prepareContext(options) {
        this.initializeTree();
        return {
            user: game.user,
            documentName: this.documentName,
            folderIcon: CONFIG.Folder.sidebarIcon,
            sidebarIcon: "fas fa-cube",
            canCreateEntry: game.user.isGM,
            canCreateFolder: game.user.isGM
        };
    }

    async _prepareHeaderContext(context, options) {
        super._prepareHeaderContext(context, options);
        context.searchMode.placeholder = game.i18n.format("SIDEBAR.Search", { types: "Tiles" });
    }

    _canDragDrop(selector) {
        return game.user.isGM;
    }

    /*
    static get defaultOptions() {
        return {
            id: "tile-template",
            classes: ["tab", "sidebar-tab", "tile-templates"],
            baseApplication: "SidebarTab",
            title: "MonksActiveTiles.TileTemplates",
            template: "templates/sidebar/document-directory.html",
            renderUpdateKeys: ["name", "img", "thumb", "ownership", "sort", "sorting", "folder"],
            scrollY: ["ol.directory-list"],
            dragDrop: [{ dragSelector: ".directory-item", dropSelector: ".directory-list" }],
            filters: [{ inputSelector: 'input[name="search"]', contentSelector: ".directory-list" }],
            contextMenuSelector: ".directory-item.document",
            entryClickSelector: ".entry-name",
            tabs: [],
            popOut: true,
            width: 300,
            height: "auto",
        };
    }
    */

    static get documentName() {
        return "Tile";
    }

    static get collection() {
        let data = setting("tile-templates") || [];
        data.documentName = TileDocument.documentName;
        data.documentClass = {
            metadata: {
                label: "Tiles"
            },
            deleteDocuments: async (ids) => {
                let templates = foundry.utils.duplicate(setting("tile-templates") || []);
                for (let id of ids)
                    templates.findSplice(t => t._id == id);
                await game.settings.set("monks-active-tiles", "tile-templates", templates);
                if (MonksActiveTiles.tile_directory)
                    MonksActiveTiles.tile_directory.render(true);
            },
            createDocuments: async (items) => {
                let templates = foundry.utils.duplicate(setting("tile-templates") || []);
                for (let data of items) {
                    let _data = foundry.utils.duplicate(data);
                    let doc = new TileDocument(_data);
                    let template = doc.toObject();
                    template._id = template.id = foundry.utils.randomID();
                    template.name = data.name;
                    template.visible = true;
                    template.folder = data.folder;
                    delete template.img;
                    template.img = template.texture.src;
                    template.thumbnail = template.img || "modules/monks-active-tiles/img/cube.svg";
                    if (foundry.helpers.media.VideoHelper.hasVideoExtension(template.thumbnail)) {
                        const t = await foundry.helpers.media.ImageHelper.createThumbnail(template.thumbnail, { width: 60, height: 60 });
                        template.thumbnail = t.thumb;
                    }

                    templates.push(template);
                }
                await game.settings.set("monks-active-tiles", "tile-templates", templates);
                if (MonksActiveTiles.tile_directory)
                    MonksActiveTiles.tile_directory.render(true);
            }
        }
        data.get = (id) => {
            let tile = data.find(t => t._id === id);
            if (!tile) return null;
            tile.canUserModify = () => { return true; };
            tile.toObject = () => { return foundry.utils.duplicate(tile); };
            tile.toCompendium = () => {
                let data = foundry.utils.deepClone(tile);
                delete data._id;
                delete data.folder;
                delete data.sort;
                delete data.ownership;
                return data;
            };
            tile.isOwner = true;
            if (!tile.uuid) {
                Object.defineProperty(tile, 'uuid', {
                    get: function () {
                        return `Tile.${tile._id}`;
                    }
                });
            }
            return tile;
        }
        data.folders = this.folders;
        data.toggleSortingMode = () => {
            this.sortingMode = this.sortingMode === "a" ? "m" : "a";
            const sortingModes = game.settings.get("core", "collectionSortingModes");
            sortingModes["Tiles"] = this.sortingMode;
            game.settings.set("core", "collectionSortingModes", sortingModes);
            MonksActiveTiles.tile_directory.render(true);
        };
        data.toggleSearchMode = () => {
        }
        data.sortingMode = this.sortingMode;
        data.invalidDocumentIds = [];
        data.apps = [];
        data.searchMode = CONST.DIRECTORY_SEARCH_MODES.NAME;
        data.maxFolderDepth = CONST.FOLDER_MAX_DEPTH;
        return data;
    }

    get collection() {
        let collection = this.constructor.collection;
        collection.tree = this.tree;
        return collection;
    }

    static get folders() {
        return setting("tile-template-folders") || [];
    }

    get maxFolderDepth() {
        return CONST.FOLDER_MAX_DEPTH;
    }

    initializeTree() {
        this.folders = setting("tile-template-folders") || [];

        // Assign Folders
        for (let folder of this.folders) {
            if (folder.uuid === undefined) {
                Object.defineProperty(folder, 'uuid', {
                    get: function () { return `Folder.${this.id}`; }
                });
            }
            if (folder.expanded === undefined) {
                Object.defineProperty(folder, 'expanded', {
                    get: function () { return game.folders._expanded[this.uuid] || false; }
                });
            }
        }

        // Assign Documents
        this.documents = this.collection;

        // Build Tree
        this.tree = this.buildTree(this.folders, this.documents);
    }

    buildTree(folders, entries) {
        const handled = new Set();
        const createNode = (root, folder, depth) => {
            return { root, folder, depth, visible: false, children: [], entries: [] };
        };

        // Create the tree structure
        const tree = createNode(true, null, 0);
        const depths = [[tree]];

        // Iterate by folder depth, populating content
        for (let depth = 1; depth <= this.maxFolderDepth + 1; depth++) {
            const allowChildren = depth <= this.maxFolderDepth;
            depths[depth] = [];
            const nodes = depths[depth - 1];
            if (!nodes.length) break;
            for (const node of nodes) {
                const folder = node.folder;
                if (!node.root) { // Ensure we don't encounter any infinite loop
                    if (handled.has(folder.id)) continue;
                    handled.add(folder.id);
                }

                // Classify content for this folder
                const classified = this._classifyFolderContent(folder, folders, entries, { allowChildren });
                node.entries = classified.entries;
                node.children = classified.folders.map(folder => createNode(false, folder, depth));
                depths[depth].push(...node.children);

                // Update unassigned content
                folders = classified.unassignedFolders;
                entries = classified.unassignedEntries;
            }
        }

        // Populate left-over folders at the root level of the tree
        for (const folder of folders) {
            const node = createNode(false, folder, 1);
            const classified = this._classifyFolderContent(folder, folders, entries, { allowChildren: false });
            node.entries = classified.entries;
            entries = classified.unassignedEntries;
            depths[1].push(node);
        }

        // Populate left-over entries at the root level of the tree
        if (entries.length) {
            tree.entries.push(...entries);
        }

        // Sort the top level entries and folders
        const sort = this.constructor.sortingMode === "a" ? this.constructor._sortAlphabetical : this.constructor._sortStandard;
        tree.entries.sort(sort);
        tree.children.sort((a, b) => sort(a.folder, b.folder));

        // Recursively filter visibility of the tree
        const filterChildren = node => {
            node.children = node.children.filter(child => {
                filterChildren(child);
                return child.visible;
            });
            node.visible = node.root || game.user.isGM || ((node.children.length + node.entries.length) > 0);

            // Populate some attributes of the Folder document
            if (node.folder) {
                node.folder.displayed = node.visible;
                node.folder.depth = node.depth;
                node.folder.children = node.children;
            }
        };
        filterChildren(tree);
        return tree;
    }

    //  Need to override this as we don't use proper folders so it won't find them properly
    _classifyFolderContent(folder, folders, entries, { allowChildren = true } = {}) {
        const sort = folder?.sorting === "a" ? this.constructor._sortAlphabetical : this.constructor._sortStandard;

        // Determine whether an entry belongs to a folder, via folder ID or folder reference
        function folderMatches(entry) {
            if (entry.folder?._id) return entry.folder._id === folder?._id;
            return (entry.folder === folder) || (entry.folder === folder?._id);
        }

        // Partition folders into children and unassigned folders
        const [unassignedFolders, subfolders] = folders.partition(f => allowChildren && folderMatches(f));
        subfolders.sort(sort);

        // Partition entries into folder contents and unassigned entries
        const [unassignedEntries, contents] = entries.partition(e => folderMatches(e));
        contents.sort(sort);

        // Return the classified content
        return { folders: subfolders, entries: contents, unassignedFolders, unassignedEntries };
    }

    static _sortAlphabetical(a, b) {
        return (a.name ?? "").localeCompare(b.name ?? "", game.i18n.lang);
    }

    static _sortStandard(a, b) {
        return (a.sort ?? 0) - (b.sort ?? 0);
    }

   /*
    async getData(options) {
        const context = {
            cssId: this.id,
            cssClass: this.options.classes.join(" "),
            tabName: this.tabName,
            user: game.user
        }
        const cfg = CONFIG["Tile"];
        const cls = cfg.documentClass;
        return foundry.utils.mergeObject(context, {
            canCreateEntry: true,
            canCreateFolder: true,
            tree: this.tree,
            documentCls: cls.documentName.toLowerCase(),
            tabName: cls.metadata.collection,
            sidebarIcon: "fa-solid fa-cube",
            folderIcon: CONFIG.Folder.sidebarIcon,
            label: game.i18n.localize(cls.metadata.label),
            labelPlural: game.i18n.localize(cls.metadata.labelPlural),
            entryPartial: this.constructor.entryPartial,
            folderPartial: this.constructor.folderPartial,
            searchIcon: "fa-search",
            searchTooltip: "SIDEBAR.SearchModeName",
            sortIcon: this.sortingMode === "a" ? "fa-arrow-down-a-z" : "fa-arrow-down-short-wide",
            sortTooltip: this.sortingMode === "a" ? "SIDEBAR.SortModeAlpha" : "SIDEBAR.SortModeManual",
        });
    }
    */

    /*
    async _render(...args) {
        await super._render(...args);
        $('.header-actions.action-buttons', this.element).hide();
        this.setPosition({ height: 'auto' });
    }
    */

    /*_toggleFolder(event) {
        super._toggleFolder(event);
        let folder = $(event.currentTarget.parentElement);
    }*/

    async updateTile(data) {
        let templates = foundry.utils.duplicate(this.collection);

        if (!data.id)
            return;

        let template = templates.find(t => t._id == data.id);
        if (!template)
            return;

        foundry.utils.mergeObject(template, data);

        await game.settings.set("monks-active-tiles", "tile-templates", templates);
        this.render(true);
    }

    _onClickEntry(event) {
        let li = event.target.closest("li");
        let templates = this.collection;
        const document = templates.find(t => t._id == li.dataset.entryId);

        new TemplateConfig({ document }).render(true);
    }

    async _onCreateEntry(event, target ){
        event.preventDefault();
        event.stopPropagation();
        const button = target;
        let data = { folder: target.closest(".directory-item")?.dataset.folderId };
        const options = { width: 320, left: window.innerWidth - 630, top: button.offsetTop };
        return TileTemplates.createDialog(data, options).then(() => {
            if (MonksActiveTiles.tile_directory)
                MonksActiveTiles.tile_directory.render(true);
        });
    }

    static async createDialog(data = {}, { parent = null, pack = null, ...options } = {}) {
        // Collect data
        const documentName = TileDocument.documentName;
        const folders = parent ? [] : this.folders;
        const title = (data.id ? game.i18n.format("DOCUMENT.Update", { type: documentName }) : game.i18n.format("DOCUMENT.Create", { type: documentName }));

        let cls = TileDocument.implementation;

        // Render the document creation form
        const html = await foundry.applications.handlebars.renderTemplate("templates/sidebar/document-create.html", {
            folders,
            type: documentName,
            name: data.name || "", //game.i18n.format("DOCUMENT.New", { type: documentName }),
            defaultName: game.i18n.format("DOCUMENT.New", { type: documentName }), //cls.defaultName({ type: documentName, parent, pack }),
            folder: data.folder,
            hasFolders: folders.length >= 1,
            hasTypes: false
        });

        // Render the confirmation dialog window
        return await foundry.applications.api.DialogV2.prompt({
            window: {
                title,
            },
            content: html,
            ok: {
                label: title,
                callback: async (event, button) => {
                    const fd = new foundry.applications.ux.FormDataExtended(button.form).object;
                    foundry.utils.mergeObject(data, fd, { inplace: true });
                    if (!data.folder) delete data.folder;

                    let templates = foundry.utils.duplicate(this.collection);

                    if (data.id) {
                        templates.findSplice(t => t._id == data.id, data);
                    } else {
                        data.width = canvas.grid.size;
                        data.height = canvas.grid.size;
                        let _data = foundry.utils.duplicate(data);
                        let doc = new TileDocument(_data);
                        let template = doc.toObject();
                        template._id = template.id = data.id || foundry.utils.randomID();
                        template.name = data.name;
                        template.visible = true;
                        template.folder = data.folder;
                        delete template.img;
                        template.img = template.texture.src;
                        template.thumbnail = template.img || "modules/monks-active-tiles/img/cube.svg";
                        if (foundry.helpers.media.VideoHelper.hasVideoExtension(template.thumbnail)) {
                            const t = await foundry.helpers.media.ImageHelper.createThumbnail(template.thumbnail, { width: 60, height: 60 });
                            template.thumbnail = t.thumb;
                        }

                        templates.push(template);
                    }

                    await game.settings.set("monks-active-tiles", "tile-templates", templates);
                }
            },
            rejectClose: false,
            options
        });
    }

    async _onCreateFolder(event) {
        event.stopPropagation();
        event.preventDefault();
        let folderData = {
            testUserPermission: () => { return game.user.isGM },
            flags: {},
            apps: {},
            isOwner: game.user.isGM,
            sorting: "m",
            type: "JournalEntry",
            name: Folder.implementation.defaultName()
        };
        folderData.toObject = () => { return folderData; };
        folderData.getFlag = () => { return null; };
        const button = event.target;
        const li = button.closest(".directory-item");
        folderData.folder = li?.dataset?.folderId || null;
        let folder = new Folder(folderData);
        const options = {
            position: {
                top: button.offsetTop,
                left: window.innerWidth - 310 - foundry.applications.sheets.FolderConfig.DEFAULT_OPTIONS.position.width
            },
            editable: true,
            document: folder
        };
        let folderConfig = await new foundry.applications.sheets.FolderConfig(options).render(true, { editable: true });
        folderConfig._processSubmitData = async (event, form, submitData, options) => {
            if (!submitData.name?.trim()) submitData.name = Folder.implementation.defaultName();
            let folders = this.folders;
            submitData._id = foundry.utils.randomID();
            submitData.id = submitData._id;
            submitData.visible = true;
            submitData.folder = submitData.folder == "" ? null : submitData.folder;
            folders.push(submitData);
            await game.settings.set("monks-active-tiles", "tile-template-folders", folders);
            this.render(true);
        }
    }

    _onSearchFilter(event, query, rgx, html) {
        const isSearch = !!query;
        const documentIds = new Set();
        const folderIds = new Set();
        const autoExpandFolderIds = new Set();

        const folders = this.folders;

        // Match documents and folders
        if (isSearch) {

            // Include folders and their parents
            function includeFolder(folderId, autoExpand = true) {
                if (!folderId) return;
                if (folderIds.has(folderId)) return;
                folderIds.add(folderId);
                if (autoExpand) autoExpandFolderIds.add(folderId);
                let folder = folders.find(f => f._id == folderId);
                if (folder) includeFolder(folder); // Always autoexpand parent folders
            }

            // Match documents by name
            for (let d of this.documents) {
                if (rgx.test(foundry.applications.ux.SearchFilter.cleanQuery(d.name))) {
                    documentIds.add(d.id);
                    includeFolder(d.folder);
                }
            }

            // Match folders by name
            for (let f of this.folders) {
                if (rgx.test(foundry.applications.ux.SearchFilter.cleanQuery(f.name))) {
                    includeFolder(f, false);
                    for (let d of this.documents.filter(x => x.folder === f)) {
                        documentIds.add(d.id);
                    }
                }
            }
        }

        // Toggle each directory item
        for (let el of html.querySelectorAll(".directory-item")) {

            // Documents
            if (el.classList.contains("document")) {
                el.style.display = (!isSearch || documentIds.has(el.dataset.entryId)) ? "flex" : "none";
            }

            // Folders
            if (el.classList.contains("folder")) {
                let match = isSearch && folderIds.has(el.dataset.folderId);
                el.style.display = (!isSearch || match) ? "flex" : "none";

                if (autoExpandFolderIds.has(el.dataset.folderId)) {
                    if (isSearch && match) el.classList.remove("collapsed");
                    else el.classList.toggle("collapsed", !game.folders._expanded[el.dataset.folderId]);
                }
            }
        }
    }

    _onDragStart(event) {
        if (ui.context) ui.context.close({ animate: false });
        const li = event.currentTarget.closest(".directory-item");
        const documentName = this.constructor.documentName;
        const isFolder = li.classList.contains("folder");
        const doc = isFolder
            ? this.folders.find(f => f._id == li.dataset.folderId)
            : this.collection.find(t => t._id == li.dataset.entryId);

        if (!doc)
            return;

        delete doc.x;
        delete doc.y;
        const dragData = { type: isFolder ? "Folder" : "Tile", data: doc };
        if (isFolder) foundry.utils.mergeObject(dragData, { documentName });
        event.dataTransfer.setData("text/plain", JSON.stringify(dragData));
    }

    async _handleDroppedEntry(target, data) {

        // Determine the closest Folder
        const closestFolder = target ? target.closest(".folder") : null;
        if (closestFolder) closestFolder.classList.remove("droptarget");
        let folder = closestFolder ? this.folders.find(f => f._id == closestFolder.dataset.folderId)?._id : null;

        // Obtain the dropped Document
        const collection = foundry.utils.duplicate(this.collection);
        let document = data.data;
        if (!document) document = this.collection.get(data.uuid.replace("Tile.", "")); // Should technically be fromUuid
        if (!document) return;

        // Sort relative to another Document
        const sortData = { sortKey: "sort" };
        const isRelative = target && target.dataset.entryId;
        if (isRelative) {
            if (document._id === target.dataset.entryId) return; // Don't drop on yourself
            const targetDocument = collection.find(d => d._id == target.dataset.entryId);
            sortData.target = targetDocument;
            folder = targetDocument.folder;
        }

        // Sort within to the closest Folder
        else sortData.target = null;

        // Determine siblings and perform sort
        sortData.siblings = collection.filter(doc => (doc._id !== document._id) && (doc.folder === folder));
        sortData.updateData = { folder: folder || null };

        let { updateData = {}, ...sortOptions } = sortData;

        const sorting = foundry.utils.performIntegerSort(document, sortOptions);
        for (let s of sorting) {
            let doc = collection.find(d => d._id == s.target.id);
            foundry.utils.mergeObject(doc, s.update);
            doc.folder = folder || null;
        }

        await game.settings.set("monks-active-tiles", "tile-templates", collection);

        this.render(true);

        return document;
    }

    async _handleDroppedFolder(target, data) {
        if (data.documentName !== this.constructor.documentName) return;
        const folder = data.data;

        let folders = foundry.utils.duplicate(this.folders);

        // Determine the closest folder ID
        const closestFolder = target ? target.closest(".folder") : null;
        if (closestFolder) closestFolder.classList.remove("droptarget");
        const closestFolderId = closestFolder ? closestFolder.dataset.folderId : null;

        // Sort into another Folder
        const sortData = { sortKey: "sort", sortBefore: true };
        const isFolder = target && target.dataset.folderId;
        if (isFolder) {
            const targetFolder = folders.find(f => f.id == target.dataset.folderId);

            // Sort relative to a collapsed Folder
            if (target.classList.contains("collapsed")) {
                sortData.target = targetFolder;
                sortData.parentId = targetFolder.folder?._id;
            }

            // Drop into an expanded Folder
            else {
                if (Number(target.dataset.folderDepth) >= CONST.FOLDER_MAX_DEPTH) return; // Prevent going beyond max depth
                sortData.target = null;
                sortData.parentId = targetFolder._id;
            }
        }

        // Sort relative to existing Folder contents
        else {
            sortData.parentId = closestFolderId;
            sortData.target = closestFolder && closestFolder.classList.contains("collapsed") ? closestFolder : null;
        }

        // Prevent assigning a folder as its own parent
        if (sortData.parentId === folder._id) return;

        // Determine siblings and perform sort
        
        sortData.siblings = folders.filter(f => {
            return (f.folder === sortData.parentId || (f.folder == undefined && sortData.parentId == undefined)) && (f.id !== folder._id);
        });
        sortData.updateData = { folder: sortData.parentId };

        let { updateData = {}, ...sortOptions } = sortData;

        const sorting = foundry.utils.performIntegerSort(folder, sortOptions);
        for (let s of sorting) {
            let fold = folders.find(f => f._id == s.target.id);
            foundry.utils.mergeObject(fold, s.update);
            fold.folder = sortData.parentId || null;
        }

        await game.settings.set("monks-active-tiles", "tile-template-folders", folders);

        this.render(true);
    }

    getSubfolders(folders, folder, recursive = false) {
        let subfolders = folders.filter(f => f.folder === folder.id);
        if (recursive && subfolders.length) {
            for (let f of subfolders) {
                const children = this.getSubfolders(folders, f, true);
                subfolders = subfolders.concat(children);
            }
        }
        return subfolders;
    }

    async deleteFolder(folders, folder, options, userId) {
        const templates = foundry.utils.duplicate(this.collection || []);
        const parentFolder = folder.folder;
        const { deleteSubfolders, deleteContents } = options;

        // Delete or move sub-Folders
        const deleteFolderIds = [];
        for (let f of this.getSubfolders(folders, folder)) {
            if (deleteSubfolders) deleteFolderIds.push(f.id);
            else f.folder = parentFolder;
        }
        if (deleteFolderIds.length) {
            for (let id of deleteFolderIds)
                folders.findSplice(f => f._id == id);
        }

        // Delete or move contained Documents
        const deleteDocumentIds = [];
        for (let d of templates) {
            if (d.folder !== folder._id) continue;
            if (deleteContents) deleteDocumentIds.push(d._id);
            else d.folder = parentFolder;
        }
        if (deleteDocumentIds.length) {
            for (let id of deleteDocumentIds)
                templates.findSplice(t => t._id == id);
        }
        await game.settings.set("monks-active-tiles", "tile-templates", templates);
    }

    async close(options = {}) {
        await super.close(options);
        MonksActiveTiles.tile_directory = null;
    }

    _getFolderContextOptions() {
        return [
            {
                name: "FOLDER.Edit",
                icon: '<i class="fas fa-edit"></i>',
                condition: game.user.isGM,
                callback: async (header) => {
                    const li = header.closest(".directory-item");
                    const folders = foundry.utils.duplicate(this.folders);
                    let folder = folders.find(t => t._id == li.dataset.folderId);
                    const options = {
                        position: {
                            top: li.offsetTop,
                            left: window.innerWidth - 310 - foundry.applications.sheets.FolderConfig.DEFAULT_OPTIONS.position.width
                        },
                        document: new Folder(foundry.utils.mergeObject(folder, { type: "JournalEntry" }, { inplace: false }))
                    };
                    
                    let config = await new TemplatesFolderConfig(options).render(true);
                    config._processSubmitData = async (event, form, submitData, options) => {
                        if (!submitData.name?.trim()) submitData.name = Folder.implementation.defaultName();
                        delete submitData.type;
                        if (submitData.folder == "") submitData.folder = null;
                        folder = foundry.utils.mergeObject(folder, submitData);
                        await game.settings.set("monks-active-tiles", "tile-template-folders", folders);
                        if (MonksActiveTiles.tile_directory)
                            MonksActiveTiles.tile_directory.render(true);
                    }
                }
            },
            {
                name: "FOLDER.Remove",
                icon: '<i class="fas fa-trash"></i>',
                condition: game.user.isGM,
                callback: header => {
                    const li = header.closest(".directory-item");
                    const folders = foundry.utils.duplicate(this.folders);
                    const folder = folders.find(t => t._id == li.dataset.folderId);
                    return foundry.applications.api.DialogV2.confirm({
                        window: {
                            title: `${game.i18n.localize("FOLDER.Remove")} ${folder.name}`,
                        },
                        content: `<h4>${game.i18n.localize("AreYouSure")}</h4><p>${game.i18n.localize("FOLDER.RemoveWarning")}</p>`,
                        yes: {
                            callback: async () => {
                                await this.deleteFolder(folders, folder, { deleteSubfolders: false, deleteContents: false });
                                folders.findSplice(t => t._id == folder._id);
                                await game.settings.set("monks-active-tiles", "tile-template-folders", folders);
                                if (MonksActiveTiles.tile_directory)
                                    MonksActiveTiles.tile_directory.render(true);
                            }
                        },
                        options: {
                            top: Math.min(li.offsetTop, window.innerHeight - 350),
                            left: window.innerWidth - 720,
                            width: 400
                        }
                    });
                }
            },
            {
                name: "FOLDER.Delete",
                icon: '<i class="fas fa-dumpster"></i>',
                condition: game.user.isGM,
                callback: header => {
                    const li = header.closest(".directory-item");
                    const folders = foundry.utils.duplicate(this.folders);
                    const folder = folders.find(t => t._id == li.dataset.folderId);
                    return foundry.applications.api.DialogV2.confirm({
                        window: {
                            title: `${game.i18n.localize("FOLDER.Delete")} ${folder.name}`,
                        },
                        content: `<h4>${game.i18n.localize("AreYouSure")}</h4><p>${game.i18n.localize("FOLDER.DeleteWarning")}</p>`,
                        yes: {
                            callback: async () => {
                                await this.deleteFolder(folders, folder, { deleteSubfolders: true, deleteContents: true })
                                folders.findSplice(t => t._id == folder._id);
                                await game.settings.set("monks-active-tiles", "tile-template-folders", folders);
                                if (MonksActiveTiles.tile_directory)
                                    MonksActiveTiles.tile_directory.render(true);
                            }
                        },
                        options: {
                            top: Math.min(li.offsetTop, window.innerHeight - 350),
                            left: window.innerWidth - 720,
                            width: 400
                        }
                    });
                }
            }
        ];
    }

   _getEntryContextOptions() {
        return [
            {
                name: "FOLDER.Clear",
                icon: '<i class="fas fa-folder"></i>',
                condition: li => {
                    const document = this.collection.find(t => t._id == li.dataset.entryId);
                    return game.user.isGM && !!document?.folder;
                },
                callback: async (li) => {
                    const templates = foundry.utils.duplicate(this.collection);
                    const document = templates.find(t => t._id == li.dataset.entryId);
                    document.folder = null;
                    await game.settings.set("monks-active-tiles", "tile-templates", templates);

                    if (MonksActiveTiles.tile_directory)
                        MonksActiveTiles.tile_directory.render(true);
                }
            },
            {
                name: "SIDEBAR.Delete",
                icon: '<i class="fas fa-trash"></i>',
                condition: () => game.user.isGM,
                callback: li => {
                    const templates = foundry.utils.duplicate(this.collection);
                    const id = li.dataset.entryId;
                    const document = templates.find(t => t._id == id || (t._id == undefined && id == ""));
                    if (!document) return;
                    return foundry.applications.api.DialogV2.confirm({
                        window: {
                            title: `${game.i18n.format("DOCUMENT.Delete", { type: "Tile Template" })}: ${document.name}`,
                        },
                        content: `<h4>${game.i18n.localize("AreYouSure")}</h4><p>${game.i18n.format("SIDEBAR.DeleteWarning", { type: "Tile Template" })}</p>`,
                        yes: {
                            callback: async () => {
                                templates.findSplice(t => t._id == id || (t._id == undefined && id == ""));
                                await game.settings.set("monks-active-tiles", "tile-templates", templates);
                                if (MonksActiveTiles.tile_directory)
                                    MonksActiveTiles.tile_directory.render(true);
                            }
                        },
                        options: {
                            top: Math.min(li.offsetTop, window.innerHeight - 350),
                            left: window.innerWidth - 720
                        }
                    });
                }
            },
            {
                name: "SIDEBAR.Export",
                icon: '<i class="fas fa-file-export"></i>',
                condition: li => game.user.isGM,
                callback: li => {
                    const templates = this.collection;
                    const document = templates.find(t => t._id == li.dataset.entryId);
                    if (!document) return;
                    const data = foundry.utils.deepClone(document);
                    delete data._id;
                    delete data.folder;
                    delete data.sort;
                    delete data.ownership;
                    data.flags["exportSource"] = {
                        world: game.world.id,
                        system: game.system.id,
                        coreVersion: game.version,
                        systemVersion: game.system.version
                    };
                    const filename = `fvtt-tiledata-${document.name.slugify()}.json`;
                    foundry.utils.saveDataToFile(JSON.stringify(data, null, 2), "text/json", filename);
                }
            },
            {
                name: "SIDEBAR.Import",
                icon: '<i class="fas fa-file-import"></i>',
                condition: li => game.user.isGM,
                callback: async (li) => {
                    const templates = foundry.utils.duplicate(this.collection);
                    const replaceId = li.dataset.entryId;
                    const document = templates.find(t => t._id == replaceId);
                    if (!document) return;
                    await foundry.applications.api.DialogV2.wait({
                        window: { title: `${game.i18n.localize("DOCUMENT.ImportData")}: ${document.name}` }, // FIXME: double localization
                        position: { width: 400 },
                        content: await foundry.applications.handlebars.renderTemplate("templates/apps/import-data.hbs", {
                            hint1: game.i18n.format("DOCUMENT.ImportDataHint1", { document: this.documentName }),
                            hint2: game.i18n.format("DOCUMENT.ImportDataHint2", { name: document.name })
                        }),
                        buttons: [{
                            action: "import",
                            label: "Import",
                            icon: "fa-solid fa-file-import",
                            callback: (event, button) => {
                                const form = button.form;
                                if (!form.data.files.length) {
                                    return ui.notifications.error("DOCUMENT.ImportDataError", { localize: true });
                                }
                                foundry.utils.readTextFromFile(form.data.files[0]).then(async (json) => {
                                    let importData = JSON.parse(json);
                                    let docs = importData instanceof Array ? importData : [importData];
                                    for (let docData of docs) {
                                        let name = docData.name;
                                        const doc = new TileDocument(docData, { strict: true });

                                        // Treat JSON import using the same workflows that are used when importing from a compendium pack
                                        const data = doc.toObject();
                                        delete data.folder;
                                        delete data.sort;
                                        delete data.ownership;
                                        data.name = name;

                                        // Preserve certain fields from the destination document
                                        const preserve = Object.fromEntries(["_id", "sort", "ownership"].map(k => {
                                            return [k, foundry.utils.getProperty(document, k)];
                                        }));
                                        preserve.folder = document.folder;
                                        foundry.utils.mergeObject(data, preserve);

                                        if (importData instanceof Array)
                                            data._id = foundry.utils.randomID();

                                        data.visible = true;
                                        delete data.img;
                                        data.img = data.texture.src;
                                        data.id = data._id;
                                        data.thumbnail = data.img || "modules/monks-active-tiles/img/cube.svg";
                                        if (foundry.helpers.media.VideoHelper.hasVideoExtension(data.thumbnail)) {
                                            const t = await foundry.helpers.media.ImageHelper.createThumbnail(data.thumbnail, { width: 60, height: 60 });
                                            data.thumbnail = t.thumb;
                                        }

                                        // Commit the import as an update to this document
                                        if (importData instanceof Array)
                                            templates.push(data);
                                        else
                                            templates.findSplice(t => t._id == replaceId, data);
                                        ui.notifications.info("DOCUMENT.Imported", { format: { document: TileDocument.documentName, name: data.name } });
                                    }
                                    await game.settings.set("monks-active-tiles", "tile-templates", templates);
                                    if (MonksActiveTiles.tile_directory)
                                        MonksActiveTiles.tile_directory.render(true);
                                });
                            }
                        }, {
                            action: "no",
                            label: "Cancel",
                            icon: "fa-solid fa-xmark"
                        }]
                    });
                }
            }
        ];
    }
}