import { MonksActiveTiles, i18n, log, debug, setting, patchFunc } from "../monks-active-tiles.js";
export class MATT_TileConfig extends foundry.applications.sheets.TileConfig {
    static DEFAULT_OPTIONS = {
        actions: {

        }
    }

    static PARTS = {
        tabs: { template: "templates/generic/tab-navigation.hbs" },
        position: { template: "templates/scene/tile/position.hbs" },
        appearance: { template: "templates/scene/tile/appearance.hbs" },
        overhead: { template: "templates/scene/tile/overhead.hbs" },
        activetile: { template: "modules/monks-active-tiles/templates/tile-config.html" },
        footer: { template: "templates/generic/form-footer.hbs" }
    };

    static TABS = {
        sheet: {
            tabs: [
                { id: "position", icon: "fa-solid fa-location-dot" },
                { id: "appearance", icon: "fa-solid fa-image" },
                { id: "overhead", icon: "fa-solid fa-house" }
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

    async _preparePartContext(partId, context, options) {
        context = await super._preparePartContext(partId, context, options);
        if (partId in context.tabs) context.tab = context.tabs[partId];
        return context;
    }
}