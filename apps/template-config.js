import { MonksActiveTiles, log, error, setting, i18n, makeid } from '../monks-active-tiles.js';
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api

export class TemplateConfig extends HandlebarsApplicationMixin(ApplicationV2) {
    constructor(options = {}) {
        super(options);
    }

    static DEFAULT_OPTIONS = {
        id: "template-config",
        tag: "form",
        classes: ["action-sheet"],
        window: {
            contentClasses: ["standard-form"],
            icon: "fa-solid fa-cube",
            resizable: false,
            title: "Update Tile",
        },
        actions: {
            saveTemplate: TemplateConfig.saveTemplate
        },
        position: {
            width: 320
        }
    };

    static PARTS = {
        body: { template: "./modules/monks-active-tiles/templates/template-config.hbs", root: true },
        footer: { template: "templates/generic/form-footer.hbs" }
    };

    _initializeApplicationOptions(options) {
        options = super._initializeApplicationOptions(options);

        if (setting("tile-edit")) {
            options.position.width = 600;
            options.position.height = 400;
            options.window.resizable = true;
        }

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
        let tileData = foundry.utils.duplicate(this.options.document);
        delete tileData._id;
        delete tileData.id;
        delete tileData.x;
        delete tileData.y;

        let fields = {
            name: new foundry.data.fields.StringField({
                label: "Name",
            }, { name: "name" }),
            tiledata: new foundry.data.fields.StringField({
                label: "Tile Data",
            }, { name: "tiledata" }),
        }

        return foundry.utils.mergeObject(context, {
            fields,
            name: this.options.document.name,
            tiledata: JSON.stringify(tileData, null, 4),
            allowEditing: setting("tile-edit") });
    }

    prepareButtons() {
        return [
            {
                type: "button",
                icon: "fas fa-save",
                label: "MonksActiveTiles.Update",
                action: "saveTemplate"
            }
        ];
    }

    static saveTemplate(event, target) {
        const fd = new foundry.applications.ux.FormDataExtended(target.form).object;

        let data = {};

        if (setting("tile-edit")) {
            // check that the JSON is valid before submitting
            let tileData = fd.tiledata;
            if (tileData) {
                try {
                    $(".error-message", this.element).html("");
                    data = JSON.parse(tileData);
                } catch (e) {
                    $(".error-message", this.element).html(e);
                    error(e);
                    return;
                }
            }
        }

        data.id = this.options.document?.id;
        data.name = fd.name;

        MonksActiveTiles.tile_directory.updateTile(data);
        this.close();
    }
}
