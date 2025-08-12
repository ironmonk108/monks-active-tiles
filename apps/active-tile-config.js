import { MonksActiveTiles, log, error, setting, i18n, makeid } from '../monks-active-tiles.js';
import { ActionConfig } from "../apps/action-config.js";
import { TileHistory } from './tile-history.js';
import { TileVariables } from './tile-variables.js';
import { TileTemplates } from "./tile-templates.js";

/*
class ActiveTileContextMenu extends foundry.applications.ux.ContextMenu {
    constructor(...args) {
        super(...args);
    }

    _setPosition(html, target) {
        super._setPosition(html, target);

        let container = target.closest('.action-list,.image-list');
        let y = container.position().top + target.position().top - 65; //(target.position().top - container.scrollTop());// - 55;// - $(html).height();

        html.removeClass("expand-down").css({ "top": `${y}px` }).insertAfter(target.closest('.action-items'));
    }
}
*/

export const WithActiveTileConfig = (TileConfig) => {
    class ActiveTileConfig extends TileConfig {
        constructor(...args) {
            super(...args);

            if (foundry.utils.getProperty(this.document, "flags.monks-active-tiles") == undefined) {
                this.document.flags = foundry.utils.mergeObject(this.document.flags, {
                    'monks-active-tiles': {
                        active: true,
                        trigger: setting('default-trigger'),
                        vision: true,
                        chance: 100,
                        restriction: setting('default-restricted'),
                        controlled: setting('default-controlled'),
                        actions: []
                    }
                });
            }
        }

        static DEFAULT_OPTIONS = {
            classes: ["monks-active-tiles"],
            actions: {
                viewHistory: ActiveTileConfig.viewHistory,
                viewVariables: ActiveTileConfig.viewVariables,
                createAction: ActiveTileConfig._createAction,
                editAction: ActiveTileConfig._editAction,
                deleteAction: ActiveTileConfig._deleteAction,
                stopSound: ActiveTileConfig._stopSound,
                browseImages: ActiveTileConfig.browseImages,
                browseFolders: ActiveTileConfig.browseFolders,
                deleteImage: ActiveTileConfig.removeImage,
                saveTemplate: ActiveTileConfig.saveTemplate,
                /*
            $('.add-image', html).on("click", this._activateFilePicker.bind(this, "file"));
            $('.add-folder', html).on("click", this._activateFilePicker.bind(this, "folder"));
            $('.filepath', html).on("change", this.addToFileList.bind(this));
            $('.folderpath', html).on("change", this.addToFolderList.bind(this));
            $('.image-list .image', html).on("dblclick", this.selectImage.bind(this));
            */
            },
            //form: {
            //    handler: ActiveTileConfig._updateObject,
            //}
        }

        static PARTS = {
            tabs: { template: "templates/generic/tab-navigation.hbs" },
            position: { template: "templates/scene/tile/position.hbs" },
            appearance: { template: "templates/scene/tile/appearance.hbs" },
            overhead: { template: "templates/scene/tile/overhead.hbs" },
            activetile: {
                template: "modules/monks-active-tiles/templates/active-tile-config.hbs",
                templates: [
                    "modules/monks-active-tiles/templates/action-partial.hbs",
                    "modules/monks-active-tiles/templates/image-partial.hbs"
                ]
            },
            footer: { template: "templates/generic/form-footer.hbs" }
        };

        static TABS = {
            sheet: {
                tabs: [
                    { id: "position", icon: "fa-solid fa-location-dot" },
                    { id: "appearance", icon: "fa-solid fa-image" },
                    { id: "overhead", icon: "fa-solid fa-house" },
                    { id: "activetile", icon: "fa-solid fa-running" }
                ],
                initial: "position",
                labelPrefix: "TILE.TABS"
            },
            activetile: {
                tabs: [
                    { id: "setup", icon: "fa-solid fa-cog" },
                    { id: "actions", icon: "fa-solid fa-running" },
                    { id: "images", icon: "fa-solid fa-image" }
                ],
                initial: "setup",
                labelPrefix: "MonksActiveTiles.tabs"
            }
        };

        async _prepareContext(options) {
            const context = await super._prepareContext(options);
            context.tabs = this._prepareTabs("sheet");

            context.buttons.unshift({
                type: "button",
                icon: "fas fa-save",
                label: i18n("MonksActiveTiles.SaveAsTemplate"),
                action: "saveTemplate",
                cssClass: "small-button"
            });
            return context;
        }

        async _preparePartContext(partId, context, options) {
            context = await super._preparePartContext(partId, context, options);
            switch (partId) {
                case "activetile":
                    context.triggerValues = this.document.getFlag("monks-active-tiles", "trigger");
                    context.triggerValues = context.triggerValues instanceof Array ? context.triggerValues : [context.triggerValues];
                    if (context.triggerValues.includes("both")) {
                        context.triggerValues.push("enter", "exit");
                        context.triggerValues.findSplice(t => t == "both");
                    }
                    if (context.triggerValues.includes("hover")) {
                        context.triggerValues.push("hoverin", "hoverout");
                        context.triggerValues.findSplice(t => t == "hover");
                    }

                    context.triggerNames = context.triggerValues.map(t => {
                        return Object.keys(MonksActiveTiles.triggerModes).includes(t) ? { id: t, name: MonksActiveTiles.triggerModes[t] } : null;
                    }).filter(t => !!t);

                    context.triggers = Object.entries(MonksActiveTiles.triggerModes).map(([k, v]) => {
                        return {
                            id: k,
                            name: v,
                            selected: context.triggerValues.includes(k)
                        }
                    });

                    context.preventPaused = setting("prevent-when-paused");
                    let fileindex = this.document.getFlag("monks-active-tiles", "fileindex");
                    context.index = (fileindex != undefined ? fileindex + 1 : '');

                    context = foundry.utils.mergeObject({ 'data.flags.monks-active-tiles.minrequired': 0 }, context);

                    context.triggerModes = MonksActiveTiles.triggerModes;
                    context.triggerRestriction = { 'all': i18n("MonksActiveTiles.restrict.all"), 'player': i18n("MonksActiveTiles.restrict.player"), 'gm': i18n("MonksActiveTiles.restrict.gm") };
                    context.triggerControlled = { 'all': i18n("MonksActiveTiles.control.all"), 'player': i18n("MonksActiveTiles.control.player"), 'gm': i18n("MonksActiveTiles.control.gm") };

                    context.actions = await Promise.all((this.document.getFlag('monks-active-tiles', 'actions') || [])
                        .map(async (a) => {
                            if (a) {
                                let trigger = MonksActiveTiles.triggerActions[a.action];
                                let content = (trigger == undefined ? 'Unknown' : i18n(trigger.name));
                                if (trigger?.content) {
                                    try {
                                        content = await trigger.content(trigger, a, this.actions);
                                    } catch (e) {
                                        error(e);
                                    }
                                }

                                let result = {
                                    id: a.id,
                                    action: a.action,
                                    data: a.data,
                                    content: content,
                                    disabled: trigger?.visible === false
                                }

                                if (a.action == "activate" && a.data?.activate == "deactivate" && (a.data?.entity?.id == this.document.id || a.data?.entity == ""))
                                    result.deactivated = "on";
                                if (a.action == "anchor")
                                    result.deactivated = "off";

                                return result;
                            }
                        }).filter(a => !!a));

                    if (setting("show-landing")) {
                        let landings = [];
                        let currentLanding = 0;
                        for (let a of context.actions) {
                            if (a.action == "anchor") {
                                if (a.data.stop) {
                                    landings = [];
                                }

                                landings.push(++currentLanding);
                                a.marker = currentLanding;
                                a.landingStop = a.data.stop;
                            }
                            a.landings = foundry.utils.duplicate(landings);
                        }
                    }

                    let disabled = false;
                    for (let a of context.actions) {
                        if (a.deactivated == "off")
                            disabled = false;
                        if (disabled)
                            a.disabled = true;
                        if (a.deactivated == "on")
                            disabled = true;
                    }

                    context.sounds = Object.entries(this.document.soundeffect || {}).filter(([k, v]) => !!v.src).map(([k, v]) => {
                        let filename = v.src.split('\\').pop().split('/').pop();
                        return {
                            id: k,
                            name: filename
                        };
                    });

                    let index = this.document.getFlag('monks-active-tiles', 'fileindex') || 0;
                    context.images = (this.document.getFlag('monks-active-tiles', 'files') || []).map((f, idx) => {
                        f.selected = (index == idx);
                        return f;
                    });

                    context.subtabs = this._prepareTabs("activetile");

                    break;
            }
            if (partId in context.tabs) context.tab = context.tabs[partId];
            return context;
        }

        async close(options = {}) {
            let result = await super.close(options);

            if (this.actionconfig && this.actionconfig.rendered)
                this.actionconfig.close();

            return result;
        }

        static saveTemplate(event, target) {
            foundry.applications.api.DialogV2.confirm({
                title: "Name of Template",
                content: `
<form>
    <div class="form-group">
        <label for= "name" >Template Name</label >
        <div class="form-fields">
            <input type="text" name="name" />
        </div>
    </div>
</form>`,
                form: {
                    closeOnSubmit: true,
                },
                yes: {
                    callback: async (event, button) => {
                        const fd = new foundry.applications.ux.FormDataExtended(button.form).object;
                        if (!fd.name)
                            return ui.notifications.error("Tile templates require a name");

                        let templates = setting("tile-templates") || [];
                        let data = this.options.document.toObject();
                        data._id = data.id = foundry.utils.randomID();
                        data.name = fd.name;
                        data.visible = true;
                        delete data.img;
                        data.img = data.texture.src;
                        data.thumbnail = data.img || "modules/monks-active-tiles/img/cube.svg";
                        if (foundry.helpers.media.VideoHelper.hasVideoExtension(data.thumbnail)) {
                            const t = await foundry.helpers.media.ImageHelper.createThumbnail(data.thumbnail, { width: 60, height: 60 });
                            data.thumbnail = t.thumb;
                        }
                        templates.push(data);
                        game.settings.set("monks-active-tiles", "tile-templates", templates);
                        ui.notifications.info("Tile information has been saved to Tile Templates.");
                        if (!MonksActiveTiles.tile_directory)
                            MonksActiveTiles.tile_directory = await new TileTemplates();
                        MonksActiveTiles.tile_directory.renderPopout();
                    }
                },
                options: {
                    width: 400
                }
            }
            );
        }

        get actions() {
            return this.document.getFlag("monks-active-tiles", "actions") || [];
        }

        get files() {
            return this.document.getFlag("monks-active-tiles", "files") || [];
        }

        _canDragStart(selector) {
            return true;
        }

        _canDragDrop(selector) {
            return true;
        }

        _onDragStart(event) {
            let li = event.currentTarget.closest(".entry");
            let list = event.currentTarget.closest("[data-collection]");
            if (list && li) {
                const dragData = {
                    type: this.document.constructor.documentName,
                    tileId: this.document.id,
                    collection: list.dataset.collection,
                    id: li.dataset.entryId
                };
                event.dataTransfer.setData("text/plain", JSON.stringify(dragData));
                this._dragType = dragData.type;
            }
        }

        async _onDrop(event) {
            // Try to extract the data
            let data = foundry.applications.ux.TextEditor.implementation.getDragEventData(event);

            // Identify the drop target
            let target = event.target.closest(".entry") || null;
            const list = event.target.closest("[data-collection]") || null;

            const collection = list?.dataset?.collection || null;

            if (data.tileId != this.document.id && collection) {
                // This is coming from a different tile
                if (data.collection == collection) {
                    let src = canvas.scene.tiles.get(data.tileId);
                    let entry = foundry.utils.getProperty(src, `flags.monks-active-tiles.${collection}`)?.find(a => a.id == data.id);

                    if (entry) {
                        let newEntry = foundry.utils.duplicate(entry);
                        newEntry.id = makeid();
                        let entries = foundry.utils.duplicate(this[collection]);
                        if (entries.length && !target)
                            target = $(`li[data-entry-id="${entries[0].id}"]`, this.element).get(0);
                        let to = entries.findIndex(a => a.id == target?.dataset.entryId) || 0;
                        entries.splice(to, 0, newEntry);
                        foundry.utils.setProperty(this.document, `flags.monks-active-tiles.${collection}`, entries);

                        let element = $(`li[data-entry-id="${data.id}"]`).clone().attr('data-entry-id', newEntry.id).attr(`data-${collection.slice(0, -1)}-id`, newEntry.id)
                        if (target)
                            $(element).insertBefore(target);
                        else
                            $(list).append(element);
                        element[0].addEventListener("dragstart", this._onDragStart.bind(this));
                        this.setPosition({ height: 'auto' });
                    }
                }
            } else {
                // This is to reposition an entry on the same tile
                if (target && target.dataset.entryId) {
                    let entries = foundry.utils.duplicate(this[collection]);

                    if (data.id === target.dataset.entryId) return; // Don't drop on yourself

                    let from = entries.findIndex(a => a.id == data.id);
                    let to = entries.findIndex(a => a.id == target.dataset.entryId);
                    log('from', from, 'to', to);
                    entries.splice(to, 0, entries.splice(from, 1)[0]);

                    foundry.utils.setProperty(this.document, `flags.monks-active-tiles.${collection}`, entries);
                    if (from < to)
                        $('.entry[data-entry-id="' + data.id + '"]', this.element).insertAfter(target);
                    else
                        $('.entry[data-entry-id="' + data.id + '"]', this.element).insertBefore(target);
                }
            }
        }

        async _onActionHoverIn(event) {
            event.preventDefault();
            if (!canvas.ready) return;
            const li = event.currentTarget;

            let action = this.actions.find(a => a.id == li.dataset.actionId);
            if (action && action.data.entity && !['tile', 'token', 'players', 'within', 'controlled', 'previous'].includes(action.data.entity.id)) {
                let entity = await fromUuid(action.data.entity.id);
                if (entity && entity._object) {
                    entity._object._onHoverIn(event);
                    this._highlighted = entity;
                }
            }
        }

        _onActionHoverOut(event) {
            event.preventDefault();
            if (this._highlighted) this._highlighted._object._onHoverOut(event);
            this._highlighted = null;
        }

        _processFormData(event, form, formData) {
            formData.object["flags.monks-active-tiles.actions"] = (this.document.getFlag("monks-active-tiles", "actions") || []);
            formData.object["flags.monks-active-tiles.files"] = (this.document.getFlag("monks-active-tiles", "files") || []);

            if (formData.object["flags.monks-active-tiles.fileindex"] != '')
                formData.object["flags.monks-active-tiles.fileindex"] = formData.object["flags.monks-active-tiles.fileindex"] - 1;

            if (typeof formData.object["flags.monks-active-tiles.trigger"] == "string")
                formData.object["flags.monks-active-tiles.trigger"] = formData.object["flags.monks-active-tiles.trigger"].split(",");

            return super._processFormData(event, form, formData);
        }

        async _processSubmitData(event, form, submitData, options = {}) {
            this.document._images = await MonksActiveTiles.getTileFiles(foundry.utils.getProperty(submitData, "flags.monks-active-tiles.files") || foundry.utils.getProperty(this.document, "flags.monks-active-tiles.files") || []);

            if (this.document._images.length) {
                let fileindex = Math.clamp(parseInt(foundry.utils.getProperty(submitData, "flags.monks-active-tiles.fileindex")), 0, this.document._images.length - 1);
                if (this.document._images[fileindex] != this.document.texture.src) {
                    foundry.utils.setProperty(submitData, "texture.src", this.document._images[fileindex]);
                }
                if (fileindex != foundry.utils.getProperty(submitData, "flags.monks-active-tiles.fileindex")) {
                    foundry.utils.setProperty(submitData, "flags.monks-active-tiles.fileindex", fileindex);
                }
            }
            await super._processSubmitData(event, form, submitData, options);
        }

        /*
        static async _updateObject(event, form, formData, options = {}) {
            this.document._images = await MonksActiveTiles.getTileFiles(foundry.utils.getProperty(this.document, "flags.monks-active-tiles.files") || []);

            if (!this.document.id && this.document._images.length) {
                let fileindex = Math.clamp(this.document.flags["monks-active-tiles"].fileindex, 0, this.document._images.length - 1);
                if (this.document._images[fileindex] != this.document.texture.src) {
                    formData["texture.src"] = this.document._images[fileindex];
                }
                if (fileindex != this.document.flags["monks-active-tiles"].fileindex) {
                    formData["flags.monks-active-tiles.fileindex"] = fileindex;
                }
            }

            await super._updateObject(event, form, formData, options);

            if (this.document.id && this.document._images.length) {
                let fileindex = Math.clamp(this.document.flags["monks-active-tiles"].fileindex, 0, this.document._images.length - 1);
                if (this.document._images[fileindex] != this.document.texture.src) {
                    await this.document.update({ texture: { src: this.document._images[fileindex] } });
                }
                if (fileindex != this.document.flags["monks-active-tiles"].fileindex) {
                    await this.document.setFlag("monks-active-tiles", "fileindex", fileindex);
                }
            }
        }*/

        static viewHistory() {
            new TileHistory({ document: this.document }).render(true);
        }

        static viewVariables() {
            new TileVariables({ document: this.document }).render(true);
        }

        async _onRender(context, options) {
            await super._onRender(context, options);

            $('.small-button', this.element).each(function () {
                $(this).attr("data-tooltip", $("span", this).html());
                $("span", this).remove();
            });

            const contextOptions = this._getContextOptions();
            Hooks.call(`getActiveTileConfigContext`, this.element, contextOptions);
            new foundry.applications.ux.ContextMenu(this.element, ".action-list .action", contextOptions, { fixed: true, jQuery: false });

            $('.record-history', this.element).click(this.checkRecordHistory.bind(this));
            $('.per-token', this.element).click(this.checkPerToken.bind(this));

            $('.multiple-dropdown-select', this.element).click((event) => {
                $('.multiple-dropdown-select .dropdown-list', this.element).toggleClass('open');
                event.preventDefault();
                event.stopPropagation();
            });
            $(this.element).click(() => { $('.multiple-dropdown-select .dropdown-list', this.element).removeClass('open'); });
            $('.multiple-dropdown-select .remove-option', this.element).on("click", this.removeTrigger.bind(this));
            $('.multiple-dropdown-select .multiple-dropdown-item', this.element).on("click", this.selectTrigger.bind(this));

            $('.image-list .image', this.element).on("dblclick", this.selectImage.bind(this));

            $('.actions-group header', this.element).on("click", ActiveTileConfig._createAction.bind(this));

            new foundry.applications.ux.DragDrop.implementation({
                dragSelector: ".action-list .action .name",
                dropSelector: ".actions-group",
                permissions: {
                    dragstart: this._canDragStart.bind(this),
                    drop: this._canDragDrop.bind(this)
                },
                callbacks: {
                    dragstart: this._onDragStart.bind(this),
                    drop: this._onDrop.bind(this)
                }
            }).bind(this.element);

            new foundry.applications.ux.DragDrop.implementation({
                dragSelector: ".image-list .image .name",
                dropSelector: ".images-group",
                permissions: {
                    dragstart: this._canDragStart.bind(this),
                    drop: this._canDragDrop.bind(this)
                },
                callbacks: {
                    dragstart: this._onDragStart.bind(this),
                    drop: this._onDrop.bind(this)
                }
            }).bind(this.element);
        }

        selectTrigger(event) {
            event.preventDefault();
            event.stopPropagation();
            // if this item is already in the list, then remove it, otherwise add it

            let id = $(event.currentTarget).attr("value");
            let triggers = $('input[name="flags.monks-active-tiles.trigger"]', this.element).val().split(",").filter(t => !!t);
            if (triggers.includes(id)) {
                // remove trigger
                triggers.findSplice(t => t === id);
                $(`.multiple-dropdown-item.selected[value="${id}"]`, this.element).removeClass("selected");
                $(`.multiple-dropdown-option[data-id="${id}"]`, this.element).remove();
            } else {
                // add trigger
                triggers.push(id);
                $(`.multiple-dropdown-item[value="${id}"]`, this.element).addClass("selected");
                $('.multiple-dropdown-content', this.element).append(
                    $("<div>").addClass("multiple-dropdown-option flexrow").attr("data-id", id)
                        .append($("<span>").html(MonksActiveTiles.triggerModes[id]))
                        .append($("<div>").addClass("remove-option").html("&times;").on("click", this.removeTrigger.bind(this)))
                );
            }
            $('input[name="flags.monks-active-tiles.trigger"]', this.element).val(triggers.join(","));
            $('.multiple-dropdown-select .dropdown-list', this.element).removeClass('open');
        }

        removeTrigger(event) {
            event.preventDefault();
            event.stopPropagation();
            // remove trigger from the list
            let li = event.currentTarget.closest(".multiple-dropdown-option");
            let id = li.dataset.id;
            let triggers = $('input[name="flags.monks-active-tiles.trigger"]', this.element).val().split(",");
            triggers.findSplice(t => t === id);
            $('input[name="flags.monks-active-tiles.trigger"]', this.element).val(triggers.join(","));
            li.remove();
            $(`.multiple-dropdown-item.selected[value="${id}"]`, this.element).removeClass("selected");
        }

        static browseImages(event) {
            this.requestFiles.call(this, "file", event);
        }

        static browseFolders(event) {
            this.requestFiles.call(this, "folder", event);
        }

        async requestFiles(type, event) {
            if (event == undefined) {
                event = type;
                type = null;
            }
            event?.preventDefault();
            const options = {
                type: type == "folder" ? "folder" : "image",
                wildcard: true,
                callback: type == "folder" ? this.addFolder.bind(this) : this.addFile.bind(this),
            };
            //this._getFilePickerOptions(event);

            const fp = new CONFIG.ux.FilePicker.implementation(options);
            //this.filepickers.push(fp);
            return fp.browse();
        }

        async addFile(filename, filePicker) {
            if (filename != '') {
                let file = { id: makeid(), name: filename, selected: false };
                await this.addImageEntry(file);
                let files = foundry.utils.duplicate(this.files);
                files.push(file);
                foundry.utils.mergeObject(this.document.flags, {
                    "monks-active-tiles": { files: files }
                });
                this.setPosition({ height: 'auto' });
            }
        }

        async addFolder(foldername, filepicker) {
            let source = "data";
            let pattern = foldername;
            const browseOptions = {};

            if (typeof ForgeVTT != "undefined" && ForgeVTT.usingTheForge) {
                source = "forgevtt";
            }

            // Support S3 matching
            if (/\.s3\./.test(pattern)) {
                source = "s3";
                const { bucket, keyPrefix } = FilePicker.parseS3URL(pattern);
                if (bucket) {
                    browseOptions.bucket = bucket;
                    pattern = keyPrefix;
                }
            }

            // Retrieve wildcard content
            try {
                const content = await foundry.applications.apps.FilePicker.implementation.browse(source, pattern, browseOptions);
                let files = foundry.utils.duplicate(this.files);
                for (let filename of content.files) {
                    let ext = filename.substr(filename.lastIndexOf('.') + 1);
                    if (CONST.IMAGE_FILE_EXTENSIONS[ext] != undefined) {
                        let file = { id: makeid(), name: filename, selected: false }
                        await this.addImageEntry(file);
                        files.push(file);
                    }
                }
                foundry.utils.mergeObject(this.document.flags, {
                    "monks-active-tiles": { files: files }
                });
                this.setPosition({ height: 'auto' });
            } catch (err) {
                error(err);
            }
        }

        async addImageEntry({ id, name }) {
            if (name != '') {
                let html = await foundry.applications.handlebars.renderTemplate("modules/monks-active-tiles/templates/image-partial.hbs", { id, name });
                let li = $(html);
                $(`.image-list`, this.element).append(li);
                $(".name", li)[0].addEventListener("dragstart", this._onDragStart.bind(this));
            }
        }

        selectImage(event) {
            let id = event.currentTarget.closest('.image').dataset.imageId;
            let idx = this.files.findIndex(f => f.id == id);

            $(`input[name="flags.monks-active-tiles.fileindex"]`, this.element).val(idx);

            foundry.utils.mergeObject(this.document.flags, {
                "monks-active-tiles": { fileindex: idx }
            });
        }

        static removeImage(event, target) {
            let id = target.closest('.image').dataset.imageId;
            let files = foundry.utils.duplicate(this.files);
            files.findSplice(i => i.id == id);
            foundry.utils.mergeObject(this.document.flags, {
                "monks-active-tiles": { files: files }
            });

            $(`.image-list li[data-image-id="${id}"]`, this.element).remove();
            this.setPosition({ height: 'auto' });
        }

        static async _createAction(event, target, index = -1) {
            let action = { };
            this.actionconfig = await new ActionConfig({ action, parent: this, index }).render(true);
        }

        static async _editAction(event, target) {
            let item = target.closest('.action');
            let action = this.actions.find(obj => obj.id == item.dataset.actionId);
            if (action != undefined)
                this.actionconfig = await new ActionConfig({ action, parent: this }).render(true);
        }

        static _deleteAction(event, target) {
            let item = target.closest('.action');
            this.deleteAction(item.dataset.actionId);
        }

        deleteAction(id) {
            let actions = foundry.utils.duplicate(this.actions);
            actions.findSplice(i => i.id == id);
            foundry.utils.mergeObject(this.document.flags, {
                "monks-active-tiles": { actions: actions }
            });
            //this.document.setFlag("monks-active-tiles", "actions", actions);
            $(`li[data-action-id="${id}"]`, this.element).remove();
            this.setPosition({ height: 'auto' });
        }

        _stopSound(event) {
            let id = event.currentTarget.closest('.sound').dataset.soundId;
            if (this.document.soundeffect[id]) {
                this.document.soundeffect[id].stop();
                delete this.document.soundeffect[id];
            }
            MonksActiveTiles.emit('stopsound', {
                tileid: this.document.uuid,
                type: 'tile',
                userId: null,
                actionid: id
            });
            this.render();
        }

        cloneAction(id) {
            let actions = foundry.utils.duplicate(this.actions);
            let idx = actions.findIndex(obj => obj.id == id);
            if (idx == -1)
                return;

            let action = actions[idx];
            if (!action)
                return;

            let clone = foundry.utils.duplicate(action);
            clone.id = makeid();
            actions.splice(idx + 1, 0, clone);
            //if (this.document.id) {
            //    this.document.setFlag("monks-active-tiles", "actions", actions);
            //} else {
            foundry.utils.setProperty(this.document, "flags.monks-active-tiles.actions", actions);
            this.render();
            //}
        }

        checkRecordHistory(event) {
            // if turning off record-history, then also turn off per token
            if (!$('.record-history', this.element).prop("checked"))
                $('.per-token', this.element).prop("checked", false);
        }

        checkPerToken(event) {
            // if turning on per token, then also turn on record-history
            if ($('.per-token', this.element).prop("checked"))
                $('.record-history', this.element).prop("checked", true);
        }

        resetPerToken() {
            this.document.resetPerToken();
        }

        _getContextOptions() {
            return [
                {
                    name: "Insert Above",
                    icon: '<i class="far fa-objects-align-top"></i>',
                    condition: () => game.user.isGM,
                    callback: elem => {
                        let li = $(elem).closest('.action');
                        let idx = li.index();
                        ActiveTileConfig._createAction.call(this, null, li, idx);
                    }
                },
                {
                    name: "Insert Below",
                    icon: '<i class="far fa-objects-align-bottom"></i>',
                    condition: () => game.user.isGM,
                    callback: elem => {
                        let li = $(elem).closest('.action');
                        let idx = li.index();
                        ActiveTileConfig._createAction.call(this, null, li, idx + 1);
                    }
                },
                {
                    name: "SIDEBAR.Duplicate",
                    icon: '<i class="far fa-copy"></i>',
                    condition: () => game.user.isGM,
                    callback: elem => {
                        let li = elem.closest('.action');
                        const id = li.dataset.actionId;
                        return this.cloneAction(id);
                    }
                },
                {
                    name: "SIDEBAR.Delete",
                    icon: '<i class="fas fa-trash"></i>',
                    condition: () => game.user.isGM,
                    callback: elem => {
                        let li = elem.closest('.action');
                        const id = li.dataset.actionId;;
                        foundry.applications.api.DialogV2.confirm({
                            window: {
                                title: `${game.i18n.localize("SIDEBAR.Delete")} action`,
                            },
                            content: game.i18n.format("SIDEBAR.DeleteWarning", { type: 'action' }),
                            yes: {
                                callback: this.deleteAction.bind(this, id)
                            },
                            options: {
                                top: Math.min(li.offsetTop, window.innerHeight - 350),
                                left: window.innerWidth - 720
                            }
                        });
                    }
                }
            ];
        }
    }

    const constructorName = "ActiveTileConfig";
    Object.defineProperty(ActiveTileConfig.prototype.constructor, "name", { value: constructorName });
    return ActiveTileConfig;
};
