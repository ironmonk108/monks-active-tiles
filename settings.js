import { i18n, MonksActiveTiles } from "./monks-active-tiles.js"

export const registerSettings = function () {
	// Register any custom module settings here
	let modulename = "monks-active-tiles";

	game.settings.register(modulename, "show-imageless", {
		name: i18n("MonksActiveTiles.show-imageless.name"),
		hint: i18n("MonksActiveTiles.show-imageless.hint"),
		scope: "world",
		config: true,
		default: true,
		type: Boolean,
	});

	game.settings.register(modulename, "default-trigger", {
		name: i18n("MonksActiveTiles.default-trigger.name"),
		hint: i18n("MonksActiveTiles.default-trigger.hint"),
		scope: "world",
		config: true,
		default: "enter",
		choices: MonksActiveTiles.triggerModes,
		type: String,
	});

	game.settings.register(modulename, "default-restricted", {
		name: i18n("MonksActiveTiles.default-restricted.name"),
		hint: i18n("MonksActiveTiles.default-restricted.hint"),
		scope: "world",
		config: true,
		default: "all",
		choices: { 'all': i18n("MonksActiveTiles.restrict.all"), 'player': i18n("MonksActiveTiles.restrict.player"), 'gm': i18n("MonksActiveTiles.restrict.gm") },
		type: String,
	});

	game.settings.register(modulename, "default-controlled", {
		name: i18n("MonksActiveTiles.default-controlled.name"),
		hint: i18n("MonksActiveTiles.default-controlled.hint"),
		scope: "world",
		config: true,
		default: "all",
		choices: { 'all': i18n("MonksActiveTiles.control.all"), 'player': i18n("MonksActiveTiles.control.player"), 'gm': i18n("MonksActiveTiles.control.gm") },
		type: String,
	});

	game.settings.register(modulename, "use-core-macro", {
		name: i18n("MonksActiveTiles.use-core-macro.name"),
		hint: i18n("MonksActiveTiles.use-core-macro.hint"),
		scope: "world",
		config: true,
		default: false,
		type: Boolean,
	});

	game.settings.register(modulename, "allow-player", {
		name: i18n("MonksActiveTiles.allow-player.name"),
		hint: i18n("MonksActiveTiles.allow-player.hint"),
		scope: "world",
		config: true,
		default: true,
		type: Boolean,
	});

	game.settings.register(modulename, "drop-item", {
		name: i18n("MonksActiveTiles.drop-item.name"),
		hint: i18n("MonksActiveTiles.drop-item.hint"),
		scope: "world",
		config: true,
		default: true,
		type: Boolean,
	});

	game.settings.register(modulename, "drop-item-size", {
		name: i18n("MonksActiveTiles.drop-item-size.name"),
		hint: i18n("MonksActiveTiles.drop-item-size.hint"),
		scope: "world",
		config: true,
		range: {
			min: 0.1,
			max: 1.5,
			step: 0.05,
		},
		default: 1,
		type: Number,
	});

	game.settings.register(modulename, "drop-scene", {
		name: i18n("MonksActiveTiles.drop-scene.name"),
		hint: i18n("MonksActiveTiles.drop-scene.hint"),
		scope: "world",
		config: true,
		default: true,
		type: Boolean,
	});

	game.settings.register(modulename, "drop-macro", {
		name: i18n("MonksActiveTiles.drop-macro.name"),
		hint: i18n("MonksActiveTiles.drop-macro.hint"),
		scope: "world",
		config: true,
		default: true,
		type: Boolean,
	});

	game.settings.register(modulename, "allow-door", {
		name: i18n("MonksActiveTiles.allow-door.name"),
		hint: i18n("MonksActiveTiles.allow-door.hint"),
		scope: "world",
		config: true,
		default: true,
		type: Boolean,
	});

	game.settings.register(modulename, "teleport-wash", {
		name: i18n("MonksActiveTiles.teleport-wash.name"),
		hint: i18n("MonksActiveTiles.teleport-wash.hint"),
		scope: "world",
		config: true,
		default: true,
		type: Boolean,
	});

	game.settings.register(modulename, "teleport-colour", {
		name: i18n("MonksActiveTiles.teleport-colour.name"),
		hint: i18n("MonksActiveTiles.teleport-colour.hint"),
		scope: "world",
		config: true,
		default: "#C0C0C0",
		type: String,
	});

	game.settings.register(modulename, "show-help", {
		name: i18n("MonksActiveTiles.show-help.name"),
		hint: i18n("MonksActiveTiles.show-help.hint"),
		scope: "world",
		config: true,
		default: true,
		type: Boolean,
	});

	game.settings.register(modulename, "prevent-when-paused", {
		name: i18n("MonksActiveTiles.prevent-when-paused.name"),
		hint: i18n("MonksActiveTiles.prevent-when-paused.hint"),
		scope: "world",
		config: true,
		default: true,
		type: Boolean,
	});

	game.settings.register(modulename, "allow-door-passthrough", {
		name: i18n("MonksActiveTiles.allow-door-passthrough.name"),
		hint: i18n("MonksActiveTiles.allow-door-passthrough.hint"),
		scope: "world",
		config: true,
		default: true,
		type: Boolean,
	});

	game.settings.register(modulename, "show-landing", {
		name: i18n("MonksActiveTiles.show-landing.name"),
		hint: i18n("MonksActiveTiles.show-landing.hint"),
		scope: "world",
		config: true,
		default: true,
		type: Boolean,
	});

	game.settings.register(modulename, "tile-edit", {
		name: i18n("MonksActiveTiles.tile-edit.name"),
		hint: i18n("MonksActiveTiles.tile-edit.hint"),
		scope: "world",
		config: true,
		default: false,
		type: Boolean,
	});

	game.settings.register(modulename, "prevent-cycle", {
		scope: "world",
		config: false,
		default: false,
		type: Boolean
	});

	game.settings.register(modulename, "fix-action-names", {
		scope: "world",
		config: false,
		default: false,
		type: Boolean
	});

	game.settings.register(modulename, "fix-imagecycle", {
		scope: "world",
		config: false,
		default: false,
		type: Boolean
	});

	game.settings.register(modulename, "fix-variablename", {
		scope: "world",
		config: false,
		default: false,
		type: Boolean
	});

	game.settings.register(modulename, "fix-forplayer", {
		scope: "world",
		config: false,
		default: false,
		type: Boolean
	});

	game.settings.register(modulename, "fix-forplayer-again", {
		scope: "world",
		config: false,
		default: false,
		type: Boolean
	});

	game.settings.register(modulename, "fix-rolltable", {
		scope: "world",
		config: false,
		default: false,
		type: Boolean
	});

	game.settings.register(modulename, "fix-scene", {
        scope: "world",
        config: false,
        default: false,
        type: Boolean
	});
	game.settings.register(modulename, "fix-scene-again", {
		scope: "world",
		config: false,
		default: false,
		type: Boolean
	});
	game.settings.register(modulename, "fix-tile-name", {
		scope: "world",
		config: false,
		default: false,
		type: Boolean
	});
	game.settings.register(modulename, "fix-token-distance", {
		scope: "world",
		config: false,
		default: false,
		type: Boolean
	});

	game.settings.register(modulename, "tile-templates", {
		scope: "world",
		config: false,
		default: [],
		type: Object
	});

	game.settings.register(modulename, "tile-template-folders", {
		scope: "world",
		config: false,
		default: [],
		type: Object
	});
}