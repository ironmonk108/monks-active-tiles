import { MonksActiveTiles, log, error, actiontext, debug, warn, setting, i18n, makeid, rollDice, getVolume, getValue, asyncFilter, rectContains } from './monks-active-tiles.js';
import { BatchManager } from "./classes/BatchManager.js";

export class ActionManager {
    static wrapQuotes = (val) => {
        if (typeof val == "string" && val.startsWith('"') && val.endsWith('"')) return val;
        return `"${val}"`;
    }

    static pickRandom = (arr, id) => {
        if (arr.length == 0)
            return null;
        else if (arr.length == 1)
            return arr[0];
        else {
            let results = arr.filter(d => d.dest == undefined || d.dest.id != id);
            let idx = Math.clamp(parseInt(Math.random() * results.length), 0, results.length - 1);
            return results[idx];
        }
    }


    static getDefaultValue = (actionID, ctrlId, defvalue) => {
        let action = ActionManager.actions[actionID];
        if (action) {
            let ctrl = action.ctrls.find(c => c.id == ctrlId);
            if (ctrl)
                return ctrl.defvalue;
        }
        return defvalue;
    }
    static getDefaultType = (actionID, ctrlId, deftype) => {
        let action = ActionManager.actions[actionID];
        if (action) {
            let ctrl = action.ctrls.find(c => c.id == ctrlId);
            if (ctrl)
                return ctrl.defaultType;
        }
        return deftype;
    }
    static get actions() {
        return {
            'pause': {
                name: "MonksActiveTiles.action.pause",
                ctrls: [
                    {
                        id: "pause",
                        name: "MonksActiveTiles.ctrl.state",
                        list: "state",
                        type: "list"
                    }
                ],
                values: {
                    'state': {
                        'pause': "MonksActiveTiles.pause.pause",
                        'unpause': "MonksActiveTiles.pause.unpause",
                        'toggle': "MonksActiveTiles.pause.toggle"
                    }
                },
                fn: (args = {}) => {
                    const { action } = args;
                    game.togglePause((action?.data?.pause == "toggle" ? null : (action?.data?.pause !== 'unpause')), { broadcast: true });
                },
                content: async (trigger, action) => {
                    return actiontext("MonksActiveTiles.actiontext.pause", { pause: i18n(trigger.values.state[action?.data?.pause || 'pause']) });
                }
            },
            'delay': {
                name: "MonksActiveTiles.action.delay",
                ctrls: [
                    {
                        id: "delay",
                        name: "MonksActiveTiles.ctrl.delay",
                        type: "text",
                        required: true,
                        help: "Use commas to create a list of times to randomly pick from, and 5-15 to randomly pick a time between 5s and 15s, "
                    }
                ],
                fn: async (args = {}) => {
                    const { action, tile } = args;

                    let times = ("" + action.data.delay).split(',').map(d => d.trim());
                    let time = times[Math.floor(Math.random() * times.length)];

                    if (time.indexOf('-') != -1) {
                        let parts = time.split('-');
                        let lower = parseFloat(parts[0]) * 1000;
                        let upper = parseFloat(parts[1]) * 1000;
                        time = Math.floor((Math.random() * (upper - lower)) + lower);
                    } else {
                        let roll = await rollDice(time);
                        time = parseFloat(roll.value) * 1000;
                    }

                    if (time > 0) {
                        tile._resumeTimer = window.setTimeout(function () {
                            delete tile._resumeTimer;
                            tile.resumeActions(args._id);
                        }, time);
                    }

                    return { pause: true };
                },
                content: async (trigger, action) => {
                    return actiontext("MonksActiveTiles.actiontext.delay", action.data);
                },

            },
            'movement': {
                name: "MonksActiveTiles.action.stopmovement",
                stop: true,
                ctrls: [
                    {
                        id: "snap",
                        name: "MonksActiveTiles.ctrl.snap",
                        type: "checkbox",
                        help: '<span style="color: #FF0000;">Stop Movement only applies to Entering and Exiting the Tile</span>',
                        conditionalHelp: (app, action) => {
                            let triggers = $('input[name="flags.monks-active-tiles.trigger"]', app.options.parent.element).val().split(",");
                            return !(triggers.includes("enter") || triggers.includes("exit"));
                        }
                    }
                ],
                fn: async (args = {}) => {
                    const { action, tile } = args;
                    return { stopmovement: action.data?.snap ? "snap" : true };
                },
                content: async (trigger, action) => {
                    return actiontext("MonksActiveTiles.actiontext.movement",
                        {
                            action: i18n(trigger.name),
                            snap: MonksActiveTiles.getActionFlag(action.data?.snap, 'snap')
                        });
                }
            },
            'pancanvas': {
                name: "MonksActiveTiles.action.pancanvas",
                ctrls: [
                    {
                        id: "location",
                        name: "MonksActiveTiles.ctrl.select-coordinates",
                        type: "select",
                        subtype: "position",
                        options: { show: ['token', 'players', 'previous', 'tagger'] },
                        restrict: (entity, document) => { return ((entity instanceof foundry.canvas.placeables.Tile || entity instanceof foundry.canvas.placeables.Token) && document.parent.id == entity.parent.id) || document.parent.id == entity.id; },
                        required: true,
                        placeholder: 'Select a location or Tile'
                    },
                    {
                        id: "animate",
                        name: "MonksActiveTiles.ctrl.animate",
                        type: "checkbox",
                        check: true
                    },
                    {
                        id: "duration",
                        name: "MonksActiveTiles.ctrl.duration",
                        type: "number",
                        defvalue: 1,
                        min: 0.05,
                        max: null,
                        step: 0.05,
                        conditional: (app) => { return $('input[name="data.animate"]', app.element).prop("checked") }
                    },
                    {
                        id: "panfor",
                        name: "MonksActiveTiles.ctrl.for",
                        list: "panfor",
                        type: "list",
                        subtype: "for",
                        defvalue: "trigger",
                    }
                ],
                values: {
                    'panfor': {
                        "everyone": "MonksActiveTiles.for.all",
                        "players": "MonksActiveTiles.for.players",
                        "gm": "MonksActiveTiles.for.gm",
                        "trigger": "MonksActiveTiles.for.triggering",
                        "token": "MonksActiveTiles.for.token",
                        "owner": "MonksActiveTiles.for.owner",
                        "previous": "MonksActiveTiles.for.current"
                    }
                },
                fn: async (args = {}) => {
                    const { tile, action, userId, value } = args;
                    let panfor = action.data.panfor || 'trigger';
                    let showUsers = await MonksActiveTiles.getForPlayers(panfor, args);

                    if (action.data.location?.id == "players") {
                        for (let user of showUsers) {
                            let player = game.users.get(user);
                            if (!player?.isGM && player?.active) {
                                let tokens = tile.parent.tokens.filter(t => t.actor?.id == player.character?.id);
                                if (tokens.length) {
                                    MonksActiveTiles.emit('pan',
                                        {
                                            users: [user],
                                            animate: action.data.animate,
                                            dest: {
                                                x: tokens[0].x + ((Math.abs(tokens[0].width) * tile.parent.dimensions.size) / 2),
                                                y: tokens[0].y + ((Math.abs(tokens[0].height) * tile.parent.dimensions.size) / 2),
                                                scene: tile.parent.id,
                                            }
                                        });
                                }
                            }
                        }
                    } else {
                        let _args = action.data.location?.id === "token" ? Object.assign({}, args, { pt: null }) : args;
                        let dests = await MonksActiveTiles.getLocation.call(tile, action.data.location, _args);

                        for (let i = 0; i < dests.length; i++) {
                            let dest = dests[i];
                            if (dest.scene != undefined && dest.scene != canvas.scene.id)
                                return;

                            dest.duration = (action.data?.duration ?? 1) * 1000;

                            dest.x = parseInt(await getValue(dest.x, args, dest, { prop: canvas.scene._viewPosition.x, explicit: true }));
                            dest.y = parseInt(await getValue(dest.y, args, dest, { prop: canvas.scene._viewPosition.y, explicit: true }));

                            let panUsers = foundry.utils.duplicate(showUsers);
                            let runForMe = panUsers.includes(game.user.id);
                            panUsers = panUsers.filter(u => u != game.user.id);

                            if (panUsers.length) {
                                MonksActiveTiles.emit('pan',
                                    {
                                        users: panUsers,
                                        animate: action.data.animate,
                                        dest: dest
                                    });
                            }

                            if (runForMe) {
                                if (action.data.animate)
                                    await canvas.animatePan(dest);
                                else
                                    canvas.pan(dest);
                            }
                        }
                    }
                },
                content: async (trigger, action) => {
                    let locationName = await MonksActiveTiles.locationName(action.data?.location);
                    return `<span class="action-style">${i18n(trigger.name)}</span> to <span class="details-style">"${locationName}"</span> for <span class="value-style">&lt;${MonksActiveTiles.forPlayersName(action.data?.panfor || "trigger") }&gt;</span>${(action.data.animate ? ' <i class="fas fa-sign-in-alt" title="Animate"></i>' : '')}`;
                }
            },
            'ping': {
                name: "MonksActiveTiles.action.ping",
                ctrls: [
                    {
                        id: "location",
                        name: "MonksActiveTiles.ctrl.select-coordinates",
                        type: "select",
                        subtype: "location",
                        options: { show: ['token', 'players', 'previous', 'tagger'] },
                        restrict: (entity, document) => { return ((entity instanceof foundry.canvas.placeables.Tile || entity instanceof foundry.canvas.placeables.Token) && document.parent.id == entity.parent.id) || document.parent.id == entity.id; },
                        required: true,
                        placeholder: 'Select a location or Tile'
                    },
                    {
                        id: "style",
                        name: "MonksActiveTiles.ctrl.pingstyle",
                        list: () => {
                            return CONFIG.Canvas.pings.types;
                        },
                        type: "list",
                    },
                    {
                        id: "pingfrom",
                        name: "MonksActiveTiles.ctrl.for",
                        list: "from",
                        type: "list",
                        subtype: "for",
                        defvalue: "trigger",
                    }
                ],
                values: {
                    'from': {
                        "everyone": "MonksActiveTiles.for.all",
                        "players": "MonksActiveTiles.for.players",
                        "gm": "MonksActiveTiles.for.gm",
                        "trigger": "MonksActiveTiles.for.triggering",
                        "token": "MonksActiveTiles.for.token",
                        "owner": "MonksActiveTiles.for.owner",
                        "previous": "MonksActiveTiles.for.current"
                    }
                },
                fn: async (args = {}) => {
                    const { tile, action, userId, value } = args;

                    let dests = await MonksActiveTiles.getLocation.call(tile, action.data.location, args);
                    for (let dest of dests) {
                        let pingfrom = action.data.pingfrom || 'trigger';
                        let showUsers = await MonksActiveTiles.getForPlayers(pingfrom, args);
                        if (showUsers.includes(game.user.id)) {
                            canvas.ping({ x: dest.x, y: dest.y }, { style: CONFIG.Canvas.pings.types[action.data.style] });
                            showUsers = showUsers.filter(u => u != game.user.id);
                        }
                        if (showUsers.length) {
                            MonksActiveTiles.emit('ping',
                                {
                                    users: showUsers,
                                    style: action.data.style,
                                    location: { x: dest.x, y: dest.y }
                                });
                        }
                    }
                },
                content: async (trigger, action) => {
                    let locationName = await MonksActiveTiles.locationName(action.data?.location);
                    return `<span class="action-style">${i18n(trigger.name)}</span> <span class="value-style">&lt;${i18n(`MonksActiveTiles.ping.${CONFIG.Canvas.pings.types[action.data.style]}`)}&gt;</span> at <span class="details-style">"${locationName}"</span>`;
                }
            },
            'teleport': {
                name: "MonksActiveTiles.action.teleport",
                ctrls: [
                    {
                        id: "entity",
                        name: "MonksActiveTiles.ctrl.select-entity",
                        type: "select",
                        subtype: "entity",
                        options: { show: ['token', 'within', 'players', 'previous', 'tagger'] },
                        restrict: (entity) => { return (entity instanceof foundry.canvas.placeables.Token); },
                        defaultType: "tokens"
                    },
                    {
                        id: "location",
                        name: "MonksActiveTiles.ctrl.select-coordinates",
                        type: "select",
                        subtype: "either",
                        check: true,
                        options: { show: ['tile', 'previous', 'tagger'] },
                        restrict: (entity, document) => { return (entity instanceof foundry.canvas.placeables.Tile || entity instanceof Scene); },
                        required: true,
                        placeholder: 'Select a location or Tile'
                    },
                    {
                        id: "position",
                        name: "MonksActiveTiles.ctrl.positioning",
                        list: "position",
                        type: "list",
                        conditional: (app) => {
                            let entity = $('input[name="data.location"]', app.element).data("value") || {};
                            return /[a-zA-Z0-9]{16}$/.test(entity?.id) || (entity?.id || "").startsWith("tagger") || (entity?.id || "") == "tile";
                        },
                        defvalue: "random"
                    },
                    {
                        id: "remotesnap",   //using remote snap because I don't want this to trigger the token to be snapped to the grid on the tile
                        name: "MonksActiveTiles.ctrl.snap",
                        type: "checkbox"
                    },
                    {
                        id: "animatepan",
                        name: "MonksActiveTiles.ctrl.animatepan",
                        type: "checkbox"
                    },
                    {
                        id: "triggerremote",
                        name: "MonksActiveTiles.ctrl.triggerremote",
                        type: "checkbox",
                        defvalue: false,
                    },
                    {
                        id: "deletesource",
                        name: "MonksActiveTiles.ctrl.deletesource",
                        type: "checkbox",
                        help: "If you are teleporting between scenes select this to remove the token on the previous scene.",
                        //conditional: (app) => {
                        //    let location = JSON.parse($('input[name="data.location"]', app.element).val() || "{}");
                        //    return !!location.sceneId;
                        //}
                    },
                    {
                        id: "preservesettings",
                        name: "MonksActiveTiles.ctrl.preservesettings",
                        type: "checkbox",
                        help: "If you are teleporting between scenes and want to keep the settings for the tokens on that scene."
                        //conditional: (app) => {
                        //    let location = JSON.parse($('input[name="data.location"]', app.element).val() || "{}");
                        //    return !!location.sceneId;
                        //}
                    },
                    {
                        id: "avoidtokens",
                        name: "MonksActiveTiles.ctrl.avoidtokens",
                        type: "checkbox"
                    },
                    {
                        id: "colour",
                        name: "MonksActiveTiles.ctrl.washcolour",
                        type: "colorpicker"
                    }
                ],
                values: {
                    'position': {
                        'random': "MonksActiveTiles.position.random",
                        'center': "MonksActiveTiles.position.center",
                        'relative': "MonksActiveTiles.position.relative",
                    }
                },
                fn: async (args = {}) => {
                    const { tile, action, pt, userId, value, method, original } = args;

                    let entities = await MonksActiveTiles.getEntities(args);

                    if (!entities || entities.length == 0) {
                        log(i18n('MonksActiveTiles.msg.noteleporttoken'));
                        return;
                    }

                    let result = { continue: true, tokens: entities, entities: entities };

                    let timeout = false;
                    let batch = new BatchManager();
                    const cls = getDocumentClass("Token");

                    let newTokens = [];
                    let offsetPans = [];
                    let switchViews = [];

                    let oldTile = {
                        x: tile.x + (Math.abs(tile.width) / 2),
                        y: tile.y + (Math.abs(tile.height) / 2)
                    }

                    let tokenTransfers = {};

                    for (let tokendoc of entities) {
                        let loc = foundry.utils.duplicate(action.data.location);
                        loc.sceneId = loc.sceneId || tokendoc.parent.id;
                        let dests = await MonksActiveTiles.getLocation.call(tile, loc, args);

                        let midX = ((tokendoc.parent.dimensions.size * Math.abs(tokendoc.width)) / 2);
                        let midY = ((tokendoc.parent.dimensions.size * Math.abs(tokendoc.height)) / 2);

                        let oldPos = {
                            x: tokendoc.x + midX,
                            y: tokendoc.y + midY
                        }

                        let dest = ActionManager.pickRandom(dests, tile.id);
                        let entDest = foundry.utils.duplicate(dest);
                        if (!entDest) {
                            console.warn("monks-active-tiles | Could not find a teleport destination", loc);
                            let newPos = MonksActiveTiles.getSnappedPosition(original.x, original.y);

                            let ray = new foundry.canvas.geometry.Ray({ x: tokendoc.x, y: tokendoc.y }, { x: newPos.x, y: newPos.y });

                            const s = tokendoc.parent.dimensions.size;
                            const speed = s * 6;
                            let duration = (ray.distance * 1000) / speed;
 
                            let time = new Date().getTime() + duration;

                            batch.add("update", tokendoc, { x: newPos.x, y: newPos.y }, { isPaste: true, constrainOptions: { ignoreWalls: true, ignoreCost: true }, bypass: false, originaltile: tile.id, animate: true, animation: { duration, time } });
                            continue;
                        }

                        if (entDest.x && typeof entDest.x == "string" && entDest.x.indexOf('-') > 1) {
                            let parts = entDest.x.split("-");
                            let min = parseInt(parts[0]);
                            let max = parseInt(parts[1]);
                            entDest.x = min + (Math.random() * (max - min));
                        }

                        if (entDest.y && typeof entDest.y == "string" && entDest.y.indexOf('-') > 1) {
                            let parts = entDest.y.split("-");
                            let min = parseInt(parts[0]);
                            let max = parseInt(parts[1]);
                            entDest.y = min + (Math.random() * (max - min));
                        }

                        entDest.x = parseInt(await getValue(entDest.x, args, tokendoc, { prop: tokendoc.x }));
                        entDest.y = parseInt(await getValue(entDest.y, args, tokendoc, { prop: tokendoc.y }));
                        /*
                        if (entDest.x && typeof entDest.x == "string" && (entDest.x.startsWith("+") || entDest.x.startsWith("-"))) {
                            entDest.x = parseInt(eval(`${tokendoc.x} ${entDest.x}`));
                        }
                        if (entDest.y && typeof entDest.y == "string" && (entDest.y.startsWith("+") || entDest.y.startsWith("-"))) {
                            entDest.y = parseInt(eval(`${tokendoc.y} ${entDest.y}`));
                        }*/

                        let scene = (dest.scene == undefined ? tokendoc.parent : game.scenes.get(dest.scene)) || tokendoc.parent;

                        if (dest.dest instanceof TileDocument) {
                            let destpos = action.data.position;

                            if (destpos == "center") {
                                entDest.x = dest.dest.x + (dest.dest.width / 2);
                                entDest.y = dest.dest.y + (dest.dest.height / 2);
                            } else if (destpos == "relative") {
                                let usePt = foundry.utils.duplicate(pt);
                                if (!["enter", "exit", "click", "dblclick", "rightclick", "dblrightclick"].includes(method) && tile.pointWithin(pt))
                                    usePt = foundry.utils.duplicate(oldPos);

                                let deltaX1 = (usePt.x - oldTile.x);
                                let deltaY1 = (usePt.y - oldTile.y);

                                let percX = deltaX1 / (Math.abs(tile.width) / 2);
                                let percY = deltaY1 / (Math.abs(tile.height) / 2);

                                let deltaX2 = (Math.abs(dest.dest.width) / 2) * percX;
                                let deltaY2 = (Math.abs(dest.dest.height) / 2) * percY;

                                if (dest.dest.texture?.scaleX < 0)
                                    deltaX2 = -deltaX2;
                                if (dest.dest.texture?.scaleY < 0)
                                    deltaY2 = -deltaY2;

                                let midDestX = dest.dest.x + (Math.abs(dest.dest.width) / 2);
                                let midDestY = dest.dest.y + (Math.abs(dest.dest.height) / 2);

                                if (parseInt(midDestX + deltaX2).toNearest(dest.dest.parent.dimensions.size) == parseInt(midDestX + deltaX2) && deltaX2 > 0)
                                    deltaX2 *= 0.99;
                                if (parseInt(midDestY + deltaY2).toNearest(dest.dest.parent.dimensions.size) == parseInt(midDestY + deltaY2) && deltaY2 > 0)
                                    deltaY2 *= 0.99;

                                entDest.x = Math.clamp(parseInt(midDestX + deltaX2), dest.dest.x, dest.dest.x + dest.dest.width);
                                entDest.y = Math.clamp(parseInt(midDestY + deltaY2), dest.dest.y, dest.dest.y + dest.dest.height);
                            } else {
                                // Find a random location within this Tile
                                entDest.x = dest.dest.x + Math.floor((Math.random() * Math.abs(dest.dest.width)));
                                entDest.y = dest.dest.y + Math.floor((Math.random() * Math.abs(dest.dest.height)));
                            }

                            if (!dest.dest.pointWithin(entDest)) {
                                // If this dest is not within the Tile, then find a random point
                                entDest.x = dest.dest.x + Math.floor((Math.random() * Math.abs(dest.dest.width)));
                                entDest.y = dest.dest.y + Math.floor((Math.random() * Math.abs(dest.dest.height)));
                            }
                        }

                        if (!entDest.x || !entDest.y)
                            return;

                        //move the token to the new square
                        let newPos = {
                            x: entDest.x,
                            y: entDest.y
                        };

                        let samescene = (dest.scene == undefined || dest.scene == tokendoc.parent.id);
                        //await tokendoc.setFlag('monks-active-tiles', 'teleporting', true);

                        let owners = game.users.filter(u => {
                            return !u.isGM && u.character && u.character.id == tokendoc.actor?.id;
                        }).map(u => u.id);
                        if (!game.user.isGM && userId != game.user.id && !owners.includes(game.user.id))
                            owners.push(game.user.id);

                        let teleportColour = action.data.colour || setting("teleport-colour");

                        let bypass = action.data.triggerremote !== true;

                        if (samescene) {
                            await tokendoc._object?.stopAnimation();   //+++ need to stop the animation for everyone, even if they're not on the same scene
                            if (!rectContains(tokendoc.parent.dimensions.rect, newPos.x, newPos.y)) {
                                //+++find the closest spot on the edge of the scene
                                ui.notifications.error(i18n("MonksActiveTiles.msg.prevent-teleport"));
                                return;
                            }

                            //find a vacant spot
                            if (action.data.avoidtokens) {
                                newPos = MonksActiveTiles.findVacantSpot(newPos, tokendoc, tokendoc.parent, newTokens, entDest, action.data.remotesnap);
                            }

                            if (action.data.remotesnap) {
                                let gs = scene.dimensions.size;
                                newPos.x = Math.floor(newPos.x / gs) * gs;
                                newPos.y = Math.floor(newPos.y / gs) * gs;
                            } else {
                                newPos.x -= midX;
                                newPos.y -= midY;
                            }

                            let offset = { dx: (oldPos.x - midX) - newPos.x, dy: (oldPos.y - midY) - newPos.y };

                            //fade in backdrop
                            if (setting('teleport-wash') && owners.length) {
                                MonksActiveTiles.emit('fade', { users: owners, time: 1000, colour: teleportColour });
                                timeout = action.data.colour != "transparent";
                            }
                            if (userId != game.user.id) {
                                offsetPans.push({ userId: userId, animatepan: action.data.animatepan, x: offset.dx, y: offset.dy });
                            }

                            if (game.modules.get("drag_ruler")?.active && tokendoc.combatant) {
                                window.dragRuler.resetMovementHistory(tokendoc.combatant.combat, tokendoc.combatant.id);
                            }

                            newTokens.push({ x: newPos.x, y: newPos.y, width: tokendoc.width, height: tokendoc.height });

                            batch.add("update", tokendoc, { x: newPos.x, y: newPos.y, 'flags.monks-active-tiles.teleporting': true, 'flags.monks-active-tiles.current': true }, { isPaste: true, constrainOptions: { ignoreWalls: true, ignoreCost: true }, bypass, animate: false, tileTeleport: true, animation: { duration: 0 } });
                            //await tokendoc.update({ x: newPos.x, y: newPos.y }, { bypass: true, animate: false, tileTeleport: true });
                        } else {
                            result.tokens = [];
                            //if the end spot is on a different scene then hide this token, check the new scene for a token for that actor and move it, otherwise create the token on the new scene

                            if (setting('teleport-wash') && owners.length) {
                                MonksActiveTiles.emit('fade', { users: owners, time: 1000, colour: teleportColour });
                                //await MonksActiveTiles.timeout(400);
                            }

                            let newtoken = (tokendoc.actor?.id && tokendoc.actorLink ? scene.tokens.find(t => { return t.actor?.id == tokendoc.actor?.id }) : null);

                            //find a vacant spot
                            if (action.data.avoidtokens)
                                newPos = MonksActiveTiles.findVacantSpot(newPos, tokendoc, scene, newTokens, entDest, action.data.remotesnap);

                            if (action.data.remotesnap) {
                                let gs = scene.dimensions.size;
                                newPos.x = Math.floor(newPos.x / gs) * gs;
                                newPos.y = Math.floor(newPos.y / gs) * gs;
                            } else {
                                newPos.x -= ((scene.dimensions.size * Math.abs(tokendoc.width)) / 2);
                                newPos.y -= ((scene.dimensions.size * Math.abs(tokendoc.height)) / 2);
                            }

                            let td = foundry.utils.mergeObject(await tokendoc.toObject(), { x: newPos.x, y: newPos.y, 'flags.monks-active-tiles.teleporting': true, 'flags.monks-active-tiles.current': true });
                            if (newtoken) {
                                batch.add("update", newtoken, (action.data.preservesettings ?
                                    { x: newPos.x, y: newPos.y, img: tokendoc.texture.src, hidden: tokendoc.hidden, 'flags.monks-active-tiles.teleporting': true, 'flags.monks-active-tiles.current': true } : td),
                                    { isPaste: true, constrainOptions: { ignoreWalls: true, ignoreCost: true }, bypass, animate: false, tileTeleport: true });
                                //await newtoken.update((action.data.preservesettings ? { x: newPos.x, y: newPos.y, hidden: tokendoc.hidden } : td), { bypass: true, animate: false, tileTeleport: true });
                            } else {
                                batch.add("create", cls, td, { parent: scene });
                                //newtoken = await cls.create(td, { parent: scene });
                            }

                            newTokens.push({ x: newPos.x, y: newPos.y, width: tokendoc.width, height: tokendoc.height });

                            //await newtoken.unsetFlag('monks-active-tiles', 'teleporting');

                            //let oldhidden = tokendoc.hidden;
                            if (action.data.deletesource)
                                batch.add("delete", tokendoc);
                            else
                                batch.add("update", tokendoc, { hidden: true });   //hide the old one
                            //batch.add("update", newtoken, { hidden: oldhidden, img: tokendoc.img });   //preserve the image, and hiddenness of the old token

                            if (owners.length) {
                                //pass this back to the player
                                switchViews.push({ users: owners, sceneid: scene.id, newpos: newPos, oldpos: oldPos })
                                //MonksActiveTiles.emit('switchview', { userId: [owners], sceneid: scene.id, newpos: newPos, oldpos: oldPos });
                            }
                            if (!tokenTransfers[scene.id])
                                tokenTransfers[scene.id] = { name: scene.name, tokens: [] };
                            tokenTransfers[scene.id].tokens.push(tokendoc.name);
                            //result.tokens.push(newtoken);
                        }
                        //if (tokendoc && (samescene || !action.data.deletesource))
                        //    await tokendoc.unsetFlag('monks-active-tiles', 'teleporting');
                    }

                    if (Object.keys(tokenTransfers).length) {
                        for (let scene of Object.values(tokenTransfers)) {
                            ui.notifications.warn(`${scene.tokens.join(", ")} has teleported to ${scene.name}`);
                        }
                    }

                    if (timeout)
                        await MonksActiveTiles.timeout(400);

                    for (let offsetPan of offsetPans)
                        MonksActiveTiles.emit('offsetpan', offsetPan);

                    let results = await batch.execute();

                    let merged = batch.mergeResults(results);

                    let tokens = merged.filter(t => { return t.flags["monks-active-tiles"]?.teleporting; });
                    tokens.forEach((t) => {
                        batch.add("update", t, { "flags.monks-active-tiles.-=teleporting": null });
                    });

                    result.tokens = merged.filter(t => { return t.flags["monks-active-tiles"]?.current; });
                    result.tokens.forEach((t) => {
                        batch.add("update", t, { "flags.monks-active-tiles.-=current": null });
                    });

                    await batch.execute();

                    for (let switchView of switchViews) {
                        MonksActiveTiles.emit('switchview', switchView);
                    }

                    window.setTimeout(async function () {
                        let batch = new BatchManager();
                        for (let tokendoc of entities) {
                            if (!tokendoc._destroyed)
                                batch.add("update", tokendoc, { "flags.monks-active-tiles.-=teleporting": null });
                        }
                        await batch.execute();
                    }, 2000);
                    
                    return result;
                },
                content: async (trigger, action) => {
                    let ctrl = trigger.ctrls.find(c => c.id == "entity");
                    let entityName = await MonksActiveTiles.entityName(action.data?.entity || ctrl?.defvalue || "previous");
                    let locationName = await MonksActiveTiles.locationName(action.data?.location);
                    return `<span class="action-style">${i18n(trigger.name)}</span> <span class="entity-style">${entityName}</span> to <span class="details-style">"${locationName}"</span>${(action.data?.remotesnap ? ' <i class="fas fa-compress" title="Snap to grid"></i>' : '')}${(action.data.animatepan ? ' <i class="fas fa-sign-in-alt" title="Animate Pan"></i>' : '')}`;
                }
            },
            'movetoken': {
                name: "MonksActiveTiles.action.movement",
                ctrls: [
                    {
                        id: "entity",
                        name: "MonksActiveTiles.ctrl.select-entity",
                        type: "select",
                        subtype: "entity",
                        options: { show: ['tile', 'token', 'within', 'players', 'previous', 'tagger'] },
                        restrict: (entity) => {
                            return (
                                entity instanceof foundry.canvas.placeables.Token ||
                                entity instanceof foundry.canvas.placeables.Tile ||
                                entity instanceof foundry.canvas.placeables.Drawing ||
                                entity instanceof foundry.canvas.placeables.AmbientLight ||
                                entity instanceof foundry.canvas.placeables.AmbientSound ||
                                entity instanceof foundry.canvas.placeables.Note);
                        },
                        defaultType: "tokens"
                    },
                    {
                        id: "location",
                        name: "MonksActiveTiles.ctrl.select-coordinates",
                        type: "select",
                        subtype: "either",
                        check: true,
                        options: { show: ['token', 'previous', 'tagger', 'origin'] },
                        restrict: (entity, document) => { return (entity instanceof foundry.canvas.placeables.Tile && document.parent.id == entity.parent.id) || document.parent.id == entity.id; },
                        required: true
                    },
                    {
                        id: "position",
                        name: "MonksActiveTiles.ctrl.positioning",
                        list: "position",
                        type: "list",
                        conditional: (app) => {
                            let entity = $('input[name="data.location"]', app.element).data("value") || {};
                            return /^Scene.[a-zA-Z0-9]{16}.Tile.[a-zA-Z0-9]{16}$/.test(entity?.id) || (entity?.id || "").startsWith("tagger");
                        },
                        defvalue: "random"
                    },
                    {
                        id: "snap",   //using remote snap because I don't want this to trigger the token to be snapped to the grid on the tile
                        name: "MonksActiveTiles.ctrl.snap",
                        type: "checkbox",
                        defvalue: true
                    },
                    {
                        id: "duration",
                        name: "MonksActiveTiles.ctrl.duration",
                        type: "number",
                        min: 0,
                        step: 0.05,
                        defvalue: '',
                        help: "Use this if you want the movement to take a specific amount of time, otherwise leave it blank to set a speed for the token to travel"
                    },
                    {
                        id: "speed",
                        name: "MonksActiveTiles.ctrl.speed",
                        type: "number",
                        min: 0,
                        step: 0.05,
                        defvalue: 6,
                        help: "Use this if you want the movement to happen at a specific speed, will be ignored if duration has been set."
                    },
                    {
                        id: "trigger",
                        name: "MonksActiveTiles.ctrl.triggertiles",
                        type: "checkbox"
                    }
                ],
                values: {
                    'position': {
                        'random': "MonksActiveTiles.position.random",
                        'center': "MonksActiveTiles.position.center",
                        'relative': "MonksActiveTiles.position.relative",
                    }
                },
                fn: async (args = {}) => {
                    const { tile, tokens, action, value, pt, method } = args;

                    let oldTile = {
                        x: tile.x + (Math.abs(tile.width) / 2),
                        y: tile.y + (Math.abs(tile.height) / 2)
                    }
                    //wait for animate movement
                    let entities = await MonksActiveTiles.getEntities(args, "tokens");

                    if (entities && entities.length > 0) {
                        //let hasOriginal = !!value.original;

                        //set or toggle visible
                        let result = {};
                        //let promises = [];
                        let batch = new BatchManager();
                        for (let entity of entities) {
                            if (!entity)
                                continue;

                            let object = entity.object;

                            let midX = entity instanceof TokenDocument ? ((Math.abs(entity.width) * entity.parent.dimensions.size) / 2) : Math.abs(entity.width || entity.shape?.width || 0) / 2;
                            let midY = entity instanceof TokenDocument ? ((Math.abs(entity.height) * entity.parent.dimensions.size) / 2) : Math.abs(entity.height || entity.shape?.height || 0) / 2;

                            let oldPos = {
                                x: entity.x + midX,
                                y: entity.y + midY
                            }

                            let location = foundry.utils.duplicate(action.data.location);
                            let dests = await MonksActiveTiles.getLocation.call(tile, location, Object.assign({}, args, { pt: { x: pt?.x - midX, y: pt?.y - midY } }));
                            let dest = ActionManager.pickRandom(dests);

                            let entDest = foundry.utils.duplicate(dest);
                            if (!entDest)
                                continue;

                            if (entDest.x && typeof entDest.x == "string" && entDest.x.indexOf('-') > 1) {
                                let parts = entDest.x.split("-");
                                let min = parseInt(parts[0]);
                                let max = parseInt(parts[1]);
                                entDest.x = min + (Math.random() * (max - min));
                            }

                            if (entDest.y && typeof entDest.y == "string" && entDest.y.indexOf('-') > 1) {
                                let parts = entDest.y.split("-");
                                let min = parseInt(parts[0]);
                                let max = parseInt(parts[1]);
                                entDest.y = min + (Math.random() * (max - min));
                            }

                            /*
                            if (typeof entDest.x == "string" && (entDest.x.startsWith("+") || entDest.x.startsWith("-"))) {
                                entDest.x = parseInt(eval(`${entity.x} ${entDest.x}`));
                                location.id = "origin";
                            }
                            if (typeof entDest.y == "string" && (entDest.y.startsWith("+") || entDest.y.startsWith("-"))) {
                                entDest.y = parseInt(eval(`${entity.y} ${entDest.y}`));
                                location.id = "origin";
                            }
                            */
                            /*
                            if ((typeof entDest.x == "string" && (entDest.x.startsWith("+") || entDest.x.startsWith("-"))) ||
                                (typeof entDest.y == "string" && (entDest.y.startsWith("+") || entDest.y.startsWith("-")))) {
                                location.id = "origin";
                            }*/
                            let relX = (typeof entDest.x == "string" && (entDest.x.startsWith("+") || entDest.x.startsWith("-")));
                            let relY = (typeof entDest.x == "string" && (entDest.y.startsWith("+") || entDest.y.startsWith("-")));
                            entDest.x = parseInt(await getValue(entDest.x, args, entity, { prop: entity.x }));
                            entDest.y = parseInt(await getValue(entDest.y, args, entity, { prop: entity.y }));

                            if (dest.dest instanceof TileDocument) {
                                if (action.data.position == "center") {
                                    entDest.x = dest.dest.x + (dest.dest.width / 2);
                                    entDest.y = dest.dest.y + (dest.dest.height / 2);
                                } else if (action.data.position == "relative") {
                                    let usePt = foundry.utils.duplicate(pt);
                                    if (!["enter", "exit", "click", "dblclick", "rightclick", "dblrightclick"].includes(method) && tile.pointWithin(pt))
                                        usePt = foundry.utils.duplicate(oldPos);

                                    let deltaX = (usePt.x - oldTile.x);
                                    let deltaY = (usePt.y - oldTile.y);

                                    let destW = Math.abs(dest.dest.width);
                                    let destH = Math.abs(dest.dest.width);

                                    if (method == "enter" || method == "exit") {
                                        let hW = ((entity.parent.dimensions.size * Math.abs(entity.width)) / 2);
                                        let hH = ((entity.parent.dimensions.size * Math.abs(entity.height)) / 2);

                                        destW -= (method == "enter" ? hW : -hW);
                                        destH -= (method == "enter" ? hH : -hH);
                                    }

                                    deltaX = deltaX * (destW / Math.abs(tile.width));
                                    deltaY = deltaY * (destH / Math.abs(tile.height));

                                    let midDestX = dest.dest.x + (Math.abs(dest.dest.width) / 2);
                                    let midDestY = dest.dest.y + (Math.abs(dest.dest.height) / 2);

                                    entDest.x = Math.clamp(midDestX + deltaX, dest.dest.x, dest.dest.x + dest.dest.width);
                                    entDest.y = Math.clamp(midDestY + deltaY, dest.dest.y, dest.dest.y + dest.dest.height);
                                } else {
                                    // Find a random location within this Tile
                                    entDest.x = dest.dest.x + Math.floor((Math.random() * Math.abs(dest.dest.width)));
                                    entDest.y = dest.dest.y + Math.floor((Math.random() * Math.abs(dest.dest.height)));
                                }
                            }

                            let newPos = {
                                x: entDest.x,
                                y: entDest.y
                            };

                            if (!rectContains(entity.parent.dimensions.rect, newPos.x, newPos.y)) {
                                //+++find the closest spot on the edge of the scene
                                ui.notifications.error(i18n("MonksActiveTiles.msg.prevent-teleport"));
                                return;
                            }
                            if (action.data.snap) {
                                let gs = entity.parent.dimensions.size;
                                newPos.x = Math.floor(newPos.x / gs) * gs;
                                newPos.y = Math.floor(newPos.y / gs) * gs;
                            } //else if (!(entity instanceof TileDocument)) {
                                //if (!relX)
                                    //newPos.x -= midX;
                                //if(!relY)
                                    //newPos.y -= midY;
                            //}

                            let ray = new foundry.canvas.geometry.Ray({ x: entity.x, y: entity.y }, { x: newPos.x, y: newPos.y });

                            let duration = 0;
                            if (action.data?.duration == undefined) {
                                const s = entity.parent.dimensions.size;
                                const speed = s * (action.data?.speed ?? 6);
                                duration = (ray.distance * 1000) / speed;
                            } else
                                duration = action.data?.duration * 1000;
                            let time = new Date().getTime() + duration;

                            /*
                            delete entity._matt_locations;
                            if (dest.points) {
                                entity._matt_locations = {
                                    points: dest.points,
                                    index: 0,
                                    duration: action.data?.duration,
                                    speed: action.data?.speed,
                                    repeat: dest.repeat
                                }
                            }
                            */

                            batch.add("update", entity, { x: newPos.x, y: newPos.y }, { isPaste: true, bypass: !action.data.trigger, originaltile: tile.id, animate: true, animation: { duration, time } });

                            MonksActiveTiles.addToResult(entity, result);
                        }

                        await batch.execute();
                        /*
                        for (let entity of entities) {
                            let anim = foundry.canvas.animation.CanvasAnimation.getAnimation(entity._object.animationName);
                            if (anim && entity._matt_locations) {
                                let fn = async (entity) => {
                                    if (entity._matt_locations){
                                        let idx = entity._matt_locations.index ?? 0;
                                        let pt = Object.assign({}, entity._matt_locations.points[idx]);
                                        pt.x -= (Math.abs(entity.width) * entity.parent.dimensions.size) / 2;
                                        pt.y -= (Math.abs(entity.height) * entity.parent.dimensions.size) / 2;

                                        entity._matt_locations.index = entity._matt_locations.index + 1;
                                
                                        let duration = 0;
                                        if (entity._matt_locations.duration == undefined) {
                                            let ray = new foundry.canvas.geometry.Ray({ x: entity.x, y: entity.y }, { x: pt.x, y: pt.y });
                                            const s = canvas.dimensions.size;
                                            const speed = s * (entity._matt_locations.speed ?? 6);
                                            duration = (ray.distance * 1000) / speed;
                                        } else
                                            duration = entity._matt_locations.duration * 1000;

                                        if (entity._matt_locations.index >= entity._matt_locations.points.length) {
                                            if (!entity._matt_locations.repeat)
                                                delete entity._matt_locations;
                                            else
                                                entity._matt_locations.index = 1;
                                        }

                                        await entity.update(pt, { animate: true, animation: { duration } });
                                        let anim = foundry.canvas.animation.CanvasAnimation.getAnimation(entity._object.animationName);
                                        if (anim && entity._matt_locations)
                                            anim.promise.then(fn);
                                    }
                                }
                                anim.promise.then(fn);
                            }
                        }
                        */

                        return result;
                    }
                },
                content: async (trigger, action) => {
                    let ctrl = trigger.ctrls.find(c => c.id == "entity");
                    let entityName = await MonksActiveTiles.entityName(action.data?.entity || ctrl?.defvalue || "previous");
                    let locationName = await MonksActiveTiles.locationName(action.data?.location);
                    return `<span class="action-style">${i18n(trigger.name)}</span> <span class="entity-style">${entityName}</span> to <span class="details-style">"${locationName}"</span>${(action.data?.snap ? ' <i class="fas fa-compress" title="Snap to grid"></i>' : '')}${(action.data?.wait ? ' <i class="fas fa-clock" title="Wait until finished"></i>' : '')}${(action.data?.trigger ? ' <i class="fas fa-running" title="Trigger tiles while moving"></i>' : '')}`;
                }
            },
            'rotation': {
                name: "MonksActiveTiles.action.rotation",
                ctrls: [
                    {
                        id: "entity",
                        name: "MonksActiveTiles.ctrl.select-entity",
                        type: "select",
                        subtype: "entity",
                        options: { show: ['tile', 'token', 'within', 'players', 'previous', 'tagger'] },
                        restrict: (entity) => {
                            return (
                                entity instanceof foundry.canvas.placeables.Token ||
                                entity instanceof foundry.canvas.placeables.Tile ||
                                entity instanceof foundry.canvas.placeables.Drawing ||
                                entity instanceof foundry.canvas.placeables.AmbientLight
                            );
                        }
                    },
                    {
                        id: "rotation",
                        name: "MonksActiveTiles.ctrl.rotation",
                        type: "text",
                        required: true,
                        defvalue: ""
                    },
                    {
                        id: "duration",
                        name: "MonksActiveTiles.ctrl.duration",
                        type: "number",
                        min: 0,
                        step: 0.05,
                        defvalue: 5
                    }
                ],
                fn: async (args = {}) => {
                    const { action } = args;
                    //wait for animate movement
                    let entities = await MonksActiveTiles.getEntities(args);

                    if (entities && entities.length > 0) {

                        let promises = [];
                        let batch = new BatchManager();
                        for (let entity of entities) {
                            let object = entity.object;

                            let duration = (action.data?.duration ?? 5) * 1000;
                            let time = new Date().getTime() + duration;

                            let rotation = parseFloat(await getValue(action.data.rotation, args, entity, { prop: entity.rotation })) || 0;

                            batch.add("update", entity, { rotation: rotation }, { bypass: !action.data.trigger, animate: true, animation: { duration, time } });
                        }
                        if (promises.length) {
                            //if (action.data.wait)
                            //    await Promise.all(promises).then(() => { batch.execute() });
                            //else
                            Promise.all(promises).then(() => { batch.execute() });
                        } else {
                            //if (action.data.wait)
                            await batch.execute();
                            //else
                            //    batch.execute();
                        }

                        let result = { entities: entities };
                        if (entities[0] instanceof TokenDocument)
                            result.tokens = entities;
                        return result;
                    }
                },
                content: async (trigger, action) => {
                    let ctrl = trigger.ctrls.find(c => c.id == "entity");
                    let entityName = await MonksActiveTiles.entityName(action.data?.entity || ctrl?.defvalue || "previous");
                    return `<span class="action-style">${i18n(trigger.name)}</span> <span class="entity-style">${entityName}</span> rotate to <span class="details-style">"${action.data.rotation}"</span>`;
                }
            },
            'showhide': {
                name: "MonksActiveTiles.action.showhide",
                requiresGM: true,
                batch: true,
                ctrls: [
                    {
                        id: "entity",
                        name: "MonksActiveTiles.ctrl.select-entity",
                        type: "select",
                        subtype: "entity",
                        check: true,
                        options: { show: ['tile', 'token', 'within', 'players', 'previous', 'tagger'] },
                        restrict: (entity) => { return (entity instanceof foundry.canvas.placeables.Token || entity instanceof foundry.canvas.placeables.Tile || entity instanceof foundry.canvas.placeables.Drawing); }
                    },
                    {
                        id: "collection",
                        name: "Collection",
                        list: "collection",
                        type: "list",
                        onChange: (app, ctrl, action, data) => {
                            let displayName = game.i18n.format("MonksActiveTiles.CurrentCollection", { collection: $(ctrl).val() || "tokens" });
                            $('input[name="data.entity"]', app.element).next().html(displayName);
                        },
                        conditional: (app) => {
                            let entity = $('input[name="data.entity"]', app.element).data("value") || {};
                            return entity?.id == 'previous';
                        },
                        defvalue: 'tokens'
                    },
                    {
                        id: "hidden",
                        name: "MonksActiveTiles.ctrl.state",
                        list: "hidden",
                        type: "list",
                        defvalue: 'hide'
                    },
                    {
                        id: "fade",
                        name: "MonksActiveTiles.ctrl.duration",
                        type: "number",
                        min: 0,
                        step: 0.05,
                        defvalue: 0
                    }
                ],
                values: {
                    'hidden': {
                        'show': "MonksActiveTiles.hidden.show",
                        'hide': "MonksActiveTiles.hidden.hide",
                        'toggle': "MonksActiveTiles.hidden.toggle"
                    },
                    'collection': {
                        'tokens': "Tokens",
                        'tiles': "Tiles",
                        'drawings': "Drawings"
                    }
                },
                fn: async (args = {}) => {
                    const { action } = args;
                    //find the item in question
                    let entities = await MonksActiveTiles.getEntities(args, action.data?.collection || "tokens");
                    entities = entities.filter(e => { return (e instanceof TokenDocument || e instanceof TileDocument || e instanceof DrawingDocument); });

                    if (entities && entities.length > 0) {
                        //set or toggle visible
                        let result = { entities: entities };
                        for (let entity of entities) {
                            if (entity) {
                                let hide = (action.data.hidden == 'toggle' ? !entity.hidden : (action.data.hidden == 'previous' ? !value.visible : action.data.hidden !== 'show'));

                                if (action.data?.fade) {
                                    let duration = (action.data?.fade ?? 5) * 1000;
                                    let time = new Date().getTime() + duration;
                                    MonksActiveTiles.batch.add("update", entity, { hidden: hide }, { animation: { duration, time } });
                                } else
                                    MonksActiveTiles.batch.add("update", entity, { hidden: hide }, { animation: { duration: 0 } });

                                MonksActiveTiles.addToResult(entity, result);
                            }
                        }

                        return result;
                    }
                },
                content: async (trigger, action) => {
                    let ctrl = trigger.ctrls.find(c => c.id == "entity");
                    let entityName = await MonksActiveTiles.entityName(action.data?.entity || ctrl?.defvalue || "previous", action.data?.collection || "tokens");
                    return `<span class="action-style">${i18n(trigger.values.hidden[action.data?.hidden]) + (action.data?.activate == "toggle" ? " Visibility" : "")}</span> <span class="entity-style">${entityName}</span>${action.data?.fade ? ', Fade after <span class="value-style">&lt;' + action.data?.fade + '&gt; sec</span>' : ''}`;
                }
            },
            'create': {
                name: "MonksActiveTiles.action.createtoken",
                ctrls: [
                    {
                        id: "entity",
                        name: "MonksActiveTiles.ctrl.select-entity",
                        type: "select",
                        subtype: "entity",
                        options: { show: ['token', 'players', 'previous'] },
                        restrict: (entity) => { return (entity instanceof Actor || entity instanceof JournalEntry || entity instanceof Note); },
                        check: true,
                        required: true,
                        defaultType: 'actors',
                        placeholder: 'Please select an Actor or Encounter to create'
                    },
                    {
                        id: "collection",
                        name: "Collection",
                        list: "collection",
                        type: "list",
                        onChange: (app, ctrl, action, data) => {
                            let displayName = game.i18n.format("MonksActiveTiles.CurrentCollection", { collection: $(ctrl).val() || "actors" });
                            $('input[name="data.entity"]', app.element).next().html(displayName);
                        },
                        conditional: (app) => {
                            let entity = $('input[name="data.entity"]', app.element).data("value") || {};
                            return entity?.id == 'previous';
                        },
                        defvalue: 'actors'
                    },
                    {
                        id: "location",
                        name: "MonksActiveTiles.ctrl.select-coordinates",
                        type: "select",
                        subtype: "either",
                        options: { show: ['tile', 'previous', 'tagger'] },
                        restrict: (entity, document) => { return (entity instanceof foundry.canvas.placeables.Tile && document.parent.id == entity.parent.id) || document.parent.id == entity.id; },
                        required: true
                    },
                    {
                        id: "position",
                        name: "MonksActiveTiles.ctrl.positioning",
                        list: "position",
                        type: "list",
                        conditional: (app) => {
                            let entity = $('input[name="data.location"]', app.element).data("value") || {};
                            return /^Scene.[a-zA-Z0-9]{16}.Tile.[a-zA-Z0-9]{16}$/.test(entity?.id) || (entity?.id || "").startsWith("tagger") || (entity?.id == "tile");
                        },
                        defvalue: "random"
                    },
                    {
                        id: "activetoken",
                        name: "MonksActiveTiles.ctrl.activetoken",
                        type: "checkbox",
                        conditional: (app) => {
                            let entity = $('input[name="data.entity"]', app.element).data("value") || {};
                            return entity?.id == 'players';
                        },
                        defvalue: true
                    },

                    {
                        id: "snap",   //using remote snap because I don't want this to trigger the token to be snapped to the grid on the tile
                        name: "MonksActiveTiles.ctrl.snap",
                        type: "checkbox",
                        defvalue: true
                    },
                    {
                        id: "invisible",
                        name: "MonksActiveTiles.ctrl.invisible",
                        type: "checkbox",
                        defvalue: false
                    },
                    {
                        id: "avoidtokens",
                        name: "MonksActiveTiles.ctrl.avoidtokens",
                        type: "checkbox"
                    }
                ],
                values: {
                    'collection': {
                        'actors': "Actors",
                        'journal': "Journal Entries"
                    },
                    'position': {
                        'random': "MonksActiveTiles.position.random",
                        'center': "MonksActiveTiles.position.center"
                    }
                },
                fn: async (args = {}) => {
                    const { tile, action, value } = args;
                    //find the item in question
                    let entities = await MonksActiveTiles.getEntities(args, action.data?.collection || 'actors', (action.data?.entity?.id == "players" && action.data?.activetoken ? { id: "players:active" } : null));

                    if (entities && entities.length > 0) {
                        let dests = await MonksActiveTiles.getLocation.call(tile, action.data.location, args);

                        const actors = [];
                        for (let entity of entities) {
                            if (entity instanceof NoteDocument) {
                                if (action.data.location.id == "previous") {
                                    dests = [{ x: entity.x, y: entity.y }];
                                }
                                entity = entity.entry;
                            }
                            if (entity instanceof TokenDocument) {
                                entity = entity.actor;
                            }
                            if (entity instanceof JournalEntry) {
                                if (game.modules.get("monks-enhanced-journal")?.active && entity.pages.size == 1 && (foundry.utils.getProperty(entity.pages.contents[0], "flags.monks-enhanced-journal.actors") || []).length) {
                                    let eaactors = foundry.utils.getProperty(entity.pages.contents[0], "flags.monks-enhanced-journal.actors");
                                    for (let ea of eaactors) {
                                        let actor;
                                        if (ea.pack) {
                                            const pack = game.packs.get(ea.pack);
                                            let id = ea.id;
                                            if (ea.lookup) {
                                                if (!pack.index.length) await pack.getIndex();
                                                const entry = pack.index.find(i => (i._id === ea.lookup) || (i.name === ea.lookup));
                                                id = entry.id;
                                            }
                                            actor = id ? await pack.getDocument(id) : null;
                                        } else {
                                            actor = game.actors.get(ea.id);
                                        }

                                        if (actor) {
                                            let quantity = String(ea.quantity || "1");
                                            if (quantity.indexOf("d") != -1) {
                                                let roll = await rollDice(quantity);
                                                quantity = roll.value;
                                            } else {
                                                quantity = parseInt(quantity);
                                                if (isNaN(quantity)) quantity = 1;
                                            }

                                            for (let i = 0; i < (quantity || 1); i++) {
                                                let tdests = (ea.location ? dests.filter(d => d.dest ? Tagger.hasTags(d.dest, ea.location) : d) : dests);
                                                let dest = ActionManager.pickRandom(tdests, tile.id);

                                                let entDest = foundry.utils.duplicate(dest);
                                                if (!entDest)
                                                    continue;

                                                if (entDest) {
                                                    if (dest.dest instanceof TileDocument) {
                                                        if (action.data.position == "center") {
                                                            entDest.x = dest.dest.x + (dest.dest.width / 2);
                                                            entDest.y = dest.dest.y + (dest.dest.height / 2);
                                                        } else {
                                                            // Find a random location within this Tile
                                                            let midX = ((canvas.scene.dimensions.size * Math.abs(entity.width ?? 1)) / 2);
                                                            let midY = ((canvas.scene.dimensions.size * Math.abs(entity.height ?? 1)) / 2);
                                                            entDest.x = (dest.dest.x + midX) + Math.floor((Math.random() * (Math.abs(dest.dest.width) - (Math.abs(actor.prototypeToken.width) * canvas.scene.dimensions.size))));
                                                            entDest.y = (dest.dest.y + midY) + Math.floor((Math.random() * (Math.abs(dest.dest.height) - (Math.abs(actor.prototypeToken.height) * canvas.scene.dimensions.size))));
                                                        }
                                                    }
                                                    let data = {
                                                        x: entDest.x,
                                                        y: entDest.y,
                                                        hidden: action.data.invisible || ea.hidden
                                                    };

                                                    actors.push({ data, actor, dest: dest });
                                                }
                                            }
                                        }
                                    }
                                } else if (entity.flags["quick-encounters"]?.quickEncounter && game.modules.get("quick-encounters")?.active) {
                                    try {
                                        let data = JSON.parse(entity.flags["quick-encounters"]?.quickEncounter);

                                        for (let ea of (data.extractedActors || [])) {
                                            let actor;
                                            if (ea.dataPackName) {
                                                const pack = game.packs.get(ea.dataPackName);
                                                let id = ea.actorID;
                                                if (ea.lookup) {
                                                    if (!pack.index.length) await pack.getIndex();
                                                    const entry = pack.index.find(i => (i._id === ea.lookup) || (i.name === ea.lookup));
                                                    id = entry.id;
                                                }
                                                actor = id ? await pack.getDocument(id) : null;
                                            } else {
                                                actor = game.actors.get(ea.actorID);
                                            }

                                            if (actor) {
                                                for (let i = 0; i < ea.numActors; i++) {
                                                    let sa = ea.savedTokensData[i] || {};
                                                    sa.hidden = sa.hidden || action.data.invisible;
                                                    sa.lockpos = true;
                                                    let data = { data: sa, actor, lockpos: true, dest: dest };
                                                    if ((action.data.location.id == "previous" && value.location == undefined && ea.savedTokensData[i] == undefined)
                                                        || sa.x == undefined
                                                        || sa.y == undefined) {
                                                        let dest = dests[Math.floor(Math.random() * dests.length)];
                                                        if (dest) {
                                                            data.data.x = dest.x;
                                                            data.data.y = dest.y;
                                                        }
                                                        data.lockpos = false;
                                                    }
                                                    actors.push(data);
                                                }
                                            }
                                        }
                                    } catch (err) {
                                        log(err);
                                    }
                                }
                            } else if (entity instanceof Actor) {
                                let dest = dests[Math.floor(Math.random() * dests.length)];

                                let entDest = foundry.utils.duplicate(dest);
                                if (entDest) {
                                    if (dest.dest instanceof TileDocument) {
                                        // Find a random location within this Tile
                                        if (dest.dest instanceof TileDocument) {
                                            if (action.data.position == "center") {
                                                entDest.x = dest.dest.x + (dest.dest.width / 2);
                                                entDest.y = dest.dest.y + (dest.dest.height / 2);
                                            } else {
                                                // Find a random location within this Tile
                                                let midX = ((canvas.scene.dimensions.size * Math.abs(entity.prototypeToken.width)) / 2);
                                                let midY = ((canvas.scene.dimensions.size * Math.abs(entity.prototypeToken.height)) / 2);
                                                entDest.x = (dest.dest.x + midX) + Math.floor((Math.random() * (Math.abs(dest.dest.width) - (Math.abs(entity.prototypeToken.width) * canvas.scene.dimensions.size))));
                                                entDest.y = (dest.dest.y + midY) + Math.floor((Math.random() * (Math.abs(dest.dest.height) - (Math.abs(entity.prototypeToken.height) * canvas.scene.dimensions.size))));
                                            }
                                        }
                                    } else {
                                        if (entDest.x) {
                                            let roll = await rollDice(entDest.x);
                                            entDest.x = roll.value;
                                        }
                                        if (entDest.y) {
                                            let roll = await rollDice(entDest.y);
                                            entDest.y = roll.value;
                                        }
                                    }
                                    let data = {
                                        x: entDest.x,
                                        y: entDest.y,
                                        hidden: action.data.invisible
                                    };
                                    actors.push({ data, actor: entity, dest: dest });
                                } else {
                                    ui.notifications.warn("Invalid location selected to create token.");
                                }
                            }
                        };

                        const cls = getDocumentClass("Token");
                        let result = { continue: true, tokens: [], entities: entities };
                        let batch = new BatchManager();

                        let newTokens = [];

                        for (let ad of actors) {
                            let actor = ad.actor;
                            let scene = ad.dest.scene ? game.scenes.get(ad.dest.scene) || tile.parent : tile.parent;

                            if (actor.compendium) {
                                const actorData = game.actors.fromCompendium(actor);
                                actor = await Actor.implementation.create(actorData);
                            }

                            // Prepare the Token data
                            const td = await actor.getTokenDocument();
                            foundry.utils.mergeObject(td, ad.data);

                            if (game.system.id === "pf2e")
                                td.detectionModes = [];

                            if (!ad.lockpos) {
                                if (action.data.avoidtokens) {
                                    let dt = foundry.utils.mergeObject(ad.data, MonksActiveTiles.findVacantSpot(ad.data, { data: td }, scene, newTokens, ad.dest, action.data.snap));
                                    td.x = dt.x;
                                    td.y = dt.y;
                                }

                                // Bypass snapping
                                if (!action.data.snap) {
                                    td.x -= (td.width * canvas.grid.sizeX / 2);
                                    td.y -= (td.height * canvas.grid.sizeY / 2);
                                }
                                // Otherwise snap to nearest vertex, adjusting for large tokens
                                else {
                                    const hw = canvas.grid.sizeX / 2;
                                    const hh = canvas.grid.sizeY / 2;
                                    let pos = MonksActiveTiles.getSnappedPosition(td.x - (td.width * hw), td.y - (td.height * hh))
                                    td.x = pos.x;
                                    td.y = pos.y;
                                }
                            }

                            // Validate the final position
                            if (!rectContains(canvas.dimensions.rect, td.x, td.y)) continue;

                            //if (td.hidden)
                            //    foundry.utils.setProperty(td, "flags.monks-active-tiles.hide", true);

                            // Submit the Token creation request and activate the Tokens layer (if not already active)
                            batch.add("create", cls, td, { parent: scene });
                            //let tkn = await cls.create(td, { parent: tile.parent });

                            //if (td.hidden)
                            //    tkn.update({ hidden: true });

                            //result.tokens.push(tkn);
                            newTokens.push({ x: td.x, y: td.y, width: td.width, height: td.height });
                        }
                        let tokens = await batch.execute();
                        tokens = batch.mergeResults(tokens);

                        //for (let token of tokens) {
                        //    if (foundry.utils.getProperty(token, "flags.monks-active-tiles.hidden")) {
                        //        batch.add("update", token, { "hidden": true, "flags.monks-active-tiles.-=hidden": null });
                        //    }
                        //}
                        //await batch.execute();

                        result.tokens = result.tokens.concat(tokens);

                        return result;
                    }
                },
                content: async (trigger, action) => {
                    let ctrl = trigger.ctrls.find(c => c.id == "entity");
                    let entityName = await MonksActiveTiles.entityName(action.data?.entity || ctrl?.defvalue || "previous", action.data?.collection || ctrl.defaultType);
                    let locationName = await MonksActiveTiles.locationName(action.data?.location);
                    return `<span class="action-style">${i18n(trigger.name)}</span> <span class="entity-style">${entityName}</span> at <span class="details-style">"${locationName}"</span>${(action.data?.snap ? ' <i class="fas fa-compress" title="Snap to grid"></i>' : '')}${(action.data?.invisible ? ' <i class="fas fa-eye-slash" title="Invisible"></i>' : '')}`;
                }
            },
            'createjournal': {
                name: "MonksActiveTiles.action.createjournal",
                ctrls: [
                    {
                        id: "entity",
                        name: "MonksActiveTiles.ctrl.select-entity",
                        type: "select",
                        subtype: "entity",
                        options: { show: ['previous'] },
                        restrict: (entity) => { return (entity instanceof JournalEntry || entity instanceof foundry.canvas.placeables.Note); },
                        required: true,
                        defaultType: 'journal',
                        placeholder: 'Please select a Journal Entry to add to the canvas'
                    },
                    {
                        id: "location",
                        name: "MonksActiveTiles.ctrl.select-coordinates",
                        type: "select",
                        subtype: "either",
                        restrict: (entity, document) => { return (entity instanceof foundry.canvas.placeables.Tile && document.parent.id == entity.parent.id) || document.parent.id == entity.id; },
                        required: true
                    },
                    {
                        id: "icon",
                        name: "MonksActiveTiles.ctrl.icon",
                        list: () => {
                            let list = {};
                            Object.entries(CONFIG.JournalEntry.noteIcons).filter(([k, v]) => { list[v] = k; });
                            return list;
                        },
                        type: "list",
                        defvalue: 'icons/svg/book.svg'
                    },
                    {
                        id: "snap",   //using remote snap because I don't want this to trigger the token to be snapped to the grid on the tile
                        name: "MonksActiveTiles.ctrl.snap",
                        type: "checkbox",
                        defvalue: true
                    }
                ],
                fn: async (args = {}) => {
                    const { tile, action, value } = args;
                    //find the item in question
                    let entities = await MonksActiveTiles.getEntities(args, 'journal');

                    if (entities && entities.length > 0) {
                        let batch = new BatchManager();
                        const cls = getDocumentClass("Note");
                        for (let entity of entities) {
                            let dests = await MonksActiveTiles.getLocation.call(tile, action.data.location, args);

                            let result = { continue: true, entities: [] };
                            if (!dests.length)
                                return result;

                            if (entity instanceof NoteDocument) {
                                if (action.data.location.id == "previous") {
                                    dests = [{ x: entity.x, y: entity.y }];
                                }
                                entity = entity.entry;
                            }
                            if (entity instanceof JournalEntry) {
                                if (entity?.compendium) {
                                    const journalData = game.journal.fromCompendium(entity);
                                    entity = await JournalEntry.implementation.create(journalData);
                                }

                                let dest = ActionManager.pickRandom(dests, tile.id);

                                if (dest.dest instanceof TileDocument) {
                                    // Find a random location within this Tile
                                    dest.x = dest.dest.x + Math.floor((Math.random() * Math.abs(dest.dest.width)));
                                    dest.y = dest.dest.y + Math.floor((Math.random() * Math.abs(dest.dest.height)));
                                } else {
                                    if (dest.x) {
                                        let roll = await rollDice(dest.x);
                                        dest.x = roll.value;
                                    }
                                    if (dest.y) {
                                        let roll = await rollDice(dest.y);
                                        dest.y = roll.value;
                                    }
                                }

                                let data = {
                                    x: dest.x,
                                    y: dest.y,
                                    entryId: entity.id,
                                    icon: action.data.icon
                                };

                                // Snap to Grid
                                if (action.data.snap) {
                                    let snap = MonksActiveTiles.getSnappedPosition(data.x, data.y, 2);
                                    data.x = snap.x;
                                    data.y = snap.y;
                                }

                                // Validate the final position
                                if (!rectContains(canvas.dimensions.rect, data.x, data.y)) return;


                                batch.add("create", cls, data, { parent: tile.parent });
                                MonksActiveTiles.addToResult(entity, result);
                            }
                        }

                        let notes = await batch.execute();
                        let results = {};
                        results.entities = batch.mergeResults(notes);

                        return results;
                    }
                },
                content: async (trigger, action) => {
                    let ctrl = trigger.ctrls.find(c => c.id == "entity");
                    let entityName = await MonksActiveTiles.entityName(action.data?.entity || ctrl?.defvalue || "previous", 'journal');
                    let locationName = await MonksActiveTiles.locationName(action.data?.location);
                    return `<span class="action-style">${i18n(trigger.name)}</span> <span class="entity-style">${entityName}</span> at <span class="details-style">"${locationName}"</span>${(action.data?.snap ? ' <i class="fas fa-compress" title="Snap to grid"></i>' : '')}`;
                }
            },
            'activate': {
                name: "MonksActiveTiles.action.activate",
                requiresGM: true,
                batch: true,
                ctrls: [
                    {
                        id: "entity",
                        name: "MonksActiveTiles.ctrl.select-entity",
                        type: "select",
                        subtype: "entity",
                        options: { show: ['tile', 'within', 'previous', 'tagger'] },
                        restrict: (entity) => {
                            return (entity instanceof foundry.canvas.placeables.Tile || entity instanceof foundry.canvas.placeables.AmbientLight || entity instanceof foundry.canvas.placeables.AmbientSound || entity.constructor.name == "Terrain");
                        },
                        check: true,
                        defvalue: 'tile',
                        defaultType: 'tiles'
                    },
                    {
                        id: "collection",
                        name: "Collection",
                        list: "collection",
                        type: "list",
                        onChange: (app, ctrl, action, data) => {
                            let entity = $('input[name="data.entity"]', app.element).data("value") || {};
                            let displayName = entity?.id == 'within' ? game.i18n.format("MonksActiveTiles.WithinTile", { collection: ($(ctrl).val() || "tiles").capitalize() }) : game.i18n.format("MonksActiveTiles.CurrentCollection", { collection: $(ctrl).val() || "tiles" });
                            $('input[name="data.entity"]', app.element).next().html(displayName);
                        },
                        conditional: (app) => {
                            let entity = $('input[name="data.entity"]', app.element).data("value") || {};
                            return entity?.id == 'previous' || entity?.id == 'within';
                        },
                        defvalue: 'tiles'
                    },
                    {
                        id: "activate",
                        name: "MonksActiveTiles.ctrl.state",
                        list: "activate",
                        type: "list",
                        defvalue: 'deactivate'
                    }
                ],
                values: {
                    'activate': {
                        'deactivate': "MonksActiveTiles.activate.deactivate",
                        'activate': "MonksActiveTiles.activate.activate",
                        'toggle': "MonksActiveTiles.activate.toggle",
                        'previous': "MonksActiveTiles.activate.previous"

                    },
                    'collection': {
                        'lights': "Lights",
                        'sounds': "Sounds",
                        'tiles': "Tiles",
                    }
                },
                fn: async (args = {}) => {
                    const { action, value } = args;
                    let entities = await MonksActiveTiles.getEntities(args, action.data?.collection || ActionManager.getDefaultType("activate", "entity"));
                    if (entities.length == 0)
                        return;

                    for (let entity of entities) {
                        if (entity) {
                            if (entity instanceof AmbientLightDocument || entity instanceof AmbientSoundDocument || entity._object?.constructor.name == "Terrain") {
                                let hidden = (action.data.activate == 'toggle' ? !entity.hidden : (action.data.activate == 'previous' ? !value.activate : action.data.activate != 'activate'));
                                MonksActiveTiles.batch.add("update", entity, { hidden: hidden });
                            } else if (entity instanceof TileDocument) {
                                let active = (action.data.activate == 'toggle' ? !entity.flags['monks-active-tiles'].active : (action.data.activate == 'previous' ? !value.activate : action.data.activate == 'activate'));
                                MonksActiveTiles.batch.add("update", entity, { 'flags.monks-active-tiles.active': active });
                            }
                        }
                    }
                },
                content: async (trigger, action) => {
                    let ctrl = trigger.ctrls.find(c => c.id == "entity");
                    let entityName = await MonksActiveTiles.entityName(action.data?.entity || ctrl?.defvalue || "previous", action.data?.collection || ctrl?.defaultType);
                    return `<span class="action-style">${action.data?.activate == "previous" ? "Activate from previous value" : i18n(trigger.values.activate[action.data?.activate]) + (action.data?.activate == "toggle" ? " Activation" : "")}</span> <span class="entity-style">${entityName}</span>`;
                }
            },
            'alter': {
                name: "MonksActiveTiles.action.alter",
                requiresGM: true,
                batch: true,
                ctrls: [
                    {
                        id: "entity",
                        name: "MonksActiveTiles.ctrl.select-entity",
                        type: "select",
                        subtype: "entity",
                        check: true,
                        options: { show: ['tile', 'token', 'within', 'players', 'previous', 'tagger'] }
                    },
                    {
                        id: "collection",
                        name: "Collection",
                        list: "collection",
                        type: "list",
                        onChange: (app, ctrl, action, data) => {
                            let displayName = game.i18n.format("MonksActiveTiles.CurrentCollection", { collection: $(ctrl).val() || "tokens" });
                            $('input[name="data.entity"]', app.element).next().html(displayName);
                        },
                        conditional: (app) => {
                            let entity = $('input[name="data.entity"]', app.element).data("value") || {};
                            return entity?.id == 'previous';
                        },
                        defvalue: 'tokens'
                    },
                    {
                        id: "attribute",
                        name: "MonksActiveTiles.ctrl.attribute",
                        type: "text",
                        required: true,
                    },
                    {
                        id: "value",
                        name: "MonksActiveTiles.ctrl.value",
                        type: "text",
                        check: true,
                        help: `* Use a space to increase the value <span class="matt-code">+ 1</span>. <br/>* Leave the space out to set the value <span class="matt-code">-10</span>. <br/>* Accepts random numbers <span class="matt-code">[[1d4]]</span>. <br/> * For strings, place them inside quotation marks <span class="matt-code">= "Name"</span>.`
                    },
                    {
                        id: "chatMessage",
                        name: "MonksActiveTiles.ctrl.chatmessage",
                        type: "checkbox",
                        conditional: (app) => {
                            return $('input[name="data.value"]', app.element).val().includes('[[');
                        }
                    },
                    {
                        id: "rollmode",
                        name: 'MonksActiveTiles.ctrl.rollmode',
                        list: "rollmode",
                        type: "list",
                        conditional: (app) => {
                            return $('input[name="data.value"]', app.element).val().includes('[[');
                        }
                    }
                ],
                values: {
                    'rollmode': {
                        "roll": 'MonksActiveTiles.rollmode.public',
                        "gmroll": 'MonksActiveTiles.rollmode.private',
                        "blindroll": 'MonksActiveTiles.rollmode.blind',
                        "selfroll": 'MonksActiveTiles.rollmode.self'
                    },
                    'collection': {
                        'actors': "Actors",
                        'drawings': "Drawings",
                        'items': "Items",
                        'journal': "Journal Entries",
                        'macros': "Macros",
                        'playlists': "Playlists",
                        'scene': "Scene",
                        'tiles': "Tiles",
                        'tokens': "Tokens",
                        'walls': "Walls"
                    }
                },
                fn: async (args = {}) => {
                    const { tile, tokens, action, userId, value, method, change } = args;
                    let entities = await MonksActiveTiles.getEntities(args, action.data?.collection || "tokens");

                    let result = { entities: entities };

                    let _attr = action.data.attribute.trim();
                    let _val = action.data.value.trim();

                    if (entities && entities.length > 0 && _attr != "" && _val != undefined) {
                        for (let entity of entities) {
                            if (entity) {
                                let base = entity;
                                let val = foundry.utils.duplicate(_val);
                                let attr = foundry.utils.duplicate(_attr);

                                let update = {};

                                if (!attr.startsWith('flags')) {
                                    if (!foundry.utils.hasProperty(base, attr) && entity instanceof TokenDocument) {
                                        base = entity.actor;
                                    }

                                    if (!foundry.utils.hasProperty(base, attr)) {
                                        if (!attr.startsWith("system"))
                                            attr = 'system.' + attr;
                                        if (!foundry.utils.hasProperty(base, attr)) {
                                            warn("Couldn't find attribute", entity, attr);
                                            continue;
                                        }
                                    }
                                }

                                let prop = foundry.utils.getProperty(base, attr);

                                if (prop && typeof prop == 'object' && !(prop instanceof Array) && !(prop instanceof Color)) {
                                    if (prop.value == undefined) {
                                        debug("Attribute returned an object and the object doesn't have a value property", entity, attr, prop);
                                        continue;
                                    }

                                    attr = attr + '.value';
                                    prop = prop.value;
                                }

                                let updateValue = await getValue(val, args, entity, { prop });
                                console.log("UpdateValue: ", updateValue, args.darkness);
                                if (prop instanceof Color) {
                                    update[attr] = Color.fromString(updateValue);
                                } else {
                                    update[attr] = updateValue;
                                }

                                MonksActiveTiles.batch.add('update', base, update);
                                MonksActiveTiles.addToResult(entity, result);
                            }
                        }

                        return result;
                    }
                },
                content: async (trigger, action) => {
                    let ctrl = trigger.ctrls.find(c => c.id == "entity");
                    let entityName = await MonksActiveTiles.entityName(action.data?.entity || ctrl?.defvalue || "previous", action.data?.collection);
                    let str = "";
                    let attr = action.data?.attribute.trim();
                    let value = action.data?.value;
                    let actionName = 'set';
                    let midName = 'to';
                    if (value != undefined) {
                        value = value.trim();
                        if (value.startsWith('+ ') || value.startsWith('- ')) {
                            actionName = value.startsWith('+ ') ? 'increase' : 'decrease';
                            midName = 'by';
                            value = value.substring(2)
                        } else if (value.startsWith('=')) {
                            value = `(${value.substring(1)})`;
                        }

                        str += `, ${actionName} <span class="value-style">&lt;${attr}&gt;</span> ${midName} <span class="details-style">${ActionManager.wrapQuotes(value)}</span>`;
                    }
                    return `<span class="action-style">${i18n(trigger.name)}</span> <span class="entity-style">${entityName}</span>${str}`;
                }
            },
            'tempimage': {
                name: "MonksActiveTiles.action.tempimage",
                ctrls: [
                    {
                        id: "entity",
                        name: "MonksActiveTiles.ctrl.select-entity",
                        type: "select",
                        subtype: "entity",
                        restrict: (entity) => { return entity instanceof foundry.canvas.placeables.Tile; },
                        options: { show: ['tile', 'previous', 'tagger'] },
                        defvalue: 'tile',
                        defaultType: 'tiles',
                        help: '<span style="color: #FF0000;">Foundry does not like images to be altered in this way. Any change, update, refresh of this Tile will remove this temorary image.  Use wisely.</span>'
                    },
                    {
                        id: "img",
                        name: "MonksActiveTiles.ctrl.image",
                        type: "filepicker",
                        subtype: "imagevideo",
                        help: "Leave this blank to remove the temporary image."
                    },
                    {
                        id: "showto",
                        name: "For",
                        list: "showto",
                        type: "list",
                        subtype: "for",
                        defvalue: "trigger"
                    }
                ],
                values: {
                    'showto': {
                        "everyone": "MonksActiveTiles.for.all",
                        "players": "MonksActiveTiles.for.players",
                        "gm": "MonksActiveTiles.for.gm",
                        "trigger": "MonksActiveTiles.for.triggering",
                        "token": "MonksActiveTiles.for.token",
                        "owner": "MonksActiveTiles.for.owner",
                        "previous": "MonksActiveTiles.for.current"
                    }
                },
                fn: async (args = {}) => {
                    const { action } = args;
                    let entities = await MonksActiveTiles.getEntities(args, action.data?.collection || "tiles");

                    for (let entity of entities) {
                        if (entity && entity instanceof TileDocument) {
                            let showto = action.data.showto || "trigger";
                            let img = await getValue(action.data.img, args, entity);

                            let showUsers = MonksActiveTiles.getForPlayers(showto, args);

                            if (showUsers.includes(game.user.id)) {
                                MonksActiveTiles.temporaryTileImage(entity, img);
                                showUsers = showUsers.filter(u => u != game.user.id);
                            }  
                            
                            if (showUsers.length) {
                                MonksActiveTiles.emit('tempimage', {
                                    users: showUsers,
                                    entityid: entity.uuid,
                                    img: img
                                });
                            }                       
                        }
                    }
                },
                content: async (trigger, action) => {
                    let ctrl = trigger.ctrls.find(c => c.id == "entity");
                    let entityName = await MonksActiveTiles.entityName(action.data?.entity || ctrl?.defvalue || "previous", ctrl?.defaultType);
                    return `<span class="action-style">${i18n(trigger.name)}</span> <span class="entity-style">${entityName}</span> <span class="details-style">"${action.data?.img}"</span> for <span class="value-style">&lt;${MonksActiveTiles.forPlayersName(action.data?.showto || "trigger")}&gt;</span>`;
                }
            },
            /*'animate': {
                name: "MonksActiveTiles.action.animate",
                ctrls: [
                    {
                        id: "entity",
                        name: "MonksActiveTiles.ctrl.select-entity",
                        type: "select",
                        subtype: "entity",
                        options: { show: ['tile', 'token', 'within', 'players', 'previous'] }
                    },
                    {
                        id: "attribute",
                        name: "MonksActiveTiles.ctrl.attribute",
                        type: "text"
                    },
                    {
                        id: "from",
                        name: "From",
                        type: "text"
                    },
                    {
                        id: "to",
                        name: "To",
                        type: "text"
                    },
                    {
                        id: "repeat",
                        name: "Repeat",
                        type: "checkbox"
                    }
                ],
                fn: async (args = {}) => {
                    const { tile, tokens, action, userId, value } = args;
                    let entities = await MonksActiveTiles.getEntities(args);
        
                    let animate = (dt) => {
                        let interval = 100;
                    };
        
                    let attr = action.data.attribute;
        
                    if (entities && entities.length > 0) {
                        for (let entity of entities) {
                            const attributes = [
                                { parent: entity.object, attribute: attr, to: action.data.to }
                            ];
        
                            let animationName = `MonksActiveTiles.${entity.id}.animate`;
                            let _animation = await foundry.canvas.animation.CanvasAnimation.animateLinear(attributes, {
                                name: animationName,
                                context: entity.object,
                                duration: 1000
                            });
                        }
                    }
        
                    let result = { entities: entities };
                    if (entities && entities.length > 0 && entities[0] instanceof TokenDocument)
                        result.tokens = entities;
                    return result;
                },
                content: async (trigger, action) => {
                    return "Animate";
                }
            },*/
            'hurtheal': {
                name: "MonksActiveTiles.action.hurtheal",
                batch: true,
                ctrls: [
                    {
                        id: "entity",
                        name: "MonksActiveTiles.ctrl.select-entity",
                        type: "select",
                        subtype: "entity",
                        restrict: (entity) => { return entity instanceof foundry.canvas.placeables.Token; },
                        options: { show: ['token', 'within', 'players', 'previous', 'tagger'] },
                        help: "Hurt/Heal does not use a damage type due to the differences in systems.  Use the attack action instead"
                    },
                    {
                        id: "value",
                        name: "MonksActiveTiles.ctrl.value",
                        type: "text",
                        required: true,
                        check: true,
                        help: "If you want to increase the value use '+10', if you want to have the value rolled use '-[[1d4]]'"
                    },
                    {
                        id: "chatMessage",
                        name: "MonksActiveTiles.ctrl.chatmessage",
                        type: "checkbox",
                        conditional: (app) => {
                            const val = $('input[name="data.value"]', app.element).val();
                            return val.includes('[[') || val.includes('d');
                        }
                    },
                    {
                        id: "rollmode",
                        name: 'MonksActiveTiles.ctrl.rollmode',
                        list: "rollmode",
                        type: "list",
                        conditional: (app) => {
                            const val = $('input[name="data.value"]', app.element).val();
                            return val.includes('[[') || val.includes('d');
                        }
                    },
                    {
                        id: "showdice",
                        name: "MonksActiveTiles.ctrl.showdice",
                        type: "checkbox",
                        defvalue: true,
                        conditional: (app) => {
                            return game.modules.get("dice-so-nice")?.active;
                        }
                    }
                ],
                values: {
                    'rollmode': {
                        "roll": 'MonksActiveTiles.rollmode.public',
                        "gmroll": 'MonksActiveTiles.rollmode.private',
                        "blindroll": 'MonksActiveTiles.rollmode.blind',
                        "selfroll": 'MonksActiveTiles.rollmode.self'
                    }
                },
                fn: async (args = {}) => {
                    const { tile, action, userId, value, method, change } = args;
                    let entities = await MonksActiveTiles.getEntities(args);

                    let applyDamage = function (actor, amount = 0) {
                        let updates = {};
                        amount = Math.floor(parseInt(amount));
                        let resourcename = game.system.primaryTokenAttribute || 'attributes.hp';
                        let resource = foundry.utils.getProperty(actor, "system." + resourcename);
                        if (resource instanceof Object) {
                            // Deduct damage from temp HP first
                            let dt = 0;
                            let tmpMax = 0;
                            if (resource.temp != undefined) {
                                const tmp = parseInt(resource.temp) || 0;
                                dt = amount > 0 ? Math.min(tmp, amount) : 0;
                                // Remaining goes to health

                                tmpMax = parseInt(resource.tempmax) || 0;

                                updates["system." + resourcename + ".temp"] = tmp - dt;
                            }

                            // Update the Actor
                            const dh = Math.clamp(resource.value - (amount - dt), (game.system.id == 'D35E' || game.system.id == 'pf1' ? -2000 : 0), (resource.max == 0 ? 4000 : resource.max + tmpMax));
                            updates["system." + resourcename + ".value"] = dh;
                        } else {
                            let value = Math.floor(parseInt(resource));
                            updates["system." + resourcename] = (value - amount);
                        }

                        MonksActiveTiles.batch.add("update", actor, updates);
                    }

                    if (entities && entities.length > 0) {
                        for (let entity of entities) {
                            const a = entity.actor;

                            if (!a) continue;

                            let val = await getValue(action.data.value, args, entity, {
                                actor: a.toObject(),
                                token: entity.toObject(),
                                rollmode: action.data.rollmode,
                                flavor: "{{entity.name}} is being {{#if (lt result 0)}}hurt{{else}}healed{{/if}}",
                                operation: "assign",
                                prop: ""
                            });
                            /*
                            let context = {
                                actor: a.toObject(false),
                                token: entity.toObject(false),
                                tile: tile.toObject(false),
                                entity: entity,
                                variable: foundry.utils.getProperty(tile, "flags.monks-active-tiles.variables") || {},
                                user: game.users.get(userId),
                                value: value,
                                scene: canvas.scene,
                                method: method,
                                change: change
                            };

                            if (val.includes("{{")) {
                                const compiled = Handlebars.compile(val);
                                val = compiled(context, { allowProtoMethodsByDefault: true, allowProtoPropertiesByDefault: true }).trim();
                            }

                            const rgx = /\[\[(\/[a-zA-Z]+\s)?(.*?)([\]]{2,3})(?:{([^}]+)})?/gi;
                            val = await MonksActiveTiles.inlineRoll(val, rgx, action.data.chatMessage, action.data.rollmode, entity);

                            if (val.indexOf("d") != -1) {
                                let roll = await rollDice(val);
                                val = roll.value;

                                if (action.data.chatMessage) {
                                    let flavor = `${entity.name} is being ${val < 0 ? "hurt" : "healed"}`;
                                    roll.roll.toMessage({ flavor }, { rollMode: action.data.rollmode });
                                }
                            }

                            try {
                                val = parseFloat(eval(val));
                            } catch { }
                            */

                            if (typeof val == "string" && (val.startsWith("+ ") || val.startsWith("- "))) {
                                val = parseFloat(val[0] + val.substring(2));
                                ui.notifications.warn("Hurt/Heal action should not have a space between the sign and the number, legacy support for this will be removed some time in the future.");
                            }

                            val = val * -1;

                            if (val != 0) {
                                if (!$.isNumeric(val)) {
                                    warn("Value used for Hurt/Heal did not evaluate to a number", val);
                                    continue;
                                }
                                if (a.applyDamage) {
                                    if (game.system.id == "pf2e")
                                        await a.applyDamage({ damage: val, token: entity });
                                    else if (game.system.id == "pf1")
                                        await a.applyDamage(val);
                                    else if (game.system.id == "dnd5e" && foundry.utils.isNewerVersion(game.system.version, "2.9.9"))
                                        await a.applyDamage(val, { multiplier: 1 });
                                    else
                                        await a.applyDamage(val, 1);
                                } else {
                                    applyDamage(a, val);
                                }
                            }
                        }

                        return { tokens: entities, entities: entities };
                    }
                },
                content: async (trigger, action) => {
                    let ctrl = trigger.ctrls.find(c => c.id == "entity");
                    let entityName = await MonksActiveTiles.entityName(action.data?.entity || ctrl?.defvalue || "previous");
                    return `<span class="action-style">${(action.data?.value.startsWith('-') ? 'Hurt' : 'Heal')}</span> <span class="entity-style">${entityName}</span>, by <span class="details-style">${ActionManager.wrapQuotes(action.data?.value)}</span>`;
                }
            },
            'playsound': {
                name: "MonksActiveTiles.action.playsound",
                ctrls: [
                    {
                        id: "audiofile",
                        name: "MonksActiveTiles.ctrl.audiofile",
                        type: "filepicker",
                        subtype: "audio",
                        required: true
                    },
                    {
                        id: "audiofor",
                        name: "MonksActiveTiles.ctrl.for",
                        list: "audiofor",
                        type: "list",
                        subtype: "for",
                        defvalue: "trigger"
                    },
                    {
                        id: "volume",
                        name: "MonksActiveTiles.ctrl.volume",
                        type: "slider",
                        defvalue: "1.0"
                    },
                    {
                        id: "loop",
                        name: "MonksActiveTiles.ctrl.loop",
                        type: "checkbox"
                    },
                    {
                        id: "fade",
                        name: "MonksActiveTiles.ctrl.fade",
                        type: "number",
                        min: 0,
                        step: 0.05,
                        defvalue: 0.25
                    },
                    {
                        id: "scenerestrict",
                        name: "MonksActiveTiles.ctrl.scenerestrict",
                        type: "checkbox"
                    },
                    {
                        id: "prevent",
                        name: "MonksActiveTiles.ctrl.preventsound",
                        type: "checkbox"
                    },
                    {
                        id: "delay",
                        name: "MonksActiveTiles.ctrl.delayactions",
                        type: "checkbox"
                    },
                    {
                        id: "playlist",
                        name: "MonksActiveTiles.ctrl.showplaylist",
                        type: "checkbox",
                        conditional: () => { return game.modules.get("monks-sound-enhancements")?.active },
                        defvalue: true
                    },
                ],
                values: {
                    'audiofor': {
                        "everyone": "MonksActiveTiles.for.all",
                        "players": "MonksActiveTiles.for.players",
                        "gm": "MonksActiveTiles.for.gm",
                        "trigger": "MonksActiveTiles.for.triggering",
                        "token": "MonksActiveTiles.for.token",
                        "owner": "MonksActiveTiles.for.owner",
                        "previous": "MonksActiveTiles.for.current"
                    },
                },
                fn: async (args = {}) => {
                    const { tile, tokens, action, userId } = args;
                    //play the sound
                    let getTileSounds = async function (tile) {
                        const audiofile = action.data.audiofile;

                        if (!audiofile) {
                            console.log(`Audio file not set to anything, can't play sound`);
                            return;
                        }

                        if (!audiofile.includes('*')) return [audiofile];
                        tile._sounds = (tile._sounds || {});
                        let sounds = tile._sounds[action.id]
                        if (sounds && sounds.length) return sounds;
                        let source = "data";
                        let pattern = audiofile;
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
                            tile._sounds[action.id] = content.files;
                        } catch (err) {
                            tile._sounds[action.id] = [];
                            ui.notifications.error(err);
                        }
                        return tile._sounds[action.id];
                    }

                    let volume = Math.clamp((action.data.volume.value ?? action.data.volume ?? 1), 0, 1);

                    let audiofiles = await getTileSounds(tile);
                    const audiofile = audiofiles[Math.floor(Math.random() * audiofiles.length)];

                    let playfor = action.data.audiofor || "everyone";
                    let showUsers = MonksActiveTiles.getForPlayers(playfor, args);

                    if (showUsers.includes(game.user.id)) {
                        if (action.data.scenerestrict && tile.parent.id != canvas.scene.id)
                            return;

                        if (tile.soundeffect != undefined && tile.soundeffect[action.id] != undefined) {
                            if (tile.soundeffect[action.id].playing && action.data.prevent == true)
                                return;

                            tile.soundeffect[action.id].fade(0, { duration: 250 }).then(() => {
                                tile.soundeffect[action.id].stop();
                                delete tile.soundeffect[action.id];
                            });
                            MonksActiveTiles.emit('stopsound', {
                                tileid: tile.uuid,
                                actionid: action.id,
                                userId: (playfor == 'triggering' ? [userId] : (playfor == 'owner' ? owners : null)),
                                fade: 0.25
                            });
                        }
                        debug('Playing', audiofile, action.id);
                        if (!audiofile)
                            return;

                        let fade = action.data.fade ?? 0;
                        foundry.audio.AudioHelper.play({ src: audiofile, volume: (fade > 0 ? 0 : volume * getVolume()), loop: action.data.loop }, false).then((sound) => {
                            if (fade > 0)
                                sound.fade(volume * getVolume(), { duration: fade * 1000 });
                            if (tile.soundeffect == undefined)
                                tile.soundeffect = {};
                            tile.soundeffect[action.id] = sound;
                            tile.soundeffect[action.id].addEventListener("stop", () => {
                                MonksActiveTiles.emit('stopsound', {
                                    tileid: tile.uuid,
                                    actionid: action.id,
                                    userId: (playfor == 'triggering' ? [userId] : (playfor == 'owner' ? owners : null)),
                                    fade: 0.25
                                });
                                delete tile.soundeffect[action.id];
                            });
                            tile.soundeffect[action.id].addEventListener("end", () => {
                                debug('Finished playing', audiofile);
                                delete tile.soundeffect[action.id];
                            });
                            tile.soundeffect[action.id].effectiveVolume = volume;
                            if (game.modules.get("monks-sound-enhancements")?.active && action.data.playlist) {
                                game.MonksSoundEnhancements.addSoundEffect(tile.soundeffect[action.id], "Tile Sound Effect");
                            }

                            if (action.data.delay) {
                                tile._resumeTimer = window.setTimeout(function () {
                                    delete tile._resumeTimer;
                                    tile.resumeActions(args._id);
                                }, sound.duration * 1000);
                            }
                        });

                        showUsers = showUsers.filter(u => u != game.user.id);
                    }

                    if (showUsers.length) {
                        // Broadcast if playing for all, or owners, or the triggering player if it's not the triggering player playing the sound
                        MonksActiveTiles.emit('playsound', {
                            tileid: tile.uuid,
                            actionid: action.id,
                            src: audiofile,
                            loop: action.data.loop,
                            users: showUsers,
                            sceneid: action.data.scenerestrict ? tile.parent.id : null,
                            volume: volume,
                            prevent: action.data.prevent,
                            fade: action.data.fade
                        });
                    }
                    return { pause: action.data.delay };
                },
                content: async (trigger, action) => {
                    let forName = MonksActiveTiles.forPlayersName(action.data?.audiofor || "everyone");
                    let audiofile = action.data.audiofile.slice(action.data.audiofile.lastIndexOf('/') + 1);
                    return `<span class="action-style">${i18n(trigger.name)}</span> <span class="details-style" data-tooltip="${action.data.audiofile}">${ActionManager.wrapQuotes(audiofile)}</span> for <span class="value-style">&lt;${forName}&gt;</span>${(action.data?.loop ? ' <i class="fas fa-sync" title="Loop sound"></i>' : '')}`;
                }
            },
            'playlist': {
                name: "MonksActiveTiles.action.playlist",
                ctrls: [
                    {
                        id: "entity",
                        name: "MonksActiveTiles.ctrl.playlist",
                        type: "select",
                        subtype: "entity",
                        options: { show: ['previous', 'controlled'] },
                        restrict: (entity) => {
                            return (entity instanceof Playlist || entity instanceof PlaylistSound);
                        },
                        required: true,
                        defaultType: 'playlists',
                        placeholder: 'Please select a playlist'
                    },
                    {
                        id: "play",
                        name: "MonksActiveTiles.ctrl.action",
                        list: "play",
                        defvalue: "play",
                        type: "list",
                        check: true,
                    },
                    {
                        id: "volume",
                        name: "MonksActiveTiles.ctrl.volume",
                        type: "slider",
                        defvalue: "1.0",
                        step: 0.,
                        nullable: true,
                        conditional: (app) => {
                            return $('select[name="data.play"]', app.element).val() == 'play';
                        }
                    },
                    {
                        id: "loop",
                        name: "MonksActiveTiles.ctrl.loop",
                        type: "checkbox",
                        conditional: (app) => {
                            return $('select[name="data.play"]', app.element).val() == 'play';
                        }
                    }
                ],
                values: {
                    'play': {
                        'play': "Play",
                        'pause': "Pause",
                        'stop': "Stop",
                        'next': "Next Track",
                        'prev': "Previous Track"
                    },
                },
                fn: async (args = {}) => {
                    const { tile, action, userId } = args;

                    let batch = new BatchManager();
                    let entities = await MonksActiveTiles.getEntities(args, 'playlists');
                    for (let entity of entities) {
                        let cmd = action.data?.play;
                        if (cmd == "next" || cmd == "prev") {
                            if (entity instanceof PlaylistSound)
                                entity = entity.parent;
                            if (!entity.playing)
                                cmd = "play";
                        }
                        if (entity instanceof Playlist) {
                            if (cmd == "next")
                                await entity.playNext();
                            else if (cmd == "prev")
                                await entity.playNext(null, { direction: -1 });
                            else if (cmd !== "play")
                                await entity.stopAll();
                            else {
                                let options = { };
                                if (Number.isNumeric(action.data.volume.value ?? action.data.volume)) {
                                    options.volume = Math.clamp((action.data.volume.value ?? action.data.volume ?? 1), 0, 1);
                                }
                                await entity.playAll(options);
                            }
                        } else {
                            if (cmd == "stop")
                                batch.add("update", entity, { playing: false, pausedTime: 0 });
                            else if (cmd == "pause")
                                batch.add("update", entity, { playing: false, pausedTime: entity.sound.currentTime });
                            else {
                                let update = { playing: true, repeat: action.data.loop };
                                if (Number.isNumeric(action.data.volume.value ?? action.data.volume)) {
                                    update.volume = Math.clamp((action.data.volume.value ?? action.data.volume ?? 1), 0, 1);
                                }

                                batch.add("update", entity, update);
                            }
                        }
                    }
                    batch.execute();
                },
                content: async (trigger, action) => {
                    let ctrl = trigger.ctrls.find(c => c.id == "entity");
                    let entityName = await MonksActiveTiles.entityName(action.data?.entity || ctrl?.defvalue || "previous", 'playlists')
                    return `<span class="action-style">${i18n(trigger.name)}</span> <span class="details-style">"${i18n(trigger.values.play[action.data?.play || "play"])}"</span> <span class="entity-style">${entityName}</span>${(action.data?.loop ? ' <i class="fas fa-sync" title="Loop sound"></i>' : '')}`;
                }
            },
            'stopsound': {
                name: "MonksActiveTiles.action.stopsound",
                ctrls: [
                    /*{
                        id: "audiotype",
                        name: "MonksActiveTiles.ctrl.audiotype",
                        list: "audiotype",
                        type: "list",
                        check: true,
                    },*/
                    {
                        id: "entity",
                        name: "MonksActiveTiles.ctrl.select-entity",
                        type: "select",
                        subtype: "entity",
                        options: { show: ['tile', 'tagger'] },
                        restrict: (entity) => { return entity instanceof foundry.canvas.placeables.Tile; },
                        defaultType: 'tiles',
                        defvalue: 'tile',
                    },
                    {
                        id: "audiofor",
                        name: "MonksActiveTiles.ctrl.for",
                        list: "audiofor",
                        type: "list",
                        subtype: "for"
                    },
                    {
                        id: "fade",
                        name: "MonksActiveTiles.ctrl.fade",
                        type: "number",
                        min: 0,
                        step: 0.05,
                        defvalue: 0.25
                    }
                ],
                values: {
                    'audiofor': {
                        "everyone": "MonksActiveTiles.for.all",
                        "players": "MonksActiveTiles.for.players",
                        "gm": "MonksActiveTiles.for.gm",
                        "trigger": "MonksActiveTiles.for.triggering",
                        "token": "MonksActiveTiles.for.token",
                        "owner": "MonksActiveTiles.for.owner",
                        "previous": "MonksActiveTiles.for.current"
                    },
                    'audiotype': {
                        'all': "MonksActiveTiles.audiotype.all",
                        'tile': "MonksActiveTiles.audiotype.tile"
                    }
                },
                fn: async (args = {}) => {
                    const { tile, tokens, action, userId } = args;
                    //play the sound
                    if (action.data.audiotype == 'all') {
                        let batch = new BatchManager();
                        game.playlists.forEach(async (p) => {
                            p.sounds.forEach(async (s) => {
                                if (s.playing)
                                    batch.add("update", s, { playing: false, pausedTime: s.sound.currentTime });
                            });
                        });
                        await batch.execute();
                        /*
                        MonksActiveTiles.emit('stopsound', {
                            type: action.data.audiotype,
                        });
                        */
                    } else {
                        let owners = [];
                        for (let token of tokens) {
                            if (token.actor) {
                                for (let [user, perm] of Object.entries(token.actor.ownership)) {
                                    if (perm >= CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER && !owners.includes(user))
                                        owners.push(user);
                                }
                            }
                        }

                        let playfor = action.data.audiofor || "everyone";

                        let entities = await MonksActiveTiles.getEntities(args, 'tiles');
                        for (let entity of entities) {
                            if (entity instanceof TileDocument) {
                                let showUsers = MonksActiveTiles.getForPlayers(playfor, args);

                                if (showUsers.includes(game.user.id)) {
                                    if (entity.soundeffect != undefined) {
                                        let fade = (action.data.fade * 1000) ?? 0.25;
                                        for (let [key, sound] of Object.entries(entity.soundeffect)) {
                                            sound.fade(0, { duration: fade }).then(() => {
                                                sound.stop();
                                                delete entity.soundeffect[key];
                                            });
                                        }
                                    }
                                    showUsers = showUsers.filter(u => u != game.user.id);
                                }

                                if (showUsers.length) {
                                    MonksActiveTiles.emit('stopsound', {
                                        tileid: entity.uuid,
                                        type: action.data.audiotype,
                                        users: showUsers,
                                        fade: action.data.fade ?? 0.25
                                    });
                                }
                                
                            }
                        }
                    }
                },
                content: async (trigger, action) => {
                    let entityName = '';
                    if (action.data.audiotype == 'tile' || action.data.audiotype == undefined) {
                        let ctrl = trigger.ctrls.find(c => c.id == "entity");
                        entityName = await MonksActiveTiles.entityName(action.data?.entity || ctrl?.defvalue || "previous", 'tiles');
                    }
                    return `<span class="action-style">${i18n(trigger.name)}</span> of <span class="entity-style">${(action.data.audiotype == 'all' ? i18n("MonksActiveTiles.audiotype.all") : entityName)}</span> for <span class="value-style">&lt;${ MonksActiveTiles.forPlayersName(action.data?.audiofor || "everyone") }&gt;</span>`;
                }
            },
            'showimage': {
                name: "MonksActiveTiles.action.showimage",
                ctrls: [
                    {
                        id: "imagefile",
                        name: "MonksActiveTiles.ctrl.imagefile",
                        type: "filepicker",
                        subtype: "image",
                        required: true
                    },
                    {
                        id: "caption",
                        name: "MonksActiveTiles.ctrl.caption",
                        type: "text",
                    },
                    {
                        id: "showfor",
                        name: "MonksActiveTiles.ctrl.for",
                        list: "showfor",
                        type: "list"
                    },
                ],
                values: {
                    'showfor': {
                        "everyone": "MonksActiveTiles.for.all",
                        "players": "MonksActiveTiles.for.players",
                        "gm": "MonksActiveTiles.for.gm",
                        "trigger": "MonksActiveTiles.for.triggering",
                        "token": "MonksActiveTiles.for.token",
                        "owner": "MonksActiveTiles.for.owner",
                        "previous": "MonksActiveTiles.for.current"
                    },
                },
                fn: async (args = {}) => {
                    const { tile, tokens, action, userId } = args;

                    let showfor = action.data.showfor || "everyone";
                    let showUsers = MonksActiveTiles.getForPlayers(showfor, args);

                    if (showUsers.includes(game.user.id)) {
                        new foundry.applications.apps.ImagePopout({
                            src: action.data.imagefile,
                            window: {
                                title: action.data.caption
                            }
                        }).render(true);
                        showUsers = showUsers.filter(u => u != game.user.id);
                    }
                    if (showUsers.length) {
                        // Broadcast if playing for all, or owners, or the triggering player if it's not the triggering player playing the sound
                        MonksActiveTiles.emit('showimage', {
                            src: action.data.imagefile,
                            title: action.data.caption,
                            users: showUsers,
                        });
                    }
                    
                },
                content: async (trigger, action) => {
                    return `<span class="action-style">${i18n(trigger.name)}</span> <span class="details-style">${ActionManager.wrapQuotes(action.data.imagefile)}</span> for <span class="value-style">&lt;${MonksActiveTiles.forPlayersName(action.data?.showfor || "everyone") }&gt;</span>`;
                }
            },
            'changedoor': {
                name: "MonksActiveTiles.action.changedoor",
                batch: true,
                ctrls: [
                    {
                        id: "entity",
                        name: "MonksActiveTiles.ctrl.selectdoor",
                        type: "select",
                        subtype: "entity",
                        options: { show: ['previous', 'tagger'] },
                        restrict: (entity) => { return (entity instanceof foundry.canvas.placeables.Wall); },  //this needs to be a wall segment
                        required: true,
                        defaultType: 'walls',
                        placeholder: 'Please select a Wall'
                    },
                    {
                        id: "type",
                        name: "Wall Configuration",
                        list: () => {
                            let doorTypes = { nothing: "--No Change--", toggle: "--Toggle--" };
                            doorTypes = Object.assign(doorTypes, Object.keys(CONST.WALL_DOOR_TYPES).reduce((obj, key) => {
                                obj[key] = game.i18n.localize(`WALL.DoorTypes.${key}`);
                                return obj;
                            }, {}));
                            return doorTypes;
                        },
                        type: "list",
                        defvalue: "nothing"
                    },
                    {
                        id: "state",
                        name: "Door State",
                        list: () => {
                            let doorStates = { nothing: "--No Change--", toggle: "--Toggle--" };
                            doorStates = Object.assign(doorStates, Object.keys(CONST.WALL_DOOR_STATES).reduce((obj, key) => {
                                obj[key] = game.i18n.localize(`WALL.DoorStates.${key}`);
                                return obj;
                            }, {}));
                            return doorStates;
                        },
                        type: "list",
                        defvalue: "nothing"
                    },
                    {
                        id: "movement",
                        name: "Movement Restriction",
                        list: () => {
                            let moveTypes = { nothing: "--No Change--", toggle: "--Toggle--" };
                            moveTypes = Object.assign(moveTypes, Object.keys(CONST.WALL_MOVEMENT_TYPES).reduce((obj, key) => {
                                obj[key] = game.i18n.localize(`WALL.SenseTypes.${key}`);
                                return obj;
                            }, {}));
                            return moveTypes;
                        },
                        type: "list",
                        defvalue: "nothing"
                    },
                    {
                        id: "light",
                        name: "Light Restriction",
                        list: () => {
                            let senseTypes = { nothing: "--No Change--", toggle: "--Toggle--" };
                            senseTypes = Object.assign(senseTypes, Object.keys(CONST.WALL_SENSE_TYPES).reduce((obj, key) => {
                                obj[key] = game.i18n.localize(`WALL.SenseTypes.${key}`);
                                return obj;
                            }, {}));
                            return senseTypes;
                        },
                        type: "list",
                        defvalue: "nothing"
                    },
                    {
                        id: "sight",
                        name: "Sight Restriction",
                        list: () => {
                            let senseTypes = { nothing: "--No Change--", toggle: "--Toggle--" };
                            senseTypes = Object.assign(senseTypes, Object.keys(CONST.WALL_SENSE_TYPES).reduce((obj, key) => {
                                obj[key] = game.i18n.localize(`WALL.SenseTypes.${key}`);
                                return obj;
                            }, {}));
                            return senseTypes;
                        },
                        type: "list",
                        defvalue: "nothing"
                    },
                    {
                        id: "sound",
                        name: "Sound Restriction",
                        list: () => {
                            let senseTypes = { nothing: "--No Change--", toggle: "--Toggle--" };
                            senseTypes = Object.assign(senseTypes, Object.keys(CONST.WALL_SENSE_TYPES).reduce((obj, key) => {
                                obj[key] = game.i18n.localize(`WALL.SenseTypes.${key}`);
                                return obj;
                            }, {}));
                            return senseTypes;
                        },
                        type: "list",
                        defvalue: "nothing"
                    },
                ],
                fn: async (args = {}) => {
                    const { action } = args;
                    //Find the door in question, set the state to whatever value

                    const updateProperty = (wall, key, prop, types, toggles) => {
                        if (action.data[key] != "nothing") {
                            let keyValue = action.data[key];
                            let value = types[keyValue] ?? keyValue;
                            if (keyValue == 'toggle') {
                                let wallValue = wall[prop];
                                let toggle = toggles.find(t => t.from == wallValue);
                                if (toggle)
                                    value = toggle.to;
                                else
                                    return {};
                            }
                            let update = {};
                            update[prop] = value;
                            if (["light", "sight", "sound"].includes(key)) {
                                const thresholdTypes = [CONST.WALL_SENSE_TYPES.PROXIMITY, CONST.WALL_SENSE_TYPES.DISTANCE];
                                if (!thresholdTypes.includes(value)) {
                                    update.threshold = {};
                                    update.threshold[key] = null;
                                }
                            }
                            return update;
                        }

                        return {};
                    }

                    if (action.data.entity.id) {
                        if (action.data.state == "none")
                            action.data.state = "nothing";
                        else
                            action.data.state = (action.data.state == 'lock' ? "LOCKED" : (["open", "closed"].includes(action.data.state) ? action.data.state.toUpperCase() : action.data.state));

                        if (action.data.type == "none")
                            action.data.type = "nothing";
                        else
                            action.data.type = ["door", "secret"].includes(action.data.type) ? action.data.type.toUpperCase() : action.data.type;

                        let walls = await MonksActiveTiles.getEntities(args, 'walls');
                        for (let wall of walls) {
                            if (wall instanceof WallDocument) {
                                let updates = Object.assign({},
                                    updateProperty(wall, "state", "ds", CONST.WALL_DOOR_STATES, [{ from: CONST.WALL_DOOR_STATES.CLOSED, to: CONST.WALL_DOOR_STATES.OPEN }, { from: CONST.WALL_DOOR_STATES.OPEN, to: CONST.WALL_DOOR_STATES.CLOSED }, { from: CONST.WALL_DOOR_STATES.LOCKED, to: CONST.WALL_DOOR_STATES.OPEN }]),
                                    updateProperty(wall, "type", "door", CONST.WALL_DOOR_TYPES, [{ from: CONST.WALL_DOOR_TYPES.DOOR, to: CONST.WALL_DOOR_TYPES.SECRET }, { from: CONST.WALL_DOOR_TYPES.SECRET, to: CONST.WALL_DOOR_TYPES.DOOR }, { from: CONST.WALL_DOOR_TYPES.NONE, to: CONST.WALL_DOOR_TYPES.DOOR }]),
                                    updateProperty(wall, "movement", "move", CONST.WALL_MOVEMENT_TYPES, [{ from: CONST.WALL_MOVEMENT_TYPES.NONE, to: CONST.WALL_MOVEMENT_TYPES.NORMAL }, { from: CONST.WALL_MOVEMENT_TYPES.NORMAL, to: CONST.WALL_MOVEMENT_TYPES.NONE }]),
                                    updateProperty(wall, "light", "light", CONST.WALL_SENSE_TYPES, [{ from: CONST.WALL_SENSE_TYPES.NONE, to: CONST.WALL_SENSE_TYPES.NORMAL }, { from: CONST.WALL_SENSE_TYPES.LIMITED, to: CONST.WALL_SENSE_TYPES.NORMAL }, { from: CONST.WALL_SENSE_TYPES.NORMAL, to: CONST.WALL_SENSE_TYPES.NONE }, { from: CONST.WALL_SENSE_TYPES.PROXIMITY, to: CONST.WALL_SENSE_TYPES.NORMAL }, { from: CONST.WALL_SENSE_TYPES.DISTANCE, to: CONST.WALL_SENSE_TYPES.NORMAL }]),
                                    updateProperty(wall, "sight", "sight", CONST.WALL_SENSE_TYPES, [{ from: CONST.WALL_SENSE_TYPES.NONE, to: CONST.WALL_SENSE_TYPES.NORMAL }, { from: CONST.WALL_SENSE_TYPES.LIMITED, to: CONST.WALL_SENSE_TYPES.NORMAL }, { from: CONST.WALL_SENSE_TYPES.NORMAL, to: CONST.WALL_SENSE_TYPES.NONE }, { from: CONST.WALL_SENSE_TYPES.PROXIMITY, to: CONST.WALL_SENSE_TYPES.NORMAL }, { from: CONST.WALL_SENSE_TYPES.DISTANCE, to: CONST.WALL_SENSE_TYPES.NORMAL }]),
                                    updateProperty(wall, "sound", "sound", CONST.WALL_SENSE_TYPES, [{ from: CONST.WALL_SENSE_TYPES.NONE, to: CONST.WALL_SENSE_TYPES.NORMAL }, { from: CONST.WALL_SENSE_TYPES.LIMITED, to: CONST.WALL_SENSE_TYPES.NORMAL }, { from: CONST.WALL_SENSE_TYPES.NORMAL, to: CONST.WALL_SENSE_TYPES.NONE }, { from: CONST.WALL_SENSE_TYPES.PROXIMITY, to: CONST.WALL_SENSE_TYPES.NORMAL }, { from: CONST.WALL_SENSE_TYPES.DISTANCE, to: CONST.WALL_SENSE_TYPES.NORMAL }])
                                );
                                MonksActiveTiles.batch.add("update", wall, updates);
                            }
                        }
                    }
                },
                content: async (trigger, action) => {
                    let ctrl = trigger.ctrls.find(c => c.id == "entity");
                    let entityName = await MonksActiveTiles.entityName(action.data?.entity || ctrl?.defvalue || "previous", 'walls');
                    let values = [
                        { key: "type", icon: "fa-block-brick", types: CONST.WALL_DOOR_TYPES, strings: "DoorTypes" },
                        { key: "state", icon: "fa-door-open", types: CONST.WALL_DOOR_STATES, strings: "DoorStates" },
                        { key: "movement", icon: "fa-person-running", types: CONST.WALL_MOVEMENT_TYPES, strings: "SenseTypes" },
                        { key: "light", icon: "fa-lightbulb", types: CONST.WALL_SENSE_TYPES, strings: "SenseTypes" },
                        { key: "sight", icon: "fa-eye", types: CONST.WALL_SENSE_TYPES, strings: "SenseTypes" },
                        { key: "sound", icon: "fa-volume-high", types: CONST.WALL_SENSE_TYPES, strings: "SenseTypes" }
                    ];
                    let valueText = values.map(v => {
                        let value = action.data[v.key];
                        if ((v.key == "state" && value == "none") || (v.key == "type" && value == "none") || value == "nothing") return "";
                        let text = game.i18n.has(`WALLS.${v.strings}.${value}`) ? game.i18n.localize(`WALLS.${v.strings}.${value}`) : value;
                        return `<span style="white-space:nowrap;"><i class="fas ${v.icon}"></i>:${text}</span>`;
                    }).join(" ");
                    return `<span class="action-style">${i18n(trigger.name)}</span> <span class="entity-style" style="margin-right: 8px;">${entityName}</span> ${valueText}`;
                }
            },
            'notification': {
                name: "MonksActiveTiles.action.notification",
                ctrls: [
                    {
                        id: "text",
                        name: "MonksActiveTiles.ctrl.text",
                        type: "text",
                        required: true
                    },
                    {
                        id: "type",
                        name: "MonksActiveTiles.ctrl.type",
                        list: "type",
                        type: "list"
                    },
                    {
                        id: "showto",
                        name: "MonksActiveTiles.ctrl.showto",
                        list: "showto",
                        type: "list",
                        subtype: "for",
                        defvalue: "trigger"
                    }
                ],
                values: {
                    'type': {
                        'info': "MonksActiveTiles.notification.info",
                        'warning': "MonksActiveTiles.notification.warning",
                        'error': "MonksActiveTiles.notification.error"
                    },
                    'showto': {
                        "everyone": "MonksActiveTiles.for.all",
                        "players": "MonksActiveTiles.for.players",
                        "gm": "MonksActiveTiles.for.gm",
                        "trigger": "MonksActiveTiles.for.triggering",
                        "token": "MonksActiveTiles.for.token",
                        "owner": "MonksActiveTiles.for.owner",
                        "previous": "MonksActiveTiles.for.current"
                    }
                },
                fn: async (args = {}) => {
                    const { tile, tokens, action, userId, value, method, change } = args;
                    //Display a notification with the message
                    let content = await getValue(action.data.text, args);

                    let showto = action.data.showto || "trigger";
                    let showUsers = MonksActiveTiles.getForPlayers(showto, args);

                    if (showUsers.includes(game.user.id)) {
                        ui.notifications.notify(content, action.data.type);
                        showUsers = showUsers.filter(u => u != game.user.id);
                    }

                    if (showUsers.length) {
                        MonksActiveTiles.emit('notification', {
                            content: content,
                            type: action.data.type,
                            users: showUsers
                        });
                    } 
                },
                content: async (trigger, action) => {
                    return `<span class="action-style">${i18n(trigger.name)}</span> as <span class="details-style">"${i18n(trigger.values.type[action.data?.type])}"</span> to <span class="value-style">&lt;${MonksActiveTiles.forPlayersName(action.data?.showto || "trigger")}&gt;</span>`;
                }
            },
            'chatmessage': {
                name: "MonksActiveTiles.action.chatmessage",
                ctrls: [
                    {
                        id: "flavor",
                        name: "MonksActiveTiles.ctrl.flavor",
                        type: "text"
                    },
                    {
                        id: "text",
                        name: "MonksActiveTiles.ctrl.text",
                        type: "text",
                        subtype: "multiline",
                        required: true
                    },
                    {
                        id: "entity",
                        name: "MonksActiveTiles.ctrl.speaker",
                        type: "select",
                        subtype: "entity",
                        options: { show: ['token', 'previous', 'tagger'] },
                        restrict: (entity) => { return (entity instanceof foundry.canvas.placeables.Token); }
                    },
                    {
                        id: "incharacter",
                        name: "MonksActiveTiles.ctrl.incharacter",
                        type: "checkbox"
                    },
                    {
                        id: "chatbubble",
                        name: "MonksActiveTiles.ctrl.chatbubble",
                        list: () => {
                            if (!game.settings.get("core", "chatBubbles")) return { 'false': "MonksActiveTiles.msgtype.MessageOnly" };
                            return {
                                'true': "MonksActiveTiles.msgtype.MessageAndBubble",
                                'false': "MonksActiveTiles.msgtype.MessageOnly",
                                'bubble': "MonksActiveTiles.msgtype.ChatBubble"
                            }
                        },
                        type: "list"
                    },
                    {
                        id: "showto",
                        name: "MonksActiveTiles.ctrl.for",
                        list: "showto",
                        type: "list",
                        subtype: "for",
                        defvalue: "everyone"
                    },
                    {
                        id: "language",
                        name: "MonksActiveTiles.ctrl.language",
                        list: () => {
                            let languages = [{id: "", label: ""}];
                            let syslang = CONFIG[game.system.id.toUpperCase()]?.languages || {};
                            if (!(syslang instanceof Array) && typeof syslang == "object") {
                                let parseGroup = (group, attach) => {
                                    let array = attach;
                                    for (let [key, value] of Object.entries(group)) {
                                        if (typeof value == "string")
                                            (attach || languages).push({ id: key, label: value });
                                        else {
                                            if (!attach) {
                                                let newGroup = { id: key, label: value.label, groups: [] };
                                                languages.push(newGroup);
                                                array = newGroup.groups;
                                            }
                                            parseGroup(value.children, array);
                                            if (!attach) {
                                                array.sort((a, b) => a.label.localeCompare(b.label));
                                            }
                                        }
                                    }
                                }
                                parseGroup(syslang);
                            }
                            return languages;
                        },
                        conditional: () => {
                            return (game.modules.get("polyglot")?.active && !!CONFIG[game.system.id.toUpperCase()]?.languages);
                        },
                        type: "list"
                    }
                ],
                values: {
                    'showto': { 
                        "everyone": "MonksActiveTiles.for.all",
                        "players": "MonksActiveTiles.for.players",
                        "gm": "MonksActiveTiles.for.gm",
                        "trigger": "MonksActiveTiles.for.triggering",
                        "token": "MonksActiveTiles.for.token",
                        "owner": "MonksActiveTiles.for.owner",
                        "previous": "MonksActiveTiles.for.current"
                    }
                },
                fn: async (args = {}) => {
                    const { tile, tokens, action, userId, value, method, change } = args;

                    let entities = await MonksActiveTiles.getEntities(args);
                    if (entities.length == 0)
                        entities = [null];
                    //if (action.data.for !== 'token')
                    //    entities = [entities[0]];

                    for (let entity of entities) {
                        //Add a chat message
                        let user = game.users.find(u => u.id == userId);
                        let scene = game.scenes.find(s => s.id == user?.viewedScene);

                        let tkn = (entity?._object || tokens[0]?._object);

                        const speaker = { scene: scene?.id, actor: tkn?.actor?.id || user?.character?.id, token: tkn?.id, alias: tkn?.name || user?.name };

                        if (typeof action.data.text == "string" && (action.data.text.startsWith('/') || action.data.text.startsWith('[[/'))) {
                            ui.chat.processMessage(action.data.text);
                        } else {
                            let content = await getValue(action.data.text, args, entity, { speaker });
                            let flavor = await getValue(action.data.flavor, args, entity, { speaker });

                            let showto = action.data.showto || "everyone";
                            let showUsers = MonksActiveTiles.getForPlayers(showto, args);

                            if (action.data.chatbubble !== "false") {
                                if (tkn instanceof foundry.canvas.placeables.Token) {
                                    let su = foundry.utils.duplicate(showUsers);
                                    if (su.includes(game.user.id) && canvas.scene.id == tkn.document.parent.id) {
                                        canvas.hud.bubbles.say(tkn, content);
                                        su = su.filter(u => u != game.user.id);
                                    }
                                    if (su.length) {
                                        MonksActiveTiles.emit("bubble", {
                                            content,
                                            tokenId: tkn.id,
                                            users: su
                                        });
                                    }
                                }
                            }
                            if (action.data.chatbubble !== "bubble") {
                                let messageData = {
                                    user: userId,
                                    speaker: speaker,
                                    style: (action.data.incharacter ? CONST.CHAT_MESSAGE_STYLES.IC : CONST.CHAT_MESSAGE_STYLES.OOC),
                                    content: content
                                };

                                if (flavor)
                                    messageData.flavor = flavor;

                                if (action.data.showto != "everyone")
                                    messageData.whisper = showUsers;

                                if (action.data.showto == 'gm') {
                                    messageData.speaker = null;
                                    messageData.user = game.user.id;
                                }

                                if (action.data.language != '' && game.modules.get("polyglot")?.active) {
                                    let language = action.data.language.indexOf(":") > -1 ? action.data.language.split(":")[1] : action.data.language;
                                    if (!!language)
                                        foundry.utils.mergeObject(messageData, { flags: { 'monks-active-tiles': { language } }, lang: language });
                                }

                                await ChatMessage.create(messageData, { chatBubble: false });
                            }
                        }
                    }
                },
                content: async (trigger, action) => {
                    let syslang = CONFIG[game.system.id.toUpperCase()]?.languages || {};
                    let langlist = {};
                    let parseGroup = (group, groupkey) => {
                        for (let [key, value] of Object.entries(group)) {
                            if (typeof value == "string")
                                langlist[`${groupkey}:${key}`] = value;
                            else
                                parseGroup(value.children, key);
                        }
                    }
                    parseGroup(syslang);

                    let language = langlist[action.data.language];
                    if (!!language)
                        language = game.i18n.localize(language);

                    let msg = $('<div>').text(action.data.text.length <= 15 ? action.data.text : action.data.text.substr(0, 15) + "...").html();
                    return `<span class="action-style">${i18n(trigger.name)}</span> for <span class="value-style">&lt;${MonksActiveTiles.forPlayersName(action.data?.showto || "everyone")}&gt;</span>${(!!language && game.modules.get("polyglot")?.active ? ` in <span class="details-style">"${language}"</span>` : '')}${(action.data?.incharacter ? ' <i class="fas fa-user" title="In Character"></i>' : '')}${(action.data?.chatbubble != "false" ? ' <i class="fas fa-comment" title="Chat Bubble"></i>' : '')} "${msg}"`;
                }
            },
            'runmacro': {
                name: "MonksActiveTiles.action.runmacro",
                ctrls: [
                    {
                        id: "entity",
                        name: "MonksActiveTiles.ctrl.select-entity",
                        type: "select",
                        subtype: "entity",
                        options: { show: ['previous'] },
                        restrict: (entity) => { return (entity instanceof Macro); },
                        defaultType: "macro"
                    },
                    {
                        id: "args",
                        name: "MonksActiveTiles.ctrl.args",
                        type: "text",
                        conditional: () => {
                            return (game.modules.get("advanced-macros")?.active || game.modules.get("furnace")?.active || !setting('use-core-macro'));
                        },
                        help: "separate arguments with spaces, and reference them in the macro using args[0]"
                    },
                    {
                        id: "runasgm",
                        name: "MonksActiveTiles.ctrl.runasgm",
                        list: "runas",
                        type: "list"
                    }
                ],
                values: {
                    'runas': {
                        'unknown': "",
                        'gm': "MonksActiveTiles.runas.gm",
                        'player': "MonksActiveTiles.runas.player"
                    }
                },
                fn: async (args = {}) => {
                    const { action } = args;
                    //Find the macro to be run, call it with the data from the trigger
                    let entities;
                    if (!action.data.entity) {
                        try {
                            entities = await fromUuid(action.data?.macroid);
                        } catch {
                            entities = game.macros.get(action.data?.macroid);
                        }
                        entities = [entities];
                    } else {
                        entities = await MonksActiveTiles.getEntities(args, "macros");
                    }

                    for (let macro of entities) {
                        if (macro instanceof Macro) {
                            return await MonksActiveTiles._executeMacro(macro, args);
                        }
                    }
                },
                content: async (trigger, action) => {
                    let pack;
                    let entityName = "";
                    if (!action.data.entity) {
                        let macro;
                        try {
                            macro = await fromUuid(action.data?.macroid);
                        } catch {
                            macro = game.macros.get(action.data?.macroid);
                        }
                        entityName = (macro?.name || 'Unknown Macro');

                        if (macro?.document?.pack)
                            pack = game.packs.get(macro.document.pack);

                        entityName = (pack ? '<i class="fas fa-atlas" data-tooltip="From compendium"></i> ' + pack.metadata.label + ":" : "") + entityName;
                    } else {
                        let ctrl = trigger.ctrls.find(c => c.id == "entity");
                        entityName = await MonksActiveTiles.entityName(action.data?.entity || ctrl?.defvalue || "previous", 'macros');
                    }

                    return `<span class="action-style">${i18n(trigger.name)}</span>, <span class="entity-style">${entityName}</span>${(action.data.runasgm != undefined && action.data.runasgm != 'unknown' ? ' as <span class="value-style">&lt;' + i18n(trigger.values.runas[action.data.runasgm]) + '&gt;</span>' : '')}`;
                }
            },
            'runcode': {
                name: "MonksActiveTiles.action.runcode",
                ctrls: [
                    {
                        id: "code",
                        name: "MonksActiveTiles.ctrl.code",
                        type: "text",
                        subtype: "multiline",
                        required: true
                    },
                ],
                fn: async (args = {}) => {
                    const { action } = args;
                    //Find the macro to be run, call it with the data from the trigger
                    return await MonksActiveTiles._executeCode(args);
                },
                content: async (trigger, action) => {
                    return `<span class="action-style">${i18n(trigger.name)}</span>`;
                }
            },
            'rolltable': {
                name: "MonksActiveTiles.action.rolltable",
                ctrls: [
                    /*
                    {
                        id: "rolltableid",
                        name: "MonksActiveTiles.ctrl.selectrolltable",
                        list: async () => {
                            let rolltables = [];

                            for (let pack of game.packs) {
                                if (pack.documentName == 'RollTable') {
                                    const index = await pack.getIndex();
                                    let entries = [];
                                    const tableString = `Compendium.${pack.collection}.`;
                                    for (let table of index) {
                                        entries.push({
                                            name: table.name,
                                            uuid: tableString + table._id,
                                        });
                                    }

                                    let groups = entries.sort((a, b) => { return a.name.localeCompare(b.name) }).reduce((a, v) => ({ ...a, [v.uuid]: v.name }), {});
                                    rolltables.push({ text: pack.metadata.label, groups: groups });
                                }
                            };

                            let groups = game.tables.map(t => { return { uuid: t.uuid, name: t.name } }).sort((a, b) => { return a.name.localeCompare(b.name) }).reduce((a, v) => ({ ...a, [v.uuid]: v.name }), {});
                            rolltables.push({ text: "Rollable Tables", groups: groups });
                            return rolltables;
                        },
                        type: "list",
                        required: true
                    },
                    */
                    {
                        id: "rolltableid",
                        name: "MonksActiveTiles.ctrl.selectrolltable",
                        type: "select",
                        subtype: "entity",
                        defaultType: "rolltables",
                        required: true,
                        placeholder: 'Please select a Roll Table',
                        options: { show: ['previous'] },
                        restrict: (entity) => { return (entity instanceof RollTable); }
                    },
                    {
                        id: "quantity",
                        name: "MonksActiveTiles.ctrl.quantity",
                        type: "text",
                        defvalue: "1",
                        help: "Set this to blank to use the roll table quantity"
                    },
                    {
                        id: "rollmode",
                        name: 'MonksActiveTiles.ctrl.rollmode',
                        list: "rollmode",
                        type: "list"
                    },
                    {
                        id: "chatmessage",
                        name: 'MonksActiveTiles.ctrl.chatmessage',
                        type: "checkbox",
                        defvalue: true
                    },
                    {
                        id: "reset",
                        name: 'MonksActiveTiles.ctrl.reset',
                        type: "checkbox",
                        defvalue: true
                    },
                    {
                        id: "roll",
                        name: 'MonksActiveTiles.ctrl.rolldice',
                        type: "checkbox",
                        defvalue: false
                    },
                ],
                values: {
                    'rollmode': {
                        "roll": 'MonksActiveTiles.rollmode.public',
                        "gmroll": 'MonksActiveTiles.rollmode.private',
                        "blindroll": 'MonksActiveTiles.rollmode.blind',
                        "selfroll": 'MonksActiveTiles.rollmode.self'
                    }
                },
                fn: async (args = {}) => {
                    const { tokens, action, userId } = args;

                    let checkText = async function (text, result) {
                        if (text.startsWith("{")) {
                            try {
                                let obj = JSON.parse(text);
                                if (obj.x || obj.y) {
                                    if (result.location == undefined) result.location = [];
                                    if (action.data.roll) {
                                        if (obj.x) {
                                            let roll = await rollDice(obj.x);
                                            obj.x = roll.value;
                                        }
                                        if (obj.y) {
                                            let roll = await rollDice(obj.y);
                                            obj.y = roll.value;
                                        }
                                    }
                                    return result.location.push(obj);
                                } else {
                                    if (game.system.id == "dnd5e") {
                                        if (Object.keys(obj).find(k => Object.keys(game.model.Actor.character.currency).find(c => c == k))) {
                                            if (result.items == undefined) result.items = [];
                                            if (action.data.roll) {
                                                for (let [k, v] of Object.entries(obj)) {
                                                    let roll = await rollDice(v);
                                                    obj[k] = roll.value;
                                                }
                                            }
                                            return result.items.push(obj);
                                        }
                                    }
                                }
                            } catch { }
                        }

                        if (result.text == undefined) result.text = [];
                        result.text.push(text);
                    }

                    let results = {
                        continue: true,
                        results: [],
                        roll: []
                    };
                    let entities = await MonksActiveTiles.getEntities(args, 'rolltables', action.data?.rolltableid);
                    //Find the roll table
                    for (let rolltable of entities) {
                        if (rolltable instanceof RollTable) {
                            //Make a roll

                            const available = rolltable.results.filter(r => !r.drawn);
                            if (!available.length && action?.data?.reset)
                                await rolltable.resetResults();

                            let numRolls = await MonksActiveTiles.getValue(action.data?.quantity || 1, args, rolltable);
                            if (isNaN(numRolls)) {
                                try {
                                    numRolls = parseInt(numRolls);
                                } catch {
                                    numRolls = 1;
                                }
                            }
                            if (numRolls < 1) numRolls = 1;

                            let tblResults = await rolltable.drawMany(numRolls, { rollMode: action.data.rollmode, displayChat: false });
                            //Check to see what the privacy rules are

                            if (action.data.chatmessage !== false) {
                                let user = game.users.find(u => u.id == userId);
                                let scene = game.scenes.find(s => s.id == user.viewedScene);
                                const speaker = { scene: scene?.id, actor: user?.character?.id, token: tokens[0]?.id, alias: user.name };
                                // Override the toMessage so that I can change the speaker

                                // Construct chat data
                                const nr = tblResults.results.length > 1 ? `${tblResults.results.length} results` : "a result";
                                let messageData = {
                                    flavor: `Draws ${nr} from the ${rolltable.name} table.`,
                                    user: userId,
                                    speaker: speaker,
                                    style: CONST.CHAT_MESSAGE_STYLES.OTHER,
                                    roll: tblResults.roll,
                                    rolls: [tblResults.roll],
                                    sound: tblResults.roll ? CONFIG.sounds.dice : null,
                                    flags: { "core.RollTable": rolltable.id }
                                };

                                // Render the chat card which combines the dice roll with the drawn results
                                let description = await foundry.applications.ux.TextEditor.implementation.enrichHTML(rolltable.description, { documents: true, entities: true, async: true })

                                let resultData = {
                                    description: description,
                                    results: [],
                                    rollHTML: rolltable.displayRoll ? await tblResults.roll.render() : null,
                                    table: rolltable
                                };

                                for (let r of foundry.utils.duplicate(tblResults.results)) {
                                    let original = tblResults.results.find(res => res.id == r._id);
                                    r.text = (await original?.getHTML()) || r.text;
                                    r.icon = r.icon || r.img;
                                    resultData.results.push(r);
                                }

                                messageData.content = await foundry.applications.handlebars.renderTemplate(CONFIG.RollTable.resultTemplate, resultData);

                                if (action.data.rollmode != 'roll') {
                                    messageData.whisper = ChatMessage.getWhisperRecipients("GM").map(u => u.id);
                                    messageData.speaker = null;
                                    messageData.user = game.user.id;
                                }

                                // Create the chat message
                                ChatMessage.create(messageData, { rollMode: action.data.rollmode });
                            }

                            results.results = results.results.concat(tblResults.results);
                            results.roll.push(tblResults.roll);

                            if (results.results.length) {
                                //roll table result
                                results;
                                for (let tableresult of results.results) {
                                    let entity;

                                    if (!tableresult.uuid) {
                                        await checkText(tableresult.name, results);
                                    } else {
                                        let entity = await fromUuid(tableresult.uuid);
                                        if (entity == null)
                                            await checkText(tableresult.name, results);
                                    }

                                    MonksActiveTiles.addToResult(entity, results);
                                }
                            }

                            debug("Rolltable", results);
                        }
                    }
                    return results;
                },
                content: async (trigger, action) => {
                    let ctrl = trigger.ctrls.find(c => c.id == "rolltableid");
                    let entityName = await MonksActiveTiles.entityName(action.data?.rolltableid || ctrl?.defvalue || "unknown", "rolltable");
                    return `<span class="action-style">${i18n(trigger.name)}</span>, ${action.data?.quantity ? `<span class="value-style">&lt;${action.data?.quantity} items&gt;</span>` : ''} from <span class="entity-style">${entityName}</span>`;
                }
            },
            'resetfog': {
                name: "MonksActiveTiles.action.resetfog",
                ctrls: [
                    /*
                    {
                        id: "showto",
                        name: "MonksActiveTiles.ctrl.for",
                        list: "showto",
                        type: "list",
                        subtype: "for"
                    }
                    */
                ],
                values: {
                    'showto': {
                        "everyone": "MonksActiveTiles.for.all",
                        "players": "MonksActiveTiles.for.players",
                        "gm": "MonksActiveTiles.for.gm",
                        "trigger": "MonksActiveTiles.for.triggering",
                        "token": "MonksActiveTiles.for.token",
                        "owner": "MonksActiveTiles.for.owner",
                        "previous": "MonksActiveTiles.for.current"
                    }
                },
                fn: async () => {
                    //if (action.data?.for == 'token') {
                    //canvas.sight._onResetFog(result)
                    //}
                    //else
                    //canvas.sight.resetFog();

                    //let showto = action.data.showto || "everyone";
                    canvas.fog.reset();
                },
                content: async (trigger, action) => {
                    return `<span class="action-style">${i18n(trigger.name)}</span> for <span class="value-style">&lt;${(action.data?.for == 'token' ? 'Token' : 'Everyone')}&gt;</span>`;
                }
            },
            'activeeffect': {
                name: "MonksActiveTiles.action.activeeffect",
                ctrls: [
                    {
                        id: "entity",
                        name: "MonksActiveTiles.ctrl.select-entity",
                        type: "select",
                        subtype: "entity",
                        options: { show: ['token', 'within', 'players', 'previous', 'tagger'] },
                        restrict: (entity) => { return (entity instanceof foundry.canvas.placeables.Token); }
                    },
                    {
                        id: "effectid",
                        name: "MonksActiveTiles.ctrl.effectlist",
                        list: () => {
                            let result = {};
                            let conditions = CONFIG.statusEffects;
                            if (game.system.id == 'pf2e') {
                                conditions = game.pf2e.ConditionManager.conditions;
                                conditions = [...conditions].map(e => { return { id: e[0], label: e[1].name }; }).filter((value, index, array) => array.findIndex(a => a.label === value.label) === index);
                            }
                            for (let effect of conditions.sort((a, b) => { return String(a.label || a.name).localeCompare(b.label || b.name) })) { //(i18n(a.label) > i18n(b.label) ? 1 : (i18n(a.label) < i18n(b.label) ? -1 : 0))
                                result[effect.id] = i18n(effect.label || effect.name);
                            }
                            return result;
                        },
                        conditional: (app) => {
                            let action = $('select[name="data.addeffect"]', app.element).val();
                            return action != "clear";
                        },
                        check: true,
                        type: "list",
                        required: true
                    },
                    {
                        id: "addeffect",
                        name: "Add Effect",
                        type: "list",
                        list: 'add',
                        conditional: (app) => {
                            if (game.system.id == 'pf2e') {
                                let id = $('select[name="data.effectid"]', app.element).val();
                                let condition = game.pf2e.ConditionManager.conditions.get(id);
                                return !condition.value;
                            } else
                                return true;
                        },
                        defvalue: 'add',
                        check: true,
                    },
                    {
                        id: "altereffect",
                        name: "Alter Effect",
                        type: "text",
                        conditional: (app) => {
                            let action = $('select[name="data.addeffect"]', app.element).val();
                            if (action == "clear")
                                return false;

                            if (game.system.id != 'pf2e')
                                return false;

                            let id = $('select[name="data.effectid"]', app.element).val();
                            let condition = game.pf2e.ConditionManager.conditions.get(id);

                            return !!condition.value;
                        },
                        help: "If you want to increase the value use '+ 1'"
                    }
                ],
                values: {
                    'add': {
                        'add': "MonksActiveTiles.add.add",
                        'remove': "MonksActiveTiles.add.remove",
                        'toggle': "MonksActiveTiles.add.toggle",
                        'clear': "MonksActiveTiles.add.clear"
                    }
                },
                fn: async (args = {}) => {
                    const { action } = args;
                    let entities = await MonksActiveTiles.getEntities(args);
                    if (entities.length == 0)
                        return;

                    let effectAction = action.data?.addeffect || 'add';

                    if (game.system.id == 'pf2e') {
                        if (effectAction == 'clear') {
                            let effectList = ActionManager.actions["activeeffect"].ctrls.find(c => c.id == "effectid").list();
                            for (let token of entities) {
                                if (token == undefined)
                                    continue;

                                for (const [k, v] of Object.entries(effectList)) {
                                    let effect = game.pf2e.ConditionManager.getCondition(k);
                                    if (effect) {
                                        let existing = token.actor.itemTypes.condition.find((condition) => {
                                            return condition.slug === effect.slug;
                                        });
                                        if (existing) {
                                            await token.actor.decreaseCondition(effect.slug, { forceRemove: true });
                                        }
                                    }
                                }
                            }
                        } else {
                            let effect = game.pf2e.ConditionManager.getCondition(action.data?.effectid);

                            if (effect) {
                                for (let token of entities) {
                                    if (token == undefined)
                                        continue;

                                    let existing = token.actor.itemTypes.condition.find((condition) => {
                                        return condition.slug === effect.slug;
                                    });

                                    if (effect.value) {
                                        let value = parseInt(action.data?.altereffect.replace(' ', ''));
                                        if (isNaN(value))
                                            continue;

                                        if (value < 0) {
                                            if (existing) {
                                                let newVal = existing.value + value;
                                                if (newVal < 1)
                                                    await token.actor.decreaseCondition(effect.slug, { forceRemove: true });
                                                else
                                                    await game.pf2e.ConditionManager.updateConditionValue(existing.id, token.object, newVal);
                                            }
                                        } else {
                                            if (existing) {
                                                let newVal = (action.data?.altereffect.startsWith("+") ? existing.value + value : value);
                                                await game.pf2e.ConditionManager.updateConditionValue(existing.id, token.object, newVal);
                                            } else {
                                                await token.actor.increaseCondition(effect.slug, { min: value, max: value });
                                            }
                                        }
                                    } else {
                                        let add = (effectAction == 'add');

                                        if (effectAction == 'toggle') {
                                            add = (existing == undefined);
                                        }

                                        if (add)
                                            await token.actor.increaseCondition(effect.slug);
                                        else
                                            await token.actor.decreaseCondition(effect.slug, { forceRemove: true });
                                    }
                                }
                            }
                        }
                    } else {
                        if (effectAction == 'clear') {
                            let effectList = ActionManager.actions["activeeffect"].ctrls.find(c => c.id == "effectid").list();
                            for (let token of entities) {
                                if (token == undefined)
                                    continue;

                                for (const [k, v] of Object.entries(effectList)) {
                                    let effect = CONFIG.statusEffects.find(e => e.id === k);
                                    const exists = token.actor.statuses.has(effect.id);
                                    if (exists)
                                        await this.object.toggleEffect(effect, { overlay: false });
                                }
                            }
                        } else {
                            let effect = CONFIG.statusEffects.find(e => e.id === action.data?.effectid);

                            if (effect) {
                                for (let token of entities) {
                                    if (token == undefined)
                                        continue;

                                    if (effectAction == 'toggle')
                                        await token.object.toggleEffect(effect, { overlay: false });
                                    else {
                                        const exists = token.actor.statuses.has(effect.id);
                                        if (exists != (effectAction == 'add'))
                                            await token.object.toggleEffect(effect, { overlay: false });
                                    }
                                }
                            }
                        }
                    }

                    return { tokens: entities, entities: entities };
                },
                content: async (trigger, action) => {
                    let effect = CONFIG.statusEffects.find(e => e.id === action.data?.effectid);
                    if (game.system.id == 'pf2e')
                        effect = game.pf2e.ConditionManager.getCondition(action.data?.effectid);
                    let ctrl = trigger.ctrls.find(c => c.id == "entity");
                    let entityName = await MonksActiveTiles.entityName(action.data?.entity || ctrl?.defvalue || "previous");
                    return `<span class="action-style">${effect.value ? "Alter" : i18n(trigger.values.add[action?.data?.addeffect || 'add'])}</span> <span class="details-style">"${action?.data?.addeffect != "clear" ? (i18n(effect?.label) || effect?.name || 'Unknown Effect') : "All Effects"}"</span>${effect.value && action?.data?.addeffect != "clear" ? " by " + action.data?.altereffect : ""} ${effect.value ? "on" : (action.data?.addeffect == 'add' ? "to" : (action.data?.addeffect == 'remove' ? "from" : "on"))} <span class="entity-style">${entityName}</span>`;
                }
            },
            'playanimation': {
                name: "MonksActiveTiles.action.playanimation",
                requiresGM: true,
                ctrls: [
                    {
                        id: "entity",
                        name: "MonksActiveTiles.ctrl.select-entity",
                        type: "select",
                        subtype: "entity",
                        options: { show: ['tile', 'tagger'] },
                        restrict: (entity) => { return (entity instanceof foundry.canvas.placeables.Tile); },
                        defaultType: 'tiles'
                    },
                    {
                        id: "play",
                        name: "MonksActiveTiles.ctrl.animation",
                        list: "animate",
                        type: "list",
                        defvalue: "start",
                        check: true,
                    },
                    {
                        id: "offset",
                        name: "MonksActiveTiles.ctrl.offset",
                        type: "number",
                        step: 1,
                        min: 0,
                        conditional: (app) => {
                            let play = $('select[name="data.play"]', app.element).val();

                            return play == "start";
                        },
                    },
                    {
                        id: "animatefor",
                        name: "MonksActiveTiles.ctrl.for",
                        list: "animatefor",
                        type: "list",
                        subtype: "for",
                        defvalue: "everyone"
                    }
                ],
                values: {
                    'animatefor': {
                        "everyone": "MonksActiveTiles.for.all",
                        "players": "MonksActiveTiles.for.players",
                        "gm": "MonksActiveTiles.for.gm",
                        "trigger": "MonksActiveTiles.for.triggering",
                        "token": "MonksActiveTiles.for.token",
                        "owner": "MonksActiveTiles.for.owner",
                        "previous": "MonksActiveTiles.for.current"
                    },
                    'animate': {
                        'start': "MonksActiveTiles.animate.start",
                        'pause': "MonksActiveTiles.animate.pause",
                        'stop': "MonksActiveTiles.animate.stop",
                        'toggle': "MonksActiveTiles.animate.toggle",
                        'reset': "MonksActiveTiles.animate.reset"
                    }
                },
                fn: async (args = {}) => {
                    const { action, userId } = args;
                    let entities = await MonksActiveTiles.getEntities(args, 'tiles');
                    if (entities.length == 0)
                        return;

                    let showto = action.data.animatefor || "all";

                    for (let entity of entities) {
                        if (entity.object && entity.object.isVideo) {
                            let offset = action.data?.offset ? await getValue(action.data?.offset, args, entity) : null;

                            let newAction = action.data?.play;
                            if (newAction == "toggle") {
                                newAction = entity.object?.sourceElement.paused ? "start" : "pause";
                                if (newAction == "start")
                                    offset = entity.object?.sourceElement.currentTime;
                            }

                            const src = entity.object?.sourceElement;
                            const currentAction = src.paused ? "pause" : src.ended ? "stop" : "start";
                            
                            let showUsers = MonksActiveTiles.getForPlayers(showto, args);

                            if (currentAction != newAction) {
                                if (action.data.animatefor === 'everyone') {
                                    let video = { autoplay: false };

                                    await entity.update({ video }, {
                                        diff: false,
                                        playVideo: newAction == 'start',
                                        offset: entity.object?.sourceElement.ended || newAction == 'reset' ? 0 : offset
                                    });
                                    if (newAction == 'reset' && entity.object) {
                                        entity.object.sourceElement.currentTime = 0; 
                                        MonksActiveTiles.emit('playvideo', {
                                            users: showUsers,
                                            tileid: entity.uuid,
                                            playaction: newAction,
                                        });
                                    }
                                } else {
                                    const el = entity.object.sourceElement;
                                    if (el?.tagName !== "VIDEO") continue;

                                    if (showUsers.includes(game.user.id)) {
                                        if (newAction == 'stop')
                                            game.video.stop(entity.object?.sourceElement);
                                        else if (newAction == 'pause')
                                            entity.object?.sourceElement.pause();
                                        else if (newAction == "reset") {
                                            if (entity.object) entity.object.sourceElement.currentTime = 0;   
                                        } else
                                            entity.object?.sourceElement.play();

                                        showUsers = showUsers.filter(u => u != game.user.id);
                                    }

                                    if (showUsers.length > 0) {
                                        MonksActiveTiles.emit('playvideo', {
                                            users: showUsers,
                                            tileid: entity.uuid,
                                            playaction: newAction,
                                            offset: entity.object?.sourceElement.ended || newAction == 'reset' ? 0 : offset
                                        });
                                    }
                                }
                            }
                        }
                    }

                    return { entities: entities };
                },
                content: async (trigger, action) => {
                    let ctrl = trigger.ctrls.find(c => c.id == "entity");
                    let entityName = await MonksActiveTiles.entityName(action.data?.entity || ctrl?.defvalue || "previous", 'tiles');
                    return `<span class="action-style">${i18n(trigger.values.animate[action.data?.play])} animation</span> on <span class="entity-style">${entityName}</span> for <span class="value-style">&lt;${MonksActiveTiles.forPlayersName(action.data?.animatefor || "everyone") }&gt;</span>`;
                }
            },
            'openjournal': {
                name: "MonksActiveTiles.action.openjournal",
                ctrls: [
                    {
                        id: "entity",
                        name: "MonksActiveTiles.ctrl.select-entity",
                        type: "select",
                        subtype: "entity",
                        options: { show: ['players', 'previous'] },
                        restrict: (entity) => { return (entity instanceof JournalEntry); },
                        required: true,
                        defaultType: 'journal',
                        placeholder: 'Please select a Journal',
                        check: true,
                        onChange: async (app, ctrl, action, data) => {
                            $('select[name="data.page"]', app.element).empty();
                            let value = $(ctrl).val();
                            if (!!value) {
                                try {
                                    let entityVal = JSON.parse(value);

                                    let pageCtrl = action.ctrls.find(c => c.id == "page");
                                    let list = await pageCtrl.list(app, action, { entity: entityVal });
                                    $('select[name="data.page"]', app.element).append(app.fillList(list, data.page));
                                } catch { }
                            }
                        }
                    },
                    {
                        id: "page",
                        name: "Page",
                        placeholder: 'Please select a Journal Page',
                        list: async (app, action, data) => {
                            let value = data.entity?.id;
                            if (!!value) {
                                try {
                                    // make sure it's not an enhanced journal, those shouldn't reveal their pages
                                    if (/^JournalEntry.[a-zA-Z0-9]{16}$/.test(value) || /^Compendium.+[a-zA-Z0-9]{16}$/.test(value)) {
                                        let entity = await fromUuid(value);

                                        if (entity && !(entity.pages.size == 1 && !!foundry.utils.getProperty(entity.pages.contents[0], "flags.monks-enhanced-journal.type"))) {
                                            let list = { "": "" };
                                            for (let p of entity.pages)
                                                list[p._id] = p.name;

                                            return list;
                                        }
                                    }
                                } catch { }
                            }
                        },
                        type: "list",
                        required: false,
                        conditional: async (app) => {
                            let value = $('input[name="data.entity"]', app.element).data("value") || {};
                            if (!!value?.id) {
                                try {
                                    // make sure it's not an enhanced journal, those shouldn't reveal their pages
                                    if (/^JournalEntry.[a-zA-Z0-9]{16}$/.test(value.id) || /^Compendium.+[a-zA-Z0-9]{16}$/.test(value.id)) {
                                        let entity = await fromUuid(value.id);
                                        if (entity)
                                            return !(entity && entity.pages.size == 1 && !!foundry.utils.getProperty(entity.pages.contents[0], "flags.monks-enhanced-journal.type"));
                                    }
                                } catch { }
                            }
                            return true;
                        }
                    },
                    {
                        id: "subsection",
                        name: "Subsection",
                        type: "text",
                        required: false,
                        conditional: async (app) => {
                            let value = $('input[name="data.entity"]', app.element).data("value") || {};
                            if (!!value?.id) {
                                try {
                                    // make sure it's not an enhanced journal, those shouldn't reveal their pages
                                    if (/^JournalEntry.[a-zA-Z0-9]{16}$/.test(value.id) || /^Compendium.+[a-zA-Z0-9]{16}$/.test(value.id)) {
                                        let entity = await fromUuid(value.id);
                                        if (entity)
                                            return !(entity && entity.pages.size == 1 && !!foundry.utils.getProperty(entity.pages.contents[0], "flags.monks-enhanced-journal.type"));
                                    }
                                } catch { }
                            }
                            return true;
                        }
                    },
                    {
                        id: "showto",
                        name: "MonksActiveTiles.ctrl.showto",
                        list: "showto",
                        type: "list",
                        subtype: "for",
                        defvalue: "everyone"
                    },
                    {
                        id: "asimage",
                        name: "MonksActiveTiles.ctrl.asimage",
                        type: "checkbox",
                        help: "If the journal is an image, attempt to show it as an image"
                    },
                    {
                        id: "permission",
                        name: "MonksActiveTiles.ctrl.usepermission",
                        list: "permission",
                        type: "list",
                        defvalue: "false"
                    },
                    {
                        id: "enhanced",
                        name: "MonksActiveTiles.ctrl.enhanced",
                        type: "checkbox",
                        conditional: () => { return game.modules.get('monks-enhanced-journal')?.active }
                    }
                ],
                values: {
                    'showto': { 
                        "everyone": "MonksActiveTiles.for.all",
                        "players": "MonksActiveTiles.for.players",
                        "gm": "MonksActiveTiles.for.gm",
                        "trigger": "MonksActiveTiles.for.triggering",
                        "token": "MonksActiveTiles.for.token",
                        "owner": "MonksActiveTiles.for.owner",
                        "previous": "MonksActiveTiles.for.current"
                    },
                    'permission': {
                        "true": "MonksActiveTiles.permission.check",
                        "false": "MonksActiveTiles.permission.ignore",
                        "LIMITED": "MonksActiveTiles.permission.limited",
                        "OBSERVER": "MonksActiveTiles.permission.observer",
                        "OWNER": "MonksActiveTiles.permission.owner",
                    }
                },
                fn: async (args = {}) => {
                    const { action, userId } = args;

                    if (!MonksActiveTiles.allowRun)
                        return;

                    let entities;
                    if (action.data.entity.id == 'players') {
                        let user = game.users.get(userId);
                        if (user.isGM)
                            return;
                        entities = [game.journal.find(j => {
                            return j.testUserPermission(user, "OWNER");
                        })];
                    } else
                        entities = await MonksActiveTiles.getEntities(args, 'journal');

                    if (entities.length == 0)
                        return;

                    let showto = action.data.showto || "everyone";

                    const levels = CONST.DOCUMENT_OWNERSHIP_LEVELS;

                    for (let entity of entities) {
                        //open journal
                        if (!entity || !(entity instanceof JournalEntry || entity instanceof JournalEntryPage))
                            continue;

                        let showUsers = MonksActiveTiles.getForPlayers(showto, args);

                        if (action.data.permission != "true" && action.data.permission != "false") {
                            const ownership = entity.ownership;
                            if (showto == "everyone") {
                                //If everyone, then set the ownership to the default
                                ownership.default = levels[action.data.permission];
                            }
                            showUsers.forEach(id => {
                                //If any users are less than the default, boost them up, and if greater and force is true, then bring them down.
                                let user = game.users.get(id);
                                if (!user?.isGM) {
                                    ownership[id] = levels[action.data.permission];
                                }
                            });
                            await entity.update({ ownership });
                        }

                        if (showUsers.includes(game.user.id)) {
                            if (game.modules.get("monks-enhanced-journal")?.active && entity instanceof JournalEntry && entity.pages.size == 1 && !!foundry.utils.getProperty(entity.pages.contents[0], "flags.monks-enhanced-journal.type")) {
                                let type = foundry.utils.getProperty(entity.pages.contents[0], "flags.monks-enhanced-journal.type");
                                if (type == "base" || type == "oldentry") type = "journalentry";
                                let types = game.MonksEnhancedJournal.getDocumentTypes();
                                if (types[type]) {
                                    entity = entity.pages.contents[0];
                                    game.MonksEnhancedJournal.fixType(entity);
                                }
                            }

                            if (action.data.asimage && (entity.type == "image" || foundry.utils.getProperty(entity, "flags.monks-enhanced-journal.type") == "picture")) {
                                new foundry.applications.apps.ImagePopout({ src: entity.src }).render(true);
                            } else {
                                let anchor = action.data.subsection?.slugify().replace(/["']/g, "").substring(0, 64);
                                if (action.data?.enhanced !== true || !game.modules.get("monks-enhanced-journal")?.active || !game.MonksEnhancedJournal.openJournalEntry(entity, { tempOwnership: !action.data.permission, pageId: action.data.page, anchor: anchor }))
                                    entity.sheet.render(true, { force: !action.data.permission, pageId: action.data.page, anchor: anchor });

                                showUsers = showUsers.filter(u => u != game.user.id);
                            }
                        }

                        if (showUsers.length) {
                            MonksActiveTiles.emit('journal', {
                                users: showUsers,
                                entityid: entity.uuid,
                                permission: action.data.permission,
                                enhanced: action.data.enhanced,
                                page: action.data.page,
                                subsection: action.data.subsection?.slugify().replace(/["']/g, "").substring(0, 64),
                                asimage: action.data.asimage
                            });
                        } 
                    }

                    return { entities: entities };
                },
                content: async (trigger, action) => {
                    let ctrl = trigger.ctrls.find(c => c.id == "entity");
                    let entityName = await MonksActiveTiles.entityName(action.data?.entity || ctrl?.defvalue || "previous", 'journal');
                    return `<span class="action-style">${i18n(trigger.name)}</span>, <span class="entity-style">${entityName}</span> for <span class="value-style">&lt;${MonksActiveTiles.forPlayersName(action.data?.showto || "everyone") }&gt;</span>`;
                }
            },
            'openactor': {
                name: "MonksActiveTiles.action.openactor",
                ctrls: [
                    {
                        id: "entity",
                        name: "MonksActiveTiles.ctrl.select-entity",
                        type: "select",
                        subtype: "entity",
                        options: { show: ['within', 'players', 'previous', 'tagger'] },
                        restrict: (entity) => { return (entity instanceof Actor || entity instanceof foundry.canvas.placeables.Token); },
                        required: true,
                        defaultType: 'actors',
                        placeholder: 'Please select a Token or Actor'
                    },
                    {
                        id: "showto",
                        name: "MonksActiveTiles.ctrl.showto",
                        list: "showto",
                        type: "list",
                        subtype: "for",
                        defvalue: "everyone"
                    },
                ],
                values: {
                    'showto': {
                        "everyone": "MonksActiveTiles.for.all",
                        "players": "MonksActiveTiles.for.players",
                        "gm": "MonksActiveTiles.for.gm",
                        "trigger": "MonksActiveTiles.for.triggering",
                        "token": "MonksActiveTiles.for.token",
                        "owner": "MonksActiveTiles.for.owner",
                        "previous": "MonksActiveTiles.for.current"

                    }
                },
                fn: async (args = {}) => {
                    const { action, userId } = args;
                    let entities;
                    if (action.data.entity.id == 'players') {
                        let user = game.users.get(userId);
                        if (user.isGM)
                            return;
                        entities = [user.character];
                    } else
                        entities = await MonksActiveTiles.getEntities(args, 'actors');

                    if (entities.length == 0)
                        return;

                    let showto = action.data.showto || "everyone";

                    for (let entity of entities) {
                        if (entity instanceof TokenDocument)
                            entity = entity.actor;

                        if (!(entity instanceof Actor))
                            continue;

                        let showUsers = MonksActiveTiles.getForPlayers(showto, args);
                        if (showUsers.includes(game.user.id)) {
                            entity.sheet.render(true);
                            showUsers = showUsers.filter(u => u != game.user.id);
                        }

                        if (showUsers.length) {
                            MonksActiveTiles.emit('actor', {
                                users: showUsers,
                                entityid: entity.uuid,
                                permission: action.data.permission,
                                enhanced: action.data.enhanced
                            });
                        }
                    }

                    return { entities: entities };
                },
                content: async (trigger, action) => {
                    let ctrl = trigger.ctrls.find(c => c.id == "entity");
                    let entityName = await MonksActiveTiles.entityName(action.data?.entity || ctrl?.defvalue || "previous", 'actors');
                    return `<span class="action-style">${i18n(trigger.name)}</span>, <span class="entity-style">${entityName}</span> for <span class="value-style">&lt;${MonksActiveTiles.forPlayersName(action.data?.showto || "everyone") }&gt;</span>`;
                }
            },
            'additem': {
                name: "MonksActiveTiles.action.additem",
                ctrls: [
                    {
                        id: "entity",
                        name: "MonksActiveTiles.ctrl.select-entity",
                        type: "select",
                        subtype: "entity",
                        options: { show: ['token', 'within', 'players', 'previous', 'tagger'] },
                        restrict: (entity) => { return (entity instanceof foundry.canvas.placeables.Token); }
                    },
                    {
                        id: "item",
                        name: "MonksActiveTiles.ctrl.select-item",
                        type: "select",
                        subtype: "entity",
                        options: { show: ['previous'] },
                        restrict: (entity) => { return (entity instanceof Item); },
                        required: true,
                        placeholder: 'Please select an item',
                        defaultType: 'items'
                    },
                    {
                        id: "quantity",
                        name: "MonksActiveTiles.ctrl.quantity",
                        type: "text",
                        "class": "small-field",
                        defvalue: 1,
                        help: "Set this to blank to use the items original quantity"
                    },
                    {
                        id: "distribute",
                        name: "MonksActiveTiles.ctrl.distribution",
                        list: "distribute",
                        type: "list"
                    },
                    {
                        id: "useplayer",
                        name: "MonksActiveTiles.ctrl.allowplayer",
                        type: "checkbox",
                        help: "Use the player to add the item to their character sheet"
                    },
                ],
                values: {
                    'distribute': {
                        'everyone': "MonksActiveTiles.distribute.everyone",
                        'single': "MonksActiveTiles.distribute.single",
                        'evenall': "MonksActiveTiles.distribute.evenall",
                        'even': "MonksActiveTiles.distribute.even"

                    }
                },
                fn: async (args = {}) => {
                    const { action } = args;
                    let entities = await MonksActiveTiles.getEntities(args);
                    if (entities.length == 0)
                        return;

                    let batch = new BatchManager();

                    let items = await MonksActiveTiles.getEntities(args, 'items', action.data.item);
                    if (items?.length) {
                        let tokens = entities.filter(e => e instanceof TokenDocument && e.actor);
                        let dist = action.data?.distribute || "everyone";
                        let itemsTaken = (dist == "single" ? 1 : (dist == "evenall" ? Math.ceil(items.length / tokens.length) : (dist == "even" ? Math.floor(items.length / tokens.length) : items.length)));
                        for (let token of tokens) {
                            const actor = token.actor;
                            if (!actor) return;

                            for (let i = 0; i < itemsTaken; i++) {
                                let item = (dist == "everyone" ? items[i] : items.shift());

                                if (item) {
                                    if (item instanceof Item) {
                                        const itemData = item.toObject();
                                        if (action.data?.quantity) {
                                            let quantity = await getValue(action.data?.quantity, args, item);
                                            let quantityName = item.system.quantity != undefined ? "quantity" : item.system.value != undefined ? "value" : item.system.eqt != undefined ? "eqt.count" : null;
                                            if (quantityName) {
                                                let valueName = `system.${quantityName}.value`;
                                                let useValue = foundry.utils.getProperty(item, valueName) != undefined;

                                                foundry.utils.setProperty(itemData, `system.${quantityName}`, useValue ? { value: quantity } : quantity);
                                            }
                                        }
                                        let hasAdded = false;
                                        if (action.data?.useplayer) {
                                            let player = game.users.find(u => u.active && !u.isGM && actor.ownership[u.id] == CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER);
                                            if (player) {
                                                MonksActiveTiles.emit('additem', { userId: player.id, actorid: actor.id, uuid: item.uuid, item: itemData });
                                                hasAdded = true;
                                            }
                                        }
                                        if (!hasAdded) {
                                            let sheet = actor.sheet;
                                            const document = await Item.fromDropData({ type: "Item", uuid: item.uuid, data: itemData });
                                            sheet._onDropItem({ preventDefault: () => { }, target: { closest: () => { return false } } }, document);
                                        }

                                        //batch.add("create", item.constructor, itemData, { parent: actor });
                                        //addItems.push(itemData);
                                    } else if (typeof item === 'object') {
                                        // This is potentially currency
                                        let update = {};
                                        if (game.system.id == "dnd5e") {
                                            for (let [k, v] of Object.entries(item)) {
                                                if (actor.system.currency[k] != undefined) {
                                                    let roll = await rollDice(v);
                                                    update[k] = actor.system.currency[k] + parseInt(roll.value);
                                                }
                                            }
                                            if (Object.keys(update).length) {
                                                batch.add("update", actor, { system: { currency: update } });
                                            }
                                        }
                                    }
                                }
                            }
                        }

                        await batch.execute();
                    }

                    return { tokens: entities, entities: entities, items: items };
                },
                content: async (trigger, action) => {
                    let ctrl = trigger.ctrls.find(c => c.id == "entity");
                    let entityName = await MonksActiveTiles.entityName(action.data?.entity || ctrl?.defvalue || "previous");
                    let ctrlItem = trigger.ctrls.find(c => c.id == "item");
                    let item = await MonksActiveTiles.entityName(action.data?.item || ctrlItem?.defvalue || "previous", "items"); //await fromUuid(action.data?.item.id);
                    return `<span class="action-style">${i18n(trigger.name)}</span>, Add <span class="value-style">&lt;${action.data?.quantity || "item's quantity"}&gt;</span> <span class="details-style">"${item?.name || item || 'Unknown Item'}"</span> to <span class="entity-style">${entityName}</span>`;
                }
            },
            'removeitem': {
                name: "MonksActiveTiles.action.removeitem",
                ctrls: [
                    {
                        id: "entity",
                        name: "MonksActiveTiles.ctrl.select-entity",
                        type: "select",
                        subtype: "entity",
                        options: { show: ['token', 'within', 'players', 'previous', 'tagger'] },
                        restrict: (entity) => { return (entity instanceof foundry.canvas.placeables.Token); }
                    },
                    {
                        id: "item",
                        name: "MonksActiveTiles.ctrl.select-item",
                        type: "text",
                        required: true,
                        placeholder: 'Please enter an item name'
                    },
                    {
                        id: "quantity",
                        name: "MonksActiveTiles.ctrl.quantity",
                        type: "text",
                        defvalue: 1
                    },
                ],
                fn: async (args = {}) => {
                    const { action } = args;
                    let entities = await MonksActiveTiles.getEntities(args);
                    if (entities.length == 0)
                        return;

                    let batch = new BatchManager();
                    for (let token of entities) {
                        if (token instanceof TokenDocument) {
                            const actor = token.actor;
                            if (!actor) return;

                            let item = actor.items.find(i => i.name == action.data.item);
                            if (item) {
                                let quantityName = item.system.quantity != undefined ? "quantity" : item.system.value != undefined ? "value" : null;
                                if (quantityName) {
                                    let itemQuantity = item.system[quantityName];
                                    let useValue = false;
                                    if (itemQuantity.value != undefined) {
                                        itemQuantity = itemQuantity.value;
                                        useValue = true;
                                    }

                                    let quantity = MonksActiveTiles.getValue(action.data.quantity, args, actor);
                                    if (quantity != "all") {
                                        quantity = parseInt(quantity);
                                        if (isNaN(quantity) || quantity < 0)
                                            quantity = 1;
                                    }

                                    if (quantity == "all" || itemQuantity <= quantity) {
                                        if (item.type == "condition" && game.system.id == 'pf2e') {
                                            await token.actor.decreaseCondition(item.slug, { forceRemove: true });
                                        } else
                                            batch.add("delete", item);
                                    } else {
                                        itemQuantity -= quantity;
                                        let updateData = {};
                                        updateData[quantityName] = useValue ? { value: itemQuantity } : itemQuantity;
                                        batch.add("update", item, { system: updateData });
                                    }
                                } else {
                                    if (item.type == "condition" && game.system.id == 'pf2e') {
                                        await token.actor.decreaseCondition(item.slug, { forceRemove: true });
                                    } else
                                        batch.add("delete", item);
                                }
                            }
                        }
                    }

                    await batch.execute();

                    return { tokens: entities, entities: entities };
                },
                content: async (trigger, action) => {
                    let ctrl = trigger.ctrls.find(c => c.id == "entity");
                    let entityName = await MonksActiveTiles.entityName(action.data?.entity || ctrl?.defvalue || "previous");
                    return `<span class="action-style">${i18n(trigger.name)}</span>, Remove <span class="value-style">&lt;${action.data?.quantity || "item's quantity"}&gt;</span> <span class="details-style">"${action.data?.item || 'Unknown Item'}"</span> from <span class="entity-style">${entityName}</span>`;
                }
            },
            'permissions': {
                name: "MonksActiveTiles.action.permission",
                requiresGM: true,
                ctrls: [
                    {
                        id: "entity",
                        name: "MonksActiveTiles.ctrl.select-entity",
                        type: "select",
                        required: true,
                        subtype: "entity",
                        options: { show: ['previous', 'tagger'] },
                        restrict: (entity) => {
                            return (
                                entity instanceof foundry.canvas.placeables.Token ||
                                entity instanceof foundry.canvas.placeables.Note ||
                                entity instanceof JournalEntry ||
                                entity instanceof Scene ||
                                entity instanceof Actor
                            );
                        },
                        defaultType: 'journal',
                        placeholder: 'Please select an entity',
                        help: 'You can change permissions for Journals, Notes, Tokens, Actors, or Scenes',
                        onChange: async (app, ctrl, action, data) => {
                            app.checkConditional();
                            $('select[name="data.page"]', app.element).empty();
                            let value = $(ctrl).val();
                            if (!!value) {
                                try {
                                    let entityVal = JSON.parse(value);

                                    if (entityVal?.id?.startsWith("JournalEntry")) {
                                        let pageCtrl = action.ctrls.find(c => c.id == "page");
                                        let list = await pageCtrl.list(app, action, { entity: entityVal });
                                        $('select[name="data.page"]', app.element).append(app.fillList(list, data.page));
                                    }
                                } catch { }
                            }
                        },
                    },
                    {
                        id: "page",
                        name: "Page",
                        placeholder: 'Please select a Journal Page',
                        list: async (app, action, data) => {
                            let value = data.entity?.id;
                            if (!!value) {
                                try {
                                    // make sure it's not an enhanced journal, those shouldn't reveal their pages
                                    if (/^JournalEntry.[a-zA-Z0-9]{16}$/.test(value)) {
                                        let entity = await fromUuid(value);

                                        if (entity && !(entity.pages.size == 1 && !!foundry.utils.getProperty(entity.pages.contents[0], "flags.monks-enhanced-journal.type"))) {
                                            let list = { "": "" };
                                            for (let p of entity.pages)
                                                list[p._id] = p.name;

                                            return list;
                                        }
                                    }
                                } catch { }
                            }
                        },
                        type: "list",
                        required: false,
                        conditional: (app) => {
                            let entity = $('input[name="data.entity"]', app.element).data("value") || {};
                            return entity?.id?.startsWith("JournalEntry");
                        },
                    },
                    {
                        id: "collection",
                        name: "Collection",
                        list: "collection",
                        type: "list",
                        defvalue: "journal",
                        onChange: (app, ctrl, action, data) => {
                            let displayName = game.i18n.format("MonksActiveTiles.CurrentCollection", { collection: $(ctrl).val() || "journal" });
                            $('input[name="data.entity"]', app.element).next().html(displayName);
                        },
                        conditional: (app) => {
                            let entity = $('input[name="data.entity"]', app.element).data("value") || {};
                            return entity?.id == 'previous';
                        },
                    },
                    {
                        id: "changefor",
                        name: "MonksActiveTiles.ctrl.changefor",
                        list: "showto",
                        type: "list",
                        subtype: "for",
                        defvalue: "everyone"
                    },
                    {
                        id: "permission",
                        name: "MonksActiveTiles.ctrl.permission",
                        list: "permissions",
                        type: "list"
                    }

                ],
                values: {
                    'showto': {
                        "everyone": "MonksActiveTiles.for.all",
                        "players": "MonksActiveTiles.for.players",
                        "gm": "MonksActiveTiles.for.gm",
                        "trigger": "MonksActiveTiles.for.triggering",
                        "token": "MonksActiveTiles.for.token",
                        "owner": "MonksActiveTiles.for.owner",
                        "previous": "MonksActiveTiles.for.current"

                    },
                    'permissions': {
                        'default': "OWNERSHIP.DEFAULT",
                        'none': "OWNERSHIP.NONE",
                        'limited': "OWNERSHIP.LIMITED",
                        'observer': "OWNERSHIP.OBSERVER",
                        'owner': "OWNERSHIP.OWNER"

                    },
                    'collection': {
                        'notes': "Notes",
                        'tokens': "Tokens",
                        'journal': "Journal Entry",
                        'scenes': "Scenes",
                        'actors': "Actors",
                    }
                },
                fn: async (args = {}) => {
                    const { action, userId } = args;
                    let entities = await MonksActiveTiles.getEntities(args, action.data?.collection || "journal");
                    if (entities.length == 0)
                        return;

                    let level = (action.data.permission == 'limited' ? CONST.DOCUMENT_OWNERSHIP_LEVELS.LIMITED :
                        (action.data.permission == 'observer' ? CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER :
                            (action.data.permission == 'owner' ? CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER : CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE)));

                    entities = entities.map(e => {
                        if (e.actor)
                            return game.actors.get(e.actor.id);
                        if (e instanceof JournalEntry && action.data.entity.id.startsWith("JournalEntry") && action.data.page)
                            return e.pages.get(action.data.page);
                        return e;
                    });

                    let showto = action.data.changefor || "everyone";
                    //MonksActiveTiles.preventCycle = true;   //prevent the cycling of tokens due to permission changes
                    game.settings.set('monks-active-tiles', 'prevent-cycle', true);
                    for (let entity of entities) {
                        if (!entity)
                            continue;
                        let lvl = level;
                        if (entity instanceof Scene)
                            lvl = CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER;
                        const perms = entity.ownership || entity.actor?.ownership;

                        let showUsers = MonksActiveTiles.getForPlayers(showto, args, {notactive: true});

                        if (showto == 'everyone') {
                            if (action.data.permission == 'default') {
                                for (let user of game.users.contents) {
                                    if (user.isGM) continue;
                                    delete perms[user.id];
                                }
                            } else
                                perms.default = lvl;
                        } else {
                            for (let userId of showUsers) {
                                let user = game.users.get(userId);
                                if (user && !user.isGM) {
                                    if (action.data.permission == 'default')
                                        delete perms[user.id];
                                    else
                                        perms[user.id] = lvl;
                                }
                            }
                        }

                        await entity.setFlag('monks-active-tiles', 'prevent-cycle', true);
                        await entity.update({ ownership: perms }, { diff: false, render: true, recursive: false, noHook: true });
                        await entity.unsetFlag('monks-active-tiles', 'prevent-cycle');
                    }
                    game.settings.set('monks-active-tiles', 'prevent-cycle', false);
                    //MonksActiveTiles.preventCycle = false;

                    let result = { entities: entities };
                    if (entities[0] instanceof TokenDocument)
                        result.tokens = entities;
                    return result;
                },
                content: async (trigger, action) => {
                    let ctrl = trigger.ctrls.find(c => c.id == "entity");
                    let entityName = await MonksActiveTiles.entityName(action.data?.entity || ctrl?.defvalue || "previous", action.data?.collection || "journal");
                    if (action.data?.entity?.id.startsWith("JournalEntry") && action.data?.page) {
                        let entity = await fromUuid(action.data?.entity?.id);
                        entityName += `:${entity.pages.get(action.data?.page)?.name}`;
                    }
                    return `<span class="action-style">${i18n(trigger.name)}</span> of <span class="entity-style">${entityName}</span> to <span class="details-style">"${i18n(trigger.values.permissions[action.data?.permission])}"</span> for <span class="value-style">&lt;${MonksActiveTiles.forPlayersName(action.data?.changefor || "everyone") }&gt;</span>`;
                }
            },
            'attack': {
                name: "MonksActiveTiles.action.attack",
                ctrls: [
                    {
                        id: "entity",
                        name: "MonksActiveTiles.ctrl.select-entity",
                        type: "select",
                        subtype: "entity",
                        options: { show: ['token', 'within', 'players', 'previous', 'tagger'] },
                        restrict: (entity) => { return (entity instanceof foundry.canvas.placeables.Token); }
                    },
                    {
                        id: "actor",
                        name: "MonksActiveTiles.ctrl.select-actor",
                        type: "select",
                        subtype: "entity",
                        restrict: (entity) => { return (entity instanceof Actor || entity instanceof foundry.canvas.placeables.Token); },
                        required: true,
                        defaultType: 'actors',
                        placeholder: 'Please select an Actor to perform attack'
                    },
                    {
                        id: "attack",
                        name: "MonksActiveTiles.ctrl.attack",
                        list: async function (app, action, data) {
                            if (!data?.actor?.id)
                                return;

                            let actor = await fromUuid(data?.actor?.id);
                            if (actor && actor instanceof TokenDocument)
                                actor = actor.actor;
                            if (!actor)
                                return;

                            let result = [];
                            let types = ['weapon', 'spell', 'melee', 'ranged', 'action', 'attack', 'object', 'consumable'];

                            for (let item of actor.items) {
                                if (types.includes(item.type)) {
                                    let group = result.find(g => g.type == item.type);
                                    if (group == undefined) {
                                        group = { type: item.type, text: i18n("MonksActiveTiles.attack." + item.type), groups: {} };
                                        result.push(group);
                                    }
                                    group.groups[item.id] = item.name;
                                }
                            }

                            return result;
                        },
                        type: "list",
                        required: true
                    },
                    {
                        id: "rollattack",
                        name: 'MonksActiveTiles.ctrl.rollattack',
                        list: "attacktype",
                        type: "list",
                        defvalue: "true",
                        check: true,
                    },
                    {
                        id: "chatcard",
                        name: "MonksActiveTiles.ctrl.chatcard",
                        type: "checkbox",
                        defvalue: true,
                        conditional: (app) => {
                            if (game.system.id == "pf2e")
                                return false;

                            let type = $('select[name="data.rollattack"]', app.element).val();
                            return type != 'chatcard';
                        },
                    },
                    {
                        id: "rollmode",
                        name: 'MonksActiveTiles.ctrl.rollmode',
                        list: "rollmode",
                        type: "list",
                        conditional: (app) => {
                            let type = $('select[name="data.rollattack"]', app.element).val();
                            return type == 'true' || type == 'false';
                        },
                    },
                    {
                        id: "fastforward",
                        name: "MonksActiveTiles.ctrl.fastforward",
                        type: "checkbox",
                        defvalue: false,
                        help: "Roll without a prompt",
                        conditional: (app) => {
                            let type = $('select[name="data.rollattack"]', app.element).val();
                            return type == 'true' || type == 'false';
                        },
                    },
                    {
                        id: "rolldamage",
                        name: "MonksActiveTiles.ctrl.rolldamage",
                        type: "checkbox",
                        defvalue: false,
                        help: "Attempt to Roll damage if the attack exceeds the AC",
                        conditional: (app) => {
                            let type = $('select[name="data.rollattack"]', app.element).val();
                            return type == 'true';
                        },
                    }
                ],
                values: {
                    'rollmode': {
                        "roll": 'MonksActiveTiles.rollmode.public',
                        "gmroll": 'MonksActiveTiles.rollmode.private',
                        "blindroll": 'MonksActiveTiles.rollmode.blind',
                        "selfroll": 'MonksActiveTiles.rollmode.self'
                    },
                    'attacktype': {
                        "chatcard": 'MonksActiveTiles.attacktype.chatcard',
                        "true": 'MonksActiveTiles.attacktype.attack',
                        "false": 'MonksActiveTiles.attacktype.use',
                    }
                },
                fn: async (args = {}) => {
                    const { action, userId } = args;
                    let entities = await MonksActiveTiles.getEntities(args);
                    if (entities.length == 0)
                        return;

                    let user = game.user;// game.users.get(userId);
                    let rollresults = {};
                    let item;
                    let act;

                    //get the actor and the attack and the entities to apply this to.
                    if (action.data?.actor.id) {
                        let actor = await fromUuid(action.data?.actor.id);
                        if (actor && actor instanceof TokenDocument)
                            actor = actor.actor;
                        if (actor) {
                            let actorData = actor.toObject();
                            let itemActor = new CONFIG.Actor.documentClass(actorData);
                            //delete itemActor._id;
                            item = itemActor.items.get(action.data?.attack?.id);

                            if (item) {
                                let attack = action.data?.rollattack == "true" ? item.rollAttack || item.useAttack || item.rollWeapon : (action.data?.rollattack == "false" ? item.use : false);

                                if (game.system.id == "pf2e" && action.data?.rollattack) {
                                    act = actor.system.actions.find(a => a.item.id == item.id);
                                    if (act) {
                                        let strike = act.variants[0];
                                        if (strike) {
                                            attack = strike.roll;
                                        }
                                    }
                                }

                                if ((action.data?.chatcard && action.data?.rollattack != 'chatcard') || action.data?.rollattack == "chatcard") {
                                    if (item.displayCard)
                                        item.displayCard({ rollMode: (action.data?.rollmode || 'roll'), createMessage: true });
                                    else if (item.toChat && game.system.id != "pf2e")
                                        item.toChat();
                                }

                                if (attack) {
                                    user.targets.forEach(t => t.setTarget(false, { user, releaseOthers: true, groupSelection: false }));
                                    for (let entity of entities) {
                                        if (entity) {
                                            entity?.object?.setTarget(true, { user, releaseOthers: true });

                                            let roll = await attack.call(item, {
                                                rollMode: (action.data?.rollmode || 'roll'),
                                                flavor: `${item.name}, against ${entity.name}`,
                                                skipDialog: true,
                                                fastForward: action.data?.fastforward
                                            });
                                            entity?.object?.setTarget(false, { user, releaseOthers: false });

                                            rollresults[entity.id] = roll;
                                        }
                                    }
                                } else if (!attack) {
                                    user._onUpdateTokenTargets(entities.map(t => t.id));
                                }
                            } else
                                warn(`Could not find the attack item when using the attack action`);
                        } else
                            warn(`Could not find actor when using the attack action`);
                    }

                    let damage = item?.rollDamage || act?.damage;
                    if (action.data?.rollattack == "true" && action.data?.rolldamage && damage) {
                        user.targets.forEach(t => t.setTarget(false, { user, releaseOthers: true, groupSelection: false }));
                        for (let [k, v] of Object.entries(rollresults)) {
                            if (!v) continue;
                            let entity = entities.find(e => e.id == k);
                            if (entity && (v.total >= entity.actor.system.attributes.ac?.value || v.dice[0].total == 20)) {
                                entity?.object?.setTarget(true, { user, releaseOthers: true });
                                if (game.system.id == "pf2e") {
                                    if (act) {
                                        if (v.total >= entity.actor.system.attributes.ac?.value + 10 || v.dice[0].total == 20)
                                            await act.critical();
                                        else
                                            await act.damage();
                                    }
                                } else {
                                    damage.call(item, { critical: v.total == 20, options: { flavor: "Damage for " + entity.name } });
                                }
                            }
                        }
                    }

                    return { tokens: entities, entities: entities, attack: item, attacks: rollresults };
                },
                content: async (trigger, action) => {
                    if (!action.data?.actor.id)
                        return i18n(trigger.name);
                    let ctrl = trigger.ctrls.find(c => c.id == "entity");
                    let entityName = await MonksActiveTiles.entityName(action.data?.entity || ctrl?.defvalue || "previous");
                    let actor = await fromUuid(action.data?.actor.id);
                    if (actor && actor instanceof TokenDocument)
                        actor = actor.actor;
                    let item = actor?.items?.get(action.data?.attack?.id);
                    return `<span class="action-style">${i18n(trigger.name)}</span> <span class="entity-style">${entityName}</span> using <span class="details-style">"${actor?.name || 'Unknown Actor'}: ${item?.name || 'Unknown Item'}"</span>`;
                }
            },
            'trigger': {
                name: "MonksActiveTiles.action.trigger",
                ctrls: [
                    {
                        id: "entity",
                        name: "MonksActiveTiles.ctrl.select-tile",
                        type: "select",
                        subtype: "entity",
                        required: true,
                        options: { show: ['tile', 'previous', 'tagger'] },
                        restrict: (entity) => { return (entity instanceof foundry.canvas.placeables.Tile); },
                        defaultType: 'tiles',
                        placeholder: "Please select a Tile"
                    },
                    {
                        id: "token",
                        name: "MonksActiveTiles.ctrl.select-entity",
                        type: "select",
                        subtype: "entity",
                        options: { show: ['token', 'within', 'players', 'previous'] },
                        restrict: (entity) => { return (entity instanceof foundry.canvas.placeables.Token); }
                    },
                    {
                        id: "landing",
                        name: "MonksActiveTiles.ctrl.landing",
                        type: "text",
                        help: "go to this landing within the triggered tile"
                    },
                    {
                        id: "return",
                        name: "MonksActiveTiles.ctrl.returndata",
                        type: "checkbox",
                        defvalue: true,
                        help: "Add the data this Tile returns to the current data"
                    },
                    {
                        id: "allowdisabled",
                        name: "MonksActiveTiles.ctrl.allowdisabled",
                        type: "checkbox",
                        defvalue: false,
                        help: "Allow this tile to be triggered even if it's disabled"
                    }
                ],
                fn: async (args = {}) => {
                    const { tile, userId, action, method, value } = args;
                    let entities = await MonksActiveTiles.getEntities(args, 'tiles');
                    if (entities.length == 0)
                        return;

                    let tokens = await MonksActiveTiles.getEntities(args, "tokens", (action.data?.token || { id: "previous" }));

                    let promises = [];
                    for (let entity of entities) {
                        if (!(entity instanceof TileDocument))
                            continue;

                        if (foundry.utils.getProperty(entity, "flags.monks-active-tiles.active") === false && action.data?.allowdisabled !== true)
                            continue;

                        let landing = await getValue(action.data?.landing, args, entity);
                        /*
                        if (landing && landing.includes("{{")) {
                            let context = {
                                actor: tokens[0]?.actor?.toObject(false),
                                token: tokens[0]?.toObject(false),
                                tile: tile.toObject(false),
                                variable: foundry.utils.getProperty(tile, "flags.monks-active-tiles.variables") || {},
                                entity: entity,
                                user: game.users.get(userId),
                                value: value,
                                scene: canvas.scene,
                                method: method
                            };

                            const compiled = Handlebars.compile(landing);
                            landing = compiled(context, { allowProtoMethodsByDefault: true, allowProtoPropertiesByDefault: true }).trim();
                        }
                        */

                        let newargs = Object.assign({}, args, {
                            tokens: tokens,
                            tile: entity,
                            method: "trigger",
                            options: { landing: landing, originalMethod: method, allowdisabled: action.data?.allowdisabled }
                        });
                        promises.push(entity.trigger.call(entity, newargs));
                    }

                    return Promise.all(promises).then((results) => {
                        if (action.data.return === false)
                            return;

                        let value = {};
                        for (let result of results) {
                            foundry.utils.mergeObject(value, result.value);
                        }
                        return value;
                    });
                },
                content: async (trigger, action) => {
                    let ctrl = trigger.ctrls.find(c => c.id == "entity");
                    let entityName = await MonksActiveTiles.entityName(action.data?.entity || ctrl?.defvalue || "previous", 'tiles');
                    return `<span class="action-style">${i18n(trigger.name)}</span>, <span class="entity-style">${entityName}</span>`;
                }
            },
            'scene': {
                name: "MonksActiveTiles.action.scene",
                ctrls: [
                    {
                        id: "sceneid",
                        name: "MonksActiveTiles.ctrl.scene",
                        type: "select",
                        subtype: "entity",
                        required: true,
                        options: { show: ['scene', 'token', 'previous'] },
                        restrict: (entity) => { return (entity instanceof Scene); },
                        defaultType: 'scenes',
                        placeholder: "Please select a Scene"
                    },
                    {
                        id: "activate",
                        name: "MonksActiveTiles.ctrl.activate",
                        type: "checkbox",
                        defvalue: false,
                        check: true,
                    },
                    {
                        id: "for",
                        name: "MonksActiveTiles.ctrl.for",
                        list: "for",
                        type: "list",
                        subtype: "for",
                        defvalue: "trigger",
                        conditional: (app) => {
                            let checked = $('input[name="data.activate"]', app.element).prop('checked');
                            return !checked;
                        }
                    }
                ],
                values: {
                    'for': {
                        "everyone": "MonksActiveTiles.for.all",
                        "players": "MonksActiveTiles.for.players",
                        "gm": "MonksActiveTiles.for.gm",
                        "trigger": "MonksActiveTiles.for.triggering",
                        "token": "MonksActiveTiles.for.token",
                        "owner": "MonksActiveTiles.for.owner",
                        "previous": "MonksActiveTiles.for.current"
                    }
                },
                fn: async (args = {}) => {
                    const { action, userId, value } = args;
                    let entities = await MonksActiveTiles.getEntities(args, 'scenes', action.data.sceneid);

                    if (entities.length) {
                        let scene = entities[0];
                        let oldPing;
                        if (game.user.id == userId) {
                            oldPing = game.user.permissions["PING_CANVAS"];
                            game.user.permissions["PING_CANVAS"] = false;
                        }
                        let triggerFor = action.data.for || "trigger";
                        let showUsers = MonksActiveTiles.getForPlayers(triggerFor, args);

                        if (showUsers.includes(game.user.id)) {
                            if (action.data.activate && game.user.isGM && !scene.active) {
                                scene.activate();
                                showUsers = []; // Clear the show users because the activate will switch the view
                            } else
                                await scene.view();

                            showUsers = showUsers.filter(u => u != game.user.id);
                        }
                        if (showUsers.length) {
                            MonksActiveTiles.emit('switchview', { users: showUsers, sceneid: scene.id });
                        }

                        if (game.user.id == userId) {
                            window.setTimeout(() => {
                                if (oldPing == undefined)
                                    delete game.user.permissions["PING_CANVAS"];
                                else
                                    game.user.permissions["PING_CANVAS"] = oldPing;
                            }, 500);
                        }
                    }
                },
                content: async (trigger, action) => {
                    let ctrl = trigger.ctrls.find(c => c.id == "sceneid");
                    let entityName = await MonksActiveTiles.entityName(action.data?.sceneid || ctrl?.defvalue || "unknown", 'scenes');
                    return `<span class="action-style">${i18n(trigger.name)}</span> to <span class="entity-style">${entityName}</span> for <span class="value-style">&lt;${MonksActiveTiles.forPlayersName(action.data?.for || "trigger")}&gt;</span>${(action.data.activate ? ' <i class="fas fa-bullseye" title="Activate Scene"></i>' : '')}`
                }
            },
            'scenebackground': {
                name: "MonksActiveTiles.action.scenebackground",
                ctrls: [
                    {
                        id: "sceneid",
                        name: "MonksActiveTiles.ctrl.scene",
                        type: "select",
                        subtype: "entity",
                        required: true,
                        options: { show: ['previous'] },
                        restrict: (entity) => { return (entity instanceof Scene); },
                        defaultType: 'scenes',
                        defvalue: "scene",
                        placeholder: "Please select a Scene"                       
                    },
                    {
                        id: "img",
                        name: "MonksActiveTiles.ctrl.image",
                        type: "filepicker",
                        subtype: "imagevideo",
                        required: true
                    }
                ],
                fn: async (args = {}) => {
                    const { action, userId } = args;
                    let entities = await MonksActiveTiles.getEntities(args, 'scenes', action.data.sceneid);
                    for (let scene of entities) {
                        let img = await getValue(action.data?.img, args, scene);
                        await scene.update({ "background.src": img });
                    }
                },
                content: async (trigger, action) => {
                    let ctrl = trigger.ctrls.find(c => c.id == "sceneid");
                    let entityName = await MonksActiveTiles.entityName(action.data?.sceneid || ctrl?.defvalue || "previous", 'scenes');
                    return `<span class="action-style">${i18n(trigger.name)}</span> set <span class="entity-style">${entityName}</span> to <span class="value-style">&lt;${action.data.img}&gt;</span>`
                }
            },
            'addtocombat': {
                name: "MonksActiveTiles.action.addtocombat",
                ctrls: [
                    {
                        id: "entity",
                        name: "MonksActiveTiles.ctrl.select-entity",
                        type: "select",
                        subtype: "entity",
                        options: { show: ['token', 'within', 'players', 'previous', 'tagger'] },
                        restrict: (entity) => { return (entity instanceof foundry.canvas.placeables.Token); },
                        defaultType: 'tokens'
                    },
                    {
                        id: "addto",
                        name: "Add to Combat",
                        type: "list",
                        check: true,
                        list: 'add',
                        defvalue: 'add'
                    },
                    {
                        id: "start",
                        name: "MonksActiveTiles.ctrl.startcombat",
                        type: "checkbox",
                        conditional: (app) => { return $('select[name="data.addto"]', app.element).val() == "add" }
                    }
                ],
                values: {
                    'add': {
                        "add": 'MonksActiveTiles.add.add',
                        "remove": 'MonksActiveTiles.add.remove',
                    }
                },
                fn: async (args = {}) => {
                    const { action } = args;

                    let entities = await MonksActiveTiles.getEntities(args);
                    if (entities.length == 0)
                        return;

                    let combat = game.combats.viewed;
                    if (!combat) {
                        if (action.data.addto == "remove")
                            return;
                        const cls = getDocumentClass("Combat")
                        combat = await cls.create({ scene: canvas.scene.id, active: true });
                    }

                    let batch = new BatchManager();
                    if (action.data.addto == "remove") {
                        entities.filter(t => t instanceof TokenDocument && t.inCombat).forEach(t => {
                            let combatant = combat.getCombatantByToken(t.id);
                            batch.add("delete", combatant);
                        });
                    } else {
                        entities.filter(t => t instanceof TokenDocument && !t.inCombat).forEach(t => {
                            let data = { tokenId: t.id, actorId: t.actorId, hidden: t.hidden };
                            batch.add("create", Combatant, data, { parent: combat });
                        });
                    }
                    await batch.execute();

                    if (action.data.addto != "remove" && combat && action.data.start && !combat.started) {
                        await combat.rollAll();
                        combat.startCombat();
                    }

                    return { tokens: entities, entities: entities, combat: combat };
                },
                content: async (trigger, action) => {
                    let ctrl = trigger.ctrls.find(c => c.id == "entity");
                    let entityName = await MonksActiveTiles.entityName(action.data?.entity || ctrl?.defvalue || "previous");
                    return `${action.data.addto == "remove" ? "Remove" : "Add"} <span class="entity-style">${entityName}</span> ${action.data.addto == "remove" ? "from" : "to"} <span class="action-style">Combat</span>${(action.data.start ? ' <i class="fas fa-fist-raised" title="Start Combat"></i>' : '')}`;
                }
            },
            'elevation': {
                name: "MonksActiveTiles.action.elevation",
                batch: true,
                ctrls: [
                    {
                        id: "entity",
                        name: "MonksActiveTiles.ctrl.select-entity",
                        type: "select",
                        subtype: "entity",
                        options: { show: ['token', 'within', 'players', 'previous', 'tagger'] },
                        restrict: (entity) => { return (entity instanceof foundry.canvas.placeables.Token); }
                    },
                    {
                        id: "value",
                        name: "MonksActiveTiles.ctrl.value",
                        type: "text",
                        required: true,
                        help: "Use '+ value' to increase the value, or '- value' to decrease"
                    }
                ],
                fn: async (args = {}) => {
                    const { tile, tokens, action, userId, value, method, change } = args;
                    let entities = await MonksActiveTiles.getEntities(args);

                    if (entities && entities.length > 0) {
                        for (let entity of entities) {
                            if (!(entity instanceof TokenDocument))
                                continue;

                            let prop = foundry.utils.getProperty(entity, 'elevation');

                            if (prop == undefined) {
                                warn("Couldn't find attribute", entity);
                                continue;
                            }

                            let update = {};
                            let val = await getValue(action.data.value, args, entity, { prop, inline: false });

                            /*
                            let context = {
                                actor: tokens[0]?.actor?.toObject(false),
                                token: tokens[0]?.toObject(false),
                                tile: tile.toObject(false),
                                variable: foundry.utils.getProperty(tile, "flags.monks-active-tiles.variables") || {},
                                entity: entity,
                                user: game.users.get(userId),
                                value: value,
                                scene: canvas.scene,
                                method: method,
                                change: change
                            };
                            if (val.includes("{{")) {
                                const compiled = Handlebars.compile(val);
                                val = compiled(context, { allowProtoMethodsByDefault: true, allowProtoPropertiesByDefault: true }).trim();
                            }

                            if (typeof val == "string" && (val.startsWith('+ ') || val.startsWith('- '))) {
                                try {
                                    val = eval(prop + val);
                                } catch (err) {
                                    val = 0;
                                    debug(err);
                                }
                            }
                            if (typeof val == "string" && val.startsWith('=')) {
                                try {
                                    val = eval(val.substring(1));
                                } catch (err) {
                                    val = 0;
                                    debug(err);
                                }
                            }

                            val = parseFloat(val);
                            */
                            if (isNaN(val))
                                val = 0;

                            update.elevation = val;
                            MonksActiveTiles.batch.add("update", entity, update);
                        }

                        return { tokens: entities, entities: entities };
                    }
                },
                content: async (trigger, action) => {
                    let ctrl = trigger.ctrls.find(c => c.id == "entity");
                    let entityName = await MonksActiveTiles.entityName(action.data?.entity || ctrl?.defvalue || "previous");
                    let actionName = 'Set';
                    let midName = 'to';
                    let value = action.data?.value;
                    if (action.data?.value.startsWith('+ ') || action.data?.value.startsWith('- ')) {
                        actionName = (action.data?.value.startsWith('+ ') ? "Increase" : "Decrease");
                        midName = "by";
                        value = action.data?.value.substring(2);
                    }
                    return `<span class="action-style">${actionName} elevation</span> of <span class="entity-style">${entityName}</span> ${midName} <span class="details-style">${ActionManager.wrapQuotes(value)}</span>`;
                }
            },
            'resethistory': {
                name: "MonksActiveTiles.action.resethistory",
                ctrls: [
                    {
                        id: "entity",
                        name: "MonksActiveTiles.ctrl.select-entity",
                        type: "select",
                        subtype: "entity",
                        options: { show: ['tile', 'tagger'] },
                        restrict: (entity) => { return (entity instanceof foundry.canvas.placeables.Tile); },
                        defaultType: 'tiles'
                    },
                    {
                        id: "resettype",
                        name: "MonksActiveTiles.ctrl.resettype",
                        list: "resettype",
                        type: "list",
                        defvalue: "all",
                        check: true,
                    },
                    {
                        id: "token",
                        name: "MonksActiveTiles.ctrl.select-token",
                        type: "select",
                        subtype: "entity",
                        options: { show: ['token', 'within', 'players', 'previous', 'tagger'] },
                        restrict: (entity) => { return (entity instanceof foundry.canvas.placeables.Token); },
                        defvalue: null,
                        placeholder: "Please select a token",
                        conditional: (app) => { return $('select[name="data.resettype"]', app.element).val() == "token"; },
                    }
                ],
                values: {
                    'resettype': {
                        "all": 'MonksActiveTiles.resettype.everything',
                        "token": 'MonksActiveTiles.resettype.token',
                    }
                },
                fn: async (args = {}) => {
                    const { action } = args;
                    let entities = await MonksActiveTiles.getEntities(args, 'tiles');
                    let tokens = action.data?.token ? await MonksActiveTiles.getEntities(args, 'tokens', action.data?.token) : null;

                    let resettype = action.data?.resettype || "all";

                    if (entities && entities.length > 0) {
                        for (let entity of entities) {
                            if (entity instanceof TileDocument) {
                                if (resettype == "all") {
                                    await entity.resetHistory();
                                } else if (resettype == "token" && tokens && tokens.length > 0) {
                                    for (let token of tokens)
                                        await entity.resetHistory(token.id);
                                }
                            }
                        }
                    }
                },
                content: async (trigger, action) => {
                    let ctrl = trigger.ctrls.find(c => c.id == "entity");
                    let entityName = await MonksActiveTiles.entityName(action.data?.entity || ctrl?.defvalue || "previous", 'tiles');
                    let resettype = action.data?.resettype || "all";
                    let tokenName = i18n('MonksActiveTiles.resettype.everything');
                    if (resettype == "token") {
                        tokenName = await MonksActiveTiles.entityName(action.data?.token || "previous", 'tokens');
                    }
                    return `<span class="action-style">Reset Tile trigger history</span> for <span class="entity-style">${entityName}</span> clear <span class="details-style">${tokenName}</span>`;
                }
            },
            'preloadtileimage': {
                name: "MonksActiveTiles.action.preloadtileimage",
                requiresGM: true,
                ctrls: [
                    {
                        id: "entity",
                        name: "MonksActiveTiles.ctrl.select-entity",
                        type: "select",
                        subtype: "entity",
                        options: { show: ['tile', 'tagger'] },
                        restrict: (entity) => { return (entity instanceof foundry.canvas.placeables.Tile); },
                        defaultType: 'tiles'
                    },
                ],
                fn: async (args = {}) => {
                    const { action } = args;
                    let entities = await MonksActiveTiles.getEntities(args, 'tiles');
                    if (entities && entities.length > 0) {
                        for (let entity of entities) {
                            MonksActiveTiles.emit('preloadtileimages', { entityId: entity.uuid });

                            let t = entity._object;
                            if (!t) continue;

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
                        }
                    }
                },
                content: async (trigger, action) => {
                    let ctrl = trigger.ctrls.find(c => c.id == "entity");
                    let entityName = await MonksActiveTiles.entityName(action.data?.entity || ctrl?.defvalue || "previous", 'tiles');
                    return `<span class="action-style">${i18n(trigger.name)}</span> for <span class="entity-style">${entityName}</span>`;
                }
            },
            'tileimage': {
                name: "MonksActiveTiles.action.tileimage",
                requiresGM: true,
                ctrls: [
                    {
                        id: "entity",
                        name: "MonksActiveTiles.ctrl.select-entity",
                        type: "select",
                        subtype: "entity",
                        options: { show: ['tile', 'tagger'] },
                        restrict: (entity) => { return (entity instanceof foundry.canvas.placeables.Tile); },
                        defaultType: 'tiles'
                    },
                    {
                        id: "select",
                        name: "MonksActiveTiles.ctrl.select",
                        type: "text",
                        defvalue: 'next',
                        help: "you can also use <i>first</i>, <i>last</i>, <i>next</i>, <i>previous</i>, or <i>random</i> to select a spot"
                    },
                    {
                        id: "transition",
                        name: "MonksActiveTiles.ctrl.transition",
                        type: "list",
                        list: "transition",
                        defvalue: "none",
                        check: true,
                    },
                    {
                        id: "speed",
                        name: "MonksActiveTiles.ctrl.duration",
                        type: "number",
                        defvalue: 1,
                        step: "0.05",
                        conditional: (app) => { return $('select[name="data.transition"]', app.element).val() != "none"; }
                    },
                    {
                        id: "loop",
                        name: "MonksActiveTiles.ctrl.loops",
                        type: "number",
                        defvalue: 1,
                        step: 1,
                        conditional: (app) => { return $('select[name="data.transition"]', app.element).val() != "none"; }
                    },
                ],
                values: {
                    'transition': {
                        "none": 'MonksActiveTiles.transition.none',
                        "fade": 'MonksActiveTiles.transition.fade',
                        "blur": 'MonksActiveTiles.transition.blur',
                        "slide-left": 'MonksActiveTiles.transition.slide-left',
                        "slide-up": 'MonksActiveTiles.transition.slide-up',
                        "slide-right": 'MonksActiveTiles.transition.slide-right',
                        "slide-down": 'MonksActiveTiles.transition.slide-down',
                        "slide-random": 'MonksActiveTiles.transition.slide-random',
                        "bump-left": 'MonksActiveTiles.transition.bump-left',
                        "bump-up": 'MonksActiveTiles.transition.bump-up',
                        "bump-right": 'MonksActiveTiles.transition.bump-right',
                        "bump-down": 'MonksActiveTiles.transition.bump-down',
                        "bump-random": 'MonksActiveTiles.transition.bump-random'
                    }
                },
                fn: async (args = {}) => {
                    const { tile, tokens, action, userId, value, method, change } = args;
                    let entities = await MonksActiveTiles.getEntities(args, 'tiles');

                    let getPosition = async function (entity) {
                        let fileindex = foundry.utils.getProperty(entity, 'flags.monks-active-tiles.fileindex') || 0;
                        let position = await getValue(action.data?.select ?? "next", args, entity, {
                            fileindex: fileindex,
                            files: entity._images
                        });

                        if (position == "first")
                            position = 1;
                        else if (position == "last")
                            position = entity._images.length;
                        else if (position == "random")
                            position = Math.floor(Math.random() * entity._images.length) + 1;
                        else if (position == "next")
                            position = ((fileindex + 1) % entity._images.length) + 1;
                        else if (position == "previous")
                            position = (fileindex == 0 ? entity._images.length : fileindex);
                        else if (typeof position == "string") {
                            let positions = ("" + position).split(',').map(d => d.trim());
                            let pos = positions[Math.floor(Math.random() * positions.length)];

                            if (pos.indexOf('-') != -1) {
                                let parts = pos.split('-');
                                let lower = parseInt(parts[0]);
                                let upper = parseInt(parts[1]);
                                position = Math.floor((Math.random() * (upper - lower)) + lower);
                            } else {
                                let roll = await rollDice(pos);
                                position = parseInt(roll.value);
                            }
                        } else
                            position = parseInt(position);

                        position = Math.clamp(position, 1, entity._images.length);

                        return position;
                    }

                    let getTransition = function () {
                        let transition = action.data.transition;
                        if (transition.endsWith("random")) {
                            let options = ["left", "right", "up", "down"];
                            transition = transition.replace('random', options[Math.floor(Math.random() * 4)]);
                        }

                        return transition;
                    }

                    let promises = [];
                    if (entities && entities.length > 0) {
                        for (let entity of entities) {
                            let animationName = `MonksActiveTiles.${entity.documentName}.${entity.id}.animateTransitionImage`;
                            let entityObject = entity._object;
                            if (entityObject?._transition || foundry.canvas.animation.CanvasAnimation.getAnimation(animationName)) {
                                log("Old transition hasn't finished", entity._object._transition_to, entity._object._transition, foundry.canvas.animation.CanvasAnimation.getAnimation(animationName));
                                if (entityObject && entityObject._transition_time < new Date().getTime()) {
                                    log("Old transition past due", entity._object._transition_to);
                                    await entity.update({ texture: { src: entity._object._transition_to } });
                                    if (foundry.canvas.animation.CanvasAnimation.getAnimation(animationName)) {
                                        await foundry.canvas.animation.CanvasAnimation.terminateAnimation(animationName);
                                        continue;
                                    }
                                } else if (!entity._object._transition) {
                                    log("Animation with no transition");
                                    foundry.canvas.animation.CanvasAnimation.terminateAnimation(animationName);
                                    continue;
                                } else
                                    continue;   // Don't add another transition if there's already a transition happening.
                            }

                            if (entity._images == undefined) {
                                entity._images = await MonksActiveTiles.getTileFiles(foundry.utils.getProperty(entity, "flags.monks-active-tiles.files") || []);
                            }

                            let position = await getPosition(entity);

                            if (action.data.transition == "none") {
                                if (entity._images[position - 1]) {
                                    await entity.update({ texture: { src: entity._images[position - 1] }, 'flags.monks-active-tiles.fileindex': position - 1 });
                                    //await entity.setFlag('monks-active-tiles', 'fileindex', position - 1);
                                }
                            } else {
                                /*
                                let loop = action.data.loop || 1;

                                let time = new Date().getTime() + (action.data?.speed * 1000);
                                let transData = {
                                    id: action.id,
                                    tileid: tile.uuid,
                                    entityid: entity.uuid,
                                    from: entity.texture.src,
                                    transition: getTransition(),
                                    img: entity._images[position - 1],
                                    time: time,
                                    position: position - 1
                                }

                                if (entity._transitionPromise && entity._transitionPromise instanceof Promise) {
                                    entity._transitionPromise.then((promise) => {
                                        entity._transitionPromise = MonksActiveTiles.transitionImage(entity, transData.from, transData.img, transData.transition, transData.time);
                                        return entity._transitionPromise;
                                    });
                                } else
                                    entity._transitionPromise = MonksActiveTiles.transitionImage(entity, transData.from, transData.img, transData.transition, transData.time);

                                for (let i = 1; i < loop; i++) {
                                    entity.flags["monks-active-tiles"].fileindex = transData.position;
                                    let position = await getPosition();
                                    transData.position = position - 1;
                                    transData.transition = getTransition();
                                    transData.from = transData.img;
                                    transData.img = entity._images[transData.position];
                                    transData.time = new Date().getTime() + (action.data?.speed * 1000);

                                    entity._transitionPromise.then(() => {
                                        entity._transitionPromise = MonksActiveTiles.transitionImage(entity, transData.from, transData.img, transData.transition, transData.time);
                                    })
                                }

                                entity._transitionPromise.then(() => {
                                    entity._transitionPromise = entity.update({ texture: { src: transData.img }, 'flags.monks-active-tiles.fileindex': transData.position });
                                });
                                */
                                let loop = action.data.loop || 1;

                                let time = new Date().getTime() + (action.data?.speed * 1000);
                                let transData = {
                                    id: action.id,
                                    tileid: tile.uuid,
                                    entityid: entity.uuid,
                                    from: entity.texture.src,
                                    transition: getTransition(),
                                    transitionId: foundry.utils.randomID(),
                                    img: entity._images[position - 1],
                                    time: time,
                                    position: position - 1
                                }

                                const doTransition = (data) => {
                                    if (data.img) {
                                        MonksActiveTiles.emit("transition", data);
                                        return MonksActiveTiles.transitionImage(entity, data.transitionId, data.from, data.img, data.transition, data.time);
                                    }
                                }

                                const doNextPromise = async (data) => {
                                    let result = doTransition(data);
                                    if (result instanceof Promise) {
                                        return result.then((value) => { runAction(data, value) });
                                    } else {
                                        return runAction(data, result);
                                    }
                                }

                                const runAction = async (data, result) => {
                                    loop--;
                                    if (loop > 0) {
                                        entity.flags["monks-active-tiles"].fileindex = data.position;
                                        let position = await getPosition(entity);
                                        data.position = position - 1;
                                        data.transition = getTransition();
                                        data.from = data.img;
                                        data.img = entity._images[data.position];
                                        data.time = new Date().getTime() + (action.data?.speed * 1000);

                                        foundry.utils.setProperty(entity, 'flags.monks-active-tiles.fileindex', data.position);

                                        return doNextPromise(data);
                                    } else {
                                        //log("Updating image", data.img, result, entity._object._transition_to);
                                        await entity.update({ texture: { src: result }, 'flags.monks-active-tiles.fileindex': data.position });
                                    }
                                }

                                if (loop > 0) {
                                    promises.push(doNextPromise(transData));
                                }
                            }
                        }

                        return Promise.all(promises).then(async () => {
                            return { entities: entities };
                        });
                    }
                },
                content: async (trigger, action) => {
                    let ctrl = trigger.ctrls.find(c => c.id == "entity");
                    let entityName = await MonksActiveTiles.entityName(action.data?.entity || ctrl?.defvalue || "previous", 'tiles');
                    return `<span class="action-style">${i18n(trigger.name)}</span> to <span class="value-style">&lt;${action.data.select || 'next'}&gt;</span> for <span class="entity-style">${entityName}</span> ${action.data?.transition != "none" ? `<span class="details-style">"${i18n("MonksActiveTiles.transition." + action.data?.transition)}"</span>` : ''}`;
                }
            },
            'delete': {
                name: "MonksActiveTiles.action.delete",
                ctrls: [
                    {
                        id: "entity",
                        name: "MonksActiveTiles.ctrl.select-entity",
                        type: "select",
                        subtype: "entity",
                        required: true,
                        options: { show: ['tile', 'token', 'within', 'players', 'previous', 'tagger'] },
                        restrict: (entity) => {
                            return (
                                entity instanceof foundry.canvas.placeables.Token ||
                                entity instanceof foundry.canvas.placeables.Tile ||
                                entity instanceof foundry.canvas.placeables.Wall ||
                                entity instanceof foundry.canvas.placeables.Drawing ||
                                entity instanceof foundry.canvas.placeables.Note ||
                                entity instanceof foundry.canvas.placeables.AmbientLight ||
                                entity instanceof foundry.canvas.placeables.AmbientSound ||
                                entity instanceof foundry.canvas.placeables.MeasuredTemplate ||
                                entity.constructor.name == "Terrain");
                        },
                        check: true,
                        defaultType: 'tiles',
                        placeholder: 'Please select an entity',
                        help: 'You may delete Tokens, Tiles, Walls, Drawings, Notes, Lights, Sounds or Terrain'
                    },
                    {
                        id: "collection",
                        name: "Collection",
                        list: "collection",
                        type: "list",
                        onChange: (app, ctrl, action, data) => {
                            let displayName = game.i18n.format("MonksActiveTiles.CurrentCollection", { collection: $(ctrl).val() || "tiles" });
                            $('input[name="data.entity"]', app.element).next().html(displayName);
                        },
                        conditional: (app) => {
                            let entity = $('input[name="data.entity"]', app.element).data("value") || {};
                            return entity?.id == 'previous';
                        },
                        defvalue: 'tiles'
                    }
                ],
                values: {
                    'collection': {
                        'notes': "Notes",
                        'drawings': "Drawings",
                        'terrain': "Terrain",
                        'tiles': "Tiles",
                        'tokens': "Tokens",
                        'walls': "Walls",
                        'lighting': "Lights",
                        'sounds': "Sounds",
                    }
                },
                fn: async (args = {}) => {
                    let { action } = args;
                    let entities = await MonksActiveTiles.getEntities(args, action.data?.collection || "tiles");

                    let batch = new BatchManager();
                    for (let entity of entities) {
                        if (!entity)
                            continue;

                        if (!entity.locked) {
                            batch.add("delete", entity);
                        }
                    }

                    await batch.execute();
                },
                content: async (trigger, action) => {
                    let ctrl = trigger.ctrls.find(c => c.id == "entity");
                    let entityName = await MonksActiveTiles.entityName(action.data?.entity || ctrl?.defvalue || "previous", action.data?.collection || ctrl?.defaultType || "tiles");
                    return `<span class="action-style">${i18n(trigger.name)}</span> <span class="entity-style">${entityName}</span>`;
                }
            },
            'target': {
                name: "MonksActiveTiles.action.target",
                ctrls: [
                    {
                        id: "target",
                        name: "Select Targets",
                        type: "list",
                        check: true,
                        list: 'target',
                        defvalue: 'target'
                    },
                    {
                        id: "entity",
                        name: "MonksActiveTiles.ctrl.select-entity",
                        type: "select",
                        subtype: "entity",
                        options: { show: ['token', 'within', 'players', 'previous', 'tagger'] },
                        restrict: (entity) => {
                            return entity instanceof foundry.canvas.placeables.Token;
                        },
                        conditional: (app) => { return $('select[name="data.target"]', app.element).val() !== "clear" },
                        defaultType: 'tokens'
                    },
                    {
                        id: "for",
                        name: "MonksActiveTiles.ctrl.for",
                        list: "for",
                        type: "list",
                        subtype: "for",
                        defvalue: "token"
                    },
                ],
                values: {
                    'target': {
                        "add": 'MonksActiveTiles.target.appendtarget',
                        "target": 'MonksActiveTiles.target.overwritetarget',
                        "remove": 'MonksActiveTiles.target.removetarget',
                        "clear": 'MonksActiveTiles.target.clear',
                    },
                    'for': {
                        "everyone": "MonksActiveTiles.for.all",
                        "players": "MonksActiveTiles.for.players",
                        "gm": "MonksActiveTiles.for.gm",
                        "trigger": "MonksActiveTiles.for.triggering",
                        "token": "MonksActiveTiles.for.token",
                        "owner": "MonksActiveTiles.for.owner",
                        "previous": "MonksActiveTiles.for.current"
                    }
                },
                fn: async (args = {}) => {
                    const { action, userId } = args
                    let entities = await MonksActiveTiles.getEntities(args, 'tokens');

                    let showfor = action.data.for ?? "token";
                    let showUsers = MonksActiveTiles.getForPlayers(showfor, args);

                    if (showUsers.includes(game.user.id)) {
                        if (action.data.target == "clear") {
                            game.user.targets.forEach(t => t.setTarget(false, { user: game.user, releaseOthers: true, groupSelection: false }));
                        } else if (action.data.target == "remove") {
                            game.user.targets.forEach(t => { if (entities.find(e => e.id == t.id) != undefined) { t.setTarget(false, { user: game.user, releaseOthers: false, groupSelection: false }); } });
                        } else if (action.data.target == "target") {
                            game.user._onUpdateTokenTargets(entities.map(t => t.id));
                        } else {
                            entities.forEach(t => t._object?.setTarget(true, { user: game.user, releaseOthers: false, groupSelection: false }));
                        }
                        showUsers = showUsers.filter(u => u != game.user.id);
                    }

                    if (showUsers.length) {
                        MonksActiveTiles.emit("target", { target: action.data.target, users: showUsers, tokens: entities.map(t => t.id) });
                    }
                },
                content: async (trigger, action) => {
                    if (action.data.target == "clear")
                        return `<span class="action-style">${i18n("MonksActiveTiles.target.clear")}</span>`;
                    else {
                        let ctrl = trigger.ctrls.find(c => c.id == "entity");
                        let entityName = await MonksActiveTiles.entityName(action.data?.entity || ctrl?.defvalue || "previous", 'tokens');
                        return `<span class="action-style">${i18n(trigger.name)}</span> <span class="details-style">"${i18n(trigger.values.target[action.data.target])}"</span> <span class="entity-style">${entityName}</span>, for <span class="value-style">&lt;${MonksActiveTiles.forPlayersName(action.data?.for || "token")}&gt;</span>`;
                    }
                }
            },
            'scenelighting': {
                name: "MonksActiveTiles.action.scenelighting",
                ctrls: [
                    {
                        id: "darkness",
                        name: "MonksActiveTiles.ctrl.darkness",
                        type: "slider",
                        defvalue: 1,
                        step: "0.05"
                    },
                    {
                        id: "speed",
                        name: "MonksActiveTiles.ctrl.speed",
                        type: "number",
                        defvalue: 10
                    },
                ],
                fn: async (args = {}) => {
                    let { tile, action } = args;
                    tile.parent.update({ darkness: action.data.darkness }, { animateDarkness: (action.data.speed * 1000) });
                },
                content: async (trigger, action) => {
                    return `<span class="action-style">Change ${i18n(trigger.name)}</span> set darkness to <span class="details-style">"${action.data.darkness}"</span> after <span class="value-style">&lt;${action.data.speed} seconds&gt;</span>`;
                }
            },
            'globalvolume': {
                name: "MonksActiveTiles.action.globalvolume",
                ctrls: [
                    {
                        id: "volumetype",
                        name: "MonksActiveTiles.ctrl.volumetype",
                        type: "list",
                        defvalue: "globalAmbientVolume",
                        list: () => {
                            let result = {
                                "globalPlaylistVolume": 'MonksActiveTiles.volumetype.globalPlaylistVolume',
                                "globalAmbientVolume": 'MonksActiveTiles.volumetype.globalAmbientVolume',
                                "globalInterfaceVolume": 'MonksActiveTiles.volumetype.globalInterfaceVolume',
                            };
                            if (game.modules.get("monks-sound-enhancements")?.active)
                                result.globalSoundEffectVolume = 'MonksActiveTiles.volumetype.globalSoundEffectVolume';
                            return result;
                        }
                    },
                    {
                        id: "volume",
                        name: "MonksActiveTiles.ctrl.volume",
                        type: "slider",
                        defvalue: "1.0",
                        step: "0.05"
                    },
                    {
                        id: "for",
                        name: "MonksActiveTiles.ctrl.for",
                        list: "for",
                        type: "list",
                        subtype: "for",
                        defvalue: "trigger"
                    },
                ],
                values: {
                    'for': {
                        "everyone": "MonksActiveTiles.for.all",
                        "players": "MonksActiveTiles.for.players",
                        "gm": "MonksActiveTiles.for.gm",
                        "trigger": "MonksActiveTiles.for.triggering",
                        "token": "MonksActiveTiles.for.token",
                        "owner": "MonksActiveTiles.for.owner",
                        "previous": "MonksActiveTiles.for.current"
                    }
                },
                fn: async (args = {}) => {
                    let { action } = args;

                    let showfor = action.data.for ?? "trigger";
                    let showUsers = MonksActiveTiles.getForPlayers(showfor, args);

                    if (showUsers.includes(game.user.id)) {
                        $(`#global-volume input[name="${action.data.volumetype}"]`).val(action.data.volume).change();
                        showUsers = showUsers.filter(u => u != game.user.id);
                    }
                    if (showUsers.length) {
                        MonksActiveTiles.emit("globalvolume", { users: showUsers, volumetype: action.data.volumetype, volume: action.data.volume });
                    }
                },
                content: async (trigger, action) => {

                    return `<span class="action-style">Change ${i18n(trigger.name)}</span> set <span class="details-style">"${i18n(`MonksActiveTiles.volumetype.${action.data.volumetype}`)}"</span> to <span class="value-style">&lt;${action.data.volume}&gt;</span>`;
                }
            },
            'gametime': {
                name: "MonksActiveTiles.action.gametime",
                ctrls: [
                    {
                        id: "time",
                        name: "MonksActiveTiles.ctrl.time",
                        type: "text",
                        required: true
                    },
                ],
                fn: async (args = {}) => {
                    let { action } = args;

                    let time = action.data.time;
                    // strip off a leading + or - sign
                    let relative = false;
                    if (action.data.time.startsWith('+') || action.data.time.startsWith('-')) {
                        relative = action.data.time.substring(0, 1);
                        time = action.data.time.substring(1).trim();
                    }

                    time = await getValue(time, args, null, { prop: game.time.worldTime });
                    time = time + "";

                    // convert string time to seconds
                    let seconds = 0;
                    if (time.includes(':')) {
                        let parts = time.split(':');
                        seconds = parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + (parts.length > 2 ? parseInt(parts[2]) : 0);
                    } else {
                        seconds = parseInt(time) * 60;
                    }

                    if (seconds && !isNaN(seconds)) {
                        if (!relative) {
                            // get the world time, and set the time part to the new time
                            let worldTime = MonksActiveTiles.getWorldTime();
                            // get the difference between the new time and the current time
                            let diff = seconds - (worldTime * 60);
                            // advance the game time to the difference
                            game.time.advance(diff);
                        } else {
                            // relative time
                            game.time.advance(seconds * (relative == "-" ? -1 : 1));
                        }
                    }
                },
                content: async (trigger, action) => {
                    return `<span class="action-style">${i18n(trigger.name)}</span> <span class="value-style">${action.data.time}</span>`;
                }
            },
            'dialog': {
                name: "MonksActiveTiles.action.dialog",
                ctrls: [
                    {
                        id: "dialogtype",
                        name: "MonksActiveTiles.ctrl.dialogtype",
                        type: "list",
                        defvalue: "confirm",
                        list: "dialogtype",
                        check: true,
                    },
                    {
                        id: "id",
                        name: "MonksActiveTiles.ctrl.id",
                        type: "text",
                    },
                    {
                        id: "title",
                        name: "MonksActiveTiles.ctrl.title",
                        type: "text",
                    },
                    {
                        id: "showto",
                        name: "MonksActiveTiles.ctrl.for",
                        list: "showto",
                        type: "list",
                        subtype: "for",
                        defvalue: "trigger"
                    },
                    {
                        id: "closeNo",
                        name: "MonksActiveTiles.ctrl.close-means-no",
                        type: "checkbox",
                        defvalue: true,
                        conditional: (app) => {
                            return $('select[name="data.dialogtype"]', app.element).val() == 'confirm';
                        },
                    },
                    { type: "line", help: "Provide either text or an html file"},
                    {
                        id: "content",
                        name: "MonksActiveTiles.ctrl.content",
                        type: "text",
                        subtype: "multiline",
                        help: '<span style="color: #FF0000;">Content will be ignored if a file is requested</span>',
                        check: true,
                        conditionalHelp: (app) => {
                            let filename = $('[name="data.file"] > input[type="text"]', app.element).val();
                            let content = $('[name="data.content"]', app.element).val();
                            return !!filename && !!content;
                        }
                    },
                    {
                        id: "file",
                        name: "MonksActiveTiles.ctrl.htmlfile",
                        type: "filepicker",
                        subtype: "html",
                        check: true,
                    },
                    { type: "line" },
                    {
                        id: "options",
                        name: "MonksActiveTiles.ctrl.options",
                        type: "text",
                        conditional: (app) => {
                            return $('select[name="data.dialogtype"]', app.element).val() == 'custom';
                        },
                    },
                    {
                        id: "width",
                        name: "MonksActiveTiles.ctrl.width",
                        type: "text",
                        conditional: (app) => {
                            return $('select[name="data.dialogtype"]', app.element).val() == 'custom';
                        },
                    },
                    {
                        id: "height",
                        name: "MonksActiveTiles.ctrl.height",
                        type: "text",
                        conditional: (app) => {
                            return $('select[name="data.dialogtype"]', app.element).val() == 'custom';
                        },
                    },
                    {
                        id: "buttons",
                        name: "MonksActiveTiles.ctrl.buttons",
                        type: "buttonlist",
                        conditional: (app) => {
                            return $('select[name="data.dialogtype"]', app.element).val() == 'custom';
                        },
                    },
                    {
                        id: "yes",
                        name: "MonksActiveTiles.ctrl.onyes",
                        type: "text",
                        conditional: (app) => {
                            return $('select[name="data.dialogtype"]', app.element).val() == 'confirm';
                        },
                        placeholder: "Enter the name of the Landing to jump to"
                    },
                    {
                        id: "no",
                        name: "MonksActiveTiles.ctrl.onno",
                        type: "text",
                        conditional: (app) => {
                            return $('select[name="data.dialogtype"]', app.element).val() == 'confirm';
                        },
                        placeholder: "Enter the name of the Landing to jump to"
                    },
                ],
                values: {
                    'dialogtype': {
                        "confirm": 'MonksActiveTiles.dialogtype.confirm',
                        "alert": 'MonksActiveTiles.dialogtype.alert',
                        "custom": 'MonksActiveTiles.dialogtype.custom'
                    },
                    'showto': {
                        "everyone": "MonksActiveTiles.for.all",
                        "players": "MonksActiveTiles.for.players",
                        "gm": "MonksActiveTiles.for.gm",
                        "trigger": "MonksActiveTiles.for.triggering",
                        "token": "MonksActiveTiles.for.token",
                        "owner": "MonksActiveTiles.for.owner",
                        "previous": "MonksActiveTiles.for.current"
                    }
                },
                fn: async (args = {}) => {
                    let { action, tile, _id, value, tokens, userId, change, method } = args;

                    let id = action.data.id ?? _id;
                    let title = action.data.title;
                    let content = action.data.content;

                    if (action.data.file) {
                        let context = {
                            actor: tokens[0]?.actor?.toObject(),
                            token: tokens[0]?.toObject(),
                            tile: tile,
                            variable: foundry.utils.getProperty(tile, "flags.monks-active-tiles.variables") || {},
                            user: game.users.get(userId),
                            players: game.users,
                            value: value,
                            scene: canvas.scene,
                            method: method,
                            change: change
                        };
                        if (!Handlebars.partials.hasOwnProperty(action.data.file) && action.data.file?.startsWith("http")) {
                            let html = await fetch(action.data.file);
                            let text = await html.text();
                            const compiled = Handlebars.compile(text);
                            Handlebars.registerPartial(action.data.file, compiled);
                            Handlebars.partials[action.data.file] = compiled;
                            content = compiled(context, {
                                allowProtoMethodsByDefault: true,
                                allowProtoPropertiesByDefault: true
                            });
                        } else
                            content = await foundry.applications.handlebars.renderTemplate(action.data.file, context);
                    }

                    let options = JSON.parse(action.data?.options || "{}");
                    if (action.data?.width)
                        options.width = action.data?.width != "auto" ? await getValue(action.data?.width, args, null, {type: "number"}) : action.data?.width;
                    if (action.data?.height)
                        options.height = action.data?.height != "auto" ? await getValue(action.data?.height, args, null, { type: "number" }) : action.data?.height;

                    let showto = action.data.showto ?? ActionManager.getDefaultValue("dialog", "showto", "trigger");
                    let showUsers = MonksActiveTiles.getForPlayers(showto, args);

                    if (showUsers.includes(game.user.id)) {
                        MonksActiveTiles._showDialog({
                            tile,
                            token: tokens[0],
                            value,
                            type: action.data.dialogtype,
                            id,
                            title,
                            content,
                            options,
                            yes: action.data.yes,
                            no: action.data.no,
                            closeNo: action.data.closeNo ?? true,
                            buttons: action.data.buttons
                        }
                        ).then((results) => { tile.resumeActions(_id, results); });
                        showUsers = showUsers.filter(u => u != game.user.id);
                    }
                    if (showUsers.length) {
                        MonksActiveTiles.emit("showdialog", {
                            _id,
                            users: showUsers,
                            tileid: tile.uuid,
                            tokenid: tokens[0]?.uuid,
                            value,
                            type: action.data.dialogtype,
                            id,
                            title,
                            content,
                            options: options,
                            yes: action.data.yes,
                            no: action.data.no,
                            closeNo: action.data.closeNo ?? true,
                            buttons: action.data.buttons
                        });
                    }

                    return { pause: true };
                },
                content: async (trigger, action) => {
                    let msg = encodeURI(action.data.content.length <= 15 ? action.data.content : action.data.content.substr(0, 15) + "...") || action.data.file;
                    return `<span class="action-style">${i18n(trigger.name)}</span>, for <span class="value-style">&lt;${MonksActiveTiles.forPlayersName(action.data?.showto || "trigger")}&gt;</span> <span class="details-style">"${i18n(trigger.values.dialogtype[action.data.dialogtype])}"</span> "${msg}"`;
                }
            },
            'closedialog': {
                name: "MonksActiveTiles.action.closedialog",
                ctrls: [
                    {
                        id: "id",
                        name: "MonksActiveTiles.ctrl.id",
                        type: "text",
                    },
                    {
                        id: "for",
                        name: "MonksActiveTiles.ctrl.for",
                        list: "for",
                        type: "list",
                        subtype: "for",
                        defvalue: "token",
                    },
                    {
                        id: "trigger",
                        name: "MonksActiveTiles.ctrl.trigger",
                        list: "trigger",
                        type: "list",
                        defvalue: "none"
                    },
                ],
                values: {
                    'trigger': {
                        "none": 'None',
                        "yes": 'Yes',
                        "no": 'No'
                    },
                    'for': {
                        "everyone": "MonksActiveTiles.for.all",
                        "players": "MonksActiveTiles.for.players",
                        "gm": "MonksActiveTiles.for.gm",
                        "trigger": "MonksActiveTiles.for.triggering",
                        "token": "MonksActiveTiles.for.token",
                        "owner": "MonksActiveTiles.for.owner",
                        "previous": "MonksActiveTiles.for.current"
                    }
                },
                fn: async (args = {}) => {
                    let { action, tile, _id, value, tokens, userId, change, method } = args;

                    let id = await getValue(action.data.id, args);

                    let showto = action.data.for ?? "token";
                    let showUsers = MonksActiveTiles.getForPlayers(showto, args);

                    let dialog = MonksActiveTiles._dialogs[id];
                    if (dialog && showUsers.includes(game.user.id)) {
                        if (action.data.trigger == "yes" || action.data.trigger == "no")
                            $(`.dialog-buttons .dialog-button.${action.data.trigger}`, dialog.element).click();
                        else
                            dialog.close();
                        showUsers = showUsers.filter(u => u != game.user.id);
                    }

                    if (showUsers.length)
                        MonksActiveTiles.emit("closedialog", { id, trigger: action.data.trigger, users: showUsers });
                },
                content: async (trigger, action) => {
                    return `<span class="action-style">${i18n(trigger.name)}</span> <span class="details-style">"${action.data.id}"</span> for <span class="value-style">&lt;${MonksActiveTiles.forPlayersName(action.data?.for || "token")}&gt;</span>`;
                }
            },
            'scrollingtext': {
                name: "MonksActiveTiles.action.scrollingtext",
                ctrls: [
                    {
                        id: "text",
                        name: "MonksActiveTiles.ctrl.text",
                        type: "text",
                        required: true
                    },
                    {
                        id: "entity",
                        name: "MonksActiveTiles.ctrl.select-entity",
                        type: "select",
                        subtype: "entity",
                        options: { show: ['token', 'tile', 'within', 'players', 'previous', 'tagger'] }
                    },
                    {
                        id: "for",
                        name: "MonksActiveTiles.ctrl.for",
                        list: "for",
                        type: "list",
                        subtype: "for",
                        defvalue: "trigger"
                    },
                    {
                        id: "duration",
                        name: "MonksActiveTiles.ctrl.duration",
                        type: "number",
                        min: 0.1,
                        step: 0.1,
                        defvalue: 5
                    },
                    {
                        id: "anchor",
                        name: "MonksActiveTiles.ctrl.anchor",
                        list: "anchor",
                        type: "list",
                        defvalue: 0
                    },
                    {
                        id: "direction",
                        name: "MonksActiveTiles.ctrl.direction",
                        list: "anchor",
                        type: "list",
                        defvalue: 2
                    },
                ],
                values: {
                    'for': {
                        "everyone": "MonksActiveTiles.for.all",
                        "players": "MonksActiveTiles.for.players",
                        "gm": "MonksActiveTiles.for.gm",
                        "trigger": "MonksActiveTiles.for.triggering",
                        "token": "MonksActiveTiles.for.token",
                        "owner": "MonksActiveTiles.for.owner",
                        "previous": "MonksActiveTiles.for.current"
                    },
                    'anchor': {
                        0: "Center",
                        1: "Bottom",
                        2: "Top",
                        3: "Left",
                        4: "Right"
                    }
                },
                fn: async (args = {}) => {
                    const { tile, action, userId, value, method, change } = args;

                    let entities = await MonksActiveTiles.getEntities(args);

                    console.log("Entities", entities);

                    for (let entity of entities) {
                        if (!entity)
                            continue;

                        //Add a chat message
                        let user = game.users.find(u => u.id == userId);
                        let scene = game.scenes.find(s => s.id == user?.viewedScene);

                        let token = entity?.object;

                        let content = await getValue(action.data.text, args, entity, { actor: token?.actor, token, scene });

                        let showfor = action.data.for || "trigger";
                        let showUsers = MonksActiveTiles.getForPlayers(showfor, args);

                        if (showUsers.includes(game.user.id)) {
                            canvas.interface.createScrollingText(token.center, content, {
                                anchor: parseInt(action.data.anchor),
                                direction: parseInt(action.data.direction),
                                duration: action.data.duration * 1000,
                                distance: token.h,
                                fontSize: 28,
                                stroke: 0x000000,
                                strokeThickness: 4,
                                jitter: 0.25
                            });
                            showUsers = showUsers.filter(u => u != game.user.id);
                        }

                        if (showUsers.length) {
                             MonksActiveTiles.emit("scrollingtext", {
                                users: showUsers,
                                tokenid: entity.uuid,
                                content,
                                duration: action.data.duration * 1000,
                                anchor: parseInt(action.data.anchor),
                                direction: parseInt(action.data.direction)
                            });
                        }
                    }
                },
                content: async (trigger, action) => {
                    let msg = action.data.text.substr(0, 15);
                    return `<span class="action-style">${i18n(trigger.name)}</span> for <span class="value-style">&lt;${MonksActiveTiles.forPlayersName(action.data?.for || "trigger")}&gt;</span> "${msg}..."`;
                }
            },
            'preload': {
                name: "MonksActiveTiles.action.preload",
                ctrls: [
                    {
                        id: "entity",
                        name: "MonksActiveTiles.ctrl.scene",
                        type: "select",
                        subtype: "entity",
                        options: { show: ['scene', 'previous'] },
                        restrict: (entity) => { return (entity instanceof Scene); },
                        required: true,
                        defaultType: 'scene',
                        defvalue: "scene",
                        placeholder: 'Please select a Scene',
                    },
                    {
                        id: "for",
                        name: "MonksActiveTiles.ctrl.for",
                        list: "for",
                        type: "list",
                        subtype: "for",
                        defvalue: "trigger"
                    }
                ],
                values: {
                    'for': {
                        "everyone": "MonksActiveTiles.for.all",
                        "players": "MonksActiveTiles.for.players",
                        "gm": "MonksActiveTiles.for.gm",
                        "trigger": "MonksActiveTiles.for.triggering",
                        "token": "MonksActiveTiles.for.token",
                        "owner": "MonksActiveTiles.for.owner",
                        "previous": "MonksActiveTiles.for.current"
                    },
                },
                fn: async (args = {}) => {
                    const { tile, action, userId, value, method } = args;

                    let showfor = action.data.for || "trigger";
                    let showUsers = MonksActiveTiles.getForPlayers(showfor, args);

                    let entities = await MonksActiveTiles.getEntities(args, 'scene', action.data?.sceneid);
                    for (let entity of entities) {
                        if (showUsers.includes(game.user.id)) {
                            await game.scenes.preload(entity.id);
                            showUsers = showUsers.filter(u => u != game.user.id);
                        }

                        if (showUsers.length)
                            MonksActiveTiles.emit('preload', { users: showUsers, sceneid: entity.id });
                    }
                },
                content: async (trigger, action) => {
                    let ctrl = trigger.ctrls.find(c => c.id == "sceneid");
                    let entityName = await MonksActiveTiles.entityName(action.data?.sceneid || ctrl?.defvalue || "previous", 'scene');
                    return `<span class="action-style">${i18n(trigger.name)}</span> <span class="entity-style">"${entityName}"</span> for <span class="value-style">&lt;${MonksActiveTiles.forPlayersName(action.data?.for || "trigger")}&gt;</span>`;
                }
            },
            'append': {
                name: "MonksActiveTiles.action.writetojournal",
                requiresGM: true,
                ctrls: [
                    {
                        id: "entity",
                        name: "MonksActiveTiles.ctrl.select-entity",
                        type: "select",
                        subtype: "entity",
                        options: { show: ['players', 'previous'] },
                        restrict: (entity) => { return (entity instanceof JournalEntry); },
                        required: true,
                        defaultType: 'journal',
                        placeholder: 'Please select a Journal',
                        onChange: async (app, ctrl, action, data) => {
                            $('select[name="data.page"]', app.element).empty();
                            let value = $(ctrl).val();
                            if (!!value) {
                                try {
                                    let entityVal = JSON.parse(value);

                                    let pageCtrl = action.ctrls.find(c => c.id == "page");
                                    let list = await pageCtrl.list(app, action, { entity: entityVal });
                                    $('select[name="data.page"]', app.element).append(app.fillList(list, data.page));
                                } catch { }
                            }
                        }
                    },
                    {
                        id: "page",
                        name: "Page",
                        placeholder: 'Please select a Journal Page',
                        list: async (app, action, data) => {
                            let value = data.entity?.id;
                            if (!!value) {
                                try {
                                    // make sure it's not an enhanced journal, those shouldn't reveal their pages
                                    if (/^JournalEntry.[a-zA-Z0-9]{16}$/.test(value)) {
                                        let entity = await fromUuid(value);

                                        if (entity && !(entity.pages.size == 1 && !!foundry.utils.getProperty(entity.pages.contents[0], "flags.monks-enhanced-journal.type"))) {
                                            let list = { "": "" };
                                            for (let p of entity.pages)
                                                list[p._id] = p.name;

                                            return list;
                                        }
                                    }
                                } catch { }
                            }
                        },
                        type: "list",
                        required: false
                    },
                    {
                        id: "create",
                        name: "Create page if not found",
                        type: "checkbox",
                        defvalue: false,
                        check: true,
                    },
                    {
                        id: "createname",
                        name: "New Page name",
                        type: "text",
                        required: true,
                        conditional: (app) => {
                            return $('input[name="data.create"]', app.element).prop('checked');
                        }
                    },
                    {
                        id: "text",
                        name: "Text",
                        type: "text",
                        subtype: "multiline",
                        required: true
                    },
                    {
                        id: "append",
                        name: "Write",
                        list: "append-type",
                        type: "list",
                        required: true,
                        defvalue: "append",
                        check: true,
                    },
                    {
                        id: "position",
                        name: "Character Index",
                        type: "number",
                        required: true,
                        conditional: (app) => {
                            return $('select[name="data.append"]', app.element).val() == 'insert';
                        },
                        help: "The character count is based off the underlying HTML, look at the source to find the appropriate index.",
                    },
                    {
                        id: "replace",
                        name: "Replace Characters",
                        type: "number",
                        required: true,
                        defvalue: 0,
                        conditional: (app) => {
                            return $('select[name="data.append"]', app.element).val() == 'insert';
                        }
                    },
                    {
                        id: "language",
                        name: "MonksActiveTiles.ctrl.language",
                        list: () => {
                            let languages = [{ id: "", label: "" }];
                            let syslang = CONFIG[game.system.id.toUpperCase()]?.languages || {};
                            if (!(syslang instanceof Array) && typeof syslang == "object") {
                                let parseGroup = (group, attach) => {
                                    let array = attach;
                                    for (let [key, value] of Object.entries(group)) {
                                        if (typeof value == "string")
                                            (attach || languages).push({ id: key, label: value });
                                        else {
                                            if (!attach) {
                                                let newGroup = { id: key, label: value.label, groups: [] };
                                                languages.push(newGroup);
                                                array = newGroup.groups;
                                            }
                                            parseGroup(value.children, array);
                                            if (!attach) {
                                                array.sort((a, b) => a.label.localeCompare(b.label));
                                            }
                                        }
                                    }
                                }
                                parseGroup(syslang);
                            }
                            return languages;
                        },
                        conditional: () => {
                            return (game.modules.get("polyglot")?.active && !!CONFIG[game.system.id.toUpperCase()]?.languages);
                        },
                        type: "list"
                    },
                ],
                values: {
                    'append-type': {
                        'append': "Append",
                        'appendline': "Append Line",
                        'prepend': "Prepend",
                        'prependline': "Prepend Line",
                        'insert': "Insert",
                        'overwrite': "Overwrite",
                    }
                },
                fn: async (args = {}) => {
                    const { tile, tokens, action, userId, value, method, change } = args;

                    let entities = await MonksActiveTiles.getEntities(args, 'journal');
                    for (let entity of entities) {
                        if (entity instanceof JournalEntry) {
                            let additionalValues = { timestamp: new Date().toLocaleString() };
                            if (game.modules.get("foundryvtt-simple-calendar")?.active) {
                                let date = SimpleCalendar.api.currentDateTimeDisplay();
                                additionalValues.datetime = `${date.date} ${date.time}`;
                            }

                            let page = (action.data.page ? entity.pages.get(action.data.page) : null);
                            if (!page) {
                                if (action.data.create) {
                                    let name = await getValue(action.data.createname || "", args, entity, additionalValues);

                                    page = await JournalEntryPage.create({ type: "text", name: name }, { parent: entity });
                                } else if (entity.pages.contents.length)
                                    page = entity.pages.contents[0];
                            }

                            if (!page)
                                continue;

                            let text = await getValue(action.data.text, args, entity, additionalValues);

                            if (action.data.language != '' && game.modules.get("polyglot")?.active) {
                                let language = action.data.language.indexOf(":") > -1 ? action.data.language.split(":")[1] : action.data.language;
                                if (!!language)
                                    text = `<span class="polyglot-journal" title="${game.polyglot.languages[language]?.label}" data-language="${language}">${text}</span>`
                            }

                            let content = page.text.content || "";
                            if (action.data.append == "append" || action.data.append == "appendline")
                                content = content + text + (action.data.append == "appendline" ? "</br>" : "");
                            else if (action.data.append == "prepend" || action.data.append == "prependline")
                                content = text + (action.data.append == "prependline" ? "</br>" : "") + content;
                            else if (action.data.append == "overwrite")
                                content = text;
                            else if (action.data.append == "insert")
                                content = content.substr(0, action.data.position) + text + content.substr(action.data.position + action.data.replace);

                            await page.update({ text: { content: content } });
                        }
                    }
                },
                content: async (trigger, action) => {
                    let syslang = CONFIG[game.system.id.toUpperCase()]?.languages || {};
                    let langlist = {};
                    let parseGroup = (group, groupkey) => {
                        for (let [key, value] of Object.entries(group)) {
                            if (typeof value == "string")
                                langlist[`${groupkey}:${key}`] = value;
                            else
                                parseGroup(value.children, key);
                        }
                    }
                    parseGroup(syslang);

                    let language = langlist[action.data.language];
                    if (!!language)
                        language = game.i18n.localize(language);

                    let msg = $('<div>').text(action.data.text.length <= 15 ? action.data.text : action.data.text.substr(0, 15) + "...").html();

                    let ctrl = trigger.ctrls.find(c => c.id == "entity");
                    let entityName = await MonksActiveTiles.entityName(action.data?.entity || ctrl?.defvalue || "previous", "journal");
                    return `<span class="action-style">${i18n(trigger.name)}</span>, <span class="entity-style">${entityName}</span> <span class="value-style">&lt;${i18n(trigger.values["append-type"][action.data.append])}&gt;</span>${(!!language && game.modules.get("polyglot")?.active ? ` in <span class="details-style">"${language}"</span>` : '')} "${msg}"`;
                }
            },
            'setvariable': {
                name: "MonksActiveTiles.action.setvariable",
                requiresGM: true,
                ctrls: [
                    {
                        id: "entity",
                        name: "MonksActiveTiles.ctrl.select-entity",
                        type: "select",
                        subtype: "entity",
                        options: { show: ['tile', 'previous', 'tagger'] },
                        restrict: (entity) => { return (entity instanceof foundry.canvas.placeables.Tile); },
                        defvalue: "tile",
                        defaultType: 'tiles',
                    },
                    {
                        id: "name",
                        name: "Variable Name",
                        type: "text",
                        required: true,
                    },
                    {
                        id: "value",
                        name: "Value",
                        type: "text",
                    },
                ],
                fn: async (args = {}) => {
                    const { tile, tokens, action, userId, value, method, change } = args;

                    let entities = await MonksActiveTiles.getEntities(args, 'tiles');
                    for (let entity of entities) {
                        if (entity instanceof TileDocument) {
                            let name = await getValue(action.data.name, args, entity, { timestamp: new Date().toLocaleString() });

                            let variables = foundry.utils.getProperty(entity, "flags.monks-active-tiles.variables") || {};
                            let w = name.replace(/[.+^${}()|[\]\\]/g, '\\$&');
                            const re = new RegExp(`^${w.replace(/\*/g, '.*').replace(/\?/g, '.')}$`, 'i');
                            let keys = name.includes("*") || name.includes("?") ? Object.keys(variables).filter(k => {
                                return re.test(k);
                            }) : [name];
                            for (let key of keys) {
                                let prop = (variables[key] == undefined ? (action.data.value.startsWith("+") || action.data.value.startsWith("-") ? 0 : "") : variables[key]);
                                let val = await getValue(action.data.value, args, entity, { timestamp: new Date().toLocaleString(), prop });

                                if (val == "_null") {
                                    foundry.utils.setProperty(entity, `flags.monks-active-tiles.variables.${key}`, null);
                                    await entity.unsetFlag("monks-active-tiles", `variables.${key}`);
                                } else {
                                    foundry.utils.setProperty(entity, `flags.monks-active-tiles.variables.${key}`, val);
                                    await entity.setFlag("monks-active-tiles", `variables.${key}`, val);
                                }
                            }
                        }
                    }
                },
                content: async (trigger, action) => {
                    let ctrl = trigger.ctrls.find(c => c.id == "entity");
                    let entityName = await MonksActiveTiles.entityName(action.data?.entity || ctrl?.defvalue || "previous", "tiles");
                    return `<span class="action-style">${i18n(trigger.name)}</span>, <span class="entity-style">${entityName}</span> <span class="value-style">&lt;${action.data?.name}&gt;</span> to <span class="details-style">"${action.data?.value}"</span>`;
                }
            },
            'setcurrent': {
                name: "MonksActiveTiles.action.setcurrent",
                requiresGM: true,
                ctrls: [
                    {
                        id: "entity",
                        name: "MonksActiveTiles.ctrl.select-entity",
                        type: "select",
                        subtype: "entity",
                        options: { show: ['players', 'tagger', 'within', 'users'] },
                        required: true,
                        restrict: (entity) => {
                            return (
                                entity instanceof foundry.canvas.placeables.Token ||
                                entity instanceof foundry.canvas.placeables.Tile ||
                                entity instanceof foundry.canvas.placeables.Wall ||
                                entity instanceof foundry.canvas.placeables.Drawing ||
                                entity instanceof foundry.canvas.placeables.Note ||
                                entity instanceof foundry.canvas.placeables.AmbientLight ||
                                entity instanceof foundry.canvas.placeables.AmbientSound ||
                                entity instanceof foundry.canvas.placeables.MeasuredTemplate
                            );
                        },
                        check: true,
                        conditional: (app) => {
                            let action = $('select[name="data.action"]', app.element).val();
                            return action != 'clear';
                        }
                    },
                    {
                        id: "collection",
                        name: "Collection",
                        list: "collection",
                        type: "list",
                        conditional: (app) => {
                            let action = $('select[name="data.action"]', app.element).val();
                            return action == 'clear';
                        },
                        defvalue: 'tokens'
                    },
                    {
                        id: "action",
                        name: "Alter Action",
                        list: "action",
                        type: "list",
                        required: true,
                        defvalue: "add",
                        check: true,
                    },
                    {
                        id: "activeuser",
                        name: "MonksActiveTiles.ctrl.activeuser",
                        type: "checkbox",
                        conditional: (app) => {
                            let entity = $('input[name="data.entity"]', app.element).data("value") || {};
                            return entity?.id == 'users';
                        },
                        help: "Only include active users",
                        defvalue: true
                    },
                    {
                        id: "owners",
                        name: "MonksActiveTiles.ctrl.owners",
                        type: "checkbox",
                        conditional: (app) => {
                            let entity = $('input[name="data.entity"]', app.element).data("value") || {};
                            return entity?.id != 'users';
                        },
                        help: "Use the owners of the entity instead of the entity",
                        defvalue: false
                    },
                ],
                values: {
                    'action': {
                        'add': "Add",
                        'remove': "Remove",
                        'replace': "Replace",
                        'clear': "Clear",
                    },
                    'collection': {
                        'actors': "Actors",
                        'drawings': "Drawings",
                        'items': "Items",
                        'journal': "Journal Entries",
                        'macros': "Macros",
                        'scene': "Scene",
                        'tiles': "Tiles",
                        'tokens': "Tokens",
                        'users': "Users",
                        'walls': "Walls"
                    }
                },
                fn: async (args = {}) => {
                    const { action, value } = args;

                    let result = value;
                    delete result.pause;

                    let actionType = action.data.action || "add";
                    if (actionType == "clear") {
                        result[action.data.collection || "tokens"] = null;
                    } else {
                        let entities = await MonksActiveTiles.getEntities(args, action.data?.collection || 'actors', (action.data?.entity?.id == "users" && action.data?.activeuser ? { id: "users:active" } : null));
                        if (action.data?.owners) {
                            let newEntities = [];
                            for (let entity of entities) {
                                let ownership = entity.ownership || {};
                                if (ownership.default == CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER) {
                                    // Add all players
                                    newEntities = game.users.map(u => u.id);
                                    break;
                                } else {
                                    for ([k, v] of Object.entries(ownership)) {
                                        if (v == CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER && k != "default") {
                                            newEntities.push(k);
                                        }
                                    }
                                }
                            }
                            entities = newEntities
                                .filter((value, index, array) => array.indexOf(value) === index)
                                .map(u => game.user.get(u))
                                .filter(u => !!u);
                        }
                        MonksActiveTiles.addToResult(entities, result, actionType);
                    }

                    return result;
                },
                content: async (trigger, action) => {
                    let ctrl = trigger.ctrls.find(c => c.id == "entity");
                    let entityName = action.data.action == "clear" ? game.i18n.format("MonksActiveTiles.CurrentCollection", { collection: (action.data.collection || "tokens") }) : await MonksActiveTiles.entityName(action.data?.entity || ctrl?.defvalue || "previous", action.data?.collection || 'tokens');
                    let triggerName = action.data.action == "clear" ? "Clear Collection" : "Set Collection";
                    let actionName = action.data.action == "add" ? "Add" : action.data.action == "remove" ? "Remove" : action.data.action == "replace" ? "Replace with" : "";
                    return `<span class="action-style">${triggerName}</span>, <span class="details-style">${actionName}</span> <span class="entity-style">${entityName}</span>${(action.data?.owners ? ' <i class="fas fa-user" title="Use Owners"></i>' : '')}`;
                }
            },
            'shuffle': {
                name: "MonksActiveTiles.action.shuffle",
                requiresGM: true,
                ctrls: [
                    {
                        id: "collection",
                        name: "Collection",
                        list: "collection",
                        type: "list",
                        defvalue: 'tokens'
                    },
                ],
                values: {
                    'collection': {
                        'actors': "Actors",
                        'drawings': "Drawings",
                        'items': "Items",
                        'journal': "Journal Entries",
                        'macros': "Macros",
                        'scene': "Scene",
                        'tiles': "Tiles",
                        'tokens': "Tokens",
                        'users': "Users",
                        'walls': "Walls"
                    }
                },
                fn: async (args = {}) => {
                    const { action, value } = args;

                    let collectionId = action.data.collection || "tokens";
                    let collection = value[collectionId] || [];

                    let currentIndex = collection.length, randomIndex;

                    // While there remain elements to shuffle.
                    while (currentIndex > 0) {

                        // Pick a remaining element.
                        randomIndex = Math.floor(Math.random() * currentIndex);
                        currentIndex--;

                        // And swap it with the current element.
                        [collection[currentIndex], collection[randomIndex]] = [collection[randomIndex], collection[currentIndex]];
                    }

                    let result = {};
                    MonksActiveTiles.addToResult(collection, result, "replace");

                    return result;
                },
                content: async (trigger, action) => {
                    return `<span class="action-style">${i18n(trigger.name)}</span>, <span class="details-style">${i18n(trigger.values.collection[action.data?.collection])}</span>`;
                }
            },
            'url': {
                name: "MonksActiveTiles.action.url",
                ctrls: [
                    {
                        id: "url",
                        name: "URL",
                        type: "text",
                    },
                ],
                fn: async (args = {}) => {
                    const { tile, tokens, action, userId, value, method, change } = args;

                    let url = action.data.url;
                    if (!url.startsWith("http"))
                        url = "http://" + url;
                    if (game.user.id == userId) {
                        foundry.applications.api.DialogV2.confirm({
                            title: "Opening external link",
                            content: "<p>Are you sure you want to open an external link?</p><p>URL: " + url + "</p>",
                            yes: {
                                callback: () => {
                                    window.open(url, "_blank");
                                }
                            }
                        });
                    }
                    else
                        MonksActiveTiles.emit("openurl", { url, userId })
                },
                content: async (trigger, action) => {
                    return `<span class="action-style">${i18n(trigger.name)}</span>, open <span class="entity-style">${action.data.url}</span>`;
                }
            },
/* logic */
            'runbatch': {
                name: "MonksActiveTiles.action.runbatch",
                group: "logic",
                fn: async (args = {}) => {
                    MonksActiveTiles.batch.execute();
                },
                content: async (trigger, action) => {
                    return `<span class="action-style">${i18n(trigger.name)}</span>`;
                }
            },

            'distance': {
                name: "MonksActiveTiles.filter.distance",
                ctrls: [
                    {
                        id: "entity",
                        name: "MonksActiveTiles.ctrl.select-entity",
                        type: "select",
                        subtype: "entity",
                        options: { show: ['token', 'within', 'players', 'previous', 'tagger'] },
                        restrict: (entity) => { return (entity instanceof foundry.canvas.placeables.Token); }
                    },
                    {
                        id: "measure",
                        name: "Measure",
                        list: "measure",
                        type: "list",
                        check: true,
                        defvalue: 'lte'
                    },
                    {
                        id: "distance",
                        name: "MonksActiveTiles.ctrl.distance",
                        type: "number",
                        required: true,
                        conditional: (app) => {
                            return $('select[name="data.measure"]', app.element).val() != 'lt';
                        },
                        defvalue: 1
                    },
                    {
                        id: "unit",
                        name: "MonksActiveTiles.ctrl.unit",
                        list: "unit",
                        type: "list",
                        required: true,
                        conditional: (app) => {
                            return $('select[name="data.measure"]', app.element).val() != 'lt';
                        },
                        defvalue: "sq"
                    },
                    {
                        id: "from",
                        name: "Measure From",
                        list: "from",
                        type: "list",
                        defvalue: 'edge'
                    },
                    {
                        id: "continue",
                        name: "Continue if",
                        list: "continue",
                        type: "list",
                        defvalue: 'within'
                    }
                ],
                values: {
                    'measure': {
                        'lt': "inside tile",
                        'lte': "less than",
                        'eq': "within",
                        'gt': "greater than"
                    },
                    'continue': {
                        "always": "Always",
                        "within": "Any Within Distance",
                        "all": "All Within Distance"
                    },
                    'unit': {
                        'sq': "grid sq.",
                        'px': "pixel"
                    },
                    'from': {
                        'edge': "Edge",
                        'center': "Center"
                    }
                },
                group: "filters",
                fn: async (args = {}) => {
                    const { tile, value, action } = args;

                    let midTile = { x: tile.x + (Math.abs(tile.width) / 2), y: tile.y + (Math.abs(tile.height) / 2) };

                    let entities = await MonksActiveTiles.getEntities(args);

                    let tokens = entities.filter(t => {
                        if (!(t instanceof TokenDocument))
                            return false;

                        const hW = ((Math.abs(t.width) * t.parent.dimensions.size) / 2);
                        const hH = ((Math.abs(t.height) * t.parent.dimensions.size) / 2);
                        const midToken = { x: t.x + hW, y: t.y + hH };

                        if (action.data.measure == 'lt') {
                            return tile.pointWithin(midToken);
                        } else {
                            let distance = parseInt(action.data?.distance.value || action.data?.distance || 0);
                            if (action.data.distance.var == 'sq')
                                distance = (t.parent.grid.size * distance);

                            let dest = { x: midTile.x - hW, y: midTile.y - hH };

                            if (action.data.from == "center") {
                                const dist = Math.hypot(midTile.x - midToken.x, midTile.y - midToken.y) - ((Math.abs(t.width) * t.parent.dimensions.size) / 2);
                                debug('token within', dist);

                                return (action.data.measure == 'gt' ? dist > distance : dist < distance && dist > -(Math.abs(t.width) * t.parent.dimensions.size));
                            } else {
                                let collisions = tile.getIntersections(t, dest);

                                if (collisions.length == 0) {
                                    //it's within the tile
                                    return action.data.measure == 'lte';
                                } else {
                                    let sorted = (collisions.length > 1 ? collisions.sort((c1, c2) => (c1.t0 > c2.t0) ? 1 : -1) : collisions);

                                    //clear out any duplicate corners
                                    collisions = sorted.filter((value, index, self) => {
                                        return self.findIndex(v => v.x === value.x && v.y === value.y) === index;
                                    });

                                    /*
                                    let gr = new PIXI.Graphics();
                                    if (MonksActiveTiles.debugGr)
                                        canvas.tokens.removeChild(MonksActiveTiles.debugGr);
                                    MonksActiveTiles.debugGr = gr;
                                    canvas.tokens.addChild(gr);
    
                                    gr.beginFill(0x800080)
                                        .lineStyle(2, 0x800080)
                                        .moveTo(midToken.x, midToken.y)
                                        .lineTo(collisions[0].x, collisions[0].y)
                                        .drawCircle(midTile.x, midTile.y, 4)
                                        .drawCircle(midToken.x, midToken.y, 4)
                                        .drawCircle(collisions[0].x, collisions[0].y, 4)
                                        .endFill();
                                        */

                                    const dist = Math.hypot(collisions[0].x - midToken.x, collisions[0].y - midToken.y) - ((Math.abs(t.width) * t.parent.dimensions.size) / 2);
                                    debug('token within', dist);

                                    return (action.data.measure == 'gt' ? dist > distance : dist < distance && dist > -(Math.abs(t.width) * t.parent.dimensions.size));
                                }
                            }
                        }
                    });

                    let cont = (action.data?.continue == 'always'
                        || (action.data?.continue == 'within' && tokens.length > 0)
                        || (action.data?.continue == 'all' && tokens.length == value["tokens"].length && tokens.length > 0));

                    return { continue: cont, tokens: tokens };
                },
                content: async (trigger, action) => {
                    let unit = (action.data.distance.var == 'sq' ? 'grid square' : 'pixels');
                    let ctrl = trigger.ctrls.find(c => c.id == "entity");
                    let entityName = await MonksActiveTiles.entityName(action.data?.entity || ctrl?.defvalue || "previous");
                    return `<span class="filter-style">Filter</span> <span class="entity-style">${entityName}</span> ${action.data.measure != 'lte' ? 'by a distance' : 'that are'} <span class="entity-style">${trigger.values.measure[action.data.measure || 'eq']}</span>${(action.data.measure != 'lt' ? ` <span class="details-style">"${action.data?.distance.value || action.data?.distance || 0}"</span> ${unit} of this Tile` : '')} ${(action.data?.continue != 'always' ? ', Continue if ' + (action.data?.continue == 'within' ? 'Any Within Distance' : 'All Within Distance') : '')}`;
                }
            },
            'visibility': {
                name: "MonksActiveTiles.filter.visibility",
                visible: false,
                ctrls: [
                    {
                        id: "entity",
                        name: "MonksActiveTiles.ctrl.select-entity",
                        type: "select",
                        subtype: "entity",
                        options: { show: ['token', 'within', 'players', 'previous', 'tagger'] },
                        restrict: (entity) => { return (entity instanceof foundry.canvas.placeables.Token); }
                    },
                    {
                        id: "target",
                        name: "MonksActiveTiles.ctrl.select-target",
                        type: "select",
                        subtype: "entity",
                        options: { show: ['tile', 'tagger'] },
                        restrict: (entity) => {
                            return (
                                entity instanceof foundry.canvas.placeables.Token ||
                                entity instanceof foundry.canvas.placeables.Tile ||
                                entity instanceof foundry.canvas.placeables.Drawing ||
                                entity instanceof foundry.canvas.placeables.Wall || 
                                entity instanceof foundry.canvas.placeables.AmbientLight);
                        },
                        defaultType: "tiles"
                    },
                    {
                        id: "continue",
                        name: "Continue if",
                        list: "continue",
                        type: "list",
                        defvalue: 'within'
                    }
                ],
                values: {
                    'continue': {
                        "always": "Always",
                        "within": "Any see target",
                        "all": "All see target"
                    }
                },
                group: "filters",
                fn: async (args = {}) => {
                    const { tile, value, action } = args;

                    let targets = await MonksActiveTiles.getEntities(args, "tiles", action.data.target);
                    if (!targets.length) return;

                    let target = targets[0];
                    let midTarget = { x: target.x + (Math.abs(target.width) / 2), y: target.y + (Math.abs(target.height) / 2) };

                    let entities = await MonksActiveTiles.getEntities(args);

                    let tokens = entities.filter(t => {
                        if (!(t instanceof TokenDocument))
                            return false;

                        const tolerance = Math.min(t.w, t.h) / 4;
                        return canvas.visibility.testVisibility({ x: midTarget.x, y: midTarget.y }, { tolerance, object: t });
                    });

                    let cont = (action.data?.continue == 'always'
                        || (action.data?.continue == 'within' && tokens.length > 0)
                        || (action.data?.continue == 'all' && tokens.length == value["tokens"].length && tokens.length > 0));

                    return { continue: cont, tokens: tokens };
                },
                content: async (trigger, action) => {
                    let ctrl = trigger.ctrls.find(c => c.id == "entity");
                    let entityName = await MonksActiveTiles.entityName(action.data?.entity || ctrl?.defvalue || "previous");
                    let targetCtrl = trigger.ctrls.find(c => c.id == "target");
                    let targetName = await MonksActiveTiles.entityName(action.data?.target || targetCtrl?.defvalue || "previous");
                    return `<span class="filter-style">Filter</span> <span class="entity-style">${entityName}</span> that can see ${targetName} ${(action.data?.continue != 'always' ? ', Continue if ' + (action.data?.continue == 'within' ? 'Any Within Distance' : 'All Within Distance') : '')}`;
                }
            },
            // 'entitycount'
            'exists': {
                name: "MonksActiveTiles.filter.exists",
                ctrls: [
                    {
                        id: "entity",
                        name: "MonksActiveTiles.ctrl.select-entity",
                        type: "select",
                        subtype: "entity",
                        check: true,
                        options: { show: ['token', 'within', 'players', 'previous', 'tagger'] },
                        restrict: (entity) => { return (entity instanceof foundry.canvas.placeables.Token); },
                        help: '<span style="color: #FF0000;">This should probably be using the Current Tokens <i class="fas fa-arrow-up-from-bracket fa-sm"></i> instead of the Triggering Tokens</span>',
                        conditionalHelp: (app) => {
                            let entity = $('input[name="data.entity"]', app.element).data("value") || {};
                            return entity?.id == "token";
                        }
                    },
                    {
                        id: "collection",
                        name: "Collection",
                        list: "collection",
                        type: "list",
                        onChange: (app, ctrl, action, data) => {
                            let displayName = game.i18n.format("MonksActiveTiles.CurrentCollection", { collection: $(ctrl).val() || "tokens" });
                            $('input[name="data.entity"]', app.element).next().html(displayName);
                        },
                        conditional: (app) => {
                            let entity = $('input[name="data.entity"]', app.element).data("value") || {};
                            return entity?.id == 'previous';
                        },
                        defvalue: 'tokens'
                    },
                    {
                        id: "count",
                        name: "MonksActiveTiles.ctrl.count",
                        type: "text",
                        required: true,
                        defvalue: "> 0"
                    },
                    {
                        id: "none",
                        name: "If none exist goto",
                        type: "text",
                        placeholder: "Leave blank to stop"
                    },
                ],
                values: {
                    'collection': {
                        'actors': "Actors",
                        'drawings': "Drawings",
                        'items': "Items",
                        'journal': "Journal Entries",
                        'macros': "Macros",
                        'scene': "Scene",
                        'tiles': "Tiles",
                        'tokens': "Tokens",
                        'users': "Users",
                        'walls': "Walls"
                    }
                },
                group: "filters",
                fn: async (args = {}) => {
                    let { tokens, tile, userId, value, method, action, change } = args;
                    let entities = await MonksActiveTiles.getEntities(args, action.data?.collection || "tokens");

                    /*
                    let context = {
                        actor: tokens[0]?.actor?.toObject(false),
                        token: tokens[0]?.toObject(false),
                        tile: tile.toObject(false),
                        variable: foundry.utils.getProperty(tile, "flags.monks-active-tiles.variables") || {},
                        user: game.users.get(userId),
                        value: value,
                        scene: canvas.scene,
                        method: method,
                        change: change
                    };
                    */

                    let goto = await getValue(action.data?.none || "", args);

                    /*
                    if (goto.includes("{{")) {
                        const compiled = Handlebars.compile(goto);
                        goto = compiled(context, { allowProtoMethodsByDefault: true, allowProtoPropertiesByDefault: true }).trim();
                    }
                    */

                    let cando = await getValue(action.data?.count ?? "> 0", args, null, { prop: entities.length, operation: 'compare' });

                    /*
                    if (count.includes("{{")) {
                        const compiled = Handlebars.compile(count);
                        count = compiled(context, { allowProtoMethodsByDefault: true, allowProtoPropertiesByDefault: true }).trim();
                    }

                    let cando = false;
                    try {
                        cando = !!eval(entities.length + " " + count);
                    } catch {
                    }
                    */

                    let result = { continue: (!!cando || goto != "") };
                    MonksActiveTiles.addToResult(entities, result);
                    if (goto != "" && !cando)
                        result.goto = goto;

                    return result;
                },
                content: async (trigger, action) => {
                    let ctrl = trigger.ctrls.find(c => c.id == "entity");
                    let entityName = await MonksActiveTiles.entityName(action.data?.entity || ctrl?.defvalue || "previous", action.data?.collection || "tokens");
                    let goto = action.data?.none || "";
                    let count = action.data?.count ?? "> 0";
                    return `<span class="filter-style">Check entity count, Continue if</span> <span class="entity-style">${entityName}</span> <span class="value-style">"${count}"</span>${goto != "" ? ' goto <span class="details-style">"' + goto + '"</span> if none exist' : ""}`;
                }
            },
            'triggercount': {
                name: "MonksActiveTiles.filter.triggercount",
                ctrls: [
                    {
                        id: "count",
                        name: "MonksActiveTiles.ctrl.triggercount",
                        type: "text",
                        required: true,
                        defvalue: "> 1"
                    },
                    {
                        id: "unique",
                        name: "Unique token triggers",
                        type: "checkbox",
                    },
                    {
                        id: "none",
                        name: "If no success goto",
                        type: "text",
                        placeholder: "Leave blank to stop"
                    },
                ],
                group: "filters",
                fn: async (args = {}) => {
                    let { tokens, tile, userId, value, method, action, change } = args;

                    let goto = await getValue(action.data?.none || "", args);

                    /*
                    if (goto.includes("{{")) {
                        let context = {
                            actor: tokens[0]?.actor?.toObject(false),
                            token: tokens[0]?.toObject(false),
                            tile: tile.toObject(false),
                            variable: foundry.utils.getProperty(tile, "flags.monks-active-tiles.variables") || {},
                            user: game.users.get(userId),
                            value: value,
                            scene: canvas.scene,
                            method: method,
                            change: change
                        };

                        const compiled = Handlebars.compile(goto);
                        goto = compiled(context, { allowProtoMethodsByDefault: true, allowProtoPropertiesByDefault: true }).trim();
                    }
                    */

                    let cando = await getValue(action.data?.count ?? "> 1", args, null, { prop: tile.countTriggered(action.data.unique ? "unique" : null), operation: 'compare' });

                    /*
                    let count = action.data?.count ?? "> 1";
                    if (count.startsWith("="))
                        count = "=" + count;

                    let cando = false;
                    try {
                        cando = !!eval(tile.countTriggered(action.data.unique ? "unique" : null) + " " + count);
                    } catch {
                    }
                    */

                    let result = { continue: (!!cando || goto != "") };
                    if (goto != "" && !cando)
                        result.goto = goto;

                    return result;
                },
                content: async (trigger, action) => {
                    let goto = action.data?.none || "";
                    let count = action.data?.count ?? "> 0";
                    return `<span class="filter-style">Continue if</span> Tile triggered <span class="value-style">"${count}"</span> times ${action.data.unique ? "by unique tokens " : ""} ${goto != "" ? ` goto <span class="details-style">"${goto}"</span> if it hasn't` : ""}`;
                }
            },
            'tokencount': {
                name: "MonksActiveTiles.filter.tokencount",
                ctrls: [
                    {
                        id: "entity",
                        name: "MonksActiveTiles.ctrl.select-entity",
                        type: "select",
                        subtype: "entity",
                        options: { show: ['token', 'within', 'players', 'previous', 'tagger'] },
                        restrict: (entity) => { return (entity instanceof foundry.canvas.placeables.Token); }
                    },
                    {
                        id: "count",
                        name: "MonksActiveTiles.ctrl.tokencount",
                        type: "text",
                        required: true,
                        defvalue: "= 1"
                    },
                ],
                group: "filters",
                fn: async (args = {}) => {
                    let { action, tile } = args;

                    //let count = action.data?.count ?? "= 1";
                    //if (count.startsWith("="))
                    //    count = "=" + count;

                    let entities = await MonksActiveTiles.getEntities(args);
                    entities = await asyncFilter(entities, async (entity) => {
                        let cando = await getValue(action.data?.count ?? "= 1", args, entity, { prop: tile.countTriggered(entity.id), operation: 'compare' });

                        /*
                        let cando = false;
                        try {
                            cando = !!eval(tile.countTriggered(e.id) + " " + count);
                        } catch {
                        }*/
                        return !!cando;
                    });

                    return { tokens: entities };
                },
                content: async (trigger, action) => {
                    let ctrl = trigger.ctrls.find(c => c.id == "entity");
                    let entityName = await MonksActiveTiles.entityName(action.data?.entity || ctrl?.defvalue || "previous");
                    let goto = action.data?.none || "";
                    let count = action.data?.count ?? "> 0";
                    return `<span class="filter-style">Filter</span> <span class="entity-style">${entityName}</span> by trigger count <span class="value-style">"${count}"</span>${goto != "" ? ` goto <span class="details-style">"${goto}"</span> if none have` : ""}`;
                }
            },
            'first': {
                name: "MonksActiveTiles.filter.first",
                ctrls: [
                    {
                        id: "entity",
                        name: "MonksActiveTiles.ctrl.select-entity",
                        type: "select",
                        subtype: "entity",
                        check: true,
                        options: { show: ['token', 'within', 'players', 'previous', 'tagger'] },
                        restrict: (entity) => { return (entity instanceof foundry.canvas.placeables.Token); }
                    },
                    {
                        id: "collection",
                        name: "Collection",
                        list: (app, action, data) => {
                            let collections = action.values.collection;
                            if (game.modules.get("monks-tokenbar")?.active) {
                                collections = Object.assign({'tokenresults': "Rolls"}, collections);
                            }
                            return collections;
                        },
                        type: "list",
                        onChange: (app, ctrl, action, data) => {
                            let displayName = game.i18n.format("MonksActiveTiles.CurrentCollection", { collection: $(ctrl).val() || "tokens" });
                            $('input[name="data.entity"]', app.element).next().html(displayName);
                        },
                        conditional: (app) => {
                            let entity = $('input[name="data.entity"]', app.element).data("value") || {};
                            return entity?.id == 'previous';
                        },
                        defvalue: 'tokens'
                    },
                    {
                        id: "position",
                        name: "MonksActiveTiles.ctrl.position",
                        type: "text",
                        required: true,
                        defvalue: "first",
                        help: "you can also use <i>first</i>, <i>last</i>, or <i>random</i> to select a spot"
                    },
                ],
                values: {
                    'collection': {
                        'actors': "Actors",
                        'drawings': "Drawings",
                        'items': "Items",
                        'journal': "Journal Entries",
                        'macros': "Macros",
                        'scene': "Scene",
                        'tiles': "Tiles",
                        'tokens': "Tokens",
                        'walls': "Walls"
                    }
                },
                group: "filters",
                fn: async (args = {}) => {
                    let { value, action } = args;

                    let entities = await MonksActiveTiles.getEntities(args, action.data?.collection || "tokens");

                    if (entities && entities.length) {
                        let position = action.data?.position ?? "first";
                        let entity;
                        let result = {};
                        if (position == "min" || position == "max") {
                            if (action.data?.collection == "tokenresults") {
                                result.rollresults = [entities.reduce((prev, current) => { return prev.roll?.total > current.roll?.total ? (position == "min" ? current : prev) : (position == "min" ? prev : current) })];
                            } else if (["actors", "items", "journal", "macros", "scene", "tokens"].includes(action.data?.collection)) {
                                entity = entities.reduce((prev, current) => { return prev.name > current.name ? (position == "min" ? current : prev) : (position == "min" ? prev : current) });
                            } else {
                                entity = entities[0];
                            }
                        } else {
                            if (position == "first")
                                position = 0;
                            else if (position == "last")
                                position = entities.length - 1;
                            else if (position == "random")
                                position = Math.floor(Math.random() * entities.length);
                            else
                                position = position - 1;

                            position = Math.clamp(position, 0, entities.length - 1);
                            entity = entities[position];
                        }

                        MonksActiveTiles.addToResult(entity, result, "replace");

                        return result;
                    } else
                        return { tokens: [] };
                },
                content: async (trigger, action) => {
                    let ctrl = trigger.ctrls.find(c => c.id == "entity");
                    let entityName = await MonksActiveTiles.entityName(action.data?.entity || ctrl?.defvalue || "previous", action.data?.collection || "tokens");
                    let position = action.data?.position ?? "first";
                    return `<span class="filter-style">Limit</span> <span class="entity-style">${entityName}</span> to <span class="value-style">"${position}"</span> in the list`;
                }
            },
            'attribute': {
                name: "MonksActiveTiles.filter.attribute",
                ctrls: [
                    {
                        id: "entity",
                        name: "MonksActiveTiles.ctrl.select-entity",
                        type: "select",
                        subtype: "entity",
                        check: true,
                        options: { show: ['tile', 'token', 'within', 'players', 'previous', 'tagger'] },
                        restrict: (entity) => {
                            return (entity instanceof foundry.canvas.placeables.Token ||
                                entity instanceof foundry.canvas.placeables.Tile ||
                                entity instanceof foundry.canvas.placeables.Drawing ||
                                entity instanceof foundry.canvas.placeables.Note ||
                                entity instanceof foundry.canvas.placeables.AmbientLight ||
                                entity instanceof foundry.canvas.placeables.AmbientSound ||
                                entity instanceof foundry.canvas.placeables.Wall ||
                                entity.constructor.name == "Terrain");
                        }
                    },
                    {
                        id: "collection",
                        name: "Collection",
                        list: "collection",
                        type: "list",
                        onChange: (app, ctrl, action, data) => {
                            let displayName = game.i18n.format("MonksActiveTiles.CurrentCollection", { collection: $(ctrl).val() || "tokens" });
                            $('input[name="data.entity"]', app.element).next().html(displayName);
                        },
                        conditional: (app) => {
                            let entity = $('input[name="data.entity"]', app.element).data("value") || {};
                            return entity?.id == 'previous';
                        },
                        defvalue: 'tokens'
                    },
                    {
                        id: "attribute",
                        name: "MonksActiveTiles.ctrl.attribute",
                        type: "text",
                        required: true
                    },
                    {
                        id: "value",
                        name: "MonksActiveTiles.ctrl.value",
                        type: "text",
                        required: true,
                    },
                ],
                values: {
                    'collection': {
                        'actors': "Actors",
                        'items': "Items",
                        'journal': "Journal Entries",
                        'tiles': "Tiles",
                        'tokens': "Tokens",
                        'walls': "Walls",
                        'users': "Users"
                    }
                },
                group: "filters",
                fn: async (args = {}) => {
                    let { action, value, tokens, tile, method, change, userId } = args;

                    let collection = action.data?.collection || "tokens";
                    if (action.data.entity.id == "tile") collection = 'tiles';

                    let entities = await MonksActiveTiles.getEntities(args, collection);

                    let filtered = await asyncFilter(entities, async (entity) => {
                        let attr = await getValue(action.data.attribute, args, entity); // Removed the prop option so that it doesn't try and modify the attribute
                        let prop = "";
                        let base = entity;
                        let found = false;

                        if (!attr.startsWith('flags')) {
                            if (!foundry.utils.hasProperty(base, attr) && entity instanceof TokenDocument) {
                                if (foundry.utils.hasProperty(base, "system." + attr) && entity instanceof TokenDocument) {
                                    attr = "system." + attr;
                                    found = true;
                                } else
                                    base = entity.actor;
                            }

                            if (!found) {
                                if (!foundry.utils.hasProperty(base, attr)) {
                                    if (foundry.utils.hasProperty(base, "system." + attr))
                                        attr = "system." + attr;
                                }
                            }
                        }

                        prop = foundry.utils.getProperty(base, attr) || prop;

                        if (prop && (typeof prop == 'object') && !(prop instanceof Array) && !(prop instanceof Set)) {
                            if (prop.value == undefined) {
                                debug("Attribute returned an object and the object doesn't have a value property", entity, attr, prop);
                                return false;
                            }

                            attr = attr + '.value';
                            prop = prop.value;
                        }

                        let val = await getValue(action.data.value, args, entity, { prop, operation: 'compare' });

                        return val;
                    });

                    //addToResult
                    let result = {};
                    if (filtered.length) {
                        MonksActiveTiles.addToResult(filtered, result);
                    } else {
                        result[collection] = [];
                    }
                    return result;
                },
                content: async (trigger, action) => {
                    let ctrl = trigger.ctrls.find(c => c.id == "entity");
                    let entityName = await MonksActiveTiles.entityName(action.data?.entity || ctrl?.defvalue || "previous", action.data?.collection);
                    return `<span class="filter-style">Filter</span> <span class="entity-style">${entityName}</span> with <span class="value-style">&lt;${action.data?.attribute}&gt;</span> <span class="details-style">${ActionManager.wrapQuotes(action.data?.value)}</span>`;
                }
            },
            'inventory': {
                name: "MonksActiveTiles.filter.inventory",
                ctrls: [
                    {
                        id: "entity",
                        name: "MonksActiveTiles.ctrl.select-entity",
                        type: "select",
                        subtype: "entity",
                        check: true,
                        options: { show: ['token', 'within', 'players', 'previous', 'tagger'] },
                        restrict: (entity) => {
                            return (entity instanceof foundry.canvas.placeables.Token);
                        }
                    },
                    {
                        id: "item",
                        name: "MonksActiveTiles.ctrl.itemname",
                        type: "text",
                        required: true
                    },
                    {
                        id: "count",
                        name: "MonksActiveTiles.ctrl.itemcount",
                        type: "text",
                        required: true,
                        defvalue: "> 0"
                    },
                    {
                        id: "quantity",
                        name: "MonksActiveTiles.ctrl.itemquantity",
                        type: "text",
                        conditional: (app) => {
                            return ["dnd5e"].includes(game.system.id);
                        },
                        defvalue: ">= 1"
                    },
                ],
                group: "filters",
                fn: async (args = {}) => {
                    let { action, value, tokens, tile } = args;

                    let entities = await MonksActiveTiles.getEntities(args, action.data?.collection || "tokens");

                    let result = await asyncFilter(entities, async (entity) => {
                        if (!entity.actor)
                            return false;

                        let name = await getValue(action.data.item, args, entity);
                        name = (name || "").trim().toLowerCase();
                        let items = entity.actor.items || [];

                        let w = name.replace(/[.+^${}()|[\]\\]/g, '\\$&');
                        const re = new RegExp(`^${w.replace(/\*/g, '.*').replace(/\?/g, '.')}$`, 'i');
                        let filteredItems = items.filter(i => {
                            let itemName = (i.name || "").trim().toLowerCase();
                            if (name.includes("*") || name.includes("?"))
                                return re.test(itemName);
                            else
                                return itemName.localeCompare(name) == 0;

                        });

                        let cando = await getValue(action.data?.count ?? "= 1", args, entity, { prop: filteredItems.length, operation: 'compare' });

                        if (!!cando && ["dnd5e"].includes(game.system.id) && action.data?.quantity && filteredItems.length) {
                            filteredItems = await asyncFilter(filteredItems, async (item) => {
                                try {
                                    switch (game.system.id) {
                                        case "dnd5e": let result = await getValue(action.data?.quantity, args, item, { prop: item.system.quantity, operation: 'compare' }); return result;
                                    }
                                } catch { }
                                return false;
                            });
                            cando = (filteredItems.length > 0);
                        }

                        return !!cando;
                    });

                    return { tokens: result };
                },
                content: async (trigger, action) => {
                    let ctrl = trigger.ctrls.find(c => c.id == "entity");
                    let entityName = await MonksActiveTiles.entityName(action.data?.entity || ctrl?.defvalue || "previous", action.data?.collection || "tokens");
                    let count = action.data?.count ?? "> 0";
                    return `<span class="filter-style">Filter</span> <span class="entity-style">${entityName}</span> with item <span class="value-style">&lt;${action.data?.item}&gt;</span> <span class="value-style">"${count}"</span>`;
                }
            },
            'condition': {
                name: "MonksActiveTiles.filter.condition",
                ctrls: [
                    {
                        id: "entity",
                        name: "MonksActiveTiles.ctrl.select-entity",
                        type: "select",
                        subtype: "entity",
                        check: true,
                        options: { show: ['token', 'within', 'players', 'previous', 'tagger'] },
                        restrict: (entity) => {
                            return (entity instanceof foundry.canvas.placeables.Token);
                        }
                    },
                    {
                        id: "effectid",
                        name: "MonksActiveTiles.ctrl.effectlist",
                        list: () => {
                            let result = {};
                            let conditions = CONFIG.statusEffects;
                            if (game.system.id == 'pf2e') {
                                conditions = game.pf2e.ConditionManager.conditions;
                                conditions = [...conditions].map(e => { return { id: e[0], label: e[1].name }; }).filter((value, index, array) => array.findIndex(a => a.label === value.label) === index);
                            }
                            for (let effect of conditions.sort((a, b) => { return String(a.name || a.label).localeCompare(b.name || b.label) })) { //(i18n(a.label) > i18n(b.label) ? 1 : (i18n(a.label) < i18n(b.label) ? -1 : 0))
                                result[effect.id] = i18n(effect.name || effect.label);
                            }
                            return result;
                        },
                        check: true,
                        type: "list",
                        required: true
                    },
                    {
                        id: "hascondition",
                        name: "MonksActiveTiles.ctrl.hascondition",
                        list: "hascondition",
                        type: "list",
                        defvalue: 'has',
                    },
                ],
                values: {
                    'hascondition': {
                        'has': "Has condition",
                        'hasnot': "Does not have condition",
                    }
                },
                group: "filters",
                fn: async (args = {}) => {
                    let { action, value, tokens, tile } = args;

                    /*let count = action.data?.count ?? "= 1";
                    if (count.startsWith("=") && !count.startsWith('=='))
                        count = "=" + count;
                        */

                    let entities = await MonksActiveTiles.getEntities(args, action.data?.collection || "tokens");

                    let effect = game.system.id == 'pf2e' ? game.pf2e.ConditionManager.getCondition(action.data?.effectid) : CONFIG.statusEffects.find(e => e.id === action.data?.effectid);
                    if (!effect)
                        return;

                    let result = entities.filter(entity => {
                        if (!entity.actor)
                            return false;

                        let hasEffect = false;
                        if (game.system.id == 'pf2e') {
                            hasEffect = entity.actor.itemTypes.condition.some((condition) => {
                                return condition.slug === effect.slug;
                            });
                        } else if (game.system.id == 'dnd5e') {
                            hasEffect = entity.actor.statuses.has(effect.id);
                        } else {
                            hasEffect = (entity.actor.effects.find(e => e.getFlag("core", "statusId") === effect.id) != undefined);
                        }

                        return (action.data.hascondition == 'has' || action.data.hascondition == undefined ? hasEffect : !hasEffect);
                    });

                    return { tokens: result };
                },
                content: async (trigger, action) => {
                    let ctrl = trigger.ctrls.find(c => c.id == "entity");
                    let entityName = await MonksActiveTiles.entityName(action.data?.entity || ctrl?.defvalue || "previous", action.data?.collection || "tokens");
                    return `<span class="filter-style">Filter</span> <span class="entity-style">${entityName}</span> with condition <span class="details-style">"${action.data?.effectid}"</span>`;
                }
            },
            'random': {
                name: "MonksActiveTiles.filter.random",
                ctrls: [
                    {
                        id: "number",
                        name: "MonksActiveTiles.ctrl.randomnumber",
                        type: "text",
                        required: true,
                    },
                    {
                        id: "fail",
                        name: "MonksActiveTiles.ctrl.fail",
                        type: "text"
                    },
                ],
                group: "filters",
                fn: async (args = {}) => {
                    let { action } = args;

                    let num = await getValue(action.data.number, args, null, {prop: ""});
                    num = parseFloat(num);
                    if (isNaN(num)) {
                        console.warn("Monks Active Tiles | Random filter failed to parse number", action.data.number);
                        num = 0;
                    }

                    num = Math.abs(num);
                    if (num > 1)
                        num = num / 100;
                    let value = Math.random();
                    log("Random Number", num, value);
                    if (num >= value)
                        return { continue: true };
                    else
                        return { continue: !!action.data.fail, goto: action.data.fail };
                },
                content: async (trigger, action) => {
                    return `<span class="filter-style">Random </span> <span class="details-style">"${action.data.number}%"</span> to continue${action.data?.fail ? `, <span class="value-style">"${action.data?.fail}"</span> on fail` : ''}`;
                }
            },
            'checkvariable': {
                name: "MonksActiveTiles.filter.variable",
                ctrls: [
                    {
                        id: "entity",
                        name: "MonksActiveTiles.ctrl.select-entity",
                        type: "select",
                        subtype: "entity",
                        check: true,
                        options: { show: ['tile', 'previous', 'tagger'] },
                        restrict: (entity) => {
                            return (entity instanceof foundry.canvas.placeables.Tile);
                        },
                        defvalue: "tile",
                        defaultType: "tiles"
                    },
                    {
                        id: "type",
                        name: "Filter Type",
                        list: "type",
                        type: "list",
                        defvalue: 'all'
                    },
                    {
                        id: "name",
                        name: "MonksActiveTiles.ctrl.variablename",
                        type: "text",
                        required: true
                    },
                    {
                        id: "value",
                        name: "MonksActiveTiles.ctrl.value",
                        type: "text",
                        required: true,
                    },
                    {
                        id: "fail",
                        name: "MonksActiveTiles.ctrl.fail",
                        type: "text"
                    },
                ],
                values: {
                    'type': {
                        'all': "All",
                        'any': "Any",
                        'none': "None",
                    }
                },
                group: "filters",
                fn: async (args = {}) => {
                    const { tile, tokens, action, userId, value, method, change } = args;

                    let success = 0;
                    let count = 0;
                    let entities = await MonksActiveTiles.getEntities(args, 'tiles');
                    for (let entity of entities) {
                        if (entity instanceof TileDocument) {
                            count++;
                            let name = await getValue(action.data?.name, args, entity, { operation: 'compare' });
                            let cando = await getValue(action.data?.value, args, entity, { prop: foundry.utils.getProperty(entity, `flags.monks-active-tiles.variables.${name}`), operation: 'compare' });
                            if (cando)
                                success++;
                        }
                    }
                    
                    if ((action.data?.type == "all" && success == count) || (action.data?.type == "any" && success > 0) || (action.data?.type == "none" && success == 0))
                        return { continue: true };
                    else {
                        let fail = !!action.data.fail ? await getValue(action.data?.fail, args, null, { prop: "" }) : null;
                        return { continue: !!fail, goto: fail };
                    }
                },
                content: async (trigger, action) => {
                    let ctrl = trigger.ctrls.find(c => c.id == "entity");
                    let entityName = await MonksActiveTiles.entityName(action.data?.entity || ctrl?.defvalue || "previous", "tiles");
                    return `<span class="action-style">${i18n(trigger.name)}</span>, <span class="entity-style">${entityName}</span> <span class="details-style">"${action.data?.name}"</span> if <span class="value-style">&lt;${action.data?.value}&gt;</span>`;
                }
            },
            'checkvalue': {
                name: "MonksActiveTiles.filter.value",
                ctrls: [
                    {
                        id: "name",
                        name: "MonksActiveTiles.ctrl.valuename",
                        type: "text",
                        required: true
                    },
                    {
                        id: "value",
                        name: "MonksActiveTiles.ctrl.value",
                        type: "text",
                        required: true,
                    },
                    {
                        id: "fail",
                        name: "MonksActiveTiles.ctrl.fail",
                        type: "text"
                    },
                ],
                group: "filters",
                fn: async (args = {}) => {
                    const { tile, tokens, action, userId, value, method, change } = args;

                    let name = await getValue(action.data?.name, args, null, { operation: 'compare' });
                    let prop = !!name ? foundry.utils.getProperty(value, name) ?? foundry.utils.getProperty(args, name) : "";
                    let cando = await getValue(action.data?.value, args, null, { prop, operation: 'compare' });

                    if (cando)
                        return { continue: true };
                    else {
                        let fail = !!action.data.fail ? await getValue(action.data?.fail, args, null, { prop: "" }) : null;
                        return { continue: !!fail, goto: fail };
                    }
                },
                content: async (trigger, action) => {
                    return `<span class="action-style">${i18n(trigger.name)}</span>, <span class="details-style">&lt;${action.data?.name}&gt;</span> if <span class="value-style">"${action.data?.value}"</span>`;
                }
            },
/* logic */
            'checkdata': {
                name: "MonksActiveTiles.logic.checkdata",
                ctrls: [
                    {
                        id: "attribute",
                        name: "MonksActiveTiles.ctrl.attribute",
                        type: "text",
                        required: true
                    },
                    {
                        id: "value",
                        name: "MonksActiveTiles.ctrl.value",
                        type: "text",
                        required: true,
                    },
                    {
                        id: "fail",
                        name: "MonksActiveTiles.ctrl.fail",
                        type: "text"
                    },
                ],
                group: "logic",
                fn: async (args = {}) => {
                    let { action, userId, tile } = args;

                    let attr = await getValue(action.data.attribute, args, tile);

                    let base = tile;

                    if (!attr.startsWith('flags')) {
                        if (!foundry.utils.hasProperty(base, attr) && entity instanceof TokenDocument) {
                            base = entity.actor;
                        }

                        if (!foundry.utils.hasProperty(base, attr)) {
                            if (!attr.startsWith("system"))
                                attr = 'system.' + attr;
                            if (!foundry.utils.hasProperty(base, attr)) {
                                warn("Couldn't find attribute", entity, attr);
                            }
                        }
                    }

                    let prop = foundry.utils.getProperty(base, attr);

                    if (prop && typeof prop == 'object' && !(prop instanceof Array)) {
                        if (prop.value == undefined) {
                            debug("Attribute returned an object and the object doesn't have a value property", entity, attr, prop);
                        }

                        prop = prop.value;
                    }

                    let val = await getValue(action.data.value, args, tile, { prop, operation: 'compare' });

                    if (val)
                        return { continue: true };
                    else
                        return { continue: !!action.data.fail, goto: action.data.fail };
                },
                content: async (trigger, action) => {
                    return `<span class="action-style">${i18n(trigger.name)}</span>, <span class="value-style">&lt;${action.data?.attribute}&gt;</span> <span class="details-style">${ActionManager.wrapQuotes(action.data?.value)}</span>`;
                }
            },
            'playertype': {
                name: "MonksActiveTiles.logic.playertype",
                ctrls: [
                    {
                        id: "gm",
                        name: "MonksActiveTiles.ctrl.gmredirect",
                        type: "text",
                    },
                    {
                        id: "player",
                        name: "MonksActiveTiles.ctrl.playerredirect",
                        type: "text",
                    }
                ],
                group: "logic",
                fn: async (args = {}) => {
                    let { action, userId } = args;

                    let user = game.users.get(userId);
                    if (user.isGM) {
                        if (action.data.gm) {
                            let goto = await getValue(action.data.gm, args, null, { prop: "" });
                            return { goto };
                        } else
                            return { continue: false };
                    } else {
                        if (action.data.player) {
                            let goto = await getValue(action.data.player, args, null, { prop: "" });
                            return { goto };
                        } else
                            return { continue: false };
                    }
                },
                content: async (trigger, action) => {
                    let gmredirect = (action.data.gm ? `<span class="entity-style">GM</span> to <span class="value-style">&lt;${action.data.gm}&gt;</span>` : "");
                    let playerredirect = (action.data.player ? `<span class="entity-style">Player</span> to <span class="value-style">&lt;${action.data.player}&gt;</span>` : "");
                    return `<span class="filter-style">Redirect player</span> ${gmredirect} ${playerredirect}`;
                }
            },
            'method': {
                name: "MonksActiveTiles.logic.method",
                ctrls: [
                    {
                        id: "method",
                        name: "MonksActiveTiles.ctrl.method",
                        type: "list",
                        list: () => { return MonksActiveTiles.triggerModes }
                    },
                    {
                        id: "goto",
                        name: "MonksActiveTiles.ctrl.redirect",
                        type: "text",
                    }
                ],
                group: "logic",
                fn: async (args = {}) => {
                    let { action, method } = args;

                    if (method !== action.data.method) {
                        if (action.data.goto)
                            return { goto: action.data.goto };
                        else
                            return { continue: false };
                    }
                },
                content: async (trigger, action) => {
                    let redirect = (action.data.goto ? `everything else to <span class="value-style">&lt;${action.data.goto}&gt;</span>` : "");
                    return `<span class="filter-style">Continue when </span> <span class="entity-style">${MonksActiveTiles.triggerModes[action.data.method]}</span> ${redirect}`;
                }
            },
            /*
            'triggertype': {
                name: "MonksActiveTiles.logic.triggertype",
                ctrls: [
                    {
                        id: "gm",
                        name: "MonksActiveTiles.ctrl.gmredirect",
                        type: "text",
                    },
                    {
                        id: "player",
                        name: "MonksActiveTiles.ctrl.playerredirect",
                        type: "text",
                    }
                ],
                group: "logic",
                fn: async (args = {}) => {
                    let { action, userId } = args;
        
                    let user = game.users.get(userId);
                    if (user.isGM) {
                        if (action.data.gm)
                            return { goto: action.data.gm };
                        else
                            return { continue: false };
                    } else {
                        if (action.data.player)
                            return { goto: action.data.player };
                        else
                            return { continue: false };
                    }
                },
                content: async (trigger, action) => {
                    return `<span class="filter-style">Redirect</span>`;
                }
            },*/
            'anchor': {
                name: "MonksActiveTiles.logic.anchor",
                ctrls: [
                    {
                        id: "tag",
                        name: "MonksActiveTiles.ctrl.name",
                        type: "text",
                        required: true,
                        placeholder: 'Please enter the name of the Landing'
                    },
                    {
                        id: "stop",
                        name: "MonksActiveTiles.ctrl.stopwhenreached",
                        type: "checkbox",
                        defvalue: true
                    }
                ],
                group: "logic",
                fn: async (args = {}) => {
                    const { action } = args;

                    if (action.data.stop)
                        return { continue: false };
                },
                content: async (trigger, action) => {
                    return `<span class="logic-style">${i18n(trigger.name)}:</span> <span class="tag-style">${action.data?.tag}</span>${(action.data?.stop ? ' <i class="fas fa-stop" title="Stop when reached in code"></i>' : '')}`;
                }
            },
            'goto': {
                name: "MonksActiveTiles.logic.goto",
                ctrls: [
                    {
                        id: "tag",
                        name: "MonksActiveTiles.ctrl.name",
                        type: "text",
                        placeholder: "Please enter a Landing name",
                        required: true
                    },
                    {
                        id: "limit",
                        name: "MonksActiveTiles.ctrl.limit",
                        type: "text",
                        check: true,
                    },
                    {
                        id: "rollmode",
                        name: 'MonksActiveTiles.ctrl.rollmode',
                        list: "rollmode",
                        type: "list",
                        conditional: (app) => {
                            return $('input[name="data.limit"]', app.element).val().includes('[[');
                        },
                        defvalue: "roll"
                    },
                    {
                        id: "resume",
                        name: "MonksActiveTiles.ctrl.resume",
                        type: "checkbox",
                        conditional: (app) => {
                            return $('input[name="data.limit"]', app.element).val() != '';
                        }
                    }
                ],
                values: {
                    'rollmode': {
                        "roll": 'MonksActiveTiles.rollmode.public',
                        "gmroll": 'MonksActiveTiles.rollmode.private',
                        "blindroll": 'MonksActiveTiles.rollmode.blind',
                        "selfroll": 'MonksActiveTiles.rollmode.self'
                    },
                },
                group: "logic",
                fn: async (args = {}) => {
                    const { tokens, tile, userId, value, method, action, change } = args;

                    let goto = await getValue(action.data?.tag, args, null, { prop: "" });

                    if (action.data?.limit) {
                        let loop = args.value.loop || {};
                        let loopAction = loop[action.id] || {};

                        let limit = loopAction?.limit ?? await getValue(action.data?.limit, args, null, { prop: "", rollmode: action.data.rollmode });
                        limit = parseInt(limit);
                        if (isNaN(limit))
                            return { goto: goto };

                        loopAction.limit = limit;
                        
                        let loopval = (loopAction.value || 0) + 1;
                        loopAction.value = loopval;
                        loop[action.id]= loopAction;
                        if (loopval >= limit)
                            return { continue: action.data?.resume };
                        else
                            return { goto: goto, loop: loop };
                    } else
                        return { goto: goto };
                },
                content: async (trigger, action, actions) => {
                    return `<span class="logic-style">${i18n(trigger.name)}:</span> <span class="tag-style">${action.data?.tag}</span>${action.data?.limit ? ' limit by <span class="details-style">"' + action.data?.limit + '"</span>' + (action.data?.resume ? ' <i class="fas fa-forward" title="Resume after looping"></i>' : ' <i class="fas fa-stop" title="Stop after looping"></i>') : ''}`;
                }
            },
            'loop': {
                name: "MonksActiveTiles.logic.loop",
                ctrls: [
                    {
                        id: "entity",
                        name: "MonksActiveTiles.ctrl.select-entity",
                        type: "select",
                        subtype: "entity",
                        check: true,
                        options: { hide: ['select'], show: ['within', 'players', 'previous', 'tagger', 'users'] },
                        restrict: (entity) => {
                            return (entity instanceof foundry.canvas.placeables.Tile);
                        }
                    },
                    {
                        id: "collection",
                        name: "Collection",
                        list: "collection",
                        type: "list",
                        onChange: (app, ctrl, action, data) => {
                            let displayName = game.i18n.format("MonksActiveTiles.CurrentCollection", { collection: $(ctrl).val() || "tokens" });
                            $('input[name="data.entity"]', app.element).next().html(displayName);
                        },
                        conditional: (app) => {
                            let entity = $('input[name="data.entity"]', app.element).data("value") || {};
                            return entity?.id == 'previous';
                        },
                        defvalue: 'tokens'
                    },
                    {
                        id: "tag",
                        name: "MonksActiveTiles.ctrl.landingname",
                        type: "text",
                        placeholder: "Please enter a Landing name",
                        required: true
                    },
                    {
                        id: "resume",
                        name: "MonksActiveTiles.ctrl.resumeloop",
                        type: "text",
                    }
                ],
                values: {
                    'collection': {
                        'actors': "Actors",
                        'drawings': "Drawings",
                        'items': "Items",
                        'journal': "Journal Entries",
                        'lights': "Lights",
                        'macros': "Macros",
                        'scene': "Scene",
                        'sounds': "Sounds",
                        'tiles': "Tiles",
                        'tokens': "Tokens",
                        'walls': "Walls",
                        'users': "Users",
                    }
                },
                group: "logic",
                fn: async (args = {}) => {
                    const { tokens, tile, userId, value, method, action, change } = args;

                    let entities = await MonksActiveTiles.getEntities(args, action.data?.collection || "tokens");
                    let _tag = action.data?.tag;

                    let goto = await Promise.all(entities.map(async (e) => {
                        let tag = await getValue(foundry.utils.duplicate(_tag), args, null, { prop: e });
                        return {
                            tag: tag,
                            entities: [e]
                        }
                    })) || [];

                    if (action.data?.resume) {
                        goto.push({ tag: action.data?.resume });
                    }

                    return { goto: goto };
                },
                content: async (trigger, action) => {
                    let ctrl = trigger.ctrls.find(c => c.id == "entity");
                    let entityName = await MonksActiveTiles.entityName(action.data?.entity || ctrl?.defvalue || "previous", action.data?.collection || "tokens");
                    return `<span class="logic-style">${i18n(trigger.name)}:</span> <span class="entity-style">${entityName}</span> through <span class="tag-style">${action.data?.tag}</span> ${(action.data?.resume ? ' <i class="fas fa-forward" title="Resume after looping"></i>' : ' <i class="fas fa-stop" title="Stop after looping"></i>')}`;
                }
            },
            'stop': {
                name: "MonksActiveTiles.logic.stop",
                ctrls: [
                    {
                        id: "entity",
                        name: "MonksActiveTiles.ctrl.select-entity",
                        type: "select",
                        subtype: "entity",
                        options: { show: ['tile', 'previous', 'tagger'] },
                        restrict: (entity) => {
                            return (entity instanceof foundry.canvas.placeables.Tile);
                        },
                        defaultType: "tiles",
                    },
                    /*{
                        id: "resume",
                        name: "Resume after clearing actions",
                        type: "checkbox",
                        defvalue: false
                    }*/
                ],
                group: "logic",
                fn: async (args = {}) => {
                    let { tile, action } = args;

                    let entities = await MonksActiveTiles.getEntities(args, "tiles");

                    if (entities.length) {
                        for (let entity of entities) {
                            if (tile.id == entity.id)
                                return { continue: false, allowdisabled: false }; //, resume: action.data.resume };
                            else if (game.user.isGM) {
                                entity.setFlag('monks-active-tiles', 'continue', false);
                                entity.setFlag('monks-active-tiles', 'allowdisabled', false);
                                //entity.setFlag('monks-active-tiles', 'resume', action.data.resume);
                            }
                            if (entity._resumeTimer)
                                window.clearTimeout(entity._resumeTimer);
                        }
                    }
                },
                content: async (trigger, action) => {
                    let ctrl = trigger.ctrls.find(c => c.id == "entity");
                    let entityName = await MonksActiveTiles.entityName(action.data?.entity || ctrl?.defvalue || "previous", "tiles");
                    return `<span class="logic-style">${i18n(trigger.name)}</span> for <span class="entity-style">${entityName}</span>`;
                }
            },
            'stoptriggers': {
                name: "MonksActiveTiles.logic.stoptriggers",
                ctrls: [
                ],
                group: "logic",
                fn: async (args = {}) => {
                    let { tile, action } = args;

                    return { stoptriggers: true };
                },
                content: async (trigger, action) => {
                    return `<span class="logic-style">${i18n(trigger.name)}</span>`;
                }
            }
        }
    }
}

Hooks.on("setupTileActions", (app) => {
    if (game.modules.get('forien-quest-log')?.active) {
        app.registerTileGroup('forien-quest-log', "Forien's Quest Log");
        app.registerTileAction('forien-quest-log', 'openfql', {
            name: 'Open FQL Quest Log',
            ctrls: [
                {
                    id: "for",
                    name: "For",
                    list: "for",
                    type: "list",
                    subtype: "for",
                    defvalue: "trigger"
                }
            ],
            values: {
                'for': {
                    "everyone": "MonksActiveTiles.for.all",
                    "players": "MonksActiveTiles.for.players",
                    "gm": "MonksActiveTiles.for.gm",
                    "trigger": "MonksActiveTiles.for.triggering",
                    "token": "MonksActiveTiles.for.token",
                    "owner": "MonksActiveTiles.for.owner",
                    "previous": "MonksActiveTiles.for.current"
                }
            },
            group: 'forien-quest-log',
            fn: async (args = {}) => {
                const { action, userId } = args;

                let showto = action.data.for || "trigger";
                let showUsers = MonksActiveTiles.getForPlayers(showto, args);

                if (showUsers.includes(game.user.id)) {
                    if (MonksActiveTiles.allowRun)
                        Hooks.call('ForienQuestLog.Open.QuestLog');
                    showUsers = showUsers.filter(u => u != game.user.id);
                }

                if (showUsers.length)
                    MonksActiveTiles.emit('fql', { users: showUsers, userId: userId });
            },
            content: async (trigger, action) => {
                return `<span class="logic-style">${trigger.name}</span> for <span class="value-style">&lt;${MonksActiveTiles.forPlayersName(action.data?.for || "trigger")}&gt;</span>`;
            }
        });
        app.registerTileAction('forien-quest-log', 'openquest', {
            name: 'Open FQL Quest',
            ctrls: [
                {
                    id: "quest",
                    name: "Quest",
                    list: () => {
                        const fqlAPI = game.modules.get('forien-quest-log').public.QuestAPI;
                        let result = {};

                        for (let quest of fqlAPI.DB.getAllQuests()) {
                            result[quest._id] = quest._name;
                        }

                        return result;
                    },
                    type: "list",
                    required: true
                },
                {
                    id: "for",
                    name: "For",
                    list: "for",
                    type: "list",
                    subtype: "for",
                    defvalue: "trigger"
                }
            ],
            values: {
                'for': {
                    "everyone": "MonksActiveTiles.for.all",
                    "players": "MonksActiveTiles.for.players",
                    "gm": "MonksActiveTiles.for.gm",
                    "trigger": "MonksActiveTiles.for.triggering",
                    "token": "MonksActiveTiles.for.token",
                    "owner": "MonksActiveTiles.for.owner",
                    "previous": "MonksActiveTiles.for.current"
                }
            },
            group: 'forien-quest-log',
            fn: async (args = {}) => {
                const { action, userId } = args;

                let showto = action.data.for || "trigger";
                let showUsers = MonksActiveTiles.getForPlayers(showto, args);

                if (showUsers.includes(game.user.id)) {
                    if (MonksActiveTiles.allowRun) {
                        const fqlAPI = game.modules.get('forien-quest-log').public.QuestAPI;
                        fqlAPI.open({ questId: action.data.quest });
                    }
                    showUsers = showUsers.filter(u => u != game.user.id);
                }

                if (showUsers.length)
                    MonksActiveTiles.emit('fql', { users: showUsers, quest: action.data.quest });

            },
            content: async (trigger, action) => {
                return `<span class="logic-style">${trigger.name}</span> "${trigger.ctrls[0].list()[action.data.quest]}" for <span class="value-style">&lt;${MonksActiveTiles.forPlayersName(action.data?.for || "trigger")}&gt;</span>`;
            }
        });
    }

    if (game.modules.get('kandashis-fluid-canvas')?.active) {
        app.registerTileGroup('kandashis-fluid-canvas', "Kandashi's Fluid Canvas");
        app.registerTileAction('kandashis-fluid-canvas', 'execute', {
            name: 'Execute Effect',
            ctrls: [
                {
                    id: "effect",
                    name: "Effect",
                    list: "effect",
                    type: "list",
                    check: true,
                },
                {
                    id: "for",
                    name: "For",
                    list: "for",
                    type: "list",
                    subtype: "for",
                    conditional: (app) => {
                        return ["drug", "sepia", "drug", "negative", "blur"].includes($('select[name="data.effect"]', app.element).val());
                    },
                    defvalue: "trigger"
                },
                {
                    id: "intensity",
                    name: "Intensity",
                    type: "number",
                    defvalue: 2,
                    required: true,
                    conditional: (app) => {
                        return ["earthquake", "heartbeat", "drug", "spin", "blur"].includes($('select[name="data.effect"]', app.element).val());
                    }
                },
                {
                    id: "duration",
                    name: "Duration (ms)",
                    type: "number",
                    defvalue: 1000,
                    required: true,
                    conditional: (app) => {
                        return ["earthquake", "heartbeat", "spin", "drug"].includes($('select[name="data.effect"]', app.element).val());
                    }
                },
                {
                    id: "iteration",
                    name: "Iteration",
                    type: "number",
                    defvalue: 3,
                    required: true,
                    conditional: (app) => {
                        return ["earthquake", "heartbeat", "spin", "drug"].includes($('select[name="data.effect"]', app.element).val());
                    }
                },
            ],
            values: {
                'effect': {
                    "earthquake": 'KFC.earthquake',
                    "heartbeat": 'KFC.heartBeat',
                    "drug": 'KFC.drug',
                    "spin": 'KFC.spin',
                    "fade": 'KFC.fade',
                    "sepia": 'KFC.sepia',
                    "negative": 'KFC.negative',
                    "blur": 'KFC.blur'
                },
                'for': {
                    "everyone": "MonksActiveTiles.for.all",
                    "players": "MonksActiveTiles.for.players",
                    "gm": "MonksActiveTiles.for.gm",
                    "trigger": "MonksActiveTiles.for.triggering",
                    "token": "MonksActiveTiles.for.token",
                    "owner": "MonksActiveTiles.for.owner",
                    "previous": "MonksActiveTiles.for.current"
                }
            },
            group: 'kandashis-fluid-canvas',
            fn: async (args = {}) => {
                const { action, userId } = args;

                if (["earthquake", "heartbeat", "spin"].includes(action.data.effect))
                    KFC.executeForEveryone(action.data.effect, action.data.intensity, action.data.duration, action.data.iteration);
                else {
                    let users = MonksActiveTiles.getForPlayers(action.data.for || "trigger", args);
                    KFC.executeAsGM(action.data.effect, users, action.data.intensity, action.data.duration, action.data.iteration);
                }

            },
            content: async (trigger, action) => {
                return `<span class="logic-style">${trigger.name}</span> <span class="details-style">"${i18n(trigger.values.effect[action.data?.effect])}"</span> for <span class="value-style">&lt;${MonksActiveTiles.forPlayersName(action.data?.for || "trigger")}&gt;</span>`;
            }
        });
    }

    if (game.modules.get('tagger')?.active) {
        app.registerTileGroup('tagger', "Tagger");
        app.registerTileAction('tagger', 'execute', {
            name: 'Alter Tag',
            ctrls: [
                {
                    id: "entity",
                    name: "MonksActiveTiles.ctrl.select-entity",
                    type: "select",
                    subtype: "entity",
                    check: true,
                    options: { show: ['tile', 'token', 'within', 'players', 'previous', 'tagger'] },
                    restrict: (entity) => { 
                        return (
                            entity instanceof foundry.canvas.placeables.Token ||
                            entity instanceof foundry.canvas.placeables.Tile ||
                            entity instanceof foundry.canvas.placeables.Drawing ||
                            entity instanceof foundry.canvas.placeables.AmbientLight ||
                            entity instanceof foundry.canvas.placeables.AmbientSound ||
                            entity instanceof foundry.canvas.placeables.Note ||
                            entity instanceof foundry.canvas.placeables.Wall);
                    }
                },
                {
                    id: "collection",
                    name: "Collection",
                    list: "collection",
                    type: "list",
                    onChange: (app, ctrl, action, data) => {
                        let displayName = game.i18n.format("MonksActiveTiles.CurrentCollection", { collection: $(ctrl).val() || "tokens" });
                        $('input[name="data.entity"]', app.element).next().html(displayName);
                    },
                    conditional: (app) => {
                        let entity = $('input[name="data.entity"]', app.element).data("value") || {};
                        return entity?.id == 'previous';
                    },
                    defvalue: 'tokens'
                },
                {
                    id: "tag",
                    name: "MonksActiveTiles.ctrl.tag",
                    type: "text",
                    required: true
                },
                {
                    id: "state",
                    name: "MonksActiveTiles.ctrl.state",
                    list: "state",
                    type: "list",
                    defvalue: 'add'
                },

            ],
            values: {
                'state': {
                    'add': "MonksActiveTiles.state.add",
                    'remove': "MonksActiveTiles.state.remove",
                    'toggle': "MonksActiveTiles.state.toggle"
                },
                'collection': {
                    'drawings': "Drawings",
                    'tiles': "Tiles",
                    'tokens': "Tokens",
                    'walls': "Walls",
                    'notes': "Notes",
                    'lights': "Lights",
                    'sounds': "Sounds",
                }
            },
            group: 'tagger',
            fn: async (args = {}) => {
                const { tile, tokens, action, userId, value, method, change } = args;

                let entities = await MonksActiveTiles.getEntities(args, action.data?.collection || "tokens");
                if (entities.length) {
                    let tag = await getValue(action.data.tag, args);

                    /*
                    let context = {
                        actor: tokens[0]?.actor?.toObject(false),
                        token: tokens[0]?.toObject(false),
                        tile: tile.toObject(),
                        variable: foundry.utils.getProperty(tile, "flags.monks-active-tiles.variables") || {},
                        user: game.users.get(userId),
                        value: value,
                        scene: canvas.scene,
                        method: method,
                        change: change
                    };

                    if (typeof tag == "string" && tag.includes("{{")) {
                        const compiled = Handlebars.compile(tag);
                        tag = compiled(context, { allowProtoMethodsByDefault: true, allowProtoPropertiesByDefault: true }).trim();
                    }
                    */

                    if (action.data.state == 'add')
                        await Tagger.addTags(entities, tag);
                    else if (action.data.state == 'remove')
                        await Tagger.removeTags(entities, tag);
                    else if (action.data.state == 'toggle')
                        await Tagger.toggleTags(entities, tag);
                }

                let result = {};
                MonksActiveTiles.addToResult(entities, result);

                return result;
            },
            content: async (trigger, action) => {
                let ctrl = trigger.ctrls.find(c => c.id == "entity");
                let entityName = await MonksActiveTiles.entityName(action.data?.entity || ctrl?.defvalue || "previous");
                return `<span class="action-style">Tagger</span> <span class="details-style">"${i18n(trigger.values.state[action.data?.state])}"</span> <span class="value-style">&lt;${action.data.tag}&gt;</span> to <span class="entity-style">${entityName}</span>`;
            }
        });
    }

    if (game.modules.get('confetti')?.active) {
        app.registerTileGroup('confetti', "Confetti");
        app.registerTileAction('confetti', 'shoot', {
            name: 'Shoot Confetti',
            ctrls: [
                {
                    id: "strength",
                    name: "Confetti Strength",
                    list: "strength",
                    type: "list",
                    defvalue: 2
                }
            ],
            values: {
                'strength': {
                    0: "Low",
                    1: "Medium",
                    2: "High"
                }
            },
            group: 'confetti',
            fn: async (args = {}) => {
                const { action, userId } = args;

                const shootConfettiProps = window.confetti.getShootConfettiProps(parseInt(action.data.strength));
                window.confetti.shootConfetti(shootConfettiProps);

                return {};
            },
            content: async (trigger, action) => {
                return `<span class="action-style">Shoot Confetti</span> <span class="details-style">"${i18n(trigger.values.strength[action.data?.strength])}"</span>`;
            }
        });
    }

    if (game.modules.get('celebrate')?.active) {
        app.registerTileGroup('celebrate', "Celebrate");
        app.registerTileAction('celebrate', 'shoot', {
            name: 'Shoot Confetti',
            ctrls: [
                {
                    id: "strength",
                    name: "Confetti Strength",
                    list: "strength",
                    type: "list",
                    defvalue: 2
                }
            ],
            values: {
                'strength': {
                    0: "Low",
                    1: "Medium",
                    2: "High"
                }
            },
            group: 'celebrate',
            fn: async (args = {}) => {
                const { action, userId } = args;

                const shootConfettiProps = game.modules.get("celebrate").api.getShootConfettiProps(parseInt(action.data.strength));
                game.modules.get("celebrate").api.shootConfetti(shootConfettiProps);

                return {};
            },
            content: async (trigger, action) => {
                return `<span class="action-style">Shoot Confetti</span> <span class="details-style">"${i18n(trigger.values.strength[action.data?.strength])}"</span>`;
            }
        });
    }

    if (game.modules.get('fxmaster')?.active) {
        app.registerTileGroup('fxmaster', "FXMaster");
        app.registerTileAction('fxmaster', 'weather', {
            name: 'Weather Effects',
            ctrls: [
                {
                    id: "effect",
                    name: "Effect",
                    list: () => {
                        let list = [];
                        let effects = CONFIG.fxmaster.particleEffects;

                        for (let [key, effect] of Object.entries(effects)) {
                            let group = list.find((k) => k.id == effect.group);
                            if (!group) {
                                group = { id: effect.group, text: `FXMASTER.ParticleEffectsGroup${effect.group.titleCase()}`, groups: {} };
                                list.push(group);
                            }

                            group.groups[key] = effect.label;
                        }
                        return list;
                    },
                    type: "list",
                    check: true,
                },
                {
                    id: "scale",
                    name: "Scale",
                    type: "number",
                    defvalue: 1,
                    step: 0.1,
                    min: 0.1,
                    max: 5,
                    required: true,
                },
                {
                    id: "direction",
                    name: "Direction",
                    type: "number",
                    defvalue: 90,
                    step: 5,
                    min: 0,
                    max: 360,
                    conditional: (app) => {
                        return ["weather:snowstorm", "weather:clouds", "weather:rainsimple", "weather:raintop", "weather:rain", "weather:snow"].includes($('select[name="data.effect"]', app.element).val());
                    }
                },
                {
                    id: "speed",
                    name: "Speed",
                    type: "number",
                    defvalue: 1,
                    step: 0.1,
                    min: 0.1,
                    max: 5,
                    required: true,
                },
                {
                    id: "lifetime",
                    name: "Lifetime",
                    type: "number",
                    defvalue: 1,
                    step: 0.1,
                    min: 0.1,
                    max: 5,
                    required: true,
                },
                {
                    id: "density",
                    name: "Density",
                    type: "number",
                    defvalue: 0.05,
                    step: 0.005,
                    min: 0.005,
                    max: 0.1,
                    conditional: (app) => {
                        return ["weather:snowstorm", "other:bubbles", "other:embers", "weather:rainsimple", "other:stars", "animals:crows", "animals:bats", "animals:spiders", "weather:fog", "weather:raintop", "animals:birds", "weather:leaves", "weather:rain", "weather:snow", "animals:eagles"].includes($('select[name="data.effect"]', app.element).val());
                    }
                },
            ],
            group: 'fxmaster',
            fn: async (args = {}) => {
                const { action, userId } = args;

                let parts = action.data.effect.split(":");

                Hooks.call("fxmaster.switchParticleEffect", {
                    name: `monksactivetiles:${parts[1]}`,
                    type: parts[1],
                    options: {
                        scale: action.data.scale,
                        direction: action.data.direction,
                        speed: action.data.speed,
                        lifetime: action.data.lifetime,
                        density: action.data.density
                    }
                });
            },
            content: async (trigger, action) => {
                let parts = action.data.effect.split(":");
                let effect = CONFIG.fxmaster.particleEffects[parts[1]];
                return `<span class="action-style">Weather Effect</span> <span class="details-style">"${i18n(effect.label)}"</span>`;
            }
        });
        app.registerTileAction('fxmaster', 'clear', {
            name: 'Clear all effects',
            group: 'fxmaster',
            fn: async (args = {}) => {
                const { action, userId, tile } = args;

                tile.parent.unsetFlag("fxmaster", "effects");
            },
            content: async (trigger, action) => {
                return `<span class="action-style">Clear all Weather Effect</span>`;
            }
        });
    }
    if (game.modules.get('party-inventory')?.active) {
        app.registerTileGroup('party-inventory', "Party Inventory");
        app.registerTileAction('party-inventory', 'open-window', {
            name: 'Open Party Inventory',
            ctrls: [
                {
                    id: "for",
                    name: "MonksActiveTiles.ctrl.for",
                    list: "for",
                    type: "list",
                    subtype: "for",
                    defvalue: "everyone"
                }
            ],
            values: {
                'for': {
                    "everyone": "MonksActiveTiles.for.all",
                    "players": "MonksActiveTiles.for.players",
                    "gm": "MonksActiveTiles.for.gm",
                    "trigger": "MonksActiveTiles.for.triggering",
                    "token": "MonksActiveTiles.for.token",
                    "owner": "MonksActiveTiles.for.owner",
                    "previous": "MonksActiveTiles.for.current"
                }
            },
            group: 'party-inventory',
            fn: async (args = {}) => {
                const { action, userId, tokens } = args;

                let showto = action.data.for || "everyone";
                let showUsers = MonksActiveTiles.getForPlayers(showto, args);

                if (showUsers.includes(game.user.id)) {
                    if (MonksActiveTiles.allowRun) {
                        game.modules.get("party-inventory").api.openWindow();
                    }
                    showUsers = showUsers.filter(u => u != game.user.id);
                }
                if (showUsers.length)
                    MonksActiveTiles.emit('party-inventory', { users: showUsers });

            },
            content: async (trigger, action) => {
                return `<span class="logic-style">${trigger.name}</span> for <span class="value-style">&lt;${MonksActiveTiles.forPlayersName(action.data?.for || "everyone")}&gt;</span>`;
            }
        });
    }

    if (game.modules.get("dfreds-convenient-effects")?.active) {
        app.registerTileGroup('dfreds-convenient-effects', "DFred's Convenient Effects");

        app.registerTileAction('dfreds-convenient-effects', 'dfreds-add', {
            name: 'Convenient Effect',
            group: 'dfreds-convenient-effects',
            ctrls: [
                {
                    id: "entity",
                    name: "MonksActiveTiles.ctrl.select-entity",
                    type: "select",
                    subtype: "entity",
                    options: { show: ['token', 'within', 'players', 'previous', 'tagger'] },
                    restrict: (entity) => {
                        return (entity instanceof foundry.canvas.placeables.Token);
                    }
                },
                {
                    id: "effect",
                    name: "Effect",
                    type: "list",
                    required: true,
                    defvalue: "",
                    list: () => {
                        return game.dfreds.effects.all.map((effect) => {
                            return i18n(effect.name);
                        }).sort((a, b) => a.localeCompare(b));
                    },
                },
                {
                    id: "state",
                    name: "MonksActiveTiles.ctrl.state",
                    list: "state",
                    type: "list",
                    defvalue: 'add'
                }
            ],
            values: {
                'state': {
                    'add': "MonksActiveTiles.state.add",
                    'remove': "MonksActiveTiles.state.remove",
                    'toggle': "MonksActiveTiles.state.toggle"
                }
            },
            fn: async (args = {}) => {

                const { action } = args;
                const entities = await MonksActiveTiles.getEntities(args);

                const foundEffect = game.dfreds.effectInterface.findEffectByName(action.data.effect);

                if (entities.length && foundEffect) {
                    if (action.data.state == "toggle")
                        await game.dfreds.effectInterface.toggleEffect(action.data.effect, { uuids: entities.map(e => e.uuid) });
                    else {
                        for (let entity of entities) {
                            await game.dfreds.effectInterface[action.data.state + "Effect"]({ effectName: action.data.effect, uuid: entity.uuid });
                        }
                    }
                }

                return { tokens: entities };

            },
            content: async (trigger, action) => {
                return `<span class="action-style">Convenient Effect </span> <span class="details-style">${i18n(trigger.values.state[action.data?.state])}</span> <span class="value-style">&lt;${action.data.effect}&gt;</span>`;
            }
        });

        app.registerTileAction('dfreds-convenient-effects', 'dfreds-filter', {
            name: "Filter by convenient effect",
            group: 'dfreds-convenient-effects',
            ctrls: [
                {
                    id: "entity",
                    name: "MonksActiveTiles.ctrl.select-entity",
                    type: "select",
                    subtype: "entity",
                    options: { show: ['token', 'within', 'players', 'previous', 'tagger'] },
                    restrict: (entity) => {
                        return (entity instanceof foundry.canvas.placeables.Token);
                    }
                },
                {
                    id: "effect",
                    name: "Effect",
                    type: "list",
                    required: true,
                    defvalue: "",
                    list: () => {
                        return game.dfreds.effects.all.map((effect) => {
                            return i18n(effect.name);
                        }).sort((a, b) => a.localeCompare(b));
                    },
                },
                {
                    id: "filter",
                    name: "Check If They",
                    list: "filter",
                    type: "list",
                    defvalue: 'yes'
                },
                {
                    id: "continue",
                    name: "Continue if",
                    list: "continue",
                    type: "list",
                    defvalue: 'always'
                }
            ],
            values: {
                "filter": {
                    "yes": "Has Effect",
                    "no": "Doesn't Have Effect",
                },
                'continue': {
                    "always": "Always",
                    "any": "Any Matches",
                    "all": "All Matches",
                }
            },
            fn: async (args = {}) => {

                const { action, value } = args;

                const entities = await MonksActiveTiles.getEntities(args);

                const match = action.data?.filter === "yes";
                const tokens = entities.filter(token => {
                    return token instanceof TokenDocument
                        && (match === game.dfreds.effectInterface.hasEffectApplied(action.data.effect, token.uuid));
                });

                const cont = (action.data?.continue === 'always'
                    || (action.data?.continue === 'any' && tokens.length > 0)
                    || (action.data?.continue === 'all' && tokens.length === value["tokens"].length && tokens.length > 0));

                return { continue: cont, tokens: tokens };

            },
            content: async (trigger, action) => {
                let ctrl = trigger.ctrls.find(c => c.id == "entity");
                let entityName = await MonksActiveTiles.entityName(action.data?.entity || ctrl?.defvalue || "previous");
                let html = `<span class="filter-style">Filter</span> <span class="entity-style">${entityName}</span> that`;
                html += (action.data.filter === "yes" ? " has " : " doesn't have ");
                html += `<span class="value-style">&lt;${action.data.effect}&gt;</span>`
                html += (action.data?.continue !== 'always' ? ', Continue if ' + (action.data?.continue === 'any' ? 'Any Matches' : 'All Matches') : '');
                return html;
            }
        });
    }
});