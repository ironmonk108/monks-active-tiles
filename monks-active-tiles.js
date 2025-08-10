import { registerSettings } from "./settings.js";
import { WithActiveTileConfig } from "./apps/active-tile-config.js"
import { ActionConfig } from "./apps/action-config.js";
import { TileTemplates } from "./apps/tile-templates.js";
import { BatchManager } from "./classes/BatchManager.js";
import { ActionManager } from "./actions.js";

export let debug = (...args) => {
    if (MonksActiveTiles.debugEnabled > 1) console.log("DEBUG: monks-active-tiles | ", ...args);
};
export let log = (...args) => console.log("monks-active-tiles | ", ...args);
export let warn = (...args) => {
    if (MonksActiveTiles.debugEnabled > 0) console.warn("monks-active-tiles | ", ...args);
};
export let error = (...args) =>
    console.error("monks-active-tiles | ", ...args);
export let i18n = (key, args) => {
    if (args) {
        return game.i18n.format(key, args);
    }
    return game.i18n.localize(key);
};
export let actiontext = (key, props) => {
    let text = game.i18n.format(key, props)
        .replace('<action>', '<span class="action-style">')
        .replace('</action>', '</span>')
        .replace('<detail>', '<span class="details-style">')
        .replace('</detail>', '</span>');
    return text;
};
export let setting = key => {
    return game.settings.get("monks-active-tiles", key);
};

export let makeid = () => {
    var result = '';
    var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var charactersLength = characters.length;
    for (var i = 0; i < 16; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}

export let oldSheetClass = () => {
    return MonksActiveTiles._oldSheetClass;
};

export let oldObjectClass = () => {
    return MonksActiveTiles._oldObjectClass;
};

export let rectContains = (rect, x, y) => {
    return x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height;
};

export let patchFunc = (prop, func, type = "WRAPPER") => {
    let nonLibWrapper = () => {
        const oldFunc = eval(prop);
        eval(`${prop} = function (event) {
            return func.call(this, ${type != "OVERRIDE" ? "oldFunc.bind(this)," : ""} ...arguments);
        }`);
    }
    if (game.modules.get("lib-wrapper")?.active) {
        try {
            libWrapper.register("monks-active-tiles", prop, func, type);
        } catch (e) {
            nonLibWrapper();
        }
    } else {
        nonLibWrapper();
    }
}

export let rollDice = async (val, options = {}) => {
    if (val && typeof val === "string" && val.indexOf("d") != -1) {
        let roll = options.roll || new Roll(val);
        await roll.evaluate({ async: true });
        return { value: roll.total, roll: roll };
    } else
        return { value: val };
}

export let getVolume = () => {
    if (game.modules.get("monks-sound-enhancement")?.active)
        return game.settings.get("core", "globalSoundEffectVolume");
    else
        return game.settings.get("core", "globalAmbientVolume");
}

export let getValue = async (val = "", args, entity, options = {operation:'assign'}) => {
    return MonksActiveTiles.getValue(val, args, entity, options);
}

export let asyncFilter = async (entities = [], fn = () => { }) => {
    let result = [];
    for (let e of entities) {
        let can = await fn(e);
        if (can) result.push(e);
    }
    return result;
}

export class MonksActiveTiles {
    static _oldSheetClass;
    //static _oldObjectClass;
    //static _rejectRemaining = {};
    static savestate = {};
    static debugEnabled = 1;

    static _dialogs = {};

    static _slotmachine = {};

    static batch = new BatchManager();

    static tileTriggerCache = { ready: [], hover: [], time: [], darkness: [], lighting: [], click: [], combat: [] };

    static timeout(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    static getWorldTime(worldTime = game.time.worldTime) {
        let currentWorldTime = worldTime + MonksActiveTiles.TimeOffset;
        let dayTime = Math.abs(Math.trunc((currentWorldTime % 86400) / 60));
        if (currentWorldTime < 0) dayTime = 1440 - dayTime;

        return dayTime;
    }

    static emit(action, args = {}) {
        if (args.action != undefined)
            error("MonksActiveTiles.emit: 'action' is a reserved key and cannot be used as a key in the args object.");
        args.action = action;
        args.senderId = game.user.id
        game.socket.emit( MonksActiveTiles.SOCKET, args, (resp) => { } );
    }

    static get triggerModes() {
        return {
            'enter': i18n("MonksActiveTiles.mode.enter"),
            'exit': i18n("MonksActiveTiles.mode.exit"),
            //'both': i18n("MonksActiveTiles.mode.both"),
            'movement': i18n("MonksActiveTiles.mode.movement"),
            'stop': i18n("MonksActiveTiles.mode.stop"),
            'elevation': i18n("MonksActiveTiles.mode.elevation"),
            'rotation': i18n("MonksActiveTiles.mode.rotation"),
            'click': i18n("MonksActiveTiles.mode.click"),
            'rightclick': i18n("MonksActiveTiles.mode.rightclick"),
            'dblclick': i18n("MonksActiveTiles.mode.dblclick"),
            'dblrightclick': i18n("MonksActiveTiles.mode.dblrightclick"),
            'create': i18n("MonksActiveTiles.mode.create"),
            //'hover': i18n("MonksActiveTiles.mode.hover"),
            'hoverin': i18n("MonksActiveTiles.mode.hoverin"),
            'hoverout': i18n("MonksActiveTiles.mode.hoverout"),
            'combatstart': i18n("MonksActiveTiles.mode.combatstart"),
            'round': i18n("MonksActiveTiles.mode.round"),
            'turn': i18n("MonksActiveTiles.mode.turn"),
            'turnend': i18n("MonksActiveTiles.mode.turnend"),
            'combatend': i18n("MonksActiveTiles.mode.combatend"),
            'ready': i18n("MonksActiveTiles.mode.canvasready"),
            'manual': i18n("MonksActiveTiles.mode.manual"),
            'door': i18n("MonksActiveTiles.mode.door"),
            'darkness': i18n("MonksActiveTiles.mode.darkness"),
            'lighting': i18n("MonksActiveTiles.mode.darknesschange"),
            'time': i18n("MonksActiveTiles.mode.time")
        }
    };

    static triggerGroups = {
        'actions': { name: 'MonksActiveTiles.group.actions', 'default': true },
        'filters': { name: 'MonksActiveTiles.group.filters' },
        'logic': { name: 'MonksActiveTiles.group.logic' }
    }

    static triggerActions = ActionManager.actions;

    static triggerTile = async (uuid) => {
        let tile = await fromUuid(uuid);
        if (tile) {
            let tokens = canvas.tokens.controlled.map(t => t.document);
            //check to see if this trigger is per token, and already triggered
            let triggerData = tile.flags["monks-active-tiles"];

            if (triggerData) {
                if (triggerData.pertoken)
                    tokens = tokens.filter(t => !tile.hasTriggered(t.id));

                if (!triggerData.active) return;

                tile.trigger({ tokens: tokens, method: "trigger" });
            }
        }
    }

    static findTileTriggers = async () => {
        MonksActiveTiles.tileTriggerCache = { ready: [], hover: [], time: [], darkness: [], lighting: [], click: [], combat: [] };
        for (let tile of canvas.scene.tiles.contents) {
            let triggerData = tile.flags["monks-active-tiles"];
            if (triggerData && triggerData.active) {
                let triggers = MonksActiveTiles.getTrigger(triggerData?.trigger);
                if (triggers.includes("ready"))
                    MonksActiveTiles.tileTriggerCache["ready"].push(tile);
                if (triggers.includes("hoverin") || triggers.includes("hoverout") || triggerData.pointer)
                    MonksActiveTiles.tileTriggerCache["hover"].push(tile);
                if (triggers.includes("time"))
                    MonksActiveTiles.tileTriggerCache["time"].push(tile);
                if (triggers.includes("darkness"))
                    MonksActiveTiles.tileTriggerCache["darkness"].push(tile);
                if (triggers.includes("lighting"))
                    MonksActiveTiles.tileTriggerCache["lighting"].push(tile);
                if (triggers.includes("click") || triggers.includes("dblclick") || triggers.includes("rightclick") || triggers.includes("dblrightclick"))
                    MonksActiveTiles.tileTriggerCache["click"].push(tile);
                if (triggers.includes("combatstart") || triggers.includes("round") || triggers.includes("turn") || triggers.includes("turnend") || triggers.includes("combatend"))
                    MonksActiveTiles.tileTriggerCache["combat"].push(tile);
            }
        }
    }

    /*
    static drawingPoints(drawing) {
        let points = [];
        let repeat = true;

        let size = drawing.strokeWidth / 2;

        switch (drawing.shape.type) {
            case 'r': //rect
                points = [
                    { x: drawing.x + size, y: drawing.y + size },
                    { x: drawing.x + drawing.shape.width - size, y: drawing.y + size },
                    { x: drawing.x + drawing.shape.width - size, y: drawing.y + drawing.shape.height - size },
                    { x: drawing.x + size, y: drawing.y + drawing.shape.height - size },
                    { x: drawing.x + size, y: drawing.y + size }
                ];
                break;
            case 'e': //circle
                let circlePts = [];
                let a = drawing.shape.width / 2;
                let b = drawing.shape.height / 2;
                let pos = { x: drawing.x + a, y: drawing.y + b };
                for (let i = 0; i <= Math.PI / 2; i = i + 0.2) {
                    let x = ((a * b) / Math.sqrt((b ** 2) + ((a ** 2) * (Math.tan(i) ** 2))));
                    let y = ((a * b) / Math.sqrt((a ** 2) + ((b ** 2) / (Math.tan(i) ** 2))));
                    circlePts.push({ x: x, y: y });
                }
                circlePts = circlePts.concat(foundry.utils.duplicate(circlePts).reverse().map(p => { return { x: -p.x, y: p.y }; }));
                circlePts = circlePts.concat(foundry.utils.duplicate(circlePts).reverse().map(p => { return { x: p.x, y: -p.y }; }));
                points = MonksActiveTiles.simplify(circlePts.map(p => { return { x: p.x + pos.x, y: p.y + pos.y } }), 40);
                break;
            case 'p': //polygon and freehand
                repeat = (drawing.shape.points[0] == drawing.shape.points[drawing.shape.points.length - 2] && drawing.shape.points[1] == drawing.shape.points[drawing.shape.points.length - 1]);
                for (let i = 0; i < drawing.shape.points.length; i += 2) {
                    points.push({ x: drawing.x + drawing.shape.points[i], y: drawing.y + drawing.shape.points[i+1] });
                }
                points = MonksActiveTiles.simplify(points, 40);
                break;
        }

        return { points, repeat };
    }

    static simplify(points, tolerance = 20) {
        if (points.length <= 2) return points;

        let getSqSegDist = function (p, p1, p2) {

            var x = p1.x,
                y = p1.y,
                dx = p2.x - x,
                dy = p2.y - y;

            if (dx !== 0 || dy !== 0) {

                var t = ((p.x - x) * dx + (p.y - y) * dy) / (dx * dx + dy * dy);

                if (t > 1) {
                    x = p2.x;
                    y = p2.y;

                } else if (t > 0) {
                    x += dx * t;
                    y += dy * t;
                }
            }

            dx = p.x - x;
            dy = p.y - y;

            return dx * dx + dy * dy;
        }

        let simplifyDPStep = function (points, first, last, sqTolerance, simplified) {
            var maxSqDist = sqTolerance,
                index;

            for (var i = first + 1; i < last; i++) {
                var sqDist = getSqSegDist(points[i], points[first], points[last]);

                if (sqDist > maxSqDist) {
                    index = i;
                    maxSqDist = sqDist;
                }
            }

            if (maxSqDist > sqTolerance) {
                if (index - first > 1) simplifyDPStep(points, first, index, sqTolerance, simplified);
                simplified.push(points[index]);
                if (last - index > 1) simplifyDPStep(points, index, last, sqTolerance, simplified);
            }
        }

        var last = points.length - 1;

        var simplified = [points[0]];
        simplifyDPStep(points, 0, last, tolerance, simplified);
        simplified.push(points[last]);

        return simplified;
    }*/

    static async getValue(val = "", args, entity, options = { operation: 'assign' }) {
        const { tile, tokens, action, userId, value, method, change, darkness, time, pt, src } = args;

        let originalVal = val;

        if (typeof val == 'string' && val.endsWith('true')) {
            if (val.startsWith("="))
                val = true;
            else if (val.startsWith("+ ") || val.startsWith("- "))
                val = !options.prop;
            else
                val = (options.prop == undefined ? true : options.operation == "assign" ? options.prop === true : options.prop);
        } else if (typeof val == 'string' && val.endsWith('false')) {
            if (val.startsWith("="))
                val = false;
            else if (val.startsWith("+ ") || val.startsWith("- "))
                val = !options.prop;
            else
                val = (options.prop == undefined ? false : options.operation == "assign" ? options.prop === false : options.prop);
        } else {
            let context = Object.assign({
                actor: tokens[0]?.actor,
                token: tokens[0],
                tile: tile?.toObject(),
                entity: entity,
                variable: foundry.utils.getProperty(tile, "flags.monks-active-tiles.variables") || {},
                user: game.users.get(userId),
                players: game.users,
                value: value,
                scene: tile.parent,
                canvas,
                method,
                change,
                darkness,
                time,
                pt,
                origin: src
            }, options);

            if (typeof val == "string" && val.includes("{{")) {
                const compiled = Handlebars.compile(val);
                val = compiled(context, { allowProtoMethodsByDefault: true, allowProtoPropertiesByDefault: true }).trim();
            }

            if (options.inline !== false && typeof val == "string") {
                //[[/publicroll 1d4]]{test2}
                const rgx = /\[\[(\/[a-zA-Z]+\s)?(.*?)(]{2,3})(?:{([^}]+)})?/gi;
                val = await MonksActiveTiles.inlineRoll(val, rgx, action.data.chatMessage, action.data.rollmode, entity);
            }

            if (options.rollmode && val.indexOf("d") != -1) {
                let roll = await rollDice(val);
                val = roll.value;

                if (action.data.chatMessage) {
                    context.result = val;
                    const compiled = Handlebars.compile(options.flavor || "");
                    let flavor = compiled(context, { allowProtoMethodsByDefault: true, allowProtoPropertiesByDefault: true }).trim();
                    roll.roll.toMessage({ flavor }, { rollMode: options.rollmode });
                }
            }

            if (options.hasOwnProperty("prop") && typeof val == "string") {
                try {
                    if (val.startsWith('+ ') || val.startsWith('- ')) {
                        if (options.prop instanceof Array) {
                            let add = val.startsWith('+ ');
                            let parts = val.replace('+ ', '').replace('- ', '').split(',').map(p => p.trim());
                            if (add)
                                val = options.prop.concat(parts).filter((value, index, self) => { return self.indexOf(value) === index; });
                            else
                                val = options.prop.filter(value => { return !parts.includes(value) });
                        } else {
                            val = eval(options.prop + val);
                        }
                    }
                    else if (options.operation == 'assign' || options.operation == undefined) {
                        val = (val.startsWith("=") ? val.substring(1) : val);
                        if (options.prop instanceof Array) {
                            val = val.split(',').map(p => p.trim()).filter(p => !!p);
                        } else {
                            val = eval(val);
                        }
                    } else if (options.operation == 'compare') {
                        if (options.prop instanceof Array || options.prop instanceof Set) {
                            val = (val.startsWith("==") ? val.substring(2) : (val.startsWith("=") ? val.substring(1) : val));
                            val = eval(`[${Array.from(options.prop).map(v => typeof v == 'string' ? '"' + v + '"' : v).join(',')}].includes(${val})`);
                        } else {
                            val = (val.startsWith("=") && !val.startsWith("==") ? "=" + val : (val.startsWith("==") || val.startsWith(">") || val.startsWith("<") || val.startsWith("!=") || val.indexOf("==") >= 0 ? val : "== " + val));
                            val = eval((typeof options.prop == 'string' ? `"${options.prop}"` : options.prop) + ' ' + val);
                        }
                    }
                } catch (err) {
                    val = (options.prop instanceof Array ? [] : val);
                    debug(err);
                }
            }

            if (val instanceof Array) {
                for (let i = 0; i < val.length; i++) {
                    if (!isNaN(val[i]) && !isNaN(parseFloat(val[i])))
                        val[i] = parseFloat(val[i]);
                }
            } else {
                if (!isNaN(val) && !isNaN(parseFloat(val)) && (val != originalVal || options.type == "number"))
                    val = parseFloat(val);
            }
        }

        return val;
    }

    static getActionFlag(val, flag) {
        if (!val)
            return "";
        switch (flag) {
            case "snap":
                return ` <i class="fas fa-compress" title="${i18n("MonksActiveTiles.SnapToGrid")}"></i>`;
        }
        return "";
    }

    static getTrigger(val) {
        if (!val) return [];

        let triggers = val instanceof Array ? val : [val];

        if (triggers.includes("both")) {
            triggers.push("enter", "exit");
            triggers.findSplice(t => t == "both");
        }
        if (triggers.includes("hover")) {
            triggers.push("hoverin", "hoverout");
            triggers.findSplice(t => t == "hover");
        }

        return triggers;
    }

    static getForPlayers(forId, args, options = {}) {
        switch (forId) {
            case "all":
            case "everyone":
                return game.users.filter(u => u.active).map(u => u.id);
            case "gm":
                return game.users.filter(u => u.isGM).map(u => u.id);
            case "players":
                return game.users.filter(u => !u.isGM && (options.notactive || u.active)).map(u => u.id);
            case "previous":
            case "current":
                return args.value.users || [];
            case "triggering":
            case "trigger":
                return args.userId ? [args.userId] : [];
            case "token":
            case "owner": {
                let owners = [];
                let tokens = forId == "token" ? args.tokens : args.value.tokens;
                for (let token of tokens) {
                    for (let user of game.users.filter(u => !u.isGM && u.active).map(u => u.id)) {
                        if (token.actor.ownership[user] == CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER || token.actor.ownership.default == CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER) {
                            if (!owners.includes(user))
                                owners.push(user);
                        }
                    }
                }
                return owners;
            }
        }
        let players = forId instanceof Array ? forId : (typeof forId == "string" ? forId.split(",") : [forId]);
        return players.map(p => p.id || p);
    }

    static forPlayersName(entity) {
        switch (entity) {
            case "all":
            case "everyone":
                return i18n("MonksActiveTiles.for.all");
            case "gm":
                return i18n("MonksActiveTiles.for.gm");
            case "players":
                return i18n("MonksActiveTiles.for.players");
            case "previous":
            case "current":
                return i18n("MonksActiveTiles.for.current");
            case "triggering":
            case "trigger":
                return i18n("MonksActiveTiles.for.triggering");
            case "token":
                return i18n("MonksActiveTiles.for.token");
            case "owner":
                return i18n("MonksActiveTiles.for.owner");
            default:
                let users = entity instanceof Array ? entity : (typeof entity == "string" ? entity.split(",") : [entity]);
                if (users.length > 1)
                    return i18n("MonksActiveTiles.MultiplePlayers", { players: users.length });
                else if (users.length == 1)
                    return game.users.get(users[0].id)?.name || game.users.get(users[0])?.name || i18n("MonksActiveTiles.UnknownPlayer");
                else
                    return i18n("MonksActiveTiles.UnknownPlayer");

        }
    }

    static async getEntities(args, defaultType, _entry) {
        const { tile, tokens, action, value, userId, method } = args;

        let entities = [];
        let entry = _entry || action.data?.entity;

        let id = (typeof entry == "string" ? entry : entry?.id) || ActionManager.getDefaultValue(action.action, "entity", 'current');

        if (id != undefined && !id.startsWith("tagger"))
            id = id.split("#")[0];

        if (id == 'tile')
            entities.push(tile);
        else if (id == 'token') {
            if (defaultType == "scenes") {
                let scene = tokens[0]?.parent;
                if (!scene)
                    scene = game.scenes.get(game.users.get(userId)?.viewedScene);
                entities.push(scene);
            } else {
                let tokenEntities = tokens;
                for (let i = 0; i < tokenEntities.length; i++) {
                    if (typeof tokenEntities[i] == 'string')
                        tokenEntities[i] = await fromUuid(tokenEntities[i]);
                }
                entities = entities.concat(tokenEntities);
            }
        }
        else if (id == 'scene') {
            entities.push(game.scenes.active);
        }
        else if (id && id.startsWith('players')) {
            let newEntities = [];
            if (action.action == "create") {
                newEntities = game.users.map(u => !u.isGM && (u.active || !id.endsWith('active')) && u.character).filter(t => !!t);
            } else {
                newEntities = tile.parent.tokens.filter(t => {
                    return t.actor != undefined && t.actor?.hasPlayerOwner && !['npc', 'familiar', 'hazard', 'loot'].includes(t.actor?.type);
                });
            }
            entities = entities.concat(newEntities);
        }
        else if (id && id.startsWith('users')) {
            let newEntities = game.users.map(u => (u.active || !id.endsWith('active')) ? u : null).filter(t => !!t);
            entities = entities.concat(newEntities);
        }
        else if (id == 'within') {
            let newEntities = [];
            if (action.action == "activate") {
                newEntities = tile.entitiesWithin({ collection: defaultType });
            } else
                //find all tokens with this Tile
                newEntities = tile.entitiesWithin({useTriggerPt: method != "trigger"});
            entities = entities.concat(newEntities);
        }
        else if (id == 'controlled') {
            if (defaultType == "playlists") {
                game.playlists.forEach(async (p) => {
                    p.sounds.forEach(async (s) => {
                        if (s.playing || s.pausedTime != null)
                            entities.push(s);
                    });
                });
            } else {
                let newEntities = canvas.tokens.controlled.map(t => t.document);
                entities = entities.concat(newEntities);
            }
        }
        else if (id == undefined || id == '' || id == 'previous' || id == 'current') {
            let deftype = (defaultType || 'tokens');
            let newEntities = (deftype == 'tiles' && id != 'previous' && id != 'current' ? [tile] : value[deftype]);
            newEntities = (newEntities instanceof Array ? newEntities : (newEntities ? [newEntities] : []));

            let collection = canvas[deftype == "tiles" ? "background" : deftype];
            if (collection) {
                for (let i = 0; i < newEntities.length; i++) {
                    let entity = newEntities[i];
                    if (typeof entity == "string") {
                        let newEnt = collection.get(entity);
                        if (newEnt?.document)
                            newEntities[i] = newEnt.document;
                    }
                }
            }

            entities = entities.concat(newEntities);
        }
        else if (id.startsWith('tagger')) {
            if (game.modules.get('tagger')?.active) {
                let entity = entry || action.data?.entity;
                let tag = id.substring(7);

                tag = await getValue(tag, args);

                let options = {};
                if (!entity.match || entity.match == "any")
                    options.matchAny = true;
                if (entity.match == "exact")
                    options.matchExactly = true;

                if (entity.scene == "_all")
                    options.allScenes = true;
                else if (entity.scene !== "_active" && entity.scene && game.scenes.get(entity.scene) != undefined)
                    options.sceneId = entity.scene;
                else if (entity.scene === "_active") {
                    let playerScene = game.users.get(userId)?.viewedScene;
                    if (playerScene != game.canvas?.scene?.id)
                        options.sceneId = playerScene;
                }

                let newEntities = Tagger.getByTag(tag, options);

                if (entity.scene == "_all")
                    newEntities = [].concat(...Object.values(newEntities));

                entities = entities.concat(newEntities);
            }
        }
        else if (id) {
            let newEntities = id.split(",");
            for (let i = 0; i < newEntities.length; i++) {
                let document = (newEntities[i].includes('Terrain') ? MonksActiveTiles.getTerrain(newEntities[i]) : await fromUuid(newEntities[i]));
                if (!document && defaultType) {
                    let collection = game[defaultType];
                    if (collection)
                        document = collection.get(id);
                }
                newEntities[i] = document;
            }
            newEntities = newEntities.filter(e => !!e);

            entities = entities.concat(newEntities);
        }

        return entities;
    }

    static async entityName(entity, defaultType = "tokens") {
        let name = "";

        if (!entity)
            return "";

        let id = (typeof entity == "string" ? entity : entity?.id) || 'previous';

        if (id == "unknown")
            name = i18n("MonksActiveTiles.UnknownEntity")
        if (id == 'tile')
            name = i18n("MonksActiveTiles.ThisTile");
        else if (id == 'token')
            name = defaultType == "scenes" ? i18n("MonksActiveTiles.TriggeringTokenScene") : i18n("MonksActiveTiles.TriggeringToken");
        else if (id == 'scene')
            name = i18n("MonksActiveTiles.ActiveScene");
        else if (id == 'players')
            name = i18n("MonksActiveTiles.PlayerTokens");
        else if (id == 'users')
            name = i18n("MonksActiveTiles.Players");
        else if (id == 'within')
            name = game.i18n.format("MonksActiveTiles.WithinTile", { collection: (defaultType || "tokens").capitalize() });
        else if (id == 'controlled')
            name = defaultType == "playlists" ? i18n("MonksActiveTiles.CurrentlyPlaying") : i18n("MonksActiveTiles.Controlled");
        else if (id == 'previous' || id == 'current')
            name = game.i18n.format("MonksActiveTiles.CurrentCollection", { collection: (defaultType || "tokens") }); //(defaultType == 'tokens' || defaultType == undefined ? i18n("MonksActiveTiles.PreviousData") : 'Current ' + defaultType );
        else if (id.startsWith('tagger'))
            name = `<i class="fas fa-tag fa-sm"></i> ${id.substring(7)}`;
        else if (id) {
            let entities = id.split(",");
            if (entities.length > 1)
                name = i18n("MonksActiveTiles.MultipleEntities", { entities: entities.length });
            else if (entities.length == 0) {
                name = i18n("MonksActiveTiles.UnknownEntity");
            } else {
                let document = (id.includes('Terrain') ? MonksActiveTiles.getTerrain(id) : await fromUuid(id));
                if (!document && defaultType) {
                    let collection = game[defaultType];
                    if (collection)
                        document = collection.get(id);
                }
                if (document) {
                    if (document.name) {
                        name = document.name;
                        if (document.parent && document.parent instanceof Playlist) {
                            name = document.parent.name + ": " + name;
                        } else if (document.compendium) {
                            name = `<i class="fas fa-atlas" data-tooltip="From compendium"></i> ${document.compendium.metadata.label}: ${name}`;
                        }
                    } else {
                        if (game.modules.get('tagger')?.active) {
                            let tags = Tagger.getTags(document);
                            if (tags.length)
                                name = tags[0];
                        }

                        if (!name)
                            name = document.documentName + ": " + document.id;
                    }
                } else {
                    name = i18n("MonksActiveTiles.UnknownEntity");
                }
            }
        } else {
            name = i18n("MonksActiveTiles.UnknownEntity");
        }

        return name || i18n("MonksActiveTiles.UnknownEntity");
    }

    static async getLocation(_location, args = {}) {
        let { value, userId } = args;
        let location = foundry.utils.duplicate(_location);

        if (location.id == 'previous' || location.id == 'current')
            location = args?.location || value?.location;
        else if (location.id == 'origin')
            location = args?.original || value?.original;
        else if (location.id == 'players') {
            let user = game.users.get(args.userId);
            if (user) {
                let scene = game.scenes.get(user.viewedScene);
                if (scene) {
                    let tokens = [];
                    if (user?.isGM) {
                        let actors = game.users.filter(u => !u.isGM).map(u => u.character?.id).filter(t => !!t);
                        tokens = scene.tokens.filter(t => actors.includes(t?.actor?.id));
                    } else if (user.character.id) {
                        tokens = [scene.tokens.find(t => t.actor.id == user.character.id)];
                    }
                    return tokens.map(t => {
                        return {
                            x: t.x + ((Math.abs(t.width) * scene.dimensions.size) / 2),
                            y: t.y + ((Math.abs(t.height) * scene.dimensions.size) / 2),
                            scene: scene.id
                        }
                    });
                }
            }
        } else if (location.id == 'tile') {
            location = [this];
        } else if (location.id == 'token')
            location = args.pt || (value.tokens.length ? { x: value.tokens[0].x, y: value.tokens[0].y } : null);
        else if(location.id?.startsWith('tagger')) {
            if (game.modules.get('tagger')?.active) {
                let tag = location.id.substring(7);

                tag = await getValue(tag, args);

                let options = {};
                if (!location.match || location.match == "any")
                    options.matchAny = true;
                if (location.match == "exact")
                    options.matchExactly = true;

                if (location.scene == "_all")
                    options.allScenes = true;
                else if (location.scene !== "_active" && location.scene && game.scenes.get(location.scene) != undefined)
                    options.sceneId = location.scene;
                else if (location.scene === "_active") {
                    let playerScene = game.users.get(userId)?.viewedScene;
                    if (playerScene != game.canvas?.scene?.id)
                        options.sceneId = playerScene;
                }

                location = Tagger.getByTag(tag, options);

                if (options.allScenes)
                    location = [].concat(...Object.values(location));
            }
        }

        location = (location instanceof Array ? location : [location]);

        for (let i = 0; i < location.length; i++) {
            let l = location[i];
            if (l == undefined)
                continue;

            if (l.id) {
                let dest = l;
                //this is directing to an entity
                if (!(dest instanceof Document)) {
                    let uuid = l.uuid || l.id;
                    if (uuid.startsWith("Tile."))
                        uuid = "Scene." + (l.sceneId || canvas.scene.id) + "." + uuid;
                    if (uuid.length == 16)
                        uuid = "Scene." + (l.sceneId || canvas.scene.id) + ".Tile." + uuid;

                    try {
                        dest = await fromUuid(uuid);
                    } catch { }
                }

                if (dest) {
                    let found = false;
                    /*
                    if (dest instanceof DrawingDocument) {
                        //drawing
                        //get all the points from the drawing
                        //check to see if the shape is closed and set repeat = true
                        let drawingData = MonksActiveTiles.drawingPoints(dest);
                        if (drawingData.points.length) {
                            location[i] = {
                                x: drawingData.points[0].x,
                                y: drawingData.points[0].y,
                                scene: dest.parent.id,
                                dest: dest,
                                points: drawingData.points,
                                repeat: drawingData.repeat
                            };
                            found = true;
                        }
                    }*/
                    if (!found) {
                        location[i] = {
                            x: dest.x + (Math.abs(dest.width || dest.shape.width) / 2),
                            y: dest.y + (Math.abs(dest.height || dest.shape.height) / 2),
                            width: Math.abs(dest.width || dest.shape.width),
                            height: Math.abs(dest.height || dest.shape.height),
                            scene: dest.parent.id,
                            dest: dest
                        };
                    }
                } else
                    location[i] = null;
            } else {
                let x = await getValue(l.x, args);
                let y = await getValue(l.y, args);
                location[i] = {
                    x: x,
                    y: y,
                    scale: l.scale,
                    scene: l.sceneId || canvas.scene.id
                };
            }
        }
        return location.filter(l => !!l);
    }

    static async locationName(location) {
        let name = "";

        if (!location)
            return '';

        let _location = location;

        if (_location instanceof Array) {
            if (_location.length > 1) {
                return i18n("MonksActiveTiles.MultipleLocations", { locations: _location.length });
            } else if (_location.length == 0)
                return "";
            else
                _location = location[0];
        }
        let sceneId = _location.sceneId || canvas.scene.id;
        if (_location.id) {
            if (_location?.id == 'previous' || _location?.id == 'current')
                name = i18n("MonksActiveTiles.CurrentLocation");
            else if (_location.id == 'players')
                name = i18n("MonksActiveTiles.PlayerTokens");
            else if (_location?.id == 'token')
                name = i18n("MonksActiveTiles.TriggeringToken");
            else if (_location?.id == 'tile')
                name = i18n("MonksActiveTiles.ThisTile");
            else if (_location?.id == 'origin')
                name = i18n("MonksActiveTiles.Origin");
            else if (_location?.id.startsWith('tagger'))
                name = `<i class="fas fa-tag fa-sm"></i> ${_location.id.substring(7)}`;
            else {
                //this is directing to an entity
                let uuid = _location.id;
                if (uuid.startsWith("Tile."))
                    uuid = "Scene." + (_location.sceneId || canvas.scene.id) + "." + uuid;
                if (uuid.length == 16)
                    uuid = "Scene." + (_location.sceneId || canvas.scene.id) + ".Tile." + uuid;
                    
                let document = await fromUuid(uuid);
                if (document) {
                    sceneId = document.parent.id;

                    if (document.name)
                        name = document.name
                    else {
                        if (game.modules.get('tagger')?.active) {
                            let tags = Tagger.getTags(document);
                            if (tags.length)
                                name = tags[0];
                        }

                        if (!name)
                            name = document.documentName + ": " + document.id;
                    }
                } else {
                    if (_location.x || _location.y)
                        name = `[${_location.x},${_location.y}${(_location.scale ? `, scale:${_location.scale}` : '')}]`;
                    else
                        name = i18n("MonksActiveTiles.UnknownLocation");
                }
            }
        } else {
            name = foundry.utils.isEmpty(_location) ? "" : `[x:${_location.x} y:${_location.y}${(_location.scale ? ` scale:${_location.scale?.toFixed(2) }` : '')}]`;
        }

        let scene = game.scenes.find(s => s.id == sceneId);
        return `${(scene?.id != canvas.scene.id ? 'Scene: ' + scene?.name + ', ' : '')}${name}`;
    }

    static getSnappedPosition(x, y, interval = 1) {
        if (interval === 0) return { x: Math.round(x), y: Math.round(y) };
        let x0 = x.toNearest(canvas.grid.size);
        let y0 = y.toNearest(canvas.grid.size);
        let dx = 0;
        let dy = 0;
        if (interval !== 1) {
            let delta = canvas.grid.size / interval;
            dx = Math.round((x - x0) / delta) * delta;
            dy = Math.round((y - y0) / delta) * delta;
        }
        return {
            x: Math.round(x0 + dx),
            y: Math.round(y0 + dy)
        };
    }

    static testVisibility(point, { tolerance = 2, object = null } = {}) {

        // If no vision sources are present, the visibility is dependant of the type of user
        if (!canvas.effects.visionSources.size) return game.user.isGM;

        // Get scene rect to test that some points are not detected into the padding
        const sr = canvas.dimensions.sceneRect;
        const inBuffer = !sr.contains(point.x, point.y);

        // Prepare an array of test points depending on the requested tolerance
        const t = tolerance;
        const offsets = t > 0 ? [[0, 0], [-t, -t], [-t, t], [t, t], [t, -t], [-t, 0], [t, 0], [0, -t], [0, t]] : [[0, 0]];
        const config = {
            object,
            tests: offsets.map(o => ({
                point: new PIXI.Point(point.x + o[0], point.y + o[1]),
                los: new Map()
            }))
        };
        const modes = CONFIG.Canvas.detectionModes;

        // First test basic detection for light sources which specifically provide vision
        for (const lightSource of canvas.effects.lightSources.values()) {
            if (!lightSource.data.vision || !lightSource.active || lightSource.disabled) continue;
            const result = lightSource.testVisibility(config);
            if (result === true) return true;
        }

        // Second test basic detection tests for vision sources
        for (const visionSource of canvas.effects.visionSources.values()) {
            if (!visionSource.active) continue;
            // Skip sources that are not both inside the scene or both inside the buffer
            if (inBuffer === sr.contains(visionSource.x, visionSource.y)) continue;
            const token = visionSource.object.document;
            const basic = token.detectionModes.find(m => m.id === DetectionMode.BASIC_MODE_ID);
            if (!basic) continue;
            const result = modes.basicSight.testVisibility(visionSource, basic, config);
            if (result === true) return true;
        }

        // Lastly test special detection modes for vision sources
        if (!(object instanceof foundry.canvas.placeables.Token)) return false;   // Special detection modes can only detect tokens
        for (const visionSource of canvas.effects.visionSources.values()) {
            if (!visionSource.active) continue;
            // Skip sources that are not both inside the scene or both inside the buffer
            if (inBuffer === sr.contains(visionSource.x, visionSource.y)) continue;
            const token = visionSource.object.document;
            for (const mode of token.detectionModes) {
                if (mode.id === DetectionMode.BASIC_MODE_ID) continue;
                const dm = modes[mode.id];
                const result = dm?.testVisibility(visionSource, mode, config);
                if (result === true) {
                    object.detectionFilter = dm.constructor.getDetectionFilter();
                    return true;
                }
            }
        }
        return false;
    }

    static async getTileFiles(files) {
        let results = [];
        for (let file of files) {
            if (!file.name.includes('*'))
                results.push(file.name);
            else {
                let source = "data";
                let pattern = file.name;
                const browseOptions = { wildcard: true };

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
                    const content = await FilePicker.browse(source, pattern, browseOptions);
                    results = results.concat(content.files);
                } catch (err) {
                    debug(err);
                }
            }
        }
        return results;
    }

    static getTerrain(uuid) {
        let parts = uuid.split(".");

        let scene = game.scenes.get(parts[1]);
        let terrain = scene?.terrain.get(parts[3]);

        return terrain;
    }

    static async _executeMacro(macro, mainargs = {}) {
        const { tile, tokens, action, userId, values, value, method, pt, change, event, original } = mainargs;

        for (let i = 0; i < tokens.length; i++) {
            tokens[i] = (typeof tokens[i] == 'string' ? await fromUuid(tokens[i]) : tokens[i]);
        }

        let tkn = tokens[0];

        let user = game.users.get(userId);

        let context = {
            actor: tkn?.actor,
            token: tkn,
            character: user.character,
            tile: tile,
            user: user,
            canvas: canvas,
            scene: canvas.scene,
            values: values,
            value: value,
            variable: foundry.utils.getProperty(tile, "flags.monks-active-tiles.variables") || {},
            tokens: tokens,
            method: method,
            pt: pt,
            actionId: mainargs._id,
            change: change,
            event: event,
            original: original
        };
        let args = action.data.args;

        if (args == undefined || args == "")
            args = [];
        else {
            if (args.includes("{{")) {
                const compiled = Handlebars.compile(args);
                args = compiled(context, { allowProtoMethodsByDefault: true, allowProtoPropertiesByDefault: true }).trim();
            }

            args = args.match(/\\?.|^$/g).reduce((p, c) => {
                if (c === '"') {
                    p.quote ^= 1;
                } else if (!p.quote && c === ' ') {
                    p.a.push('');
                } else {
                    p.a[p.a.length - 1] += c.replace(/\\(.)/, "$1");
                }
                return p;
            }, { a: [''] }).a

            for (let i = 0; i < args.length; i++) {
                if (!isNaN(args[i]) && !isNaN(parseFloat(args[i])))
                    args[i] = parseFloat(args[i]);
            }
        }

        context.args = args;

        let runasgm = (action.data.runasgm == 'player' || action.data.runasgm == 'gm' ? action.data.runasgm == 'gm' :
            (game.modules.get("advanced-macros")?.active || game.modules.get("furnace")?.active ? foundry.utils.getProperty(macro, "flags.advanced-macros.runAsGM") || getProperty(macro, "flags.furnace.runAsGM") : true));

        if (runasgm || userId == game.user.id) {
            //if (game.modules.get("advanced-macros")?.active || game.modules.get("furnace")?.active)
            //    return await (macro.type == 'script' ? macro.callScriptFunction(context) : macro.execute(args));
            //else
                return await (macro.type == 'script' ? MonksActiveTiles._execute.call(macro, context) : macro.execute(args));
        } else {
            MonksActiveTiles.emit('runmacro', {
                userId: userId,
                macroid: macro.uuid,
                tileid: tile?.uuid,
                tokenid: tkn?.uuid,
                values: values,
                value: value,
                method: method,
                pt: pt,
                args: args,
                tokens: context.tokens.map(t => t.uuid),
                _id: mainargs._id,
                change: change,
                event: event
            });

            return { pause: true };
        }

        /*
        if (game.modules.get("advanced-macros")?.active || game.modules.get("furnace")?.active) {
            if (foundry.utils.getProperty(macro, "flags.advanced-macros.runAsGM") || foundry.utils.getProperty(macro, "flags.furnace.runAsGM") || userId == game.user.id) {
                //execute the macro if it's set to run as GM or it was the GM that actually moved the token.
                return await macro.callScriptFunction(context);
            } else {
                //this one needs to be run as the player, so send it back
                MonksActiveTiles.emit('runmacro', {
                    userId: userId,
                    macroid: macro.uuid,
                    tileid: tile?.uuid,
                    tokenid: tkn?.uuid,
                    values: values,
                    value: value,
                    method: method,
                    args: args,
                    tokens: context.tokens.map(t => t.uuid)
                });
            }
        } else {

            return await macro.execute(context);
        }*/
    }

    static async _executeCode(args = {}) {
        const { tile, tokens, action, userId, values, value, method, pt, change, event } = args;

        for (let i = 0; i < tokens.length; i++) {
            tokens[i] = (typeof tokens[i] == 'string' ? await fromUuid(tokens[i]) : tokens[i]);
        }

        let tkn = tokens[0];

        let user = game.users.get(userId);

        let context = {
            actor: tkn?.actor,
            token: tkn,
            character: user.character,
            tile: tile,
            user: user,
            canvas: canvas,
            scene: canvas.scene,
            values: values,
            value: value,
            tokens: tokens,
            method: method,
            pt: pt,
            actionId: args._id,
            change: change,
            event: event
        };
        

        MonksActiveTiles._execute.call({ command: action.data.code } , context);
    }

    static async _execute(context) {
        if (setting('use-core-macro') && this instanceof Macro) {
            return await this.execute(context);
        } else {
            try {
                return new Function(`"use strict";
            return (async function ({speaker, actor, token, character, tile, method, pt, args, scene, event}={}) {
                ${this.command}
                });`)().call(this, context);
            } catch (err) {
                ui.notifications.error(`There was an error in your macro syntax. See the console (F12) for details`);
                console.error(err);
            }
        }
    }

    static async _showDialog({ tile, token, value, type, title, id, content, options, yes, no, closeNo, buttons } = {}) {
        let context = {
            actor: token?.actor?.toObject(),
            token: token?.toObject(),
            tile: tile.toObject(),
            variable: foundry.utils.getProperty(tile, "flags.monks-active-tiles.variables") || {},
            user: game.user,
            players: game.users,
            value: value,
            scene: canvas.scene
        };
        let compiled = Handlebars.compile(title);
        title = compiled(context, { allowProtoMethodsByDefault: true, allowProtoPropertiesByDefault: true }).trim();
        compiled = Handlebars.compile(content);
        content = compiled(context, { allowProtoMethodsByDefault: true, allowProtoPropertiesByDefault: true }).trim();

        if (type == 'confirm') {
            return MonksActiveTiles.createDialog(id, {
                title,
                content,
                focus: true,
                default: "yes",
                close: () => {
                    return;
                },
                buttons: [
                    {
                        icon: '<i class="fas fa-check"></i>',
                        label: game.i18n.localize("Yes"),
                        callback: (event, button) => {
                            let data = {};

                            const fd = new foundry.applications.ux.FormDataExtended(button.form).object;
                            data = foundry.utils.mergeObject(data, fd);
                            context.value = foundry.utils.mergeObject(context.value, fd);

                            if (yes) {
                                if (yes.includes("{{")) {
                                    const compiled = Handlebars.compile(yes);
                                    data.goto = compiled(context, { allowProtoMethodsByDefault: true, allowProtoPropertiesByDefault: true }).trim();
                                } else
                                    data.goto = yes;
                            }

                            if (!data.goto)
                                data.continue = false;

                            return data;
                        }
                    },
                    {
                        icon: '<i class="fas fa-times"></i>',
                        label: game.i18n.localize("No"),
                        callback: (event, button) => {
                            let data = {}

                            const fd = new foundry.applications.ux.FormDataExtended(button.form).object;
                            data = foundry.utils.mergeObject(data, fd);
                            context.value = foundry.utils.mergeObject(context.value, fd);

                            if (no) {
                                if (no.includes("{{")) {
                                    const compiled = Handlebars.compile(no);
                                    data.goto = compiled(context, { allowProtoMethodsByDefault: true, allowProtoPropertiesByDefault: true }).trim();
                                } else
                                    data.goto = no;
                            }

                            if (!data.goto)
                                data.continue = false;

                            return data;
                        }
                    }
                ]
            },
            options,
            ).catch(() => {
                return closeNo ? { goto: no } : {};
            });
        } else if (type == 'alert') {
            let callback = (event, button) => {
                let data = {};
                const fd = new foundry.applications.ux.FormDataExtended(button.form).object;
                data = foundry.utils.mergeObject(data, fd);

                return data;
            };
            return MonksActiveTiles.createDialog(id, {
                title,
                content,
                callback,
                rejectClose: true,
                default: "ok",
                close: () => {
                    return;
                },
                buttons: [
                    { icon: '<i class="fas fa-check"></i>', label: "OK", callback }
                ]
            }, options).catch(() => { return {}; });
        } else {
            let _html;
            let _submit = false;
            return MonksActiveTiles.createDialog(id, {
                title, content, id,
                close: (event) => {
                    let data = {};

                    if (_submit) {
                        const fd = new foundry.applications.ux.FormDataExtended(button.form).object;
                        data = foundry.utils.mergeObject(data, fd);
                    }
                    return data;
                },
                render: (event, dialog) => {
                    _html = dialog;
                    $(dialog).on("submit", (evt) => {
                        _submit = true;
                        $('.window-header a.close', $(evt.currentTarget).closest('.app.dialog')).click();
                    });
                    $('.dialog-buttons').addClass("flexrow");
                },
                buttons: buttons.map(b => ({
                    label: b.name,
                    callback: (event, button) => {
                            let data = {};

                            const fd = new foundry.applications.ux.FormDataExtended(button.form).object;
                            data = foundry.utils.mergeObject(data, fd);
                            context.value = foundry.utils.mergeObject(context.value, fd);

                            if (b.goto) {
                                if (b.goto.includes("{{")) {
                                    const compiled = Handlebars.compile(b.goto);
                                    data.goto = compiled(context, { allowProtoMethodsByDefault: true, allowProtoPropertiesByDefault: true }).trim();
                                } else
                                    data.goto = b.goto;
                            }

                            if (!data.goto)
                                data.continue = false;

                            return data;
                        }
                }))
            }, options);
        }
    }

    static async createDialog(id, data = {}, options = {}, renderOptions = {}) {
        return new Promise((resolve, reject) => {

            // Wrap buttons with Promise resolution.
            const buttons = foundry.utils.deepClone(data.buttons);
            for (const [id, button] of Object.entries(buttons)) {
                const cb = button.callback;
                function callback(html, event) {
                    const result = cb instanceof Function ? cb.call(this, html, event) : undefined;
                    resolve(result === undefined ? id : result);
                }
                button.callback = callback;
            }

            // Wrap close with Promise resolution or rejection.
            const originalClose = data.close;
            const close = () => {
                const result = originalClose instanceof Function ? originalClose() : undefined;
                if (result !== undefined) resolve(result);
                else reject(new Error("The Dialog was closed without a choice being made."));
                delete MonksActiveTiles._dialogs[id];
            };

            options.classes = (options.classes || []);
            options.classes.push("monks-active-tiles-dialog");

            // Construct the dialog.
            const dialog = new foundry.applications.api.DialogV2({ ...data, buttons, close }, options);
            dialog.render(true, renderOptions);
            MonksActiveTiles._dialogs[id] = dialog;
        });
    }

    static async rollSlot(entity, files, oldIdx, newIdx, spins, time) {
        let t = entity._object;

        const container = new PIXI.Container();
        t.addChild(container);
        container.width = entity.width;
        container.height = entity.height;

        //Set the image clip region
        const mask = new PIXI.Graphics();
        mask.beginFill(0xFFFFFF);
        mask.drawRect(0, 0, entity.width, entity.height);
        mask.endFill();
        container.addChild(mask);
        container.mask = mask;

        //load all the files
        let sprites = [];
        for (let f of files) {
            let tex = await foundry.canvas.loadTexture(f);
            sprites.push(new PIXI.Sprite(tex));
        }

        //add them to the tile
        for (let s of sprites) {
            s.y = entity.height;
            s.width = entity.width;
            s.height = entity.height;
            container.addChild(s);
        }

        //hide the actual image
        t.children[0].visible = false;

        //set the current index and set the current file to be showing.
        let frames = [];
        frames.push({ sprite: sprites[oldIdx], idx: oldIdx });
        sprites[oldIdx].y = 0;
        MonksActiveTiles.emit("slotmachine", { cmd: "animate", entityid: entity.uuid, oldIdx, newIdx, spins, time });

        let duration = time - new Date().getTime();
        if (duration < 0)
            return;

        //run the animation
        return foundry.canvas.animation.CanvasAnimation._animatePromise(
            MonksActiveTiles.slotAnimate,
            t,
            `slot-machine${entity.id}`,
            { tile: t, frames: frames, sprites: sprites, idx: oldIdx, total: (sprites.length * spins) + (newIdx - oldIdx < 0 ? sprites.length + newIdx - oldIdx : newIdx - oldIdx) + 1 },
            duration
        ).then((t) => {
            MonksActiveTiles.emit("slotmachine", { cmd: "cleanup", entityid: entity.uuid });
            //clear all files, and the mask
            //update the tile
            entity._object.removeChild(container);
            entity._object.children[0].visible = true;
            entity.update({ img: files[newIdx] });
        });
    }

    static async slotAnimate(deltaTime, resolve, reject, attributes, duration) {
        let dt = (duration * PIXI.settings.TARGET_FPMS) / (deltaTime);// * (attributes.total < (attributes.sprites.length * 2) ? ((attributes.sprites.length * 2) - attributes.total) / 3 : 1));
        //cycle through all the images 8 times, 5 full speed, slowing down for the last to and positioning on the correct one for the last round
        //go through each frame
        let max = attributes.frames.length;
        for (let i = 0; i < max; i++) {
            let frame = attributes.frames[i];
            if (frame) {
                try {
                    //move the frame up on the x
                    let newY = frame.sprite.y - dt;

                    //if the current frame is completely off the Tile, then remove it from the frames
                    if (Math.abs(newY) >= attributes.tile.document.height) {
                        attributes.frames.shift();
                        i--;
                        max--;
                    } else if (newY < 0 && i == max - 1) {
                        //if the current frame hits negative, then add the next file to the frames
                        attributes.total--;
                        if (attributes.total == 0)
                            newY = 0;
                        else {
                            attributes.idx = (attributes.idx + 1) % attributes.sprites.length;
                            let sprite = attributes.sprites[attributes.idx];
                            let spriteY = attributes.tile.document.height + newY;
                            sprite.y = spriteY;
                            attributes.frames.push({ sprite: sprite, idx: attributes.idx });
                        }
                    }
                    frame.sprite.y = newY;
                } catch {
                }
            }
        }

        if (attributes.total == 0)
            resolve(true);
    }

    static async animateEntity(entity, from, animation) {
        let object = entity.mesh || entity.shape || entity.field || entity;
        let to = {
            x: entity.document.x,
            y: entity.document.y,
            rotation: entity.document.rotation,
            alpha: (entity.document.hidden ? (game.user.isGM ? 0.5 : 0) : entity.document.alpha ?? 1),
            hidden: entity.document.hidden
        };
        if (entity instanceof foundry.canvas.placeables.Drawing || entity instanceof foundry.canvas.placeables.Tile) {
            to.x += ((entity.document.width || entity.document.shape?.width || 0) / 2);
            to.y += ((entity.document.height || entity.document.shape?.height || 0) / 2);
        }
        //await foundry.canvas.animation.CanvasAnimation.terminateAnimation(`${entity.document.documentName}.${entity.id}.animateEntity`);

        let duration = (animation.time - new Date().getTime()) ?? animation.duration;
        if (isNaN(duration) || duration < 0) {
            log("Fade time has already passed");
            return new Promise((resolve) => { resolve(); });
        }

        if (from)
            entity._animationAttributes = foundry.utils.mergeObject(entity._animationAttributes || {}, from);

        let animations = {};
        // Define attributes
        let attributes = [];
        let positionChange = false;

        if (from.x != undefined && to.x != undefined && from.x != to.x) {
            attributes.push({ parent: object, attribute: 'x', from: from.x, to: to.x });
            positionChange = true;
        }
        if (from.y != undefined && to.y != undefined && from.y != to.y) {
            attributes.push({ parent: object, attribute: 'y', from: from.y, to: to.y });
            positionChange = true;
        }
        if (attributes.length)
            animations["movement"] = attributes;
        //if (positionChange)
         //   object.position.set(from.x ?? to.x, from.y ?? to.y);
        let dr = to.rotation - from.rotation;
        if (!isNaN(dr) && dr !== 0) {
            let r = to.rotation;
            if (dr > 180) r -= 360;
            if (dr < -180) r += 360;
            dr = r - from.rotation;
            animations["rotation"] = [{ attribute: "rotation", from: (from.rotation * (Math.PI / 180)), to: (r * (Math.PI / 180)), parent: object }]; // Do not use Math.toRadians because that will normalise the number
        }
        let hasAlpha = false;
        if (from.alpha != undefined && to.alpha != undefined && from.alpha != to.alpha) {
            animations["alpha"] = [{ parent: object, attribute: 'alpha', from: from.alpha, to: to.alpha }];
            hasAlpha = true;
        }

        if (foundry.utils.isEmpty(animations))
            return;

        // Dispatch the animation function
        for (let [key, attributes] of Object.entries(animations)) {
            let animationName = `${entity.document.documentName}.${entity.id}.animate${key}`;
            foundry.canvas.animation.CanvasAnimation.animate(attributes, {
                name: animationName,
                context: object,
                duration: duration,
                ontick: (dt, animation) => {
                    for (let attribute of animation.attributes) {
                        let realval = attribute.from + attribute.done;
                        if (!isNaN(attribute.done) && attribute.parent[attribute.attribute] != realval)
                            attribute.parent[attribute.attribute] = realval;
                        foundry.utils.setProperty(entity, `_animationAttributes.${attribute.attribute}`, realval)
                        if (attribute.attribute == "alpha" && to.hidden === true && !game.user.isGM && !attribute.parent.visible)
                            attribute.parent.object.visible = true;
                        if (attribute.parent instanceof foundry.canvas.placeables.AmbientLight) {
                            attribute.parent.document[attribute.attribute] = realval;
                            attribute.parent.initializeLightSource({ deleted: false });
                            //attribute.parent.updateSource();
                        }
                    }

                    //log("Animate Entity", animation.attributes[0].parent.rotation, attributes[0].done, attributes[0].from + attributes[0].done, animation.attributes[0].from, animation.attributes[0].to);
                }
            }).then(() => {
                for (let i = 0; i < attributes.length; i++) {
                    let attribute = attributes[i];
                    delete entity._animationAttributes[attribute.attribute];
                    if (attribute.attribute == "alpha" && to.hidden === true && !game.user.isGM && attribute.parent.visible)
                        attribute.parent.object.visible = false;
                }
            });
        }
    }

    static async fadeImage(entity, hide, time) {
        let icon = entity.object.mesh || entity.shape;
        let animationName = `MonksActiveTiles.${entity.documentName}.${entity.id}.animateShowHide`;

        await foundry.canvas.animation.CanvasAnimation.terminateAnimation(animationName);

        if (!hide) {
            icon.alpha = (game.user.isGM ? icon.alpha : 0);
            if (entity.object.hud)
                entity.object.hud.alpha = 0;
            icon.visible = true;
            entity.object.visible = true;

            entity.object._showhide = icon.alpha;
        }

        const attributes = [
            { parent: icon, attribute: 'alpha', to: (hide ? (game.user.isGM ? 0.5 : 0) : entity.alpha || 1), object: entity.object, hide: hide, from: icon.alpha || 1 }
        ];

        if (entity instanceof TokenDocument)
            attributes.push({ parent: entity.object.hud, attribute: 'alpha', to: (hide ? 0 : 1) });

        let duration = time - new Date().getTime();
        if (duration < 0) {
            log("Fade time has already passed");
            return new Promise((resolve) => { resolve(); });
        }

        return foundry.canvas.animation.CanvasAnimation.animate(attributes, {
            name: animationName,
            context: icon,
            duration: duration,
            ontick: (dt, animation) => {
                for (let attribute of animation.attributes) {
                    if (attribute.object && !attribute.hide) {
                        if (!attribute.object.visible)
                            attribute.object.visible = true;
                        let realval = attributes[0].from + attributes[0].done;
                        if (attribute.parent.alpha != realval)
                            attribute.parent.alpha = realval;
                        entity.object._showhide = attribute.parent[attribute.attribute];
                    }
                }

                //log("Token fade", attributes[0].object.alpha, attributes[0].parent.alpha, attributes[0].from + attributes[0].done, attributes[0].remaining, attributes[0].done, attributes[0].delta, attributes[0].object.visible, attributes[0].parent.visible);
            }
        }).then(() => {
            if (hide)
                entity.object.visible = false;
            if (entity.object.hud)
                entity.object.hud.alpha = 1;
            delete entity.object._showhide;
        });
    }

    static async transitionImage(entity, id, from, to, transition, time) {
        let t = entity._object;

        let duration = time - new Date().getTime();

        log("transition", from, to);

        if (!t) {
            // return a promise that resolves after duration
            entity._transition_to = to;
            return new Promise((resolve) => {
                entity._transition_resolve = resolve;
                setTimeout(() => {
                        resolve(to);
                    }, duration);
                }
            );
        }

        
        /*
        if (t._transition) {
            t._transitionQueue = t._transitionQueue || [];
            t._transitionQueue.push({ entity, from, to, transition, duration });
            log("addng to queue", t._transition, t._transitionQueue);
            return;
        }*/

        let animationName = `MonksActiveTiles.${entity.documentName}.${entity.id}.animateTransitionImage`;

        //await foundry.canvas.animation.CanvasAnimation.terminateAnimation(animationName);
        if (t._transition) {
            //log("Previous transition", t._transition_to);
            canvas.primary.removeChild(t._transition);
        }

        if (duration < 0) {
            log("Transition time has already passed");
            new Promise((resolve) => { resolve(); });
        }

        let transitionId = foundry.utils.randomID();
        t._transition_id = id;
        t._transition_ready = false;
        t._transition_time = time;
        t._transition_to = to;
        const container = t._transition = new PIXI.Container();
        canvas.tiles.addChild(container);
        //container.width = entity.width;
        //container.height = entity.height;
        container.x = entity.x;
        container.y = entity.y;
        container.scale.x = 1;
        container.scale.y = 1;

        Object.defineProperty(container, "visible", {
            get: function () { return true; }
        });

        //log("Container", container.x, container.y, t._transition, t._transition.x, t._transition.y);

        //Set the image clip region
        if (transition != "fade" && transition != "blur") {
            const mask = new PIXI.Graphics();
            mask.beginFill(0xFFFFFF);
            mask.drawRect(0, 0, entity.width, entity.height);
            mask.endFill();
            container.addChild(mask);
            container.mask = mask;
        }

        const hw = Math.abs(entity.width) / 2;
        const hh = Math.abs(entity.height) / 2;
        const inner = container.addChild(new PIXI.Container());
        inner.x = hw;
        inner.y = hh;

        //load the sprites
        t._textures = t._textures || {};
        let fromTex;
        let toTex;

        if (!t._textures[from]) {
            try {
                fromTex = await foundry.canvas.loadTexture(from);
            } catch { }
            if (!fromTex) {
                console.warn(`Transition texture [from] invalid, ${from}`);
                fromTex = await foundry.canvas.loadTexture("/modules/monks-active-tiles/img/1x1.png");
            } else
                t._textures[from] = fromTex;
        } else
            fromTex = t._textures[from];
        
        if (!t._textures[to]) {
            try {
                toTex = await foundry.canvas.loadTexture(to);
            } catch { }
            if (!toTex) {
                console.warn(`Transition texture [to] invalid, ${to}`);
                toTex = await foundry.canvas.loadTexture("/modules/monks-active-tiles/img/1x1.png");
            } else
                t._textures[to] = toTex;
        } else
            toTex = t._textures[to];

        let setUpSprite = (texture) => {
            let sprite = inner.addChild(new PIXI.Sprite(texture));
            sprite.texture = texture;
            sprite.y = 0;
            sprite.width = entity.width;
            sprite.height = entity.height;

            // Update tile appearance
            sprite.alpha = entity.alpha;
            sprite.scale.x = entity.width / texture.width;
            sprite.scale.y = entity.height / texture.height;
            sprite.rotation = Math.toRadians(entity.rotation);
            sprite.anchor.set(0.5, 0.5);
            sprite.tint = entity.tint ? foundry.utils.colorStringToHex(entity.tint) : 0xFFFFFF;

            Object.defineProperty(sprite, "visible", {
                get: function () { return true; }
            });

            return sprite;
        }

        //container.texture = fromTex;
        let fromMesh = setUpSprite(fromTex, true);
        let toMesh = setUpSprite(toTex, false);

        //hide the actual image
        t.mesh.visible = false;
        t.texture = toTex;
        t.mesh.texture = toTex;
        t.mesh.scale.x = t.width / t.texture.width;
        t.mesh.scale.y = t.height / t.texture.height;

        let attributes = [];

        fromMesh.alpha = entity.alpha;
        if (transition == "fade") {
            toMesh.alpha = 0;

            // Define attributes
            attributes = [
                { parent: fromMesh, attribute: 'alpha', to: 0 },
                { parent: toMesh, attribute: 'alpha', to: entity.alpha }
            ];
        }

        if (transition == "blur") {
            fromMesh.filters = [new PIXI.BlurFilter()];
            fromMesh.filters[0].blur == 0;
            toMesh.filters = [new PIXI.BlurFilter()];
            toMesh.filters[0].blur == 200;
            toMesh.alpha = 0;

            attributes = [
                { parent: fromMesh.filters[0], attribute: 'blur', to: 200 },
                { parent: toMesh.filters[0], attribute: 'blur', to: 0 },
                { parent: fromMesh, attribute: 'alpha', to: 0 },
                { parent: toMesh, attribute: 'alpha', to: entity.alpha }
            ];
        }

        if (transition.startsWith("slide")) {
            attributes.push({ parent: fromMesh, attribute: 'alpha', to: 0 });
        } else if (transition.startsWith("bump")) {
            if (transition.endsWith("left")) {
                attributes.push({ parent: fromMesh, attribute: 'x', to: -entity.width });
            } else if (transition.endsWith("right")) {
                attributes.push({ parent: fromMesh, attribute: 'x', to: entity.width });
            } else if (transition.endsWith("up")) {
                attributes.push({ parent: fromMesh, attribute: 'y', to: -entity.height });
            } else if (transition.endsWith("down")) {
                attributes.push({ parent: fromMesh, attribute: 'y', to: entity.height });
            }
        }

        if (transition.endsWith("left")) {
            toMesh.x = entity.width;
            attributes.push({ parent: toMesh, attribute: 'x', to: 0 });
        } else if (transition.endsWith("right")) {
            toMesh.x = -entity.width;
            attributes.push({ parent: toMesh, attribute: 'x', to: 0 });
        } else if (transition.endsWith("up")) {
            toMesh.y = entity.height;
            attributes.push({ parent: toMesh, attribute: 'y', to: 0 });
        } else if (transition.endsWith("down")) {
            toMesh.y = -entity.height;
            attributes.push({ parent: toMesh, attribute: 'y', to: 0 });
        }

        // If the browser is stalled and not accepting new actions then it won't register ready as true, meaning you can terminate the animation immediately.
        window.setTimeout(() => {
            if (t._transition && transitionId == t._transition_id) {
                t._transition_ready = true;
            }
        }, 10);

        window.setTimeout(() => {
            if (t._transition && transitionId == t._transition_id) {
                //log("Transition timed out", transitionId, t._transition_id, to);
                foundry.canvas.animation.CanvasAnimation.terminateAnimation(animationName);
            }
        }, duration + 100);

        return foundry.canvas.animation.CanvasAnimation.animate(attributes, {
            name: animationName,
            context: t,
            duration: duration,
            ontick: (dt, animation) => {
                if (t.mesh.visible)
                    t.mesh.visible = false;
                //log("Tick", animation.attributes[0]);
            }
        }).then(() => {
            //log("Transition finished", t._transition_to);
            foundry.canvas.animation.CanvasAnimation.terminateAnimation(animationName);
            let result = t._transition_to;
            let transitionId = t._transition_id;
            canvas.tiles.removeChild(t._transition);
            delete t._transition;
            delete t._transition_id;
            delete t._transition_time;
            t.texture = toTex;
            t.texture.x = 0;
            t.texture.y = 0;
            t.mesh.visible = true;
            //t.mesh.refresh();
            //log("checking transition queue", t._transition, t._transitionQueue);
            //if (t._transitionQueue?.length) {
            //    let next = t._transitionQueue.shift();
            //    MonksActiveTiles.transitionImage(next.entity, next.from, next.to, next.transition, new Date().getTime() + next.duration);
            //}
            if (!game.user.isGM) {
                MonksActiveTiles.emit("transitionend", { entityid: entity.uuid, transitionId });
            }
            return result
        });
    }

    static async temporaryTileImage(entity, img) {
        let t = entity._object;
        if (!img)
            img = entity.texture.src;

        t._textures = t._textures || {};
        let tex;

        if (img) {
            if (!t._textures[img]) {
                try {
                    tex = await foundry.canvas.loadTexture(img);
                } catch { }
                if (!tex) {
                    tex = await foundry.canvas.loadTexture("/modules/monks-active-tiles/img/1x1.png");
                } else
                    t._textures[img] = tex;
            } else
                tex = t._textures[img];
        }

        t.texture = tex;
        if (t.texture) {
            if (!t.mesh) {
                t.mesh = canvas.primary.addTile(t);
                t.bg.clear();
            }
            t.mesh.texture = tex;
            //t.mesh.scale.x = t.width / t.texture.width;
            //t.mesh.scale.y = t.height / t.texture.height;
            t._refreshMesh();
        } else if (t.mesh) {
            canvas.primary.removeTile(t);
            t.mesh = null;
            if (t.bg) {
                let aw = Math.abs(t.document.width);
                let ah = Math.abs(t.document.height)
                t.bg.clear().beginFill(0xFFFFFF, 0.5).drawRect(-(aw / 2), -(ah / 2), aw, ah).endFill();
            }
        }
    }

    static findVacantSpot(pos, token, scene, newTokens, dest, snap) {
        let tokenList = scene.tokens.contents.concat(...newTokens);
        let tokenWidth = (token.width * scene.dimensions.size);
        let tokenHeight = (token.height * scene.dimensions.size);

        //log("Token List", tokenList)

        let rect = {
            x: dest?.dest?.x ?? pos.x - (scene.dimensions.size * 10),
            y: dest?.dest?.y ?? pos.y - (scene.dimensions.size * 10),
            width: dest.width ?? (scene.dimensions.size * 20),
            height: dest.height ?? (scene.dimensions.size * 20)
        }

        let tokenCollide = function (checkpt) {
            let ptx2 = checkpt.x + tokenWidth;
            let pty2 = checkpt.y + tokenHeight;

            let found = tokenList.filter(tkn => {
                if (token.id == tkn.id || !tkn.x || !tkn.y)
                    return false;

                let tknx2 = tkn.x + (Math.abs(tkn.width) * scene.dimensions.size);
                let tkny2 = tkn.y + (Math.abs(tkn.height) * scene.dimensions.size);

                // check if the two rectangles overlap
                let result = (checkpt.x >= tknx2 || ptx2 <= tkn.x || checkpt.y >= tkny2 || pty2 <= tkn.y);
                if (!result)
                    log("Token Collide", { x: checkpt.x, y: checkpt.y, x2: ptx2, y2: pty2 }, { x: tkn.x, y: tkn.y, x2: tknx2, y2: tkny2 }, tkn, token);

                return !result;
            })

            return found.length;
        }

        let wallCollide = function (ray) {
            for (let wall of scene.walls) {
                if (foundry.utils.lineSegmentIntersects(ray.A, ray.B, { x: wall.c[0], y: wall.c[1] }, { x: wall.c[2], y: wall.c[3] }))
                    return true;
            }
            return false
        }

        let outsideTile = function (checkpt) {
            return (checkpt.x < rect.x || checkpt.y < rect.y || checkpt.x > rect.x + Math.abs(rect.width) || checkpt.y > rect.y + Math.abs(rect.height));
        }

        let positions = [];
        let snappos = { x: Math.floor(pos.x / scene.dimensions.size) * scene.dimensions.size, y: Math.floor(pos.y / scene.dimensions.size) * scene.dimensions.size };
        let offset = { x: pos.x - snappos.x, y: pos.y - snappos.y };
        // If snapping to grid, then align to the grid, if not, then align to pos
        if (snap) {
            offset = { x: 0, y: 0 };
        }

        // Find the array of spots that are available, remove ones that are blocked by a wall
        for (let x = rect.x; x <= rect.x + Math.abs(rect.width); x += scene.dimensions.size) {
            for (let y = rect.y; y <= rect.y + Math.abs(rect.height); y += scene.dimensions.size) {
                let spot = { x: x + offset.x, y: y + offset.y };
                let wallRes = wallCollide(new foundry.canvas.geometry.Ray({ x: pos.x, y: pos.y }, { x: spot.x + (tokenWidth / 2), y: spot.y + (tokenHeight / 2) }));
                let tileRes = outsideTile(spot);
                if (!wallRes && !tileRes)
                    positions.push(spot);
            }
        }

        // Run through and mark the ones that are already taken by a token
        for (let position of positions) {
            let taken = tokenCollide(position);
            position.tokens = taken;
        }

        // Sort by tokens this token will cover, then by distance to pos
        positions = positions.sort((a, b) => {
            if (a.tokens == b.tokens)
                return (Math.abs(a.x - pos.x) + Math.abs(a.y - pos.y)) - (Math.abs(b.x - pos.x) + Math.abs(b.y - pos.y));
            return a.tokens - b.tokens;
        });

        //log("Positions", positions);

        if (positions.length == 0)
            return pos;

        return positions[0];
    }

    static async inlineRoll(value, rgx, chatMessage = true, rollMode = "selfroll", token) {
        let doRoll = async function (match, command, formula, closing, label, ...args) {
            if (closing.length === 3) formula += "]";

            if (["/save", "/damage", "/skill", "/check", "/tool"].includes((command || "").trim()))
                return match;

            let roll = await Roll.create(formula)._evaluate({async: true});

            if (chatMessage) {
                const cls = ChatMessage.implementation;
                const speaker = cls.getSpeaker({ token: token });

                let mode = command?.replace(/[^A-Za-z]/g, "");
                if (mode == "br") mode = "blindroll";
                if (!["publicroll", "gmroll", "blindroll", "selfroll"].includes(mode)) mode = rollMode;

                mode = mode || rollMode;

                let msg = await roll.toMessage({ flavor: (label ? `${label}: ${roll.total}` : roll.total), speaker }, { rollMode: mode });
                msg.applyRollMode(mode);
            }

            return roll.total;
        }

        let retVal = value;

        const matches = value.matchAll(rgx);
        for (let match of Array.from(matches).reverse()) {
            let result = await doRoll(...match);
            retVal = retVal.replace(match[0], result);
        }

        return retVal;
    }

    constructor() {
    }

    static addToResult(entity, result, action = "add") {
        if (!entity)
            return;

        let typeList = {};
        let addEntity = (type, entity) => {
            if (action == "remove" && result[type] == undefined)
                return;

            if (result[type] == undefined || (action === "replace" && !typeList[type])) result[type] = [];
            if (action == "remove") {
                let idx = result[type].findIndex(e => e.id == entity.id);
                if (idx >= 0)
                    result[type].splice(idx, 1);
            } else
                result[type].push(entity);
            typeList[type] = true;
        }

        let index = 0;
        for (let e of entity instanceof Array ? entity : [entity]) {
            if (e instanceof TokenDocument) {
                addEntity('tokens', e);
            } else if (e instanceof Actor) {
                addEntity('actors', e);
            } else if (e instanceof TileDocument) {
                addEntity('tiles', e);
            } else if (e instanceof DrawingDocument) {
                addEntity('drawings', e);
            } else if (e instanceof AmbientLightDocument) {
                addEntity('lights', e);
            } else if (e instanceof AmbientSoundDocument) {
                addEntity('sounds', e);
            } else if (e instanceof WallDocument) {
                addEntity('walls', e);
            } else if (e instanceof JournalEntry) {
                addEntity('journal', e);
            } else if (e instanceof Scene) {
                addEntity('scenes', e);
            } else if (e instanceof Macro) {
                addEntity('macros', e);
            } else if (e instanceof Item) {
                addEntity('items', e);
            } else if (e instanceof RollTable) {
                addEntity('rolltables', e);
            } else if (e instanceof Playlist) {
                addEntity('playlists', e);
            } else if (e instanceof User) {
                addEntity('users', e);
            }
            index++;
        }
    }

    static selectClick = function (event) {
        let waitingType = MonksActiveTiles.waitingInput?.waitingfield?.data('type');
        if (waitingType == 'location' || waitingType == 'either' || waitingType == 'position') {
            let restrict = MonksActiveTiles.waitingInput.waitingfield.data('restrict');
            let tileDocument = MonksActiveTiles.waitingInput.options.parent.options.document;
            if (restrict && !restrict(canvas.scene, tileDocument)) {
                ui.notifications.error(i18n("MonksActiveTiles.msg.invalid-location"));
                return;
            }
            let pos = canvas.activeLayer.toLocal(event);
            let update = { x: parseInt(pos.x), y: parseInt(pos.y), sceneId: (canvas.scene.id != tileDocument.parent.id ? canvas.scene.id : null) };
            ActionConfig.updateSelection.call(MonksActiveTiles.waitingInput, update, event);
        }
    }

    static canvasClick = function (event, clicktype) {
        if (clicktype == "click")
            MonksActiveTiles.selectClick(event);
        if (canvas.activeLayer instanceof foundry.canvas.layers.TokenLayer) {
            //check to see if there are any Tiles that can be activated with a click
            let pt = canvas.activeLayer.toLocal(event);
            if (isNaN(pt.x) || isNaN(pt.y))
                return;
            MonksActiveTiles.checkClick(pt, clicktype, event);
        }
    }

    static async init() {
        log('Initializing Monks Active Tiles');
        registerSettings();

        game.MonksActiveTiles = this;

        try {
            Object.defineProperty(User.prototype, "isTheGM", {
                get: function isTheGM() {
                    return this == (game.users.find(u => u.hasRole("GAMEMASTER") && u.active) || game.users.find(u => u.hasRole("ASSISTANT") && u.active));
                }
            });
        } catch { }

        CONFIG.RegionBehavior.typeIcons["monks-active-tiles.triggerTile"] = "fa-solid fa-cubes";

        class ActiveTileDocumentUUIDField extends foundry.data.fields.DocumentUUIDField {
            _toInput(config) {
                Object.assign(config, { type: this.type, single: this.single });
                return foundry.applications.elements.HTMLDocumentTagsElement.create(config);
            }
        }
        class TriggerTileRegionBehavior extends foundry.data.regionBehaviors.RegionBehaviorType {
            static defineSchema() {
                return {
                    events: this._createEventsField(),
                    uuid: new ActiveTileDocumentUUIDField({
                        type: "Tile",
                        single: false,
                        label: "BEHAVIOR.TYPES.triggerTile.FIELDS.uuid.label",
                        hint: "BEHAVIOR.TYPES.triggerTile.FIELDS.uuid.hint"
                    }),
                    usetiletrigger: new foundry.data.fields.BooleanField({
                        initial: true,
                        label: "BEHAVIOR.TYPES.triggerTile.FIELDS.usetiletrigger.label",
                        hint: "BEHAVIOR.TYPES.triggerTile.FIELDS.usetiletrigger.hint"
                    }),
                }
            }
            async _handleRegionEvent(event) {
                if (!this.uuid) return;
                const doc = await fromUuid(this.uuid);
                if (!(doc instanceof TileDocument)) {
                    console.error(`${this.uuid} does not exist`);
                    return;
                }
                let triggerData = foundry.utils.getProperty(doc, "flags.monks-active-tiles");
                if (triggerData?.active) {
                    if (setting("prevent-when-paused") && game.paused && !game.user.isGM && triggerData.allowpaused !== true)
                        return;

                    //check to see if this trigger is restricted by control type
                    if ((triggerData.controlled == 'gm' && !game.user.isGM) || (triggerData.controlled == 'player' && game.user.isGM))
                        return;

                    let tokens = canvas.tokens.controlled.map(t => t.document);
                    //check to see if this trigger is per token, and already triggered
                    if (triggerData.pertoken) {
                        tokens = tokens.filter(t => !doc.hasTriggered(t.id)); //.uuid
                        if (tokens.length == 0)
                            return;
                    }

                    let method = 'region';
                    if (this.usetiletrigger) {
                        if (event.name == "tokenMoveIn" || event.name == "tokenEnter") {
                            method = "enter";
                        } else if (event.name == "tokenMoveOut" || event.name == "tokenExit") {
                            method = "exit";
                        } else if (event.name == "tokenTurnStart") {
                            method = "turn";
                        } else if (event.name == "tokenTurnEnd") {
                            method = "turnend";
                        } else if (event.name == "tokenRoundStart") {
                            method = "round";
                        }
                    }

                    let pt = event.data.destination;
                    if (event.data.segments?.length > 0) {
                        pt = event.data.segments[0].to;
                    }
                    let result = await doc.trigger({
                        tokens: tokens, method, pt, options: {
                            original: event.data.destination,
                            elevation: event.data.destination?.elevation,
                            src: event.data.origin,
                            value: { region: this.region, regionData: event.data }
                        }
                    }) || {};
                    //foundry.utils.mergeObject(results, result);
                    //if (result?.stoptriggers)
                    //    break;
                }
            }
        }
        Object.assign(CONFIG.RegionBehavior.dataModels, {
            "monks-active-tiles.triggerTile": TriggerTileRegionBehavior,
        });

        patchFunc("foundry.applications.sheets.WallConfig.prototype._prepareSubmitData", function (wrapped, ...args) {
            let submitData = wrapped(...args);
            let value = $('[name="flags.monks-active-tiles.entity"]', this.element).data("value");
            foundry.utils.setProperty(submitData, "flags.monks-active-tiles.entity", value);

            return submitData;
        });

        patchFunc("foundry.applications.ux.TextEditor.prototype.constructor.truncateText", function (wrapped, ...args) {
            let [text, options] = args;
            if (text == undefined) {
                args[0] = "";
            }
            return wrapped(...args);
        });

        patchFunc("foundry.applications.elements.HTMLStringTagsElement.prototype.constructor.renderTag", function (wrapped, ...args) {
            let [tag, label] = args;
            if (tag.includes(".Tile.") && !label) {
                try {
                    let document = fromUuidSync(tag);
                    if (document) {
                        if (game.modules.get('tagger')?.active) {
                            let tags = Tagger.getTags(document);
                            if (tags.length)
                                label = tags[0];
                        }

                        if (!label)
                            label = document.documentName + ": " + document.id;

                        args[1] = label;
                    }
                } catch { }
            }
            return wrapped(...args);
        }, "MIXED");


        //@Tile[Scene.b77ocyto1VdgAZU5.Tile.QW3oZo39pZsf8cTX landing:test1]{Journal Click Tile}
        CONFIG.TextEditor.enrichers.push({ id: 'MonksActiveTileTrigger', pattern: new RegExp(`@(Tile)\\[([^\\]]+)\\](?:{([^}]+)})?`, 'g'), enricher: MonksActiveTiles._createTileLink });

        //let otherGroups = {};
        //await Hooks.call("setupTileGroups", otherGroups);
        //MonksActiveTiles.triggerGroups = Object.assign(MonksActiveTiles.triggerGroups, otherGroups);

        //let otherTriggers = {};
        await Hooks.call("setupTileActions", this);
        //MonksActiveTiles.triggerActions = Object.assign(otherTriggers, MonksActiveTiles.triggerActions);

        if (game.modules.get("lib-wrapper")?.active) {
            libWrapper.ignore_conflicts("monks-active-tiles", "monks-enhanced-journal", "foundry.applications.sidebar.tabs.JournalDirectory.prototype._onClickEntry");
            libWrapper.ignore_conflicts("monks-active-tiles", "multiple-document-selection", "foundry.applications.sidebar.tabs.ItemDirectory.prototype._onClickEntry");
            libWrapper.ignore_conflicts("monks-active-tiles", "multiple-document-selection", "foundry.applications.sidebar.tabs.JournalDirectory.prototype._onClickEntry");
            libWrapper.ignore_conflicts("monks-active-tiles", "multiple-document-selection", "foundry.applications.sidebar.tabs.ActorDirectory.prototype._onClickEntry");
            libWrapper.ignore_conflicts("monks-active-tiles", "multiple-document-selection", "foundry.applications.sidebar.tabs.RollTableDirectory.prototype._onClickEntry");
            libWrapper.ignore_conflicts("monks-active-tiles", "multiple-document-selection", "foundry.applications.sidebar.tabs.SceneDirectory.prototype._onClickEntry");
            libWrapper.ignore_conflicts("monks-active-tiles", "multiple-document-selection", "foundry.applications.sidebar.tabs.MacroDirectory.prototype._onClickEntry");
            libWrapper.ignore_conflicts("monks-active-tiles", "multiple-document-selection", "foundry.applications.sidebar.apps.Compendium.prototype._onClickEntry");
            libWrapper.ignore_conflicts("monks-active-tiles", "monks-common-display", "foundry.applications.sidebar.tabs.ActorDirectory.prototype._onClickEntry");
            libWrapper.ignore_conflicts("monks-active-tiles", "monks-scene-navigation", "foundry.applications.sidebar.tabs.SceneDirectory.prototype._onClickEntry");
            libWrapper.ignore_conflicts("monks-active-tiles", "df-scene-enhance", "foundry.applications.sidebar.tabs.SceneDirectory.prototype._onClickEntry");
            libWrapper.ignore_conflicts("monks-active-tiles", "monks-enhanced-journal", "foundry.applications.sidebar.apps.Compendium.prototype._onClickEntry");
            libWrapper.ignore_conflicts("monks-active-tiles", "monks-little-details", "foundry.canvas.layers.TilesLayer.prototype._onDropData");
        }

        MonksActiveTiles.SOCKET = "module.monks-active-tiles";

        //MonksActiveTiles._oldObjectClass = CONFIG.Tile.objectClass;
        //CONFIG.Tile.objectClass = WithActiveTile(CONFIG.Tile.objectClass);

        MonksActiveTiles.setupTile();

        Handlebars.registerHelper({ selectGroups: MonksActiveTiles.selectGroups });

        /*let setPosition = function (...args) {
            let [html, target] = args;
            let parent = target[0].parentElement;
            let container;
            if (this.container) {
                container = target.closest(this.container);
                if (container.length) parent = container[0];
                else container = null;
            }

            // Append to target and get the context bounds
            //container.css('position', 'relative');
            html.css("visibility", "hidden");
            (container || target).append(html);
            const contextRect = html[0].getBoundingClientRect();
            const parentRect = target[0].getBoundingClientRect();
            const containerRect = parent.getBoundingClientRect();

            // Determine whether to expand upwards
            const contextTop = parentRect.top - contextRect.height;
            const contextBottom = parentRect.bottom + contextRect.height;
            const canOverflowUp = (contextTop > containerRect.top) || (getComputedStyle(parent).overflowY === "visible");

            // If it overflows the container bottom, but not the container top
            const containerUp = (contextBottom > containerRect.bottom) && (contextTop >= containerRect.top);
            const windowUp = (contextBottom > window.innerHeight) && (contextTop > 0) && canOverflowUp;
            this._expandUp = containerUp || windowUp;

            // Display the menu
            html.addClass(this._expandUp ? "expand-up" : "expand-down");
            html.css("visibility", "");
            target.addClass("context");
        }

        if (game.modules.get("lib-wrapper")?.active) {
            libWrapper.register("monks-active-tiles", "ContextMenu.prototype._setPosition", setPosition, "OVERRIDE");
        } else {
            ContextMenu.prototype._setPosition = setPosition;
        }*/



        let entityOnUpdate = function (wrapped, ...args) {
            let [data, options, userId] = args;
            const keys = Object.keys(foundry.utils.flattenObject(data));
            const changed = new Set(keys);
            const positionChange = ["x", "y"].some(c => changed.has(c));
            const hasRotation = changed.has("rotation");
            const hasAlpha = changed.has("hidden");

            let object = this.mesh || this.shape || this;

            const initial = {};
            if (positionChange) {
                initial.x = object.x;
                initial.y = object.y
            };
            if (hasRotation) {
                initial.rotation = Math.toDegrees(object.rotation);
            }
            if (hasAlpha) {
                initial.alpha = (changed["hidden"] === false ? (game.user.isGM ? 0.5 : 0) : object.alpha);
            }
            //log("Initial", initial);

            let result = wrapped(...args);

            if (!!options.animation && options.animation.duration && (positionChange || hasRotation || hasAlpha))
                MonksActiveTiles.animateEntity(this, initial, options.animation)

            return result;
        }

        patchFunc("foundry.canvas.placeables.Tile.prototype._onUpdate", entityOnUpdate);
        patchFunc("foundry.canvas.placeables.Drawing.prototype._onUpdate", entityOnUpdate);
        patchFunc("foundry.canvas.placeables.AmbientLight.prototype._onUpdate", entityOnUpdate);
        patchFunc("foundry.canvas.placeables.AmbientSound.prototype._onUpdate", entityOnUpdate);
        patchFunc("foundry.canvas.placeables.Note.prototype._onUpdate", entityOnUpdate);
        /*
        if (game.modules.get("lib-wrapper")?.active) {
            libWrapper.register("monks-active-tiles", "foundry.canvas.placeables.Tile.prototype._onUpdate", tileOnUpdate, "WRAPPER");
        } else {
            const oldOnUpdate = foundry.canvas.placeables.Tile.prototype._onUpdate;
            foundry.canvas.placeables.Tile.prototype._onUpdate = function (event) {
                return tileOnUpdate.call(this, oldOnUpdate.bind(this), ...arguments);
            }
        }*/

        let releaseAll = function (wrapped, ...args) {
            if (this.controlled.length) {
                let data = { tokens: this.controlled.map(t => t.document) };
                let id = window.setTimeout(() => {
                    if (id == MonksActiveTiles._selectedTokens.id)
                        delete MonksActiveTiles._selectedTokens;
                }, 400);
                data.id = id;
                MonksActiveTiles._selectedTokens = data;
            }
            return wrapped(...args);
        }

        patchFunc("foundry.canvas.layers.TokenLayer.prototype.releaseAll", releaseAll);

        let onDropData = async function (wrapper, ...args) {
            const [event, data] = args;
            if (data.data) {
                // Drop tile from tile browser
                let tileData = data.data;
                tileData.x = data.x;
                tileData.y = data.y;
                tileData.x = tileData.x - (tileData.width / 2);
                tileData.y = tileData.y - (tileData.height / 2);
                if (!event.shiftKey) {
                    const { x, y } = MonksActiveTiles.getSnappedPosition(tileData.x, tileData.y);
                    tileData.x = x;
                    tileData.y = y;
                }
                if (event.altKey) tileData.hidden = true;
                return TileDocument.create(tileData, { parent: canvas.scene }).then((tile) => {
                    MonksActiveTiles.fixTiles([tile]);
                    MonksActiveTiles.fixVariableName([tile]);
                    MonksActiveTiles.fixImageCycle([tile]);
                    MonksActiveTiles.fixForPlayer([tile]);
                    MonksActiveTiles.fixForPlayerAgain([tile]);
                    MonksActiveTiles.fixRollTable([tile]);
                    MonksActiveTiles.fixScenes([tile]);
                });
            }
            else
                return wrapper(...args);
        }

        patchFunc("foundry.canvas.layers.TilesLayer.prototype._onDropData", onDropData, "MIXED");

        let tileCreatePreview = function (wrapped, ...args) {
            let data = args[0];

            if (foundry.utils.getProperty(data, "flags.monks-active-tiles") == undefined) {
                data = foundry.utils.mergeObject(data, {
                    flags: {
                        'monks-active-tiles': {
                            active: true,
                            trigger: setting('default-trigger'),
                            vision: true,
                            chance: 100,
                            restriction: setting('default-restricted'),
                            controlled: setting('default-controlled'),
                            actions: []
                        }
                    }
                });
            }

            return wrapped(...args);
        }

        if (game.modules.get("lib-wrapper")?.active) {
            libWrapper.register("monks-active-tiles", "foundry.canvas.placeables.Tile.prototype.constructor.createPreview", tileCreatePreview, "WRAPPER");
        } else {
            const oldTileCreatePreview = foundry.canvas.placeables.Tile.prototype.constructor.createPreview;
            foundry.canvas.placeables.Tile.prototype.constructor.createPreview = function (event) {
                return tileCreatePreview.call(this, oldTileCreatePreview.bind(this), ...arguments);
            }
        }

        foundry.applications.ui.Hotbar.prototype.constructor.DEFAULT_OPTIONS.actions.execute = async function (event) {
            let getMacroForSlot = (element) => {
                const slot = element.dataset.slot;
                const macroId = game.user.hotbar[slot];
                if (!macroId) return null;
                return game.macros.get(macroId) ?? null;
            }
            const macro = getMacroForSlot(event.target);

            let waitingType = MonksActiveTiles.waitingInput?.waitingfield?.data('type');
            if (waitingType == 'entity') {
                if (macro)
                    MonksActiveTiles.controlEntity(macro);
            } else {
                // Execute a Macro
                if (macro) await macro?.execute();

                // Create a temporary Macro
                else {
                    const cls = getDocumentClass$1("Macro");
                    const macro = new cls({ name: cls.defaultName({ type: "chat" }), type: "chat", scope: "global" });
                    const hotbarSlot = event.target.dataset.slot;
                    await macro.sheet.render({ force: true, hotbarSlot });
                }
            }
        }

        let tileDraw = function (wrapped, ...args) {
            if (this._transition) {
                this.removeChild(this._transition);
            }
            return wrapped(...args).then((result) => {
                if (this._transition) {
                    this.addChild(this._transition);
                    this.mesh.visible = false;
                }

                if (this._animationAttributes && this._animationAttributes.alpha && this?.mesh?.alpha != this._animationAttributes.alpha) {
                    this.mesh.alpha = this._animationAttributes.alpha;
                }

                let triggerData = this.document.flags["monks-active-tiles"];
                if (triggerData?.usealpha && !this._textureBorderPoints) {
                    this._findTextureBorder();
                }

                return result;
            });
        }

        if (game.modules.get("lib-wrapper")?.active) {
            libWrapper.register("monks-active-tiles", "foundry.canvas.placeables.Tile.prototype.draw", tileDraw, "WRAPPER");
        } else {
            const oldTileDraw = foundry.canvas.placeables.Tile.prototype.draw;
            foundry.canvas.placeables.Tile.prototype.draw = function (event) {
                return tileDraw.call(this, oldTileDraw.bind(this), ...arguments);
            }
        }

        let tokenDraw = function (wrapped, ...args) {
            return wrapped(...args).then((result) => {
                if (this._showhide) {
                    this.mesh.alpha = this._showhide;
                    this.mesh.visible = true;
                    this.visible = true;
                }
                return result;
            });
        }

        if (game.modules.get("lib-wrapper")?.active) {
            libWrapper.register("monks-active-tiles", "foundry.canvas.placeables.Token.prototype.draw", tokenDraw, "WRAPPER");
        } else {
            const oldTokenDraw = foundry.canvas.placeables.Token.prototype.draw;
            foundry.canvas.placeables.Token.prototype.draw = function (event) {
                return tokenDraw.call(this, oldTokenDraw.bind(this), ...arguments);
            }
        }

        let oldCycleTokens = foundry.canvas.layers.TokenLayer.prototype.cycleTokens;
        foundry.canvas.layers.TokenLayer.prototype.cycleTokens = function (...args) {
            //if (MonksActiveTiles.preventCycle) {
            if(setting('prevent-cycle'))
                return null;
            else
                return oldCycleTokens.call(this, ...args);
        }

        let doorControl = async function (wrapped, ...args) {
            if (setting("allow-door-passthrough")) {
                await new Promise((resolve) => { resolve(); });
            }

            let triggerDoor = async function (wall) {
                if (wall && setting("allow-door")) {
                    //check if this is associated with a Tile
                    if (wall.flags["monks-active-tiles"]?.entity) {
                        if ((!!wall.flags["monks-active-tiles"][wall._wallchange || "checklock"]) ||
                            (wall.flags["monks-active-tiles"].open == undefined && wall.flags["monks-active-tiles"].close == undefined && wall.flags["monks-active-tiles"].lock == undefined && wall.flags["monks-active-tiles"].secret == undefined && wall.flags["monks-active-tiles"].checklock == undefined)) {

                            let entity = wall.flags['monks-active-tiles']?.entity;
                            if (typeof entity == "string")
                                entity = JSON.parse(entity || "{}");
                            if (entity.id) {
                                let walls = [wall];

                                let docs = [];
                                if (entity.id.startsWith("tagger")) {
                                    if (game.modules.get('tagger')?.active) {
                                        let tag = entity.id.substring(7);

                                        let options = {};
                                        if (!entity.match || entity.match == "any")
                                            options.matchAny = true;
                                        if (entity.match == "exact")
                                            options.matchExactly = true;

                                        if (entity.scene == "_all")
                                            options.allScenes = true;
                                        else if (entity.scene !== "_active" && entity.scene)
                                            options.sceneId = entity.scene;

                                        docs = Tagger.getByTag(tag, options);

                                        if (entity.scene == "_all")
                                            docs = [].concat(...Object.values(docs));
                                    }
                                } else if (entity.id == "within") {
                                    // Find the tile under this door
                                    for (let tile of wall.parent.tiles) {
                                        let triggerData = tile.flags["monks-active-tiles"] || {};
                                        let triggers = MonksActiveTiles.getTrigger(triggerData?.trigger);
                                        if (triggerData?.active && triggerData.actions?.length > 0 && triggers.includes("door")) {

                                            let pt1 = { x: wall.c[0], y: wall.c[1] };
                                            let pt2 = { x: wall.c[2], y: wall.c[3] };
                                            if (tile.pointWithin(pt1) || tile.pointWithin(pt2))
                                                docs.push(tile);
                                            else {
                                                let collisions = tile.getIntersections(pt1, pt2);
                                                if (collisions.length) {
                                                    docs.push(tile);
                                                }
                                            }
                                        }
                                    }
                                } else {
                                    let parts = entity.id.split(".");

                                    const [docName, docId] = parts.slice(0, 2);
                                    parts = parts.slice(2);
                                    const collection = CONFIG[docName].collection.instance;
                                    let entry = collection.get(docId);

                                    while (entry && (parts.length > 1)) {
                                        const [embeddedName, embeddedId] = parts.slice(0, 2);
                                        entry = entry.getEmbeddedDocument(embeddedName, embeddedId);
                                        parts = parts.slice(2);
                                    }

                                    docs = [entry];
                                }

                                if (docs.length) {
                                    docs = docs.sort((a, b) => {
                                        return a.z - b.z;
                                    });
                                    let results = {};
                                    for (let doc of docs) {
                                        if (!doc) continue;
                                        let triggerData = foundry.utils.getProperty(doc, "flags.monks-active-tiles");
                                        if (triggerData?.active) {
                                            if (setting("prevent-when-paused") && game.paused && !game.user.isGM && triggerData.allowpaused !== true)
                                                return;

                                            //check to see if this trigger is restricted by control type
                                            if ((triggerData.controlled == 'gm' && !game.user.isGM) || (triggerData.controlled == 'player' && game.user.isGM))
                                                return;

                                            let tokens = canvas.tokens.controlled.map(t => t.document);
                                            //check to see if this trigger is per token, and already triggered
                                            if (triggerData.pertoken) {
                                                tokens = tokens.filter(t => !doc.hasTriggered(t.id)); //.uuid
                                                if (tokens.length == 0)
                                                    return;
                                            }

                                            let result = await doc.trigger({ tokens: tokens, method: 'door', options: { value: { walls: walls }, change: wall._wallchange || "checklock" } }) || {};
                                            foundry.utils.mergeObject(results, result);
                                            if (result?.stoptriggers)
                                                break;
                                        }
                                    }
                                    return results;
                                }
                            }
                        }
                    }
                }
            }

            let result = wrapped(...args);
            if (result instanceof Promise) {
                return result.then((wall) => {
                    let w = wall || args[0]?.target?.wall?.document;
                    if (w && w instanceof WallDocument) {
                        triggerDoor(w);
                        delete w._wallchange;
                    }
                });
            } else {
                if (this.wall) {
                    triggerDoor(this.wall.document);
                    delete this.wall.document._wallchange;
                }
                return result;
            }
        }

        patchFunc("foundry.canvas.containers.DoorControl.prototype._onMouseDown", doorControl, "WRAPPER");
        //patchFunc("foundry.canvas.containers.DoorControl.prototype._onRightDown", doorControl, "WRAPPER");

        let playlistCollapse = function (wrapped, ...args) {
            let waitingType = MonksActiveTiles.waitingInput?.waitingfield?.data('type');
            if (waitingType == 'entity') {
                let event = args[0];
                const playlistId = $(event.currentTarget).closest('.playlist').data('documentId');
                const playlist = game.playlists.get(playlistId);
                if (playlist)
                    MonksActiveTiles.controlEntity(playlist);
            } else
                return wrapped(...args);
        }

        patchFunc("foundry.applications.sidebar.tabs.PlaylistDirectory.prototype._onClickEntry", playlistCollapse, "MIXED");

        let lastPosition = undefined;
        MonksActiveTiles.hoveredTiles = new Set();

        document.body.addEventListener("mousemove", function () {
            let mouse = canvas?.app?.renderer?.events?.pointer;
            if (!mouse) return;

            const currentPosition = mouse.getLocalPosition(canvas.app.stage);

            if (!lastPosition) {
                lastPosition = currentPosition;
                return;
            }

            if (!canvas.scene)
                return;

            if (!(canvas.activeLayer instanceof foundry.canvas.layers.TokenLayer))
                return;

            let hasPointer = $('#board').css('cursor') == "pointer";

            let entities = game.canvas.tokens.controlled;
            if (!entities.length && !game.user.isGM) {
                entities = game.canvas.tokens.placeables.filter(t => t.document.actorId == game.user.character?.id);
            }

            for (let tile of MonksActiveTiles.tileTriggerCache.hover) {
                let triggerData = tile.flags["monks-active-tiles"];
                let triggers = MonksActiveTiles.getTrigger(triggerData?.trigger);

                if (!triggerData || (!triggerData.active && !hasPointer) || !(triggers.includes("hoverin") || triggers.includes("hoverout") || triggerData.pointer))
                    continue;

                //check to see if this trigger is restricted by control type
                if ((triggerData.controlled === 'gm' && !game.user.isGM) || (triggerData.controlled === 'player' && game.user.isGM))
                    continue;

                let tokens = [];
                if (triggers.includes("hoverin") || triggers.includes("hoverout")) {
                    tokens = entities.map(t => t.document);
                    //check to see if this trigger is per token, and already triggered
                    if (triggerData.pertoken) {
                        tokens = tokens.filter(t => !tile.hasTriggered(t.id));
                        if (tokens.length === 0)
                            continue;
                    }

                    if (triggerData.usealpha && this._object && !this.object._texturePolygon)
                        this.object._findTextureBorder();
                }

                let lastPositionContainsTile = tile.pointWithin(lastPosition);
                let currentPositionContainsTile = tile.pointWithin(currentPosition);

                if (!lastPositionContainsTile && currentPositionContainsTile && !MonksActiveTiles.hoveredTiles.has(tile)) {
                    if (game.user.isGM || !canvas?.scene?.tokenVision || !triggerData.vision || (!tile.hidden && entities.some(t => {
                        return canvas.visibility.testVisibility({ x: tile.x, y: tile.y }, { tolerance: 1, object: t });
                    }))) {
                        MonksActiveTiles.hoveredTiles.add(tile);
                        if (triggerData.pointer) {
                            $('#board').css({ cursor: 'pointer' });
                        }
                        if (triggers.includes("hoverin")) {
                            if (setting("prevent-when-paused") && game.paused && !game.user.isGM && triggerData.allowpaused !== true)
                                continue;

                            tile.trigger({ tokens: tokens, method: 'hoverin', pt: currentPosition });
                        }
                    }
                }

                if (lastPositionContainsTile && !currentPositionContainsTile && MonksActiveTiles.hoveredTiles.has(tile)) {
                    MonksActiveTiles.hoveredTiles.delete(tile);
                    if (triggerData.pointer && MonksActiveTiles.hoveredTiles.size == 0)
                        $('#board').css({ cursor: '' });
                    if (triggers.includes("hoverout")) {
                        if (setting("prevent-when-paused") && game.paused && !game.user.isGM && triggerData.allowpaused !== true)
                            continue;
                        if (game.user.isGM || !canvas?.scene?.tokenVision || !triggerData.vision || (!tile.hidden && entities.some(t => {
                            return canvas.visibility.testVisibility({ x: tile.x, y: tile.y }, { tolerance: 1, object: t });
                        }))) {
                            tile.trigger({ tokens: tokens, method: 'hoverout', pt: currentPosition });
                        }
                    }
                }
            }

            lastPosition = currentPosition;
        });

        let _onSelectClick = function (wrapped, ...args) {
            let event = args[0];
            MonksActiveTiles.selectClick.call(this, event, 'click');
            return wrapped(...args);
        }

        let _onLeftClick = function (wrapped, ...args) {
            let event = args[0];
            MonksActiveTiles.canvasClick.call(this, event, 'click');
            wrapped(...args);
        }

        let _onRightClick = function (wrapped, ...args) {
            let event = args[0];
            if (!MonksActiveTiles.rightClickClicked)
                MonksActiveTiles.canvasClick.call(this, event, 'rightclick');
            wrapped(...args);
        }

        let _onLeftClick2 = function (wrapped, ...args) {
            let event = args[0];
            //if (setting("fix-click-issue"))
            //    MonksActiveTiles.canvasClick.call(this, event, 'click');
            MonksActiveTiles.canvasClick.call(this, event, 'dblclick');
            wrapped(...args);
        }
        let _onRightClick2 = function (wrapped, ...args) {
            let event = args[0];
            //if (setting("fix-click-issue"))
            //    MonksActiveTiles.canvasClick.call(this, event, 'rightclick');
            MonksActiveTiles.canvasClick.call(this, event, 'dblrightclick');
            wrapped(...args);
        }
        
        patchFunc("foundry.canvas.layers.TokenLayer.prototype._onClickLeft", _onLeftClick);
        patchFunc("foundry.canvas.layers.TokenLayer.prototype._onClickRight", _onRightClick);
        patchFunc("foundry.canvas.layers.TokenLayer.prototype._onClickLeft2", _onLeftClick2);
        patchFunc("foundry.canvas.layers.TokenLayer.prototype._onClickRight2", _onRightClick2);

        for (let layer of ["foundry.canvas.layers.TilesLayer", "foundry.canvas.layers.DrawingsLayer", "foundry.canvas.layers.WallsLayer", "foundry.canvas.layers.LightingLayer", "foundry.canvas.layers.SoundsLayer", "foundry.canvas.layers.RegionLayer", "foundry.canvas.layers.NotesLayer"]) {
            patchFunc(`${layer}.prototype._onClickLeft`, _onLeftClick, "MIXED");
        }

        patchFunc("foundry.canvas.layers.TilesLayer.prototype._deactivate", function (wrapper, ...args) {
            wrapper(...args);
            const showImageless = setting("show-imageless") && game.user.isGM;
            this.objects.visible = showImageless;
        })

        patchFunc("foundry.canvas.layers.TilesLayer.prototype._draw", async function (wrapper, ...args) {
            await wrapper(...args);
            const showImageless = setting("show-imageless") && game.user.isGM;
            this.objects.visible ||= showImageless;
        })

        let clickDocumentName = async function (wrapped, ...args) {
            let event = args[0];
            let waitingType = MonksActiveTiles.waitingInput?.waitingfield?.data('type');
            if (waitingType == 'entity') { //+++ need to make sure this is allowed, only create should be able to select templates
                event.preventDefault();
                const documentId = event.target.closest(".document").dataset.entryId;
                const document = this.collection.get(documentId);

                let restrict = MonksActiveTiles.waitingInput.waitingfield.data('restrict');
                let tileDocument = MonksActiveTiles.waitingInput.options.parent.options.document;
                if (restrict && !restrict(document, tileDocument))
                    return wrapped(...args);

                ActionConfig.updateSelection.call(MonksActiveTiles.waitingInput, { id: document.uuid, name: document.name }, event);
            } else
                wrapped(...args);
        }

        patchFunc("foundry.applications.sidebar.tabs.ActorDirectory.prototype._onClickEntry", clickDocumentName, "MIXED");
        patchFunc("foundry.applications.sidebar.tabs.ItemDirectory.prototype._onClickEntry", clickDocumentName, "MIXED");
        patchFunc("foundry.applications.sidebar.tabs.JournalDirectory.prototype._onClickEntry", clickDocumentName, "MIXED");
        patchFunc("foundry.applications.sidebar.tabs.SceneDirectory.prototype._onClickEntry", clickDocumentName, "MIXED");
        patchFunc("foundry.applications.sidebar.tabs.MacroDirectory.prototype._onClickEntry", clickDocumentName, "MIXED");
        patchFunc("foundry.applications.sidebar.tabs.RollTableDirectory.prototype._onClickEntry", clickDocumentName, "MIXED");

        let clickCompendiumEntry = async function (wrapped, ...args) {
            let event = args[0];
            if (MonksActiveTiles.waitingInput && MonksActiveTiles.waitingInput.waitingfield.data('type') == 'entity') { //+++ need to make sure this is allowed, only create should be able to select templates
                const documentId = event.target.closest(".document").dataset.entryId;
                const document = await this.collection.getDocument(documentId);
                let tileDocument = MonksActiveTiles.waitingInput.options.parent.options.document;
                let restrict = MonksActiveTiles.waitingInput.waitingfield.data('restrict');

                if (restrict && !restrict(document, tileDocument))
                    return wrapped(...args);

                ActionConfig.updateSelection.call(MonksActiveTiles.waitingInput, { id: document.uuid, name: document.name }, event);
            } else
                wrapped(...args);
        }

        patchFunc("foundry.helpers.interaction.ClientKeybindings.prototype._registerCoreKeybindings", function (wrapped, ...args) {
            let result = wrapped(...args);

            game.keybindings.actions.get("core.dismiss").onDown = async function (context) {
                // Cancel current drag workflow
                if (canvas.currentMouseManager) {
                    canvas.currentMouseManager.interactionData.cancelled = true;
                    canvas.currentMouseManager.cancel();
                    return true;
                }

                // Save fog of war if there are pending changes
                if (canvas.ready) canvas.fog.commit();

                // Case 1 - dismiss an open context menu
                if (ui.context?.element) {
                    await ui.context.close();
                    return true;
                }

                // Case 2 - dismiss an open Tour
                if (foundry.nue.Tour.tourInProgress) {
                    foundry.nue.Tour.activeTour.exit();
                    return true;
                }

                // Case 2.5 - dismiss an open ActionConfig
                if (MonksActiveTiles.waitingInput) {
                    ActionConfig.updateSelection.call(MonksActiveTiles.waitingInput, null);
                    return true;
                }

                // Case 3 - close open UI windows
                const closingApps = [];
                for (const app of Object.values(ui.windows)) {
                    closingApps.push(app.close({ closeKey: true }).then(() => !app.rendered));
                }
                for (const app of foundry.applications.instances.values()) {
                    if (app.hasFrame && !app.nonDismissible) closingApps.push(app.close({ closeKey: true }).then(() => !app.rendered));
                }
                const closedApp = (await Promise.all(closingApps)).some(c => c); // Confirm an application actually closed
                if (closedApp) return true;

                // Case 4 (GM) - release controlled objects (if not in a preview)
                if (game.view !== "game") return;
                const layer = canvas.activeLayer;
                if (layer instanceof foundry.canvas.layers.InteractionLayer) {
                    if (layer._onDismissKey(context.event)) return true;
                }

                // Case 5 - toggle the main menu
                ui.menu.toggle();
                // Save the fog immediately rather than waiting for the 3s debounced save as part of commitFog.
                if (canvas.ready) await canvas.fog.save();
                return true;
            }

            return result
        });

        patchFunc("foundry.applications.sidebar.apps.Compendium.prototype._onClickEntry", clickCompendiumEntry, "MIXED");

        let leftClick = async function (wrapped, ...args) {
            let event = args[0];
            MonksActiveTiles.controlEntity(this, event);
            return wrapped(...args);
        }

        if (game.modules.get("lib-wrapper")?.active) {
            libWrapper.register("monks-active-tiles", "foundry.canvas.placeables.AmbientLight.prototype._onClickLeft", leftClick, "WRAPPER");
        } else {
            const oldOnClickLeft = foundry.canvas.placeables.AmbientLight.prototype._onClickLeft;
            foundry.canvas.placeables.AmbientLight.prototype._onClickLeft = function (event) {
                return leftClick.call(this, oldOnClickLeft.bind(this), ...arguments);
            }
        }

        if (game.modules.get("lib-wrapper")?.active) {
            libWrapper.register("monks-active-tiles", "foundry.canvas.placeables.AmbientSound.prototype._onClickLeft", leftClick, "WRAPPER");
        } else {
            const oldOnClickLeft = foundry.canvas.placeables.AmbientSound.prototype._onClickLeft;
            foundry.canvas.placeables.AmbientSound.prototype._onClickLeft = function (event) {
                return leftClick.call(this, oldOnClickLeft.bind(this), ...arguments);
            }
        }

        if (game.modules.get("lib-wrapper")?.active) {
            libWrapper.register("monks-active-tiles", "foundry.canvas.placeables.MeasuredTemplate.prototype._onClickLeft", leftClick, "WRAPPER");
        } else {
            const oldOnClickLeft = foundry.canvas.placeables.MeasuredTemplate.prototype._onClickLeft;
            foundry.canvas.placeables.MeasuredTemplate.prototype._onClickLeft = function (event) {
                return leftClick.call(this, oldOnClickLeft.bind(this), ...arguments);
            }
        }

        if (game.modules.get("lib-wrapper")?.active) {
            libWrapper.register("monks-active-tiles", "foundry.canvas.placeables.Note.prototype._onClickLeft", leftClick, "WRAPPER");
        } else {
            const oldOnClickLeft = foundry.canvas.placeables.Note.prototype._onClickLeft;
            foundry.canvas.placeables.Note.prototype._onClickLeft = function (event) {
                return leftClick.call(this, oldOnClickLeft.bind(this), ...arguments);
            }
        }

        if (!game.modules.get("drag-ruler")?.active && !game.modules.get("libruler")?.active) {
            /*
            let clear = function (wrapped, ...args) {
                this.cancelMovement = false;
                wrapped(...args);
            }

            if (game.modules.get("lib-wrapper")?.active) {
                libWrapper.register("monks-active-tiles", "Ruler.prototype.clear", clear, "WRAPPER");
            } else {
                const oldClear = Ruler.prototype.clear;
                Ruler.prototype.clear = function (event) {
                    return clear.call(this, oldClear.bind(this));
                }
            }*/

            /*
            let moveToken = async function (wrapped, ...args) {
                //this.cancelMovement = false;
                let wasPaused = game.paused;
                if (wasPaused && !game.user.isGM) {
                    ui.notifications.warn("GAME.PausedWarning", { localize: true });
                    return false;
                }
                if (!this.visible || !this.destination) return false;
                const token = this._getMovementToken();
                if (!token) return false;

                // Determine offset relative to the Token top-left.
                // This is important so we can position the token relative to the ruler origin for non-1x1 tokens.
                const origin = canvas.grid.getTopLeft(this.waypoints[0].x, this.waypoints[0].y);
                const s2 = canvas.dimensions.size / 2;
                const dx = Math.round((token.x - origin[0]) / s2) * s2;
                const dy = Math.round((token.y - origin[1]) / s2) * s2;

                // Get the movement rays and check collision along each Ray
                // These rays are center-to-center for the purposes of collision checking
                let rays = this._getRaysFromWaypoints(this.waypoints, this.destination);
                let hasCollision = rays.some(r => canvas.walls.checkCollision(r));
                if (hasCollision) {
                    ui.notifications.error("ERROR.TokenCollide", { localize: true });
                    return false;
                }

                // Execute the movement path defined by each ray.
                this._state = Ruler.STATES.MOVING;
                let priorDest = undefined;
                for (let r of rays) {
                    // Break the movement if the game is paused
                    if (!wasPaused && game.paused) break;

                    // Break the movement if Token is no longer located at the prior destination (some other change override this)
                    if (priorDest && ((token.x !== priorDest.x) || (token.y !== priorDest.y))) break;

                    // Adjust the ray based on token size
                    const dest = canvas.grid.getTopLeft(r.B.x, r.B.y);
                    const path = new foundry.canvas.geometry.Ray({ x: token.x, y: token.y }, { x: dest[0] + dx, y: dest[1] + dy });

                    // Commit the movement and update the final resolved destination coordinates
                    let animate = true;
                    priorDest = foundry.utils.duplicate(path.B);
                    await token.document.update(path.B, { animate: animate });
                    path.B.x = token.x;
                    path.B.y = token.y;

                    //if the movement has been canceled then stop processing rays
                    //if (this.cancelMovement)
                    //    break;

                    // Update the path which may have changed during the update, and animate it
                    if (animate)
                        await token.animateMovement(path);
                }

                // Once all animations are complete we can clear the ruler
                this._endMeasurement();
            }

            if (game.modules.get("lib-wrapper")?.active) {
                libWrapper.register("monks-active-tiles", "Ruler.prototype._animateMovement", moveToken, "OVERRIDE");
            } else {
                const oldMoveToken = Ruler.prototype._animateMovement;
                Ruler.prototype._animateMovement = async function (event) {
                    return moveToken.call(this, oldMoveToken.bind(this));
                }
            }
            */
        }
    }

    static async _fixAllTiles(tiles, fn) {
        let scenes = tiles ? ["filler"] : game.scenes;
        for (let scene of scenes) {
            let _tiles = tiles || scene.tiles;
            for (let tile of _tiles) {
                let triggerData = tile.flags["monks-active-tiles"];
                if (triggerData && triggerData.actions?.length > 0) {
                    let actions = foundry.utils.duplicate(triggerData.actions);
                    let update = false;
                    for (let i = 0; i < actions.length; i++) {
                        let action = actions[i];
                        let result = await fn(action, triggerData);
                        update = update || result;
                    }

                    if (update) {
                        await tile.setFlag("monks-active-tiles", "actions", actions);
                    }
                }
            }
        }
    }

    static async fixTiles(tiles) {
        //find all tiles and check for actions that have the old format
        //openfql, execute(need to figure out if it's kandashi or tagger), setmovement, requestroll, filterrequest
        await MonksActiveTiles._fixAllTiles(tiles, function (action) {
            switch (action.action) {
                case "openfql":
                    action.action = "forien-quest-log.openfql";
                    return true;
                    break;
                case "setmovement":
                case "requestroll":
                case "filterrequest":
                    action.action = `monks-tokenbar.${action.action}`;
                    return true;
                    break;
                case "execute":
                    if (action.data.effect != undefined)
                        action.action = `kandashis-fluid-canvas.execute`;
                    else
                        action.action = `tagger.execute`;
                    return true;
                    break;
            }
        });
    }

    static async fixImageCycle(tiles) {
        //find all tiles and check for actions that have the old format
        //openfql, execute(need to figure out if it's kandashi or tagger), setmovement, requestroll, filterrequest
        MonksActiveTiles._fixAllTiles(tiles, async function (action, triggerData) {
            if (action.action == "imagecycle") {
                if (triggerData.files == undefined) {
                    await tile.setFlag("monks-active-tiles", "files", action.data.files);
                    await tile.setFlag("monks-active-tiles", "fileindex", action.data.imgat - 1);
                }
                if (i >= actions.length - 1 || actions[i + 1].action != "tileimage") {
                    actions.splice(i + 1, 0, {
                        id: makeid(),
                        action: "tileimage",
                        data: {
                            select: (action.data?.random === true ? "random" : "next"),
                            transition: (action.data?.slot === true ? "bump-down" : "fade")
                        }
                    });
                    return true;
                }
            } else if (action.action == "tileimage" && action.id == undefined) {
                action.id = makeid();
                return true;
            }
        });
    }

    static async fixVariableName(tiles) {
        MonksActiveTiles._fixAllTiles(tiles, async function (action) {
            if (action.action == "checkvalue") {
                action.action = "checkvariable";
                return true;
            } else if (action.action == "setvalue") {
                action.action = "setvariable";
                return true;
            }
        });
    }

    static async fixForPlayer(tiles) {
        MonksActiveTiles._fixAllTiles(tiles, async function (action) {
            if (action.action == "notification" || action.action == "preload") {
                if (action.data.showto == "all") {
                    action.data.showto = "everyone"
                    return true;
                }
            } else if (action.action == "showimage") {
                if (action.data.showfor == "all") {
                    action.data.showfor = "everyone"
                    return true;
                }
                if (action.data.showfor == "triggering") {
                    action.data.showfor = "trigger"
                    return true;
                }
            } else if (action.action == "playanimation") {
                if (action.data.animatefor == "all") {
                    action.data.animatefor = "everyone"
                    return true;
                }
            } else if (action.action == "pancanvas") {
                if (action.data.panfor == "all") {
                    action.data.panfor = "everyone"
                    return true;
                }
            } else if (action.action == "playsound" || action.action == "stopsound") {
                if (action.data.audiofor == "all") {
                    action.data.audiofor = "everyone"
                    return true;
                }
                if (action.data.audiofor == "token" || action.data.audiofor == "triggering") {
                    action.data.audiofor = "trigger"
                    return true;
                }
            } else if (action.action == "chatmessage") {
                action.data.showto = action.data.for || action.data.showto;
                delete action.data.for;
                if (action.data.showto == "all")
                    action.data.showto = "everyone"
                return true;
            } else if (action.action == "dialog") {
                action.data.showto = action.data.for || action.data.showto;
                delete action.data.for;
                return true;
            } else if (action.action == "closedialog") {
                if (action.data.for == "all") {
                    action.data.for = "everyone"
                    return true;
                }
            }
        });
    }

    static async fixForPlayerAgain(tiles) {
        MonksActiveTiles._fixAllTiles(tiles, async function (action) {
            if (action.action == "closedialog") {
                if (action.data.for == "all") {
                    action.data.for = "everyone"
                    return true;
                }
            }
        });
    }

    static async fixRollTable(tiles) {
        MonksActiveTiles._fixAllTiles(tiles, async function (action) {
            if (action.action == "rolltable") {
                if (action.data.rolltableid instanceof Array) {
                    action.data.rolltableid = action.data.rolltableid.length ? action.data.rolltableid[0] : null;
                    return true;
                }
                if (typeof action.data.rolltableid == "string") {
                    action.data.rolltableid = { id: action.data.rolltableid.startsWith("RollTable") ? action.data.rolltableid : `RollTable.${action.data.rolltableid}` };
                    return true;
                }
            }
        });
    }

    static async fixScenes(tiles) {
        MonksActiveTiles._fixAllTiles(tiles, async function (action) {
            if (action.action == "scene" || action.action == "scenebackground" || action.action == "preload") {
                if (action.data.sceneid instanceof Array) {
                    action.data.sceneid = action.data.sceneid.length ? action.data.sceneid[0] : null;
                    return true;
                }
                if (typeof action.data.sceneid == "string") {
                    let id = action.data.sceneid.startsWith("Scene") ? action.data.sceneid : `Scene.${action.data.sceneid}`;
                    if (id == "_active")
                        id = "scene";
                    else if (id == "_previous")
                        id = "previous";
                    else if (id == "_token")
                        id = "token";

                    action.data.sceneid = { id };
                    return true;
                }
            }
        });
    }

    static _createTileLink(match, { async = false, relativeTo } = {}) {
        let [command, options, name] = match.slice(1, 5);
        let [target, ...props] = options.split(' ');
        const data = {
            cls: ["tile-trigger-link"],
            icon: 'fas fa-cube',
            dataset: {},
            name: name
        };

        data.dataset = { uuid: target };
        let activeProp = (props || []).find(p => p.startsWith('active:'));
        if (activeProp)
            data.dataset.active = activeProp.replace('active:', '');
        let landingProp = (props || []).find(p => p.startsWith('landing:'));
        if (landingProp)
            data.dataset.landing = landingProp.replace('landing:', '');
        const constructAnchor = () => {
            const a = document.createElement("a");
            a.classList.add(...data.cls);
            a.draggable = true;
            for (let [k, v] of Object.entries(data.dataset)) {
                a.dataset[k] = v;
            }
            a.innerHTML = `<i class="${data.icon}"></i>${data.name}`;
            return a;
        };

        return constructAnchor()
    }

    static async _onClickTileLink(event) {
        event.preventDefault();
        const a = event.currentTarget;
        let uuid = a.dataset.uuid;

        if (!uuid.startsWith("Scene"))
            uuid = `Scene.${canvas.scene.id}.${!uuid.startsWith("Tile") ? "Tile." : ""}${uuid}`;

        let tile = await fromUuid(uuid);
        if (!tile && (a.dataset.uuid.length == 16 || a.dataset.uuid.length == 21)) {
            // Let's try and find this Tile
            let tileId = a.dataset.uuid;
            tileId = tileId.replace("Tile.", "");
            for(let scene of game.scenes) {
                tile = scene.tiles.contents.find(t => t.id == tileId);
                if (tile) {
                    console.warn(`Tile ${a.dataset.uuid} was found in Scene ${scene.name}, but please consider using the full uuid "${tile.uuid}" for the Tile instead`);
                    break;
                }
            }
        }
        if (tile && tile instanceof TileDocument) {
            let tokens = canvas.tokens.controlled.map(t => t.document);
            //check to see if this trigger is per token, and already triggered
            let triggerData = tile.flags["monks-active-tiles"];

            if (triggerData) {
                if (triggerData.pertoken)
                    tokens = tokens.filter(t => !tile.hasTriggered(t.id));

                if (a.dataset.active == "true" && !triggerData.active) return;

                let options = { journal: [this.object] }
                if (a.dataset.landing)
                    options.landing = a.dataset.landing;

                tile.trigger({ tokens: tokens, method: "trigger", options });
            }
        }
    }

    static registerTileGroup(namespace, name) {
        if (MonksActiveTiles.triggerGroups[namespace] != undefined) {
            warn(`Trigger Group ${namespace} already exists`);
            return;
        }

        MonksActiveTiles.triggerGroups[namespace] = { name: name };
        return true;
    }

    static registerTileAction(namespace, name, action) {
        let key = `${namespace}.${name}`;
        if (!game.modules.get(namespace)) {
            warn(`Registering module namespace, ${namespace} doesn't exist`);
            return;
        }

        if (MonksActiveTiles.triggerActions[key] != undefined) {
            warn(`Action ${key} already exists`);
            return;
        }

        if (action.group == undefined)
            action.group = namespace;

        if (MonksActiveTiles.triggerGroups[action.group] == undefined) {
            warn(`Trigger Group ${action.group} doesn't exist`);
            return;
        }

        MonksActiveTiles.triggerActions[key] = action;
        return true;
    }

    static async onMessage(data) {
        switch (data.action) {
            case 'runtriggers': {
                if (game.user.isTheGM) {
                    MonksActiveTiles.runTriggers(data.triggers, data.senderId);
                }
            } break;
            case 'cancelruler': {
                if (game.user.id == data.userId) {
                    let ruler = canvas.controls.getRulerForUser(game.user.id);
                    if (ruler) ruler.cancelMovement = true;
                }
            } break;
            case 'trigger': {
                if (game.user.isTheGM) {
                    let tokens = data.tokens;
                    for (let i = 0; i < tokens.length; i++)
                        tokens[i] = await fromUuid(tokens[i]);
                    let tile = await fromUuid(data.tileid);

                    if (data.options.walls) {
                        for (let i = 0; i < data.options.walls.length; i++)
                            data.options.walls[i] = await fromUuid(data.options.walls[i]);
                    }

                    if (data.options?.value?.walls) {
                        for (let i = 0; i < data.options.value.walls.length; i++)
                            data.options.value.walls[i] = await fromUuid(data.options.value.walls[i]);
                    }

                    tile.trigger({ tokens: tokens, userId: data.senderId, method: data.method, pt: data.pt, options: data.options });
                }
            } break;
            case 'switchview': {
                if (data.users.find(u => u == game.user.id) != undefined) {
                    //let oldSize = canvas.scene.dimensions.size;
                    //let oldPos = canvas.scene._viewPosition;
                    let offset = { dx: (canvas.scene._viewPosition.x - data.oldpos?.x), dy: (canvas.scene._viewPosition.y - data.oldpos?.y) };
                    let scene = game.scenes.get(data.sceneid);
                    if (!canvas.loading && canvas.scene.id != scene.id) {
                        let oldPing = game.user.permissions["PING_CANVAS"];
                        game.user.permissions["PING_CANVAS"] = false;

                        await scene.view();
                        if (data.oldpos && data.newpos) {
                            let changeTo = { x: data.newpos.x + offset.dx, y: data.newpos.y + offset.dy };
                            canvas.pan(changeTo);
                        }

                        window.setTimeout(() => {
                            if (oldPing == undefined)
                                delete game.user.permissions["PING_CANVAS"];
                            else
                                game.user.permissions["PING_CANVAS"] = oldPing;
                        }, 500);
                    } else if (data.oldpos && data.newpos) {
                        let changeTo = { x: data.newpos.x + offset.dx, y: data.newpos.y + offset.dy };
                        canvas.pan(changeTo);
                    }
                }
            } break;
            case 'runmacro': {
                if (game.user.id == data.userId) {
                    let macro;
                    try {
                        macro = await fromUuid(data.macroid);
                    } catch {
                        macro = game.macros.get(data.macroid);
                    }

                    let tile = (data?.tileid ? await fromUuid(data.tileid) : null);
                    let token = (data?.tokenid ? await fromUuid(data.tokenid) : null);
                    let tokens = data.tokens;
                    for (let i = 0; i < tokens.length; i++) {
                        tokens[i] = await fromUuid(tokens[i])
                    }

                    let user = game.users.get(data.userId);

                    let context = {
                        actor: token?.actor,
                        token: token,
                        character: user?.character,
                        tile: tile,
                        user: user,
                        args: data.args,
                        canvas: canvas,
                        scene: canvas.scene,
                        values: data.values,
                        value: data.value,
                        tokens: tokens,
                        method: data.method,
                        pt: data.pt,
                        actionId: data._id,
                        change: data.change
                    };

                    let results = (macro.type == 'script' ? MonksActiveTiles._execute.call(macro, context) : macro.execute(args));
                    /*
                        (game.modules.get("advanced-macros")?.active || game.modules.get("furnace")?.active ?
                        await (macro.type == 'script' ? macro.callScriptFunction(context) : macro.execute(data.args)) :
                        await MonksActiveTiles._execute.call(macro, context));
                        */
                    MonksActiveTiles.emit("returnmacro", { _id: data._id, tileid: data?.tileid, results: results });
                }
            } break;
            case 'returnmacro': {
                if (game.user.isGM) {
                    let tile = await fromUuid(data.tileid);
                    if (tile)
                        tile.resumeActions(data._id, data.results);
                }
            } break;
            case 'showdialog': {
                if (data.users.includes(game.user.id)) {
                    let tile = (data?.tileid ? await fromUuid(data.tileid) : null);
                    let token = (data?.tokenid ? await fromUuid(data.tokenid) : null);

                    let options = foundry.utils.mergeObject(data, {tile, token});

                    MonksActiveTiles._showDialog(options).then((results) => {
                        MonksActiveTiles.emit("returndialog", { _id: data._id, tileid: data?.tileid, results: results });
                    });
                }
            } break;
            case 'closedialog': {
                if (data.users.includes(game.user.id)) {
                    let dialog = MonksActiveTiles._dialogs[data.id];

                    if (dialog) {
                        if (data.trigger == "yes" || data.trigger == "no")
                            $(`.dialog-buttons .dialog-button.${data.trigger}`, dialog[0].element).click();
                        else
                            dialog.close();
                    }
                }
            } break;
            case 'returndialog': {
                if (game.user.isGM) {
                    let tile = await fromUuid(data.tileid);
                    if (tile)
                        tile.resumeActions(data._id, data.results);
                }
            } break;
            case 'playvideo': {
                if (data.users.includes(game.user.id)) {
                    let tile = await fromUuid(data.tileid);
                    if (tile) {
                        const el = tile._object?.sourceElement;
                        if (el?.tagName !== "VIDEO") return;

                        if (data.playaction == 'stop')
                            game.video.stop(el);
                        else if (data.playaction == 'pause')
                            el.pause();
                        else if (data.playaction == "reset")
                            el.currentTime = 0;
                        else {
                            if (data.offset)
                                el.currentTime = data.offset;
                            el.play();
                        }
                    }
                }
            } break;
            case 'playsound': {
                if (data.users.includes(game.user.id) && (data.sceneid == null || data.sceneid == canvas.scene.id)) {
                    let tile = await fromUuid(data.tileid);
                    if (tile) {
                        if (tile.soundeffect != undefined && tile.soundeffect[data.actionid] != undefined) {
                            if (tile.soundeffect[data.actionid].playing && data.prevent)
                                return;

                            try {
                                tile.soundeffect[data.actionid].stop();
                            } catch {}
                        }

                        let volume = Math.clamp(data.volume, 0, 1);

                        debug('Playing', data.src);
                        if (data.src) {
                            foundry.audio.AudioHelper.play({ src: data.src, volume: (data.fade > 0 ? 0 : volume), loop: data.loop }, false).then((sound) => {
                                if (data.fade > 0)
                                    sound.fade(volume * getVolume(), { duration: data.fade * 1000 });
                                if (tile.soundeffect == undefined)
                                    tile.soundeffect = {};
                                tile.soundeffect[data.actionid] = sound;
                                tile.soundeffect[data.actionid].addEventListener("end", () => {
                                    debug('Finished playing', data.src);
                                    delete tile.soundeffect[data.actionid];
                                });
                                tile.soundeffect[data.actionid].effectiveVolume = volume;
                            });
                        }
                    }
                }
            } break;
            case 'stopsound': {
                if (data.type == 'all') {
                    game.audio.playing.forEach((s) => s.stop());
                } else {
                    if (data.users?.includes(game.user.id)) {
                        let tile = await fromUuid(data.tileid);
                        if (tile) {
                            if (tile.soundeffect != undefined) {
                                if (data.actionid) {
                                    try {
                                        if (tile.soundeffect[data.actionid]) {
                                            tile.soundeffect[data.actionid].fade(0, { duration: data.fade * 1000 }).then((sound) => {
                                                sound?.stop();
                                                delete tile.soundeffect[data.actionid];
                                            });
                                        }
                                    } catch { }
                                    
                                } else {
                                    for (let [key, sound] of Object.entries(tile.soundeffect)) {
                                        try {
                                            sound.fade(0, { duration: data.fade * 1000 }).then((sound) => {
                                                sound.stop();
                                                delete tile.soundeffect[key]
                                            });
                                        } catch { }
                                    }
                                }
                            }
                        }
                    }
                }
            } break;
            case 'showimage': {
                if (data.users.includes(game.user.id)) {
                    new foundry.applications.apps.ImagePopout({
                        src: data.src,
                        window: {
                            title: data.title
                        }
                    }).render(true);
                }
            } break;
            case 'pan': {
                if (data.users.includes(game.user.id)) {
                    if (data.animate)
                        canvas.animatePan(data.dest);
                    else
                        canvas.pan(data.dest);
                }
            } break;
            case 'offsetpan': {
                if (data.userId == game.user.id) {
                    if (data.animatepan)
                        canvas.animatePan({ x: canvas.scene._viewPosition.x - data.x, y: canvas.scene._viewPosition.y - data.y });
                    else
                        canvas.pan({ x: canvas.scene._viewPosition.x - data.x, y: canvas.scene._viewPosition.y - data.y });
                }
            } break;
            case 'fade': {
                if (data.users.includes(game.user.id)) {
                    $('<div>').addClass('active-tile-backdrop').css({'background': data.colour || setting('teleport-colour')}).appendTo('body').animate({ opacity: 1 }, {
                        duration: (data.time || 400), easing: 'linear', complete: async function () {
                            $(this).animate({ opacity: 0 }, {
                                duration: (data.time || 400), easing: 'linear', complete: function () { $(this).remove(); }
                            });
                        }
                    });
                }
            } break;
            case 'journal': {
                if (data.users.find(u => u == game.user.id) != undefined) {
                    let entity = await fromUuid(data.entityid);
                    if (!entity)
                        return;

                    if (data.permission === true && (!entity.testUserPermission(game.user, "LIMITED") || (entity.parent && !entity.parent.testUserPermission(game.user, "LIMITED"))))
                        return ui.notifications.warn(`You do not have permission to view ${entity.name}.`);

                    let checkEntity = entity.parent || entity;
                    if (game.modules.get("monks-enhanced-journal")?.active && checkEntity instanceof JournalEntry && checkEntity.pages.size == 1 && !!foundry.utils.getProperty(checkEntity.pages.contents[0], "flags.monks-enhanced-journal.type")) {
                        let type = foundry.utils.getProperty(checkEntity.pages.contents[0], "flags.monks-enhanced-journal.type");
                        if (type == "base" || type == "oldentry") type = "journalentry";
                        let types = game.MonksEnhancedJournal.getDocumentTypes();
                        if (types[type]) {
                            entity = checkEntity.pages.contents[0];
                            game.MonksEnhancedJournal.fixType(entity);
                        }
                    }

                    if (data.asimage && !!entity.src) {
                        new foundry.applications.apps.ImagePopout({ src: entity.src }).render(true);
                    } else {
                        if (data.enhanced !== true || !game.modules.get("monks-enhanced-journal")?.active || !game.MonksEnhancedJournal.openJournalEntry(entity, { tempOwnership: !data.permission })) {
                            /*if (!data.permission && (!entity.testUserPermission(game.user, "OBSERVER") || (entity.parent && !entity.parent.testUserPermission(game.user, "OBSERVER")))) {
                                entity.ownership[game.user.id] = CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER;
                                if (entity.parent)
                                    entity.parent.ownership[game.user.id] = CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER;
                            }*/
                            entity.sheet.render(true, { pageId: data.page, anchor: data.subsection?.slugify().replace(/["']/g, "").substring(0, 64) });
                            /*if (!data.permission) {
                                if (entity._source.ownership[game.user.id] == undefined)
                                    delete entity.ownership[game.user.id];
                                else
                                    entity.ownership[game.user.id] = entity._source.ownership[game.user.id];
                                if (entity.parent) {
                                    if (entity.parent._source.ownership[game.user.id] == undefined)
                                        delete entity.parent.ownership[game.user.id];
                                    else
                                        entity.parent.ownership[game.user.id] = entity.parent._source.ownership[game.user.id];
                                }
                            }*/
                        }
                    }
                }
            } break;
            case 'actor': {
                if (data.users.find(u => u == game.user.id) != undefined) {
                    let entity = await fromUuid(data.entityid);
                    if (!entity)
                        return;

                    if (data.permission === true && !entity.testUserPermission(game.user, "LIMITED"))
                        return ui.notifications.warn(`You do not have permission to view ${entity.name}.`);

                    entity.sheet.render(true);
                }
            } break;
            case 'notification': {
                if (data.userId == undefined || data.userId == game.user.id) {
                    ui.notifications.notify(data.content, data.type);
                }
            } break;
            case 'fql': {
                if (data.users.includes(game.user.id)) {
                    if (data.quest) {
                        const fqlAPI = game.modules.get('forien-quest-log').public.QuestAPI;
                        fqlAPI.open({ questId: data.quest });
                    } else
                        Hooks.call('ForienQuestLog.Open.QuestLog');
                }
            } break;
            case 'party-inventory': {
                if (data.users.includes(game.user.id)) {
                    game.modules.get("party-inventory").api.openWindow();
                }
            } break;
            case 'target': {
                if (data.users.includes(game.user.id)) {
                    if(data.target == "target")
                        game.user._onUpdateTokenTargets(data.tokens);
                    else {
                        data.tokens.forEach(id => {
                            let token = canvas.tokens.get(id);
                            if (token)
                                token.setTarget(data.target !== "clear" && data.target !== "remove", { user: game.user, releaseOthers: false, groupSelection: false })
                        });
                    }
                }
            } break;
            case 'scrollingtext': {
                if (data.users.includes(game.user.id)) {
                    let token = await fromUuid(data.tokenid);
                    if (token) {
                        let t = token.object;
                        canvas.interface.createScrollingText(t.center, data.content, {
                            anchor: data.anchor,
                            direction: data.direction,
                            duration: data.duration,
                            distance: t.h,
                            fontSize: 28,
                            stroke: 0x000000,
                            strokeThickness: 4,
                            jitter: 0.25
                        });
                    }
                }
            } break;
            case 'preload': {
                if (data.users.includes(game.user.id)) {
                    game.scenes.preload(data.sceneid);
                }
            } break;
            case 'slotmachine': {
                if (!game.user.isGM) {
                    
                    if (data.cmd == "prep") {
                        let tile = await fromUuid(data.tileid);
                        tile._cycleimages = tile._cycleimages || {};
                        let files = tile._cycleimages[data.id];
                        if (files == undefined) {
                            let tileData = tile.flags["monks-active-tiles"];
                            let action = tileData.actions.find(a => a.id == data.id);
                            let actfiles = (action.data?.files || []);
                            files = tile._cycleimages[data.id] = await MonksActiveTiles.getTileFiles(actfiles);
                        }

                        for (let call of data.entities) {
                            let entity = await fromUuid(call.entityid);
                            if (entity) {
                                MonksActiveTiles._slotmachine[entity.id] = new Promise(async () => {
                                    let t = entity._object;

                                    const container = new PIXI.Container();
                                    t.addChild(container);
                                    container.width = entity.width;
                                    container.height = entity.height;

                                    //Set the image clip region
                                    const mask = new PIXI.Graphics();
                                    mask.beginFill(0xFFFFFF);
                                    mask.drawRect(0, 0, entity.width, entity.height);
                                    mask.endFill();
                                    container.addChild(mask);
                                    container.mask = mask;

                                    //load all the files
                                    let sprites = [];
                                    for (let f of files) {
                                        let tex = await foundry.canvas.loadTexture(f);
                                        sprites.push(new PIXI.Sprite(tex));
                                    }

                                    //add them to the tile
                                    for (let s of sprites) {
                                        s.y = entity.height;
                                        s.width = entity.width;
                                        s.height = entity.height;
                                        container.addChild(s);
                                    }

                                    //hide the actual image
                                    t.children[0].visible = false;

                                    MonksActiveTiles._slotmachine[entity.id] = { container, sprites, mask };
                                });
                            }
                        }
                    } else if (data.cmd == "animate") {
                        let entity = await fromUuid(data.entityid);
                        if (entity) {
                            let animateDetails = MonksActiveTiles._slotmachine[entity.id];

                            let resolve = () => {
                                let sprites = animateDetails.sprites;

                                let frames = [];
                                frames.push({ sprite: sprites[data.oldIdx], idx: data.oldIdx });
                                sprites[data.oldIdx].y = 0;

                                let duration = data.time - new Date().getTime();
                                if (duration < 0)
                                    return;

                                MonksActiveTiles._slotmachine[entity.id].animation = foundry.canvas.animation.CanvasAnimation._animatePromise(
                                    MonksActiveTiles.slotAnimate,
                                    entity._object,
                                    `slot-machine${entity.id}`,
                                    {
                                        tile: entity._object,
                                        frames: frames,
                                        sprites: sprites,
                                        idx: data.oldIdx,
                                        total: (sprites.length * data.spins) + (data.newIdx - data.oldIdx < 0 ? sprites.length + data.newIdx - data.oldIdx : data.newIdx - data.oldIdx) + 1
                                    },
                                    duration
                                )
                            }

                            if (animateDetails instanceof Promise) {
                                animateDetails.then(() => {
                                    resolve();
                                });
                            } else
                                resolve();
                        }
                    } else if (data.cmd == "cleanup") {
                        let entity = await fromUuid(data.entityid);
                        if (entity) {
                            let animateDetails = MonksActiveTiles._slotmachine[entity.id];
                            if (animateDetails.animate instanceof Promise) {
                                animateDetails.animate.then(() => {
                                    entity._object.removeChild(animateDetails.container);
                                    entity._object.children[0].visible = true;
                                })
                            } else {
                                entity._object.removeChild(animateDetails.container);
                                entity._object.children[0].visible = true;
                            }
                        }
                    }
                }
            } break;
            case 'transition':
                {
                    let entity = await fromUuid(data.entityid);
                    if (entity) {
                        let canView = game.user.isGM;
                        if (!canView) {
                            let token = canvas.tokens.controlled[0];
                            canView = !entity.hidden && entity.parent.id == canvas.scene.id && (!canvas.scene.tokenVision || (token && canvas.visibility.testVisibility({ x: token.x, y: token.y }, { tolerance: 1, object: entity })));
                        }
                        if (canView)
                            MonksActiveTiles.transitionImage(entity, data.transitionId, data.from, data.img, data.transition, data.time);
                    }
                } break;
            case 'transitionend':
                {
                    let entity = await fromUuid(data.entityid);
                    if (entity) {
                        let t = entity._object;

                        if (t?._transition_ready === false) {
                            let animationName = `MonksActiveTiles.${entity.documentName}.${entity.id}.animateTransitionImage`;
                            await foundry.canvas.animation.CanvasAnimation.terminateAnimation(animationName);
                            if (t?._transition) {
                                //log("Told to remove transition", t._transition_to);
                                canvas.primary.removeChild(t._transition);
                            }
                        } else if (entity._transition_resolve) {
                            entity._transition_resolve(entity._transition_to);
                        }
                    }
                } break;
            case 'move':
                {
                    let entity = await fromUuid(data.entityid);

                    if (entity)
                        MonksActiveTiles.moveEntity(entity, { x: data.x, y: data.y }, data.time);
                } break;
            case 'showhide': {
                let entity = await fromUuid(data.entityid);

                if (entity)
                    MonksActiveTiles.fadeImage(entity, data.hide, data.time);
            } break;
            case 'bubble': {
                if (data.users.includes(game.user.id)) {
                    let token = canvas.tokens.get(data.tokenId);
                    if (token) {
                        canvas.hud.bubbles.say(token, data.content);
                    }
                } 
            } break;
            case 'openurl': {
                if (data.userId == game.user.id) {
                    foundry.applications.api.DialogV2.confirm({
                        title: "Opening external link",
                        content: "<p>Are you sure you want to open an external link?</p><p>URL: " + data.url + "</p>",
                        yes: {
                            callback: () => {
                                window.open(data.url, "_target");
                            }
                        }
                    });
                }
            } break;
            case 'additem': {
                if (data.userId == game.user.id) {
                    let actor = game.actors.get(data.actorid);
                    if (actor) {
                        let sheet = actor.sheet;
                        if (sheet) {
                            sheet._onDropItem({ preventDefault: () => { }, target: { closest: () => { return false; } } }, { type: "Item", uuid: data.uuid, data: data.item });
                        }
                    }
                }
            } break;
            case 'tempimage': {
                if (data.users.includes(game.user.id)) {
                    let entity = await fromUuid(data.entityid);
                    if (!entity)
                        return;

                    MonksActiveTiles.temporaryTileImage(entity, data.img);
                }
            } break;
            case 'preloadtileimages': {
                let entity = await fromUuid(data.entityId);
                if (!entity)
                    return;

                let t = entity._object;
                if (!t) return;

                t._textures = t._textures || {};

                if (entity._images == undefined) {
                    entity._images = await MonksActiveTiles.getTileFiles(foundry.utils.getProperty(entity, "flags.monks-active-tiles.files") || []);
                }

                for (let img of entity._images) {
                    let tex;
                    if (!t._textures[img]) {
                        try {
                            tex = await foundry.canvas.loadTexture(img);
                        } catch { }
                        if (!tex) {
                            console.warn(`Preload texture invalid, ${img}`);
                            tex = await foundry.canvas.loadTexture("/modules/monks-active-tiles/img/1x1.png");
                        } else
                            t._textures[img] = tex;
                    }
                }
            } break;
            case 'ping': {
                if (data.users.includes(game.user.id)) {
                    canvas.ping(data.location, { style: data.style });
                }
            } break;
            case 'globalvolume': {
                if (data.users.includes(game.user.id)) {
                    $(`#global-volume input[name="${data.volumetype}"]`).val(data.volume).change();
                }
            } break;
        }
    }

    static async checkClick(pt, clicktype = "click", event) {
        let tiles = MonksActiveTiles.tileTriggerCache.click.map((tile) => {
            return tile.checkClick(pt, clicktype, event);
        }).filter(t => !!t)
            .sort((a, b) => {
                return (b.tile.sort ?? b.tile.z) - (a.tile.sort ?? a.tile.z);
            });
        for (let t of tiles) {
            let triggerResult = await t.tile.trigger(t.args);
            if (triggerResult?.stoptriggers)
                break;
        }
    }

    static controlEntity(entity, event) {
        let waitingType = MonksActiveTiles.waitingInput?.waitingfield?.data('type');
        if (waitingType == 'entity' || waitingType == 'either' || waitingType == 'position') {
            let waitingInput = MonksActiveTiles.waitingInput;
            let waitingField = MonksActiveTiles.waitingInput.waitingfield;
            let restrict = waitingField.data('restrict');
            if (restrict && !restrict(entity)) {
                ui.notifications.error(i18n("MonksActiveTiles.msg.invalid-entity"));
                return;
            }
            if(entity.document)
                ActionConfig.updateSelection.call(waitingInput, { id: entity.document.uuid, name: entity.document.name || (entity.document.documentName + ": " + entity.document.id) }, event);
            else
                ActionConfig.updateSelection.call(waitingInput, { id: entity.uuid, name: (entity?.parent?.name ? entity.parent.name + ": " : "") + entity.name }, event);
        }
    }

    static selectPlaylistSound(evt) {
        const playlistId = $(evt.currentTarget).data('playlistId');
        const soundId = $(evt.currentTarget).data('soundId');

        const sound = game.playlists.get(playlistId)?.sounds?.get(soundId);
        if (sound)
            MonksActiveTiles.controlEntity(sound, evt);
    }

    static getTileSegments(tile, usealpha = false) {
        let width = Math.abs(tile.width);
        let height = Math.abs(tile.height);

        let segments = [
            { a: { x: 0, y: 0 }, b: { x: width, y: 0 } },
            { a: { x: width, y: 0 }, b: { x: width, y: height } },
            { a: { x: width, y: height }, b: { x: 0, y: height } },
            { a: { x: 0, y: height }, b: { x: 0, y: 0 } }
        ];

        if (usealpha) {
            segments = [];
            for (let i = 0; i < tile.object._textureBorderPoints.length - 2; i += 2) {
                segments.push({ a: { x: tile.object._textureBorderPoints[i], y: tile.object._textureBorderPoints[i + 1] }, b: { x: tile.object._textureBorderPoints[i + 2], y: tile.object._textureBorderPoints[i + 3] } });
            }
            segments.push({ a: { x: tile.object._textureBorderPoints[tile.object._textureBorderPoints.length - 2], y: tile.object._textureBorderPoints[tile.object._textureBorderPoints.length - 1] }, b: { x: tile.object._textureBorderPoints[0], y: tile.object._textureBorderPoints[1] } })
        } 

        /*
        if (tile.rotation != 0) {
            function rotate(cx, cy, x, y, angle) {
                var realangle = angle + 90,
                    rad = Math.toRadians(realangle),
                    sin = Math.cos(rad),
                    cos = Math.sin(rad),
                    run = x - cx,
                    rise = y - cy,
                    tx = (cos * run) + (sin * rise) + cx,
                    ty = (cos * rise) - (sin * run) + cy;
                return { x: tx, y: ty };
            }

            const cX = tile.x + (Math.abs(tile.width) / 2);
            const cY = tile.y + (Math.abs(tile.height) / 2);

            let pt1 = rotate(cX, cY, tileX1, tileY1, tile.rotation);
            let pt2 = rotate(cX, cY, tileX2, tileY1, tile.rotation);
            let pt3 = rotate(cX, cY, tileX2, tileY2, tile.rotation);
            let pt4 = rotate(cX, cY, tileX1, tileY2, tile.rotation);
            */
            /*
            let gr = MonksActiveTiles.debugGr;
            if (!gr) {
                gr = new PIXI.Graphics();
                MonksActiveTiles.debugGr = gr;
                canvas.tokens.addChild(gr);
            }

            gr.beginFill(0x00ffff)
                .drawCircle(tileX1, tileY1, 4)
                .drawCircle(tileX2, tileY1, 6)
                .drawCircle(tileX2, tileY2, 8)
                .drawCircle(tileX1, tileY2, 10)
                .endFill();

            gr.beginFill(0xffff00)
                .drawCircle(pt1.x, pt1.y, 4)
                .drawCircle(pt2.x, pt2.y, 6)
                .drawCircle(pt3.x, pt3.y, 8)
                .drawCircle(pt4.x, pt4.y, 10)
                .endFill();
                */
        /*
            segments = [
                { a: pt1, b: pt2 },
                { a: pt2, b: pt3 },
                { a: pt3, b: pt4 },
                { a: pt4, b: pt1 }
            ];
        }*/

        return segments;
    }

    static setupTile() {
        TileDocument.prototype.pointWithin = function (point) {
            let triggerData = this.flags["monks-active-tiles"];

            const cX = (Math.abs(this.width) / 2);
            const cY = (Math.abs(this.height) / 2);

            // normalise the point to center, scale, normalise to the origin, then rotate
            /*
            let pt = {
                x: ((point.x - (this.x - ((this.texture.scaleX - 1) * (this.width / 2)))) / this.texture.scaleX),
                y: ((point.y - (this.y - ((this.texture.scaleY - 1) * (this.height / 2)))) / this.texture.scaleY)
            };
            */
            let pt = {
                x: (point.x - (this.x + cX)),
                y: (point.y - (this.y + cY))
            };

            if (this.rotation != 0) {
                //rotate the point
                function rotate(cx, cy, x, y, angle) {
                    var rad = Math.toRadians(angle),
                        cos = Math.cos(rad),
                        sin = Math.sin(rad),
                        run = x - cx,
                        rise = y - cy,
                        tx = (cos * run) + (sin * rise) + cx,
                        ty = (cos * rise) - (sin * run) + cy;
                    return { x: tx, y: ty };
                }

                pt = rotate(0, 0, pt.x, pt.y, this.rotation);
            }

            let scaleX = triggerData?.usealpha ? this.texture.scaleX : 1;
            let scaleY = triggerData?.usealpha ? this.texture.scaleY : 1;
            pt.x = (pt.x / scaleX) + cX;
            pt.y = (pt.y / scaleY) + cY;

            if (triggerData?.usealpha && this._object && !this._object._texturePolygon)
                this.object._findTextureBorder();
            /*
            let gr = MonksActiveTiles.debugGr;
            if (!gr) {
                gr = new PIXI.Graphics();
                MonksActiveTiles.debugGr = gr;
                canvas.tokens.addChild(gr);
            }

            gr.lineStyle(2, 0x800080).drawCircle(pt.x + this.x, pt.y + this.y, 4);
            */

            if (pt.x < 0 ||
                pt.x > Math.abs(this.width) ||
                pt.y < 0 ||
                pt.y > Math.abs(this.height))
                return false;

            return triggerData?.usealpha && this._object?._texturePolygon ? this._object?._texturePolygon.contains(pt.x, pt.y) : true;
        }

        TileDocument.prototype.tokensWithin = function () {
            console.warn("tokensWithin is deprecated and will be remove in later version.  Please use entitiesWithin instead");
            return this.entitiesWithin();
        }
        TileDocument.prototype.entitiesWithin = function ({ collection = "tokens", useTriggerPt = true }) {
            return this.parent[collection]?.filter(t => {
                if (t.id == this.id) return false;

                let midEntity;
                if (useTriggerPt)
                    midEntity = foundry.utils.getProperty(t, "flags.monks-active-tiles.triggerPt");
                if (midEntity == undefined) {
                    midEntity = { x: t.x, y: t.y };
                    if (t instanceof TokenDocument) {
                        midEntity.x = midEntity.x + ((Math.abs(t.width || 1) * t.parent.dimensions.size) / 2);
                        midEntity.y = midEntity.y + ((Math.abs(t.height || 1) * t.parent.dimensions.size) / 2);
                    } else if (!(t instanceof AmbientSoundDocument || t instanceof AmbientLightDocument)) {
                        midEntity.x = midEntity.x + (Math.abs(t.width || 1) / 2);
                        midEntity.y = midEntity.y + (Math.abs(t.height || 1) / 2);
                    }
                };

                if (game.modules.get("levels")?.active && collection == "tokens") {
                    let tileht = this.flags.levels?.rangeTop ?? 1000;
                    let tilehb = this.flags.levels?.rangeBottom ?? -1000;
                    if (t.elevation >= tilehb && t.elevation <= tileht)
                        return this.pointWithin(midEntity);
                } else
                    return this.pointWithin(midEntity);
            });
        }

        foundry.canvas.placeables.Tile.prototype._findTextureBorder_old = function () {
            let findPoint = function (pixels, start) {
                let pt;
                let dest = { x: width - start.x, y: height - start.y };

                //gr.lineStyle(1, 0x00ff00).moveTo(this.x + (start.x * aW), this.y + (start.y * aH)).lineTo(this.x + (dest.x * aW), this.y + (dest.y * aH));

                let hypot = Math.hypot((dest.x - start.x), (dest.y - start.y));
                let dX = (dest.x - start.x) / hypot;
                let dY = (dest.y - start.y) / hypot;

                for (let i = 0; i < hypot; i++) {
                    let check = { x: parseInt(start.x + (dX * i)), y: parseInt(start.y + (dY * i)) };
                    //gr.beginFill(0x00ff00).drawCircle(this.x + (check.x * aW), this.y + (check.y * aH), 1).endFill();
                    if (!pt || check.x != pt.x || check.y != pt.y) {
                        let idx = ((check.y * width) + check.x) * 4;
                        if (pixels[idx + 3] != 0) {
                            //gr.lineStyle(1, 0x00ff00).moveTo(this.x + (start.x * aW), this.y + (start.y * aH)).lineTo(this.x + (check.x * aW), this.y + (check.y * aH));

                            return check;
                        }
                        pt = check;
                    }
                }
            }

            let addPoint = function (pt) {
                if (pt) {
                    const last = points.slice(-2);
                    const next = [pt.x * aW, pt.y * aH];
                    if (next.equals(last)) return;

                    points = points.concat(next);
                }
            }

            let simplify = function(points, tolerance = 20) {
                if (points.length <= 2) return points;

                let getSqSegDist = function (p, p1, p2) {

                    var x = p1.x,
                        y = p1.y,
                        dx = p2.x - x,
                        dy = p2.y - y;

                    if (dx !== 0 || dy !== 0) {

                        var t = ((p.x - x) * dx + (p.y - y) * dy) / (dx * dx + dy * dy);

                        if (t > 1) {
                            x = p2.x;
                            y = p2.y;

                        } else if (t > 0) {
                            x += dx * t;
                            y += dy * t;
                        }
                    }

                    dx = p.x - x;
                    dy = p.y - y;

                    return dx * dx + dy * dy;
                }

                let simplifyDPStep = function (points, first, last, sqTolerance, simplified) {
                    var maxSqDist = sqTolerance,
                        index;

                    for (var i = first + 1; i < last; i++) {
                        var sqDist = getSqSegDist(
                            { x: points[i * 2], y: points[(i * 2) + 1] },
                            { x: points[first * 2], y: points[(first * 2) + 1] },
                            { x: points[last * 2], y: points[(last * 2) + 1] });

                        if (sqDist > maxSqDist) {
                            index = i;
                            maxSqDist = sqDist;
                        }
                    }

                    if (maxSqDist > sqTolerance) {
                        if (index - first > 1) simplifyDPStep(points, first, index, sqTolerance, simplified);
                        simplified.push(points[index * 2], points[(index * 2) + 1]);
                        if (last - index > 1) simplifyDPStep(points, index, last, sqTolerance, simplified);
                    }
                }

                var last = (points.length / 2) - 1;

                var simplified = points.slice(0, 2);
                simplifyDPStep(points, 0, last, tolerance, simplified);
                simplified.concat(points.slice(-2));

                return simplified;
            }

            const accuracy = 2;
            let width, height, aW, aH;

            let points = [];
            if (this.texture == null) {
                points = [0, 0, this.document.width, 0, this.document.width, this.document.height, 0, this.document.height, 0, 0];
            } else {
                const sprite = new PIXI.Sprite(this.texture);
                sprite.width = width = parseInt(this.texture.baseTexture.realWidth / accuracy);
                sprite.height = height = parseInt(this.texture.baseTexture.realHeight / accuracy);
                sprite.anchor.set(0.5, 0.5);
                sprite.position.set(sprite.width / 2, sprite.height / 2);

                aW = this.document.width / width;
                aH = this.document.height / height;

                // Create or update the alphaMap render texture
                const tex = PIXI.RenderTexture.create({ width: sprite.width, height: sprite.height });

                // Render the sprite to the texture and extract its pixels
                // Destroy sprite and texture when they are no longer needed
                canvas.app.renderer.render(sprite, { renderTexture: tex });
                sprite.destroy(false);
                const pixels = canvas.app.renderer.extract.pixels(tex);
                tex.destroy(true);

                for (let i = 0; i < width; i++) {
                    addPoint.call(this, findPoint.call(this, pixels, { x: i, y: 0 }));
                }
                for (let i = 0; i < height; i++) {
                    addPoint.call(this, findPoint.call(this, pixels, { x: width - 1, y: i }));
                }
                for (let i = width - 1; i > 0; i--) {
                    addPoint.call(this, findPoint.call(this, pixels, { x: i, y: height - 1 }));
                }
                for (let i = height - 1; i > 0; i--) {
                    addPoint.call(this, findPoint.call(this, pixels, { x: 0, y: i }));
                }

                points = simplify(points, 40);
                //points = points.concat(points.slice(0, 2));

                /*
                for (let i = 0; i < width; i++) {
                    for (let j = 0; j < height; j++) {
                        let idx = ((j * width) + i) * 4;
                        if (pixels[idx + 3] != 0) {
                            gr.beginFill(0x0000ff).drawCircle(this.x + (i * aW), this.y + (j * aH), 1).endFill();
                        }
                    }
                }
                */
            }

            this._textureBorderPoints = points;
            this._texturePolygon = new PIXI.Polygon(this._textureBorderPoints);
            if (CONFIG.debug.tiletriggers) {
                if (this._debugBorder)
                    this._debugBorder.destroy();
                this._debugBorder = this.addChild(new PIXI.Graphics());
                this._debugBorder.lineStyle(2, 0xff0000).drawPolygon(this._texturePolygon);
            }

            /*
            let gr = MonksActiveTiles.debugGr;
            if (!gr) {
                gr = new PIXI.Graphics();
                MonksActiveTiles.debugGr = gr;
                canvas.tokens.addChild(gr);
                gr.x = this.x;
                gr.y = this.y;
                gr.lineStyle(2, 0xff0000).drawPolygon(this._textureBorderPoints);
            }
            */
        }

        foundry.canvas.placeables.Tile.prototype._findTextureBorder = function () {
            let findStart = function (pixels) {
                let point;
                let x = 0;
                while (!point && x < width) {
                    point = findPoint(pixels, { x: x, y: 0 }, { value: 'y', adjust: 1, max: height - 1 });
                    x++;
                }

                return point;
            }

            let addPoints = function (pixels, start, delta, last, depth = 0) {
                //log("Add Points", start, delta, last);
                let lastPt = { x: last.x, y: last.y };
                let check;
                let checkDelta = rotateDelta(delta);
                for (let i = start[delta.value]; delta.adjust > 0 ? i < delta.max : i > delta.max; i += delta.adjust) {
                    check = { x: start.x, y: start.y };
                    check[delta.value] = i;
                    // y+ switches to -, x- switches to +
                    let point = findPoint(pixels, check, checkDelta);
                    if (point) {
                        //gr.lineStyle(1, 0x00ff00).moveTo(this.x + (check.x * aW), this.y + (check.y * aH)).lineTo(this.x + (point.x * aW), this.y + (point.y * aH));
                        let diff = lastPt[checkDelta.value] - point[checkDelta.value];
                        //log("At Point", point);
                        if (depth < 2 && lastPt && Math.abs(diff) > 10) {
                            // this line is suspect, let's try and fill in the gaps
                            let altVal = delta.value == "x" ? "y" : "x";
                            let dir = (diff > 0 && checkDelta.adjust > 0) || (diff < 0 && checkDelta.adjust < 0) ? "left" : "right";
                            let suspectDelta = rotateDelta(delta, { direction: dir, max: point[altVal] });
                            //log("Suspect", dir, lastPt, suspectDelta, point);
                            let susEnd = addPoints.call(this, pixels, lastPt, suspectDelta, point, depth + 1);
                            //log("At Point Sus", susEnd, lastPt, point);

                            diff = point[delta.value] - susEnd[delta.value];
                            if (Math.abs(diff) > 10) {
                                // this line is suspect, let's try and fill in the gaps
                                let dir = (diff > 0 && checkDelta.adjust > 0) || (diff < 0 && checkDelta.adjust < 0) ? "left" : "right";
                                let suspectDelta = rotateDelta(delta, { direction: dir, max: point[delta.value == "x" ? "y" : "x"] });
                                //log("Suspect 2", dir, susEnd, suspectDelta, point);
                                point = addPoints.call(this, pixels, susEnd, suspectDelta, point, depth + 1);
                            } else
                                point = susEnd;
                        }
                        //gr.beginFill(0x00ffff).drawCircle(this.x + (point.x * aW), this.y + (point.y * aH), 2).endFill();
                        points.push(point.x * aW, point.y * aH);
                        lastPt = point;
                    } else
                        return lastPt;
                }
                return lastPt;
            }

            let findPoint = function (pixels, start, delta) {
                let check;
                
                for (let i = start[delta.value]; delta.adjust > 0 ? i < delta.max : i > delta.max; i += delta.adjust) {
                    check = { x: start.x, y: start.y };
                    check[delta.value] = i;
                    let idx = ((check.y * width) + check.x) * 4;
                    if (pixels[idx + 3] != 0) {
                        return check;
                    }
                }
            }

            let rotateDelta = function (delta, { direction = "right", max } = {}) {
                let value = delta.value == "x" ? "y" : "x";
                let adjust = (delta.value == "y" ? (direction == "right" ? delta.adjust * -1 : delta.adjust) : (direction == "right" ? delta.adjust : delta.adjust * -1));
                max = max ?? (adjust == -1 ? 0 : (value == "x" ? width - 1 : height - 1));
                return { value, adjust, max };
            }

            let simplify = function (points, tolerance = 20) {
                if (points.length <= 2) return points;

                let getSqSegDist = function (p, p1, p2) {

                    var x = p1.x,
                        y = p1.y,
                        dx = p2.x - x,
                        dy = p2.y - y;

                    if (dx !== 0 || dy !== 0) {

                        var t = ((p.x - x) * dx + (p.y - y) * dy) / (dx * dx + dy * dy);

                        if (t > 1) {
                            x = p2.x;
                            y = p2.y;

                        } else if (t > 0) {
                            x += dx * t;
                            y += dy * t;
                        }
                    }

                    dx = p.x - x;
                    dy = p.y - y;

                    return dx * dx + dy * dy;
                }

                let simplifyDPStep = function (points, first, last, sqTolerance, simplified) {
                    var maxSqDist = sqTolerance,
                        index;

                    for (var i = first + 1; i < last; i++) {
                        var sqDist = getSqSegDist(
                            { x: points[i * 2], y: points[(i * 2) + 1] },
                            { x: points[first * 2], y: points[(first * 2) + 1] },
                            { x: points[last * 2], y: points[(last * 2) + 1] });

                        if (sqDist > maxSqDist) {
                            index = i;
                            maxSqDist = sqDist;
                        }
                    }

                    if (maxSqDist > sqTolerance) {
                        if (index - first > 1) simplifyDPStep(points, first, index, sqTolerance, simplified);
                        simplified.push(points[index * 2], points[(index * 2) + 1]);
                        if (last - index > 1) simplifyDPStep(points, index, last, sqTolerance, simplified);
                    }
                }

                var last = (points.length / 2) - 1;

                var simplified = points.slice(0, 2);
                simplifyDPStep(points, 0, last, tolerance, simplified);
                simplified.concat(points.slice(-2));

                return simplified;
            }

            const accuracy = 2;
            let width, height, aW, aH;

            /*
            let gr = MonksActiveTiles.debugGr;
            if (!gr) {
                gr = new PIXI.Graphics();
                MonksActiveTiles.debugGr = gr;
                canvas.tokens.addChild(gr);
            }
            */

            let points = [];
            if (this.texture == null) {
                points = [0, 0, this.document.width, 0, this.document.width, this.document.height, 0, this.document.height, 0, 0];
            } else {
                const sprite = new PIXI.Sprite(this.texture);
                sprite.width = width = parseInt(this.texture.baseTexture.realWidth / accuracy);
                sprite.height = height = parseInt(this.texture.baseTexture.realHeight / accuracy);
                sprite.anchor.set(0.5, 0.5);
                sprite.position.set(sprite.width / 2, sprite.height / 2);

                aW = this.document.width / width;
                aH = this.document.height / height;

                // Create or update the alphaMap render texture
                const tex = PIXI.RenderTexture.create({ width: sprite.width, height: sprite.height });

                // Render the sprite to the texture and extract its pixels
                // Destroy sprite and texture when they are no longer needed
                canvas.app.renderer.render(sprite, { renderTexture: tex });
                sprite.destroy(false);
                const pixels = canvas.app.renderer.extract.pixels(tex);
                tex.destroy(true);

                // Find the starting point
                // Work along the top until the line reaches the other side
                // Start at the last point, and work down

                let start, point, lastPt;
                start = lastPt = point = findStart.call(this, pixels);
                if (!start) {
                    points = [0, 0, this.document.width, 0, this.document.width, this.document.height, 0, this.document.height, 0, 0];
                } else {
                    //gr.beginFill(0x0000ff).drawCircle(this.x + (start.x * aW), this.y + (start.y * aH), 4).endFill();
                    let delta = { value: "x", adjust: 1, max: width };
                    for (let i = 0; i < 4; i++) {
                        let from = { x: i % 2 == 0 ? lastPt.x : i == 1 ? width - 1 : 0, y: i % 2 == 0 ? i == 2 ? height - 1 : 0 : lastPt.y };
                        point = addPoints.call(this, pixels, from, delta, lastPt);
                        lastPt = point || lastPt;
                        //gr.beginFill(0x00ffff).drawCircle(this.x + (lastPt.x * aW), this.y + (lastPt.y * aH), 4).endFill();
                        delta = rotateDelta(delta, { max: (i == 2 ? start.y : null) });
                        //log("Last Point", lastPt, delta);
                    }

                    points = simplify(points, 40);
                    //points = points.concat(points.slice(0, 2));

                    /*
                    for (let i = 0; i < width; i++) {
                        for (let j = 0; j < height; j++) {
                            let idx = ((j * width) + i) * 4;
                            if (pixels[idx + 3] != 0) {
                                gr.beginFill(0x0000ff).drawCircle(this.x + (i * aW), this.y + (j * aH), 1).endFill();
                            }
                        }
                    }
                    */
                }
            }

            this._textureBorderPoints = points;
            this._texturePolygon = new PIXI.Polygon(this._textureBorderPoints);
            if (CONFIG.debug.tiletriggers) {
                if (this._debugBorder && this._debugBorder.parent)
                    this._debugBorder.destroy();
                this._debugBorder = this.addChild(new PIXI.Graphics());
                this._debugBorder.lineStyle(2, 0xff0000).drawPolygon(this._texturePolygon);
            }
        }

        TileDocument.prototype.checkClick = function (pt, clicktype = 'click', event) {
            let entities = game.canvas.tokens.controlled;
            if (!entities.length && !game.user.isGM) {
                entities = game.canvas.tokens.placeables.filter(t => t.document.actorId == game.user.character?.id);
            }

            let triggerData = this.flags["monks-active-tiles"];
            let triggers = MonksActiveTiles.getTrigger(triggerData?.trigger);
            
            if (triggerData?.active && triggers.includes(clicktype)) {
                //prevent triggering when game is paused
                if (setting("prevent-when-paused") && game.paused && !game.user.isGM && triggerData.allowpaused !== true)
                    return;

                //check to see if this trigger is restricted by control type
                if ((triggerData.controlled == 'gm' && !game.user.isGM) || (triggerData.controlled == 'player' && game.user.isGM))
                    return;

                let tokens = entities.map(t => t.document);
                if (!tokens.length && MonksActiveTiles._selectedTokens?.tokens)
                    tokens = MonksActiveTiles._selectedTokens.tokens;
                //check to see if this trigger is per token, and already triggered
                if (triggerData.pertoken) {
                    tokens = tokens.filter(t => !this.hasTriggered(t.id)); //.uuid
                    if (tokens.length == 0)
                        return;
                }

                if (triggerData.usealpha && !this.object._texturePolygon)
                    this.object._findTextureBorder();
                if (CONFIG.debug.tiletriggers && triggerData.usealpha) {
                    if (this.object._debugBorder)
                        this.object._debugBorder.destroy();
                    this.object._debugBorder = this.object.addChild(new PIXI.Graphics());
                    this.object._debugBorder.lineStyle(2, 0xff0000).drawPolygon(this.object._texturePolygon);
                }

                /*
                let gr = MonksActiveTiles.debugGr;
                if (!gr) {
                    gr = new PIXI.Graphics();
                    MonksActiveTiles.debugGr = gr;
                    canvas.tokens.addChild(gr);
                }
                for (let x = pt.x - 1500; x < pt.x + 1500; x += 10) {
                    for (let y = pt.y - 1500; y < pt.y + 1500; y += 10) {
                        let check = this.pointWithin({ x: x, y: y });
                        gr.beginFill(check ? 0xff0000 : 0x00ff00).drawCircle(x, y, 4).endFill();
                    }
                }
                */

                //check to see if the clicked point is within the Tile
                if (pt == undefined || this.pointWithin(pt)) {
                    if (game.user.isGM || !canvas?.scene?.tokenVision || !triggerData.vision || (entities.some(t => {
                        return canvas.visibility.testVisibility({ x: this.x, y: this.y }, { tolerance: 1, object: t });
                    }))) {
                        return { tile: this, args: { tokens: tokens, method: clicktype, pt: pt, options: { event: event } } };
                    }
                }
            }
            return null;
        }

        TileDocument.prototype.getIntersections = function (token, destination) {
            let triggerData = this.flags["monks-active-tiles"];

            if (!triggerData?.active) return [];

            if (triggerData.usealpha && !this.object._texturePolygon)
                this.object._findTextureBorder();
            if (CONFIG.debug.tiletriggers && triggerData.usealpha) {
                if (this.object._debugBorder)
                    this.object._debugBorder.destroy();
                this.object._debugBorder = this.object.addChild(new PIXI.Graphics());
                this.object._debugBorder.lineStyle(2, 0xff0000).drawPolygon(this.object._texturePolygon);
            }

            function rotate(cx, cy, x, y, angle) {
                var rad = Math.toRadians(angle),
                    cos = Math.cos(rad),
                    sin = Math.sin(rad),
                    run = x - cx,
                    rise = y - cy,
                    tx = (cos * run) + (sin * rise) + cx,
                    ty = (cos * rise) - (sin * run) + cy;
                return { x: tx, y: ty };
            }

            const cX = (Math.abs(this.width) / 2);
            const cY = (Math.abs(this.height) / 2);

            const tokenOffsetW = ((token.width ?? 0) * (token?.parent?.dimensions?.size ?? 0)) / 2;
            const tokenOffsetH = ((token.height ?? 0) * (token?.parent?.dimensions?.size ?? 0)) / 2;
            const tokenX1 = token.x + tokenOffsetW;
            const tokenY1 = token.y + tokenOffsetH;
            const tokenX2 = destination.x + tokenOffsetW;
            const tokenY2 = destination.y + tokenOffsetH;

            const tokenRay = new foundry.canvas.geometry.Ray(
                {
                    x: tokenX1 - (this.x + cX),
                    y: tokenY1 - (this.y + cY)
                },
                {
                    x: tokenX2 - (this.x + cX),
                    y: tokenY2 - (this.y + cY)
                });

            if (this.rotation != 0) {
                //rotate the point
                tokenRay.A = rotate(0, 0, tokenRay.A.x, tokenRay.A.y, this.rotation);
                tokenRay.B = rotate(0, 0, tokenRay.B.x, tokenRay.B.y, this.rotation);
            }

            let scaleX = triggerData?.usealpha ? this.texture.scaleX : 1;
            let scaleY = triggerData?.usealpha ? this.texture.scaleY : 1;

            tokenRay.A.x = (tokenRay.A.x / scaleX) + cX;
            tokenRay.A.y = (tokenRay.A.y / scaleY) + cY;
            tokenRay.B.x = (tokenRay.B.x / scaleX) + cX;
            tokenRay.B.y = (tokenRay.B.y / scaleY) + cY;

            // Check the bounding box first
            let segments = MonksActiveTiles.getTileSegments(this).filter(s => foundry.utils.lineSegmentIntersects(tokenRay.A, tokenRay.B, s.a, s.b));

            if (triggerData.usealpha) {
                //!(tokenRay.A.x <= 0 || tokenRay.A.x >= Math.abs(this.width) || tokenRay.A.y <= 0 || tokenRay.A.y >= Math.abs(this.height))
                // only need to check the polygon if there are segments, or if both points are within the rectangle
                if (segments.length || 
                    !(tokenRay.A.x < 0 || tokenRay.A.x > Math.abs(this.width) || tokenRay.A.y < 0 || tokenRay.A.y > Math.abs(this.height)) || 
                    !(tokenRay.B.x < 0 || tokenRay.B.x > Math.abs(this.width) || tokenRay.B.y < 0 || tokenRay.B.y > Math.abs(this.height))) {
                    segments = MonksActiveTiles.getTileSegments(this, true).filter(s => foundry.utils.lineSegmentIntersects(tokenRay.A, tokenRay.B, s.a, s.b));
                }
            }

            let intersect = segments
                .map(s => {
                    let point = foundry.utils.lineSegmentIntersection(tokenRay.A, tokenRay.B, s.a, s.b);
                    let t0 = point.t0;
                    point = { x: (point.x - cX) * scaleX, y: (point.y - cY) * scaleY }
                    point = rotate(0, 0, point.x, point.y, this.rotation * -1);
                    point = { x: point.x + (this.x + cX), y: point.y + (this.y + cY) }
                    point.t0 = t0;
                    return point;
                });

            if (CONFIG.debug.tiletriggers) {
                let gr = MonksActiveTiles.debugGr;
                if (!gr) {
                    gr = new PIXI.Graphics();
                    MonksActiveTiles.debugGr = gr;
                    canvas.tokens.addChild(gr);
                }

                for (let pt of intersect) {
                    gr.lineStyle(2, 0x800080).drawCircle(pt.x, pt.y, 4);
                }
            }

            return intersect;
        }

        TileDocument.prototype.canTrigger = function (token) {
            let triggerData = this.flags["monks-active-tiles"];
            if (triggerData) {
                // prevent players from triggering a tile if the game is paused.
                if (setting("prevent-when-paused") && game.paused && !game.user.isGM && triggerData.allowpaused !== true)
                    return false;

                //check to see if this trigger is per token, and already triggered
                if (token && triggerData.pertoken && this.hasTriggered(token.id))
                    return false;

                //check to see if this trigger is restricted by token type
                if (token && ((triggerData.restriction == 'gm' && token.actor?.hasPlayerOwner) || (triggerData.restriction == 'player' && !token.actor?.hasPlayerOwner)))
                    return false;

                //check to see if this trigger is restricted by control type
                if (token && ((triggerData.controlled == 'gm' && !game.user.isGM) || (triggerData.controlled == 'player' && game.user.isGM)))
                    return false;

                //If this trigger has a chance of failure, roll the dice
                if (triggerData.chance == 0)
                    return false;

                return true;
            }
        }

        TileDocument.prototype.getTriggerPoints = function (when, token, collision, source, destination) {
            let triggerData = this.flags["monks-active-tiles"];
            if (triggerData) {
                let tokenMidX = ((token.width * token.parent.dimensions.size) / 2);
                let tokenMidY = ((token.height * token.parent.dimensions.size) / 2);
                //is the token currently in the tile
                let tokenPos = { x: (when == 'stop' ? destination.x : token.x) + tokenMidX, y: (when == 'stop' ? destination.y : token.y) + tokenMidY };
                let inTile = this.pointWithin(tokenPos);

                //go through the list, alternating in/out until we find one that satisfies the on enter/on exit setting, and if it does, return the trigger point.
                if (when == 'movement') {
                    /*
                    if (collision.length > 1)
                        //movement is an enter an exit, so take the start and end points
                        return { x: collision[0].x, y: collision[0].y, x2: collision[collision.length - 1].x, y2: collision[collision.length - 1].y, method: 'movement' };
                    else if (collision.length == 1) {
                        if (inTile)
                            // movement is an exit
                            return { x: source.x + tokenMidX, y: source.y + tokenMidY, x2: collision[0].x, y2: collision[0].y, method: 'movement' };
                        else
                            // movement is coming into the tile, so start at the entry point, and exit at the destination
                            return { x: collision[0].x, y: collision[0].y, x2: destination.x + tokenMidX, y2: destination.y + tokenMidY, method: 'movement' };
                    } else {
                    */
                        // movement is within the tile
                        return { x: source.x + tokenMidX, y: source.y + tokenMidY, x2: destination.x + tokenMidX, y2: destination.y + tokenMidY, method: 'movement' };
                    //}
                } else if (when == 'elevation' || when == 'create' || when == 'rotation') {
                    return { x: source.x + tokenMidX, y: source.y + tokenMidY, method: when };
                } else if (when == 'stop') {
                    if (inTile)
                        return { x: destination.x, y: destination.y, method: 'stop' };
                } else {
                    //let idx = ((inTile ? 0 : 1) - (when == 'enter' ? 1 : 0));
                    let pos = { method: when };
                    if (when == 'exit' && collision.length > 1) {
                        pos.x = collision[collision.length - 1].x;
                        pos.y = collision[collision.length - 1].y;
                    } else {
                        pos.x = collision[0].x;
                        pos.y = collision[0].y;
                    }
                    return pos;
                }

                return null;
            }
        }

        /*
        TileDocument.prototype.preloadScene = function () {
            let actions = this.flags["monks-active-tiles"]?.actions || [];
            if (!this._preload)
                this._preload = {};
            for (let action of actions) {
                if (action.action == 'teleport' && action.data.location.sceneId && action.data.location.sceneId != canvas.scene.id) {
                    if (!this._preload[action.data.location.sceneId]) {
                        log('preloading scene', action.data.location.sceneId, this._preload);
                        this._preload[action.data.location.sceneId] = game.scenes.preload(action.data.location.sceneId, true).then(() => {
                            delete this._preload[action.data.location.sceneId];
                            log('clearing preloading scene', action.data.location.sceneId, this._preload);
                        });
                    }
                }
                if (action.action == 'scene') {
                    if (!this._preload[action.data.location.sceneId]) {
                        log('preloading scene', action.data.sceneid);
                        this._preload[action.data.location.sceneId] = game.scenes.preload(action.data.sceneid, true).then(() => {
                            delete this._preload[action.data.location.sceneId];
                            log('clearing preloading scene', action.data.location.sceneId, this._preload);
                        });
                    }
                }
            }
        }*/

        TileDocument.prototype.checkStop = function () {
            let triggers = MonksActiveTiles.getTrigger(foundry.utils.getProperty(this, "flags.monks-active-tiles.trigger"));
            //if (triggers.includes('movement'))
            //    return false;
            let hasLanding = false;
            let hasSnap = false;
            let stoppage = this.flags['monks-active-tiles'].actions.filter(a => {
                if (a.action == 'anchor')
                    hasLanding = true;
                if (a.action == "movement" && a.data?.snap)
                    hasSnap = true;
                return MonksActiveTiles.triggerActions[a.action].stop === true;
            });
            if (hasLanding)
                return false;
            return hasSnap ? "snap" : stoppage.length != 0;
            //return (stoppage.length == 0 ? { stop: false } : (stoppage.find(a => a.data?.snap) ? 'snap' : true));
        }

        TileDocument.prototype.trigger = async function (args) {
            let { tokens = [], userId = game.user.id, method, pt, stopdata, options = {} } = args;

            if (MonksActiveTiles.allowRun) {
                let triggerData = this.flags["monks-active-tiles"];

                if (triggerData == undefined) return;
                //if (this.flags["monks-active-tiles"]?.pertoken)
                if (game.user.isGM && triggerData.record === true) {
                    if (tokens.length > 0) {
                        for (let tkn of tokens)
                            await this.addHistory(tkn.id, method, userId);    //changing this to always register tokens that have triggered it.
                    } else if(method != "trigger")
                        await this.addHistory("", method, userId);
                }

                //only complete a trigger once the minimum is reached
                if (triggerData.minrequired && this.countTriggered() < triggerData.minrequired)
                    return;

                if (method != "trigger") {
                    for (let tkn of tokens) {
                        foundry.utils.setProperty(tkn, "flags.monks-active-tiles.triggerPt", pt);
                    }
                }

                //A token has triggered this tile, what actions do we need to do
                let values = [];
                let value = { tokens: tokens };
                let context = foundry.utils.mergeObject({
                    tile: this,
                    tokens: tokens,
                    userId: userId,
                    values: values,
                    value: value,
                    method: method,
                    pt: pt,
                    darkness: canvas.darknessLevel,
                    time: MonksActiveTiles.getWorldTime(),
                    stopdata
                }, options);
                if (options.event)
                    context.event = options.event;

                let direction = {};
                if (!!pt && !!pt.x && !!pt.y) {
                    let tokenRay;
                    if (!tokens.length || !["enter", "exit", "movement", "elevation", "rotation"].includes(method)) {
                        let midTile = { x: this.x + (Math.abs(this.width) / 2), y: this.y + (Math.abs(this.height) / 2) };
                        tokenRay = new foundry.canvas.geometry.Ray({ x: midTile.x, y: midTile.y }, { x: pt.x, y: pt.y });
                    } else {
                        tokenRay = new foundry.canvas.geometry.Ray({ x: options.src?.x || tokens[0].x, y: options.src?.y || tokens[0].y }, { x: options.original?.x || pt.x, y: options.original?.y || pt.y });
                    }

                    direction.y = ((tokenRay.angle == 0 || tokenRay.angle == Math.PI) ? "" : (tokenRay.angle < 0 ? "up" : "down"));
                    direction.x = ((Math.abs(tokenRay.angle) == (Math.PI / 2)) ? "" : (Math.abs(tokenRay.angle) < (Math.PI / 2) ? "right" : "left"));
                    //log("Direction", tokenRay.angle, tokenRay, direction, tokens[0].x, tokens[0].y);
                    value.direction = direction;
                }

                let rotation = null;
                if (tokens.length) {
                    rotation = options.rotation ?? tokens[0].rotation;
                }

                let elevation = null;
                if (tokens.length) {
                    elevation = options.elevation ?? tokens[0].elevation;
                }

                let actions = triggerData?.actions || [];
                let start = 0;

                if (options.landing) {
                    start = actions.findIndex(a => a.action == "anchor" && a.data.tag == options.landing) + 1;
                }

                if (start == 0) {
                    let autoanchor = actions.filter(a => a.action == "anchor" && a.data.tag.startsWith("_"));

                    if (autoanchor.length) {
                        let user = game.users.get(userId);
                        for (let anchor of autoanchor) {
                            if (anchor.data.tag == "_gm" && user?.isGM === true) {
                                start = actions.findIndex(a => a.id == anchor.id) + 1;
                                break;
                            } else if (anchor.data.tag == "_player" && user?.isGM === false) {
                                start = actions.findIndex(a => a.id == anchor.id) + 1;
                                break;
                            } else if (MonksActiveTiles.triggerModes[anchor.data.tag.replace("_", "")] != undefined && `_${options.originalMethod || method}` == anchor.data.tag) {
                                start = actions.findIndex(a => a.id == anchor.id) + 1;
                                break;
                            } else if (anchor.data.tag.startsWith("_door") && anchor.data.tag.endsWith(options.change)) {
                                start = actions.findIndex(a => a.id == anchor.id) + 1;
                                break;
                            } else if (anchor.data.tag == `_${user.name}`) {
                                start = actions.findIndex(a => a.id == anchor.id) + 1;
                                break;
                            } else if (anchor.data.tag == `_${direction.y}` || anchor.data.tag == `_${direction.x}` || anchor.data.tag == `_${direction.y}-${direction.x}`) {
                                start = actions.findIndex(a => a.id == anchor.id) + 1;
                                break;
                            } else if (rotation != undefined && anchor.data.tag == `_rotation${rotation}`) {
                                start = actions.findIndex(a => a.id == anchor.id) + 1;
                                break;
                            } else if (elevation != undefined && anchor.data.tag == `_elevation${elevation}`) {
                                start = actions.findIndex(a => a.id == anchor.id) + 1;
                                break;
                            } else if (method == "darkness" && anchor.data.tag == `_darkness${(options.darkness ?? canvas.darknessLevel) * 100}`) {
                                start = actions.findIndex(a => a.id == anchor.id) + 1;
                                break;
                            } else if (method == "time" && anchor.data.tag == `_time${options.time ?? MonksActiveTiles.getWorldTime()}`) {
                                start = actions.findIndex(a => a.id == anchor.id) + 1;
                                break;
                            }
                        }
                    }
                }

                if (triggerData.cooldown && this._matt_triggertime) {
                    // calculate the difference between two dates
                    let difference = Date.now() - this._matt_triggertime;
                    if (difference < (triggerData.cooldown * 1000)) {
                        return;
                    }
                }
                this._matt_triggertime = Date.now();

                let actionResult = await this.runActions(context, Math.max(start, 0), null);

                for (let tkn of tokens) {
                    foundry.utils.setProperty(tkn, "flags.monks-active-tiles.triggerPt", null);
                }

                return actionResult;
            } else {
                //post this to the GM
                let tokenData = tokens.map(t => (t?.document?.uuid || t?.uuid));
                if (options.walls) {
                    options.walls = options.walls.map(w => (w?.document?.uuid || w?.uuid));
                }
                if (options.value?.walls) {
                    options.value.walls = options.value.walls.map(w => (w?.document?.uuid || w?.uuid));
                }
                delete options.event;
                MonksActiveTiles.emit('trigger', { tileid: this.uuid, userId, tokens: tokenData, method: method, pt: pt, options: options } );
            }
        }

        TileDocument.prototype.runActions = async function (context, start = 0, resume = null) {
            if (context._id == undefined)
                context._id = makeid();
            let actions = this.flags["monks-active-tiles"]?.actions || [];
            let pausing = false;

            for (let i = start; i < actions.length; i++) {
                let action = actions[i];

                let trigger = MonksActiveTiles.triggerActions[action.action];

                if (!trigger)
                    continue;

                if (trigger.requiresGM === true && !game.user.isGM)
                    continue;

                debug("Running action", action);
                context.index = i;
                context.action = action;
                delete context.stopmovement;
                if (resume != undefined)
                    context.tokens = resume.tokens || context.tokens;
                let fn = trigger.fn;
                if (fn) {
                    //If there are batch actions to complete and this function is not batchable, then execute the changes
                    if (!trigger.batch)
                        await MonksActiveTiles.batch.execute();

                    let cancall = (resume != undefined) || await Hooks.call("preTriggerTile", this, this, context.tokens, context.action, context.userId, context.value);
                    if (cancall) {
                        try {
                            let result = resume || await fn.call(this, context);
                            resume = null;
                            if (typeof result == 'object') {
                                log(action?.action, "context.value", context.value, "result", result);
                                if (Array.isArray(result)) {
                                    for (let res of result) {
                                        if (typeof res == 'object') {
                                            context.value = foundry.utils.mergeObject(context.value, res);
                                        }
                                    }
                                } else {
                                    context.value = foundry.utils.mergeObject(context.value, result);
                                }
                                delete context.value.goto;
                                context.values.push(foundry.utils.mergeObject(result, { action: action }));
                                context.stopmovement = context.stopmovement || result.stopmovement;
                                if (!!context.stopmovement && context.stopdata?.callback) {
                                    context.stopdata.stopmovement = context.stopmovement;
                                    context.stopdata.callback(context.stopdata);
                                }

                                if (result.pause) {
                                    debug("Pausing actions");
                                    //Execute any batch actions before pausing
                                    await MonksActiveTiles.batch.execute();

                                    MonksActiveTiles.savestate[context._id] = context;
                                    result = { continue: false };
                                    pausing = true;
                                }

                                if (result.runbatch) {
                                    await MonksActiveTiles.batch.execute();
                                    delete result.runbatch;
                                }

                                if (result.hasOwnProperty && result.hasOwnProperty("goto")) {
                                    if (result.goto instanceof Array) {
                                        result.continue = false;
                                        for (let goto of result.goto) {
                                            if (this.getFlag('monks-active-tiles', 'active') !== false) {
                                                debug("Jumping to Landing", goto.tag);
                                                let idx = actions.findIndex(a => a.action == 'anchor' && a.data.tag == goto.tag);
                                                if (idx != -1) {
                                                    let entities = goto.entities;
                                                    delete goto.tag;
                                                    delete goto.entities;
                                                    let gotoValue = Object.assign({}, context.value, goto); //goto goes after context.value so that it can override redirect tokens
                                                    let gotoContext = Object.assign({}, context, { value: gotoValue, _id: makeid() });

                                                    if (entities) {
                                                        let result = {};
                                                        for (let entity of entities) {
                                                            MonksActiveTiles.addToResult(entity, result);
                                                        }
                                                        Object.assign(gotoContext.value, result);
                                                    }

                                                    let actionResult = await this.runActions(gotoContext, idx + 1);
                                                    if (actionResult?.stoptriggers)
                                                        context.stoptriggers = true;
                                                    context.stopmovement = context.stopmovement || result.stopmovement;
                                                    if (!!context.stopmovement && context.stopdata?.callback) {
                                                        context.stopdata.stopmovement = context.stopmovement;
                                                        context.stopdata.callback(context.stopdata);
                                                    }
                                                }
                                            } else {
                                                debug("Skipping landing due to Tile being inactive", goto.tag);
                                            }
                                        }
                                    } else {
                                        //find the index of the tag
                                        debug("Jumping to Landing", result.goto);
                                        let idx = actions.findIndex(a => a.action == 'anchor' && a.data.tag == result.goto);
                                        if (idx != -1)
                                            i = idx;
                                        else {
                                            // try and find _failedlanding
                                            idx = actions.findIndex(a => a.action == 'anchor' && a.data.tag == "_failedlanding");
                                            if (idx != -1)
                                                i = idx;
                                            else
                                                result.continue = false;
                                        }
                                    }
                                } else {
                                    if (result?.stoptriggers)
                                        context.stoptriggers = true;
                                }

                                result = result.continue;
                            }
                            let cancontinue = await Hooks.call("triggerTile", this, this, context.tokens, context.action, context.userId, context.value);
                            if (foundry.utils.getProperty(this, "flags.monks-active-tiles.allowdisabled") != undefined) {
                                context.value.allowdisabled = foundry.utils.getProperty(this, "flags.monks-active-tiles.allowdisabled");
                                this.unsetFlag("monks-active-tiles", "allowdisabled");
                            }
                            if (result === false || cancontinue === false || (this.getFlag('monks-active-tiles', 'active') === false && context.value.allowdisabled !== true) || this.getFlag('monks-active-tiles', 'continue') === false) {
                                if (game.user.isGM)
                                    this.unsetFlag('monks-active-tiles', 'continue');
                                //if (this._resumeTimer && !pausing)
                                //    window.clearTimeout(this._resumeTimer);
                                debug("Stopping actions", result, cancontinue, this.getFlag('monks-active-tiles', 'active'), this.getFlag('monks-active-tiles', 'continue'));
                                break;
                            }
                        } catch (err) {
                            error(err);
                        }
                    }
                }
            }

            await MonksActiveTiles.batch.execute();

            if (!pausing) {
                delete MonksActiveTiles.savestate[context._id];
            }

            return context;
        }

        TileDocument.prototype.resumeActions = async function (saveid, result) {
            let savestate = MonksActiveTiles.savestate[saveid];
            if (!savestate) {
                log(`Unable to find save state: ${saveid}`);
                return;
            }

            delete savestate.value.pause;

            this.runActions(savestate, savestate.index, Object.assign({}, result));
        }

        TileDocument.prototype.hasTriggered = function (tokenid, method, userId) {
            let tileHistory = (this.flags["monks-active-tiles"]?.history || {});
            if (tokenid == undefined) {
                return Object.entries(tileHistory).length > 0;
            } else {
                let result = tileHistory[tokenid]?.triggered.filter(h => {
                    return (method == undefined || h.how == method) && (userId == undefined || h.who == userId);
                }).sort((a, b) => {
                    return (isFinite(a = a.valueOf()) && isFinite(b = b.valueOf()) ? (a < b) - (a > b) : NaN);
                });

                return (result && result[0]);
            }
        }

        TileDocument.prototype.countTriggered = function (tokenid, method, userId) {
            //let tileHistory = (this.flags["monks-active-tiles"]?.history || {});
            //return Object.entries(tileHistory).length;

            let tileHistory = (this.flags["monks-active-tiles"]?.history || {});
            if (tokenid == undefined) {
                let count = 0;
                for (let [k, v] of Object.entries(tileHistory)) {
                    let result = v?.triggered.filter(h => {
                        return (method == undefined || h.how == method) && (userId == undefined || h.who == userId);
                    }) || [];
                    count += result.length;
                }
                return count;
            } else if (tokenid == "unique") {
                return Object.keys(tileHistory).length;
            } else {
                let result = tileHistory[tokenid]?.triggered.filter(h => {
                    return (method == undefined || h.how == method) && (userId == undefined || h.who == userId);
                }) || [];

                return result.length;
            }
        }

        TileDocument.prototype.addHistory = async function (tokenid, method, userId) {
            let tileHistory = foundry.utils.duplicate(this.flags["monks-active-tiles"]?.history || {});
            let data = { id: makeid(), who: userId, how: method, when: Date.now() };
            if (!tokenid)
                tokenid = "_blank";
            if (!tileHistory[tokenid])
                tileHistory[tokenid] = { tokenid: tokenid, triggered: [data] };
            else
                tileHistory[tokenid].triggered.push(data);

            //this.flags = foundry.utils.mergeObject(this.flags, { "monks-active-tiles.history": tileHistory }); //Due to a race condition we need to set the actual value before trying to save it

            try {
                //await this.unsetFlag("monks-active-tiles", "history");
                await this.update({ "flags.monks-active-tiles.history": tileHistory }, { diff: false });
                canvas.perception.update({
                    refreshLighting: true,
                    refreshSounds: true,
                    initializeVision: true,
                    refreshVision: true,
                    refreshOcclusion: true
                }, true);
            } catch {}
        }

        TileDocument.prototype.removeHistory = async function (id) {
            let tileHistory = foundry.utils.duplicate(this.flags["monks-active-tiles"]?.history || {});
            for (let [k, v] of Object.entries(tileHistory)) {
                let item = v.triggered.findSplice(h => h.id == id);
                if (item != undefined) {
                    this.flags = foundry.utils.mergeObject(this.flags, { "monks-active-tiles.history": tileHistory }); //Due to a race condition we need to set the actual value before trying to save it
                    await this.setFlag("monks-active-tiles", "history", tileHistory);
                    break;
                }
            }
        }

        TileDocument.prototype.resetHistory = async function (tokenid) {
            //let tileHistory = foundry.utils.duplicate(this.flags["monks-active-tiles"]?.history || {});
            if (tokenid == undefined) {
                this.flags["monks-active-tiles"].history = {};
                await this.update({ [`flags.monks-active-tiles.-=history`]: null }, { render: false });
            } else {
                if (this.flags["monks-active-tiles"].history != undefined)
                    delete this.flags["monks-active-tiles"].history[tokenid];
                let key = `flags.monks-active-tiles.history.-=${tokenid}`;
                let updates = {};
                updates[key] = null;
                await this.update(updates, { render: false });
            }
        }

        TileDocument.prototype.getHistory = function (tokenid) {
            let tileHistory = (this.flags["monks-active-tiles"]?.history || {});
            let stats = { count: 0, method: {}, list: [] };

            for (let [k, v] of Object.entries(tileHistory)) {
                if (tokenid == undefined || tokenid == k) {
                    let tknstat = { count: v.triggered.length, method: {} };
                    let token = canvas.scene.tokens.find(t => t.id == k);
                    for (let data of v.triggered) {
                        if (tknstat.method[data.how] == undefined)
                            tknstat.method[data.how] = 1;
                        else
                            tknstat.method[data.how] = tknstat.method[data.how] + 1;

                        if (tknstat.first == undefined || data.when < tknstat.first.when)
                            tknstat.first = data;
                        if (tknstat.last == undefined || data.when > tknstat.last.when)
                            tknstat.last = data;

                        const time = new Date(data.when).toLocaleDateString('en-US', {
                            hour: "numeric",
                            minute: "numeric",
                            second: "numeric"
                        });

                        let user = game.users.find(p => p.id == data.who);
                        stats.list.push(foundry.utils.mergeObject(data, {
                            tokenid: k,
                            name: token?.name || (k == "_blank" ? "[No tokens selected]" : 'Unknown'),
                            username: user?.name || 'Unknown',
                            whenfrmt: time,
                            howname: MonksActiveTiles.triggerModes[data.how] || data.how
                        }));
                    }

                    if (tknstat.first && (stats.first == undefined || tknstat.first.when < stats.first.when))
                        stats.first = foundry.utils.mergeObject(tknstat.first, { tokenid: k });
                    if (tknstat.last && (stats.last == undefined || tknstat.last.when > stats.last.when))
                        stats.last = foundry.utils.mergeObject(tknstat.last, { tokenid: k });

                    stats.count += tknstat.count;
                }

            }

            stats.list = stats.list.sort((a, b) => {
                return ( isFinite(a = a.valueOf()) && isFinite(b = b.valueOf()) ? (a > b) - (a < b) : NaN );
            });

            return stats;
        }
    }

    static changeActive(event) {
        event.preventDefault();

        // Toggle the active state
        const isActive = this.object.document.getFlag('monks-active-tiles', 'active');
        const updates = this.layer.controlled.map(o => {
            return { _id: o.id, 'flags.monks-active-tiles.active': !isActive };
        });

        // Update all objects
        event.currentTarget.classList.toggle("active", !isActive);
        return canvas.scene.updateEmbeddedDocuments(this.object.document.documentName, updates);
    }

    static manuallyTrigger(event) {
        event.preventDefault();

        let tokens = canvas.tokens.controlled.map(t => t.document);
        //check to see if this trigger is per token, and already triggered
        let triggerData = this.object.document.flags["monks-active-tiles"];

        if (triggerData == undefined) return;

        if (triggerData.pertoken)
            tokens = tokens.filter(t => !this.object.document.hasTriggered(t.id)); //.uuid

        //Trigger this Tile
        this.object.document.trigger({ tokens: tokens, method: 'manual'});
    }

    static selectGroups(choices, options) {
        const localize = options.hash['localize'] ?? false;
        let selected = options.hash['selected'] ?? null;
        let blank = options.hash['blank'] || null;
        selected = selected instanceof Array ? selected.map(String) : [String(selected)];

        // Create an option
        const option = (groupid, id, label) => {
            if (localize) label = game.i18n.has(label) ? game.i18n.localize(label) : label;
            let key = (groupid ? groupid + ":" : "") + id;
            let isSelected = selected.includes(key);
            html += `<option value="${key}" ${isSelected ? "selected" : ""}>${label}</option>`
        };

        // Create the options
        let html = "";
        if (blank) option("", blank);
        if (choices instanceof Array) {
            for (let group of choices) {
                let label = (localize ? game.i18n.localize(group.text) : group.text);
                html += `<optgroup label="${label}">`;
                Object.entries(group.groups).forEach(e => option(group.id, ...e));
                html += `</optgroup>`;
            }
        } else {
            if (game.system.id == "burningwheel") {
                const a = RegExp.escape(Handlebars.escapeExpression(choices))
                    , s = new RegExp(` value=["']${a}["']`);
                return options.fn(this).replace(s, "$& selected")
            } else
                Object.entries(choices).forEach(e => option(...e));
        }
        return new Handlebars.SafeString(html);
    }

    static get allowRun() {
        return game.user.isGM || (game.users.find(u => u.isGM && u.active) == undefined && setting("allow-player"));
    }

    static mergeArray(original, other = {}) {
        other = other || {};
        if (!(original instanceof Object) || !(other instanceof Object)) {
            throw new Error("One of original or other are not Objects!");
        }

        // Iterate over the other object
        for (let k of Object.keys(other)) {
            const v = other[k];
            if (!(v instanceof Array))
                throw new Error("One of the properties is not an array");
            if (original.hasOwnProperty(k)) {
                if (!(original[k] instanceof Array))
                    throw new Error("One of the properties is not an array");
                original[k] = original[k].concat(v);
            }
            else original[k] = v;
        }
        return original;
    }

    static async runTriggers(triggeringList, userId) {
        let clearRemainingTriggers = function () {
            for (let trigger of triggeringList) {
                if (trigger.timerID) {
                    window.clearTimeout(trigger.timerID);
                }
                trigger.stop = true;
            }
        }

        let stopMovement = async function (data) {
            let document = data.document;
            let endPt = data.pt;
            if (data.stopmovement == "snap") {
                let snapPoint = { B: foundry.utils.duplicate(endPt) };
                if (endPt.x != data.dest.x || endPt.y != data.dest.y) 
                    snapPoint = foundry.canvas.geometry.Ray.towardsPoint(endPt, data.dest, document.parent.dimensions.size / 3);
                endPt = MonksActiveTiles.getSnappedPosition(snapPoint.B.x, snapPoint.B.y);
                if (isNaN(endPt.x)) endPt.x = data.pt.x;
                if (isNaN(endPt.y)) endPt.y = data.pt.y;
                log("Snapping to", endPt);
            }
            if (game.modules.get("drag-ruler")?.active) {
                if (game.user.id == userId) {
                    let ruler = canvas.controls.getRulerForUser(game.user.id);
                    if (ruler) ruler.cancelMovement = true;
                } else {
                    MonksActiveTiles.emit('cancelruler', { userId: userId });
                }
            }
            let animation = foundry.canvas.animation.CanvasAnimation.getAnimation(document._object?.animationName + "Movement");
            if (animation) {
                foundry.canvas.animation.CanvasAnimation.terminateAnimation(document._object?.animationName + "Movement");
                log("Found animation");
                /*
                let x = animation.attributes.find(a => a.attribute == "x");
                if (x)
                    x.to = endPt.x;
                let y = animation.attributes.find(a => a.attribute == "y");
                if (y)
                    y.to = endPt.y;
                */
            }

            endPt.x = Math.floor(endPt.x);
            endPt.y = Math.floor(endPt.y);

            await document.update(endPt, { bypass: true, animate: true });
        }

        for (let triggerObject of triggeringList) {
            triggerObject.tile = await fromUuid(triggerObject.tileId);
            if (!foundry.utils.getProperty(triggerObject.tile, "flags.monks-active-tiles.active") || triggerObject.stop)
                continue;
            triggerObject.document = await fromUuid(triggerObject.documentId);

            if (triggerObject.duration > 0 && !triggerObject.timerId && !triggerObject.stop) {
                // Find any other triggers that are going to happen at the same time
                let duration = triggerObject.duration;
                let triggers = triggeringList.filter(t => t.duration == duration);

                let timerId = window.setTimeout(async function () {
                    for (let i = 0; i < triggers.length; i++) {
                        let trigger = triggers[i];
                        //log('Tile is triggering', when, document);
                        if (foundry.utils.getProperty(trigger.tile, "flags.monks-active-tiles.active") && !trigger.stop) {
                            trigger.args.stopdata = {
                                tile: trigger.tile,
                                document: trigger.document,
                                pt: trigger.end,
                                dest: trigger.dest,
                                when: trigger.when,
                                callback: async (data) => {
                                    if (!!data.stopmovement) {
                                        clearRemainingTriggers();
                                        await stopMovement(data);
                                    }
                                }
                            }
                            trigger.args.userId = userId;
                            trigger.args.tokens = [trigger.document];
                            let triggerResult = await trigger.tile.trigger(trigger.args);
                            if (triggerResult?.value.stoptriggers) {
                                clearRemainingTriggers();
                                break;
                            }
                        }
                    }
                }, duration);
                for (let trigger of triggers) {
                    trigger.timerId = timerId;
                }
            }

            if (!triggerObject.timerId) {
                triggerObject.args.userId = userId;
                triggerObject.args.tokens = [triggerObject.document];
                let triggerResult = await triggerObject.tile.trigger(triggerObject.args);
                let isBreak = false;
                if (triggerResult?.stoptriggers) {
                    isBreak = true;
                    clearRemainingTriggers();
                }
                if (isBreak)
                    break;
            }
        }
    }
}

Hooks.on('init', async () => {
    MonksActiveTiles.init();
});

Hooks.on('ready', () => {
    game.socket.on(MonksActiveTiles.SOCKET, MonksActiveTiles.onMessage);

    MonksActiveTiles.TimeOffset = 0;
    if (game.system.id === 'pf2e') {
        let createTime = game.pf2e.worldClock.worldCreatedOn.c;
        MonksActiveTiles.TimeOffset = (createTime.hour * 3600) + (createTime.minute * 60) + createTime.second + (createTime.millisecond * 0.001);
    }

    MonksActiveTiles._oldSheetClass = CONFIG.Tile.sheetClasses.base['core.TileConfig'].cls;
    CONFIG.Tile.sheetClasses.base['core.TileConfig'].cls = WithActiveTileConfig(CONFIG.Tile.sheetClasses.base['core.TileConfig'].cls);

    Object.defineProperty(CONFIG.Tile.documentClass.prototype, "name", {
        get: function () {
            return this.getFlag("monks-active-tiles", "name");
        }
    });

    if (game.modules.get("item-piles")?.active && setting('drop-item')) {
        game.settings.set('monks-active-tiles', 'drop-item', false);
        ui.notifications.warn(i18n("MonksActiveTiles.msg.itempiles"));
        warn(i18n("MonksActiveTiles.msg.itempiles"));
    }

    if (!setting("fix-action-names") && game.user.isGM) {
        MonksActiveTiles.fixTiles();
        game.settings.set("monks-active-tiles", "fix-action-names", true);
    }
    if (!setting("fix-imagecycle") && game.user.isGM) {
        MonksActiveTiles.fixImageCycle();
        game.settings.set("monks-active-tiles", "fix-imagecycle", true);
    }
    if (!setting("fix-variablename") && game.user.isGM) {
        MonksActiveTiles.fixVariableName();
        game.settings.set("monks-active-tiles", "fix-variablename", true);
    }
    if (!setting("fix-forplayer") && game.user.isGM) {
        MonksActiveTiles.fixForPlayer();
        game.settings.set("monks-active-tiles", "fix-forplayer", true);
    }
    if (!setting("fix-forplayer-again") && game.user.isGM) {
        MonksActiveTiles.fixForPlayerAgain();
        game.settings.set("monks-active-tiles", "fix-forplayer-again", true);
    }
    if (!setting("fix-rolltable") && game.user.isGM) {
        MonksActiveTiles.fixRollTable();
        game.settings.set("monks-active-tiles", "fix-rolltable", true);
    }
    if ((!setting("fix-scene") || !setting("fix-scene-again")) && game.user.isGM) {
        MonksActiveTiles.fixScenes();
        game.settings.set("monks-active-tiles", "fix-scene", true);
        game.settings.set("monks-active-tiles", "fix-scene-again", true);
    }

    $("#board").on("pointerdown", function (event) {
        let pointerType = (event.pointerType !== 'mouse' || event.button === 0) ? 'click' : event.button === 2 ? 'rightclick' : 'dblclick';
        if (pointerType == 'rightclick') {
            if (MonksActiveTiles.rightClickClicked) {
                MonksActiveTiles.canvasClick.call(this, event.originalEvent, 'dblrightclick');
                MonksActiveTiles.rightClickClicked = false;
                if (MonksActiveTiles.rightClickTimer) window.clearTimeout(MonksActiveTiles.rightClickTimer);
            } else {
                MonksActiveTiles.rightClickClicked = true;
                if (MonksActiveTiles.rightClickTimer)
                    window.clearTimeout(MonksActiveTiles.rightClickTimer);
                MonksActiveTiles.rightClickTimer = window.setTimeout(() => { MonksActiveTiles.rightClickClicked = false; }, 500);
            }
        }
    });
    /*
    $("#board").on("pointerdown", function (event) {
        let pointerType =  (event.pointerType !== 'mouse' || event.button === 0) ? 'click' : event.button === 2 ? 'rightclick' : 'dblclick';
        if (pointerType == 'rightclick') {
            if (MonksActiveTiles.rightClickClicked) {
                MonksActiveTiles.canvasClick.call(this, event.originalEvent, 'dblrightclick');
                MonksActiveTiles.rightClickClicked = false;
                if (MonksActiveTiles.rightClickTimer) window.clearTimeout(MonksActiveTiles.rightClickTimer);
            } else {
                MonksActiveTiles.rightClickClicked = true;
                if (MonksActiveTiles.rightClickTimer)
                    window.clearTimeout(MonksActiveTiles.rightClickTimer);
                MonksActiveTiles.rightClickTimer = window.setTimeout(() => { MonksActiveTiles.rightClickClicked = false; }, 500);
            }
        }
        MonksActiveTiles.canvasClick.call(this, event.originalEvent, pointerType);
    });
    $("#board").on("dblclick", function (event) {
        MonksActiveTiles.canvasClick.call(this, event.originalEvent, 'dblclick');
    });
    */
});

Hooks.on('createToken', async (document, options, userId) => {
    let tiles = document.parent.tiles.map((tile) => {
        let triggerData = foundry.utils.getProperty(tile, "flags.monks-active-tiles") || {};
        let triggers = MonksActiveTiles.getTrigger(triggerData?.trigger);
        if (triggerData?.active && triggerData.actions?.length > 0 && triggers.includes('create')) {
            let token = document.object;

            if (game.modules.get("levels")?.active && CONFIG.Levels.API && CONFIG.Levels.API.isTokenInRange && !CONFIG.Levels.API.isTokenInRange(token, tile._object))
                return null;

            //check and see if the ray crosses a tile
            let pt = { x: document.x + ((document.height * document.parent.dimensions.size) / 2), y: document.y + ((document.height * document.parent.dimensions.size) / 2) };
            if (tile.canTrigger(document) && tile.pointWithin(pt)) {
                return { tile, args: { tokens: [document], method: 'create', pt: pt } };
            }
        }
        return null;
    }).filter(t => !!t).sort((a, b) => (b.tile.sort ?? b.tile.z) - (a.tile.sort ?? a.tile.z));
    for (let t of tiles) {
        let triggerResult = await t.tile.trigger(t.args);
        if (triggerResult?.stoptriggers)
            break;
    }
});

Hooks.once('ready', () => {
    // If this is added during the ready function then hopefully it will get added last
    Hooks.on('preUpdateToken', async (document, update, options, userId) => {
        //log('preupdate token', document, update, options);

        /*
        if (MonksActiveTiles._rejectRemaining[document.id] && options.bypass !== true) {
            update.x = MonksActiveTiles._rejectRemaining[document.id].x;
            update.y = MonksActiveTiles._rejectRemaining[document.id].y;
            options.animate = false;
        }*/
        let triggeringList = [];
        

        //make sure to bypass if the token is being dropped somewhere, otherwise we could end up triggering a lot of tiles
        if (((update.x != undefined && update.x != document.x) || (update.y != undefined && update.y != document.y) || update.elevation != undefined || update.rotation != undefined) && options.bypass !== true && (options.animate !== false || options.tileTeleport)) { //(!game.modules.get("drag-ruler")?.active || options.animate)) {
            let token = document.object;

            if ((document.caught || document.getFlag('monks-active-tiles', 'teleporting')) && !options.tileTeleport) {
                //do not update x/y if the token is under a cool down period, or if it is teleporting.
                delete update.x;
                delete update.y;
                return;
            }

            //log('triggering for', token.id);
            let gr;
            if (CONFIG.debug.tiletriggers) {
                gr = new PIXI.Graphics();
                if (MonksActiveTiles.debugGr)
                    canvas.tokens.removeChild(MonksActiveTiles.debugGr);
                MonksActiveTiles.debugGr = gr;
                canvas.tokens.addChild(gr);
            }

            let triggerOrder = { "elevation": 0, "rotation": 1, "movement": 2, "exit": 3, "enter": 4, "stop": 5 };

            //Does this cross a tile
            for (let tile of document.parent.tiles) {
                if (options.originaltile === tile.id)
                    continue;

                let triggerData = tile.flags["monks-active-tiles"] || {};
                let triggers = MonksActiveTiles.getTrigger(triggerData?.trigger);
                if (triggerData?.active && triggerData.actions?.length > 0) {
                    if (game.modules.get("levels")?.active && CONFIG.Levels.API && CONFIG.Levels.API.isTokenInRange && !CONFIG.Levels.API.isTokenInRange(token, tile._object))
                        continue;

                    //check and see if the ray crosses a tile
                    let src = { x: document.x, y: document.y };
                    let tokenMidX = ((document.width * document.parent.dimensions.size) / 2);
                    let tokenMidY = ((document.height * document.parent.dimensions.size) / 2);
                    let tokenPos = { x: document.x + tokenMidX, y: document.y + tokenMidY };

                    let start = { x: document.x, y: document.y };
                    let dest = { x: update.x || document.x, y: update.y || document.y };
                    let elevation = update.elevation ?? document.elevation;
                    let rotation = update.rotation ?? document.rotation;

                    if (!tile.canTrigger(document))
                        continue;

                    let contains = tile.pointWithin(tokenPos);
                    let destContains = tile.pointWithin({ x: dest.x + tokenMidX, y: dest.y + tokenMidY });

                    // Elevation and Create happen immediate, the others all have a delay
                    let availableTriggers = Object.keys(triggerOrder).filter(t => triggers.includes(t));

                    if (update.rotation == undefined || !contains)
                        availableTriggers.findSplice(t => t == "rotation");

                    if (update.elevation == undefined || !contains)
                        availableTriggers.findSplice(t => t == "elevation");

                    if (update.x == undefined && update.y == undefined) {
                        availableTriggers.findSplice(t => t == "enter");
                        availableTriggers.findSplice(t => t == "movement");
                        availableTriggers.findSplice(t => t == "exit");
                        availableTriggers.findSplice(t => t == "stop");
                    }

                    if (!destContains) {
                        availableTriggers.findSplice(t => t == "stop");
                    }

                    if (contains) {
                        availableTriggers.findSplice(t => t == "enter");
                    } else {
                        availableTriggers.findSplice(t => t == "movement");
                    }

                    if (availableTriggers.length == 0)
                        continue;

                    let collisions;
                    if (availableTriggers.includes('enter') || availableTriggers.includes('exit') || availableTriggers.includes('stop')) {
                        collisions = tile.getIntersections(document, dest);
                        if (collisions.length == 0) {
                            availableTriggers.findSplice(t => t == "enter");
                            availableTriggers.findSplice(t => t == "exit");
                        } else {
                            //sort by closest
                            let sorted = (collisions.length > 1 ? collisions.sort((c1, c2) => (c1.t0 > c2.t0) ? 1 : -1) : collisions);

                            //clear out any duplicate corners
                            collisions = sorted.filter((value, index, self) => {
                                return self.findIndex(v => v.x === value.x && v.y === value.y) === index;
                            });

                            if (collisions.length == 1) {
                                if (contains)
                                    availableTriggers.findSplice(t => t == "enter");
                                else
                                    availableTriggers.findSplice(t => t == "exit");
                                if (!destContains)
                                    availableTriggers.findSplice(t => t == "stop");
                            } else
                                availableTriggers.findSplice(t => t == "stop");
                        }
                        //log("Collisions", collisions);
                    }

                    if (availableTriggers.length == 0)
                        continue;

                    if (triggerData.chance != 100) {
                        let chance = (Math.random() * 100);
                        if (chance > triggerData.chance) {
                            log(`trigger failed with ${chance}% out of ${triggerData.chance}%`);
                            continue;
                        } else
                            log(`trigger passed with ${chance}% out of ${triggerData.chance}%`);
                    }

                    debug("Available triggers", availableTriggers);
                    //triggeringList
                    let original = { x: update.x || document.x, y: update.y || document.y };
                    for (let when of availableTriggers) {
                        let triggerPt = tile.getTriggerPoints(when, document, collisions, start, dest);
                        if ((when == "enter" || when == "exit" || when == "stop") && (triggerPt == undefined || (triggerPt.x == tokenPos.x && triggerPt.y == tokenPos.y))) {
                            // move on to the next trigger because being on the line does not trigger an enter or exit.
                            // or it's an enter or exit, and there's not a coresponding triggering point
                            continue;
                        }

                        let dist = Math.hypot(triggerPt.x - tokenPos.x, triggerPt.y - tokenPos.y);
                        let triggerObject = {
                            id: foundry.utils.randomID(),
                            tileId: tile.uuid,
                            documentId: document.uuid,
                            when,
                            zIndex: tile.sort ?? tile.z,
                            dist,
                            end: { x: triggerPt.x - tokenMidX, y: triggerPt.y - tokenMidY },
                            dest,
                            args: { method: when, pt: triggerPt, options: { original, elevation, rotation, src: start } }
                        };
                        triggeringList.push(triggerObject);

                        if (when == "enter" || when == "exit" || when == "stop") {
                            //calculate how much time until the token reaches the trigger point, and wait to call the trigger
                            let ray = new foundry.canvas.geometry.Ray({ x: start.x, y: start.y }, { x: (triggerPt.x2 ?? triggerPt.x) - tokenMidX, y: (triggerPt.y2 ?? triggerPt.y) - tokenMidY });  // This isn't exactly accurate, but I want the trigger to happen when the trigger point is crossed, not the final destination
                            const s = document.parent.dimensions.size;
                            const speed = s * (6.2 + (when == "exit" ? 0.3 : 0));
                            const duration = (ray.distance * 1000) / speed;
                            
                            if (duration > 0) {
                                // We need to fire when the token gets to the trigger point
                                triggerObject.duration = duration;
                            }
                        }
                    }
                }
            }

            //log('triggeringList', triggeringList);
            if (triggeringList.length > 0) {
                let sorted = triggeringList.sort((a, b) => {
                    // sort by shortest dist, then by when using the triggerOrder, then by z
                    if (a.dist != b.dist) return a.dist - b.dist;
                    if (a.when != b.when) return triggerOrder[a.when] - triggerOrder[b.when];
                    return b.zIndex - a.zIndex;
                });

                if (MonksActiveTiles.allowRun) {
                    MonksActiveTiles.runTriggers(sorted, game.user.id);
                } else {
                    MonksActiveTiles.emit('runtriggers', { triggers: sorted });
                }
            }
        }
    });
});

Hooks.on("preUpdateCombat", async function (combat, delta) {
    if (combat.started && game.user.isGM && combat.scene) {
        let tiles =  combat.scene.tiles.map(tile => {
            let triggerData = tile.flags["monks-active-tiles"] || {};
            let triggers = MonksActiveTiles.getTrigger(triggerData?.trigger);
            if (triggerData?.active && triggerData.actions?.length > 0 &&
                ((delta.turn || delta.round) && triggers.includes('turnend'))) {
                let tokens = [combat.combatant.token];
                return { tile, args: { tokens: tokens, method: 'turnend', options: { turn: delta.turn } } };
            }
            return null;
        }).filter(t => !!t).sort((a, b) => (b.tile.sort ?? b.tile.z) - (a.tile.sort ?? a.tile.z));
        for (let t of tiles) {
            let triggerResult = await t.tile.trigger(t.args);
            if (triggerResult?.stoptriggers)
                break;
        };
    }
});

Hooks.on("updateCombat", async function (combat, delta) {
    if (combat.started && game.user.isGM && combat.scene) {
        let sceneTiles = combat.scene.id == canvas.scene.id ? MonksActiveTiles.tileTriggerCache.combat : combat.scene.tiles;
        let tiles = sceneTiles.map(tile => {
            let triggerData = tile.flags["monks-active-tiles"];
            let triggers = MonksActiveTiles.getTrigger(triggerData?.trigger);
            if (triggerData?.active && triggerData.actions?.length > 0) {
                if (delta.round && triggers.includes('round')) {
                    let tokens = combat.combatants.map(c => c.token);
                    return { tile, args: { tokens: tokens, method: 'round', options: { round: delta.round } } };
                }
                if ((delta.turn || delta.round) && triggers.includes('turn')) {
                    let tokens = [combat.combatant.token];
                    return { tile, args: { tokens: tokens, method: 'turn', options: { turn: delta.turn } } };
                }
                if (delta.round == 1 && combat.turn == 0 && triggers.includes('combatstart')) {
                    let tokens = combat.combatants.map(c => c.token);
                    return { tile, args: { tokens: tokens, method: 'combatstart', options: { round: delta.round } } };
                }
            }
            return null;
        }).filter(t => !!t).sort((a, b) => (b.tile.sort ?? b.tile.z) - (a.tile.sort ?? a.tile.z));
        for (let t of tiles) {
            let triggerResult = await t.tile.trigger(t.args);
            if (triggerResult?.stoptriggers)
                break;
        };
    }
});

Hooks.on("deleteCombat", async function (combat, delta) {
    if (combat.started && game.user.isGM && combat.scene) {
        let tiles = combat.scene.tiles.map(tile => {
            let triggerData = tile.flags["monks-active-tiles"];
            let triggers = MonksActiveTiles.getTrigger(triggerData?.trigger);
            if (triggerData?.active && triggerData.actions?.length > 0 && triggers.includes('combatend')) {
                let tokens = combat.combatants.map(c => c.token);
                return { tile, args: { tokens: tokens, method: 'combatend' } };
            }
        }).filter(t => !!t).sort((a, b) => (b.tile.sort ?? b.tile.z) - (a.tile.sort ?? a.tile.z));
        for (let t of tiles) {
            let triggerResult = await t.tile.trigger(t.args);
            if (triggerResult?.stoptriggers)
                break;
        };
    }
});

Hooks.on('preCreateChatMessage', async (document, data, options, userId) => {
    if (document.getFlag('monks-active-tiles', 'language')) {
        foundry.utils.setProperty(data, "flags.polyglot.language", document.getFlag('monks-active-tiles', 'language'));
        //document.update({ "flags.polyglot.language": document.getFlag('monks-active-tiles', 'language') });
    }
});

Hooks.on('renderTileHUD', (app, html, data) => {
    let active = app.document.getFlag('monks-active-tiles', 'active') ?? true;
    $('<div>')
        .addClass('control-icon')
        .toggleClass('active', active)
        .attr('data-action', 'active')
        .append($('<img>').attr({
            src: 'icons/svg/aura.svg',
            width: '36',
            height: '36',
            title: i18n("MonksActiveTiles.ToggleActive")
        }))
        .click(MonksActiveTiles.changeActive.bind(app))
        .insertAfter($('.control-icon[data-action="locked"]', html));

    $('<div>')
        .addClass('control-icon')
        .attr('data-action', 'trigger')
        .append($('<img>').attr({
            src: 'modules/monks-active-tiles/img/power-button.svg',
            width: '36',
            height: '36',
            title: i18n("MonksActiveTiles.ManualTrigger")
        }))
        .click(MonksActiveTiles.manuallyTrigger.bind(app))
        .insertAfter($('.control-icon[data-action="locked"]', html));
});

Hooks.on('renderActorSheetV2', (app, html, data) => {
    let waitingType = MonksActiveTiles.waitingInput?.waitingfield?.data('type');
    if (waitingType == "entity") {
        MonksActiveTiles.controlEntity(app.document);
        $(app.element).hide();
        window.setTimeout(() => { app.close(); }, 1000);
    }
});

Hooks.on('controlToken', (token, control) => {
    if (control)
        MonksActiveTiles.controlEntity(token);
});

Hooks.on('controlWall', (wall, control) => {
    if (control)
        MonksActiveTiles.controlEntity(wall);
});

Hooks.on('controlTile', (tile, control) => {
    if (control)
        MonksActiveTiles.controlEntity(tile);
});

Hooks.on('controlDrawing', (drawing, control) => {
    if (control)
        MonksActiveTiles.controlEntity(drawing);
});

Hooks.on('controlTerrain', (terrain, control) => {
    if (control)
        MonksActiveTiles.controlEntity(terrain);
});

Hooks.on("renderPlaylistDirectory", (app, html, user) => {
    $('li.sound', html).click(MonksActiveTiles.selectPlaylistSound.bind(this));
});

Hooks.on("renderWallConfig", async (app, html, options) => {
    if (setting("allow-door")) {
        let entity = app.document.flags['monks-active-tiles']?.entity || {};
        if (typeof entity == "string" && entity)
            entity = JSON.parse(entity);
        let tilename = "";
        if (entity.id)
            tilename = entity.id == "within" ? i18n("MonksActiveTiles.WithinWall") : await MonksActiveTiles.entityName(entity);
        let flags = app.document.flags['monks-active-tiles'] || {};
        let triggerData = foundry.utils.mergeObject({ tilename: tilename, showtagger: game.modules.get('tagger')?.active }, flags);
        triggerData.entity = JSON.stringify(entity);

        await foundry.applications.handlebars.loadTemplates([
            "modules/monks-active-tiles/templates/action-field.hbs"
        ]);
        triggerData.buttons = [
            {
                type: 'entity',
                icon: "fas fa-crosshairs",
                tooltip: "MonksActiveTiles.msg.selectentity",
                action: "selectEntity",
                classes: "entity-picker"
            },
            {
                type: 'tagger',
                icon: "fas fa-tag",
                tooltip: "MonksActiveTiles.msg.usetagger",
                action: "addTag",
                classes: "entity-picker"
            },
            {
                type: 'within',
                icon: "fas fa-street-view",
                tooltip: "MonksActiveTiles.msg.usewithinwall",
                action: "selectEntity",
                classes: "entity-picker"
            }
        ];
        triggerData.triggerButtons = [
            {
                type: 'toggle',
                toggle: true,
                active: flags.open,
                icon: "fas fa-door-open",
                tooltip: "On Open Door",
                id: "flags.monks-active-tiles.open",
                classes: "door-trigger"
            },
            {
                type: 'toggle',
                toggle: true,
                active: flags.close,
                icon: "fas fa-door-closed",
                tooltip: "On Close Door",
                id: "flags.monks-active-tiles.close",
                classes: "door-trigger"
            },
            {
                type: 'toggle',
                toggle: true,
                active: flags.lock,
                icon: "fas fa-lock",
                tooltip: "On Lock Door",
                id: "flags.monks-active-tiles.lock",
                classes: "door-trigger"
            },
            {
                type: 'toggle',
                toggle: true,
                active: flags.checklock,
                icon: "fas fa-check-to-slot",
                tooltip: "On Check Lock",
                id: "flags.monks-active-tiles.checklock",
                classes: "door-trigger"
            },
            {
                type: 'toggle',
                toggle: true,
                active: flags.secret,
                icon: "fas fa-user-secret",
                tooltip: "On Secret Door",
                id: "flags.monks-active-tiles.secret",
                classes: "door-trigger"
            }
        ]
        let wallHtml = await foundry.applications.handlebars.renderTemplate("modules/monks-active-tiles/templates/wall-config.html", triggerData);

        if ($("fieldset.door-triggers", app.element).length == 0) {
            // Add the wall triggers
            let $fieldset = $('<fieldset>').addClass("door-triggers");
            $fieldset.append($('<legend>').html(i18n("MonksActiveTiles.DoorTriggers")));
            $fieldset.append(wallHtml);
            $("section.window-content div.standard-form > fieldset:last", app.element).after($fieldset);

            $(".door-trigger-entity", $fieldset).data("ctrl", {
                id: "flags.monks-active-tiles.entity",
                subtype: "entity",
                restrict: (entity) => { return (entity instanceof foundry.canvas.placeables.Tile); }
            });

            $('input[name="flags.monks-active-tiles.entity"]', $fieldset).data({
                'restrict': (entity) => { return (entity instanceof foundry.canvas.placeables.Tile); },
                'type': 'entity',
                'deftype': 'tiles',
                'value': flags['entity'] || '',
                label: await MonksActiveTiles.entityName(flags['entity']) || `<span class="placeholder-style">Please select an entity</span>`,
            });

            $('button.toggle', $fieldset).on("click", (event) => {
                $(event.target).toggleClass('active');
                $(event.target).next().prop('checked', $(event.target).hasClass('active'));
            });

            $('button[data-type="entity"]', $fieldset).on("click", (event) => { ActionConfig.selectEntity.call(app, event, event.target) });
            $('button[data-type="tagger"]', $fieldset).on("click", ActionConfig.addTag.bind(app));
            $('button[data-type="within"]', $fieldset).on("click", (event) => {
                let btn = $(event.currentTarget);
                $('input[name="' + btn.attr('data-target') + '"]', app.element).data({ "id": "within", "name": i18n("MonksActiveTiles.WithinWall") }).next().html(i18n("MonksActiveTiles.WithinWall"));
            });
        }
    }
});

Hooks.on("dropCanvasData", async (canvas, data, options, test) => {
    if (data.type == 'Item' && setting('drop-item')) {
        //Get the Item
        let item = await fromUuid(data.uuid);

        if (!item)
            return ui.notifications.warn("Could not find item");

        //Create Tile
        //change the Tile Image to the Item image
        //Add the actions to Hide the Tile, Disabled the Tile, and Add the Item to Inventory
        let size = canvas.scene.dimensions.size * setting("drop-item-size");
        let dest = { x: data.x - (size / 2), y: data.y - (size / 2) };

        let td = foundry.utils.mergeObject(dest, {
            texture: { src: item.img },
            width: size,
            height: size,
            flags: {
                'monks-active-tiles': {
                    "active": true,
                    "restriction": "all",
                    "controlled": "all",
                    "trigger": "click",
                    "pertoken": false,
                    "minrequired": 0,
                    "chance": 100,
                    "actions": [
                        { "action": "distance", "data": { "measure": "eq", "distance": { "value": 1, "var": "sq" }, "continue": "always", "entity": "" }, "id": "UugwKEORHARYwcS2" },
                        { "action": "exists", "data": { "entity": "", "collection": "tokens", "count": "> 0", "none": "NotCloseEnough" }, "id": "Tal2G8WXfo3xmL5U" },
                        { "action": "first", "id": "dU81VsGaWmAgLAYX" },
                        { "action": "showhide", "data": { "entity": { "id": "tile", "name": "This Tile" }, "hidden": "hide" }, "id": "UnujCziObnW2Axkx" },
                        { "action": "additem", "data": { "entity": "", "item": { "id": item.uuid, "name": "" } }, "id": "IwxJOA8Pi287jBbx" },
                        { "action": "notification", "data": { "text": "{{value.items.0.name}} has been added to {{value.tokens.0.name}}'s inventory", "type": "info", "showto": "token" }, "id": "oNx3QqEi0WpxfkhV" },
                        { "action": "activate", "data": { "entity": "", "activate": "deactivate" }, "id": "6K7aEZH8SnGv3Gyq" },
                        { "action": "anchor", "data": { "tag": "NotCloseEnough", "stop": true }, "id": "9Pi17j10WPrzAFeq" },
                        { "action": "notification", "data": { "text": "Not close enough to pick up this item", "type": "warning", "showto": "token" }, "id": "Unr31Z6iM2P2U7VC" }
                    ]
                }
            }
        });

        const cls = getDocumentClass("Tile");
        await cls.create(td, { parent: canvas.scene });
    } else if (data.type == 'Scene' && setting('drop-scene')) {
        let scene = await fromUuid(data.uuid);

        if (!scene)
            return ui.notifications.warn("Could not find scene");

        let size = canvas.scene.dimensions.size;
        let dest = { x: data.x - (size / 2), y: data.y - (size / 2) };

        let td = foundry.utils.mergeObject(dest, {
            texture: { src: scene.background?.src },
            width: size,
            height: size,
            flags: {
                'monks-active-tiles': {
                    "active": true,
                    "restriction": "all",
                    "controlled": "all",
                    "trigger": "click",
                    "pertoken": false,
                    "minrequired": 0,
                    "chance": 100,
                    "actions": [{ "action": "scene", "data": { "sceneid": scene.id, "activate": false }, "id": "7D4WFv4KEUwUeVnd" }]
                }
            }
        });

        const cls = getDocumentClass("Tile");
        await cls.create(td, { parent: canvas.scene });
    } else if (data.type == 'Macro' && setting("drop-macro")) {
        let macro = await fromUuid(data.uuid);

        if (!macro)
            return ui.notifications.warn("Could not find macro");

        let size = canvas.scene.dimensions.size;
        let dest = { x: data.x - (size / 2), y: data.y - (size / 2) };

        let td = foundry.utils.mergeObject(dest, {
            texture: { src: macro.img || "icons/svg/dice-target.svg" },
            width: size,
            height: size,
            flags: {
                'monks-active-tiles': {
                    "active": true,
                    "restriction": "all",
                    "controlled": "all",
                    "trigger": "click",
                    "pertoken": false,
                    "minrequired": 0,
                    "chance": 100,
                    "actions": [{ "action": "runmacro", "data": { "entity": { id: macro.uuid } }, "id": "OseqrAR1v0PJKUIm" }]
                }
            }
        });

        const cls = getDocumentClass("Tile");
        await cls.create(td, { parent: canvas.scene });
    }
});

Hooks.on("renderSettingsConfig", (app, html, data) => {
    let colour = setting("teleport-colour");
    $('<input>').attr('type', 'color').attr('data-edit', 'monks-active-tiles.teleport-colour').val(colour).insertAfter($('input[name="monks-active-tiles.teleport-colour"]', html).addClass('color'));
});

Hooks.on("renderTileConfig", (app, html, data) => {
    //Make sure that another module hasn't erased the monks-active-tiles class
    $(app.element).addClass("monks-active-tiles");

    $('[name="texture.src"]', html).closest('.form-group')
        .before(
            $('<div>')
                .addClass('form-group')
                .append($('<label>').html("Name"))
                .append($("<div>")
                    .addClass("form-fields")
                    .append($('<input>').attr('type', 'text').attr('name', 'flags.monks-active-tiles.name').val(app.document.getFlag('monks-active-tiles', 'name'))))
          );

    app.setPosition();
});

Hooks.on("canvasReady", async () => {
    MonksActiveTiles.findTileTriggers();
    $('#board').css({ 'cursor': '' });
    MonksActiveTiles.hoveredTiles = new Set();
    let tiles = MonksActiveTiles.tileTriggerCache.ready.map(tile => {
        let triggerData = tile.flags["monks-active-tiles"];
        let triggers = MonksActiveTiles.getTrigger(triggerData?.trigger);
        if (triggerData?.active && triggers.includes("ready")) {
            //check to see if this trigger is restricted by control type
            if ((triggerData.controlled == 'gm' && !game.user.isGM) || (triggerData.controlled == 'player' && game.user.isGM))
                return;

            return { tile, args: { method: "ready" } };
        }
        return null;
    }).filter(t => !!t).sort((a, b) => (b.tile.sort ?? b.tile.z) - (a.tile.sort ?? a.tile.z));
    for (let t of tiles) {
        let triggerResult = await t.tile.trigger(t.args);
        if (triggerResult?.stoptriggers)
            break;
    };
});

Hooks.on("openJournalEntry", (document, options, userId) => {
    if (MonksActiveTiles.waitingInput && MonksActiveTiles.waitingInput.waitingfield.data('type') == 'entity') {
        let restrict = MonksActiveTiles.waitingInput.waitingfield.data('restrict');
        let tileDocument = MonksActiveTiles.waitingInput.options.parent.options.document;
        if (!restrict || restrict(document, tileDocument)) {
            return false;
        }
    }
});

Hooks.on('updateTile', async (document, update, options, userId) => {
    MonksActiveTiles.findTileTriggers();
    if (update?.texture?.src != undefined || foundry.utils.getProperty(update, "flags.monks-active-tiles.usealpha") != undefined) {
        let triggerData = document.flags["monks-active-tiles"];
        if (triggerData?.usealpha) {
            window.setTimeout(function () {
                document.object._findTextureBorder();
            }, 500);
        }
    }
});

Hooks.on('createTile', async (document, options, userId) => {
    MonksActiveTiles.findTileTriggers();
});

Hooks.on('deleteTile', async (document, options, userId) => {
    MonksActiveTiles.findTileTriggers();
});
    
Hooks.on('preUpdateWall', async (document, update, options, userId) => {
    if (update.ds != undefined) {
        if (document.ds == 2 || update.ds == 2)
            document._wallchange = "lock";
        else if (update.ds == 0)
            document._wallchange = "close";
        else if (update.ds == 1)
            document._wallchange = "open";
    }

    if ((update.door != undefined || update.ds == 0) && (document.door == 2 || update.door == 2))
        document._wallchange = "secret";

    let entity = foundry.utils.getProperty(update, "flags.monks-active-tiles.entity");
    if (!!entity && typeof entity == "string") {
        foundry.utils.setProperty(update, "flags.monks-active-tiles.entity", JSON.parse(entity));
    }
});

Hooks.on("globalAmbientVolumeChanged", (volume) => {
    if (!game.modules.get("monks-sound-enhancements")?.active) {
        for (let tile of canvas.scene.tiles.contents) {
            for (let sound of Object.values(tile.soundeffect || {})) {
                if (sound.effectiveVolume != undefined) {
                    sound.volume = volume * (sound.effectiveVolume ?? 1);
                }
            }
        }
    }
});

Hooks.on("globalSoundEffectVolumeChanged", (volume) => {
    for (let tile of canvas.scene.tiles.contents) {
        for (let sound of Object.values(tile.soundeffect || {})) {
            if (sound.effectiveVolume != undefined) {
                sound.volume = volume * (sound.effectiveVolume ?? 1);
            }
        }
    }
});

Hooks.on("refreshTile", (tile) => {
    if (tile.bg && !tile.bg._destroyed) {
        const aw = Math.abs(tile.document.width);
        const ah = Math.abs(tile.document.height);
        const x = tile.document.width < 0 ? -aw : 0;
        const y = tile.document.height < 0 ? -ah : 0;
        //const r = Math.toRadians(tile.document.rotation);

        tile.bg.position.set(aw / 2, ah / 2);
        tile.bg.pivot.set(aw / 2, ah / 2);
        tile.bg.clear().beginFill(0xFFFFFF, 0.5).drawRect(x, y, aw, ah).endFill();
        //tile.bg.rotation = r;

        if (setting("show-imageless") && game.user.isGM) {
            tile.bg.visible = true;
        }
    }

    if (tile._transition && tile.mesh.visible) {
        tile.mesh.visible = false;
    }

    if (tile._animationAttributes && tile._animationAttributes.alpha && tile?.mesh?.alpha != tile._animationAttributes.alpha) {
        tile.mesh.alpha = tile._animationAttributes.alpha;
    }
});


Hooks.on("refreshToken", (token) => {
    if (token._showhide) {
        token.mesh.alpha = this._showhide;
        token.mesh.visible = true;
        token.visible = true;
    }
});

Hooks.on("updateScene", async (scene, data, options) => {
    if (data.environment?.darknessLevel != undefined) {
        let sceneTile = scene.id == canvas.scene.id ? MonksActiveTiles.tileTriggerCache.darkness : scene?.tiles;
        let tiles = (sceneTile || []).map(tile => {
            let triggerData = tile.flags["monks-active-tiles"];
            let triggers = MonksActiveTiles.getTrigger(triggerData?.trigger);
            if (triggerData?.active && triggers.includes('darkness')) {
                if (setting("prevent-when-paused") && game.paused && !game.user.isGM && triggerData.allowpaused !== true)
                    return;

                let tokens = canvas.tokens.controlled.map(t => t.document);

                if (triggerData.pertoken)
                    tokens = tokens.filter(t => !this.object.document.hasTriggered(t.id));

                //Trigger this Tile
                return { tile, args: { tokens: tokens, method: 'darkness', options: { darkness: data.environment?.darknessLevel } } };
            }
            return null;
        }).filter(t => !!t).sort((a, b) => (b.tile.sort ?? b.tile.z) - (a.tile.sort ?? a.tile.z));
        for (let t of tiles) {
            let triggerResult = await t.tile.trigger(t.args);
            if (triggerResult?.stoptriggers)
                break;
        };
    }
});

Hooks.on("lightingRefresh", async (lightingEffect) => {
    let tiles = MonksActiveTiles.tileTriggerCache.lighting.map(tile => {
        let triggerData = tile.flags["monks-active-tiles"];

        if (setting("prevent-when-paused") && game.paused && !game.user.isGM && triggerData.allowpaused !== true)
            return;

        //Trigger this Tile
        return { tile, args: { tokens: [], method: 'lighting', options: { darkness: canvas.scene.environment?.darknessLevel } } };
    }).filter(t => !!t).sort((a, b) => (b.tile.sort ?? b.tile.z) - (a.tile.sort ?? a.tile.z));
    for (let t of tiles) {
        let triggerResult = await t.tile.trigger(t.args);
        if (triggerResult?.stoptriggers)
            break;
    };
});

Hooks.on('updateWorldTime', async (worldTime) => {
    let tiles = MonksActiveTiles.tileTriggerCache.time.map(tile => {
        let triggerData = tile.flags["monks-active-tiles"];

        if (setting("prevent-when-paused") && game.paused && !game.user.isGM && triggerData.allowpaused !== true)
            return;

        let tokens = canvas.tokens.controlled.map(t => t.document);

        if (triggerData.pertoken)
            tokens = tokens.filter(t => !this.object.document.hasTriggered(t.id));

        //Trigger this Tile
        return { tile, args: { tokens: tokens, method: 'time', options: { time: MonksActiveTiles.getWorldTime(worldTime) } } };

        return null;
    }).filter(t => !!t).sort((a, b) => (b.tile.sort ?? b.tile.z) - (a.tile.sort ?? a.tile.z));
    for (let t of tiles) {
        let triggerResult = await t.tile.trigger(t.args);
        if (triggerResult?.stoptriggers)
            break;
    }
});

Hooks.on("getSceneControlButtons", (controls) => {
    if (game.user.isGM) {
        let tileControls = controls.tiles;
        if (tileControls.tools.templates == undefined) {
            tileControls.tools.templates = {
                name: "templates",
                title: "MonksActiveTiles.TileTemplates",
                icon: "fas fa-folder-tree",
                onChange: async () => {
                    if (MonksActiveTiles.tile_directory)
                        MonksActiveTiles.tile_directory.close();
                    else
                        MonksActiveTiles.tile_directory = await new TileTemplates().renderPopout();
                },
                button: true
            };
        }
    }
});

Hooks.once("MultipleDocumentSelection.ready", (dirs) => {
    dirs.push(TileTemplates);
})

Hooks.on("renderJournalSheet", (sheet, html, data) => {
    $("a.tile-trigger-link", html).unbind("click").click(MonksActiveTiles._onClickTileLink.bind(sheet));
});

Hooks.on("renderJournalPageSheet", (sheet, html, data) => {
    $("a.tile-trigger-link", html).unbind("click").click(MonksActiveTiles._onClickTileLink.bind(sheet));
});

Hooks.on("renderItemSheet", (sheet, html, data) => {
    $("a.tile-trigger-link", html).unbind("click").click(MonksActiveTiles._onClickTileLink.bind(sheet));
});

Hooks.on("renderSceneDirectory", (app, html, options) => {
    $(".document.scene h3.document-name:not(.entry-name)", html).addClass("entry-name");
});

Hooks.on("clickPlaylistSound", (sound) => {
    let waitingType = MonksActiveTiles.waitingInput?.waitingfield?.data('type');
    if (waitingType == 'entity') {
        return false;
    }
});

Hooks.on("renderPlayers", (app, html, data, options) => {
    $('.player', html).click(function (event) {
        let waitingType = MonksActiveTiles.waitingInput?.waitingfield?.data('type');
        if (waitingType == 'for') {
            event.preventDefault();
            const userId = event.currentTarget.dataset.userId;
            const user = game.users.get(userId);

            let restrict = MonksActiveTiles.waitingInput.waitingfield.data('restrict');
            let tileDocument = MonksActiveTiles.waitingInput.options.parent.options.document;
            if (restrict && !restrict(user, tileDocument))
                return;

            ActionConfig.updateSelection.call(MonksActiveTiles.waitingInput, { id: user.id, name: user.name }, event);
        }
    });
});
