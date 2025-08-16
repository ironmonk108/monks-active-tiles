import { MonksActiveTiles, log, error, setting, i18n, makeid } from '../monks-active-tiles.js';
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api

export class ActionConfig extends HandlebarsApplicationMixin(ApplicationV2) {
    constructor(options = {}) {
        super(options);

        this.tokenAttr = [];
        this.tileAttr = [];

        //let's just grab the first player character we can find
        let token = canvas.scene.tokens?.contents[0];
        if (token) {
            try {
                let attributes = getDocumentClass("Token").getTrackedAttributes(token ?? {});
                if (attributes)
                    this.tokenAttr = (this.tokenAttr || []).concat(attributes.value.concat(attributes.bar).map(a => a.join('.')));
            } catch { }
        }
        let player = game.actors.find(a => a.type == 'character');
        if (player) {
            try {
                let attributes = getDocumentClass("Token").getTrackedAttributes(player.system ?? {});
                if (attributes)
                    this.tokenAttr = (this.tokenAttr || []).concat(attributes.value.concat(attributes.bar).map(a => a.join('.')));
            } catch {}
        }

        let tile = canvas.scene.tiles?.contents[0];
        if (tile) {
            try {
                this.tileAttr = (ActionConfig.getTileTrackedAttributes(tile.schema ?? {}) || [])
                    .filter(a => a && a.length > 0)
                    .map(a => a.join('.'));
            } catch (e) {
                log(e);
            }
        }

        this.autoanchors = [
            "_enter",
            "_exit",
            "_movement",
            "_stop",
            "_elevation",
            "_rotation",
            "_darkness",
            "_time",
            "_click",
            "_rightclick",
            "_dblrightclick",
            "_dblclick",
            "_create",
            "_hoverin",
            "_hoverout",
            "_combatstart",
            "_round",
            "_turn",
            "_turnend",
            "_combatend",
            "_ready",
            "_manual",
            "_gm",
            "_player",
            "_dooropen",
            "_doorclose",
            "_doorsecret",
            "_doorlock",
            "_left",
            "_up",
            "_right",
            "_down",
            "_up-left",
            "_up-right",
            "_down-left",
            "_down-right"
        ];
    }

    static DEFAULT_OPTIONS = {
        id: "trigger-action",
        tag: "form",
        classes: ["action-sheet"],
        window: {
            contentClasses: ["standard-form"],
            icon: "fa-solid fa-running",
            resizable: false,
            title: "MonksActiveTiles.TriggerAction",
        },
        form: {
            handler: ActionConfig._updateObject,
            submitOnChange: false,
            closeOnSubmit: true
        },
        actions: {
            addFile: ActionConfig.addFile,
            removeFile: ActionConfig.removeFile,
            addButton: ActionConfig.addButton,
            editButton: ActionConfig.editButton,
            removeButton: ActionConfig.removeButton,

            selectEntity: ActionConfig.selectEntity,
            selectPosition: ActionConfig.selectPosition,
            addTag: ActionConfig.addTag
        },
        position: {
            width: 550
        }
    };

    static PARTS = {
        body: {
            template: "./modules/monks-active-tiles/templates/action-config.html",
            templates: [
                "modules/monks-active-tiles/templates/action-field.hbs",
                "modules/monks-active-tiles/templates/filelist-partial.hbs",
                "modules/monks-active-tiles/templates/buttonlist-partial.hbs",
            ]
        },
        footer: { template: "templates/generic/form-footer.hbs" }
    };

    _initializeApplicationOptions(options) {
        options = super._initializeApplicationOptions(options);
        const theme = foundry.applications.apps.DocumentSheetConfig.getSheetThemeForDocument(options.parent.document);
        if (theme && !options.classes.includes("themed")) options.classes.push("themed", `theme-${theme}`);
        return options;
    }

    async _preparePartContext(partId, context, options) {
        context = await super._preparePartContext(partId, context, options);
        switch (partId) {
            case "body":
                this._prepareBodyContext(context, options);
                break;
            case "footer":
                context.buttons = this.prepareButtons();
        }

        return context;
    }

    async _prepareBodyContext(context, options) {
        let groups = {};
        for (let group of Object.keys(MonksActiveTiles.triggerGroups))
            groups[group] = [];
        for (let [k, v] of Object.entries(MonksActiveTiles.triggerActions)) {
            let group = v.group || 'actions';
            if (groups[group] == undefined) {
                error(`${group} is not a registered Tile Group`);
                continue;
            }
            if (v.visible === false)
                continue;
            groups[group].push({ id: k, name: i18n(v.name) });
        }

        let availableActions = Object.entries(groups).map(([k, v]) => {
            return (v.length > 0 ? {
                text: i18n(MonksActiveTiles.triggerGroups[k].name),
                groups: v.sort((a, b) => {
                    // Sort by name
                    return a.name.localeCompare(b.name);

                }).reduce(function (result, item) {
                    result[item.id] = item.name;
                    return result;
                }, {})
            } : null);
        }).filter(g => g);

        return foundry.utils.mergeObject(context, { action: this.options.action.action, availableActions });
    }

    prepareButtons() {
        return [
            {
                type: "submit",
                icon: "fas fa-save",
                label: "MonksActiveTiles.Update",
            }
        ];
    }

    _attachFrameListeners() {
        super._attachFrameListeners();
        this.element.addEventListener("drop", this._onDrop.bind(this));
    }

    async _onRender(context, options) {
        await super._onRender(context, options);
        var that = this;

        this.changeAction.call(this, this.options.action.action);
        
        $('select[name="action"]', this.element).change(function () {
            //clear out these before saving the new information so we don't get data bleed through
            if (that.options.action.data) {
                that.options.action.location = {};
                that.options.action.entity = {};
                that.options.action.item = {};
                that.options.action.actor = {};
                that.options.action.token = {};
            }
            that.changeAction.call(that);
        });

        new foundry.applications.ux.DragDrop.implementation({
            dragSelector: ".document.actor, .document.item",
            dropSelector: ".actions-container",
            permissions: {
                dragstart: this._canDragStart.bind(this),
                drop: this._canDragDrop.bind(this)
            },
            callbacks: {
                dragstart: this._onDragStart.bind(this),
                drop: this._onDrop.bind(this)
            }
        }).bind(this.element);

        /*
            dragDrop: [
                { dragSelector: ".document.actor", dropSelector: ".action-container" },
                { dragSelector: ".document.item", dropSelector: ".action-container" },
                { dragSelector: ".items-list .button-list .file-row", dropSelector: ".items-list .button-list" }
            ]
*/
    }

    async _onSubmitForm(...args) {
        let [formConfig, event] = args;
        event.preventDefault();
        let that = this;
        //confirm that all required fields have a value
        let allGood = true;
        $('.required[name]', this.element).each(function () {
            if ($(this).is(':visible') || ($(this).attr("type") == "hidden" && $(this).parent().is(':visible'))) {
                // If the select has no items then it's not required
                if (this.tagName == "SELECT" && $(this).children().length == 0) return;
                let ctrl = $(this);
                if (this.tagName == "FILE-PICKER" || this.tagName == "COLOR-PICKER")
                    ctrl = $("input[type='text']", this);
                let value = ctrl.attr("type") == "hidden" ? ctrl.data("value") : ctrl.val();

                if (!value)
                    allGood = false;
            } 
        })

        if (!allGood) {
            ui.notifications.error('Cannot save, not all required fields have been filled in.');
            return false;
        }

        let cond;
        $('.check', this.element).each(function () {
            cond = $(this).data('check').call(that, that);
            if (!!cond)
                allGood = false;
        });

        if (!!cond) {
            ui.notifications.error(cond);
            return false;
        }

        return super._onSubmitForm.call(this, ...args);
    }

    _getSubmitData() {
        let formData = new foundry.applications.ux.FormDataExtended(this.element);
        for (let [k, v] of Object.entries(formData.object)) {
            $(`[name="${k}"]`, this.element).each(function () {
                let value = $(this).data("value");
                if (value !== undefined)
                    formData.object[k] = value;
            });
        }
        let fd = foundry.utils.expandObject(formData.object);

        let files = null;
        if (fd.files) {
            for (let [k, v] of Object.entries(fd.files)) {
                let values = (v instanceof Array ? v : [v]);
                if (files == undefined) {
                    files = values.map(file => { let obj = {}; obj[k] = file; return obj; });
                } else {
                    for (let i = 0; i < values.length; i++) {
                        files[i][k] = values[i];
                    }
                }
            }
            delete fd.files;
            fd.data.files = files;
        }
        /*
        if (data.buttons) {
            data.data.buttons = JSON.parse(data.buttons || "[]");
            delete data.buttons;
        }
        */

        $('input.range-value', this.element).each(function () {
            if ($(this).val() == "") foundry.utils.setProperty(fd, $(this).prev().attr("name"), "");
        });

        return fd;
    }

    static async _updateObject(event, form, formData) {
        let document = this.options.parent.document;
        let action = this.options.action;
        let fd = formData.object;
        log('updating action', event, fd, document);

        for (let [k, v] of Object.entries(fd)) {
            $(`[name="${k}"]`, this.element).each(function () {
                let value = $(this).data("value");
                if (value !== undefined)
                    fd[k] = value;
            });
        }

        if (fd['data.attack'])
            fd['data.attack'] = { id: fd['data.attack'], name: $('select[name="data.attack"] option:selected', this.element).text() };

        if (action.id == undefined) {
            foundry.utils.mergeObject(action, foundry.utils.expandObject(fd));
            action.id = makeid();
            let actions = foundry.utils.duplicate(this.options.parent.document.getFlag("monks-active-tiles", "actions") || []);
            let append = this.options.index === -1 || this.options.index === actions.length;
            if (append)
                actions.push(action);
            else
                actions.splice(this.options.index, 0, action);

            foundry.utils.mergeObject(document.flags, {
                "monks-active-tiles": { actions: actions }
            });
            //add this row to the parent
            let trigger = MonksActiveTiles.triggerActions[action.action];
            let content = i18n(trigger.name);
            if (trigger.content) {
                try {
                    content = await trigger.content(trigger, action, this.options.parent.actions);
                } catch { }
            }

            let html = await foundry.applications.handlebars.renderTemplate("modules/monks-active-tiles/templates/action-partial.hbs", { id: action.id, content });
            let li = $(html);
            //$("button[data-action], a[data-action]", li).click(this.options.parent._onClickAction.bind(this.options.parent));

            if (append)
                li.appendTo($(`.action-list`, this.options.parent.element));
            else
                $(`.action-list .action`, this.options.parent.element).eq(this.options.index).before(li);

            $(".name", li)[0].addEventListener("dragstart", this.options.parent._onDragStart.bind(this.options.parent));
        } else {
            let actions = foundry.utils.duplicate(this.options.parent.document.getFlag("monks-active-tiles", "actions") || []);
            let actionData = actions.find(a => a.id == action.id);
            if (actionData) {
                //clear out these before saving the new information so we don't get data bleed through
                if (actionData.data) {
                    if (actionData.data.location) actionData.data.location = {};
                    if (actionData.data.entity) actionData.data.entity = {};
                    if (actionData.data.item) actionData.data.item = {};
                    if (actionData.data.actor) actionData.data.actor = {};
                }
                if (this.options.parent.document._sounds) {
                    this.options.parent.document._sounds[actionData.id] = [];
                }
                foundry.utils.mergeObject(actionData, foundry.utils.expandObject(fd));
                this.options.parent.document.flags["monks-active-tiles"].actions = actions;
                //update the text for this row
                let trigger = MonksActiveTiles.triggerActions[actionData.action];
                let content = i18n(trigger.name);
                if (trigger.content) {
                    try {
                        content = await trigger.content(trigger, actionData);
                    } catch { }
                }
                $(`.action-list .action[data-action-id="${actionData.id}"] .name > span`, this.options.parent.element).html(content);
            }
        }

        this.options.parent.setPosition({ height: 'auto' });
    }


    static async onValueChange(event) {
        let elem = $(event.currentTarget).closest(".action-field");
        let ctrl = elem.data("ctrl");
        let id = ctrl?.id ?? event.originalEvent.target.dataset.target;
        if (!id.startsWith("flags"))
            id = "data." + id;
        let field = event.currentTarget || $(`[name="${id}"]`, elem).get(0);

        if (ctrl?.onChange && typeof ctrl?.onChange == "function") {
            let command = $('select[name="action"]', this.element).val();
            let action = MonksActiveTiles.triggerActions[command];

            let data = this.options.action.data || {};
            ctrl.onChange.call(this, this, field, action, data, event.originalEvent);
        }

        if (ctrl?.check) {
            this.checkConditional();
        }

        let fieldType = elem.get(0).dataset.fieldType;
        if (fieldType == "filelist" || fieldType == "buttonlist") {
            let list = $("ol", elem);
            list.empty();
            let entries = $(field).data("value") || [];
            for (let entry of entries) {
                let content = await foundry.applications.handlebars.renderTemplate(`modules/monks-active-tiles/templates/${fieldType}-partial.hbs`, entry);
                list.append(content);
            }
        }
        if (fieldType == "select") {
            // Need to update the display value properly
            let displayField = elem.find('.display-value');

            let subtype = ctrl?.subtype || event.originalEvent.target.dataset.type || "entity";
            let default_placeholder = subtype == 'entity' ? 'Please select an entity' : 'Please select a location';
            let value = $(field).data("value") || $(field).val();
            displayField.html((subtype == 'entity' ? await MonksActiveTiles.entityName(value, ctrl.defaultType) : await MonksActiveTiles.locationName(value)) || `<span class="placeholder-style">${i18n(ctrl?.placeholder) || default_placeholder}</span>`);
        }
    }

    async close(options = {}) {
        ActionConfig.updateSelection.call(this, null);
        return super.close(options);
    }

    _canDragStart(selector) {
        return true;
    }

    _canDragDrop(selector) {
        return true;
    }

    _onDragStart(event) {
        let li = event.currentTarget.closest(".file-row");
        let list = event.currentTarget.closest(".items-list");
        if (list) {
            const dragData = {
                type: "button",
                tileId: this.options.parent.document.id,
                collection: list.dataset.collection,
                id: li.dataset.id
            };
            event.dataTransfer.setData("text/plain", JSON.stringify(dragData));
            this._dragType = dragData.type;
        }
    }

    async _onDrop(event) {
        let data = foundry.applications.ux.TextEditor.implementation.getDragEventData(event);

        let action = $('[name="action"]', this.element).val();

        if (data.type == "Macro" && action == "runmacro") {
            $('input[name="data.entity"]', this.element).data("value", { id: data.uuid });
            ActionConfig.onValueChange.call(this, { currentTarget: $('input[name="data.entity"]', this.element).get(0), originalEvent: event });
        } else if (data.type == "Scene" && action == "scene") {
            $('input[name="data.sceneid"]', this.element).data("value", { id: data.uuid });
            ActionConfig.onValueChange.call(this, { currentTarget: $('input[name="data.sceneid"]', this.element).get(0), originalEvent: event });
        } else if (data.type == "RollTable" && action == "rolltable") {
            $('input[name="data.rolltableid"]', this.element).data("value", { id: data.uuid });
            ActionConfig.onValueChange.call(this, { currentTarget: $('input[name="data.rolltableid"]', this.element).get(0), originalEvent: event });
        } else if (data.type == "Actor" && action == "attack") {
            let field = $('input[name="data.actor"]', this.element);
            if (field.length == 0)
                return;

            let actor = await fromUuid(data.uuid);
            if (!actor) return;

            this.waitingfield = field;
            ActionConfig.updateSelection.call(this, { uuid: actor.uuid, name: actor.name });
        } else if (data.type == "Item" && action == "additem") {
            let field = $('input[name="data.item"]', this.element);

            if (field.length == 0)
                return;

            let item = await fromUuid(data.uuid);

            if (!item) return;

            this.waitingfield = field;
            ActionConfig.updateSelection.call(this, { id: item.uuid, name: (item?.parent?.name ? item.parent.name + ": " : "") + item.name });
        } else {
            //check to see if there's an entity field on the form, or an item field if it's adding an item.
            let field = $(`input[name="data.${action == "attack" ? "actor" : "entity"}"]`, this.element);
            if (field.length == 0)
                return;

            let entity = await fromUuid(data.uuid);

            if (!entity) return;

            let restrict = field.data('restrict');

            if (restrict && !restrict(entity)) {
                ui.notifications.error(i18n("MonksActiveTiles.msg.invalid-entity"));
                return;
            }

            this.waitingfield = field;
            if (entity.document)
                ActionConfig.updateSelection.call(this, { id: entity.document.uuid, name: entity.document.name || (entity.document.documentName + ": " + entity.document.id) });
            else
                ActionConfig.updateSelection.call(this, { id: entity.uuid, name: (entity?.parent?.name ? entity.parent.name + ": " : "") + entity.name });
        }

        log('drop data', event, data);
    }

    async _onButtonDrop(event) {
        let data = foundry.applications.ux.TextEditor.implementation.getDragEventData(event);

        let action = $('[name="action"]', this.element).val();

        // Call the drop handler
        if (target && target.dataset.id) {
            let items = foundry.utils.duplicate(this.buttonlist);

            if (data.id === target.dataset.id) return; // Don't drop on yourself

            let from = items.findIndex(a => a.id == data.id);
            let to = items.findIndex(a => a.id == target.dataset.id);
            log('from', from, 'to', to);
            items.splice(to, 0, items.splice(from, 1)[0]);

            this.options.parent.document.flags["monks-active-tiles"].buttonlist = items;
            if (from < to)
                $('.item[data-id="' + data.id + '"]', this.element).insertAfter(target);
            else
                $('.item[data-id="' + data.id + '"]', this.element).insertBefore(target);
        }
        
        log('drop data', event, data);
    }

    /*
    _activateFilePicker(event) {
        event.preventDefault();
        const options = this._getFilePickerOptions(event);
        options.wildcard = true;
        const fp = new FilePicker(options);
        if (event.currentTarget.dataset.type == "html")
            fp.extensions = [".html"];
        this.filepickers.push(fp);
        return fp.browse();
    }
    */

    static getTileTrackedAttributes(schema, _path = [], depth = 0) {
        if (!schema)
            return [];
        if (depth > 5)
            return [];

        // Track the path and record found attributes
        const attributes = [];

        for (const [name, field] of Object.entries(schema.fields)) {
            const p = _path.concat([name]);
            if (field instanceof foundry.data.fields.NumberField)
                attributes.push(p);
            else {
                const isSchema = field instanceof foundry.data.fields.SchemaField;
                const isModel = field instanceof foundry.data.fields.EmbeddedDataField;
                if (isSchema || isModel) {
                    const schema = isModel ? field.model.schema : field;

                    const inner = this.getTileTrackedAttributes(schema, p, depth + 1);
                    attributes.push(...inner);
                }
            }
        }
        return attributes;
    }

    async fillList(list, select, selectedId) {
        if (!list)
            return;

        let options = this.getListFieldData(list, selectedId);

        let html = await foundry.applications.handlebars.renderTemplate("modules/monks-active-tiles/templates/list-partial.hbs", { options });
        select.append(html);
    }

    getListFieldData(list, selectedId) {
        if (!list)
            return;

        if (list instanceof Array) {
            return list
                .map(g => {
                    if (g.groups) {
                        let gtext = g.label ?? g.text ?? g.id;
                        if (game.i18n.has(gtext))
                            gtext = i18n(gtext);
                        return {
                            group: true,
                            label: gtext,
                            items: Object.entries(g.groups)
                                .map(([k, v]) => {
                                    let gid = (g.id ? g.id + ":" : '') + (g.groups instanceof Array ? v.id : k);
                                    let text = typeof v == "string" ? v : v.label ?? v.name;
                                    if (game.i18n.has(text))
                                        text = i18n(text);
                                    return {
                                        value: gid,
                                        label: text,
                                        selected: gid == selectedId
                                    };
                                })
                        };
                    } else {
                        let gid = g.id ?? g;
                        let text = typeof g == "string" ? g : g.label ?? g.name;
                        if (game.i18n.has(text))
                            text = i18n(text);
                        return {
                            value: gid,
                            label: text,
                            selected: gid == selectedId
                        };
                    }
                });
        } else {
            return Object.entries(list)
                .map(([k, v]) => {
                    if (!v) return null;
                    let text = typeof v == "string" ? v : v?.label ?? v?.name;
                    if (game.i18n.has(text))
                        text = i18n(text);

                    return {
                        value: k,
                        label: text,
                        selected: k == selectedId
                    }
                }).filter(o => !!o);
        }
    }

    static addFile(event) {
        let filename = $(event.currentTarget).val();
        if (filename != '') {
            let id = makeid();
            $('.file-list', this.element).append($('<li>').attr('data-id', id)
                .addClass('flexrow')
                .append($('<input>').attr({ 'type': 'hidden', 'name': 'files.id' }).val(id))
                .append($('<input>').attr({ 'type': 'hidden', 'name': 'files.name' }).val(filename))
                .append($('<span>').addClass('image-name').html(filename))
                .append($('<a>').css({ 'flex': '0 0 28px', height: '28px', width: '28px' }).html('<i class="fas fa-trash fa-sm"></i>').click(this.removeFile.bind(this, id))));
            $(event.currentTarget).val('');
            this.setPosition({ height: 'auto' });
        }
    }

    static removeFile(id, event) {
        $(`.file-list li[data-id="${id}"]`, this.element).remove();
        this.setPosition({ height: 'auto' });
    }

    static addButton(event, target) {
        let ctrl = $(target).closest(".action-field").data("ctrl");
        let field = $(target).closest(".buttons-list").find(`[name="data.${ctrl.id}"]`);
        this._editButton({}, field, event);
    }

    static async editButton(event, target) {
        let buttonId = target.closest(".button-row").dataset.buttonId;
        let ctrl = $(target).closest(".action-field").data("ctrl");
        let field = $(target).closest(".buttons-list").find(`[name="data.${ctrl.id}"]`);
        let buttons = field.data("value");

        let button = buttons.find(b => b.id == buttonId);
        this._editButton(button, field, event);
    }

    async _editButton(data, field, event) {
        let content = await foundry.applications.handlebars.renderTemplate("modules/monks-active-tiles/templates/button-edit.html", data);
        await foundry.applications.api.DialogV2.confirm({
            window: {
                title: foundry.utils.isEmpty(data) ? "New Button" : "Edit Button"
            },
            content,
            yes: {
                label: "Save",
                icon: "fas fa-save",
                callback: (event, button) => {
                    const fd = new foundry.applications.ux.FormDataExtended(button.form).object;
                    data = foundry.utils.mergeObject(data, fd);

                    let buttons = field.data("value") || [];
                    if (!data.id) {
                        data.id = foundry.utils.randomID();
                        buttons.push(data);
                    } else {
                        let button = buttons.find(b => b.id == data.id);
                        Object.assign(button, data);
                    }

                    field.data("value", buttons);
                    ActionConfig.onValueChange.call(this, { currentTarget: field.get(0), originalEvent: event });
                }
            },
            no: {
                label: "Cancel",
                icon: "fas fa-times",
            }
        })
    }

    static removeButton(event, target) {
        let buttonId = target.closest(".button-row").dataset.buttonId;
        let ctrl = $(target).closest(".action-field").data("ctrl");
        let field = $(target).closest(".buttons-list").find(`[name="data.${ctrl.id}"]`);

        let buttons = field.data("value");
        buttons.findSplice((b) => { return b.id == buttonId });
        field.data("value", buttons);
        ActionConfig.onValueChange.call(this, { currentTarget: field.get(0), originalEvent: event });
    }

    static async selectEntity(event, target) {
        let btn = $(target);
        let field = $('[name="' + btn.attr('data-target') + '"]', this.element);
        let displayField = field.closest(".action-field").find('.display-value');

        this.attributes = this.tokenAttr;

        let defType = field.data('deftype') || "";
        let dataType = btn.attr('data-type');

        switch (dataType) {
            case 'tile':
                field.data("value", { "id": "tile", "name": i18n("MonksActiveTiles.ThisTile") });
                displayField.html(i18n("MonksActiveTiles.ThisTile"));
                this.attributes = this.tileAttr;
                break;
            case 'token':
                {
                    let displayName = defType == "scenes" ? i18n("MonksActiveTiles.TriggeringTokenScene") : i18n("MonksActiveTiles.TriggeringToken");
                    field.data("value", { "id": "token", "name": displayName });
                    displayField.html(displayName);
                }
                break;
            case 'scene':
                field.data("value", { "id": "scene", "name": i18n("MonksActiveTiles.ActiveScene") });
                displayField.html(i18n("MonksActiveTiles.ActiveScene"));
                break;
            case 'players':
                field.data("value", { "id": "players", "name": i18n("MonksActiveTiles.PlayerTokens") });
                displayField.html(i18n("MonksActiveTiles.PlayerTokens"));
                break;
            case 'users':
                field.data("value", { "id": "users", "name": i18n("MonksActiveTiles.Players") });
                displayField.html(i18n("MonksActiveTiles.Players"));
                break;
            case 'within':
                {
                    let collection = $(event.currentTarget).closest(".trigger-action").find('[name="data.collection"]').val();
                    let displayName = game.i18n.format("MonksActiveTiles.WithinTile", { collection: (collection || field.data("deftype") || "tokens").capitalize() });
                    field.data("value", { "id": "within", "name": displayName });
                    displayField.html(displayName);
                }
                break;
            case 'controlled':
                {
                    let displayName = field.data("deftype") == "playlists" ? i18n("MonksActiveTiles.CurrentlyPlaying") : i18n("MonksActiveTiles.Controlled");
                    field.data("value", { "id": "controlled", "name": displayName });
                    displayField.html(displayName);
                }
                break;
            case 'previous':
                {
                    let collection = $(event.currentTarget).closest(".trigger-action").find('[name="data.collection"]').val();
                    let displayName = (field.data('type') == 'entity' ? game.i18n.format("MonksActiveTiles.CurrentCollection", { collection: collection || field.data("deftype") || "tokens" }) : i18n("MonksActiveTiles.CurrentLocation"));
                    field.data("value", { "id": "previous", "name": displayName });
                    displayField.html(displayName);
                }
                break;
            case 'origin':
                field.data("value", { "id": "origin", "name": i18n("MonksActiveTiles.Origin") });
                displayField.html(i18n("MonksActiveTiles.Origin"));
                break;
            default:
                if (!this._minimized)
                    await this.minimize();
                if (this.options.parent && !this.options.parent._minimized)
                    await this.options.parent.minimize();

                this.waitingfield = field;
                MonksActiveTiles.waitingInput = this;

                MonksActiveTiles.lasttab = null;
                MonksActiveTiles.collapsesidebar = false;
                if (defType == 'rolltables')
                    defType = 'tables';

                if (ui[defType] != undefined) {
                    if (ui.sidebar.tabGroups.primary != defType) {
                        MonksActiveTiles.lasttab = ui.sidebar.tabGroups.primary;
                        ui.sidebar.changeTab(defType, "primary");

                        if (!ui.sidebar.expanded) {
                            MonksActiveTiles.collapsesidebar = true;
                            ui.sidebar.toggleExpanded(true);
                        }
                    }
                }

                MonksActiveTiles.lasttool = null;
                let tool = ui.controls.controls[field.data('deftype')];
                if (tool) {
                    if (tool.name !== ui.controls.control.name) {
                        MonksActiveTiles.lasttool = ui.controls.control.name;
                        let layer = canvas[tool.layer] ?? canvas[tool.name];
                        if (layer) {
                            MonksActiveTiles.lasttool = ui.controls.control.name;
                            layer.activate();
                        }
                    }
                }
                break;
        }

        ActionConfig.onValueChange.call(this, { currentTarget: field.get(0), originalEvent: event });
    }

    static async updateSelection(selection, event) {
        delete MonksActiveTiles.waitingInput;

        if (!this.waitingfield)
            return;

        let waitingField = this.waitingfield;
        delete this.waitingfield;

        await this.maximize();
        if (this.options.parent)
            await this.options.parent.maximize();

        if (MonksActiveTiles.lasttab) {
            ui.sidebar.changeTab(MonksActiveTiles.lasttab, "primary");
            delete MonksActiveTiles.lasttab;
            if (MonksActiveTiles.collapsesidebar) {
                ui.sidebar.toggleExpanded(false);
                delete MonksActiveTiles.collapsesidebar;
            }
        }

        if (MonksActiveTiles.lasttool) {
            let tool = ui.controls.controls[MonksActiveTiles.lasttool];
            if (tool) {
                let layer = canvas[tool.layer] ?? canvas[tool.name];
                if (layer) {
                    layer.activate();
                }
            }
            delete MonksActiveTiles.lasttool;
        }

        if (this.options.parent) {
            if (canvas.scene.id != this.options.parent.document.parent.id)
                await game.scenes.get(this.options.parent.document.parent.id).view();
        }

        if (waitingField && waitingField.attr('name') == 'data.actor') {
            let select = $('select[name="data.attack"]', this.element);
            select.empty();
            if (selection.id) {
                let elem = select.closest(".action-field");
                let ctrl = elem.data("ctrl");

                let list = await ctrl.list.call(this, this, null, { actor: { id: selection.id } }) || [];

                await this.fillList(list, select, '');
            }
        }

        if (waitingField && selection) {
            let entityName = "";
            let entityType = waitingField.data('type');
            if (entityType == 'for') {
                entityName = MonksActiveTiles.forPlayersName(selection);
                let custom = $("option[custom='true']", waitingField);
                if (custom.length == 0) {
                    custom = $('<option>').attr({ value: JSON.stringify(selection), 'custom': 'true' }).prop("selected", true).data({ "value": selection }).html(entityName);
                    waitingField.prepend(custom);
                } else
                    custom.attr('value', JSON.stringify(selection)).data({ "value": selection }).prop("selected", true).html(entityName);
            } else if (["entity", "location", "either", "position"].includes(entityType)) {
                if (selection.x != undefined || selection.y != undefined)
                    entityName = await MonksActiveTiles.locationName(selection);
                else {
                    let elem = waitingField.closest(".action-field");
                    let ctrl = elem.data("ctrl");
                    entityName = await MonksActiveTiles.entityName(selection, ctrl.defaultType);
                }

                let displayField = waitingField.closest(".action-field").find('.display-value');
                displayField.html(entityName);
            }
            waitingField.data("value", selection);
            ActionConfig.onValueChange.call(this, { currentTarget: waitingField.get(0), originalEvent: event });
        }
    }

    static async selectPosition(event, target) {
        let btn = target;
        let field = $(`input[name="${btn.dataset.target}"]`, this.element);
        let displayField = field.closest(".action-field").find('.display-value');

        let x = parseInt(canvas.stage.pivot.x);
        let y = parseInt(canvas.stage.pivot.y);
        let scale = canvas.stage.scale.x;

        field.data("value", { x, y, scale });
        displayField.html(`x:${x}, y:${y}, scale:${scale}`);
        ActionConfig.onValueChange.call(this, { currentTarget: field.get(0), originalEvent: event });
    }

    static async addTag(event) {
        //let data = this._getSubmitData();
        let prop = event.target.dataset["target"]
        let entity = $(`input[name="${prop}"]`).data("value") || {};
        entity["tag-name"] = entity?.id?.substring(7);
        entity.match = entity.match || "all";
        entity.scene = entity.scene || "_active";

        let scenes = [{ id: "_active", name: "-- Active Scene --" }, {id: "_all", name: "-- All Scenes --" }];
        for (let s of game.scenes)
            scenes.push({ id: s.id, name: s.name });

        const html = await foundry.applications.handlebars.renderTemplate(`modules/monks-active-tiles/templates/tagger-dialog.html`, {
            data: entity,
            scenes: scenes
        });

        let adjustTags = function (tagName) {
            if (game.modules.get("tagger")?.active) {

                let tags = tagName.split(",");

                const rules = {
                    /**
                     * Replaces a portion of the tag with a number based on how many objects in this scene has the same numbered tag
                     * @private
                     */
                    "{#}": (tag, regx) => {
                        const findTag = new RegExp("^" + tag.replace(regx, "([1-9]+[0-9]*)") + "$");
                        const existingDocuments = Tagger.getByTag(findTag)
                        if (!existingDocuments.length) return tag.replace(regx, 1);

                        const numbers = existingDocuments.map(existingDocument => {
                            return Number(Tagger.getTags(existingDocument).find(tag => {
                                return tag.match(findTag);
                            }).match(findTag)[1]);
                        })

                        const length = Math.max(...numbers) + 1;
                        for (let i = 1; i <= length; i++) {
                            if (!numbers.includes(i)) {
                                return tag.replace(regx, i)
                            }
                        }
                    },

                    /**
                     *  Replaces the section of the tag with a random ID
                     *  @private
                     */
                    "{id}": (tag, regx, index) => {
                        let id = temporaryIds?.[tag]?.[index];
                        if (!id) {
                            if (!temporaryIds?.[tag]) {
                                temporaryIds[tag] = []
                            }
                            id = foundry.utils.randomID();
                            temporaryIds[tag].push(id);
                        }
                        return tag.replace(regx, id);
                    }
                }

                const tagRules = Object.entries(rules).filter(entry => {
                    entry[0] = new RegExp(`${entry[0]}`, "g");
                    return entry;
                });

                tags = Tagger._validateTags(tags, "TaggerHandler");

                tags = tags.map((tag, index) => {

                    const applicableTagRules = tagRules.filter(([regx]) => {
                        return tag.match(regx)
                    });
                    if (!applicableTagRules.length) return tag;

                    applicableTagRules.forEach(([regx, method]) => {
                        tag = method(tag, regx, index);
                    })

                    return tag;
                });

                return tags.join(",");
            }
        }

        // Render the confirmation dialog window
        let classes = [];
        let document = this.options.parent?.document || this.options.document;
        const theme = foundry.applications.apps.DocumentSheetConfig.getSheetThemeForDocument(document);
        if (theme) classes.push("themed", `theme-${theme}`);
        let btn = $(event.target);
        let originalEvent = event;
        return foundry.applications.api.DialogV2.prompt({
            window: {
                title: "Enter tag",
            },
            classes,
            content: html,
            ok: {
                label: i18n("MonksActiveTiles.Save"),
                callback: async (event, button) => {
                    let form = button.form;
                    let tagName = $('input[name="tag-name"]', form).val();
                    let match = $('select[name="match"]', form).val();
                    let scene = $('select[name="scene"]', form).val();

                    let field = $('input[name="' + btn.attr('data-target') + '"]', this.element);
                    let displayField = field.closest(".action-field").find('.display-value');
                    let entity = { id: `tagger:${tagName}`, match: match, scene: scene };
                    entity.name = await MonksActiveTiles.entityName(entity);
                    field.data("value", entity);
                    displayField.html(entity.name);
                    ActionConfig.onValueChange.call(this, { currentTarget: field.get(0), originalEvent });
                }
            },
            rejectClose: false,
            options: {
                width: 400
            },
            render: (html) => {
                $('.alter-tags', html).on("click", (event) => {
                    let tagName = $('input[name="tag-name"]', html).val();
                    tagName = adjustTags(tagName);
                    $('input[name="tag-name"]', html).val(tagName).data("value", tagName);
                })
            }
        });
    }

    static async editEntryId(event) {
        let elem = $(event.currentTarget).closest(".action-field");
        let ctrl = elem.data("ctrl");

        if (ctrl.subtype == "entity") {
            this.editEntityId(event);
        } else {
            this.editLocationId(event);
        }
    }

    async editEntityId(event) {
        let ctrl = $(event.target).closest(".action-field").data("ctrl");

        let sd = this._getSubmitData();
        let entity = foundry.utils.getProperty(sd, `data.${ctrl.id}`, {});

        const html = await foundry.applications.handlebars.renderTemplate(`modules/monks-active-tiles/templates/entity-dialog.html`, {
            data: entity
        });

        let classes = [];
        const theme = foundry.applications.apps.DocumentSheetConfig.getSheetThemeForDocument(this.options.parent.document);
        if (theme) classes.push("themed", `theme-${theme}`);

        // Render the confirmation dialog window
        return foundry.applications.api.DialogV2.prompt({
            window: {
                title: "Enter entity id",
            },
            classes,
            content: html,
            ok: {
                label: i18n("MonksActiveTiles.Save"),
                callback: async (evt, button) => {
                    const fd = new foundry.applications.ux.FormDataExtended(button.form).object;
                    let data = foundry.utils.expandObject(fd);

                    let entityId = data["entity-id"];
                    let entity = canvas.tokens.get(entityId);
                    if (entity)
                        entityId = entity.document.uuid;
                    let field = $(event.currentTarget).prev();

                    //let name = !entityId ? `<span class="placeholder-style">${i18n(field.data("placeholder") || "MonksActiveTiles.msg.select-entity")}</span>` : await MonksActiveTiles.entityName({ id: entityId });
                    let value = !entityId ? null : { id: entityId };

                    field.data("value", value);
                    ActionConfig.onValueChange.call(this, { currentTarget: field.get(0), originalEvent: event.originalEvent });
                }
            },
            rejectClose: false,
            options: {
                width: 400
            }
        });
    }

    async editLocationId(event) {
        let sceneList = { "": "" };
        for (let scene of game.scenes) {
            sceneList[scene.id] = scene.name;
        }

        let data = this._getSubmitData();
        let location = data?.data?.location || "{}";

        const html = await foundry.applications.handlebars.renderTemplate(`modules/monks-active-tiles/templates/location-dialog.html`, {
            action: data.action,
            data: location,
            sceneList: sceneList
        });

        let classes = [];
        const theme = foundry.applications.apps.DocumentSheetConfig.getSheetThemeForDocument(this.options.parent.document);
        if (theme) classes.push("themed", `theme-${theme}`);

        // Render the confirmation dialog window
        return foundry.applications.api.DialogV2.prompt({
            window: {
                title: "Edit location details"
            },
            classes,
            content: html,
            ok: {
                label: i18n("MonksActiveTiles.Save"),
                callback: async (evt, button) => {
                    const fd = new foundry.applications.ux.FormDataExtended(button.form).object;
                    let data = foundry.utils.expandObject(fd);

                    if (!isNaN(data.location.x)) {
                        data.location.x = parseInt(data.location.x);
                        data.location.id = "";
                    }
                    if (!isNaN(data.location.y)) {
                        data.location.y = parseInt(data.location.y);
                        data.location.id = "";
                    }

                    let location = data.location;
                    location.name = await MonksActiveTiles.locationName(location);
                    let field = $(event.currentTarget).prev();
                    field.data("value", location);
                    ActionConfig.onValueChange.call(this, { currentTarget: field.get(0), originalEvent: event.originalEvent ?? event });
                }
            },
            rejectClose: false,
            options: {
                width: 400
            }
        });
    }

    async checkConditional() {
        for (let elem of $('.action-field,hr', this.element)) {
            let ctrl = $(elem).data('ctrl');
            let showField = true;
            if (ctrl.conditional && typeof ctrl.conditional == "function") {
                showField = await ctrl.conditional.call(this, this);
                $(elem).toggleClass("hidden", !showField);
                if (!ctrl.conditionalHelp)
                    $(`.help-text[data-target-id="data.${ctrl.id}"]`, this.element).toggleClass("hidden", !showField);
            }
            if (ctrl.conditionalHelp && typeof ctrl.conditionalHelp == "function") {
                let showHelp = await ctrl.conditionalHelp.call(this, this);
                $(`.help-text[data-target-id="data.${ctrl.id}"]`, this.element).toggleClass("hidden", !(showField && showHelp));
            }
        }
        if (!!this.element.parentElement)
            this.setPosition({ height: 'auto' });
    }

    async changeAction(command) {
        let that = this;

        command = command || $('select[name="action"]', this.element).val();
        let action = MonksActiveTiles.triggerActions[command];

        let loadingid = this.loadingid = makeid();
        $('.action-controls', this.element).empty();

        let data = this.options.action.data || {};

        //$('.gmonly', this.element).toggle(action.requiresGM);

        for (let ctrl of (action?.ctrls || [])) {
            let options = foundry.utils.mergeObject({ hide: [], show: [] }, ctrl.options);
            //+++let field = $('<div>').addClass('form-fields').data('ctrl', ctrl);
            //if (ctrl["class"]) field.addClass(ctrl["class"]);
            let id = 'data.' + ctrl.id;
            let val = data[ctrl.id] != undefined ? (data[ctrl.id].value != undefined ? data[ctrl.id].value : data[ctrl.id]) : (data[ctrl.id] === null ? "" : ctrl.defvalue);

            let fieldData = {
                id,
                name: ctrl.name || ctrl.id,
                value: val,
                type: ctrl.type || "text",
                buttons: [],
                subtype: ctrl.subtype,
                required: ctrl.required || false,
                classes: ctrl["class"] || "",
                attr: ctrl.attr || "",
                min: ctrl.min || 0,
                max: ctrl.max || (ctrl.type == "slider" ? 1.0 : 100),
                step: ctrl.step || (ctrl.type == "slider" ? 0.1 : 1),
                placeholder: ctrl.placeholder || "",
                datavalue: {},
                help: ctrl.help || "",
            };

            switch (ctrl.type) {
                case 'filepicker':
                    fieldData.value = data[ctrl.id]
                    fieldData.placeholder = ctrl.placeholder || (ctrl.subtype == 'audio' ? 'path/audio.mp3' : (ctrl.subtype == 'image' || ctrl.subtype == 'imagevideo' ? 'path/image.png' : 'File Path'));
                    break;
                case 'filelist':
                    fieldData.datavalue = { value: data.files || [] };
                    fieldData.files = data.files || [];
                    break;
                case 'buttonlist':
                    fieldData.datavalue = { value: data.buttons || [] };
                    fieldData.items = data.buttons || [];
                    break;
                case 'list':
                    {
                        let list;
                        if (typeof ctrl.list == 'function') {
                            list = ctrl.list.call(this, this, action, data);
                            if (list instanceof Promise)
                                list = await list;
                        }
                        else
                            list = (action?.values && action?.values[ctrl.list]);

                        let selectedId = (data[ctrl.id]?.id || data[ctrl.id] || ctrl.defvalue);

                        if (list != undefined) {
                            fieldData.options = this.getListFieldData(list, selectedId);
                            if (ctrl.subtype == 'for') {
                                let types = ["trigger", "token", "owner", "previous", "everyone", "players", "gm"];
                                if (!types.includes(data[ctrl.id]) && data[ctrl.id] != undefined) {
                                    //if the current value is not in the list, it's a specific player, add it
                                    fieldData.datavalue.value = data[ctrl.id];
                                    fieldData.options.unshift({
                                        value: JSON.stringify(data[ctrl.id]),
                                        custom: "true",
                                        label: MonksActiveTiles.forPlayersName(data[ctrl.id] || ctrl.defvalue),
                                        selected: true
                                    });
                                }
                            }
                        }
                        if (ctrl.subtype == 'for') {
                            fieldData.datavalue.type = 'for';
                            fieldData.datavalue.restrict = ctrl.restrict;
                            if (!options.hide.includes('select')) {
                                fieldData.buttons.push(
                                    {
                                        type: ctrl.subtype,
                                        icon: "fas fa-crosshairs",
                                        tooltip: "MonksActiveTiles.msg.select-user",
                                        action: "selectEntity",
                                        classes: "location-picker",
                                    }
                                );
                            }
                            /*
                            select.data({ 'type': ctrl.subtype, value: data[ctrl.id] }).on("change", () => {
                                let opt = $('option:selected', select);
                                if (opt.data("value"))
                                    select.data("value", opt.data("value"));
                                else
                                    select.data("value", opt.val());
                            });
                            */
                        }
                    }
                    break;
                case 'select':
                    //so this is the fun one, when the button is pressed, I need to minimize the windows, and wait for a selection
                    fieldData.datavalue = { 'restrict': ctrl.restrict, 'type': ctrl.subtype, deftype: ctrl.defaultType, placeholder: ctrl.placeholder, value: data[ctrl.id] };
                    let default_placeholder = ctrl.subtype == 'entity' ? 'Please select an entity' : 'Please select a location';
                    fieldData.label = (ctrl.subtype == 'entity' ? await MonksActiveTiles.entityName(data[ctrl.id], ctrl.defaultType) : await MonksActiveTiles.locationName(data[ctrl.id])) || `<span class="placeholder-style">${i18n(ctrl.placeholder) || default_placeholder}</span>`;

                    if (!options.hide.includes('select')) {
                        fieldData.buttons.push({
                            type: ctrl.subtype,
                            icon: "fas fa-crosshairs",
                            tooltip: ctrl.subtype == 'entity' ? "MonksActiveTiles.msg.selectentity" : "MonksActiveTiles.msg.selectlocation",
                            action: "selectEntity",
                            classes: "location-picker",
                        });
                    }
                    if (ctrl.subtype == 'position') {
                        fieldData.buttons.push({
                            type: 'position',
                            icon: "fas fa-crop-alt",
                            tooltip: "MonksActiveTiles.msg.setposition",
                            action: "selectPosition",
                            classes: "location-picker",
                        });
                    }
                    if (options.show.includes('tile')) {
                        fieldData.buttons.push({
                            type: 'tile',
                            icon: "fas fa-cubes",
                            tooltip: "MonksActiveTiles.msg.usetile",
                            action: "selectEntity",
                            classes: "entity-picker",
                        });
                    }
                    if (options.show.includes('token')) {
                        fieldData.buttons.push({
                            type: 'token',
                            icon: "fas fa-user-alt",
                            tooltip: "MonksActiveTiles.msg.usetoken",
                            action: "selectEntity",
                            classes: "entity-picker",
                        });
                    }
                    if (options.show.includes('scene')) {
                        fieldData.buttons.push({
                            type: 'scene',
                            icon: "fas fa-map",
                            tooltip: "MonksActiveTiles.msg.usescene",
                            action: "selectEntity",
                            classes: "entity-picker",
                        });
                    }
                    if (options.show.includes('within')) {
                        fieldData.buttons.push({
                            type: 'within',
                            icon: "fas fa-street-view",
                            tooltip: "MonksActiveTiles.msg.usewithin",
                            action: "selectEntity",
                            classes: "entity-picker",
                        });
                    }
                    if (options.show.includes('players')) {
                        fieldData.buttons.push({
                            type: 'players',
                            icon: "fas fa-users",
                            tooltip: (command == "openjournal" ? i18n("MonksActiveTiles.msg.useplayersjournal") : i18n("MonksActiveTiles.msg.useplayers")),
                            action: "selectEntity",
                            classes: `${ctrl.subtype == 'entity' ? "entity" : "location"}-picker left-padded`,
                        });
                    }
                    if (options.show.includes('users')) {
                        fieldData.buttons.push({
                            type: 'users',
                            icon: "fas fa-user",
                            tooltip: i18n("MonksActiveTiles.msg.useusers"),
                            action: "selectEntity",
                            classes: `${ctrl.subtype == 'entity' ? "entity" : "location"}-picker left-padded`,
                        });
                    }
                    if (options.show.includes('previous')) {
                        fieldData.buttons.push({
                            type: 'previous',
                            icon: "fas fa-arrow-up-from-bracket",
                            tooltip: ctrl.subtype == 'entity' ? i18n("MonksActiveTiles.msg.useprevious") : i18n("MonksActiveTiles.msg.usepreviouslocation"),
                            action: "selectEntity",
                            classes: `${ctrl.subtype == 'entity' ? "entity" : "location"}-picker`,
                        });
                    }
                    if (options.show.includes('origin')) {
                        fieldData.buttons.push({
                            type: 'origin',
                            icon: "fas fa-walking",
                            tooltip: i18n("MonksActiveTiles.msg.useorigin"),
                            action: "selectEntity",
                            classes: "location-picker", 
                        });
                    }
                    if (options.show.includes('controlled')) {
                        fieldData.buttons.push({
                            type: 'controlled',
                            icon: "fas fa-bullhorn",
                            tooltip: ctrl.defaultType == "playlists" ? i18n("MonksActiveTiles.msg.currentlyplaying") : i18n("MonksActiveTiles.msg.usecontrolled"),
                            action: "selectEntity",
                            classes: "entity-picker", 
                        });
                    }
                    if (options.show.includes('tagger') && game.modules.get('tagger')?.active) {
                        fieldData.buttons.push({
                            type: 'tagger',
                            icon: "fas fa-tag",
                            tooltip: i18n("MonksActiveTiles.msg.usetagger"),
                            action: "addTag",
                            classes: `${ctrl.subtype == 'entity' ? "entity" : "location"}-picker`,
                        });
                    }
                    break;
            }

            /*
            // Can't successfully check the conditionals until all fields have been rendered
            let showField = ctrl.conditional == undefined || (typeof ctrl.conditional == 'function' ? await ctrl.conditional.call(this, this) : ctrl.conditional);
            fieldData.hidden = !showField;

            let showHelp = setting("show-help") && (ctrl.conditionalHelp == undefined || (typeof ctrl.conditionalHelp == 'function' ? await ctrl.conditionalHelp.call(this, this, action) : ctrl.conditionalHelp));
            fieldData.helpHidden = !(showHelp && showField);
            */

            await foundry.applications.handlebars.loadTemplates([
                "modules/monks-active-tiles/templates/list-partial.hbs",
                "modules/monks-active-tiles/templates/filelist-partial.hbs",
                "modules/monks-active-tiles/templates/buttonlist-partial.hbs"
            ]);
            let html = await foundry.applications.handlebars.renderTemplate("modules/monks-active-tiles/templates/action-field.hbs", fieldData);
            let field = $(html);

            $('.action-controls', this.element).append(field);

            if (ctrl.type == "filepicker" && ctrl.subtype == "html") {
                $("button", field).on("click", async (event) => {
                    // We need to adjust the file picker afterwards, since the file picker doesn't support html
                    window.setTimeout(() => {
                        let filepicker = $('file-picker', field).get(0).picker;
                        filepicker.extensions = Object.keys(CONST.HTML_FILE_EXTENSIONS).map(t => `.${t}`);
                        filepicker.browse();
                    }, 100);
                });
            }

            if (fieldData.datavalue) {
                $(`[name="${id}"]`, field).data(fieldData.datavalue);
            }
            field.data('ctrl', ctrl);

            $("[data-blur-action]", field).on('blur', ActionConfig.onValueChange.bind(this));
            $("[data-change-action],[data-change-action] > input[type='text']", field).on('change', ActionConfig.onValueChange.bind(this));
            $("[data-click-action]", field).on('click', ActionConfig.onValueChange.bind(this));

            $("[data-dblclick-action]", field).on('dblclick', ActionConfig.editEntryId.bind(this));

            $("input[type='checkbox']", field).on('change', ActionConfig.onValueChange.bind(this));

            if (ctrl.type != "line") {
                if (loadingid != this.loadingid)
                    break;

                if ((ctrl.id == "attribute" && ctrl.id == 'attribute') || (ctrl.id == "tag" && command == "anchor")) {
                    this.attributes = this.tokenAttr;

                    var substringMatcher = function () {
                        return function findMatches(q, cb) {
                            var matches, substrRegex;

                            q = q.replace(/[^a-zA-Z.]/gi, '');
                            if (q == "")
                                return;

                            // an array that will be populated with substring matches
                            matches = [];

                            // regex used to determine if a string contains the substring `q`
                            substrRegex = new RegExp(q, 'i');

                            // iterate through the pool of strings and for any string that
                            // contains the substring `q`, add it to the `matches` array
                            let values = ctrl.id == 'attribute' ? that.attributes : that.autoanchors;
                            $.each(values, function (i, str) {
                                if (substrRegex.test(str)) {
                                    matches.push(str);
                                }
                            });

                            cb(matches);
                        };
                    };

                    $('input[name="data.attribute"],input[name="data.tag"]', field).typeahead(
                        {
                            minLength: 1,
                            hint: true,
                            highlight: true
                        },
                        {
                            source: substringMatcher()
                        }
                    );
                }
            }
        }

        // Check the conditionals once all the fields have been added
        this.checkConditional();

        if (!!this.element.parentElement)
            this.setPosition({ top: null });
    }
}
