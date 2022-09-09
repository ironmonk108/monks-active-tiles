﻿import { registerSettings } from "./settings.js";
import { WithActiveTileConfig } from "./apps/active-tile-config.js"
import { ActionConfig } from "./apps/action-config.js";
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
export let i18n = key => {
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

export class MonksActiveTiles {
    static _oldSheetClass;
    //static _oldObjectClass;
    //static _rejectRemaining = {};
    static savestate = {};
    static debugEnabled = 1;

    static _slotmachine = {};

    static batch = new BatchManager();

    static timeout(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    static emit(action, args = {}) {
        args.action = action;
        args.senderId = game.user.id
        game.socket.emit( MonksActiveTiles.SOCKET, args, (resp) => { } );
    }

    static get triggerModes() {
        return {
            'enter': i18n("MonksActiveTiles.mode.enter"),
            'exit': i18n("MonksActiveTiles.mode.exit"),
            'both': i18n("MonksActiveTiles.mode.both"),
            'movement': i18n("MonksActiveTiles.mode.movement"),
            'stop': i18n("MonksActiveTiles.mode.stop"),
            'elevation': i18n("MonksActiveTiles.mode.elevation"),
            'click': i18n("MonksActiveTiles.mode.click"),
            'rightclick': i18n("MonksActiveTiles.mode.rightclick"),
            'dblclick': i18n("MonksActiveTiles.mode.dblclick"),
            'create': i18n("MonksActiveTiles.mode.create"),
            'hover': i18n("MonksActiveTiles.mode.hover"),
            'hoverin': i18n("MonksActiveTiles.mode.hoverin"),
            'hoverout': i18n("MonksActiveTiles.mode.hoverout"),
            'combatstart': i18n("MonksActiveTiles.mode.combatstart"),
            'round': i18n("MonksActiveTiles.mode.round"),
            'turn': i18n("MonksActiveTiles.mode.turn"),
            'turnend': i18n("MonksActiveTiles.mode.turnend"),
            'combatend': i18n("MonksActiveTiles.mode.combatend"),
            'ready': i18n("MonksActiveTiles.mode.canvasready"),
            'manual': i18n("MonksActiveTiles.mode.manual")
        }
    };

    static triggerGroups = {
        'actions': { name: 'MonksActiveTiles.group.actions', 'default': true },
        'filters': { name: 'MonksActiveTiles.group.filters' },
        'logic': { name: 'MonksActiveTiles.group.logic' }
    }

    static triggerActions = ActionManager.actions;

    static getActionFlag(val, flag) {
        if (!val)
            return "";
        switch (flag) {
            case "snap":
                return ` <i class="fas fa-compress" title="${i18n("MonksActiveTiles.SnapToGrid")}"></i>`;
        }
        return "";
    }

    static async getEntities(args, defaultType, entry) {
        const { tile, tokens, action, value, userid } = args;
        let id = entry?.id || action.data?.entity?.id;

        let entities = [];
        if (id == 'tile')
            entities = [tile];
        else if (id == 'token') {
            entities = tokens;
            for (let i = 0; i < entities.length; i++) {
                if (typeof entities[i] == 'string')
                    entities[i] = await fromUuid(entities[i]);
            }
        }
        else if (id == 'players') {
            entities = tile.parent.tokens.filter(t => {
                return t.actor != undefined && t.actor?.hasPlayerOwner && t.actor?.type != 'npc';
            });
        }
        else if (id == 'within') {
            //find all tokens with this Tile
            entities = tile.tokensWithin();
        }
        else if (id == 'controlled') {
            entities = canvas.tokens.controlled.map(t => t.document);
        }
        else if (id == undefined || id == '' || id == 'previous') {
            let deftype = (defaultType || 'tokens');
            entities = (deftype == 'tiles' && id != 'previous' ? [tile] : value[deftype]);
            entities = (entities instanceof Array ? entities : (entities ? [entities] : []));
            
            let collection = canvas[deftype == "tiles" ? "background" : deftype];
            if (collection) {
                for (let i = 0; i < entities.length; i++) {
                    let entity = entities[i];
                    if (typeof entity == "string") {
                        let newEnt = collection.get(entity);
                        if (newEnt?.document)
                            entities[i] = newEnt.document;
                    }
                }
            }
        }
        else if (id.startsWith('tagger')) {
            if (game.modules.get('tagger')?.active) {
                let entity = entry || action.data?.entity;
                let tag = id.substring(7);
                let options = {};
                if (!entity.match || entity.match == "any")
                    options.matchAny = true;
                if (entity.match == "exact")
                    options.matchExactly = true;

                if (entity.scene == "_all")
                    options.allScenes = true;
                else if (entity.scene !== "_active" && entity.scene)
                    options.sceneId = entity.scene;

                entities = Tagger.getByTag(tag, options);

                if (entity.scene == "_all")
                    entities = [].concat(...Object.values(entities));
            }
        }
        else if (id) {
            entities = (id.includes('Terrain') ? MonksActiveTiles.getTerrain(id) : await fromUuid(id));
            entities = [entities];
        } 

        return entities;
    }

    static async entityName(entity, defaultType) {
        let name = "";
        if (entity?.id == 'tile' || (defaultType == 'tiles' && (entity?.id == undefined || entity?.id == '')))
            name = i18n("MonksActiveTiles.ThisTile");
        else if (entity?.id == 'token')
            name = i18n("MonksActiveTiles.TriggeringToken");
        else if (entity?.id == 'players')
            name = i18n("MonksActiveTiles.PlayerTokens");
        else if (entity?.id == 'within')
            name = i18n("MonksActiveTiles.WithinTile");
        else if (entity?.id == 'controlled')
            name = i18n("MonksActiveTiles.Controlled");
        else if (entity?.id == undefined || entity?.id == '' || entity?.id == 'previous')
            name = game.i18n.format("MonksActiveTiles.CurrentCollection", { collection: (defaultType || "tokens")}); //(defaultType == 'tokens' || defaultType == undefined ? i18n("MonksActiveTiles.PreviousData") : 'Current ' + defaultType );
        else if (entity?.id.startsWith('tagger'))
            name = `<i class="fas fa-tag fa-sm"></i> ${entity.id.substring(7)}`;
        else if (entity?.id) {
            let document = (entity.id.includes('Terrain') ? MonksActiveTiles.getTerrain(entity.id) : await fromUuid(entity.id));
            if (document) {
                if (document.name) {
                    name = document.name;
                    if (document.parent && document.parent instanceof Playlist) {
                        name = document.parent.name + ": " + name;
                    } else if (document.compendium) {
                        name = `<i class="fas fa-atlas"></i> ${document.compendium.metadata.label}: ${name}`;
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
            }
        }

        return name;
    }

    static async getLocation(_location, value, args = {}) {
        let location = duplicate(_location);

        if (location.id == 'previous')
            location = value["location"];
        else if (location.id == 'origin')
            location = value["original"];
        else if (location.id == 'players') {
            let user = game.users.get(args.userid);
            if (user && user.character?.id) {
                let scene = game.scenes.get(user.viewedScene);
                if (scene) {
                    let token = scene.tokens.find(t => t.actor.id == user.character.id);
                    if (token) {
                        return {
                            x: token.x + ((Math.abs(token.width) * scene.dimensions.size) / 2),
                            y: token.y + ((Math.abs(token.height) * scene.dimensions.size) / 2),
                            scene: scene.id
                        };
                    }
                }
            }
        } else if (location.id == 'token')
            location = args.pt || (value.tokens.length ? { x: value.tokens[0].x, y: value.tokens[0].y } : null);
        else if(location.id?.startsWith('tagger')) {
            if (game.modules.get('tagger')?.active) {
                let tag = location.id.substring(7);
                let options = {};
                if (!location.match || location.match == "any")
                    options.matchAny = true;
                if (location.match == "exact")
                    options.matchExactly = true;

                if (location.scene == "_all")
                    options.allScenes = true;
                else if (location.scene !== "_active" && location.scene)
                    options.sceneId = location.scene;

                location = Tagger.getByTag(tag, options);

                if (location.scene == "_all")
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
                    try {
                        dest = await fromUuid(l.uuid || l.id);
                    } catch { }
                }

                if (dest) {
                    location[i] = {
                        x: dest.x + (Math.abs(dest.width) / 2),
                        y: dest.y + (Math.abs(dest.height) / 2),
                        width: Math.abs(dest.width),
                        height: Math.abs(dest.height),
                        scene: dest.parent.id,
                        dest: dest
                    };
                } else
                    location[i] = null;
            } else {
                location[i] = {
                    x: l.x,
                    y: l.y,
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
        let sceneId = location.sceneId || canvas.scene.id;
        if (location.id) {
            if (location?.id == 'previous')
                name = "Current Location";
            else if (location.id == 'players')
                name = "Player's Token";
            else if (location?.id == 'token')
                name = "Triggering Token";
            else if (location?.id == 'origin')
                name = i18n("MonksActiveTiles.Origin");
            else if (location?.id.startsWith('tagger'))
                name = `<i class="fas fa-tag fa-sm"></i> ${location.id.substring(7)}`;
            else {
                //this is directing to an entity
                let document = await fromUuid(location.id);
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
                    if (location.x || location.y)
                        name = `[${location.x},${location.y}${(location.scale ? `, scale:${location.scale}` : '')}]`;
                    else
                        name = "Unknown Location";
                }
            }
        } else {
            name = isEmpty(location) ? "" : `[${location.x},${location.y}${(location.scale ? `, scale:${location.scale}` : '')}]`;
        }

        let scene = game.scenes.find(s => s.id == sceneId);
        return `${(scene?.id != canvas.scene.id ? 'Scene: ' + scene.name + ', ' : '')}${name}`;
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
        const { tile, tokens, action, userid, values, value, method, pt, change } = mainargs;

        for (let i = 0; i < tokens.length; i++) {
            tokens[i] = (typeof tokens[i] == 'string' ? await fromUuid(tokens[i]) : tokens[i]);
        }

        let tkn = tokens[0];

        let user = game.users.get(userid);

        let context = {
            actor: tkn?.actor,
            token: tkn?.object,
            character: user.character,
            tile: tile.object,
            user: user,
            canvas: canvas,
            scene: canvas.scene,
            values: values,
            value: value,
            tokens: tokens,
            method: method,
            pt: pt,
            actionId: mainargs._id,
            change: change

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
            (game.modules.get("advanced-macros")?.active || game.modules.get("furnace")?.active ? getProperty(macro, "flags.advanced-macros.runAsGM") || getProperty(macro, "flags.furnace.runAsGM") : true));

        if (runasgm || userid == game.user.id) {
            if (game.modules.get("advanced-macros")?.active || game.modules.get("furnace")?.active)
                return await (macro.type == 'script' ? macro.execute(context) : macro.execute(args));
            else
                return await (macro.type == 'script' ? MonksActiveTiles._execute.call(macro, context) : macro.execute(args));
        } else {
            MonksActiveTiles.emit('runmacro', {
                userid: userid,
                macroid: macro.uuid,
                tileid: tile?.uuid,
                tokenid: tkn?.uuid,
                values: values,
                value: value,
                method: method,
                pt: pt,
                args: args,
                tokens: context.tokens.map(t => t.uuid),
                _id: mainargs._id
            });

            return { pause: true };
        }

        /*
        if (game.modules.get("advanced-macros")?.active || game.modules.get("furnace")?.active) {
            if (getProperty(macro, "flags.advanced-macros.runAsGM") || getProperty(macro, "flags.furnace.runAsGM") || userid == game.user.id) {
                //execute the macro if it's set to run as GM or it was the GM that actually moved the token.
                return await macro.execute(context);
            } else {
                //this one needs to be run as the player, so send it back
                MonksActiveTiles.emit('runmacro', {
                    userid: userid,
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

    static async _execute(context) {
        if (setting('use-core-macro')) {
            return await this.execute(context);
        } else {
            try {
                return new Function(`"use strict";
            return (async function ({speaker, actor, token, character, tile, method, pt, args, scene}={}) {
                ${this.command}
                });`)().call(this, context);
            } catch (err) {
                ui.notifications.error(`There was an error in your macro syntax. See the console (F12) for details`);
                console.error(err);
            }
        }
    }

    static async _showDialog(tile, token, value, type, title, content, options, yes, no) {
        let context = {
            actor: token?.actor?.toObject(false),
            token: token?.toObject(false),
            tile: tile.toObject(false),
            user: game.user,
            value: value,
            scene: canvas.scene
        };
        let compiled = Handlebars.compile(title);
        title = compiled(context, { allowProtoMethodsByDefault: true, allowProtoPropertiesByDefault: true }).trim();
        compiled = Handlebars.compile(content);
        content = compiled(context, { allowProtoMethodsByDefault: true, allowProtoPropertiesByDefault: true }).trim();

        let opts = {};
        try {
            opts = JSON.parse(options);
        } catch {}

        if (type == 'confirm') {
            return Dialog.confirm({
                title: title,
                content: content,
                yes: (html) => {
                    let data = (yes ? { goto: yes } : {});

                    const form = html[0].querySelector("form");
                    if (form) {
                        const fd = new FormDataExtended(form);
                        data = foundry.utils.mergeObject(data, fd.toObject());
                    }

                    if (!data.goto)
                        data.continue = false;

                    return data;
                },
                no: (html) => {
                    let data = (no ? { goto: no } : { });

                    const form = html[0].querySelector("form");
                    if (form) {
                        const fd = new FormDataExtended(form);
                        data = foundry.utils.mergeObject(data, fd.toObject());
                    }

                    if (!data.goto)
                        data.continue = false;

                    return data;
                },
                options: opts,
                rejectClose: true
            }).catch(() => { return { goto: no }; });
        } else if (type == 'alert') {
            return Dialog.prompt({
                title: title,
                content: content,
                callback: (html) => {
                    let data = { };
                    const form = html[0].querySelector("form");
                    if (form) {
                        const fd = new FormDataExtended(form);
                        data = foundry.utils.mergeObject(data, fd.toObject());
                    }

                    return data;
                },
                options: opts,
                rejectClose: true
            }).catch(() => { return {}; });
        }
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
            let tex = await loadTexture(f);
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
        return CanvasAnimation._animatePromise(
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

    static async fadeImage(entity, hide, time) {
        let icon = entity.object.icon || entity.object.tile || entity.object;
        let animationName = `MonksActiveTiles.${entity.documentName}.${entity.id}.animateShowHide`;

        await CanvasAnimation.terminateAnimation(animationName);

        if (!hide) {
            icon.alpha = (game.user.isGM ? icon.alpha : 0);
            if (entity.object.hud)
                entity.object.hud.alpha = 0;
            icon.visible = true;
            entity.object.visible = true;

            entity.object._showhide = icon.alpha;
        }

        const attributes = [
            { parent: icon, attribute: 'alpha', to: (hide ? (game.user.isGM ? 0.5 : 0) : entity.alpha || 1), object: entity.object, hide: hide, from: icon.alpha }
        ];

        if (entity instanceof TokenDocument)
            attributes.push({ parent: entity.object.hud, attribute: 'alpha', to: (hide ? 0 : 1) });

        let duration = time - new Date().getTime();
        if (duration < 0) {
            log("Fade time has already passed");
            return new Promise((resolve) => { resolve(); });
        }

        return CanvasAnimation.animate(attributes, {
            name: animationName,
            context: icon,
            duration: duration,
            ontick: (dt, attributes) => {
                for (let attribute of attributes) {
                    if (attribute.object && !attribute.hide) {
                        if (!attribute.object.visible)
                            attribute.object.visible = true;
                        let realval = attributes[0].from + attributes[0].done;
                        if (attribute.parent.alpha != realval)
                            attribute.parent.alpha = realval;
                        entity.object._showhide = attribute.parent[attribute.attribute];
                    }
                }

                log("Token fade", attributes[0].object.alpha, attributes[0].parent.alpha, attributes[0].from + attributes[0].done, attributes[0].remaining, attributes[0].done, attributes[0].delta, attributes[0].object.visible, attributes[0].parent.visible);
            }
        }).then(() => {
            if (hide)
                entity.object.visible = false;
            if (entity.object.hud)
                entity.object.hud.alpha = 1;
            delete entity.object._showhide;
        });
    }

    static async transitionImage(entity, from, to, transition, time) {
        let t = entity._object;

        let animationName = `MonksActiveTiles.${entity.documentName}.${entity.id}.animateTransitionImage`;

        await CanvasAnimation.terminateAnimation(animationName);

        let duration = time - new Date().getTime();
        if (duration < 0) {
            log("Transition time has already passed");
            new Promise((resolve) => { resolve(); });
        }

        const container = new PIXI.Container();
        let idx = canvas.primary.children.indexOf(t) || 0;
        t._transition = canvas.primary.addChildAt(container, idx + 1);
        container.width = entity.width;
        container.height = entity.height;
        container.x = entity.x;
        container.y = entity.y;

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

        if (!t._textures[from])
            t._textures[from] = await loadTexture(from);
        
        if (!t._textures[to])
            t._textures[to] = await loadTexture(to);

        let sprites = [
            { sprite: new PIXI.Sprite(t._textures[from]), texture: t._textures[from] },
            { sprite: new PIXI.Sprite(t._textures[to]), texture: t._textures[to] }
        ]

        //add them to the tile
        const r = Math.toRadians(entity.rotation);
        for (let sprite of sprites) {
            let s = sprite.sprite;
            s.x = 0;
            s.y = 0;
            inner.addChild(s);

            // Update tile appearance
            s.alpha = entity.alpha;
            s.scale.x = entity.width / sprite.texture.width;
            s.scale.y = entity.height / sprite.texture.height;
            s.rotation = r;
            s.anchor.set(0.5, 0.5);
            s.tint = entity.tint ? foundry.utils.colorStringToHex(entity.tint) : 0xFFFFFF;
        }

        //hide the actual image
        t.mesh.visible = false;
        t.texture = t._textures[to];
        t.mesh.texture = t._textures[to];
        t.mesh.scale.x = t.width / t.texture.width;
        t.mesh.scale.y = t.height / t.texture.height;

        let attributes = [];

        let s_from = sprites[0].sprite;
        let s_to = sprites[1].sprite;

        s_from.alpha = entity.alpha;
        if (transition == "fade") {
            s_to.alpha = 0;

            // Define attributes
            attributes = [
                { parent: s_from, attribute: 'alpha', to: 0 },
                { parent: s_to, attribute: 'alpha', to: entity.alpha }
            ];
        }

        if (transition == "blur") {
            s_from.filters = [new PIXI.filters.BlurFilter()];
            s_from.filters[0].blur == 0;
            s_to.filters = [new PIXI.filters.BlurFilter()];
            s_to.filters[0].blur == 200;
            s_to.alpha = 0;

            attributes = [
                { parent: s_from.filters[0], attribute: 'blur', to: 200 },
                { parent: s_to.filters[0], attribute: 'blur', to: 0 },
                { parent: s_from, attribute: 'alpha', to: 0 },
                { parent: s_to, attribute: 'alpha', to: entity.alpha }
            ];
        }

        if (transition.startsWith("slide")) {
            attributes.push({ parent: s_from, attribute: 'alpha', to: 0 });
        } else if (transition.startsWith("bump")) {
            if (transition.endsWith("left")) {
                attributes.push({ parent: s_from, attribute: 'x', to: -entity.width });
            } else if (transition.endsWith("right")) {
                attributes.push({ parent: s_from, attribute: 'x', to: entity.width });
            } else if (transition.endsWith("up")) {
                attributes.push({ parent: s_from, attribute: 'y', to: -entity.height });
            } else if (transition.endsWith("down")) {
                attributes.push({ parent: s_from, attribute: 'y', to: entity.height });
            }
        }

        if (transition.endsWith("left")) {
            s_to.x = entity.width;
            attributes.push({ parent: s_to, attribute: 'x', to: 0 });
        } else if (transition.endsWith("right")) {
            s_to.x = -entity.width;
            attributes.push({ parent: s_to, attribute: 'x', to: 0 });
        } else if (transition.endsWith("up")) {
            s_to.y = entity.height;
            attributes.push({ parent: s_to, attribute: 'y', to: 0 });
        } else if (transition.endsWith("down")) {
            s_to.y = -entity.height;
            attributes.push({ parent: s_to, attribute: 'y', to: 0 });
        }

        return CanvasAnimation.animate(attributes, {
            name: animationName,
            context: t,
            duration: duration,
            ontick: (dt, attributes) => {
                if (t.mesh.visible)
                    t.mesh.visible = false;
            }
        }).then(() => {
            canvas.primary.removeChild(container);
            delete t._transition;
            t.texture = t._textures[to];
            t.texture.x = 0;
            t.texture.y = 0;
            t.mesh.visible = true;
            t.mesh.refresh();
        });
    }

    static findVacantSpot(pos, token, scene, newTokens, dest, snap) {
        let tokenList = scene.tokens.contents.concat(...newTokens);
        let tokenCollide = function (pt) {
            let ptWidth = (token.data.width * scene.dimensions.size) / 2;
            let checkpt = duplicate(pt);
            if (snap) {
                checkpt.x += ((Math.abs(token.data.width) * scene.dimensions.size) / 2);
                checkpt.y += ((Math.abs(token.data.height) * scene.dimensions.size) / 2);
            }

            let found = tokenList.find(tkn => {
                if (token.id == tkn.id)
                    return false;

                let tokenX = tkn.x + ((Math.abs(tkn.width) * scene.dimensions.size) / 2);
                let tokenY = tkn.y + ((Math.abs(tkn.height) * scene.dimensions.size) / 2);

                let distSq = parseInt(Math.sqrt(Math.pow(checkpt.x - tokenX, 2) + Math.pow(checkpt.y - tokenY, 2)));
                let radSumSq = ((Math.abs(tkn.width) * scene.dimensions.size) / 2) + ptWidth;

                let result = (distSq < radSumSq - 5);
                
                //log('check', count, dist, tkn.name, distSq, radSumSq, checkpt, tkn, result);
                //gr.lineStyle(2, 0x808080).drawCircle(tokenX + debugoffset.x, tokenY + debugoffset.y, ((tkn.width * scene.dimensions.size) / 2));
                

                return result;
            })

            return found != undefined;
        }

        let wallCollide = function (ray) {
            for (let wall of scene.walls) {
                if (lineSegmentIntersects(ray.A, ray.B, { x: wall.c[0], y: wall.c[1] }, { x: wall.c[2], y: wall.c[3] }))
                    return true;
            }
            return false
        }

        let outsideTile = function (pt) {
            if (dest && dest.width && dest.height) {
                let checkpt = duplicate(pt);
                if (snap) {
                    checkpt.x += ((Math.abs(token.data.width) * scene.dimensions.size)/ 2);
                    checkpt.y += ((Math.abs(token.data.height) * scene.dimensions.size) / 2);
                }

                //gr.lineStyle(2, 0x808080).drawRect(dest.x + debugoffset.x, dest.y + debugoffset.y, dest.width, dest.height);
                return (checkpt.x < dest.x || checkpt.y < dest.y || checkpt.x > dest.x + Math.abs(dest.width) || checkpt.y > dest.y + Math.abs(dest.height));
            }
            return false;
        }

        /*let debugoffset = (scene != undefined ? { x: -(pos.x - scene.dimensions.paddingX), y: -(pos.y - scene.dimensions.paddingY) } : { x: 0, y: 0 });
        let gr = new PIXI.Graphics();
        if (MonksActiveTiles.debugGr)
            canvas.tokens.removeChild(MonksActiveTiles.debugGr);
        MonksActiveTiles.debugGr = gr;
        canvas.tokens.addChild(gr);
        gr.beginFill(0x0000ff).drawCircle(pos.x + debugoffset.x, pos.y + debugoffset.y, 4).endFill();*/

        let count = 0;
        const tw = (Math.abs(token.data.width) * scene.dimensions.size);
        let dist = 0;
        let angle = null;
        let rotate = 1; //should be set first thing, but if it isn't just make sure it's not 0
        let spot = duplicate(pos);
        let checkspot = duplicate(spot);
        if (snap) {
            checkspot.x -= ((Math.abs(token.data.width) * scene.dimensions.size) / 2);
            checkspot.y -= ((Math.abs(token.data.height) * scene.dimensions.size) / 2);
            checkspot.x = checkspot.x.toNearest(scene.dimensions.size);
            checkspot.y = checkspot.y.toNearest(scene.dimensions.size);
        }
        let ray = new Ray({ x: pos.x, y: pos.y }, { x: checkspot.x, y: checkspot.y });

        while (tokenCollide(checkspot) || wallCollide(ray) || outsideTile(checkspot)) {

            //log("Checking Position:", checkspot, tknRes, wallRes, tileRes);

            count++;
            //move the point along
            if (angle == undefined || angle > 2 * Math.PI) {
                dist += scene.dimensions.size;
                angle = 0;
                rotate = Math.atan2(tw, dist); //What's the angle to move, so at this distance, the arc travles the token width
            } else {
                //rotate
                angle += rotate;
            }
            spot.x = pos.x + (Math.cos(angle) * dist);
            spot.y = pos.y + (-Math.sin(angle) * dist);
            checkspot = duplicate(spot);

            //need to check that the resulting snap to grid isn't going to put this out of bounds
            if (snap) {
                checkspot.x -= ((Math.abs(token.data.width) * scene.dimensions.size) / 2);
                checkspot.y -= ((Math.abs(token.data.height) * scene.dimensions.size) / 2);
                checkspot.x = checkspot.x.toNearest(scene.dimensions.size);
                checkspot.y = checkspot.y.toNearest(scene.dimensions.size);

                ray.B.x = checkspot.x + ((Math.abs(token.data.width) * scene.dimensions.size) / 2);
                ray.B.y = checkspot.y + ((Math.abs(token.data.height) * scene.dimensions.size) / 2);
            } else {
                ray.B.x = checkspot.x;
                ray.B.y = checkspot.y;
            }

            //for testing
            /*
            log('Checking', checkspot, dest);

            let collide = wallCollide(ray);
            let tcollide = tokenCollide(checkspot);
            let outside = outsideTile(checkspot);

            if (spot.x != checkspot.x || spot.y != checkspot.y) {
                gr.beginFill(0x800080)
                    .lineStyle(2, 0x800080)
                    .moveTo(spot.x + debugoffset.x, spot.y + debugoffset.y)
                    .lineTo(checkspot.x + debugoffset.x, checkspot.y + debugoffset.y)
                    .drawCircle(spot.x + debugoffset.x, spot.y + debugoffset.y, 4).endFill();
            }
            gr.beginFill(collide ? 0xff0000 : (tcollide ? 0xffff00 : 0x00ff00)).drawCircle(checkspot.x + debugoffset.x, checkspot.y + debugoffset.y, 4).endFill();

            log('checkspot', checkspot, dist, collide, tcollide, outside);*/
            
            if (count > 50) {
                //if we've exceeded the maximum spots to check then set it to the original spot
                spot = pos;
                break;
            }
        }

        //log("Found spot", spot, count, scene.tokens.contents.length);

        //gr.lineStyle(2, 0x00ff00).drawCircle(spot.x + debugoffset.x, spot.y + debugoffset.y, 4);

        return spot;
    }

    static async inlineRoll(value, rgx, chatMessage, rollMode, token) {
        let doRoll = async function (match, command, formula, closing, label, ...args) {
            if (closing.length === 3) formula += "]";
            let roll = await Roll.create(formula).roll();

            if (chatMessage) {
                const cls = ChatMessage.implementation;
                const speaker = cls.getSpeaker({token:token});
                roll.toMessage({ flavor: (label ? `${label}: ${roll.total}` : roll.total), speaker }, { rollMode: rollMode });
            }

            return roll.total;
        }

        let retVal = value;

        const matches = value.matchAll(rgx);
        for (let match of Array.from(matches).reverse()) {
            //+++ need to replace this value in value
            let result = await doRoll(...match);
            retVal = retVal.replace(match[0], result);
        }

        return retVal;
    }

    constructor() {
    }

    static addToResult(entity, result) {
        if (!entity)
            return;

        if (entity instanceof TokenDocument) {
            if (result.tokens == undefined) result.tokens = [];
            result.tokens.push(entity);
        } else if (entity instanceof TileDocument) {
            if (result.tiles == undefined) result.tiles = [];
            result.tiles.push(entity);
        } else if (entity instanceof DrawingDocument) {
            if (result.drawings == undefined) result.drawings = [];
            result.drawings.push(entity);
        } else if (entity instanceof AmbientLightDocument) {
            if (result.lights == undefined) result.lights = [];
            result.lights.push(entity);
        } else if (entity instanceof AmbientSoundDocument) {
            if (result.sounds == undefined) result.sounds = [];
            result.sounds.push(entity);
        } else if (entity instanceof WallDocument) {
            if (result.walls == undefined) result.walls = [];
            result.walls.push(entity);
        } else if (entity instanceof JournalEntry) {
            if (result.journal == undefined) result.journal = [];
            result.journal.push(entity);
        } else if (entity instanceof Scene) {
            if (result.scenes == undefined) result.scenes = [];
            result.scenes.push(entity);
        } else if (entity instanceof Macro) {
            if (result.macros == undefined) result.macros = [];
            result.macros.push(entity);
        } else if (entity instanceof Item) {
            if (result.items == undefined) result.items = [];
            result.items.push(entity);
        } else if (entity instanceof RollTable) {
            if (result.rolltables == undefined) result.rolltables = [];
            result.rolltables.push(entity);
        }
    }

    static async init() {
        log('Initializing Monks Active Tiles');
        registerSettings();

        game.MonksActiveTiles = this;

        Array.prototype.pickRandom = function (id) {
            if (this.length == 0)
                return null;
            else if (this.length == 1)
                return this[0];
            else {
                let results = this.filter(d => d.dest == undefined || d.dest.id != id);
                return results[Math.floor(Math.random() * results.length)];
            }
        }

        //let otherGroups = {};
        //await Hooks.call("setupTileGroups", otherGroups);
        //MonksActiveTiles.triggerGroups = Object.assign(MonksActiveTiles.triggerGroups, otherGroups);

        //let otherTriggers = {};
        await Hooks.call("setupTileActions", this);
        //MonksActiveTiles.triggerActions = Object.assign(otherTriggers, MonksActiveTiles.triggerActions);

        if (game.modules.get("lib-wrapper")?.active) {
            libWrapper.ignore_conflicts("monks-active-tiles", "monks-enhanced-journal", "JournalDirectory.prototype._onClickDocumentName");
            libWrapper.ignore_conflicts("monks-active-tiles", "monks-enhanced-journal", "Compendium.prototype._onClickEntry");
            libWrapper.ignore_conflicts("monks-active-tiles", "monks-scene-navigation", "SceneDirectory.prototype._onClickDocumentName");
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

        let tileCreatePreview = function (wrapped, ...args) {
            let data = args[0];

            if (getProperty(data, "flags.monks-active-tiles") == undefined) {
                data = mergeObject(data, {
                    flags: {
                        'monks-active-tiles': {
                            active: true,
                            trigger: setting('default-trigger'),
                            chance: 100,
                            restriction: 'all',
                            controlled: 'all',
                            actions: []
                        }
                    }
                });
            }

            return wrapped(...args);
        }

        if (game.modules.get("lib-wrapper")?.active) {
            libWrapper.register("monks-active-tiles", "Tile.prototype.constructor.createPreview", tileCreatePreview, "WRAPPER");
        } else {
            const oldTileCreatePreview = Tile.prototype.constructor.createPreview;
            Tile.prototype.constructor.createPreview = function (event) {
                return tileCreatePreview.call(this, oldTileCreatePreview.bind(this), ...arguments);
            }
        }

        let tileDraw = function (wrapped, ...args) {
            if (this._transition) {
                log("Testing");
                this.removeChild(this._transition);
            }
            return wrapped(...args).then((result) => {
                if (this._transition) {
                    this.addChild(this._transition);
                    this.mesh.visible = false;
                    log("Testing");
                }
                let triggerData = this.document.flags["monks-active-tiles"];
                if (triggerData?.usealpha && !this._alphaMap)
                    this._createAlphaMap({ keepPixels: true });
                return result;
            });
        }

        if (game.modules.get("lib-wrapper")?.active) {
            libWrapper.register("monks-active-tiles", "Tile.prototype.draw", tileDraw, "WRAPPER");
        } else {
            const oldTileDraw = Tile.prototype.draw;
            Tile.prototype.draw = function (event) {
                return tileDraw.call(this, oldTileDraw.bind(this), ...arguments);
            }
        }

        let tokenDraw = function (wrapped, ...args) {
            return wrapped(...args).then((result) => {
                if (this._showhide) {
                    this.icon.alpha = this._showhide;
                    this.icon.visible = true;
                    this.visible = true;
                    log("Token Draw");
                }
                return result;
            });
        }

        if (game.modules.get("lib-wrapper")?.active) {
            libWrapper.register("monks-active-tiles", "Token.prototype.draw", tokenDraw, "WRAPPER");
        } else {
            const oldTokenDraw = Token.prototype.draw;
            Token.prototype.draw = function (event) {
                return tokenDraw.call(this, oldTokenDraw.bind(this), ...arguments);
            }
        }

        let oldCycleTokens = TokenLayer.prototype.cycleTokens;
        TokenLayer.prototype.cycleTokens = function (...args) {
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

            let triggerDoor = function (wall) {
                if (wall && setting("allow-door")) {
                    //check if this is associated with a Tile
                    if (wall.flags["monks-active-tiles"]?.entity) {
                        if ((!!wall.flags["monks-active-tiles"][wall._wallchange || "checklock"]) ||
                            (wall.flags["monks-active-tiles"].open == undefined && wall.flags["monks-active-tiles"].close == undefined && wall.flags["monks-active-tiles"].lock == undefined && wall.flags["monks-active-tiles"].secret == undefined && wall.flags["monks-active-tiles"].checklock == undefined)) {

                            let entity = JSON.parse(wall.flags['monks-active-tiles']?.entity || "{}");
                            if (entity.id) {
                                let walls = [wall];

                                let doc;
                                if (entity.id.startsWith("tagger")) {
                                    if (game.modules.get('tagger')?.active) {
                                        let tag = entity.id.substring(7);
                                        doc = Tagger.getByTag(tag)[0];
                                    }
                                } else {
                                    let parts = entity.id.split(".");

                                    const [docName, docId] = parts.slice(0, 2);
                                    parts = parts.slice(2);
                                    const collection = CONFIG[docName].collection.instance;
                                    doc = collection.get(docId);

                                    while (doc && (parts.length > 1)) {
                                        const [embeddedName, embeddedId] = parts.slice(0, 2);
                                        doc = doc.getEmbeddedDocument(embeddedName, embeddedId);
                                        parts = parts.slice(2);
                                    }
                                }

                                if (doc) {
                                    let triggerData = doc.flags["monks-active-tiles"];
                                    if (triggerData && triggerData.active) {
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

                                        return doc.trigger({ tokens: tokens, method: 'door', options: { walls: walls, change: wall._wallchange || "checklock" } });
                                    }
                                }
                            }
                        }
                    }
                    wall._wallchange
                }
            }

            let result = wrapped(...args);
            if (result instanceof Promise) {
                return result.then((wall) => {
                    triggerDoor(wall?.document);
                });
            } else {
                triggerDoor(this.wall.document);
                return result;
            }
        }

        if (game.modules.get("lib-wrapper")?.active) {
            libWrapper.register("monks-active-tiles", "DoorControl.prototype._onRightDown", doorControl, "WRAPPER");
        } else {
            const oldDoorControl = DoorControl.prototype._onRightDown;
            DoorControl.prototype._onRightDown = function (event) {
                return doorControl.call(this, oldDoorControl.bind(this), ...arguments);
            }
        }

        if (game.modules.get("lib-wrapper")?.active) {
            libWrapper.register("monks-active-tiles", "DoorControl.prototype._onMouseDown", doorControl, "WRAPPER");
        } else {
            const oldDoorControl = DoorControl.prototype._onMouseDown;
            DoorControl.prototype._onMouseDown = function (event) {
                return doorControl.call(this, oldDoorControl.bind(this), ...arguments);
            }
        }

        let playlistCollapse = function (wrapped, ...args) {
            let waitingType = MonksActiveTiles.waitingInput?.waitingfield?.data('type');
            if (waitingType == 'entity') {
                let event = args[0];
                const playlistId = $(event.currentTarget).closest('.playlist-header').data('documentId');
                const playlist = game.playlists.get(playlistId);
                if (playlist)
                    MonksActiveTiles.controlEntity(playlist);
            } else
                return wrapped(...args);
        }

        if (game.modules.get("lib-wrapper")?.active) {
            libWrapper.register("monks-active-tiles", "PlaylistDirectory.prototype._onPlaylistCollapse", playlistCollapse, "MIXED");
        } else {
            const oldPlaylistCollapse = PlaylistDirectory.prototype._onPlaylistCollapse;
            PlaylistDirectory.prototype._onPlaylistCollapse = function (event) {
                return playlistCollapse.call(this, oldPlaylistCollapse.bind(this), ...arguments);
            }
        }

        let contains = (position, tile) => {
            return position.x >= tile.x
                && position.y >= tile.y
                && position.x <= (tile.x + Math.abs(tile.width))
                && position.y <= (tile.y + Math.abs(tile.height));
        };

        let lastPosition = undefined;
        MonksActiveTiles.hoveredTiles = new Set();

        document.body.addEventListener("mousemove", function () {

            let mouse = canvas?.app?.renderer?.plugins?.interaction?.mouse;
            if (!mouse) return;

            const currentPosition = mouse.getLocalPosition(canvas.app.stage);

            if (!lastPosition) {
                lastPosition = currentPosition;
                return;
            }

            if (!canvas.scene)
                return;

            for (let tile of canvas.scene.tiles) {

                let triggerData = tile.flags["monks-active-tiles"];

                if (!triggerData || !triggerData.active || !(triggerData.trigger?.includes("hover") || triggerData.pointer))
                    continue;

                //check to see if this trigger is restricted by control type
                if ((triggerData.controlled === 'gm' && !game.user.isGM) || (triggerData.controlled === 'player' && game.user.isGM))
                    continue;

                let tokens = [];
                if (triggerData.trigger?.includes("hover")) {
                    tokens = canvas.tokens.controlled.map(t => t.document);
                    //check to see if this trigger is per token, and already triggered
                    if (triggerData.pertoken) {
                        tokens = tokens.filter(t => !tile.hasTriggered(t.id)); //.uuid
                        if (tokens.length === 0)
                            continue;
                    }
                }

                let lastPositionContainsTile = contains(lastPosition, tile);
                let currentPositionContainsTile = contains(currentPosition, tile);

                if (!lastPositionContainsTile && currentPositionContainsTile && !MonksActiveTiles.hoveredTiles.has(tile)) {
                    MonksActiveTiles.hoveredTiles.add(tile);
                    if (triggerData.pointer)
                        $('#board').css({ cursor: 'pointer' });
                    if (triggerData.trigger === "hover" || triggerData.trigger === "hoverin") {
                        if (setting("prevent-when-paused") && game.paused && !game.user.isGM && triggerData.allowpaused !== true)
                            continue;

                        tile.trigger({ tokens: tokens, method: 'hoverin', pt: currentPosition });
                    }
                }

                if (lastPositionContainsTile && !currentPositionContainsTile && MonksActiveTiles.hoveredTiles.has(tile)) {
                    MonksActiveTiles.hoveredTiles.delete(tile);
                    if (triggerData.pointer && MonksActiveTiles.hoveredTiles.size == 0)
                        $('#board').css({ cursor: '' });
                    if (triggerData.trigger === "hover" || triggerData.trigger === "hoverout") {
                        if (setting("prevent-when-paused") && game.paused && !game.user.isGM && triggerData.allowpaused !== true)
                            continue;

                        tile.trigger({ tokens: tokens, method: 'hoverout', pt: currentPosition });
                    }
                }
            }

            lastPosition = currentPosition;
        });

        let _onLeftClick = function (wrapped, ...args) {
            let event = args[0];
            canvasClick.call(this, event, 'click');
            wrapped(...args);
        }

        let _onRightClick = function (wrapped, ...args) {
            let event = args[0];
            canvasClick.call(this, event, 'rightclick');
            wrapped(...args);
        }

        let _onLeftClick2 = function (wrapped, ...args) {
            let event = args[0];
            canvasClick.call(this, event, 'dblclick');
            wrapped(...args);
        }

        let canvasClick = function (event, clicktype) {
            let waitingType = MonksActiveTiles.waitingInput?.waitingfield?.data('type');
            if (clicktype == "click" && (waitingType == 'location' || waitingType == 'either' || waitingType == 'position')) {
                let restrict = MonksActiveTiles.waitingInput.waitingfield.data('restrict');
                if (restrict && !restrict(canvas.scene)) {
                    ui.notifications.error(i18n("MonksActiveTiles.msg.invalid-location"));
                    return;
                }

                let pos = event.data.getLocalPosition(canvas.app.stage);
                let update = { x: parseInt(pos.x), y: parseInt(pos.y), sceneId: (canvas.scene.id != MonksActiveTiles.waitingInput.options.parent.object.parent.id ? canvas.scene.id : null) };
                ActionConfig.updateSelection.call(MonksActiveTiles.waitingInput, update);
            }

            if (canvas.activeLayer instanceof TokenLayer) {
                //check to see if there are any Tiles that can be activated with a click
                MonksActiveTiles.checkClick(event.data.origin, clicktype);
            }
        }

        if (game.modules.get("lib-wrapper")?.active) {
            libWrapper.register("monks-active-tiles", "Canvas.prototype._onClickLeft", _onLeftClick, "WRAPPER");
        } else {
            const oldClickLeft = Canvas.prototype._onClickLeft;
            Canvas.prototype._onClickLeft = function (event) {
                return _onLeftClick.call(this, oldClickLeft.bind(this), ...arguments);
            }
        }

        if (game.modules.get("lib-wrapper")?.active) {
            libWrapper.register("monks-active-tiles", "Canvas.prototype._onClickRight", _onRightClick, "WRAPPER");
        } else {
            const oldClickRight = Canvas.prototype._onClickRight;
            Canvas.prototype._onClickRight = function (event) {
                return _onRightClick.call(this, oldClickRight.bind(this), ...arguments);
            }
        }

        if (game.modules.get("lib-wrapper")?.active) {
            libWrapper.register("monks-active-tiles", "Canvas.prototype._onClickLeft2", _onLeftClick2, "WRAPPER");
        } else {
            const oldClickLeft = Canvas.prototype._onClickLeft2;
            Canvas.prototype._onClickLeft2 = function (event) {
                return _onLeftClick2.call(this, oldClickLeft.bind(this), ...arguments);
            }
        }

        let clickDocumentName = async function (wrapped, ...args) {
            let event = args[0];
            let waitingType = MonksActiveTiles.waitingInput?.waitingfield?.data('type');
            if (waitingType == 'entity') { //+++ need to make sure this is allowed, only create should be able to select templates
                event.preventDefault();
                const documentId = event.currentTarget.closest(".document").dataset.documentId;
                const document = this.constructor.collection.get(documentId);

                let restrict = MonksActiveTiles.waitingInput.waitingfield.data('restrict');
                if (restrict && !restrict(document))
                    return wrapped(...args);

                ActionConfig.updateSelection.call(MonksActiveTiles.waitingInput, { id: document.uuid, name: document.name });
            } else
                wrapped(...args);
        }

        if (game.modules.get("lib-wrapper")?.active) {
            libWrapper.register("monks-active-tiles", "ActorDirectory.prototype._onClickDocumentName", clickDocumentName, "MIXED");
        } else {
            const oldClickActorName = ActorDirectory.prototype._onClickDocumentName;
            ActorDirectory.prototype._onClickDocumentName = function (event) {
                return clickDocumentName.call(this, oldClickActorName.bind(this), ...arguments);
            }
        }

        if (game.modules.get("lib-wrapper")?.active) {
            libWrapper.register("monks-active-tiles", "ItemDirectory.prototype._onClickDocumentName", clickDocumentName, "MIXED");
        } else {
            const oldClickItemName = ItemDirectory.prototype._onClickDocumentName;
            ItemDirectory.prototype._onClickDocumentName = function (event) {
                return clickDocumentName.call(this, oldClickItemName.bind(this), ...arguments);
            }
        }

        if (game.modules.get("lib-wrapper")?.active) {
            libWrapper.register("monks-active-tiles", "JournalDirectory.prototype._onClickDocumentName", clickDocumentName, "MIXED");
        } else {
            const oldClickJournalName = JournalDirectory.prototype._onClickDocumentName;
            JournalDirectory.prototype._onClickDocumentName = function (event) {
                return clickDocumentName.call(this, oldClickJournalName.bind(this), ...arguments);
            }
        }

        if (game.modules.get("lib-wrapper")?.active) {
            libWrapper.register("monks-active-tiles", "SceneDirectory.prototype._onClickDocumentName", clickDocumentName, "MIXED");
        } else {
            const oldClickJournalName = SceneDirectory.prototype._onClickDocumentName;
            SceneDirectory.prototype._onClickDocumentName = function (event) {
                return clickDocumentName.call(this, oldClickJournalName.bind(this), ...arguments);
            }
        }

        if (game.modules.get("lib-wrapper")?.active) {
            libWrapper.register("monks-active-tiles", "MacroDirectory.prototype._onClickDocumentName", clickDocumentName, "MIXED");
        } else {
            const oldClickJournalName = MacroDirectory.prototype._onClickDocumentName;
            MacroDirectory.prototype._onClickDocumentName = function (event) {
                return clickDocumentName.call(this, oldClickJournalName.bind(this), ...arguments);
            }
        }

        let checkClickDocumentName = async function (wrapped, ...args) {
            if (this.constructor.name == "MacroSidebarDirectory") {
                return clickDocumentName.call(this, wrapped.bind(this), ...args);
            } else
                return wrapped(...args);
        }

        if (game.modules.get("lib-wrapper")?.active) {
            libWrapper.register("monks-active-tiles", "SidebarDirectory.prototype._onClickDocumentName", checkClickDocumentName, "MIXED");
        } else {
            const oldClickJournalName = SidebarDirectory.prototype._onClickDocumentName;
            SidebarDirectory.prototype._onClickDocumentName = function (event) {
                return checkClickDocumentName.call(this, oldClickJournalName.bind(this), ...arguments);
            }
        }

        let clickCompendiumEntry = async function (wrapped, ...args) {
            let event = args[0];
            if (MonksActiveTiles.waitingInput && MonksActiveTiles.waitingInput.waitingfield.data('type') == 'entity') { //+++ need to make sure this is allowed, only create should be able to select templates
                let li = event.currentTarget.parentElement;
                const document = await this.collection.getDocument(li.dataset.documentId);
                let restrict = MonksActiveTiles.waitingInput.waitingfield.data('restrict');
                if (restrict && !restrict(document))
                    return wrapped(...args);

                ActionConfig.updateSelection.call(MonksActiveTiles.waitingInput, { id: document.uuid, name: document.name });
            } else
                wrapped(...args);
        }

        if (game.modules.get("lib-wrapper")?.active) {
            libWrapper.register("monks-active-tiles", "Compendium.prototype._onClickEntry", clickCompendiumEntry, "MIXED");
        } else {
            const oldOnClickEntry = Compendium.prototype._onClickEntry;
            Compendium.prototype._onClickEntry = function (event) {
                return clickCompendiumEntry.call(this, oldOnClickEntry.bind(this), ...arguments);
            }
        }

        let leftClick = async function (wrapped, ...args) {
            MonksActiveTiles.controlEntity(this);
            return wrapped(...args);
        }

        if (game.modules.get("lib-wrapper")?.active) {
            libWrapper.register("monks-active-tiles", "AmbientLight.prototype._onClickLeft", leftClick, "WRAPPER");
        } else {
            const oldOnClickLeft = AmbientLight.prototype._onClickLeft;
            AmbientLight.prototype._onClickLeft = function (event) {
                return leftClick.call(this, oldOnClickLeft.bind(this), ...arguments);
            }
        }

        if (game.modules.get("lib-wrapper")?.active) {
            libWrapper.register("monks-active-tiles", "AmbientSound.prototype._onClickLeft", leftClick, "WRAPPER");
        } else {
            const oldOnClickLeft = AmbientSound.prototype._onClickLeft;
            AmbientSound.prototype._onClickLeft = function (event) {
                return leftClick.call(this, oldOnClickLeft.bind(this), ...arguments);
            }
        }

        if (game.modules.get("lib-wrapper")?.active) {
            libWrapper.register("monks-active-tiles", "Note.prototype._onClickLeft", leftClick, "WRAPPER");
        } else {
            const oldOnClickLeft = Note.prototype._onClickLeft;
            Note.prototype._onClickLeft = function (event) {
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
                    const path = new Ray({ x: token.x, y: token.y }, { x: dest[0] + dx, y: dest[1] + dy });

                    // Commit the movement and update the final resolved destination coordinates
                    let animate = true;
                    priorDest = duplicate(path.B);
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
                libWrapper.register("monks-active-tiles", "Ruler.prototype.moveToken", moveToken, "OVERRIDE");
            } else {
                const oldMoveToken = Ruler.prototype.moveToken;
                Ruler.prototype.moveToken = function (event) {
                    return moveToken.call(this, oldMoveToken.bind(this));
                }
            }
        }
    }

    static async fixTiles() {
        //find all tiles and check for actions that have the old format
        //openfql, execute(need to figure out if it's kandashi or tagger), setmovement, requestroll, filterrequest
        for (let scene of game.scenes) {
            for (let tile of scene.tiles) {
                let triggerData = tile.flags["monks-active-tiles"];
                if (triggerData && triggerData.actions.length > 0) {
                    let actions = duplicate(triggerData.actions);
                    let update = false;
                    for (let action of actions) {
                        switch (action.action) {
                            case "openfql":
                                action.action = "forien-quest-log.openfql";
                                update = true;
                                break;
                            case "setmovement":
                            case "requestroll":
                            case "filterrequest":
                                action.action = `monks-tokenbar.${action.action}`;
                                update = true;
                                break;
                            case "execute":
                                if (action.data.effect != undefined)
                                    action.action = `kandashis-fluid-canvas.execute`;
                                else
                                    action.action = `tagger.execute`;
                                update = true;
                                break;
                        }
                    }

                    if (update) {
                        await tile.setFlag("monks-active-tiles", "actions", actions);
                    }
                }
            }
        }
    }

    static async fixImageCycle() {
        //find all tiles and check for actions that have the old format
        //openfql, execute(need to figure out if it's kandashi or tagger), setmovement, requestroll, filterrequest
        for (let scene of game.scenes) {
            for (let tile of scene.tiles) {
                let triggerData = tile.flags["monks-active-tiles"];
                if (triggerData && triggerData.actions.length > 0) {
                    let actions = duplicate(triggerData.actions);
                    let update = false;
                    for (let i = 0; i < actions.length; i++) {
                        let action = actions[i];
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
                                update = true;
                            }
                        } else if (action.action == "tileimage" && action.id == undefined) {
                            action.id = makeid();
                            update = true;
                        }
                    }

                    if (update) {
                        await tile.setFlag("monks-active-tiles", "actions", actions);
                    }
                }
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
            case 'trigger': {
                if (game.user.isGM) {
                    let tokens = data.tokens;
                    for (let i = 0; i < tokens.length; i++)
                        tokens[i] = await fromUuid(tokens[i]);
                    let tile = await fromUuid(data.tileid);

                    if (data.options.walls) {
                        for (let i = 0; i < data.options.walls.length; i++)
                            data.options.walls[i] = await fromUuid(data.options.walls[i]);
                    }

                    tile.trigger({ tokens: tokens, userid: data.senderId, method: data.method, pt: data.pt, options: data.options });
                }
            } break;
            case 'switchview': {
                if (data.userid.find(u => u == game.user.id) != undefined) {
                    //let oldSize = canvas.scene.dimensions.size;
                    //let oldPos = canvas.scene._viewPosition;
                    let offset = { dx: (canvas.scene._viewPosition.x - data.oldpos?.x), dy: (canvas.scene._viewPosition.y - data.oldpos?.y) };
                    let scene = game.scenes.get(data.sceneid);
                    if (canvas.scene.id != scene.id)
                        await scene.view();
                    //let scale = oldSize / canvas.scene.dimensions.size;
                    if (data.oldpos && data.newpos) {
                        let changeTo = { x: data.newpos.x + offset.dx, y: data.newpos.y + offset.dy };
                        //log('change pos', oldPos, data.oldpos, data.newpos, offset, canvas.scene._viewPosition, changeTo);
                        canvas.pan(changeTo);
                        //log('changed', canvas.scene._viewPosition);
                    }
                }
            } break;
            case 'runmacro': {
                if (game.user.id == data.userid) {
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

                    let context = {
                        actor: token?.actor,
                        token: token?.object,
                        tile: tile.object,
                        user: game.users.get(data.userid),
                        args: data.args,
                        canvas: canvas,
                        scene: canvas.scene,
                        values: data.values,
                        value: data.value,
                        tokens: tokens,
                        method: data.method,
                        pt: data.pt,
                        actionId: data._id,
                    };

                    let results = (game.modules.get("advanced-macros")?.active || game.modules.get("furnace")?.active ?
                        await (macro.type == 'script' ? macro.execute(context) : macro.execute(data.args)) :
                        await MonksActiveTiles._execute.call(macro, context));
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
                if (game.user.id == data.userid) {
                    let tile = (data?.tileid ? await fromUuid(data.tileid) : null);
                    let token = (data?.tokenid ? await fromUuid(data.tokenid) : null);

                    MonksActiveTiles._showDialog(tile, token, data.value, data.type, data.title, data.content, data.options, data.yes, data.no).then((results) => {
                        MonksActiveTiles.emit("returndialog", { _id: data._id, tileid: data?.tileid, results: results });
                    });
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
                let tile = await fromUuid(data.tileid);
                if (tile) {
                    tile.object.play(true);
                }
            } break;
            case 'stopvideo': {
                let tile = await fromUuid(data.tileid);
                if (tile) {
                    const el = tile._object?.sourceElement;
                    if (el?.tagName !== "VIDEO") return;

                    game.video.stop(el);
                }
            } break;
            case 'playsound': {
                if ((data.userid == undefined || data.userid.find(u => u == game.user.id) != undefined) && (data.sceneid == undefined || canvas.scene.id == data.sceneid)) {
                    let tile = await fromUuid(data.tileid);
                    if (tile) {
                        if (tile.soundeffect != undefined && tile.soundeffect[data.actionid] != undefined) {
                            if (tile.soundeffect[data.actionid].playing && data.prevent)
                                return;

                            try {
                                tile.soundeffect[data.actionid].stop();
                            } catch {}
                        }

                        let volume = Math.clamped(data.volume, 0, 1);

                        debug('Playing', data.src);
                        AudioHelper.play({ src: data.src, volume: (data.fade > 0 ? 0 : volume), loop: data.loop }, false).then((sound) => {
                            if (data.fade > 0)
                                sound.fade(volume * game.settings.get("core", "globalInterfaceVolume"), { duration: data.fade * 1000 });
                            if (tile.soundeffect == undefined)
                                tile.soundeffect = {};
                            tile.soundeffect[data.actionid] = sound;
                            tile.soundeffect[data.actionid].on("end", () => {
                                debug('Finished playing', data.src);
                                delete tile.soundeffect[data.actionid];
                            });
                            tile.soundeffect[data.actionid]._mattvolume = volume;
                        });
                    }
                }
            } break;
            case 'stopsound': {
                if (data.type == 'all') {
                    game.audio.playing.forEach((s) => s.stop());
                } else {
                    if ((data.userid == undefined || data.userid.find(u => u == game.user.id) != undefined)) {
                        let tile = await fromUuid(data.tileid);
                        if (tile) {
                            if (tile.soundeffect != undefined) {
                                if (data.actionid) {
                                    try {
                                        tile.soundeffect[data.actionid].fade(0, { duration: data.fade * 1000 }).then((sound) => {
                                            sound.stop();
                                            delete tile.soundeffect[data.actionid]
                                        });
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
            case 'pan': {
                if (data.userid == game.user.id || (data.userid == undefined && !game.user.isGM)) {
                    let dest = { x: data.x, y: data.y, scale: data.scale, duration: data.duration };
                    if (data.animate)
                        canvas.animatePan(dest);
                    else
                        canvas.pan(dest);
                }
            } break;
            case 'offsetpan': {
                if (data.userid == game.user.id) {
                    if (data.animatepan)
                        canvas.animatePan({ x: canvas.scene._viewPosition.x - data.x, y: canvas.scene._viewPosition.y - data.y });
                    else
                        canvas.pan({ x: canvas.scene._viewPosition.x - data.x, y: canvas.scene._viewPosition.y - data.y });
                }
            } break;
            case 'fade': {
                if (data.userid == game.user.id) {
                    $('<div>').addClass('active-tile-backdrop').css({'background': setting('teleport-colour')}).appendTo('body').animate({ opacity: 1 }, {
                        duration: (data.time || 400), easing: 'linear', complete: async function () {
                            $(this).animate({ opacity: 0 }, {
                                duration: (data.time || 400), easing: 'linear', complete: function () { $(this).remove(); }
                            });
                        }
                    });
                }
            } break;
            case 'journal': {
                if ((data.showto == 'players' && !game.user.isGM) || (data.showto == 'trigger' && game.user.id == data.userid) || data.showto == 'everyone' || data.showto == undefined) {
                    let entity = await fromUuid(data.entityid);
                    if (!entity)
                        return;

                    if (data.permission === true && !entity.testUserPermission(game.user, "LIMITED"))
                        return ui.notifications.warn(`You do not have permission to view ${entity.name}.`);

                    if (!game.modules.get("monks-enhanced-journal")?.active || data?.enhanced !== true || !game.MonksEnhancedJournal.openJournalEntry(entity))
                        entity.sheet.render(true);
                }
            } break;
            case 'actor': {
                if ((data.showto == 'players' && !game.user.isGM) || (data.showto == 'trigger' && game.user.id == data.userid) || data.showto == 'everyone' || data.showto == undefined) {
                    let entity = await fromUuid(data.entityid);
                    if (!entity)
                        return;

                    if (data.permission === true && !entity.testUserPermission(game.user, "LIMITED"))
                        return ui.notifications.warn(`You do not have permission to view ${entity.name}.`);

                    entity.sheet.render(true);
                }
            } break;
            case 'notification': {
                if (data.userid == undefined || data.userid == game.user.id) {
                    ui.notifications.notify(data.content, data.type);
                }
            } break;
            case 'fql': {
                if ((data.for == 'players' && !game.user.isGM) || (data.for == 'trigger' && game.user.id == data.userid) || data.for == 'everyone' || data.for == undefined) {
                    Hooks.call('ForienQuestLog.Open.QuestLog');
                }
            } break;
            case 'target': {
                if (data.userid == game.user.id) {
                    game.user.updateTokenTargets(data.tokens);
                }
            } break;
            case 'scrollingtext': {
                if (data.userid == undefined || data.userids.find(u => u == game.user.id) != undefined) {
                    let token = canvas.tokens.get(data.tokenid);
                    if (token) {
                        canvas.interface.createScrollingText(token.center, data.content, {
                            anchor: data.anchor,
                            direction: data.direction,
                            duration: data.duration,
                            distance: token.h,
                            fontSize: 28,
                            stroke: 0x000000,
                            strokeThickness: 4,
                            jitter: 0.25
                        });
                    }
                }
            } break;
            case 'preload': {
                if (data.userid == undefined || data.userid == game.user.id) {
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
                                        let tex = await loadTexture(f);
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

                                MonksActiveTiles._slotmachine[entity.id].animation = CanvasAnimation._animatePromise(
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
                    if (entity)
                        MonksActiveTiles.transitionImage(entity, data.from, data.img, data.transition, data.time);
                } break;
            case 'move':
                {
                    let entity = await fromUuid(data.entityid);

                    let object = entity.object;
                    await CanvasAnimation.terminateAnimation(`${entity.documentName}.${entity.id}.animateMovement`);

                    let animate = async () => {
                        let ray = new Ray({ x: entity.x, y: entity.y }, { x: data.x, y: data.y });

                        // Move distance is 10 spaces per second
                        const s = canvas.dimensions.size;
                        entity._movement = ray;
                        const speed = s * 10;
                        const duration = (ray.distance * 1000) / speed;

                        // Define attributes
                        const attributes = [
                            { parent: object, attribute: 'x', to: data.x },
                            { parent: object, attribute: 'y', to: data.y }
                        ];

                        // Dispatch the animation function
                        let animationName = `${entity.documentName}.${entity.id}.animateMovement`;
                        await CanvasAnimation.animate(attributes, {
                            name: animationName,
                            context: object,
                            duration: duration
                        });

                        entity._movement = null;
                    };

                    animate();

                } break;
            case 'showhide': {
                let entity = await fromUuid(data.entityid);

                if (entity)
                    MonksActiveTiles.fadeImage(entity, data.hide, data.time);
            } break;
        }
    }

    static checkClick(pt, clicktype = "click") {
        for (let tile of canvas.scene.tiles) {
            tile.checkClick(pt, clicktype);
        }
    }

    static controlEntity(entity) {
        let waitingType = MonksActiveTiles.waitingInput?.waitingfield?.data('type');
        if (waitingType == 'entity' || waitingType == 'either' || waitingType == 'position') {
            let restrict = MonksActiveTiles.waitingInput.waitingfield.data('restrict');
            if (restrict && !restrict(entity)) {
                ui.notifications.error(i18n("MonksActiveTiles.msg.invalid-entity"));
                return;
            }
            if(entity.document)
                ActionConfig.updateSelection.call(MonksActiveTiles.waitingInput, { id: entity.document.uuid, name: entity.document.name || (entity.document.documentName + ": " + entity.document.id) });
            else
                ActionConfig.updateSelection.call(MonksActiveTiles.waitingInput, { id: entity.uuid, name: (entity?.parent?.name ? entity.parent.name + ": " : "") + entity.name });
        }
    }

    static selectPlaylistSound(evt) {
        const playlistId = $(evt.currentTarget).data('playlistId');
        const soundId = $(evt.currentTarget).data('soundId');

        const sound = game.playlists.get(playlistId)?.sounds?.get(soundId);
        if (sound)
            MonksActiveTiles.controlEntity(sound);
    }

    static getTileSegments(tile, offset = 0) {
        let tileX1 = tile.x + offset;
        let tileY1 = tile.y + offset;
        let tileX2 = tile.x + Math.abs(tile.width) - offset;
        let tileY2 = tile.y + Math.abs(tile.height) - offset;

        let segments = [
            { a: { x: tileX1, y: tileY1 }, b: { x: tileX2, y: tileY1 } },
            { a: { x: tileX2, y: tileY1 }, b: { x: tileX2, y: tileY2 } },
            { a: { x: tileX2, y: tileY2 }, b: { x: tileX1, y: tileY2 } },
            { a: { x: tileX1, y: tileY2 }, b: { x: tileX1, y: tileY1 } }
        ];

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

            segments = [
                { a: pt1, b: pt2 },
                { a: pt2, b: pt3 },
                { a: pt3, b: pt4 },
                { a: pt4, b: pt1 }
            ];
        }

        return segments;
    }

    static setupTile() {
        TileDocument.prototype.pointWithin = function (point) {
            let pt = point;

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

                const cX = this.x + (Math.abs(this.width) / 2);
                const cY = this.y + (Math.abs(this.height) / 2);

                pt = rotate(cX, cY, pt.x, pt.y, this.rotation);
            }

            return !(pt.x <= this.x ||
                pt.x >= this.x + Math.abs(this.width) ||
                pt.y <= this.y ||
                pt.y >= this.y + Math.abs(this.height));
        }

        TileDocument.prototype.tokensWithin = function () {
            return this.parent.tokens.filter(t => {
                const midToken = { x: t.x + (Math.abs(t.width) / 2), y: t.y + (Math.abs(t.height) / 2) };
                if (game.modules.get("levels")?.active) {
                    let tileht = this.flags.levels?.rangeTop ?? 1000;
                    let tilehb = this.flags.levels?.rangeBottom ?? -1000;
                    if (t.elevation >= tilehb && t.elevation <= tileht)
                        return this.pointWithin(midToken);
                } else
                    return this.pointWithin(midToken);
            });
        }

        TileDocument.prototype.checkClick = function (pt, clicktype = 'click') {
            let triggerData = this.flags["monks-active-tiles"];
            if (triggerData && triggerData.active && triggerData.trigger == clicktype) {
                //prevent triggering when game is paused
                if (setting("prevent-when-paused") && game.paused && !game.user.isGM && triggerData.allowpaused !== true)
                    return;

                //check to see if this trigger is restricted by control type
                if ((triggerData.controlled == 'gm' && !game.user.isGM) || (triggerData.controlled == 'player' && game.user.isGM))
                    return;

                let tokens = canvas.tokens.controlled.map(t => t.document);
                //check to see if this trigger is per token, and already triggered
                if (triggerData.pertoken) {
                    tokens = tokens.filter(t => !this.hasTriggered(t.id)); //.uuid
                    if (tokens.length == 0)
                        return;
                }

                //check to see if the clicked point is within the Tile
                if (pt == undefined || (triggerData.usealpha ? this.object.containsPixel(pt.x, pt.y) : this.pointWithin(pt))) {
                    //this.preloadScene();
                    return this.trigger({ tokens: tokens, method: clicktype, pt: pt });
                }
            }
        }

        TileDocument.prototype.checkCollision = function (token, destination, usealpha) {
            let when = this.getFlag('monks-active-tiles', 'trigger');

            if (["create"].includes(when))
                return [];

            const tokenOffsetW = (token.width * token.parent.dimensions.size) / 2;
            const tokenOffsetH = (token.height * token.parent.dimensions.size) / 2;
            const tokenX1 = token.x + tokenOffsetW;
            const tokenY1 = token.y + tokenOffsetH;
            const tokenX2 = destination.x + tokenOffsetW;
            const tokenY2 = destination.y + tokenOffsetH;

            const tokenRay = new Ray({ x: tokenX1, y: tokenY1 }, { x: tokenX2, y: tokenY2 });

            if (when == 'both') {
                when = this.pointWithin({ x: tokenRay.A.x, y: tokenRay.A.y }) ? 'exit' : 'enter';
            }

            let buffer = (token.parent.dimensions.size / 5) * (when == 'enter' ? 1 : (when == 'exit' ? -1 : 0));

            let segments = MonksActiveTiles.getTileSegments(this, buffer);

            let intersect = segments
                .filter(s => foundry.utils.lineSegmentIntersects(tokenRay.A, tokenRay.B, s.a, s.b))
                .map(s => foundry.utils.lineSegmentIntersection(tokenRay.A, tokenRay.B, s.a, s.b));

            /*
            let gr = MonksActiveTiles.debugGr;
            if (!gr) {
                gr = new PIXI.Graphics();
                MonksActiveTiles.debugGr = gr;
                canvas.tokens.addChild(gr);
            }

            for (let seg of segments) {
                gr.lineStyle(2, 0xff0000).moveTo(seg.a.x, seg.a.y).lineTo(seg.b.x, seg.b.y);
            }
            for (let pt of intersect) {
                gr.beginFill(0x00ff00).drawCircle(pt.x, pt.y, 4).endFill();
            }
            */

            if ((when == 'movement' || when == 'elevation') && intersect.length == 0) {
                //check to see if there's moving within the Tile
                if (this.pointWithin({ x: tokenRay.A.x, y: tokenRay.A.y }) &&
                    this.pointWithin({ x: tokenRay.B.x, y: tokenRay.B.y })) {
                    intersect = [{ x1: tokenRay.A.x, y1: tokenRay.A.y, x2: tokenRay.B.x, y2: tokenRay.B.y }];
                }
            } else if (usealpha) {
                //check the spot using alpha

                // walk from the intersection point to the (token end for on enter, or token start for on exit
                // if the point is in the alpha map, then change the intersection point to this point.
            }

            return intersect;
        }

        TileDocument.prototype.canTrigger = function (token, collision, destination, elevation) {
            let triggerData = this.flags["monks-active-tiles"];
            if (triggerData) {
                // prevent players from triggering a tile if the game is paused.
                if (setting("prevent-when-paused") && game.paused && !game.user.isGM && triggerData.allowpaused !== true)
                    return;

                let when = this.getFlag('monks-active-tiles', 'trigger');

                if (!["enter", "exit", "both", "elevation", "movement", "stop", "create"].includes(when))
                    return;

                if (when == 'elevation' && elevation == token.elevation)
                    return;

                //check to see if this trigger is per token, and already triggered
                if (triggerData.pertoken && this.hasTriggered(token.id))
                    return;

                //check to see if this trigger is restricted by token type
                if ((triggerData.restriction == 'gm' && token.actor?.hasPlayerOwner) || (triggerData.restriction == 'player' && !token.actor?.hasPlayerOwner))
                    return;

                //check to see if this trigger is restricted by control type
                if ((triggerData.controlled == 'gm' && !game.user.isGM) || (triggerData.controlled == 'player' && game.user.isGM))
                    return;

                //If this trigger has a chance of failure, roll the dice
                if (triggerData.chance != 100) {
                    let chance = (Math.random() * 100);
                    if (chance > triggerData.chance) {
                        log(`trigger failed with ${chance}% out of ${triggerData.chance}%`);
                        return;
                    } else
                        log(`trigger passed with ${chance}% out of ${triggerData.chance}%`);
                }

                //sort by closest
                let sorted = (collision.length > 1 ? collision.sort((c1, c2) => (c1.t0 > c2.t0) ? 1 : -1) : collision);

                //clear out any duplicate corners
                let filtered = sorted.filter((value, index, self) => {
                    return self.findIndex(v => v.t0 === value.t0) === index;
                })

                let tokenMidX = ((token.width * token.parent.dimensions.size) / 2);
                let tokenMidY = ((token.height * token.parent.dimensions.size) / 2);
                //is the token currently in the tile
                let tokenPos = { x: (when == 'stop' ? destination.x : token.x) + tokenMidX, y: (when == 'stop' ? destination.y : token.y) + tokenMidY };
                let inTile = this.pointWithin(tokenPos); //!(tokenPos.x <= this.object.x || tokenPos.x >= this.object.x + this.object.width || tokenPos.y <= this.object.y || tokenPos.y >= this.object.y + this.object.height);

                //go through the list, alternating in/out until we find one that satisfies the on enter/on exit setting, and if it does, return the trigger point.
                let newPos = [];
                if (when == 'movement' || when == 'elevation') {
                    if (filtered.length == 2)
                        newPos.push({ x: filtered[0].x, y: filtered[0].y, x2: filtered[1].x, y2: filtered[1].y, method: 'movement' });
                    else {
                        if (inTile)
                            newPos.push({ x: filtered[0].x1, y: filtered[0].y1, x2: filtered[0].x2, y2: filtered[0].y2, method: 'movement' });
                        else
                            newPos.push({ x: filtered[0].x, y: filtered[0].y, x2: destination.x + tokenMidX, y2: destination.y + tokenMidY, method: 'movement' });
                    }
                } else if (when == 'stop') {
                    if (inTile)
                        newPos.push({ x: destination.x, y: destination.y, method: 'stop' });
                } else if (when == 'create') {
                    if (inTile)
                        newPos.push({ x: collision.x, y: collision.y, method: 'create' });
                } else {
                    let checkPos = function (wh) {
                        let idx = ((inTile ? 0 : 1) - (wh == 'enter' ? 1 : 0));

                        debug("Can Trigger", collision, sorted, filtered, inTile, wh, idx);

                        if (idx < 0 || idx >= filtered.length)
                            return;

                        let pos = duplicate(filtered[idx]);
                        pos.x -= tokenMidX;
                        pos.y -= tokenMidY;
                        pos.method = (wh == 'enter' ? "enter" : "exit");
                        newPos.push(pos);
                    }

                    checkPos(when == 'both' ? 'enter' : when);
                    if (when == 'both')
                        checkPos('exit');
                }

                return newPos;
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
            let when = this.getFlag('monks-active-tiles', 'trigger');
            if (when == 'movement')
                return { stop: false };
            let stopmovement = false;
            let stoppage = this.flags['monks-active-tiles'].actions.filter(a => {
                if (a.action == 'movement')
                    stopmovement = true;
                return MonksActiveTiles.triggerActions[a.action].stop === true;
            });
            return { stop: stoppage.length != 0, snap: stoppage.find(a => a.data?.snap), coolDown: stopmovement };
            //return (stoppage.length == 0 ? { stop: false } : (stoppage.find(a => a.data?.snap) ? 'snap' : true));
        }

        TileDocument.prototype.trigger = async function ({ tokens = [], userid = game.user.id, method, pt, options = {} } = {}) {
            if (MonksActiveTiles.allowRun) {
                let triggerData = this.flags["monks-active-tiles"];
                //if (this.flags["monks-active-tiles"]?.pertoken)
                if (game.user.isGM && triggerData.record === true) {
                    if (tokens.length > 0) {
                        for (let tkn of tokens)
                            await this.addHistory(tkn.id, method, userid);    //changing this to always register tokens that have triggered it.
                    } else if(method != "trigger")
                        await this.addHistory("", method, userid);
                }

                //only complete a trigger once the minimum is reached
                if (triggerData.minrequired && this.countTriggered() < triggerData.minrequired)
                    return;

                //A token has triggered this tile, what actions do we need to do
                let values = [];
                let value = Object.assign({ tokens: tokens }, options);
                let context = Object.assign({ tile: this, tokens: tokens, userid: userid, values: values, value: value, method: method, pt: pt }, options);

                let direction = {};
                if (!!pt && !!pt.x && !!pt.y) {
                    let tokenRay;
                    if (!tokens.length) {
                        let midTile = { x: this.x + (Math.abs(this.width) / 2), y: this.y + (Math.abs(this.height) / 2) };
                        tokenRay = new Ray({ x: midTile.x, y: midTile.y }, { x: pt.x, y: pt.y });
                    } else {
                        const midToken = { x: tokens[0].x + ((Math.abs(tokens[0].width) * canvas.grid.w) / 2), y: tokens[0].y + ((Math.abs(tokens[0].height) * canvas.grid.h) / 2) };
                        tokenRay = new Ray({ x: options.src?.x || tokens[0].x, y: options.src?.y || tokens[0].y }, { x: options.original?.x || pt.x, y: options.original?.y || pt.y });
                    }

                    direction.y = ((tokenRay.angle == 0 || tokenRay.angle == Math.PI) ? "" : (tokenRay.angle < 0 ? "up" : "down"));
                    direction.x = ((Math.abs(tokenRay.angle) == (Math.PI / 2)) ? "" : (Math.abs(tokenRay.angle) < (Math.PI / 2) ? "right" : "left"));
                    //log("Direction", tokenRay.angle, tokenRay, direction, tokens[0].x, tokens[0].y);
                    value.direction = direction;
                }

                let actions = triggerData?.actions || [];
                let start = 0;
                //auto anchors
                // gm, player, trigger type, direction?
                let autoanchor = actions.filter(a => a.action == "anchor" && a.data.tag.startsWith("_"));

                if (autoanchor.length) {
                    let user = game.users.get(userid);
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
                        }
                    }
                }

                return await this.runActions(context, Math.max(start, 0));
            } else {
                //post this to the GM
                let tokenData = tokens.map(t => (t?.document?.uuid || t?.uuid));
                if (options.walls) {
                    options.walls = options.walls.map(w => (w?.document?.uuid || w?.uuid));
                }
                MonksActiveTiles.emit('trigger', { tileid: this.uuid, tokens: tokenData, method: method, pt: pt, options: options } );
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
                let fn = trigger.fn;
                if (fn) {
                    //If there are batch actiosn to complete and this function is not batchable, then execute the changes
                    if (!trigger.batch)
                        await MonksActiveTiles.batch.execute();

                    if (action.delay > 0) {
                        let tile = this;
                        window.setTimeout(async function () {
                            try {
                                if (tile.getFlag('monks-active-tiles', 'active') !== false) {
                                    context.action = action;
                                    await fn.call(tile, context);
                                }
                            } catch (err) {
                                error(err);
                            }
                        }, action.delay * 1000);
                    } else {
                        let cancall = (resume != undefined) || await Hooks.call("preTriggerTile", this, this, context.tokens, context.action, context.userid, context.value);
                        if (cancall) {
                            try {
                                let result = resume || await fn.call(this, context);
                                resume = null;
                                if (typeof result == 'object') {
                                    log("context.value", context.value, "result", result);
                                    if (Array.isArray(result)) {
                                        for (let res of result) {
                                            if (typeof res == 'object') {
                                                context.value = mergeObject(context.value, res);
                                            }
                                        }
                                    } else
                                        context.value = mergeObject(context.value, result);
                                    delete context.value.goto;
                                    context.values.push(mergeObject(result, { action: action }));

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

                                    if (result.goto) {
                                        if (result.goto instanceof Array) {
                                            result.continue = false;
                                            for (let goto of result.goto) {
                                                if (this.getFlag('monks-active-tiles', 'active') !== false) {
                                                    debug("Jumping to Landing", goto.tag);
                                                    let idx = actions.findIndex(a => a.action == 'anchor' && a.data.tag == goto.tag);
                                                    if (idx != -1) {
                                                        let gotoContext = Object.assign({}, context);
                                                        gotoContext = mergeObject(gotoContext, { value: goto });
                                                        gotoContext._id = makeid();
                                                        await this.runActions(gotoContext, idx + 1);
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
                                        }
                                    }

                                    result = result.continue;
                                }
                                let cancontinue = await Hooks.call("triggerTile", this, this, context.tokens, context.action, context.userid, context.value);
                                if (result === false || cancontinue === false || this.getFlag('monks-active-tiles', 'active') === false || this.getFlag('monks-active-tiles', 'continue') === false) {
                                    this.unsetFlag('monks-active-tiles', 'continue');
                                    debug("Stopping actions", result, cancontinue, this.getFlag('monks-active-tiles', 'active'), this.getFlag('monks-active-tiles', 'continue'));
                                    break;
                                }
                            } catch (err) {
                                error(err);
                            }
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

            this.runActions(savestate, savestate.index, Object.assign({}, result));
        }

        TileDocument.prototype.hasTriggered = function (tokenid, method, userid) {
            let tileHistory = (this.flags["monks-active-tiles"]?.history || {});
            if (tokenid == undefined) {
                return Object.entries(tileHistory).length > 0;
            } else {
                let result = tileHistory[tokenid]?.triggered.filter(h => {
                    return (method == undefined || h.how == method) && (userid == undefined || h.who == userid);
                }).sort((a, b) => {
                    return (isFinite(a = a.valueOf()) && isFinite(b = b.valueOf()) ? (a < b) - (a > b) : NaN);
                });

                return (result && result[0]);
            }
        }

        TileDocument.prototype.countTriggered = function (tokenid, method, userid) {
            //let tileHistory = (this.flags["monks-active-tiles"]?.history || {});
            //return Object.entries(tileHistory).length;

            let tileHistory = (this.flags["monks-active-tiles"]?.history || {});
            if (tokenid == undefined) {
                let count = 0;
                for (let [k, v] of Object.entries(tileHistory)) {
                    let result = v?.triggered.filter(h => {
                        return (method == undefined || h.how == method) && (userid == undefined || h.who == userid);
                    }) || [];
                    count += result.length;
                }
                return count;
            } else if (tokenid == "unique") {
                return Object.keys(tileHistory).length;
            } else {
                let result = tileHistory[tokenid]?.triggered.filter(h => {
                    return (method == undefined || h.how == method) && (userid == undefined || h.who == userid);
                }) || [];

                return result.length;
            }
        }

        TileDocument.prototype.addHistory = async function (tokenid, method, userid) {
            let tileHistory = this.flags["monks-active-tiles"]?.history || {};
            let data = { id: makeid(), who: userid, how: method, when: Date.now() };
            if (!tileHistory[tokenid])
                tileHistory[tokenid] = { tokenid: tokenid, triggered: [data] };
            else
                tileHistory[tokenid].triggered.push(data);

            //this.flags = mergeObject(this.flags, { "monks-active-tiles.history": tileHistory }); //Due to a race condition we need to set the actual value before trying to save it

            try {
                await this.setFlag("monks-active-tiles", "history", duplicate(this.flags["monks-active-tiles"]?.history || tileHistory));
                canvas.perception.update({
                    refreshLighting: true,
                    refreshSounds: true,
                    initializeVision: true,
                    refreshVision: true,
                    refreshTiles: true,
                    forceUpdateFog: true
                }, true);
            } catch {}
        }

        TileDocument.prototype.removeHistory = async function (id) {
            let tileHistory = duplicate(this.flags["monks-active-tiles"]?.history || {});
            for (let [k, v] of Object.entries(tileHistory)) {
                let item = v.triggered.findSplice(h => h.id == id);
                if (item != undefined) {
                    this.flags = mergeObject(this.flags, { "monks-active-tiles.history": tileHistory }); //Due to a race condition we need to set the actual value before trying to save it
                    await this.setFlag("monks-active-tiles", "history", tileHistory);
                    break;
                }
            }
        }

        TileDocument.prototype.resetHistory = async function (tokenid) {
            //let tileHistory = duplicate(this.flags["monks-active-tiles"]?.history || {});
            if (tokenid == undefined) {
                this.flags["monks-active-tiles"].history = {};
                await this.update({ [`flags.monks-active-tiles.-=history`]: null }, { render: false });
            } else {
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
                        stats.list.push(mergeObject(data, {
                            tokenid: k,
                            name: token?.name || (k == "" ? "" : 'Unknown'),
                            username: user?.name || 'Unknown',
                            whenfrmt: time,
                            howname: MonksActiveTiles.triggerModes[data.how] || data.how
                        }));
                    }

                    if (tknstat.first && (stats.first == undefined || tknstat.first.when < stats.first.when))
                        stats.first = mergeObject(tknstat.first, { tokenid: k });
                    if (tknstat.last && (stats.last == undefined || tknstat.last.when > stats.last.when))
                        stats.last = mergeObject(tknstat.last, { tokenid: k });

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
            if (localize) label = game.i18n.localize(label);
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
            Object.entries(group.groups).forEach(e => option(...e));
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
}

Hooks.on('init', async () => {
    MonksActiveTiles.init();
});

Hooks.on('ready', () => {
    game.socket.on(MonksActiveTiles.SOCKET, MonksActiveTiles.onMessage);

    MonksActiveTiles._oldSheetClass = CONFIG.Tile.sheetClasses.base['core.TileConfig'].cls;
    CONFIG.Tile.sheetClasses.base['core.TileConfig'].cls = WithActiveTileConfig(CONFIG.Tile.sheetClasses.base['core.TileConfig'].cls);

    if (game.modules.get("item-piles")?.active && setting('drop-item')) {
        game.settings.set('monks-active-tiles', 'drop-item', false);
        ui.notifications.warn(i18n("MonksActiveTiles.msg.itempiles"));
        warn(i18n("MonksActiveTiles.msg.itempiles"));
    }

    if (!setting("fix-action-names")) {
        MonksActiveTiles.fixTiles();
        game.settings.set("monks-active-tiles", "fix-action-names", true);
    }
    if (!setting("fix-imagecycle")) {
        MonksActiveTiles.fixImageCycle();
        game.settings.set("monks-active-tiles", "fix-imagecycle", true);
    }
});

Hooks.on('createToken', async (document, options, userId) => {
    for (let tile of document.parent.tiles) {
        if (tile.flags['monks-active-tiles']?.active && tile.flags['monks-active-tiles']?.actions?.length > 0 && tile.flags['monks-active-tiles']?.trigger == 'create') {
            let token = document.object;

            if (game.modules.get("levels")?.active && _levels && _levels.isTokenInRange && !_levels.isTokenInRange(token, tile._object))
                continue;

            //check and see if the ray crosses a tile
            let dest = tile.canTrigger(document, [{ x: document.x, y: document.y }], { x: document.x, y: document.y }, 0);
            if (dest && dest.length) {
                let triggerPt = dest[0];
                let pt = { x: triggerPt.x + ((document.height * document.parent.dimensions.size) / 2), y: triggerPt.y + ((document.height * document.parent.dimensions.size) / 2) };

                //log('Triggering tile', update, stop);
                let original = { x: document.x, y: document.y };
                tile.trigger({ tokens: [document], method: 'create', pt: pt, options: { original } });
            }
        }
    }
});

Hooks.on('preUpdateToken', async (document, update, options, userId) => { 
    //log('preupdate token', document, update, options, MonksActiveTiles._rejectRemaining);

    /*
    if (MonksActiveTiles._rejectRemaining[document.id] && options.bypass !== true) {
        update.x = MonksActiveTiles._rejectRemaining[document.id].x;
        update.y = MonksActiveTiles._rejectRemaining[document.id].y;
        options.animate = false;
    }*/

    //make sure to bypass if the token is being dropped somewhere, otherwise we could end up triggering a lot of tiles
    if ((update.x != undefined || update.y != undefined || update.elevation != undefined) && options.bypass !== true && options.animate !== false) { //(!game.modules.get("drag-ruler")?.active || options.animate)) {
        let token = document.object;

        if ((document.caught || document.getFlag('monks-active-tiles', 'teleporting')) && !options.teleport) {
            //do not update x/y if the token is under a cool down period, or if it is teleporting.
            delete update.x;
            delete update.y;
            return;
        }

        //log('triggering for', token.id);

        //Does this cross a tile
        for (let tile of document.parent.tiles) {
            if (tile.flags['monks-active-tiles']?.active && tile.flags['monks-active-tiles']?.actions?.length > 0) {
                if (game.modules.get("levels")?.active && _levels && _levels.isTokenInRange && !_levels.isTokenInRange(token, tile._object))
                    continue;

                //check and see if the ray crosses a tile
                let src = { x: document.x, y: document.y };
                let dest = { x: update.x || document.x, y: update.y || document.y };
                let elevation = update.elevation || document.elevation;
                let collision = tile.checkCollision(document, dest, !!tile.flags['monks-active-tiles']?.usealpha);

                if (collision.length > 0) {
                    let tpts = tile.canTrigger(document, collision, dest, elevation);
                    if (tpts) {
                        //preload any teleports to other scenes
                        //tile.document.preloadScene();

                        let doTrigger = async function (idx) {
                            if (idx >= tpts.length)
                                return;

                            let triggerPt = tpts[idx];
                            let pt = { x: triggerPt.x + ((document.height * document.parent.dimensions.size) / 2), y: triggerPt.y + ((document.height * document.parent.dimensions.size) / 2) };

                            //if it does and the token needs to stop, then modify the end position in update
                            let ray = new Ray({ x: document.x, y: document.y }, { x: triggerPt.x, y: triggerPt.y });

                            let stop = tile.checkStop();

                            //log('Triggering tile', update, stop);
                            let original = { x: update.x || document.x, y: update.y || document.y };
                            if (stop.stop) {
                                //check for snapping to the closest grid spot
                                if (stop.snap) {
                                    triggerPt = mergeObject(triggerPt, canvas.grid.getSnappedPosition(triggerPt.x, triggerPt.y));
                                }

                                //if this token needs to be stopped, then we need to adjust the path, and force close the movement animation
                                delete update.x;
                                delete update.y;

                                //make sure spamming the arrow keys is prevented
                                if (stop.coolDown) {
                                    document.caught = true;
                                    $('#board').addClass("cooldown")
                                    window.setTimeout(function () { delete document.caught; $('#board').removeClass("cooldown"); }, 1500);
                                }

                                //try to disrupt the remaining path if there is one, by setting an update
                                //MonksActiveTiles._rejectRemaining[document.id] = { x: triggerPt.x, y: triggerPt.y };
                                //window.setTimeout(function () { delete MonksActiveTiles._rejectRemaining[document.id]; }, 500); //Hopefully half a second is enough to clear any of the remaining animations

                                if (game.modules.get("drag-ruler")?.active) {
                                    let ruler = canvas.controls.getRulerForUser(game.user.id);
                                    if (ruler) ruler.cancelMovement = true;
                                    options.animate = false;
                                    await document.update({ x: triggerPt.x, y: triggerPt.y }, { bypass: true });
                                } else {
                                    update.x = triggerPt.x;
                                    update.y = triggerPt.y;
                                    //options.bypass = true;
                                }
                            }

                            //if there's a scene to teleport to, then preload it.
                            /*let sceneId = tile.document.flags['monks-active-tiles'].actions.find(a => { return a.action.id == 'teleport' })?.sceneId;
                            if (sceneId && sceneId != canvas.scene.id)
                                game.scenes.preload(sceneId, true);
*/
                            //calculate how much time until the token reaches the trigger point, and wait to call the trigger
                            const s = document.parent.dimensions.size;
                            const speed = s * 10;
                            const duration = (ray.distance * 1000) / speed;

                            window.setTimeout(function () {
                                log('Tile is triggering', document);
                                tile.trigger({ tokens: [document], method: triggerPt.method, pt: pt, options: { original, src } });
                                if(!stop.stop)   //If this fires on Enter, and a stop is request then we don't need to run the On Exit code.
                                    doTrigger(idx + 1);
                            }, duration);

                            return duration;
                        }

                        //Do this so Enter/Exit will both fire.  But we have to wait for the Enter to finish first.
                        doTrigger(0);
                    }
                }
            }
        }
    }
});

Hooks.on("preUpdateCombat", async function (combat, delta) {
    if (combat.started && game.user.isGM && combat.scene) {
        for (let tile of combat.scene.tiles) {
            let triggerData = tile.flags["monks-active-tiles"];
            if (triggerData && triggerData.active && triggerData.actions.length > 0 &&
                ((delta.turn || delta.round) && triggerData.trigger == 'turnend')) {
                let tokens = [combat.combatant.token];
                tile.document.trigger({ tokens: tokens, method: 'turnend' });
            }
        }
    }
});

Hooks.on("updateCombat", async function (combat, delta) {
    if (combat.started && game.user.isGM && combat.scene) {
        for (let tile of combat.scene.tiles) {
            let triggerData = tile.flags["monks-active-tiles"];
            if (triggerData && triggerData.active && triggerData.actions.length > 0 &&
                ((delta.round && triggerData.trigger == 'round')
                    || ((delta.turn || delta.round) && triggerData.trigger == 'turn')
                    || (delta.round == 1 && combat.turn == 0 && triggerData.trigger == 'combatstart')
                )) {
                let tokens = (triggerData.trigger == 'turn' ? [combat.combatant.token] : combat.combatants.map(c => c.token));
                tile.document.trigger({ tokens: tokens, method: triggerData.trigger });
            }
        }
    }
});

Hooks.on("deleteCombat", async function (combat, delta) {
    if (combat.started && game.user.isGM && combat.scene) {
        for (let tile of combat.scene.tiles) {
            let triggerData = tile.flags["monks-active-tiles"];
            if (triggerData && triggerData.active && triggerData.actions.length > 0 && triggerData.trigger == 'combatend') {
                let tokens = combat.combatants.map(c => c.token);
                tile.document.trigger({ tokens: tokens, method: 'combatend' });
            }
        }
    }
});

Hooks.on('preCreateChatMessage', async (document, data, options, userId) => {
    if (document.getFlag('monks-active-tiles', 'language')) {
        document.update({ "flags.polyglot.language": document.getFlag('monks-active-tiles', 'language') });
    }
});

Hooks.on('renderTileHUD', (app, html, data) => {
    let active = app.object.document.getFlag('monks-active-tiles', 'active') ?? true;
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
        let entity = JSON.parse(app.object.flags['monks-active-tiles']?.entity || "{}");
        let tilename = "";
        if (entity.id)
            tilename = await MonksActiveTiles.entityName(entity);
        let triggerData = mergeObject({ tilename: tilename, showtagger: game.modules.get('tagger')?.active }, (app.object.flags['monks-active-tiles'] || {}));
        let wallHtml = await renderTemplate("modules/monks-active-tiles/templates/wall-config.html", triggerData);

        if ($('.sheet-tabs', html).length) {
            $('.sheet-tabs', html).append($('<a>').addClass("item").attr("data-tab", "triggers").html('<i class="fas fa-running"></i> Triggers'));
            $('<div>').addClass("tab action-sheet").attr('data-tab', 'triggers').html(wallHtml).insertAfter($('.tab:last', html));
        } else {
            let root = $('form', html);
            if (root.length == 0)
                root = html;
            let basictab = $('<div>').addClass("tab").attr('data-tab', 'basic');
            $('> *:not(button)', root).each(function () {
                basictab.append(this);
            });

            $(root).prepend($('<div>').addClass("tab action-sheet").attr('data-tab', 'triggers').html(wallHtml)).prepend(basictab).prepend(
                $('<nav>')
                    .addClass("sheet-tabs tabs")
                    .append($('<a>').addClass("item active").attr("data-tab", "basic").html('<i class="fas fa-university"></i> Basic'))
                    .append($('<a>').addClass("item").attr("data-tab", "triggers").html('<i class="fas fa-running"></i> Triggers'))
            );
        }

        $('button[data-type="entity"]', html).on("click", ActionConfig.selectEntity.bind(app));
        $('button[data-type="tagger"]', html).on("click", ActionConfig.addTag.bind(app));

        app.options.tabs = [{ navSelector: ".tabs", contentSelector: "form", initial: "basic" }];
        app.options.height = "auto";
        app._tabs = app._createTabHandlers();
        const el = html[0];
        app._tabs.forEach(t => t.bind(el));

        app.setPosition();
    }
});

Hooks.on("dropCanvasData", async (canvas, data, options, test) => {
    if (data.type == 'Item' && setting('drop-item')) {
        //Get the Item

        let item;

        if (data.pack) {
            const pack = game.packs.get(data.pack);
            item = await pack?.getDocument(data.id);
        } else {
            item = game.items.get(data.id);
        }

        if (!item)
            return ui.notifications.warn("Could not find item");

        //Create Tile
        //change the Tile Image to the Item image
        //Add the actions to Hide the Tile, Disabled the Tile, and Add the Item to Inventory
        let dest = canvas.grid.getSnappedPosition(data.x - (canvas.scene.dimensions.size / 2), data.y - (canvas.scene.dimensions.size / 2), canvas.background.gridPrecision);

        let td = mergeObject(dest, {
            img: item.img,
            width: canvas.scene.dimensions.size,
            height: canvas.scene.dimensions.size,
            flags: {
                'monks-active-tiles': { "active": true, "restriction": "all", "controlled": "all", "trigger": "click", "pertoken": false, "minrequired": 0, "chance": 100, "actions": [{ "action": "distance", "data": { "measure": "eq", "distance": { "value": 1, "var": "sq" }, "continue": "within" }, "id": "UugwKEORHARYwcS2" }, { "action": "exists", "data": { "entity": "" }, "id": "Tal2G8WXfo3xmL5U" }, { "action": "first", "id": "dU81VsGaWmAgLAYX" }, { "action": "showhide", "data": { "entity": { "id": "tile", "name": "This Tile" }, "hidden": "hide" }, "id": "UnujCziObnW2Axkx" }, { "action": "additem", "data": { "entity": "", "item": { "id": item.uuid, "name": "" } }, "id": "IwxJOA8Pi287jBbx" }, { "action": "notification", "data": { "text": "{{value.items.0.name}} has been added to {{value.tokens.0.name}}'s inventory", "type": "info", "showto": "token" }, "id": "oNx3QqEi0WpxfkhV" }, { "action": "activate", "data": { "entity": "", "activate": "deactivate" }, "id": "6K7aEZH8SnGv3Gyq" }] }
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
});

Hooks.on("canvasReady", () => {
    $('#board').css({ 'cursor': '' });
    MonksActiveTiles.hoveredTiles = new Set();
    for (let tile of canvas.scene.tiles) {
        let triggerData = tile.flags["monks-active-tiles"];
        if (triggerData && triggerData.active && triggerData.trigger == "ready") {
            //check to see if this trigger is restricted by control type
            if ((triggerData.controlled == 'gm' && !game.user.isGM) || (triggerData.controlled == 'player' && game.user.isGM))
                return;

            return tile.trigger({ method: "ready" });
        }
    }
});

Hooks.on("openJournalEntry", (document, options, userid) => {
    if (MonksActiveTiles.waitingInput && MonksActiveTiles.waitingInput.waitingfield.data('type') == 'entity') {
        let restrict = MonksActiveTiles.waitingInput.waitingfield.data('restrict');
        if (!restrict || restrict(document)) {
            return false;
        }
    }
});

Hooks.on('updateTile', async (document, update, options, userId) => {
    if (update?.texture?.src != undefined) {
        let triggerData = document.flags["monks-active-tiles"];
        if (triggerData?.usealpha) {
            window.setTimeout(function () {
                document.object._createAlphaMap({ keepPixels: true });
            }, 500);
        }
    }
});

Hooks.on('preUpdateWall', async (document, update, options, userId) => {
    if (update.door != undefined && (document.door == 2 || update.door == 2))
        document._wallchange = "secret";

    if (update.ds != undefined) {
        if (document.ds == 2 || update.ds == 2)
            document._wallchange = "lock";
        else if (update.ds == 0)
            document._wallchange = "close";
        else if (update.ds == 1)
            document._wallchange = "open";
    }
});

Hooks.on("globalInterfaceVolumeChanged", (volume) => {
    for (let tile of canvas.scene.tiles) {
        for (let sound of Object.values(tile.soundeffect || {})) {
            if (sound._mattvolume) {
                sound.volume = volume * (sound._mattvolume ?? 1);
            }
        }
    }
});

Hooks.on("refreshTile", (tile) => {
    if (tile.bg && !tile.bg._destroyed) {
        const aw = Math.abs(tile.document.width);
        const ah = Math.abs(tile.document.height);
        const r = Math.toRadians(tile.document.rotation);

        tile.bg.position.set(aw / 2, ah / 2);
        tile.bg.clear().beginFill(0xFFFFFF, 0.5).drawRect(-(aw / 2), -(ah / 2), aw, ah).endFill();
        tile.bg.rotation = r;
    }

    if (tile._transition && tile.mesh.visible) {
        tile.mesh.visible = false;
    }
});

Hooks.on("refreshToken", (token) => {
    if (token._showhide) {
        token.icon.alpha = this._showhide;
        token.icon.visible = true;
        token.visible = true;
    }
})