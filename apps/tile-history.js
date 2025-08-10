import { MonksActiveTiles, log, setting, i18n, makeid } from '../monks-active-tiles.js';
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api

export class TileHistory extends HandlebarsApplicationMixin(ApplicationV2) {
    constructor(object, options = {}) {
        super(object, options);
    }

    static DEFAULT_OPTIONS = {
        id: "tile-history",
        classes: ["action-sheet"],
        window: {
            contentClasses: ["standard-form"],
            icon: "fa-solid fa-running",
            resizable: false,
            title: "MonksActiveTiles.TileHistory",
        },
        actions: {
            resetHistory: TileHistory.resetHistory
        },
        position: {
            width: 700
        }
    };

    static PARTS = {
        body: { template: "./modules/monks-active-tiles/templates/tile-history.html" },
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
        let history = this.options.document.getHistory();

        return foundry.utils.mergeObject(context, { history });
    }

    prepareButtons() {
        return [
            {
                type: "button",
                icon: "fas fa-undo",
                label: "MonksActiveTiles.ResetHistory",
                action: "resetHistory"
            }
        ];
    }

    static resetHistory() {
        this.options.document.resetHistory();
        $('.history-list', this.element).empty();
        this.setPosition();
    }

    static deleteHistory(event, target) {
        let row = target.closest('.history');
        let id = row.dataset.historyId;
        this.options.document.removeHistory(id);
        row.remove();
        this.setPosition();
    }
}