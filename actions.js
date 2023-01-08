import { MonksActiveTiles, log, error, actiontext, debug, warn, setting, i18n, makeid, rollDice } from './monks-active-tiles.js';
import { BatchManager } from "./classes/BatchManager.js";

export class ActionManager {
    static get actions() {
        return {
            'pause': {
                name: "MonksActiveTiles.action.pause",
                //options: { allowDelay: true },
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
                    game.togglePause((action?.data?.pause == "toggle" ? null : (action?.data?.pause !== 'unpause')), true);
                },
                content: async (trigger, action) => {
                    return actiontext("MonksActiveTiles.actiontext.pause", { pause: i18n(trigger.values.state[action?.data?.pause || 'pause']) });
                }
            },
            'delay': {
                name: "MonksActiveTiles.action.delay",
                group: "logic",
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
                        time = (Math.floor(Math.random() * (parseFloat(parts[1]) - parseFloat(parts[0]))) + parseFloat(parts[0])) * 1000;
                    } else {
                        time = await rollDice(time);
                        time = parseFloat(time) * 1000;
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
                        type: "checkbox"
                    }
                ],
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
                        options: { showToken: true, showPlayers: true, showPrevious: true },
                        restrict: (entity) => { return (entity instanceof Tile || entity instanceof Token); },
                        required: true
                    },
                    {
                        id: "animate",
                        name: "MonksActiveTiles.ctrl.animate",
                        type: "checkbox",
                        onClick: (app) => {
                            app.checkConditional();
                        }
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
                        type: "list"
                    }
                ],
                values: {
                    'panfor': {
                        'all': "MonksActiveTiles.showto.everyone",
                        'gm': "MonksActiveTiles.showto.gm",
                        'players': "MonksActiveTiles.showto.players",
                        'token': "MonksActiveTiles.showto.trigger"

                    }
                },
                fn: async (args = {}) => {
                    const { tile, action, userid, value } = args;
                    let panfor = action.data.panfor || 'trigger';

                    let dests = await MonksActiveTiles.getLocation.call(tile, action.data.location, value, { userid });

                    for (let dest of dests) {
                        if (dest.scene != undefined && dest.scene != canvas.scene.id)
                            return;

                        dest.duration = (action.data?.duration ?? 1) * 1000;

                        if (typeof dest.x == "string" && (dest.x.startsWith("+") || dest.x.startsWith("-"))) {
                            dest.x = parseInt(eval(`${canvas.scene._viewPosition.x} ${dest.x}`));
                        }
                        if (typeof dest.y == "string" && (dest.y.startsWith("+") || dest.y.startsWith("-"))) {
                            dest.y = parseInt(eval(`${canvas.scene._viewPosition.y} ${dest.y}`));
                        }

                        if (["all", "players"].includes(panfor) || (panfor == "token" && userid != game.user.id)) {
                            MonksActiveTiles.emit('pan',
                                {
                                    userid: (panfor == 'token' ? userid : null),
                                    animate: action.data.animate,
                                    x: dest.x,
                                    y: dest.y,
                                    scale: dest.scale,
                                    duration: dest.duration
                                });
                        }

                        if (panfor == "all" || (panfor == "gm" && game.user.isGM) || (panfor == "token" && userid == game.user.id) || (panfor == "owner" && owners.includes(game.user.id))) {
                            if (action.data.animate)
                                await canvas.animatePan(dest);
                            else
                                canvas.pan(dest);
                        }
                    }
                },
                content: async (trigger, action) => {
                    let locationName = await MonksActiveTiles.locationName(action.data?.location);
                    return `<span class="action-style">${i18n(trigger.name)}</span> to <span class="details-style">"${locationName}"</span> for <span class="value-style">&lt;${i18n(trigger.values.panfor[action.data?.panfor])}&gt;</span>${(action.data.animate ? ' <i class="fas fa-sign-in-alt" title="Animate"></i>' : '')}`;
                }
            },
            'teleport': {
                name: "MonksActiveTiles.action.teleport",
                options: { allowDelay: true },
                stop: true,
                ctrls: [
                    {
                        id: "entity",
                        name: "MonksActiveTiles.ctrl.select-entity",
                        type: "select",
                        subtype: "entity",
                        options: { showToken: true, showWithin: true, showPlayers: true, showPrevious: true },
                        restrict: (entity) => { return (entity instanceof Token); }
                    },
                    {
                        id: "location",
                        name: "MonksActiveTiles.ctrl.select-coordinates",
                        type: "select",
                        subtype: "either",
                        onChange: (app) => {
                            app.checkConditional();
                        },
                        options: { showTagger: true, showPrevious: true },
                        restrict: (entity) => { return (entity instanceof Tile); },
                        required: true,
                        placeholder: 'Select a location or Tile'
                    },
                    {
                        id: "position",
                        name: "MonksActiveTiles.ctrl.positioning",
                        list: "position",
                        type: "list",
                        conditional: (app) => {
                            let entity = JSON.parse($('input[name="data.location"]', app.element).val() || "{}");
                            return /^Scene.[a-zA-Z0-9]{16}.Tile.[a-zA-Z0-9]{16}$/.test(entity?.id) || (entity?.id || "").startsWith("tagger");
                        },
                        defaultVal: "random"
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
                    const { tile, action, userid, value } = args;

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

                    let dests = await MonksActiveTiles.getLocation.call(tile, action.data.location, value);
                    for (let tokendoc of entities) {
                        let tokenWidth = ((tokendoc.parent.dimensions.size * Math.abs(tokendoc.width)) / 2);
                        let tokenHeight = ((tokendoc.parent.dimensions.size * Math.abs(tokendoc.height)) / 2);

                        let oldPos = {
                            x: tokendoc.x + tokenWidth,
                            y: tokendoc.y + tokenHeight
                        }

                        let dest = dests.pickRandom(tile.id);
                        if (!dest)
                            continue;

                        if (dest.x && typeof dest.x == "string" && dest.x.indexOf('-') > 1) {
                            let parts = dest.x.split("-");
                            let min = parseInt(parts[0]);
                            let max = parseInt(parts[1]);
                            dest.x = min + (Math.random() * (max - min));
                        }

                        if (dest.y && typeof dest.y == "string" && dest.y.indexOf('-') > 1) {
                            let parts = dest.y.split("-");
                            let min = parseInt(parts[0]);
                            let max = parseInt(parts[1]);
                            dest.y = min + (Math.random() * (max - min));
                        }

                        if (dest.x && typeof dest.x == "string" && (dest.x.startsWith("+") || dest.x.startsWith("-"))) {
                            dest.x = parseInt(eval(`${tokendoc.x} ${dest.x}`));
                        }
                        if (dest.y && typeof dest.y == "string" && (dest.y.startsWith("+") || dest.y.startsWith("-"))) {
                            dest.y = parseInt(eval(`${tokendoc.y} ${dest.y}`));
                        }

                        if (dest.dest instanceof TileDocument) {
                            if (action.data.position == "center") {
                                dest.x = dest.dest.x + (dest.dest.width / 2);
                                dest.y = dest.dest.y + (dest.dest.height / 2);
                            } else if (action.data.position == "relative") {
                                dest.x = dest.dest.x + (dest.dest.width / 2) + (oldPos.x - oldTile.x);
                                dest.y = dest.dest.y + (dest.dest.height / 2) + (oldPos.y - oldTile.y);
                            } else {
                                // Find a random location within this Tile
                                dest.x = dest.dest.x + Math.floor((Math.random() * Math.abs(dest.dest.width)));
                                dest.y = dest.dest.y + Math.floor((Math.random() * Math.abs(dest.dest.height)));
                            }
                        }

                        if (!dest.x || !dest.y)
                            return;

                        //move the token to the new square
                        let newPos = {
                            x: dest.x,
                            y: dest.y
                        };

                        let samescene = (dest.scene == undefined || dest.scene == tokendoc.parent.id);
                        //await tokendoc.setFlag('monks-active-tiles', 'teleporting', true);

                        if (samescene) {
                            await tokendoc._object?.stopAnimation();   //+++ need to stop the animation for everyone, even if they're not on the same scene
                            if (!tokendoc.parent.dimensions.rect.contains(newPos.x, newPos.y)) {
                                //+++find the closest spot on the edge of the scene
                                ui.notifications.error(i18n("MonksActiveTiles.msg.prevent-teleport"));
                                return;
                            }

                            //find a vacant spot
                            if (action.data.avoidtokens)
                                newPos = MonksActiveTiles.findVacantSpot(newPos, tokendoc, tokendoc.parent, newTokens, dest, action.data.remotesnap);

                            newPos.x -= tokenWidth;
                            newPos.y -= tokenHeight;

                            if (action.data.remotesnap) {
                                newPos.x = newPos.x.toNearest(tokendoc.parent.dimensions.size);
                                newPos.y = newPos.y.toNearest(tokendoc.parent.dimensions.size);
                            }

                            let offset = { dx: oldPos.x - newPos.x, dy: oldPos.y - newPos.y };

                            //fade in backdrop
                            if (userid != game.user.id) {
                                if (setting('teleport-wash')) {
                                    MonksActiveTiles.emit('fade', { userid: userid, colour: action.data.colour || setting("teleport-colour") });
                                    timeout = true;
                                }

                                offsetPans.push({ userid: userid, animatepan: action.data.animatepan, x: offset.dx - (Math.abs(tokendoc.width) / 2), y: offset.dy - (Math.abs(tokendoc.height) / 2) });
                                //MonksActiveTiles.emit('offsetpan', { userid: userid, animatepan: action.data.animatepan, x: offset.dx - (Math.abs(tokendoc.width) / 2), y: offset.dy - (Math.abs(tokendoc.height) / 2) });
                            }

                            newTokens.push({ data: { x: newPos.x, y: newPos.y, width: tokendoc.width, height: tokendoc.height } });

                            batch.add("update", tokendoc, { x: newPos.x, y: newPos.y, 'flags.monks-active-tiles.teleporting': true, 'flags.monks-active-tiles.current': true }, { bypass: true, animate: false, teleport: true, animation: { duration: 0 } } )
                            //await tokendoc.update({ x: newPos.x, y: newPos.y }, { bypass: true, animate: false, teleport: true });
                        } else {
                            result.tokens = [];
                            //if the end spot is on a different scene then hide this token, check the new scene for a token for that actor and move it, otherwise create the token on the new scene

                            if (userid != game.user.id && setting('teleport-wash')) {
                                MonksActiveTiles.emit('fade', { userid: userid, time: 1000, colour: action.data.colour || setting("teleport-colour") });
                                //await MonksActiveTiles.timeout(400);
                            }

                            let scene = game.scenes.get(dest.scene);
                            let newtoken = (tokendoc.actor?.id && tokendoc.actorLink ? scene.tokens.find(t => { return t.actor?.id == tokendoc.actor?.id }) : null);

                            //find a vacant spot
                            if (action.data.avoidtokens)
                                newPos = MonksActiveTiles.findVacantSpot(newPos, tokendoc, scene, newTokens, dest, action.data.remotesnap);

                            newPos.x -= tokenWidth;
                            newPos.y -= tokenHeight;

                            if (action.data.remotesnap) {
                                newPos.x = newPos.x.toNearest(tokendoc.parent.dimensions.size);
                                newPos.y = newPos.y.toNearest(tokendoc.parent.dimensions.size);
                            }

                            let td = mergeObject(await tokendoc.toObject(), { x: newPos.x, y: newPos.y, 'flags.monks-active-tiles.teleporting': true, 'flags.monks-active-tiles.current': true });
                            if (newtoken) {
                                batch.add("update", newtoken, (action.data.preservesettings ?
                                    { x: newPos.x, y: newPos.y, img: tokendoc.texture.src, hidden: tokendoc.hidden, 'flags.monks-active-tiles.teleporting': true, 'flags.monks-active-tiles.current': true } : td),
                                    { bypass: true, animate: false, teleport: true });
                                //await newtoken.update((action.data.preservesettings ? { x: newPos.x, y: newPos.y, hidden: tokendoc.hidden } : td), { bypass: true, animate: false, teleport: true });
                            } else {
                                batch.add("create", cls, td, { parent: scene });
                                //newtoken = await cls.create(td, { parent: scene });
                            }

                            newTokens.push({ data: { x: newPos.x, y: newPos.y, width: tokendoc.width, height: tokendoc.height } });

                            //await newtoken.unsetFlag('monks-active-tiles', 'teleporting');

                            //let oldhidden = tokendoc.hidden;
                            if (action.data.deletesource)
                                batch.add("delete", tokendoc);
                            else
                                batch.add("update", tokendoc, { hidden: true });   //hide the old one
                            //batch.add("update", newtoken, { hidden: oldhidden, img: tokendoc.img });   //preserve the image, and hiddenness of the old token

                            let owners = game.users.filter(u => {
                                return !u.isGM && u.character && u.character.id == tokendoc.actor?.id;
                            }).map(u => u.id);
                            if (!game.user.isGM && userid != game.user.id && !owners.includes(game.user.id))
                                owners.push(game.user.id);
                            if (owners.length) {
                                //pass this back to the player
                                switchViews.push({ userid: [owners], sceneid: scene.id, newpos: newPos, oldpos: oldPos })
                                //MonksActiveTiles.emit('switchview', { userid: [owners], sceneid: scene.id, newpos: newPos, oldpos: oldPos });
                            }
                            ui.notifications.warn(`${tokendoc.name} has teleported to ${scene.name}`);

                            //result.tokens.push(newtoken);
                        }
                        //if (tokendoc && (samescene || !action.data.deletesource))
                        //    await tokendoc.unsetFlag('monks-active-tiles', 'teleporting');
                    }

                    if (timeout)
                        await MonksActiveTiles.timeout(400);

                    for (let offsetPan of offsetPans)
                        MonksActiveTiles.emit('offsetpan', offsetPan);

                    await batch.execute().then((results) => {
                        let merged = batch.mergeResults(results);
                        let tokens = merged.filter(t => { return t.flags["monks-active-tiles"]?.teleporting; });
                        tokens.forEach((t) => {
                            batch.add("update", t, { "flags.monks-active-tiles.-=teleporting": null });
                        });

                        result.tokens = merged.filter(t => { return t.flags["monks-active-tiles"]?.current; });
                        result.tokens.forEach((t) => {
                            batch.add("update", t, { "flags.monks-active-tiles.-=current": null });
                        });

                        batch.execute();

                        for (let switchView of switchViews) {
                            MonksActiveTiles.emit('switchview', switchView);
                        }
                    });

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
                    let entityName = await MonksActiveTiles.entityName(action.data?.entity);
                    let locationName = await MonksActiveTiles.locationName(action.data?.location);
                    return `<span class="action-style">${i18n(trigger.name)}</span> <span class="entity-style">${entityName}</span> to <span class="details-style">"${locationName}"</span>${(action.data?.remotesnap ? ' <i class="fas fa-compress" title="Snap to grid"></i>' : '')}${(action.data.animatepan ? ' <i class="fas fa-sign-in-alt" title="Animate Pan"></i>' : '')}`;
                }
            },
            'movetoken': {
                name: "MonksActiveTiles.action.movement",
                options: { allowDelay: true },
                ctrls: [
                    {
                        id: "entity",
                        name: "MonksActiveTiles.ctrl.select-entity",
                        type: "select",
                        subtype: "entity",
                        options: { showTile: true, showToken: true, showWithin: true, showPlayers: true, showPrevious: true, showTagger: true },
                        restrict: (entity) => {
                            return (
                                entity instanceof Token ||
                                entity instanceof Tile ||
                                entity instanceof Drawing ||
                                entity instanceof AmbientLight ||
                                entity instanceof AmbientSound ||
                                entity instanceof Note);
                        }
                    },
                    {
                        id: "location",
                        name: "MonksActiveTiles.ctrl.select-coordinates",
                        type: "select",
                        subtype: "either",
                        onChange: (app) => {
                            app.checkConditional();
                        },
                        options: { showTagger: true, showToken: true, showOrigin: true, showPrevious: true },
                        restrict: (entity) => { return (entity instanceof Tile && this.scene.id == entity.parent.id) || this.scene.id == entity.id; },
                        required: true
                    },
                    {
                        id: "position",
                        name: "MonksActiveTiles.ctrl.positioning",
                        list: "position",
                        type: "list",
                        conditional: (app) => {
                            let entity = JSON.parse($('input[name="data.location"]', app.element).val() || "{}");
                            return /^Scene.[a-zA-Z0-9]{16}.Tile.[a-zA-Z0-9]{16}$/.test(entity?.id) || (entity?.id || "").startsWith("tagger");
                        },
                        defaultVal: "random"
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
                        defvalue: ''
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
                    const { tile, tokens, action, value, pt } = args;

                    let oldTile = {
                        x: tile.x + (Math.abs(tile.width) / 2),
                        y: tile.y + (Math.abs(tile.height) / 2)
                    }
                    //wait for animate movement
                    let entities = await MonksActiveTiles.getEntities(args);

                    if (entities && entities.length > 0) {
                        //let hasOriginal = !!value.original;

                        //set or toggle visible
                        let promises = [];
                        let batch = new BatchManager();
                        for (let entity of entities) {
                            if (!entity)
                                continue;

                            let object = entity.object;

                            let midX = ((entity.width * entity.parent.dimensions.size) / 2);
                            let midY = ((entity.height * entity.parent.dimensions.size) / 2);

                            let oldPos = {
                                x: entity.x + midX,
                                y: entity.y + midY
                            }

                            let dests = await MonksActiveTiles.getLocation.call(tile, action.data.location, value, { pt: { x: pt?.x - midX, y: pt?.y - midY } });
                            let dest = dests.pickRandom(); //[Math.floor(Math.random() * dests.length)];

                            let entDest = duplicate(dest);
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

                            if (typeof entDest.x == "string" && (entDest.x.startsWith("+") || entDest.x.startsWith("-"))) {
                                entDest.x = parseInt(eval(`${entity.x} ${entDest.x}`));
                                action.data.location.id = "origin";
                            }
                            if (typeof entDest.y == "string" && (entDest.y.startsWith("+") || entDest.y.startsWith("-"))) {
                                entDest.y = parseInt(eval(`${entity.y} ${entDest.y}`));
                                action.data.location.id = "origin";
                            }

                            if (entDest.dest instanceof TileDocument) {
                                if (action.data.position == "center") {
                                    entDest.x = entDest.dest.x + (entDest.dest.width / 2);
                                    entDest.y = entDest.dest.y + (entDest.dest.height / 2);
                                } else if (action.data.position == "relative") {
                                    entDest.x = entDest.dest.x + (entDest.dest.width / 2) + (oldPos.x - oldTile.x);
                                    entDest.y = entDest.dest.y + (entDest.dest.height / 2) + (oldPos.y - oldTile.y);
                                } else {
                                    // Find a random location within this Tile
                                    entDest.x = entDest.dest.x + Math.floor((Math.random() * Math.abs(entDest.dest.width)));
                                    entDest.y = entDest.dest.y + Math.floor((Math.random() * Math.abs(entDest.dest.height)));
                                }
                            }

                            let newPos = {
                                x: entDest.x - (action.data?.location?.id == "origin" ? 0 : ((object.w || object.width) / 2)),
                                y: entDest.y - (action.data?.location?.id == "origin" ? 0 : ((object.h || object.height) / 2))
                            };

                            if (!canvas.dimensions.rect.contains(newPos.x, newPos.y)) {
                                //+++find the closest spot on the edge of the scene
                                ui.notifications.error(i18n("MonksActiveTiles.msg.prevent-teleport"));
                                return;
                            }
                            if (action.data.snap)
                                newPos = canvas.grid.getSnappedPosition(newPos.x, newPos.y);

                            let ray = new Ray({ x: entity.x, y: entity.y }, { x: newPos.x, y: newPos.y });

                            let duration = 0;
                            if (action.data?.duration == undefined) {
                                const s = canvas.dimensions.size;
                                const speed = s * 6;
                                duration = (ray.distance * 1000) / speed;
                            } else
                                duration = action.data?.duration * 1000;
                            let time = new Date().getTime() + duration;

                            if (object instanceof Token) {
                                //if (action.data.wait) {
                                //promises.push(object.setPosition(newPos.x, newPos.y));
                                //batch.add("update", entity, { x: newPos.x, y: newPos.y }, { bypass: !action.data.trigger, animate: false });
                                //await object.setPosition(newPos.x, newPos.y);
                                //await entity.update({ x: newPos.x, y: newPos.y }, { bypass: !action.data.trigger, animate: false });
                                //} else
                                batch.add("update", entity, { x: newPos.x, y: newPos.y }, { bypass: !action.data.trigger, animate: true, animation: { duration, time } });
                                //entity.update({ x: newPos.x, y: newPos.y }, { bypass: !action.data.trigger, animate: true });
                            } else {
                                //promises.push(MonksActiveTiles.moveEntity(entity, { x: newPos.x, y: newPos.y }, time));
                                //MonksActiveTiles.emit("move", { entityid: entity.uuid, x: newPos.x, y: newPos.y, time: time });

                                //if (action.data.wait)
                                //    await animate().then(async () => { await entity.update({ x: newPos.x, y: newPos.y }); });
                                //else
                                //     animate().then(async () => { await entity.update({ x: newPos.x, y: newPos.y }); });

                                batch.add("update", entity, { x: newPos.x, y: newPos.y }, { bypass: !action.data.trigger, animate: true, animation: { duration, time } });
                            }
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
                    let entityName = await MonksActiveTiles.entityName(action.data?.entity);
                    let locationName = await MonksActiveTiles.locationName(action.data?.location);
                    return `<span class="action-style">${i18n(trigger.name)}</span> <span class="entity-style">${entityName}</span> to <span class="details-style">"${locationName}"</span>${(action.data?.snap ? ' <i class="fas fa-compress" title="Snap to grid"></i>' : '')}${(action.data?.wait ? ' <i class="fas fa-clock" title="Wait until finished"></i>' : '')}${(action.data?.trigger ? ' <i class="fas fa-running" title="Trigger tiles while moving"></i>' : '')}`;
                }
            },
            'rotation': {
                name: "MonksActiveTiles.action.rotation",
                options: { allowDelay: true },
                ctrls: [
                    {
                        id: "entity",
                        name: "MonksActiveTiles.ctrl.select-entity",
                        type: "select",
                        subtype: "entity",
                        options: { showTile: true, showToken: true, showWithin: true, showPlayers: true, showPrevious: true, showTagger: true },
                        restrict: (entity) => {
                            return (
                                entity instanceof Token ||
                                entity instanceof Tile ||
                                entity instanceof Drawing
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

                            let rotation = action.data.rotation;
                            if (rotation.startsWith("+") || rotation.startsWith("-"))
                                rotation = eval(entity.rotation + rotation);
                            rotation = parseInt(rotation);

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
                    let entityName = await MonksActiveTiles.entityName(action.data?.entity);
                    return `<span class="action-style">${i18n(trigger.name)}</span> <span class="entity-style">${entityName}</span> rotate to <span class="details-style">"${action.data.rotation}"</span>`;
                }
            },
            'showhide': {
                name: "MonksActiveTiles.action.showhide",
                requiresGM: true,
                batch: true,
                options: { allowDelay: true },
                ctrls: [
                    {
                        id: "entity",
                        name: "MonksActiveTiles.ctrl.select-entity",
                        type: "select",
                        subtype: "entity",
                        onChange: (app) => {
                            app.checkConditional();
                        },
                        options: { showTile: true, showToken: true, showWithin: true, showPlayers: true, showPrevious: true, showTagger: true },
                        restrict: (entity) => { return (entity instanceof Token || entity instanceof Tile || entity instanceof Drawing); }
                    },
                    {
                        id: "collection",
                        name: "Collection",
                        list: "collection",
                        type: "list",
                        onChange: (app, ctrl, action, data) => {
                            $('input[name="data.entity"]', app.element).next().html('Current collection of ' + $(ctrl).val());
                        },
                        conditional: (app) => {
                            let entity = JSON.parse($('input[name="data.entity"]', app.element).val() || "{}");
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
                                    /*
                                    MonksActiveTiles.fadeImage(entity, hide, time).then(() => {
                                        if (hide)
                                            entity.update({ hidden: hide }, { animation: { duration: 0 } });
                                    });

                                    MonksActiveTiles.emit("showhide", { entityid: entity.uuid, time: time, hide: hide });

                                    if (!hide)
                                        MonksActiveTiles.batch.add("update", entity, { hidden: hide }, { animation: { duration: 0 } });
                                        */
                                    MonksActiveTiles.batch.add("update", entity, { hidden: hide }, { animation: { duration, time } });
                                } else
                                    MonksActiveTiles.batch.add("update", entity, { hidden: hide }, { animation: { duration: 0 }});

                                MonksActiveTiles.addToResult(entity, result);
                            }
                        }

                        return result;
                    }
                },
                content: async (trigger, action) => {
                    let entityName = await MonksActiveTiles.entityName(action.data?.entity);
                    return `<span class="action-style">${i18n(trigger.values.hidden[action.data?.hidden]) + (action.data?.activate == "toggle" ? " Visibility" : "")}</span> <span class="entity-style">${entityName}</span>${action.data?.fade ? ', Fade after <span class="value-style">&lt;' + action.data?.fade + '&gt; sec</span>' : ''}`;
                }
            },
            'create': {
                name: "MonksActiveTiles.action.createtoken",
                options: { allowDelay: true },
                ctrls: [
                    {
                        id: "entity",
                        name: "MonksActiveTiles.ctrl.select-entity",
                        type: "select",
                        subtype: "entity",
                        options: { showPrevious: true, showPlayers: true },
                        restrict: (entity) => { return (entity instanceof Actor || entity instanceof JournalEntry || entity instanceof Note); },
                        onChange: (app) => {
                            app.checkConditional();
                        },
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
                            $('input[name="data.entity"]', app.element).next().html('Current collection of ' + $(ctrl).val());
                        },
                        conditional: (app) => {
                            let entity = JSON.parse($('input[name="data.entity"]', app.element).val() || "{}");
                            return entity?.id == 'previous';
                        },
                        defvalue: 'actors'
                    },
                    {
                        id: "location",
                        name: "MonksActiveTiles.ctrl.select-coordinates",
                        type: "select",
                        subtype: "either",
                        options: { showTagger: true, showPrevious: true, showTile: true },
                        restrict: (entity) => { return (entity instanceof Tile && this.scene.id == entity.parent.id) || this.scene.id == entity.id; },
                        required: true
                    },
                    {
                        id: "snap",   //using remote snap because I don't want this to trigger the token to be snapped to the grid on the tile
                        name: "MonksActiveTiles.ctrl.snap",
                        type: "checkbox",
                        defvalue: true
                    },
                    {
                        id: "invisible",   //using remote snap because I don't want this to trigger the token to be snapped to the grid on the tile
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
                    }
                },
                fn: async (args = {}) => {
                    const { tile, action, value } = args;
                    //find the item in question
                    let entities = await MonksActiveTiles.getEntities(args, action.data?.collection || 'actors');

                    if (entities && entities.length > 0) {
                        let dests = await MonksActiveTiles.getLocation.call(tile, action.data.location, value);

                        const actors = [];
                        for (let entity of entities) {
                            if (entity instanceof NoteDocument) {
                                if (action.data.location.id == "previous") {
                                    dests = [{ x: entity.x, y: entity.y }];
                                }
                                entity = entity.entry;
                            }
                            if (entity instanceof JournalEntry) {
                                if ((entity.flags["monks-enhanced-journal"]?.actors || []).length && game.modules.get("monks-enhanced-journal")?.active) {
                                    for (let ea of (entity.flags['monks-enhanced-journal']?.actors || [])) {
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
                                                quantity = await rollDice(quantity);
                                            } else {
                                                quantity = parseInt(quantity);
                                                if (isNaN(quantity)) quantity = 1;
                                            }

                                            for (let i = 0; i < (quantity || 1); i++) {
                                                let tdests = (ea.location ? dests.filter(d => d.dest ? Tagger.hasTags(d.dest, ea.location) : d) : dests);
                                                let dest = tdests.pickRandom(tile.id);

                                                if (dest) {
                                                    if (dest.dest instanceof TileDocument) {
                                                        // Find a random location within this Tile
                                                        dest.x = dest.dest.x + Math.floor((Math.random() * Math.abs(dest.dest.width)));
                                                        dest.y = dest.dest.y + Math.floor((Math.random() * Math.abs(dest.dest.height)));
                                                    }
                                                    let data = {
                                                        x: dest.x,
                                                        y: dest.y,
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
                                if (dest) {
                                    if (dest.dest instanceof TileDocument) {
                                        // Find a random location within this Tile
                                        dest.x = dest.dest.x + Math.floor((Math.random() * Math.abs(dest.dest.width)));
                                        dest.y = dest.dest.y + Math.floor((Math.random() * Math.abs(dest.dest.height)));
                                    } else {
                                        if (dest.x) dest.x = await rollDice(dest.x);
                                        if (dest.y) dest.y = await rollDice(dest.y);
                                    }
                                    let data = {
                                        x: dest.x,
                                        y: dest.y,
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

                            if (actor.compendium) {
                                const actorData = game.actors.fromCompendium(actor);
                                actor = await Actor.implementation.create(actorData);
                            }

                            // Prepare the Token data
                            const td = await actor.getTokenDocument();
                            mergeObject(td, ad.data);

                            if (!ad.lockpos) {
                                if (action.data.avoidtokens) {
                                    let dt = mergeObject(ad.data, MonksActiveTiles.findVacantSpot(ad.data, { data: td }, tile.parent, newTokens, ad.dest, action.data.snap));
                                    td.x = dt.x;
                                    td.y = dt.y;
                                }

                                // Bypass snapping
                                if (!action.data.snap) {
                                    td.x -= (td.width * canvas.grid.w / 2);
                                    td.y -= (td.height * canvas.grid.h / 2);
                                }
                                // Otherwise snap to nearest vertex, adjusting for large tokens
                                else {
                                    const hw = canvas.grid.w / 2;
                                    const hh = canvas.grid.h / 2;
                                    let pos = canvas.grid.getSnappedPosition(td.x - (td.width * hw), td.y - (td.height * hh))
                                    td.x = pos.x;
                                    td.y = pos.y;
                                }
                            }

                            // Validate the final position
                            if (!canvas.dimensions.rect.contains(td.x, td.y)) continue;

                            //if (td.hidden)
                            //    setProperty(td, "flags.monks-active-tiles.hide", true);

                            // Submit the Token creation request and activate the Tokens layer (if not already active)
                            batch.add("create", cls, td, { parent: tile.parent });
                            //let tkn = await cls.create(td, { parent: tile.parent });

                            //if (td.hidden)
                            //    tkn.update({ hidden: true });

                            //result.tokens.push(tkn);
                            newTokens.push({ data: { x: td.x, y: td.y, width: td.width, height: td.height } });
                        }
                        let tokens = await batch.execute();
                        tokens = batch.mergeResults(tokens);

                        //for (let token of tokens) {
                        //    if (getProperty(token, "flags.monks-active-tiles.hidden")) {
                        //        batch.add("update", token, { "hidden": true, "flags.monks-active-tiles.-=hidden": null });
                        //    }
                        //}
                        await batch.execute();

                        result.tokens = result.tokens.concat(tokens);

                        return result;
                    }
                },
                content: async (trigger, action) => {
                    let entityName = await MonksActiveTiles.entityName(action.data?.entity, 'actors');
                    let locationName = await MonksActiveTiles.locationName(action.data?.location);
                    return `<span class="action-style">${i18n(trigger.name)}</span> <span class="entity-style">${entityName}</span> at <span class="details-style">"${locationName}"</span>${(action.data?.snap ? ' <i class="fas fa-compress" title="Snap to grid"></i>' : '')}${(action.data?.invisible ? ' <i class="fas fa-eye-slash" title="Invisible"></i>' : '')}`;
                }
            },
            'createjournal': {
                name: "MonksActiveTiles.action.createjournal",
                options: { allowDelay: true },
                ctrls: [
                    {
                        id: "entity",
                        name: "MonksActiveTiles.ctrl.select-entity",
                        type: "select",
                        subtype: "entity",
                        options: { showPrevious: true },
                        restrict: (entity) => { return (entity instanceof JournalEntry || entity instanceof Note); },
                        required: true,
                        defaultType: 'journal',
                        placeholder: 'Please select a Journal Entry to add to the canvas'
                    },
                    {
                        id: "location",
                        name: "MonksActiveTiles.ctrl.select-coordinates",
                        type: "select",
                        subtype: "either",
                        restrict: (entity) => { return (entity instanceof Tile && this.scene.id == entity.parent.id) || this.scene.id == entity.id; },
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
                            let dests = await MonksActiveTiles.getLocation.call(tile, action.data.location, value);

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
                                let dest = dests.pickRandom(tile.id);

                                if (dest.dest instanceof TileDocument) {
                                    // Find a random location within this Tile
                                    dest.x = dest.dest.x + Math.floor((Math.random() * Math.abs(dest.dest.width)));
                                    dest.y = dest.dest.y + Math.floor((Math.random() * Math.abs(dest.dest.height)));
                                } else {
                                    if (dest.x) dest.x = await rollDice(dest.x);
                                    if (dest.y) dest.y = await rollDice(dest.y);
                                }

                                let data = {
                                    x: dest.x,
                                    y: dest.y,
                                    entryId: entity.id,
                                    icon: action.data.icon
                                };

                                // Snap to Grid
                                if (action.data.snap) {
                                    let snap = canvas.grid.getSnappedPosition(data.x, data.y, canvas.notes.gridPrecision);
                                    data.x = snap.x;
                                    data.y = snap.y;
                                }

                                // Validate the final position
                                if (!canvas.dimensions.rect.contains(data.x, data.y)) return;

                                // Submit the Token creation request and activate the Tokens layer (if not already active)
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
                    let entityName = await MonksActiveTiles.entityName(action.data?.entity, 'journal');
                    let locationName = await MonksActiveTiles.locationName(action.data?.location);
                    return `<span class="action-style">${i18n(trigger.name)}</span> <span class="entity-style">${entityName}</span> at <span class="details-style">"${locationName}"</span>${(action.data?.snap ? ' <i class="fas fa-compress" title="Snap to grid"></i>' : '')}`;
                }
            },
            'activate': {
                name: "MonksActiveTiles.action.activate",
                requiresGM: true,
                batch: true,
                options: { allowDelay: true },
                ctrls: [
                    {
                        id: "entity",
                        name: "MonksActiveTiles.ctrl.select-entity",
                        type: "select",
                        subtype: "entity",
                        options: { showTile: true, showTagger: true },
                        restrict: (entity) => {
                            return (entity instanceof Tile || entity instanceof AmbientLight || entity instanceof AmbientSound || entity.terrain != undefined);
                        },
                        defaultType: 'tiles'
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

                    }
                },
                fn: async (args = {}) => {
                    const { action, value } = args;
                    let entities = await MonksActiveTiles.getEntities(args, 'tiles');
                    if (entities.length == 0)
                        return;

                    for (let entity of entities) {
                        if (entity) {
                            if (entity instanceof AmbientLightDocument || entity instanceof AmbientSoundDocument || entity._object?.terrain != undefined) {
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
                    let entityName = await MonksActiveTiles.entityName(action.data?.entity, 'tiles');
                    return `<span class="action-style">${action.data?.activate == "previous" ? "Activate from previous value" : i18n(trigger.values.activate[action.data?.activate]) + (action.data?.activate == "toggle" ? " Activation" : "")}</span> <span class="entity-style">${entityName}</span>`;
                }
            },
            'alter': {
                name: "MonksActiveTiles.action.alter",
                requiresGM: true,
                batch: true,
                options: { allowDelay: true },
                ctrls: [
                    {
                        id: "entity",
                        name: "MonksActiveTiles.ctrl.select-entity",
                        type: "select",
                        subtype: "entity",
                        options: { showTile: true, showToken: true, showWithin: true, showPlayers: true, showPrevious: true, showTagger: true }
                    },
                    {
                        id: "attribute",
                        name: "MonksActiveTiles.ctrl.attribute",
                        type: "text",
                        required: true,
                        help: "separate multiple updates with a ;"
                    },
                    {
                        id: "value",
                        name: "MonksActiveTiles.ctrl.value",
                        type: "text",
                        onBlur: (app) => {
                            app.checkConditional();
                        },
                        help: "If you want to increase the value use '+ 10', if you want to have the value rolled use '[[1d4]]'"
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
                    }
                },
                fn: async (args = {}) => {
                    const { tile, tokens, action, userid, value, method, change } = args;
                    let entities = await MonksActiveTiles.getEntities(args);

                    let result = { entities: entities };

                    let attr = action.data.attribute.trim();
                    let _val = action.data.value.trim();

                    if (entities && entities.length > 0 && attr != "" && _val != undefined) {
                        for (let entity of entities) {
                            if (entity) {
                                let base = entity;
                                let val = duplicate(_val);

                                let update = {};

                                if (!attr.startsWith('flags')) {
                                    if (!hasProperty(base, attr) && entity instanceof TokenDocument) {
                                        base = entity.actor;
                                        attr = 'system.' + attr;
                                    }

                                    if (!hasProperty(base, attr)) {
                                        warn("Couldn't find attribute", entity, attr);
                                        continue;
                                    }
                                }

                                let prop = getProperty(base, attr);

                                if (prop && typeof prop == 'object' && !(prop instanceof Array)) {
                                    if (prop.value == undefined) {
                                        debug("Attribute returned an object and the object doesn't have a value property", entity, attr, prop);
                                        continue;
                                    }

                                    attr = attr + '.value';
                                    prop = prop.value;
                                }

                                if (val == 'true') {
                                    val = true;
                                } else if (val == 'false') {
                                    val = false;
                                } else {
                                    let context = {
                                        actor: tokens[0]?.actor?.toObject(false),
                                        token: tokens[0]?.toObject(false),
                                        tile: tile.toObject(),
                                        entity: entity,
                                        user: game.users.get(userid),
                                        value: value,
                                        scene: canvas.scene,
                                        method: method,
                                        change: change
                                    };

                                    if (typeof val == "string" && val.includes("{{")) {
                                        const compiled = Handlebars.compile(val);
                                        val = compiled(context, { allowProtoMethodsByDefault: true, allowProtoPropertiesByDefault: true }).trim();
                                    }

                                    const rgx = /\[\[(\/[a-zA-Z]+\s)?(.*?)([\]]{2,3})(?:{([^}]+)})?/gi;
                                    val = await MonksActiveTiles.inlineRoll(val, rgx, action.data.chatMessage, action.data.rollmode, entity);

                                    if (typeof val == "string" && (val.startsWith('+ ') || val.startsWith('- '))) {
                                        try {
                                            if (prop instanceof Array) {
                                                let add = val.startsWith('+ ');
                                                let parts = val.replace('+ ', '').replace('- ', '').split(',').map(p => p.trim());
                                                if (add)
                                                    val = prop.concat(parts).filter((value, index, self) => { return self.indexOf(value) === index; });
                                                else
                                                    val = prop.filter(value => { return !parts.includes(value) });
                                            } else {
                                                val = eval(prop + val);
                                            }
                                        } catch (err) {
                                            val = (prop instanceof Array ? [] : 0);
                                            debug(err);
                                        }
                                    }
                                    if (typeof val == "string" && val.startsWith('=')) {
                                        try {
                                            if (prop instanceof Array) {
                                                val = val.replace('=', '').split(',').map(p => p.trim()).filter(p => !!p);
                                            } else {
                                                val = eval(val.substring(1));
                                            }
                                        } catch (err) {
                                            val = (prop instanceof Array ? [] : 0);
                                            debug(err);
                                        }
                                    }

                                    if (val instanceof Array) {
                                        for (let i = 0; i < val.length; i++) {
                                            if (!isNaN(val[i]) && !isNaN(parseFloat(val[i])))
                                                val[i] = parseFloat(val[i]);
                                        }
                                    } else {
                                        if (!isNaN(val) && !isNaN(parseFloat(val)))
                                            val = parseFloat(val);
                                    }
                                }
                                update[attr] = val;

                                MonksActiveTiles.batch.add('update', base, update);
                                MonksActiveTiles.addToResult(entity, result);
                            }
                        }

                        return result;
                    }
                },
                content: async (trigger, action) => {
                    let entityName = await MonksActiveTiles.entityName(action.data?.entity);
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

                        str += `, ${actionName} <span class="value-style">&lt;${attr}&gt;</span> ${midName} <span class="details-style">"${value}"</span>`;
                    }
                    return `<span class="action-style">${i18n(trigger.name)}</span> <span class="entity-style">${entityName}</span>${str}`;
                }
            },
            /*'animate': {
                name: "MonksActiveTiles.action.animate",
                options: { allowDelay: true },
                ctrls: [
                    {
                        id: "entity",
                        name: "MonksActiveTiles.ctrl.select-entity",
                        type: "select",
                        subtype: "entity",
                        options: { showTile: true, showToken: true, showWithin: true, showPlayers: true, showPrevious: true }
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
                    const { tile, tokens, action, userid, value } = args;
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
                            let _animation = await CanvasAnimation.animateLinear(attributes, {
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
                options: { allowDelay: true },
                ctrls: [
                    {
                        id: "entity",
                        name: "MonksActiveTiles.ctrl.select-entity",
                        type: "select",
                        subtype: "entity",
                        options: { showToken: true, showWithin: true, showPlayers: true, showPrevious: true, showTagger: true }
                    },
                    {
                        id: "value",
                        name: "MonksActiveTiles.ctrl.value",
                        type: "text",
                        required: true,
                        onBlur: (app) => {
                            app.checkConditional();
                        },
                        help: "If you want to increase the value use '+ 10', if you want to have the value rolled use '[[1d4]]'"
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
                    const { tile, action, userid, value, method, change } = args;
                    let entities = await MonksActiveTiles.getEntities(args);

                    let applyDamage = function (actor, amount = 0) {
                        let updates = {};
                        amount = Math.floor(parseInt(amount));
                        let resourcename = game.system.primaryTokenAttribute || 'attributes.hp';
                        let resource = getProperty(actor, "system." + resourcename);
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
                            const dh = Math.clamped(resource.value - (amount - dt), (game.system.id == 'D35E' || game.system.id == 'pf1' ? -2000 : 0), (resource.max == 0 ? 4000 : resource.max + tmpMax));
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

                            let val = action.data.value;
                            let context = {
                                actor: a.toObject(false),
                                token: entity.toObject(false),
                                tile: tile.toObject(false),
                                entity: entity,
                                user: game.users.get(userid),
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
                                val = await rollDice(val);

                                if (action.data.chatMessage)
                                    r.toMessage({}, { rollMode: action.data.rollmode });
                            }

                            try {
                                val = parseFloat(eval(val));
                            } catch { }

                            val = val * -1;

                            if (val != 0) {
                                if (!$.isNumeric(val)) {
                                    warn("Value used for Hurt/Heal did not evaluate to a number", val);
                                    continue;
                                }
                                if (a.applyDamage) {
                                    await a.applyDamage(val, (game.system.id == "pf2e" ? entity : 1));
                                } else {
                                    applyDamage(a, val);
                                }
                            }
                        }

                        return { tokens: entities, entities: entities };
                    }
                },
                content: async (trigger, action) => {
                    let entityName = await MonksActiveTiles.entityName(action.data?.entity);
                    return `<span class="action-style">${(action.data?.value.startsWith('-') ? 'Hurt' : 'Heal')}</span> <span class="entity-style">${entityName}</span>, by <span class="details-style">"${action.data?.value}"</span>`;
                }
            },
            'playsound': {
                name: "MonksActiveTiles.action.playsound",
                options: { allowDelay: true },
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
                        type: "list"
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
                ],
                values: {
                    'audiofor': {
                        'all': "MonksActiveTiles.for.all",
                        'gm': "MonksActiveTiles.for.gm",
                        'triggering': "MonksActiveTiles.for.player",
                        'owner': "MonksActiveTiles.for.token"
                    },
                },
                fn: async (args = {}) => {
                    const { tile, tokens, action, userid } = args;
                    //play the sound
                    let getTileSounds = async function (tile) {
                        const audiofile = action.data.audiofile;

                        if (!audiofile) {
                            console.log(`Audio file not set to anything, can't play sound`);
                            return;
                        }

                        if (!audiofile.includes('*')) return [audiofile];
                        if (tile._sounds) return tile._sounds;
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
                            tile._sounds = content.files;
                        } catch (err) {
                            tile._sounds = [];
                            ui.notifications.error(err);
                        }
                        return tile._sounds;
                    }

                    let volume = Math.clamped((action.data.volume.value ?? action.data.volume ?? 1), 0, 1);

                    let audiofiles = await getTileSounds(tile);
                    const audiofile = audiofiles[Math.floor(Math.random() * audiofiles.length)];

                    let playfor = action.data.audiofor;
                    if (playfor == "token") playfor = "triggering";

                    let owners = [];
                    for (let token of tokens) {
                        if (token.actor) {
                            for (let [user, perm] of Object.entries(token.actor.ownership)) {
                                if (perm >= CONST.DOCUMENT_PERMISSION_LEVELS.OWNER && !owners.includes(user))
                                    owners.push(user);
                            }
                        }
                    }


                    if (["all", "owner"].includes(playfor) || (playfor == "triggering" && userid != game.user.id)) {
                        // Broadcast if playing for all, or owners, or the triggering player if it's not the triggering player playing the sound
                        MonksActiveTiles.emit('playsound', {
                            tileid: tile.uuid,
                            actionid: action.id,
                            src: audiofile,
                            loop: action.data.loop,
                            userid: (playfor == 'owner' ? owner : (playfor == 'triggering' ? [userid] : null)),
                            sceneid: action.data.scenerestrict ? tile.parent.id : null,
                            volume: volume,
                            prevent: action.data.prevent,
                            fade: action.data.fade
                        });
                    }
                    if (playfor == "all" || (playfor == "gm" && game.user.isGM) || (playfor == "triggering" && userid == game.user.id) || (playfor == "owner" && owners.includes(game.user.id))) {
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
                                userid: (playfor == 'triggering' ? [userid] : (playfor == 'owner' ? owners : null)),
                                fade: 0.25
                            });
                        }
                        debug('Playing', audiofile, action.id);
                        let fade = action.data.fade ?? 0;
                        AudioHelper.play({ src: audiofile, volume: (fade > 0 ? 0 : volume), loop: action.data.loop }, false).then((sound) => {
                            if (fade > 0)
                                sound.fade(volume * game.settings.get("core", "globalAmbientVolume"), { duration: fade * 1000 });
                            if (tile.soundeffect == undefined)
                                tile.soundeffect = {};
                            tile.soundeffect[action.id] = sound;
                            tile.soundeffect[action.id].on("end", () => {
                                debug('Finished playing', audiofile);
                                delete tile.soundeffect[action.id];
                            });
                            tile.soundeffect[action.id]._mattvolume = volume;
                        });
                    }
                },
                content: async (trigger, action) => {
                    let playfor = action.data.audiofor;
                    if (playfor == "token") playfor = "triggering";
                    return `<span class="action-style">${i18n(trigger.name)}</span> <span class="details-style">"${action.data.audiofile}"</span> for <span class="value-style">&lt;${i18n(trigger.values.audiofor[playfor])}&gt;</span>${(action.data?.loop ? ' <i class="fas fa-sync" title="Loop sound"></i>' : '')}`;
                }
            },
            'playlist': {
                name: "MonksActiveTiles.action.playlist",
                options: { allowDelay: true },
                ctrls: [
                    {
                        id: "entity",
                        name: "MonksActiveTiles.ctrl.playlist",
                        type: "select",
                        subtype: "entity",
                        restrict: (entity) => {
                            return (entity instanceof Playlist || entity instanceof PlaylistSound);
                        },
                        required: true,
                        defaultType: 'playlists',
                        placeholder: 'Please select a playlist'
                    },
                    {
                        id: "play",
                        name: "MonksActiveTiles.ctrl.play",
                        list: "play",
                        defvalue: "play",
                        type: "list",
                        onChange: (app) => {
                            app.checkConditional();
                        },
                    },
                    {
                        id: "volume",
                        name: "MonksActiveTiles.ctrl.volume",
                        type: "slider",
                        defvalue: "1.0",
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
                        'stop': "Stop"
                    },
                },
                fn: async (args = {}) => {
                    const { tile, action, userid } = args;

                    let volume = Math.clamped((action.data.volume.value ?? action.data.volume ?? 1), 0, 1);

                    let batch = new BatchManager();
                    let entities = await MonksActiveTiles.getEntities(args, 'playlists');
                    for (let entity of entities) {
                        if (entity instanceof Playlist) {
                            if (action.data?.play !== "stop")
                                await entity.playAll();
                            else
                                await entity.stopAll();
                        } else {
                            if (action.data?.play !== "stop")
                                batch.add("update", entity, { playing: true, repeat: action.data.loop, volume: volume });
                            else
                                batch.add("update", entity, { playing: false });
                        }
                    }
                    batch.execute();
                },
                content: async (trigger, action) => {
                    let entityName = await MonksActiveTiles.entityName(action.data.entity, 'playlists')
                    return `<span class="action-style">${i18n(trigger.name)}</span> <span class="details-style">"${action.data?.play == 'play' ? "Play" : "Stop"}"</span> <span class="entity-style">${entityName}</span>${(action.data?.loop ? ' <i class="fas fa-sync" title="Loop sound"></i>' : '')}`;
                }
            },
            'stopsound': {
                name: "MonksActiveTiles.action.stopsound",
                options: { allowDelay: true },
                ctrls: [
                    {
                        id: "audiotype",
                        name: "MonksActiveTiles.ctrl.audiotype",
                        list: "audiotype",
                        type: "list",
                        onChange: (app) => {
                            app.checkConditional();
                        },
                    },
                    {
                        id: "entity",
                        name: "MonksActiveTiles.ctrl.select-entity",
                        type: "select",
                        subtype: "entity",
                        options: { showTile: true },
                        restrict: (entity) => { return entity instanceof Tile; },
                        conditional: (app) => {
                            return $('select[name="data.audiotype"]', app.element).val() == 'tile';
                        },
                        defaultType: 'tiles'
                    },
                    {
                        id: "audiofor",
                        name: "MonksActiveTiles.ctrl.for",
                        list: "audiofor",
                        type: "list"
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
                        'all': "MonksActiveTiles.for.all",
                        'gm': "MonksActiveTiles.for.gm",
                        'token': "MonksActiveTiles.for.player",
                        'owner': "MonksActiveTiles.for.token"
                    },
                    'audiotype': {
                        'all': "MonksActiveTiles.audiotype.all",
                        'tile': "MonksActiveTiles.audiotype.tile"
                    }
                },
                fn: async (args = {}) => {
                    const { tile, tokens, action, userid } = args;
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

                        MonksActiveTiles.emit('stopsound', {
                            type: action.data.audiotype,
                        });
                    } else {
                        let owners = [];
                        for (let token of tokens) {
                            if (token.actor) {
                                for (let [user, perm] of Object.entries(token.actor.ownership)) {
                                    if (perm >= CONST.DOCUMENT_PERMISSION_LEVELS.OWNER && !owners.includes(user))
                                        owners.push(user);
                                }
                            }
                        }

                        let entities = await MonksActiveTiles.getEntities(args, 'tiles');
                        for (let entity of entities) {
                            if (action.data.audiofor != 'gm') {
                                MonksActiveTiles.emit('stopsound', {
                                    tileid: entity.uuid,
                                    type: action.data.audiotype,
                                    userid: (action.data.audiofor == 'token' ? [userid] : (action.data.audiofor == 'owner' ? owners : null)),
                                    fade: action.data.fade ?? 0.25
                                });
                            }
                            if (["all", "gm"].includes(action.data.audiofor) || userid == game.user.id || owners.includes(game.user.id)) {
                                if (entity.soundeffect != undefined) {
                                    let fade = (action.data.fade * 1000) ?? 0.25;
                                    for (let [key, sound] of Object.entries(entity.soundeffect)) {
                                        sound.fade(0, { duration: fade }).then(() => {
                                            sound.stop();
                                            delete entity.soundeffect[key];
                                        });
                                    }
                                }
                            }
                        }
                    }
                },
                content: async (trigger, action) => {
                    let entityName = '';
                    if (action.data.audiotype == 'tile')
                        entityName = await MonksActiveTiles.entityName(action.data.entity, 'tiles');
                    return `<span class="action-style">${i18n(trigger.name)}</span> of <span class="entity-style">${(action.data.audiotype == 'all' ? i18n("MonksActiveTiles.audiotype.all") : entityName)}</span> for <span class="value-style">&lt;${i18n(trigger.values.audiofor[action.data.audiofor])}&gt;</span>`;
                }
            },
            'changedoor': {
                name: "MonksActiveTiles.action.changedoor",
                batch: true,
                options: { allowDelay: true },
                ctrls: [
                    {
                        id: "entity",
                        name: "MonksActiveTiles.ctrl.selectdoor",
                        type: "select",
                        subtype: "entity",
                        options: { showTagger: true, showPrevious: true },
                        restrict: (entity) => { return (entity instanceof Wall && entity.document.door); },  //this needs to be a wall segment
                        required: true,
                        defaultType: 'walls',
                        placeholder: 'Please select a Wall'
                    },
                    {
                        id: "state",
                        name: "MonksActiveTiles.ctrl.state",
                        list: "state",
                        type: "list"
                    },
                    {
                        id: "type",
                        name: "MonksActiveTiles.ctrl.type",
                        list: "type",
                        type: "list"
                    }
                ],
                values: {
                    'state': {
                        'none': "",
                        'open': "MonksActiveTiles.state.open",
                        'close': "MonksActiveTiles.state.closed",
                        'lock': "MonksActiveTiles.state.locked",
                        'toggle': "MonksActiveTiles.state.toggle"
                    },
                    'type': {
                        'none': "",
                        'door': "MonksActiveTiles.doortype.door",
                        'secret': "MonksActiveTiles.doortype.secret",
                        'toggle': "MonksActiveTiles.doortype.toggle"
                    }
                },
                fn: async (args = {}) => {
                    const { action } = args;
                    //Find the door in question, set the state to whatever value
                    if (action.data.entity.id) {
                        let walls = await MonksActiveTiles.getEntities(args, 'walls');
                        for (let wall of walls) {
                            if (wall && wall.door != 0) {
                                let updates = {}
                                if (action.data.state && action.data.state !== '' && action.data.state != "none") {
                                    let state = (action.data.state == 'open' ? CONST.WALL_DOOR_STATES.OPEN : (action.data.state == 'lock' ? CONST.WALL_DOOR_STATES.LOCKED : CONST.WALL_DOOR_STATES.CLOSED));
                                    if (action.data.state == 'toggle' && wall.ds != CONST.WALL_DOOR_STATES.LOCKED)
                                        state = (wall.ds == CONST.WALL_DOOR_STATES.OPEN ? CONST.WALL_DOOR_STATES.CLOSED : CONST.WALL_DOOR_STATES.OPEN);
                                    updates.ds = state;
                                }
                                if (action.data.type && action.data.type !== '' && action.data.type != "none") {
                                    let type = (action.data.type == 'door' ? CONST.WALL_DOOR_TYPES.DOOR : CONST.WALL_DOOR_TYPES.SECRET);
                                    if (action.data.type == 'toggle')
                                        type = (wall.door == CONST.WALL_DOOR_TYPES.DOOR ? CONST.WALL_DOOR_TYPES.SECRET : CONST.WALL_DOOR_TYPES.DOOR);
                                    updates.door = type;
                                }
                                MonksActiveTiles.batch.add("update", wall, updates);
                            }
                        }
                    }
                },
                content: async (trigger, action) => {
                    let entityName = await MonksActiveTiles.entityName(action.data?.entity, 'walls');
                    let stateText = (action.data?.state != 'none' ? (action.data?.state == 'toggle' ?
                        `, toggle <span class="details-style">"State"</span>` :
                        `, set <span class="details-style">"State"</span> to <span class="value-style">&lt;${i18n(trigger.values.state[action.data?.state])}&gt;</span>`) : '');
                    let typeText = (action.data?.type != undefined && action.data?.type != 'none' ? (action.data?.type == 'toggle' ?
                        `, toggle <span class="details-style">"Type"</span>` :
                        `, set <span class="details-style">"Type"</span> to <span class="value-style">&lt;${i18n(trigger.values.type[action.data?.type])}&gt;</span>`) : '');
                    return `<span class="action-style">${i18n(trigger.name)}</span> <span class="entity-style">${entityName}</span>${stateText}${typeText}`;
                }
            },
            'notification': {
                name: "MonksActiveTiles.action.notification",
                options: { allowDelay: true },
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
                        type: "list"
                    }
                ],
                values: {
                    'type': {
                        'info': "MonksActiveTiles.notification.info",
                        'warning': "MonksActiveTiles.notification.warning",
                        'error': "MonksActiveTiles.notification.error"
                    },
                    'showto': {
                        'all': "MonksActiveTiles.for.all",
                        'gm': "MonksActiveTiles.for.gm",
                        'token': "MonksActiveTiles.for.token"

                    }
                },
                fn: async (args = {}) => {
                    const { tile, tokens, action, userid, value, method, change } = args;
                    //Display a notification with the message
                    let context = {
                        actor: tokens[0]?.actor?.toObject(false),
                        token: tokens[0]?.toObject(false),
                        tile: tile.toObject(false),
                        user: game.users.get(userid),
                        value: value,
                        scene: canvas.scene,
                        method: method,
                        change: change
                    };
                    let content = action.data.text;

                    if (content.includes("{{")) {
                        const compiled = Handlebars.compile(content);
                        content = compiled(context, { allowProtoMethodsByDefault: true, allowProtoPropertiesByDefault: true }).trim();
                    }

                    if (action.data.showto != 'gm')
                        MonksActiveTiles.emit('notification', { content: content, type: action.data.type, userid: (action.data.showto == 'token' ? userid : null) });
                    if (action.data.showto != 'token' || userid == game.user.id)
                        ui.notifications.notify(content, action.data.type);
                },
                content: async (trigger, action) => {
                    return `<span class="action-style">${i18n(trigger.name)}</span> as <span class="details-style">"${i18n(trigger.values.type[action.data?.type])}"</span> to <span class="value-style">&lt;${i18n(trigger.values.showto[action.data?.showto])}&gt;</span>`;
                }
            },
            'chatmessage': {
                name: "MonksActiveTiles.action.chatmessage",
                options: { allowDelay: true },
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
                        options: { showToken: true, showPrevious: true },
                        restrict: (entity) => { return (entity instanceof Token); }
                    },
                    {
                        id: "incharacter",
                        name: "MonksActiveTiles.ctrl.incharacter",
                        type: "checkbox"
                    },
                    {
                        id: "chatbubble",
                        name: "MonksActiveTiles.ctrl.chatbubble",
                        type: "checkbox"
                    },
                    {
                        id: "for",
                        name: "MonksActiveTiles.ctrl.for",
                        list: "for",
                        type: "list"
                    },
                    {
                        id: "language",
                        name: "MonksActiveTiles.ctrl.language",
                        list: () => {
                            let syslang = CONFIG[game.system.id.toUpperCase()]?.languages || {};
                            let languages = mergeObject({ '': '' }, duplicate(syslang));
                            return languages;
                        },
                        conditional: () => {
                            return (game.modules.get("polyglot")?.active && !!CONFIG[game.system.id.toUpperCase()]?.languages);
                        },
                        type: "list"
                    }
                ],
                values: {
                    'for': {
                        'all': "MonksActiveTiles.for.all",
                        'gm': "MonksActiveTiles.for.gm",
                        'token': "MonksActiveTiles.for.token"
                    }
                },
                fn: async (args = {}) => {
                    const { tile, tokens, action, userid, value, method, change } = args;

                    let entities = await MonksActiveTiles.getEntities(args);
                    if (entities.length == 0)
                        entities = [null];
                    if (action.data.for !== 'token')
                        entities = [entities[0]];

                    for (let entity of entities) {
                        //Add a chat message
                        let user = game.users.find(u => u.id == userid);
                        let scene = game.scenes.find(s => s.id == user?.viewedScene);

                        let tkn = (entity?.object || tokens[0]?.object);

                        const speaker = { scene: scene?.id, actor: tkn?.actor?.id || user?.character?.id, token: tkn?.id, alias: tkn?.name || user?.name };

                        let context = {
                            actor: tokens[0]?.actor?.toObject(false),
                            token: tokens[0]?.toObject(false),
                            speaker: tokens[0],
                            tile: tile.toObject(false),
                            entity: entity,
                            user: game.users.get(userid),
                            value: value,
                            scene: canvas.scene,
                            method: method,
                            change: change
                        };
                        let content = action.data.text;
                        let flavor = action.data.flavor;

                        if (content.includes("{{")) {
                            const compiled = Handlebars.compile(content);
                            content = compiled(context, { allowProtoMethodsByDefault: true, allowProtoPropertiesByDefault: true }).trim();
                        }

                        if (flavor && flavor.includes("{{")) {
                            const compiled = Handlebars.compile(flavor);
                            flavor = compiled(context, { allowProtoMethodsByDefault: true, allowProtoPropertiesByDefault: true }).trim();
                        }

                        if (content.startsWith('/')) {
                            ui.chat.processMessage(content);
                        } else {
                            let messageData = {
                                user: userid,
                                speaker: speaker,
                                type: (action.data.incharacter ? CONST.CHAT_MESSAGE_TYPES.IC : CONST.CHAT_MESSAGE_TYPES.OOC),
                                content: content
                            };

                            if (flavor)
                                messageData.flavor = flavor;

                            if (action.data.for == 'gm') {
                                messageData.whisper = ChatMessage.getWhisperRecipients("GM").map(u => u.id);
                                messageData.speaker = null;
                                messageData.user = game.user.id;
                            }
                            else if (action.data.for == 'token') {
                                let tokenOwners = (tkn ? Object.entries(tkn?.actor.ownership).filter(([k, v]) => { return v == CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER }).map(a => { return a[0]; }) : []);
                                messageData.whisper = Array.from(new Set(ChatMessage.getWhisperRecipients("GM").map(u => u.id).concat(tokenOwners)));
                            }

                            if (action.data.language != '' && game.modules.get("polyglot")?.active)
                                mergeObject(messageData, { flags: { 'monks-active-tiles': { language: action.data.language } }, lang: action.data.language });

                            ChatMessage.create(messageData, { chatBubble: action.data.chatbubble });
                        }
                    }
                },
                content: async (trigger, action) => {
                    let syslang = CONFIG[game.system.id.toUpperCase()]?.languages || {};
                    let msg = (action.data.text.length <= 15 ? action.data.text : action.data.text.substr(0, 15) + "...");
                    return `<span class="action-style">${i18n(trigger.name)}</span> for <span class="value-style">&lt;${i18n(trigger.values.for[action.data?.for])}&gt;</span>${(action.data.language != '' && game.modules.get("polyglot")?.active ? ` in <span class="details-style">"${syslang[action.data.language]}"</span>` : '')}${(action.data?.incharacter ? ' <i class="fas fa-user" title="In Character"></i>' : '')}${(action.data?.chatbubble ? ' <i class="fas fa-comment" title="Chat Bubble"></i>' : '')} "${msg}"`;
                }
            },
            'runmacro': {
                name: "MonksActiveTiles.action.runmacro",
                options: { allowDelay: true },
                ctrls: [
                    {
                        id: "entity",
                        name: "MonksActiveTiles.ctrl.select-entity",
                        type: "select",
                        subtype: "entity",
                        options: { showPrevious: true },
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

                        entityName = (pack ? '<i class="fas fa-atlas"></i> ' + pack.metadata.label + ":" : "") + entityName;
                    } else {
                        entityName = await MonksActiveTiles.entityName(action.data?.entity, 'tiles');
                    }

                    return `<span class="action-style">${i18n(trigger.name)}</span>, <span class="entity-style">${entityName}</span>${(action.data.runasgm != undefined && action.data.runasgm != 'unknown' ? ' as <span class="value-style">&lt;' + i18n(trigger.values.runas[action.data.runasgm]) + '&gt;</span>' : '')}`;
                }
            },
            'rolltable': {
                name: "MonksActiveTiles.action.rolltable",
                options: { allowDelay: true },
                ctrls: [
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
                    {
                        id: "quantity",
                        name: "MonksActiveTiles.ctrl.quantity",
                        type: "number",
                        defvalue: 1,
                        min: 1,
                        step: 1,
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
                    const { tokens, action, userid } = args;

                    let checkText = async function (text, result) {
                        if (text.startsWith("{")) {
                            try {
                                let obj = JSON.parse(text);
                                if (obj.x || obj.y) {
                                    if (result.location == undefined) result.location = [];
                                    if (action.data.roll) {
                                        if (obj.x) obj.x = await rollDice(obj.x);
                                        if (obj.y) obj.y = await rollDice(obj.y);
                                    }
                                    return result.location.push(obj);
                                } else {
                                    if (game.system.id == "dnd5e") {
                                        if (Object.keys(obj).find(k => Object.keys(game.model.Actor.character.currency).find(c => c == k))) {
                                            if (result.items == undefined) result.items = [];
                                            if (action.data.roll) {
                                                for (let [k, v] of Object.entries(obj)) {
                                                    obj[k] = await rollDice(v);
                                                }
                                            }
                                            return result.items.push(obj);
                                        }
                                    }
                                }
                            } catch {}
                        }

                        if (result.text == undefined) result.text = [];
                        result.text.push(text);
                    }

                    //Find the roll table
                    let rolltable = await fromUuid(action.data?.rolltableid);
                    if (rolltable instanceof RollTable) {
                        //Make a roll

                        const available = rolltable.results.filter(r => !r.drawn);
                        if (!available.length && action?.data?.reset)
                            await rolltable.resetResults();

                        let results = { continue: true };
                        if (game.modules.get("better-rolltables")?.active) {
                            let BRTBuilder = await import('/modules/better-rolltables/scripts/core/brt-builder.js');
                            let BetterResults = await import('/modules/better-rolltables/scripts/core/brt-table-results.js');
                            let LootChatCard = await import('/modules/better-rolltables/scripts/loot/loot-chat-card.js');

                            const brtBuilder = new BRTBuilder.BRTBuilder(rolltable);
                            const tblResults = await brtBuilder.betterRoll(action.data?.quantity);

                            //action.data.rollmode
                            if (action.data.chatmessage !== false) {
                                if (game.settings.get('better-rolltables', 'use-condensed-betterroll')) {
                                    const br = new BetterResults.BetterResults(tblResults);
                                    const betterResults = await br.buildResults(rolltable);
                                    const currencyData = br.getCurrencyData();

                                    const lootChatCard = new LootChatCard.LootChatCard(betterResults, currencyData);
                                    await lootChatCard.createChatCard(rolltable);
                                } else {
                                    await brtBuilder.createChatCard(tblResults);
                                }
                            }

                            results.results = tblResults;
                            results.roll = brtBuilder.mainRoll;
                        } else {
                            let numRolls = action.data?.quantity || 1;
                            let tblResults = await rolltable.drawMany(numRolls, { rollMode: action.data.rollmode, displayChat: false });
                            //Check to see what the privacy rules are

                            if (action.data.chatmessage !== false) {
                                let user = game.users.find(u => u.id == userid);
                                let scene = game.scenes.find(s => s.id == user.viewedScene);
                                const speaker = { scene: scene?.id, actor: user?.character?.id, token: tokens[0]?.id, alias: user.name };
                                // Override the toMessage so that I can change the speaker

                                // Construct chat data
                                const nr = tblResults.results.length > 1 ? `${tblResults.results.length} results` : "a result";
                                let messageData = {
                                    flavor: `Draws ${nr} from the ${rolltable.name} table.`,
                                    user: userid,
                                    speaker: speaker,
                                    type: CONST.CHAT_MESSAGE_TYPES.ROLL,
                                    roll: tblResults.roll,
                                    sound: tblResults.roll ? CONFIG.sounds.dice : null,
                                    flags: { "core.RollTable": rolltable.id }
                                };

                                // Render the chat card which combines the dice roll with the drawn results
                                let description = await TextEditor.enrichHTML(rolltable.description, { entities: true, async: true })
                                messageData.content = await renderTemplate(CONFIG.RollTable.resultTemplate, {
                                    description: description,
                                    results: tblResults.results.map(r => {
                                        r.text = r.getChatText();
                                        return r;
                                    }),
                                    rollHTML: rolltable.displayRoll ? await tblResults.roll.render() : null,
                                    table: rolltable
                                });

                                if (action.data.rollmode != 'roll') {
                                    messageData.whisper = ChatMessage.getWhisperRecipients("GM").map(u => u.id);
                                    messageData.speaker = null;
                                    messageData.user = game.user.id;
                                }

                                // Create the chat message
                                ChatMessage.create(messageData, { rollMode: action.data.rollmode });
                            }

                            results.results = tblResults.results;
                            results.roll = tblResults.roll;
                        }

                        if (results.results.length) {
                            //roll table result
                            results;
                            for (let tableresult of results.results) {
                                let entity;

                                if (!tableresult.documentId) {
                                    await checkText(tableresult.text, results);
                                } else {
                                    let collection = game.collections.get(tableresult.documentCollection);
                                    if (!collection) {
                                        let pack = game.packs.get(tableresult.documentCollection);
                                        if (pack == undefined)
                                            await checkText(tableresult.text, results);
                                        else
                                            entity = await pack.getDocument(tableresult.documentId);
                                    } else
                                        entity = collection.get(tableresult.documentId);
                                }

                                MonksActiveTiles.addToResult(entity, results);
                            }
                        }

                        debug("Rolltable", results);

                        return results;
                    }
                },
                content: async (trigger, action) => {
                    let pack;
                    let rolltable = await fromUuid(action.data?.rolltableid);
                    if (rolltable?.pack)
                        pack = game.packs.get(rolltable.pack);
                    return `<span class="action-style">${i18n(trigger.name)}</span>, ${action.data?.quantity ? `<span class="value-style">&lt;${action.data?.quantity} items&gt;</span>` : ''} from <span class="entity-style">${pack ? pack.metadata.label + ":" : ""}${(rolltable?.name || 'Unknown Roll Table')}</span>`;
                }
            },
            'resetfog': {
                name: "MonksActiveTiles.action.resetfog",
                ctrls: [
                    /*
                    {
                        id: "for",
                        name: "MonksActiveTiles.ctrl.for",
                        list: "for",
                        type: "list"
                    }
                    */
                ],
                values: {
                    'for': {
                        'all': "MonksActiveTiles.for.all",
                        //'token': "MonksActiveTiles.for.token"
                    }
                },
                fn: async () => {
                    //if (action.data?.for == 'token') {
                    //canvas.sight._onResetFog(result)
                    //}
                    //else 
                    //canvas.sight.resetFog();
                    canvas.fog.reset();
                },
                content: async (trigger, action) => {
                    return `<span class="action-style">${i18n(trigger.name)}</span> for <span class="value-style">&lt;${(action.data?.for == 'token' ? 'Token' : 'Everyone')}&gt;</span>`;
                }
            },
            'activeeffect': {
                name: "MonksActiveTiles.action.activeeffect",
                options: { allowDelay: true },
                ctrls: [
                    {
                        id: "entity",
                        name: "MonksActiveTiles.ctrl.select-entity",
                        type: "select",
                        subtype: "entity",
                        options: { showToken: true, showWithin: true, showPlayers: true, showPrevious: true, showTagger: true },
                        restrict: (entity) => { return (entity instanceof Token); }
                    },
                    {
                        id: "effectid",
                        name: "MonksActiveTiles.ctrl.effectlist",
                        list: () => {
                            let result = {};
                            let conditions = CONFIG.statusEffects;
                            if (game.system.id == 'pf2e') {
                                conditions = game.pf2e.ConditionManager.conditions;
                                conditions = [...conditions].map(e => { return { id: e[0], label: e[1].name }; });
                            }
                            for (let effect of conditions.sort((a, b) => { return String(a.label).localeCompare(b.label) })) { //(i18n(a.label) > i18n(b.label) ? 1 : (i18n(a.label) < i18n(b.label) ? -1 : 0))
                                result[effect.id] = i18n(effect.label);
                            }
                            return result;
                        },
                        onChange: (app) => {
                            app.checkConditional();
                        },
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
                        defvalue: 'add'
                    },
                    {
                        id: "altereffect",
                        name: "Alter Effect",
                        type: "text",
                        conditional: (app) => {
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
                        'toggle': "MonksActiveTiles.add.toggle"

                    }
                },
                fn: async (args = {}) => {
                    const { action } = args;
                    let entities = await MonksActiveTiles.getEntities(args);
                    if (entities.length == 0)
                        return;

                    if (game.system.id == 'pf2e') {
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
                                            await token.actor.increaseCondition(effect.slug);
                                        }
                                    }
                                } else {
                                    let add = (action.data?.addeffect == 'add');

                                    if (action.data?.addeffect == 'toggle') {
                                        add = (existing == undefined);
                                    }

                                    if (add)
                                        await token.actor.increaseCondition(effect.slug);
                                    else
                                        await token.actor.decreaseCondition(effect.slug, { forceRemove: true });
                                }
                            }
                        }
                    } else {
                        let effect = CONFIG.statusEffects.find(e => e.id === action.data?.effectid);

                        if (effect) {
                            for (let token of entities) {
                                if (token == undefined)
                                    continue;

                                if (action.data?.addeffect == 'toggle')
                                    await token.object.toggleEffect(effect, { overlay: false });
                                else {
                                    const exists = (token.actor.effects.find(e => e.getFlag("core", "statusId") === effect.id) != undefined);
                                    if (exists != (action.data?.addeffect == 'add'))
                                        await token.object.toggleEffect(effect, { overlay: false });
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
                    let entityName = await MonksActiveTiles.entityName(action.data?.entity);
                    return `<span class="action-style">${effect.value ? "Alter" : i18n(trigger.values.add[action?.data?.addeffect || 'add'])}</span> <span class="details-style">"${(i18n(effect?.label) || effect?.name || 'Unknown Effect')}"</span>${effect.value ? " by " + action.data?.altereffect : ""} ${effect.value ? "on" : (action.data?.addeffect == 'add' ? "to" : (action.data?.addeffect == 'remove' ? "from" : "on"))} <span class="entity-style">${entityName}</span>`;
                }
            },
            'playanimation': {
                name: "MonksActiveTiles.action.playanimation",
                requiresGM: true,
                options: { allowDelay: true },
                ctrls: [
                    {
                        id: "entity",
                        name: "MonksActiveTiles.ctrl.select-entity",
                        type: "select",
                        subtype: "entity",
                        options: { showTile: true, showTagger: true },
                        restrict: (entity) => { return (entity instanceof Tile); },
                        defaultType: 'tiles'
                    },
                    {
                        id: "play",
                        name: "MonksActiveTiles.ctrl.animation",
                        list: "animate",
                        type: "list"
                    },
                    {
                        id: "animatefor",
                        name: "MonksActiveTiles.ctrl.for",
                        list: "animatefor",
                        type: "list"
                    }
                ],
                values: {
                    'animatefor': {
                        'all': "MonksActiveTiles.showto.everyone",
                        'token': "MonksActiveTiles.showto.trigger"

                    },
                    'animate': {
                        'start': "MonksActiveTiles.animate.start",
                        'pause': "MonksActiveTiles.animate.pause",
                        'stop': "MonksActiveTiles.animate.stop",
                        'toggle': "MonksActiveTiles.animate.toggle"

                    }
                },
                fn: async (args = {}) => {
                    const { action, userid } = args;
                    let entities = await MonksActiveTiles.getEntities(args, 'tiles');
                    if (entities.length == 0)
                        return;

                    for (let entity of entities) {
                        if (entity.object.isVideo) {
                            let play = action.data?.play;
                            if (play == "toggle")
                                play = entity.object?.sourceElement.paused ? "start" : "pause";
                            if (action.data.animatefor === 'token') {
                                if (userid == game.user.id) {
                                    if (play == 'stop')
                                        game.video.stop(entity.object?.sourceElement);
                                    else if (play == 'pause')
                                        entity.object?.sourceElement.pause();
                                    else
                                        entity.object?.sourceElement.play();
                                }
                                else
                                    MonksActiveTiles.emit('playvideo', { tileid: entity.uuid, play: play });
                            }
                            else {
                                entity.update({ "video.autoplay": false }, { diff: false, playVideo: play == 'start' });
                                if (play == 'stop') {
                                    MonksActiveTiles.emit('playvideo', { tileid: entity.uuid, play: play });
                                    const el = entity.object.sourceElement;
                                    if (el?.tagName !== "VIDEO") return;

                                    game.video.stop(el);
                                }
                            }
                        }
                    }

                    return { entities: entities };
                },
                content: async (trigger, action) => {
                    let entityName = await MonksActiveTiles.entityName(action.data?.entity, 'tiles');
                    return `<span class="action-style">${i18n(trigger.values.animate[action.data?.play])} animation</span> on <span class="entity-style">${entityName}</span> for <span class="value-style">&lt;${i18n(trigger.values.animatefor[action.data?.animatefor])}&gt;</span>`;
                }
            },
            'openjournal': {
                name: "MonksActiveTiles.action.openjournal",
                options: { allowDelay: true },
                ctrls: [
                    {
                        id: "entity",
                        name: "MonksActiveTiles.ctrl.select-entity",
                        type: "select",
                        subtype: "entity",
                        options: { showPrevious: true, showPlayers: true },
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
                                } catch {}
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

                                        if (entity && !(entity.pages.size == 1 && !!getProperty(entity.pages.contents[0], "flags.monks-enhanced-journal.type"))) {
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
                        id: "subsection",
                        name: "Subsection",
                        type: "text",
                        required: false
                    },
                    {
                        id: "showto",
                        name: "MonksActiveTiles.ctrl.showto",
                        list: "showto",
                        type: "list"
                    },
                    {
                        id: "permission",
                        name: "MonksActiveTiles.ctrl.usepermission",
                        type: "checkbox"
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
                        'everyone': "MonksActiveTiles.showto.everyone",
                        'gm': "MonksActiveTiles.showto.gm",
                        'players': "MonksActiveTiles.showto.players",
                        'trigger': "MonksActiveTiles.showto.trigger"

                    }
                },
                fn: async (args = {}) => {
                    const { action, userid } = args;

                    if (!MonksActiveTiles.allowRun)
                        return;

                    let entities;
                    if (action.data.entity.id == 'players') {
                        let user = game.users.get(userid);
                        if (user.isGM)
                            return;
                        entities = [game.journal.find(j => {
                            return j.testUserPermission(user, "OWNER");
                        })];
                    } else
                        entities = await MonksActiveTiles.getEntities(args, 'journal');

                    if (entities.length == 0)
                        return;

                    let showto = action.data.showto;

                    for (let entity of entities) {
                        //open journal
                        if (!entity)
                            continue;

                        if (["everyone", "players"].includes(showto) || (showto == "trigger" && userid != game.user.id)) {
                            MonksActiveTiles.emit('journal', {
                                showto: action.data.showto,
                                userid: userid,
                                entityid: entity.uuid,
                                permission: action.data.permission,
                                enhanced: action.data.enhanced,
                                page: action.data.page,
                                subsection: action.data.subsection?.slugify()
                            });
                        }

                        if (showto == "everyone" || (showto == "gm" && game.user.isGM) || (showto == "trigger" && userid == game.user.id) || (showto == "players" && !game.user.isGM)) {
                            if (game.modules.get("monks-enhanced-journal")?.active && entity instanceof JournalEntry && entity.pages.size == 1 && !!getProperty(entity.pages.contents[0], "flags.monks-enhanced-journal.type")) {
                                let type = getProperty(entity.pages.contents[0], "flags.monks-enhanced-journal.type");
                                if (type == "base" || type == "oldentry") type = "journalentry";
                                let types = game.MonksEnhancedJournal.getDocumentTypes();
                                if (types[type]) {
                                    entity = entity.pages.contents[0];
                                    game.MonksEnhancedJournal.fixType(entity);
                                }
                            }

                            if (action.data?.enhanced !== true || !game.modules.get("monks-enhanced-journal")?.active || !game.MonksEnhancedJournal.openJournalEntry(entity, { tempOwnership: !action.data.permission }))
                                entity.sheet.render(true, { force: !action.data.permission, pageId: action.data.page, anchor: action.data.subsection?.slugify() });
                        }
                    }

                    return { entities: entities };
                },
                content: async (trigger, action) => {
                    let entityName = await MonksActiveTiles.entityName(action.data?.entity, 'journal');
                    return `<span class="action-style">${i18n(trigger.name)}</span>, <span class="entity-style">${entityName}</span> for <span class="value-style">&lt;${i18n(trigger.values.showto[action.data?.showto])}&gt;</span>`;
                }
            },
            'openactor': {
                name: "MonksActiveTiles.action.openactor",
                options: { allowDelay: true },
                ctrls: [
                    {
                        id: "entity",
                        name: "MonksActiveTiles.ctrl.select-entity",
                        type: "select",
                        subtype: "entity",
                        options: { showPrevious: true, showTagger: true, showWithin: true, showPlayers: true },
                        restrict: (entity) => { return (entity instanceof Actor || entity instanceof Token); },
                        required: true,
                        defaultType: 'actor',
                        placeholder: 'Please select a Token or Actor'
                    },
                    {
                        id: "showto",
                        name: "MonksActiveTiles.ctrl.showto",
                        list: "showto",
                        type: "list"
                    },
                ],
                values: {
                    'showto': {
                        'everyone': "MonksActiveTiles.showto.everyone",
                        'gm': "MonksActiveTiles.showto.gm",
                        'players': "MonksActiveTiles.showto.players",
                        'trigger': "MonksActiveTiles.showto.trigger"

                    }
                },
                fn: async (args = {}) => {
                    const { action, userid } = args;
                    let entities;
                    if (action.data.entity.id == 'players') {
                        let user = game.users.get(userid);
                        if (user.isGM)
                            return;
                        entities = [user.character];
                    } else
                        entities = await MonksActiveTiles.getEntities(args, 'actor');

                    if (entities.length == 0)
                        return;

                    for (let entity of entities) {
                        if (entity instanceof TokenDocument)
                            entity = entity.actor;
                        //open actor
                        if (entity && action.data.showto != 'gm')
                            MonksActiveTiles.emit('actor', { showto: action.data.showto, userid: userid, entityid: entity.uuid, permission: action.data.permission, enhanced: action.data.enhanced });
                        if (MonksActiveTiles.allowRun && (action.data.showto == 'everyone' || action.data.showto == 'gm' || action.data.showto == undefined || (action.data.showto == 'trigger' && userid == game.user.id))) {
                            entity.sheet.render(true);
                        }
                    }

                    return { entities: entities };
                },
                content: async (trigger, action) => {
                    let entityName = await MonksActiveTiles.entityName(action.data?.entity, 'actor');
                    return `<span class="action-style">${i18n(trigger.name)}</span>, <span class="entity-style">${entityName}</span> for <span class="value-style">&lt;${i18n(trigger.values.showto[action.data?.showto])}&gt;</span>`;
                }
            },
            'additem': {
                name: "MonksActiveTiles.action.additem",
                options: { allowDelay: true },
                ctrls: [
                    {
                        id: "entity",
                        name: "MonksActiveTiles.ctrl.select-entity",
                        type: "select",
                        subtype: "entity",
                        options: { showToken: true, showWithin: true, showPlayers: true, showPrevious: true, showTagger: true },
                        restrict: (entity) => { return (entity instanceof Token); }
                    },
                    {
                        id: "item",
                        name: "MonksActiveTiles.ctrl.select-item",
                        type: "select",
                        subtype: "entity",
                        options: { showPrevious: true },
                        restrict: (entity) => { return (entity instanceof Item); },
                        required: true,
                        placeholder: 'Please select an item',
                        defaultType: 'items'
                    },
                    {
                        id: "quantity",
                        name: "MonksActiveTiles.ctrl.quantity",
                        type: "number",
                        defvalue: 1,
                        min: 1,
                        step: 1,
                        help: "Set this to blank to use the items original quantity"
                    },
                    {
                        id: "distribute",
                        name: "MonksActiveTiles.ctrl.distribution",
                        list: "distribute",
                        type: "list"
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
                                            switch (game.system.id) {
                                                case "pf2e":
                                                    itemData.system.quantity = { value: action.data?.quantity };
                                                    break;
                                                case "gurps":
                                                    itemData.system.eqt.count = action.data?.quantity;
                                                    break;
                                                default:
                                                    itemData.system.quantity = action.data?.quantity;
                                                    break;
                                            }
                                        }
                                        batch.add("create", item.constructor, itemData, { parent: actor });
                                        //addItems.push(itemData);
                                    } else if (typeof item === 'object') {
                                        // This is potentially currency
                                        let update = {};
                                        if (game.system.id == "dnd5e") {
                                            for (let [k, v] of Object.entries(item)) {
                                                if (actor.system.currency[k] != undefined) {
                                                    let value = await rollDice(v);
                                                    update[k] = actor.system.currency[k] + parseInt(value);
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
                    let entityName = await MonksActiveTiles.entityName(action.data?.entity);
                    let item = await MonksActiveTiles.entityName(action.data?.item, "items"); //await fromUuid(action.data?.item.id);
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
                        options: { showToken: true, showWithin: true, showPlayers: true, showPrevious: true, showTagger: true },
                        restrict: (entity) => { return (entity instanceof Token); }
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
                        type: "number",
                        defvalue: 1,
                        min: 1,
                        step: 1
                    },
                ],
                fn: async (args = {}) => {
                    const { action } = args;
                    let entities = await MonksActiveTiles.getEntities(args);
                    if (entities.length == 0)
                        return;

                    let quantity = action.data.quantity;
                    if (quantity != "all") {
                        quantity = parseInt(quantity);
                        if (quantity < 1)
                            quantity = 1;
                    }

                    let batch = new BatchManager();
                    for (let token of entities) {
                        if (token instanceof TokenDocument) {
                            const actor = token.actor;
                            if (!actor) return;

                            let item = actor.items.find(i => i.name == action.data.item);
                            if (item) {
                                let itemQuantity = (item.system.quantity.hasOwnProperty("value") ? item.system.quantity.value : item.system.quantity);
                                if (quantity == "all" || itemQuantity <= quantity) {
                                    batch.add("delete", item);
                                } else {
                                    itemQuantity -= quantity;
                                    batch.add("update", item, { system: { quantity: (item.system.quantity.hasOwnProperty("value") ? { value: itemQuantity } : itemQuantity) } });
                                }
                            }
                        }
                    }

                    await batch.execute();

                    return { tokens: entities, entities: entities };
                },
                content: async (trigger, action) => {
                    let entityName = await MonksActiveTiles.entityName(action.data?.entity);
                    return `<span class="action-style">${i18n(trigger.name)}</span>, Remove <span class="value-style">&lt;${action.data?.quantity || "item's quantity"}&gt;</span> <span class="details-style">"${action.data?.item || 'Unknown Item'}"</span> from <span class="entity-style">${entityName}</span>`;
                }
            },
            'permissions': {
                name: "MonksActiveTiles.action.permission",
                options: { allowDelay: false },
                requiresGM: true,
                ctrls: [
                    {
                        id: "entity",
                        name: "MonksActiveTiles.ctrl.select-entity",
                        type: "select",
                        required: true,
                        subtype: "entity",
                        options: { showPrevious: true, showTagger: true },
                        restrict: (entity) => {
                            return (
                                entity instanceof Token ||
                                entity instanceof Note ||
                                entity instanceof JournalEntry ||
                                entity instanceof Scene ||
                                entity instanceof Actor
                            );
                        },
                        defaultType: 'journal',
                        placeholder: 'Please select an entity',
                        help: 'You can change permissions for Journals, Notes, Tokens, Actors, or Scenes'
                    },
                    {
                        id: "changefor",
                        name: "MonksActiveTiles.ctrl.changefor",
                        list: "showto",
                        type: "list"
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
                        'everyone': "MonksActiveTiles.showto.everyone",
                        'trigger': "MonksActiveTiles.showto.trigger"

                    },
                    'permissions': {
                        'default': "OWNERSHIP.DEFAULT",
                        'none': "OWNERSHIP.NONE",
                        'limited': "OWNERSHIP.LIMITED",
                        'observer': "OWNERSHIP.OBSERVER",
                        'owner': "OWNERSHIP.OWNER"

                    }
                },
                fn: async (args = {}) => {
                    const { action, userid } = args;
                    let entities = await MonksActiveTiles.getEntities(args);
                    if (entities.length == 0)
                        return;

                    let level = (action.data.permission == 'limited' ? CONST.DOCUMENT_OWNERSHIP_LEVELS.LIMITED :
                        (action.data.permission == 'observer' ? CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER :
                            (action.data.permission == 'owner' ? CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER : CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE)));

                    entities = entities.map(e => (e.actor ? game.actors.get(e.actor.id) : e));

                    //MonksActiveTiles.preventCycle = true;   //prevent the cycling of tokens due to permission changes
                    game.settings.set('monks-active-tiles', 'prevent-cycle', true);
                    for (let entity of entities) {
                        if (!entity)
                            continue;
                        let lvl = level;
                        if (entity instanceof Scene)
                            lvl = CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER;
                        const perms = entity.ownership || entity.actor?.ownership;
                        if (action.data.changefor == 'trigger') {
                            let user = game.users.get(userid);
                            if (!user.isGM) {
                                if (action.data.permission == 'default')
                                    delete perms[user.id];
                                else
                                    perms[user.id] = lvl;
                            }
                        } else {
                            if (action.data.permission == 'default') {
                                for (let user of game.users.contents) {
                                    if (user.isGM) continue;
                                    delete perms[user.id];
                                }
                            } else
                                perms.default = lvl;
                        }

                        await entity.setFlag('monks-active-tiles', 'prevent-cycle', true);
                        await entity.update({ permission: perms }, { diff: false, render: true, recursive: false, noHook: true });
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
                    let entityName = await MonksActiveTiles.entityName(action.data?.entity);
                    return `<span class="action-style">${i18n(trigger.name)}</span> of <span class="entity-style">${entityName}</span> to <span class="details-style">"${i18n(trigger.values.permissions[action.data?.permission])}"</span> for <span class="value-style">&lt;${i18n(trigger.values.showto[action.data?.changefor])}&gt;</span>`;
                }
            },
            'attack': {
                name: "MonksActiveTiles.action.attack",
                options: { allowDelay: false },
                ctrls: [
                    {
                        id: "entity",
                        name: "MonksActiveTiles.ctrl.select-entity",
                        type: "select",
                        subtype: "entity",
                        options: { showToken: true, showWithin: true, showPlayers: true, showPrevious: true },
                        restrict: (entity) => { return (entity instanceof Token); }
                    },
                    {
                        id: "actor",
                        name: "MonksActiveTiles.ctrl.select-actor",
                        type: "select",
                        subtype: "entity",
                        restrict: (entity) => { return (entity instanceof Actor || entity instanceof Token); },
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
                        id: "rollmode",
                        name: 'MonksActiveTiles.ctrl.rollmode',
                        list: "rollmode",
                        type: "list"
                    },
                    {
                        id: "rollattack",
                        name: "MonksActiveTiles.ctrl.rollattack",
                        type: "checkbox",
                        help: "If you're wanting to integrate with MidiQol, turn this on."
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
                    const { action } = args;
                    let entities = await MonksActiveTiles.getEntities(args);
                    if (entities.length == 0)
                        return;

                    for (let entity of entities) {
                        if (entity)
                            entity?.object?.setTarget(true, { releaseOthers: false });
                    }

                    //get the actor and the attack and the entities to apply this to.
                    if (action.data?.actor.id) {
                        let actor = await fromUuid(action.data?.actor.id);
                        if (actor && actor instanceof TokenDocument)
                            actor = actor.actor;
                        if (actor) {
                            let item = actor.items.get(action.data?.attack?.id);

                            if (item) {
                                if (action.data?.rollattack && item.useAttack)
                                    item.useAttack({ skipDialog: true });
                                else if (action.data?.rollattack && item.use)
                                    item.use({ rollMode: (action.data?.rollmode || 'roll') });
                                else if (item.displayCard)
                                    item.displayCard({ rollMode: (action.data?.rollmode || 'roll'), createMessage: true }); //item.roll({configureDialog:false});
                                else if (item.toChat)
                                    item.toChat(); //item.roll({configureDialog:false});
                            } else
                                warn(`Could not find the attack item when using the attack action`);
                        } else
                            warn(`Could not find actor when using the attack action`);
                    }

                    return { tokens: entities, entities: entities };
                },
                content: async (trigger, action) => {
                    if (!action.data?.actor.id)
                        return i18n(trigger.name);
                    let entityName = await MonksActiveTiles.entityName(action.data?.entity);
                    let actor = await fromUuid(action.data?.actor.id);
                    if (actor && actor instanceof TokenDocument)
                        actor = actor.actor;
                    let item = actor?.items?.get(action.data?.attack?.id);
                    return `<span class="action-style">${i18n(trigger.name)}</span> <span class="entity-style">${entityName}</span> using <span class="details-style">"${actor?.name || 'Unknown Actor'}: ${item?.name || 'Unknown Item'}"</span>`;
                }
            },
            'trigger': {
                name: "MonksActiveTiles.action.trigger",
                options: { allowDelay: true },
                ctrls: [
                    {
                        id: "entity",
                        name: "MonksActiveTiles.ctrl.select-tile",
                        type: "select",
                        subtype: "entity",
                        required: true,
                        options: { showTile: true, showTagger: true, showPrevious: true },
                        restrict: (entity) => { return (entity instanceof Tile); },
                        defaultType: 'tiles',
                        placeholder: "Please select a Tile"
                    },
                    {
                        id: "token",
                        name: "MonksActiveTiles.ctrl.select-entity",
                        type: "select",
                        subtype: "entity",
                        options: { showToken: true, showWithin: true, showPlayers: true, showPrevious: true },
                        restrict: (entity) => { return (entity instanceof Token); }
                    },
                    {
                        id: "landing",
                        name: "MonksActiveTiles.ctrl.landing",
                        type: "text",
                        help: "go to this landing when triggering the tile"
                    },
                    {
                        id: "return",
                        name: "MonksActiveTiles.ctrl.returndata",
                        type: "checkbox",
                        defvalue: true,
                        help: "Add the data this Tile returns to the current data"
                    }
                ],
                fn: async (args = {}) => {
                    const { tile, userid, action, method, value } = args;
                    let entities = await MonksActiveTiles.getEntities(args, 'tiles');
                    if (entities.length == 0)
                        return;

                    let tokens = await MonksActiveTiles.getEntities(args, "tokens", (action.data?.token || { id: "previous" }));

                    let promises = [];
                    for (let entity of entities) {
                        if (!(entity instanceof TileDocument))
                            continue;

                        let landing = action.data?.landing;
                        if (landing && landing.includes("{{")) {
                            let context = {
                                actor: tokens[0]?.actor?.toObject(false),
                                token: tokens[0]?.toObject(false),
                                tile: tile.toObject(false),
                                entity: entity,
                                user: game.users.get(userid),
                                value: value,
                                scene: canvas.scene,
                                method: method
                            };

                            const compiled = Handlebars.compile(landing);
                            landing = compiled(context, { allowProtoMethodsByDefault: true, allowProtoPropertiesByDefault: true }).trim();
                        }

                        let newargs = Object.assign({}, args, {
                            tokens: tokens,
                            tile: entity,
                            method: "trigger",
                            options: { landing: landing, originalMethod: method }
                        });
                        promises.push(entity.trigger.call(entity, newargs));
                    }

                    return Promise.all(promises).then((results) => {
                        if (action.data.return === false)
                            return;

                        let value = {};
                        for (let result of results) {
                            mergeObject(value, result.value);
                        }
                        return value;
                    });
                },
                content: async (trigger, action) => {
                    let entityName = await MonksActiveTiles.entityName(action.data?.entity, 'tiles');
                    return `<span class="action-style">${i18n(trigger.name)}</span>, <span class="entity-style">${entityName}</span>`;
                }
            },
            'scene': {
                name: "MonksActiveTiles.action.scene",
                options: { allowDelay: true },
                ctrls: [
                    {
                        id: "sceneid",
                        name: "MonksActiveTiles.ctrl.scene",
                        list: () => {
                            let result = { "_active": "-- Active Scene --", "_previous": "-- Current Scene Collection --" };
                            for (let s of game.scenes)
                                result[s.id] = s.name;
                            return result;
                        },
                        type: "list",
                        required: true
                    },
                    {
                        id: "activate",
                        name: "MonksActiveTiles.ctrl.activate",
                        type: "checkbox"
                    }
                ],
                fn: async (args = {}) => {
                    const { action, userid, value } = args;
                    let scene;

                    if (action.data.sceneid == "_previous")
                        scene = value.scenes && value.scenes.length ? value.scenes[0] : null;
                    else
                        scene = game.scenes.find(s => (action.data.sceneid == "_active" ? s.active : s.id == action.data.sceneid));

                    if (scene) {
                        if (game.user.id == userid || action.data.activate) {
                            let oldPing = game.user.permissions["PING_CANVAS"];
                            game.user.permissions["PING_CANVAS"] = false;
                            await (action.data.activate ? scene.activate() : scene.view());
                            window.setTimeout(() => {
                                if (oldPing == undefined)
                                    delete game.user.permissions["PING_CANVAS"];
                                else
                                    game.user.permissions["PING_CANVAS"] = oldPing;
                            }, 500);
                        } else
                            MonksActiveTiles.emit('switchview', { userid: [userid], sceneid: scene.id });
                    }
                },
                content: async (trigger, action) => {
                    let scene = game.scenes.find(s => (action.data.sceneid == "_active" ? s.active : s.id == action.data.sceneid));
                    return `<span class="action-style">${i18n(trigger.name)}</span> to <span class="detail-style">"${action.data.sceneid == "_active" ? "(Active Scene)" : ""} ${scene?.name || "Unknown Scene"}"</span>${(action.data.activate ? ' <i class="fas fa-bullseye" title="Activate Scene"></i>' : '')}`
                }
            },
            'scenebackground': {
                name: "MonksActiveTiles.action.scenebackground",
                options: { allowDelay: true },
                ctrls: [
                    {
                        id: "sceneid",
                        name: "MonksActiveTiles.ctrl.scene",
                        list: () => {
                            let result = {};
                            for (let s of game.scenes)
                                result[s.id] = s.name;
                            return result;
                        },
                        type: "list",
                        required: true
                    },
                    {
                        id: "img",
                        name: "MonksActiveTiles.ctrl.image",
                        type: "filepicker",
                        subtype: "image",
                        required: true
                    }
                ],
                fn: async (args = {}) => {
                    const { action, userid } = args;
                    let scene = game.scenes.find(s => s.id == action.data.sceneid);
                    scene.update({ img: action.data.img });
                },
                content: async (trigger, action) => {
                    let scene = game.scenes.find(s => s.id == action.data.sceneid);
                    return `<span class="action-style">${i18n(trigger.name)}</span> set <span class="detail-style">"${scene?.name}"</span> to <span class="value-style">&lt;${action.data.img}&gt;</span>`
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
                        options: { showToken: true, showWithin: true, showPlayers: true, showPrevious: true, showTagger: true },
                        restrict: (entity) => { return (entity instanceof Token); },
                        defaultType: 'tokens'
                    },
                    {
                        id: "addto",
                        name: "Add to Combat",
                        type: "list",
                        onChange: (app) => {
                            app.checkConditional();
                        },
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

                        if (combat && action.data.start && !combat.started)
                            combat.startCombat();
                    }
                    await batch.execute();

                    return { tokens: entities, entities: entities, combat: combat };
                },
                content: async (trigger, action) => {
                    let entityName = await MonksActiveTiles.entityName(action.data?.entity);
                    return `Add <span class="entity-style">${entityName}</span> to <span class="action-style">Combat</span>${(action.data.start ? ' <i class="fas fa-fist-raised" title="Start Combat"></i>' : '')}`;
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
                        options: { showToken: true, showWithin: true, showPlayers: true, showPrevious: true, showTagger: true },
                        restrict: (entity) => { return (entity instanceof Token); }
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
                    const { tile, tokens, action, userid, value, method, change } = args;
                    let entities = await MonksActiveTiles.getEntities(args);

                    if (entities && entities.length > 0) {
                        for (let entity of entities) {
                            if (!(entity instanceof TokenDocument))
                                continue;

                            let prop = getProperty(entity, 'elevation');

                            if (prop == undefined) {
                                warn("Couldn't find attribute", entity);
                                continue;
                            }

                            let update = {};
                            let val = action.data.value;

                            let context = {
                                actor: tokens[0]?.actor?.toObject(false),
                                token: tokens[0]?.toObject(false),
                                tile: tile.toObject(false),
                                entity: entity,
                                user: game.users.get(userid),
                                value: value,
                                scene: canvas.scene,
                                method: method,
                                change: change
                            };
                            if (val.includes("{{")) {
                                const compiled = Handlebars.compile(val);
                                val = compiled(context, { allowProtoMethodsByDefault: true, allowProtoPropertiesByDefault: true }).trim();
                            }

                            /*
                           const rgx = /\[\[(\/[a-zA-Z]+\s)?(.*?)([\]]{2,3})(?:{([^}]+)})?/gi;
                           val = await MonksActiveTiles.inlineRoll(val, rgx, action.data.chatMessage, action.data.rollmode, entity);
                           */

                            if (val.startsWith('+ ') || val.startsWith('- ')) {
                                val = eval(prop + val);
                            }

                            if (!isNaN(val) && !isNaN(parseFloat(val)))
                                val = parseFloat(val);

                            update.elevation = val;
                            MonksActiveTiles.batch.add("update", entity, update);
                        }

                        return { tokens: entities, entities: entities };
                    }
                },
                content: async (trigger, action) => {
                    let entityName = await MonksActiveTiles.entityName(action.data?.entity);
                    let actionName = 'Set';
                    let midName = 'to';
                    let value = action.data?.value;
                    if (action.data?.value.startsWith('+ ') || action.data?.value.startsWith('- ')) {
                        actionName = (action.data?.value.startsWith('+ ') ? "Increase" : "Decrease");
                        midName = "by";
                        value = action.data?.value.substring(2);
                    }
                    return `<span class="action-style">${actionName} elevation</span> of <span class="entity-style">${entityName}</span> ${midName} <span class="details-style">"${value}"</span>`;
                }
            },
            'resethistory': {
                name: "MonksActiveTiles.action.resethistory",
                options: { allowDelay: true },
                ctrls: [
                    {
                        id: "entity",
                        name: "MonksActiveTiles.ctrl.select-entity",
                        type: "select",
                        subtype: "entity",
                        options: { showTile: true, showTagger: true },
                        restrict: (entity) => { return (entity instanceof Tile); },
                        defaultType: 'tiles'
                    },
                    {
                        id: "token",
                        name: "MonksActiveTiles.ctrl.select-entity",
                        type: "select",
                        subtype: "entity",
                        options: { showToken: true, showWithin: true, showPlayers: true, showPrevious: true, showTagger: true },
                        restrict: (entity) => { return (entity instanceof Token); },
                    }
                ],
                fn: async (args = {}) => {
                    const { action } = args;
                    let entities = await MonksActiveTiles.getEntities(args, 'tiles');
                    let tokens = await MonksActiveTiles.getEntities(args, 'tokens', action.data?.token);

                    if (entities && entities.length > 0) {
                        for (let entity of entities) {
                            if (entity instanceof TileDocument) {
                                if (tokens && tokens.length > 0) {
                                    for(let token of tokens)
                                        await entity.resetHistory(token.id);
                                } else if (!action.data?.token) {
                                    await entity.resetHistory();
                                }
                            }
                        }
                    }
                },
                content: async (trigger, action) => {
                    let entityName = await MonksActiveTiles.entityName(action.data?.entity, 'tiles');
                    return `<span class="action-style">Reset Tile trigger history</span> for <span class="entity-style">${entityName}</span>`;
                }
            },
            'imagecycle': {
                name: "MonksActiveTiles.action.imagecycle",
                requiresGM: true,
                visible: false,
                options: { allowDelay: true },
                ctrls: [
                    {
                        id: "entity",
                        name: "MonksActiveTiles.ctrl.select-entity",
                        type: "select",
                        subtype: "entity",
                        options: { showTile: true },
                        restrict: (entity) => { return (entity instanceof Tile); },
                        defaultType: 'tiles'
                    },
                    {
                        id: "imgat",
                        name: "MonksActiveTiles.ctrl.imgat",
                        type: "number",
                        defvalue: 1
                    },
                    {
                        id: "random",
                        name: "MonksActiveTiles.ctrl.random",
                        type: "checkbox",
                        defvalue: false
                    },
                    {
                        id: "transition",
                        name: "MonksActiveTiles.ctrl.transition",
                        type: "list",
                        list: "transition",
                        defvalue: "none",
                        onChange: (app) => {
                            app.checkConditional();
                        }
                    },
                    {
                        id: "spins",
                        name: "MonksActiveTiles.ctrl.spins",
                        type: "number",
                        defvalue: 3,
                        conditional: (app) => { return $('select[name="data.transition"]', app.element).val() == "slotmachine"; }
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
                        id: "files",
                        name: "MonksActiveTiles.ctrl.images",
                        type: "filelist",
                        required: true
                    },
                ],
                values: {
                    'transition': {
                        "none": 'MonksActiveTiles.transition.none',
                        "fade": 'MonksActiveTiles.transition.fade',
                        "slide-left": 'MonksActiveTiles.transition.slide-left',
                        "slide-up": 'MonksActiveTiles.transition.slide-up',
                        "slide-right": 'MonksActiveTiles.transition.slide-right',
                        "slide-down": 'MonksActiveTiles.transition.slide-down',
                        "slide-random": 'MonksActiveTiles.transition.slide-random',
                        "bump-left": 'MonksActiveTiles.transition.bump-left',
                        "bump-up": 'MonksActiveTiles.transition.bump-up',
                        "bump-right": 'MonksActiveTiles.transition.bump-right',
                        "bump-down": 'MonksActiveTiles.transition.bump-down',
                        "bump-random": 'MonksActiveTiles.transition.bump-random',
                        "slotmachine": 'MonksActiveTiles.transition.slotmachine'
                    }
                },
                fn: async (args = {}) => {
                    const { tile, tokens, action, userid, value } = args;

                    warn("Image Cycle has been deprecated, add images to the Tile and use the Switch Tile Image action");
                    return;

                    /*
                    let entities = await MonksActiveTiles.getEntities(args, 'tiles');
        
                    tile._cycleimages = tile._cycleimages || {};
                    let files = tile._cycleimages[action.id];
                    if (files == undefined) {
                        let actfiles = (action.data?.files || []);
                        files = tile._cycleimages[action.id] = await MonksActiveTiles.getTileFiles(actfiles);
                    }
        
                    if (entities && entities.length > 0 && files.length > 0) {
                        let actions = duplicate(tile.getFlag('monks-active-tiles', 'actions'));
                        let act = actions.find(a => a.id == action.id);
        
                        let oldIdx = (act.data?.imgat || 1) - 1;
                        if (action.data.random === true)
                            act.data.imgat = Math.floor(Math.random() * files.length) + 1;
                        else
                            act.data.imgat = (Math.clamped((act.data?.imgat || 1), 1, files.length) % files.length) + 1;
        
                        let newIdx = (act.data?.imgat || 1) - 1;
        
                        await tile.setFlag('monks-active-tiles', 'actions', actions);
        
                        if (act.data.transition == "slotmachine" || (act.data.transition == undefined && act.data.slot)) {
                            let promises = [];
                            let time = new Date().getTime() + (action.data?.speed * 1000);
                            MonksActiveTiles.emit("slotmachine", {
                                id: action.id,
                                cmd: "prep",
                                tileid: tile.uuid,
                                entities: entities.map(e => { return { entityid: e.uuid } })
                            });
                            for (let entity of entities) {
                                promises.push(MonksActiveTiles.rollSlot(entity, files, oldIdx, newIdx, act.data.spins, time));
                            }
                            return Promise.all(promises).then(() => {
                                return { entities: entities };
                            });
                        } else if (act.data.transition == "none") {
                            for (let entity of entities) {
                                if (files[act.data.imgat - 1])
                                    await entity.update({ img: files[act.data.imgat - 1] });
                            }
                            return { entities: entities };
                        } else {
                            if (files[newIdx]) {
                                let transition = act.data.transition;
                                if (transition.endsWith("random")) {
                                    let options = ["left", "right", "up", "down"];
                                    transition = transition.replace('random', options[Math.floor(Math.random() * 4)]);
                                }
        
        
                                let time = new Date().getTime() + (action.data?.speed * 1000);
                                let promises = [];
                                MonksActiveTiles.emit("transition", {
                                    id: action.id,
                                    transition: transition,
                                    tileid: tile.uuid,
                                    entities: entities.map(e => { return { entityid: e.uuid, from: e.data.img } }),
                                    img: files[newIdx],
                                    time: time
                                });
                                for (let entity of entities) {
                                    promises.push(MonksActiveTiles.transitionImage(entity, entity.data.img, files[newIdx], transition, time).then(async () => {
                                        await entity.update({ img: files[act.data.imgat - 1] });
                                    }));
                                }
                                return Promise.all(promises).then(async () => {
                                    return { entities: entities };
                                });
                            }
                        }
                    }*/
                },
                content: async (trigger, action) => {
                    let entityName = await MonksActiveTiles.entityName(action.data?.entity, 'tiles');
                    return `<span style="color: darkred;">DEPRECATED</span> <span class="action-style">${i18n(trigger.name)}</span> has been deprecated, use Switch Tile Image`; //`<span class="action-style">${i18n(trigger.name)}</span> for <span class="entity-style">${entityName}</span>${(action.data?.random ? ' <i class="fas fa-random" title="Pick a random image"></i>' : "")} ${action.data?.transition != "none" ? `<span class="detail-style">"${i18n("MonksActiveTiles.transition." + action.data?.transition)}"</span>` : ''}`;
                }
            },
            'imagecycleset': {
                name: "MonksActiveTiles.action.imagecycleset",
                requiresGM: true,
                visible: false,
                options: { allowDelay: true },
                ctrls: [
                    {
                        id: "entity",
                        name: "MonksActiveTiles.ctrl.select-entity",
                        type: "select",
                        subtype: "entity",
                        options: { showTile: true, showTagger: true },
                        restrict: (entity) => { return (entity instanceof Tile); },
                        defaultType: 'tiles'
                    },
                    {
                        id: "imgat",
                        name: "MonksActiveTiles.ctrl.imgat",
                        type: "text",
                        defvalue: 1,
                        help: "you can also use <i>first</i>, <i>last</i>, or <i>random</i> to select a spot"
                    },
                    {
                        id: "transition",
                        name: "MonksActiveTiles.ctrl.transition",
                        type: "list",
                        list: "transition",
                        defvalue: "none",
                        onChange: (app) => {
                            app.checkConditional();
                        }
                    },
                    {
                        id: "speed",
                        name: "MonksActiveTiles.ctrl.duration",
                        type: "number",
                        defvalue: 1,
                        step: "0.05",
                        conditional: (app) => { return $('select[name="data.transition"]', app.element).val() != "none"; }
                    },
                ],
                values: {
                    'transition': {
                        "none": 'MonksActiveTiles.transition.none',
                        "fade": 'MonksActiveTiles.transition.fade',
                        "slide-left": 'MonksActiveTiles.transition.slide-left',
                        "slide-up": 'MonksActiveTiles.transition.slide-up',
                        "slide-right": 'MonksActiveTiles.transition.slide-right',
                        "slide-down": 'MonksActiveTiles.transition.slide-down',
                        "slide-random": 'MonksActiveTiles.transition.slide-random',
                        "bump-left": 'MonksActiveTiles.transition.bump-left',
                        "bump-up": 'MonksActiveTiles.transition.bump-up',
                        "bump-right": 'MonksActiveTiles.transition.bump-right',
                        "bump-down": 'MonksActiveTiles.transition.bump-down',
                        "bump-random": 'MonksActiveTiles.transition.bump-random',
                        "slotmachine": 'MonksActiveTiles.transition.slotmachine'
                    }
                },
                fn: async (args = {}) => {
                    const { tile, tokens, action, userid, value } = args;

                    warn("Image Cycle has been deprecated, add images to the Tile and use the Switch Tile Image action");
                    return;

                    /*
                    let entities = await MonksActiveTiles.getEntities(args, 'tiles');
        
                    if (entities && entities.length > 0) {
                        for (let entity of entities) {
        
                            let actions = duplicate(entity.getFlag('monks-active-tiles', 'actions'));
                            let act = actions.find(a => a.action == "imagecycle");
        
                            if (act) {
                                entity._cycleimages = entity._cycleimages || {};
                                let files = entity._cycleimages[act.id];
                                if (files == undefined) {
                                    let actfiles = (act.data?.files || []);
                                    files = entity._cycleimages[act.id] = await MonksActiveTiles.getTileFiles(actfiles);
                                }
        
                                let position = action.data?.imgat ?? "first";
                                if (position == "first")
                                    position = 1;
                                else if (position == "last")
                                    position = files.length;
                                else if (position == "random")
                                    position = Math.floor(Math.random() * files.length) + 1;
                                else
                                    position = parseInt(position);
        
                                position = Math.clamped(position, 1, files.length);
        
                                if (act.data.transition == "none") {
                                    if (files[position - 1]) {
                                        act.data.imgat = position;
                                        await entity.update({ img: files[position - 1], 'flags.monks-active-tiles.actions': actions });
                                        //await entity.setFlag('monks-active-tiles', 'actions', actions);
                                    }
                                } else {
                                    if (files[position - 1]) {
                                        let transition = act.data.transition;
                                        if (transition.endsWith("random")) {
                                            let options = ["left", "right", "up", "down"];
                                            transition = transition.replace('random', options[Math.floor(Math.random() * 4)]);
                                        }
        
                                        let time = new Date().getTime() + (action.data?.speed * 1000);
        
                                        MonksActiveTiles.emit("transition", {
                                            id: action.id,
                                            transition: transition,
                                            tileid: tile.uuid,
                                            entities: [ { entityid: entity.uuid, from: entity.data.img } ],
                                            img: files[position - 1],
                                            time: time
                                        });
                                        MonksActiveTiles.transitionImage(entity, entity.data.img, files[position - 1], transition, time).then(async () => {
                                            await entity.update({ img: files[position - 1], 'flags.monks-active-tiles.actions': actions });
                                            //await entity.setFlag('monks-active-tiles', 'actions', actions);
                                        });
                                    }
                                }
                            }
                        }
                    }
                    */
                },
                content: async (trigger, action) => {
                    let entityName = await MonksActiveTiles.entityName(action.data?.entity, 'tiles');
                    return `<span style="color: darkred;">DEPRECATED</span> <span class="action-style">${i18n(trigger.name)}</span> has been deprecated, use Switch Tile Image`; //`<span class="action-style">${i18n(trigger.name)}</span> to <span class="details-style">"${action.data.imgat}"</span> for <span class="entity-style">${entityName}</span>`;
                }
            },
            'tileimage': {
                name: "MonksActiveTiles.action.tileimage",
                requiresGM: true,
                options: { allowDelay: true },
                ctrls: [
                    {
                        id: "entity",
                        name: "MonksActiveTiles.ctrl.select-entity",
                        type: "select",
                        subtype: "entity",
                        options: { showTile: true, showTagger: true },
                        restrict: (entity) => { return (entity instanceof Tile); },
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
                        onChange: (app) => {
                            app.checkConditional();
                        }
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
                    const { tile, tokens, action, userid, value, method, change } = args;
                    let entities = await MonksActiveTiles.getEntities(args, 'tiles');

                    let promises = [];
                    if (entities && entities.length > 0) {
                        for (let entity of entities) {
                            if (entity._object._transition)
                                continue;   //Don't add another transition if there's already a transition happening.

                            if (entity._images == undefined) {
                                entity._images = await MonksActiveTiles.getTileFiles(entity.flags["monks-active-tiles"].files || []);
                            }

                            let getPosition = async function () {
                                let fileindex = entity.flags["monks-active-tiles"].fileindex || 0;
                                let position = action.data?.select ?? "next";

                                if (position.includes("{{")) {
                                    let context = {
                                        actor: tokens[0]?.actor?.toObject(false),
                                        token: tokens[0]?.toObject(false),
                                        tile: tile.toObject(false),
                                        entity: entity,
                                        user: game.users.get(userid),
                                        value: value,
                                        scene: canvas.scene,
                                        method: method,
                                        change: change,
                                        fileindex: fileindex,
                                        files: entity._images
                                    };

                                    const compiled = Handlebars.compile(position);
                                    position = compiled(context, { allowProtoMethodsByDefault: true, allowProtoPropertiesByDefault: true }).trim();
                                }

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
                                else if (position.indexOf("d") != -1) {
                                    position = await rollDice(position);
                                } else if (position.indexOf("-") != -1) {
                                    let parts = position.split("-");
                                    let min = parseInt(parts[0]);
                                    let max = parseInt(parts[1]);
                                    position = Math.round(min + (Math.random() * (max - min)));
                                } else
                                    position = parseInt(position);

                                position = Math.clamped(position, 1, entity._images.length);

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

                            let position = await getPosition();

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
                                    img: entity._images[position - 1],
                                    time: time,
                                    position: position - 1
                                }

                                const doTransition = (data) => {
                                    if (data.img) {
                                        MonksActiveTiles.emit("transition", data);
                                        return MonksActiveTiles.transitionImage(entity, data.from, data.img, data.transition, data.time);
                                    }
                                }

                                const doNextPromise = async (data) => {
                                    let result = doTransition(data);
                                    if (result instanceof Promise) {
                                        return result.then(async () => {
                                            loop--;
                                            if (loop > 0) {
                                                entity.flags["monks-active-tiles"].fileindex = data.position;
                                                let position = await getPosition();
                                                data.position = position - 1;
                                                data.transition = getTransition();
                                                data.from = data.img;
                                                data.img = entity._images[data.position];
                                                data.time = new Date().getTime() + (action.data?.speed * 1000);

                                                return doNextPromise(data);
                                            } else {
                                                await entity.update({ texture: { src: data.img }, 'flags.monks-active-tiles.fileindex': data.position });
                                                //await entity.setFlag('monks-active-tiles', 'fileindex', data.position);
                                            }
                                        });
                                    } else {
                                        loop--;
                                        if (loop > 0) {
                                            entity.flags["monks-active-tiles"].fileindex = data.position;
                                            let position = await getPosition();
                                            data.position = position - 1;
                                            data.transition = getTransition();
                                            data.from = data.img;
                                            data.img = entity._images[data.position];
                                            data.time = new Date().getTime() + (action.data?.speed * 1000);

                                            return doNextPromise(data);
                                        } else {
                                            await entity.update({ texture: { src: data.img }, 'flags.monks-active-tiles.fileindex': data.position });
                                            //await entity.setFlag('monks-active-tiles', 'fileindex', data.position);
                                        }
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
                    let entityName = await MonksActiveTiles.entityName(action.data?.entity, 'tiles');
                    return `<span class="action-style">${i18n(trigger.name)}</span> to <span class="value-style">&lt;${action.data.select || 'next'}&gt;</span> for <span class="entity-style">${entityName}</span> ${action.data?.transition != "none" ? `<span class="detail-style">"${i18n("MonksActiveTiles.transition." + action.data?.transition)}"</span>` : ''}`;
                }
            },
            'delete': {
                name: "MonksActiveTiles.action.delete",
                options: { allowDelay: true },
                ctrls: [
                    {
                        id: "entity",
                        name: "MonksActiveTiles.ctrl.select-entity",
                        type: "select",
                        subtype: "entity",
                        required: true,
                        options: { showTile: true, showToken: true, showWithin: true, showPlayers: true, showPrevious: true, showTagger: true },
                        restrict: (entity) => {
                            return (
                                entity instanceof Token ||
                                entity instanceof Tile ||
                                entity instanceof Wall ||
                                entity instanceof Drawing ||
                                entity instanceof Note ||
                                entity instanceof AmbientLight ||
                                entity instanceof AmbientSound ||
                                entity.terrain != undefined);
                        },
                        onChange: (app) => {
                            app.checkConditional();
                        },
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
                            $('input[name="data.entity"]', app.element).next().html('Current collection of ' + $(ctrl).val());
                        },
                        conditional: (app) => {
                            let entity = JSON.parse($('input[name="data.entity"]', app.element).val() || "{}");
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
                        if (!entity.locked) {
                            batch.add("delete", entity);
                        }
                    }

                    await batch.execute();
                },
                content: async (trigger, action) => {
                    let entityName = await MonksActiveTiles.entityName(action.data?.entity, action.data?.collection || "tiles");
                    return `<span class="action-style">${i18n(trigger.name)}</span> <span class="entity-style">${entityName}</span>`;
                }
            },
            'target': {
                name: "MonksActiveTiles.action.target",
                options: { allowDelay: true },
                ctrls: [
                    {
                        id: "target",
                        name: "Select Targets",
                        type: "list",
                        onChange: (app) => {
                            app.checkConditional();
                        },
                        list: 'target',
                        defvalue: 'target'
                    },
                    {
                        id: "entity",
                        name: "MonksActiveTiles.ctrl.select-entity",
                        type: "select",
                        subtype: "entity",
                        options: { showToken: true, showWithin: true, showPlayers: true, showPrevious: true, showTagger: true },
                        restrict: (entity) => {
                            return entity instanceof Token;
                        },
                        conditional: (app) => { return $('select[name="data.target"]', app.element).val() !== "clear" },
                        defaultType: 'tokens'
                    },
                    {
                        id: "for",
                        name: "MonksActiveTiles.ctrl.for",
                        list: "for",
                        type: "list",
                        defaultVal: "token"
                    },
                ],
                values: {
                    'target': {
                        "add": 'MonksActiveTiles.target.appendtarget',
                        "target": 'MonksActiveTiles.target.overwritetarget',
                        "clear": 'MonksActiveTiles.target.clear',
                    },
                    'for': {
                        'gm': "MonksActiveTiles.for.gm",
                        'token': "MonksActiveTiles.for.token"
                    }
                },
                fn: async (args = {}) => {
                    const { action, userid } = args
                    let entities = await MonksActiveTiles.getEntities(args, 'tokens');

                    let runFor = action.data.for ?? "token";

                    if ((runFor == 'gm' && game.user.isGM) || (runFor != 'gm' && userid == game.user.id)) {
                        if (action.data.target == "clear") {
                            game.user.targets.forEach(t => t.setTarget(false, { user: game.user, releaseOthers: true, groupSelection: false }));
                        } else if (action.data.target == "target") {
                            game.user.updateTokenTargets(entities.map(t => t.id));
                        } else {
                            entities.forEach(t => t._object?.setTarget(true, { user: game.user, releaseOthers: false, groupSelection: false }));
                        }
                    } else {
                        MonksActiveTiles.emit("target", { target: action.data.target, userid: userid, tokens: entities.map(t => t.id) });
                    }
                },
                content: async (trigger, action) => {
                    if (action.data.target == "clear")
                        return `<span class="action-style">${i18n("MonksActiveTiles.target.clear")} targets</span>`;
                    else {
                        let entityName = await MonksActiveTiles.entityName(action.data?.entity, 'tokens');
                        return `<span class="action-style">${i18n(trigger.name)}</span> <span class="detail-style">"${i18n(trigger.values.target[action.data.target])}"</span> <span class="entity-style">${entityName}</span>, for <span class="value-style">&lt;${i18n(trigger.values.for[action.data?.for])}&gt;</span>`;
                    }
                }
            },
            'scenelighting': {
                name: "MonksActiveTiles.action.scenelighting",
                options: { allowDelay: true },
                ctrls: [
                    {
                        id: "darkness",
                        name: "MonksActiveTiles.ctrl.darkness",
                        type: "slider",
                        defvalue: 1
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
                options: { allowDelay: true },
                ctrls: [
                    {
                        id: "volumetype",
                        name: "MonksActiveTiles.ctrl.volumetype",
                        type: "list",
                        defvalue: "globalAmbientVolume",
                        list: "volumetype"
                    },
                    {
                        id: "volume",
                        name: "MonksActiveTiles.ctrl.volume",
                        type: "slider",
                        defvalue: "1.0",
                        step: "0.05"
                    },
                ],
                values: {
                    'volumetype': {
                        "globalPlaylistVolume": 'MonksActiveTiles.volumetype.playlists',
                        "globalAmbientVolume": 'MonksActiveTiles.volumetype.ambient',
                        "globalInterfaceVolume": 'MonksActiveTiles.volumetype.interface',
                    }
                },
                fn: async (args = {}) => {
                    let { action } = args;

                    $(`#global-volume input[name="${action.data.volumetype}"]`).val(action.data.volume).change();
                },
                content: async (trigger, action) => {
                    return `<span class="action-style">Change ${i18n(trigger.name)}</span> set <span class="details-style">"${i18n(trigger.values.volumetype[action.data.volumetype])}"</span> to <span class="value-style">&lt;${action.data.volume}&gt;</span>`;
                }
            },
            'dialog': {
                name: "MonksActiveTiles.action.dialog",
                options: { allowDelay: true },
                ctrls: [
                    {
                        id: "dialogtype",
                        name: "MonksActiveTiles.ctrl.dialogtype",
                        type: "list",
                        defvalue: "confirm",
                        list: "dialogtype",
                        onChange: (app) => {
                            app.checkConditional();
                        },
                    },
                    {
                        id: "title",
                        name: "MonksActiveTiles.ctrl.title",
                        type: "text",
                    },
                    {
                        id: "content",
                        name: "MonksActiveTiles.ctrl.content",
                        type: "text",
                        subtype: "multiline",
                        required: true
                    },
                    {
                        id: "for",
                        name: "MonksActiveTiles.ctrl.for",
                        list: "for",
                        type: "list",
                        defaultVal: "token"
                    },
                    { type: "line" },
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
                        "alert": 'MonksActiveTiles.dialogtype.alert'
                    },
                    'for': {
                        'gm': "MonksActiveTiles.for.gm",
                        'token': "MonksActiveTiles.for.token"
                    }
                },
                fn: async (args = {}) => {
                    let { action, tile, _id, value, tokens, userid } = args;

                    let title = action.data.title;
                    let content = action.data.content;

                    if ((action.data.for == 'gm' && game.user.isGM) || (action.data.for != 'gm' && userid == game.user.id))
                        MonksActiveTiles._showDialog(tile, tokens[0], value, action.data.dialogtype, title, content, action.data?.options, action.data.yes, action.data.no).then((results) => { tile.resumeActions(_id, results); });
                    else {
                        MonksActiveTiles.emit("showdialog", {
                            _id,
                            userid: userid,
                            tileid: tile.uuid,
                            tokenid: tokens[0]?.uuid,
                            value,
                            type: action.data.dialogtype,
                            title,
                            content,
                            options: action.data?.options,
                            yes: action.data.yes,
                            no: action.data.no
                        });
                    }

                    return { pause: true };
                },
                content: async (trigger, action) => {
                    let msg = encodeURI(action.data.content.length <= 15 ? action.data.content : action.data.content.substr(0, 15) + "...");
                    return `<span class="action-style">${i18n(trigger.name)}</span>, for <span class="value-style">&lt;${i18n(trigger.values.for[action.data?.for])}&gt;</span> <span class="detail-style">"${i18n(trigger.values.dialogtype[action.data.dialogtype])}"</span> "${msg}"`;
                }
            },
            'scrollingtext': {
                name: "MonksActiveTiles.action.scrollingtext",
                options: { allowDelay: true },
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
                        options: { showToken: true, showWithin: true, showPlayers: true, showPrevious: true, showTagger: true }
                    },
                    {
                        id: "for",
                        name: "MonksActiveTiles.ctrl.for",
                        list: "for",
                        type: "list"
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
                        'all': "MonksActiveTiles.for.all",
                        'gm': "MonksActiveTiles.for.gm",
                        'token': "MonksActiveTiles.for.token"
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
                    const { tile, action, userid, value, method, change } = args;

                    let entities = await MonksActiveTiles.getEntities(args);

                    for (let entity of entities) {
                        if (!entity)
                            continue;

                        //Add a chat message
                        let user = game.users.find(u => u.id == userid);
                        let scene = game.scenes.find(s => s.id == user?.viewedScene);

                        let token = entity?.object;

                        let context = {
                            actor: token.actor?.toObject(false),
                            token: token,
                            tile: tile.toObject(false),
                            user: game.users.get(userid),
                            value: value,
                            scene: scene,
                            method: method,
                            change: change
                        };
                        let content = action.data.text;

                        if (content.includes("{{")) {
                            const compiled = Handlebars.compile(content);
                            content = compiled(context, { allowProtoMethodsByDefault: true, allowProtoPropertiesByDefault: true }).trim();
                        }

                        if (action.data.for != 'token') {
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
                        }

                        if (action.data.for != 'gm') {
                            let owners = [];
                            if (token.actor) {
                                for (let [user, perm] of Object.entries(token.actor.ownership)) {
                                    if (perm >= CONST.DOCUMENT_PERMISSION_LEVELS.OWNER && !owners.includes(user))
                                        owners.push(user);
                                }
                            }

                            MonksActiveTiles.emit("scrollingtext", {
                                users: (action.data.for == 'token' ? owners : null),
                                tokenid: token.id,
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
                    return `<span class="action-style">${i18n(trigger.name)}</span> for <span class="value-style">&lt;${i18n(trigger.values.for[action.data?.for])}&gt;</span> "${msg}..."`;
                }
            },
            'preload': {
                name: "MonksActiveTiles.action.preload",
                options: { allowDelay: true },
                ctrls: [
                    {
                        id: "sceneid",
                        name: "MonksActiveTiles.ctrl.scene",
                        list: () => {
                            let result = {};
                            for (let s of game.scenes)
                                result[s.id] = s.name;
                            return result;
                        },
                        type: "list",
                        required: true
                    },
                    {
                        id: "for",
                        name: "MonksActiveTiles.ctrl.for",
                        list: "for",
                        type: "list"
                    }
                ],
                values: {
                    'for': {
                        'all': "MonksActiveTiles.for.all",
                        'gm': "MonksActiveTiles.for.gm",
                        'token': "MonksActiveTiles.for.token"
                    },
                },
                fn: async (args = {}) => {
                    const { tile, action, userid, value, method } = args;

                    if (action.data.for != "token" || game.user.id == userid)
                        await game.scenes.preload(action.data.sceneid);

                    if (action.data.for != "gm")
                        MonksActiveTiles.emit('preload', { userid: action.data.for == "token" ? userid : null, sceneid: action.data.sceneid });
                },
                content: async (trigger, action) => {
                    let scene = game.scenes.get(action.data.sceneid)
                    return `<span class="action-style">${i18n(trigger.name)}</span> <span class="detail-style">"${scene.name || 'Unkown Scene'}"</span> for <span class="value-style">&lt;${i18n(trigger.values.for[action.data?.for])}&gt;</span>`;
                }
            },
            'append': {
                name: "Write to Journal",
                requiresGM: true,
                ctrls: [
                    {
                        id: "entity",
                        name: "MonksActiveTiles.ctrl.select-entity",
                        type: "select",
                        subtype: "entity",
                        options: { showPrevious: true, showPlayers: true },
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

                                        if (entity && !(entity.pages.size == 1 && !!getProperty(entity.pages.contents[0], "flags.monks-enhanced-journal.type"))) {
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
                        onClick: (app) => {
                            app.checkConditional();
                        }
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
                        defvalue: "append"
                    }
                ],
                values: {
                    'append-type': {
                        'append': "Append",
                        'prepend': "Prepend",
                        'overwrite': "Overwrite",
                    }
                },
                fn: async (args = {}) => {
                    const { tile, tokens, action, userid, value, method, change } = args;

                    let entities = await game.MonksActiveTiles.getEntities(args, null, 'journal');
                    for (let entity of entities) {
                        if (entity instanceof JournalEntry && entity.pages.size > 0) {
                            let context = {
                                actor: tokens[0]?.actor?.toObject(false),
                                token: tokens[0]?.toObject(false),
                                tile: tile.toObject(false),
                                entity: entity,
                                user: game.users.get(userid),
                                value: value,
                                scene: canvas.scene,
                                method: method,
                                change: change,
                                timestamp: new Date().toLocaleString()
                            };

                            let page = (action.data.page ? entity.pages.get(action.data.page) : null);
                            if (!page) {
                                if (action.data.create) {
                                    let name = action.data.createname || "";
                                    if (name.includes("{{")) {
                                        const compiled = Handlebars.compile(name);
                                        name = compiled(context, { allowProtoMethodsByDefault: true, allowProtoPropertiesByDefault: true }).trim();
                                    }
                                    page = await JournalEntryPage.create({ type: "text", name: name }, { parent: entity });
                                } else if (entity.pages.contents.length)
                                    page = entity.pages.contents[0];
                            }

                            if (!page)
                                continue;

                            let text = action.data.text;
                            if (text.includes("{{")) {
                                const compiled = Handlebars.compile(text);
                                text = compiled(context, { allowProtoMethodsByDefault: true, allowProtoPropertiesByDefault: true }).trim();
                            }

                            let content = page.text.content || "";
                            if (action.data.append == "append")
                                content = content + text;
                            else if (action.data.append == "prepend")
                                content = text + content;
                            else if (action.data.append == "overwrite")
                                content = text;

                            await page.update({ text: { content: content } });
                        }
                    }
                },
                content: async (trigger, action) => {
                    let entityName = await MonksActiveTiles.entityName(action.data?.entity, "journal");
                    return `<span class="action-style">${i18n(trigger.name)}</span>, <span class="entity-style">${entityName}</span>`;
                }
            },
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
                        options: { showToken: true, showWithin: true, showPlayers: true, showPrevious: true, showTagger: true },
                        restrict: (entity) => { return (entity instanceof Token); }
                    },
                    {
                        id: "measure",
                        name: "Measure",
                        list: "measure",
                        type: "list",
                        onChange: (app) => {
                            app.checkConditional();
                        },
                        defvalue: 'lte'
                    },
                    {
                        id: "distance",
                        name: "MonksActiveTiles.ctrl.distance",
                        type: "number",
                        required: true,
                        variation: 'unit',
                        conditional: (app) => {
                            return $('select[name="data.measure"]', app.element).val() != 'lt';
                        },
                        defvalue: 1
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
                    });

                    let cont = (action.data?.continue == 'always'
                        || (action.data?.continue == 'within' && tokens.length > 0)
                        || (action.data?.continue == 'all' && tokens.length == value["tokens"].length && tokens.length > 0));

                    return { continue: cont, tokens: tokens };
                },
                content: async (trigger, action) => {
                    let unit = (action.data.distance.var == 'sq' ? 'grid square' : 'pixels');
                    let entityName = await MonksActiveTiles.entityName(action.data?.entity);
                    return `<span class="filter-style">Filter</span> <span class="entity-style">${entityName}</span> ${action.data.measure != 'lte' ? 'by a distance' : 'that are'} <span class="entity-style">${trigger.values.measure[action.data.measure || 'eq']}</span>${(action.data.measure != 'lt' ? ` <span class="details-style">"${action.data?.distance.value || action.data?.distance || 0}"</span> ${unit} of this Tile` : '')} ${(action.data?.continue != 'always' ? ', Continue if ' + (action.data?.continue == 'within' ? 'Any Within Distance' : 'All Within Distance') : '')}`;
                }
            },
            'exists': {
                name: "MonksActiveTiles.filter.exists",
                ctrls: [
                    {
                        id: "entity",
                        name: "MonksActiveTiles.ctrl.select-entity",
                        type: "select",
                        subtype: "entity",
                        onChange: (app) => {
                            app.checkConditional();
                        },
                        options: { showToken: true, showWithin: true, showPlayers: true, showPrevious: true, showTagger: true },
                        restrict: (entity) => { return (entity instanceof Token); }
                    },
                    {
                        id: "collection",
                        name: "Collection",
                        list: "collection",
                        type: "list",
                        onChange: (app, ctrl, action, data) => {
                            $('input[name="data.entity"]', app.element).next().html('Current collection of ' + $(ctrl).val());
                        },
                        conditional: (app) => {
                            let entity = JSON.parse($('input[name="data.entity"]', app.element).val() || "{}");
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
                        'walls': "Walls"
                    }
                },
                group: "filters",
                fn: async (args = {}) => {
                    let { tokens, tile, userid, value, method, action, change } = args;
                    let entities = await MonksActiveTiles.getEntities(args, action.data?.collection || "tokens");

                    let goto = action.data?.none || "";

                    if (goto.includes("{{")) {
                        let context = {
                            actor: tokens[0]?.actor?.toObject(false),
                            token: tokens[0]?.toObject(false),
                            tile: tile.toObject(false),
                            user: game.users.get(userid),
                            value: value,
                            scene: canvas.scene,
                            method: method,
                            change: change
                        };

                        const compiled = Handlebars.compile(goto);
                        goto = compiled(context, { allowProtoMethodsByDefault: true, allowProtoPropertiesByDefault: true }).trim();
                    }

                    let count = action.data?.count ?? "> 0";
                    if (count.startsWith("="))
                        count = "=" + count;

                    let cando = false;
                    try {
                        cando = !!eval(entities.length + " " + count);
                    } catch {
                    }

                    let result = { continue: (cando || goto != "") };
                    result[action.data?.collection || "tokens"] = entities;
                    if (goto != "" && !cando)
                        result.goto = goto;

                    return result;
                },
                content: async (trigger, action) => {
                    let entityName = await MonksActiveTiles.entityName(action.data?.entity, action.data?.collection);
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
                    let { tokens, tile, userid, value, method, action, change } = args;

                    let goto = action.data?.none || "";

                    if (goto.includes("{{")) {
                        let context = {
                            actor: tokens[0]?.actor?.toObject(false),
                            token: tokens[0]?.toObject(false),
                            tile: tile.toObject(false),
                            user: game.users.get(userid),
                            value: value,
                            scene: canvas.scene,
                            method: method,
                            change: change
                        };

                        const compiled = Handlebars.compile(goto);
                        goto = compiled(context, { allowProtoMethodsByDefault: true, allowProtoPropertiesByDefault: true }).trim();
                    }

                    let count = action.data?.count ?? "> 1";
                    if (count.startsWith("="))
                        count = "=" + count;

                    let cando = false;
                    try {
                        cando = !!eval(tile.countTriggered(action.data.unique ? "unique" : null) + " " + count);
                    } catch {
                    }

                    let result = { continue: (cando || goto != "") };
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
                        options: { showToken: true, showWithin: true, showPlayers: true, showPrevious: true, showTagger: true },
                        restrict: (entity) => { return (entity instanceof Token); }
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

                    let count = action.data?.count ?? "= 1";
                    if (count.startsWith("="))
                        count = "=" + count;

                    let entities = await MonksActiveTiles.getEntities(args);
                    entities = entities.filter(e => {
                        let cando = false;
                        try {
                            cando = !!eval(tile.countTriggered(e.id) + " " + count);
                        } catch {
                        }
                        return cando
                    })

                    return { tokens: entities };
                },
                content: async (trigger, action) => {
                    let entityName = await MonksActiveTiles.entityName(action.data?.entity);
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
                        onChange: (app) => {
                            app.checkConditional();
                        },
                        options: { showToken: true, showWithin: true, showPlayers: true, showPrevious: true, showTagger: true },
                        restrict: (entity) => { return (entity instanceof Token); }
                    },
                    {
                        id: "collection",
                        name: "Collection",
                        list: "collection",
                        type: "list",
                        onChange: (app, ctrl, action, data) => {
                            $('input[name="data.entity"]', app.element).next().html('Current collection of ' + $(ctrl).val());
                        },
                        conditional: (app) => {
                            let entity = JSON.parse($('input[name="data.entity"]', app.element).val() || "{}");
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
                        if (position == "first")
                            position = 0;
                        else if (position == "last")
                            position = entities.length - 1;
                        else if (position == "random")
                            position = Math.floor(Math.random() * entities.length);
                        else
                            position = position - 1;

                        position = Math.clamped(position, 0, entities.length - 1);
                        let entity = entities[position];

                        let result = {};
                        MonksActiveTiles.addToResult(entity, result);

                        return result;
                    } else
                        return { tokens: [] };
                },
                content: async (trigger, action) => {
                    let entityName = await MonksActiveTiles.entityName(action.data?.entity);
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
                        onChange: (app) => {
                            app.checkConditional();
                        },
                        options: { showToken: true, showTile: true, showWithin: true, showPlayers: true, showPrevious: true, showTagger: true },
                        restrict: (entity) => {
                            return (entity instanceof Token ||
                                entity instanceof Tile ||
                                entity instanceof Drawing ||
                                entity instanceof Note ||
                                entity instanceof AmbientLight ||
                                entity instanceof AmbientSound ||
                                entity instanceof Wall ||
                                entity.terrain != undefined);
                        }
                    },
                    {
                        id: "collection",
                        name: "Collection",
                        list: "collection",
                        type: "list",
                        onChange: (app, ctrl, action, data) => {
                            $('input[name="data.entity"]', app.element).next().html('Current collection of ' + $(ctrl).val());
                        },
                        conditional: (app) => {
                            let entity = JSON.parse($('input[name="data.entity"]', app.element).val() || "{}");
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
                        'tokens': "Tokens",
                        'walls': "Walls"
                    }
                },
                group: "filters",
                fn: async (args = {}) => {
                    let { action, value, tokens, tile, method, change, userid } = args;

                    let entities = await MonksActiveTiles.getEntities(args, action.data?.collection || "tokens");

                    let result = entities.filter(entity => {
                        let attr = action.data.attribute;
                        let base = entity;
                        let found = false;

                        if (!attr.startsWith('flags')) {
                            if (!hasProperty(base, attr) && entity instanceof TokenDocument) {
                                if (hasProperty(base, "system." + attr) && entity instanceof TokenDocument) {
                                    attr = "system." + attr;
                                    found = true;
                                } else
                                    base = entity.actor;
                            }

                            if (!found) {
                                if (!hasProperty(base, attr)) {
                                    if (hasProperty(base, "system." + attr))
                                        attr = "system." + attr;
                                    else {
                                        warn("Couldn't find attribute", entity, attr);
                                        return false;
                                    }
                                }
                            }
                        }

                        let prop = getProperty(base, attr);

                        if (prop && (typeof prop == 'object') && !(prop instanceof Array)) {
                            if (prop.value == undefined) {
                                debug("Attribute returned an object and the object doesn't have a value property", entity, attr, prop);
                                return false;
                            }

                            attr = attr + '.value';
                            prop = prop.value;
                        }

                        let val = action.data.value;

                        if (val === 'true') return prop == true;
                        else if (val === 'false') return prop == false;
                        else {
                            if (val.includes("{{")) {
                                let context = {
                                    actor: tokens[0]?.actor?.toObject(false),
                                    token: tokens[0]?.toObject(false),
                                    tile: tile.toObject(false),
                                    entity: entity,
                                    user: game.users.get(userid),
                                    value: value,
                                    scene: canvas.scene,
                                    method: method,
                                    change: change,
                                    attribute: prop
                                };
                                const compiled = Handlebars.compile(val);
                                val = compiled(context, { allowProtoMethodsByDefault: true, allowProtoPropertiesByDefault: true }).trim();
                            }

                            if (val.startsWith('= '))
                                val = '=' + val;

                            //let stmt = (typeof prop == 'string' ? `"${prop}"` : prop) + ' ' + val;
                            let stmt = (prop instanceof Array ? `[${prop.map(v => typeof v == 'string' ? '"' + v + '"' : v).join(',')}].includes(${val})` : (typeof prop == 'string' ? `"${prop}"` : prop) + ' ' + val);
                            //if (game.user.isGM && prop instanceof Array)
                            //    ui.notifications.warn("Active Tiles will discontinue the use of ; to change multiple attributes at the same time.  Please add additional actions to make the changes.");

                            //stmt = stmt.replace("&&", "&& " + prop).replace("||", "|| " + prop);

                            try {
                                return eval(stmt);
                            } catch {
                                return false;
                            }
                        }
                    });

                    let retval = {};
                    retval[action.data?.collection || "tokens"] = result;
                    return retval;
                },
                content: async (trigger, action) => {
                    let entityName = await MonksActiveTiles.entityName(action.data?.entity, action.data?.collection);
                    return `<span class="filter-style">Find</span> <span class="entity-style">${entityName}</span> with <span class="value-style">&lt;${action.data?.attribute}&gt;</span> <span class="details-style">"${action.data?.value}"</span>`;
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
                        onChange: (app) => {
                            app.checkConditional();
                        },
                        options: { showToken: true, showWithin: true, showPlayers: true, showPrevious: true, showTagger: true },
                        restrict: (entity) => {
                            return (entity instanceof Token);
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
                        required: true,
                        defvalue: ">= 1"
                    },
                ],
                group: "filters",
                fn: async (args = {}) => {
                    let { action, value, tokens, tile } = args;

                    let count = action.data?.count ?? "= 1";
                    if (count.startsWith("="))
                        count = "=" + count;

                    let entities = await MonksActiveTiles.getEntities(args, action.data?.collection || "tokens");

                    let result = entities.filter(entity => {
                        if (!entity.actor)
                            return false;
                        let items = entity.actor.items.filter(i => (i.name || "").trim().toLowerCase() == (action.data.item || "").trim().toLowerCase());

                        let cando = false;
                        try {
                            cando = !!eval(items.length + " " + count);
                        } catch {
                        }

                        if (cando && ["dnd5e"].includes(game.system.id)) {
                            let quantity = action.data?.quantity ?? ">= 1";
                            if (quantity.startsWith("="))
                                quantity = "=" + quantity;
                            items = items.filter(i => {
                                try {
                                    switch (game.system.id) {
                                        case "dnd5e": return !!eval(i.system.quantity + " " + quantity);
                                    }
                                } catch { }
                                return false;
                            });
                            cando = (items.length > 0);
                        }

                        return cando;
                    });

                    return { tokens: result };
                },
                content: async (trigger, action) => {
                    let entityName = await MonksActiveTiles.entityName(action.data?.entity, action.data?.collection);
                    let count = action.data?.count ?? "> 0";
                    return `<span class="filter-style">Find</span> <span class="entity-style">${entityName}</span> with item <span class="value-style">&lt;${action.data?.item}&gt;</span> <span class="value-style">"${count}"</span>`;
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
                        onChange: (app) => {
                            app.checkConditional();
                        },
                        options: { showToken: true, showWithin: true, showPlayers: true, showPrevious: true, showTagger: true },
                        restrict: (entity) => {
                            return (entity instanceof Token);
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
                                conditions = [...conditions].map(e => { return { id: e[0], label: e[1].name }; });
                            }
                            for (let effect of conditions.sort((a, b) => { return String(a.label).localeCompare(b.label) })) { //(i18n(a.label) > i18n(b.label) ? 1 : (i18n(a.label) < i18n(b.label) ? -1 : 0))
                                result[effect.id] = i18n(effect.label);
                            }
                            return result;
                        },
                        onChange: (app) => {
                            app.checkConditional();
                        },
                        type: "list",
                        required: true
                    },
                ],
                group: "filters",
                fn: async (args = {}) => {
                    let { action, value, tokens, tile } = args;

                    let count = action.data?.count ?? "= 1";
                    if (count.startsWith("="))
                        count = "=" + count;

                    let entities = await MonksActiveTiles.getEntities(args, action.data?.collection || "tokens");

                    let effect = game.system.id == 'pf2e' ? game.pf2e.ConditionManager.getCondition(action.data?.effectid) : CONFIG.statusEffects.find(e => e.id === action.data?.effectid);
                    if (!effect)
                        return;

                    let result = entities.filter(entity => {
                        if (!entity.actor)
                            return false;

                        if (game.system.id == 'pf2e') {
                            return entity.actor.itemTypes.condition.some((condition) => {
                                return condition.slug === effect.slug;
                            });
                        } else {
                            return (entity.actor.effects.find(e => e.getFlag("core", "statusId") === effect.id) != undefined);
                        }
                    });

                    return { tokens: result };
                },
                content: async (trigger, action) => {
                    let entityName = await MonksActiveTiles.entityName(action.data?.entity, "tokens");
                    return `<span class="filter-style">Find</span> <span class="entity-style">${entityName}</span> with condition <span class="details-style">"${action.data?.effectid}"</span>`;
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
                    let { action, userid } = args;

                    let user = game.users.get(userid);
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
                    let gmredirect = (action.data.gm ? `<span class="entity-style">GM</span> to <span class="value-style">&lt;${action.data.gm}&gt;</span>` : "");
                    let playerredirect = (action.data.player ? `<span class="entity-style">Player</span> to <span class="value-style">&lt;${action.data.player}&gt;</span>` : "");
                    return `<span class="filter-style">Redirect player</span> ${gmredirect} ${playerredirect}`;
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
                    let { action, userid } = args;
        
                    let user = game.users.get(userid);
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
                        type: "number",
                        onBlur: (app) => {
                            app.checkConditional();
                        },
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
                group: "logic",
                fn: async (args = {}) => {
                    const { tokens, tile, userid, value, method, action, change } = args;

                    let goto = action.data?.tag;
                    if (goto.includes("{{")) {
                        let context = {
                            actor: tokens[0]?.actor?.toObject(false),
                            token: tokens[0]?.toObject(false),
                            tile: tile.toObject(false),
                            user: game.users.get(userid),
                            value: value,
                            scene: canvas.scene,
                            method: method,
                            change: change
                        };

                        const compiled = Handlebars.compile(goto);
                        goto = compiled(context, { allowProtoMethodsByDefault: true, allowProtoPropertiesByDefault: true }).trim();
                    }

                    if (action.data?.limit) {
                        let loop = args.value.loop || {};
                        let loopval = (loop[action.id] || 0) + 1;
                        loop[action.id] = loopval;
                        if (loopval >= action.data?.limit)
                            return { continue: action.data?.resume };
                        else
                            return { goto: goto, loop: loop };
                    } else
                        return { goto: goto };
                },
                content: async (trigger, action) => {
                    return `<span class="logic-style">${i18n(trigger.name)}:</span> <span class="tag-style">${action.data?.tag}</span>${action.data?.limit ? ' limit by <span class="details-style">"' + action.data?.limit + '"</span>' + (action.data?.resume ? ' <i class="fas fa-forward" title="Resume after looping"></i>' : ' <i class="fas fa-stop" title="Stop after looping"></i>') : ''}`;
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
                        options: { showTile: true, showPrevious: true, showTagger: true },
                        restrict: (entity) => {
                            return (entity instanceof Tile);
                        },
                        defaultType: "tiles"
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
                                return { continue: false }; //, resume: action.data.resume };
                            else {
                                entity.setFlag('monks-active-tiles', 'continue', false);
                                //entity.setFlag('monks-active-tiles', 'resume', action.data.resume);
                            }
                            if (entity._resumeTimer)
                                window.clearTimeout(entity._resumeTimer);
                        }
                    }
                },
                content: async (trigger, action) => {
                    let entityName = await MonksActiveTiles.entityName(action.data?.entity, "tiles");
                    return `<span class="logic-style">${i18n(trigger.name)}</span> for <span class="entity-style">${entityName}</span>`;
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
                    type: "list"
                }
            ],
            values: {
                'for': {
                    "trigger": 'Triggering Player',
                    "everyone": 'Everyone',
                    "players": 'Players Only',
                    "gm": 'GM Only'
                }
            },
            group: 'forien-quest-log',
            fn: async (args = {}) => {
                const { action, userid } = args;

                if (action.data.for != 'gm')
                    MonksActiveTiles.emit('fql', { for: action.data.for, userid: userid });
                if (MonksActiveTiles.allowRun && (action.data.for == 'everyone' || action.data.for == 'gm' || action.data.for == undefined || (action.data.for == 'trigger' && userid == game.user.id)))
                    Hooks.call('ForienQuestLog.Open.QuestLog');

            },
            content: async (trigger, action) => {
                return `<span class="logic-style">${trigger.name}</span> for <span class="value-style">&lt;${i18n(trigger.values.for[action.data?.for])}&gt;</span>`;
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
                    type: "list"
                }
            ],
            values: {
                'for': {
                    "trigger": 'Triggering Player',
                    "everyone": 'Everyone',
                    "players": 'Players Only',
                    "gm": 'GM Only'
                }
            },
            group: 'forien-quest-log',
            fn: async (args = {}) => {
                const { action, userid } = args;

                if (action.data.for != 'gm')
                    MonksActiveTiles.emit('fql', { userid: [userid], for: action.data.for, quest: action.data.quest });

                if (MonksActiveTiles.allowRun && (action.data.for == 'everyone' || action.data.for == 'gm' || action.data.for == undefined || (action.data.for == 'trigger' && userid == game.user.id))) {
                    const fqlAPI = game.modules.get('forien-quest-log').public.QuestAPI;
                    fqlAPI.open({ questId: action.data.quest });
                }

            },
            content: async (trigger, action) => {
                return `<span class="logic-style">${trigger.name}</span> "${trigger.ctrls[0].list()[action.data.quest]}" for <span class="value-style">&lt;${i18n(trigger.values.for[action.data?.for])}&gt;</span>`;
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
                    onChange: (app) => {
                        app.checkConditional();
                    },
                },
                {
                    id: "for",
                    name: "For",
                    list: "for",
                    type: "list",
                    conditional: (app) => {
                        return ["drug", "sepia", "drug", "negative", "blur"].includes($('select[name="data.effect"]', app.element).val());
                    }
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
                    "trigger": 'Triggering Player',
                    "everyone": 'Everyone',
                    "players": 'Players Only',
                    "gm": 'GM Only'
                }
            },
            group: 'kandashis-fluid-canvas',
            fn: async (args = {}) => {
                const { action, userid } = args;

                if (["earthquake", "heartbeat", "spin"].includes(action.data.effect))
                    KFC.executeForEveryone(action.data.effect, action.data.intensity, action.data.duration, action.data.iteration);
                else {
                    let users = (action.data.for == 'trigger' ? [userid] :
                        (action.data.for == 'gm' ? [game.user.id] :
                            game.users.filter(u => (action.data.for == 'everyone' || !u.isGM)).map(u => u.id)));
                    KFC.executeAsGM(action.data.effect, users, action.data.intensity, action.data.duration, action.data.iteration);
                }

            },
            content: async (trigger, action) => {
                return `<span class="logic-style">${trigger.name}</span> <span class="details-style">"${i18n(trigger.values.effect[action.data?.effect])}"</span>`;
            }
        });
    }

    if (game.modules.get('tagger')?.active) {
        app.registerTileGroup('tagger', "Tagger");
        app.registerTileAction('tagger', 'execute', {
            name: 'Add Tag',
            ctrls: [
                {
                    id: "entity",
                    name: "MonksActiveTiles.ctrl.select-entity",
                    type: "select",
                    subtype: "entity",
                    options: { showTile: true, showToken: true, showWithin: true, showPlayers: true, showPrevious: true, showTagger: true },
                    restrict: (entity) => {
                        return (
                            entity instanceof Token ||
                            entity instanceof Tile ||
                            entity instanceof Drawing ||
                            entity instanceof AmbientLight ||
                            entity instanceof AmbientSound ||
                            entity instanceof Note);
                    }
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
                }
            ],
            values: {
                'state': {
                    'add': "MonksActiveTiles.state.add",
                    'remove': "MonksActiveTiles.state.remove",
                    'toggle': "MonksActiveTiles.state.toggle"
                }
            },
            group: 'tagger',
            fn: async (args = {}) => {
                const { action, userid } = args;

                let entities = await MonksActiveTiles.getEntities(args);
                if (entities.length) {
                    if (action.data.state == 'add')
                        Tagger.addTags(entities, action.data.tag);
                    else if (action.data.state == 'remove')
                        Tagger.removeTags(entities, action.data.tag);
                    else if (action.data.state == 'toggle')
                        Tagger.toggleTags(entities, action.data.tag);
                }

                return { tokens: entities };
            },
            content: async (trigger, action) => {
                return `<span class="action-style">Tagger</span> <span class="details-style">"${i18n(trigger.values.state[action.data?.state])}"</span> <span class="value-style">&lt;${action.data.tag}&gt;</span>`;
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
                const { action, userid } = args;

                const shootConfettiProps = window.confetti.getShootConfettiProps(parseInt(action.data.strength));
                window.confetti.shootConfetti(shootConfettiProps);

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
                        let effects = CONFIG.fxmaster.weather;

                        for (let [key, effect] of Object.entries(effects)) {
                            let group = list.find((k) => k.id == effect.group);
                            if (!group) {
                                group = { id: effect.group, text: `FXMASTER.WeatherEffectsGroup${effect.group.titleCase()}`, groups: {} };
                                list.push(group);
                            }

                            group.groups[key] = effect.label;
                        }
                        return list;
                    },
                    type: "list",
                    onChange: (app) => {
                        app.checkConditional();
                    },
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
                const { action, userid } = args;

                let parts = action.data.effect.split(":");

                Hooks.call("fxmaster.switchWeather", {
                    name: "monksactivetiles",
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
                let effect = CONFIG.fxmaster.weather[parts[1]];
                return `<span class="action-style">Weather Effect</span> <span class="details-style">"${effect.label}"</span>`;
            }
        });
        app.registerTileAction('fxmaster', 'clear', {
            name: 'Clear all effects',
            group: 'fxmaster',
            fn: async (args = {}) => {
                const { action, userid, tile } = args;

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
                    defvalue: "all"
                }
            ],
            values: {
                'for': {
                    "trigger": 'Triggering Player',
                    "everyone": 'Everyone',
                    "players": 'Players Only',
                    "gm": 'GM Only'
                }
            },
            group: 'party-inventory',
            fn: async (args = {}) => {
                const { action, userid, tokens } = args;

                if (action.data.for != 'gm')
                    MonksActiveTiles.emit('party-inventory', { for: action.data.for, userid: userid });
                if (MonksActiveTiles.allowRun && (action.data.for == 'everyone' || action.data.for == 'gm' || action.data.for == undefined || (action.data.for == 'trigger' && userid == game.user.id)))
                    game.modules.get("party-inventory").api.openWindow();
            },
            content: async (trigger, action) => {
                return `<span class="logic-style">${trigger.name}</span> for <span class="value-style">&lt;${i18n(trigger.values.for[action.data?.for])}&gt;</span>`;
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
                    options: {
                        showToken: true,
                        showWithin: true,
                        showPlayers: true,
                        showPrevious: true,
                        showTagger: true
                    },
                    restrict: (entity) => {
                        return (entity instanceof Token);
                    }
                },
                {
                    id: "effect",
                    name: "Effect",
                    type: "list",
                    required: true,
                    defvalue: "",
                    list: () => {
                        return game.dfreds.effects.all.reduce((acc, effect) => {
                            acc[effect.name] = effect.name;
                            return acc;
                        }, {});
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
                    await game.dfreds.effectInterface[action.data.state + "Effect"](action.data.effect, {
                        uuids: entities.map(e => e.uuid)
                    });
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
                    options: {
                        showWithin: true,
                        showPlayers: true,
                        showPrevious: true,
                        showTagger: true
                    },
                    restrict: (entity) => {
                        return (entity instanceof Token);
                    }
                },
                {
                    id: "effect",
                    name: "Effect",
                    type: "list",
                    required: true,
                    defvalue: "",
                    list: () => {
                        return game.dfreds.effects.all.reduce((acc, effect) => {
                            acc[effect.name] = effect.name;
                            return acc;
                        }, {});
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
                const entityName = await MonksActiveTiles.entityName(action.data?.entity);
                let html = `<span class="filter-style">Filter</span> <span class="entity-style">${entityName}</span> that`;
                html += (action.data.filter === "yes" ? " has " : " doesn't have ");
                html += `<span class="value-style">&lt;${action.data.effect}&gt;</span>`
                html += (action.data?.continue !== 'always' ? ', Continue if ' + (action.data?.continue === 'any' ? 'Any Matches' : 'All Matches') : '');
                return html;
            }
        });
    }
});