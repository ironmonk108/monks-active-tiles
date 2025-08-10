import { MonksActiveTiles, log, setting, i18n, makeid } from '../monks-active-tiles.js';
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api

export class TileVariables extends HandlebarsApplicationMixin(ApplicationV2) {
    constructor(object, options = {}) {
        super(object, options);
    }

    static DEFAULT_OPTIONS = {
        id: "trigger-variables",
        classes: ["action-sheet"],
        window: {
            contentClasses: ["standard-form"],
            icon: "fa-solid fa-running",
            resizable: false,
            title: "MonksActiveTiles.TileVariables",
        },
        actions: {
            clearVariables: TileVariables.clearVariables,
            deleteVariable: TileVariables.deleteVariable
        },
        position: {
            width: 700
        }
    };

    static PARTS = {
        body: { template: "./modules/monks-active-tiles/templates/tile-variables.html" },
        footer: { template: "templates/generic/form-footer.hbs" }
    };

    _initializeApplicationOptions(options) {
        options = super._initializeApplicationOptions(options);
        const theme = foundry.applications.apps.DocumentSheetConfig.getSheetThemeForDocument(options.document);
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
        let variables = foundry.utils.getProperty(this.options.document, "flags.monks-active-tiles.variables") || {};

        return foundry.utils.mergeObject(context, { variables });
    }

    prepareButtons() {
        return [
            {
                type: "button",
                icon: "fas fa-undo",
                label: "MonksActiveTiles.ClearVariables",
                action: "clearVariables"
            }
        ];
    }

    static clearVariables(event) {
        this.options.document.unsetFlag("monks-active-tiles", "variables");
        $('.variable-list', this.element).empty();
        this.setPosition();
    }

    static async deleteVariable(event, target) {
        let row = target.closest('.variable');
        let id = row.dataset.variableId;
        await this.options.document.update({ [`flags.monks-active-tiles.variables.-=${id}`]: null })
        delete this.options.document.flags["monks-active-tiles"].variables[id];
        row.remove();
        this.setPosition();
    }
}