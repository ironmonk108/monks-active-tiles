## Version 13.02

Fixing Dialog issue with multiple buttons

## Version 13.01

v13 compatibility

## Version 12.02

Allowing rotation action to pick Ambient lights

Fixing issues Foundry introduced with changing colour from a string to an Object.

Fixing issues with referencing Permission constants instead of Ownership constants.

Allowing Roll Table quantity to use Handlebar notation.

Allow open journal to set the ownership of the journal

Fixed setting permissions for a user to include players that aren't logged in.

Fixed setting a scene's background action to actually set the background image.

Fixed set tile image to allow using `1-4` notation

Fixed Dialog so that it can use html files again.

Fixed scene preload action

Added trigger caching, so instead of having to search through all tiles every time a trigger is requested, the tiles are already cached and the trigger knows exactly which tiles would apply.

Added a new trigger, when lighting change animates

Fixed issue with rotating an ambient Light

Fixed issue with temporary Images

Updated the Region Trigger to allow triggering the tile with appropriate data filled in.

Fixed issue with adding an item to a character that D&D 5e introduced.

Fixed issue with tile history not being recorded properly.

Fixed issues with Burning Wheel system

Fixed issue with Tile image when dropping an item on the canvas.

Fixed issue with door trigger when turning into a secret door

## Version 12.01

v12 compatibility

Added the option for the GM to see imageless tiles in v12.

Updated the game time action to handle hous and minutes better, and to not break when advancing time.

Fixed issue with Stop Within Tile and Movement Within Tile causing a tile to trigger even if no movement has happened.

Fixed issue with tokens within Tile when triggering another tile.

Added the name property to Tiles so you can give them a name, this helps when triggering them from a Region.

Added Tile Triggering as a behavior in regions.

## Version 11.27

Increased the precision of the playlist volume slider

Fixed issue where the playlist volume wasn't being used when playing a track, only when the track was resumed.

Fixed issue where deleting an item in PF2e that is a condition bricks the character.  Still not sure what PF2e is doing that causes the issue, but it should be avoided now.

Added a macro that will restore the character so it can be opened and the faulty condition manually removed.

Fixed issue where the attack action wasn't targetting the token correctly

Updated the Game Time action to allow for increases and decreases rather than just setting the value.

Fixed issue with the Check Data action not getting to correct attribute value

Added a quick trigger function so that you can trigger a tile easily from a Macro.  `game.MonksActiveTiles.triggerTile('Scene.ykdBMiSq6M7Qu1Yy.Tile.KSaaDmKLQ390bJMd')` will trigger a specific Tile.

Added the triger point and origin point to the function that gets values

Added variables and the origin point to data that gets passed to a Macro.

Tried to fix an issue where the inline roll wasn't respecting the proper roll mode.  Ends up there's not much I can do because Foundry just ignores the option anyways.

Fixed issue with players triggering a Tile via a door trigger.

Fixed issue where checking for permission to open a journal entry was preventing it from being opened for players.

Fixed issue where the userId and tokens triggering a tile weren't being passed through on some triggers.

BREAKING CHANGE: Macros were being called with the Tile and Token data and that should have been the TileDocument and TokenDocument.  The data has been changed so any macro that references `tile.document` or `token.document` will need to be changed to `tile` and `token` respectively.

The Active Tiles Macros have all been updated to use the updated data sent to Macros.

## Version 11.26

Fixed issue with the Movement trigger

## Version 11.25

Removing debug statements

## Version 11.24

Fixed issues with teleporting to another tile using the relative to entry option

Added the option to reverse the relative to entry direction by using a negative scale

Fixed issue with playing/resetting a tile's animation for players

Added the option to use the same randome number ranges for tile images that delay allows

Added the option to check for not having a condition when filtering by condition

Added the option to set the collection when using Taggers Alter Tag action

Fixed issues with avoiding tokens at destination

Fixed issues with multiple trigger methods not actually stopping remaining Actions

Fixed issue where the person to show the dialog to wasn't saving properly.

Fixed issue where stopping token movement was hiding the token until a browser refresh.

Fixed issue where trigger methods that required a delay before being activated weren't stopping after stop remaining actions was run

## Version 11.23

Fixed issue with open url not opening into a new tab

Added support for the Celebrate module

Fixed issue with additional right clicks when double-right clicking

Fixed issue with triggering a tile when teleporting

Fixed issue with sorting by z-index

Fixed issue when running sorted actions

## Version 11.22

Added tagger to teleport options

Updated teleport so selecting This Tile will allow you to set the position within the tile

Added the option to allow a teleport to trigger the remote Tile

Fixed the code finding a vacant spot when teleporting Tokens

Fixed issue with Hurt/Heal in D&D 5e

Fixed issue adding an item to a character in D&D 5e

Fixed issue with filtering conditions in D&D 5e

Fixed issue with setting the current entities not resuming after a pause

Fixed issue with processing the chat message text when it starts with dice roll notation

Added the action to run code in case you don't want to create a macro to store the code

Fixed the help icon in the entity count message

Removed the additional conditions in the PF2e list of conditions

Updated the check value action to allow checking values that aren't specifically in the list of values

Fixed issues with getting the tracked attributes in the action config dialog

Allow drag and drop of actors onto the Attack action

Fixed issue with sorting triggers causing an error message

Fixed issue with playing a sound only on a specific Scene

Fixed issue with stop token movement when a player moves the token

## Version 11.21

Allow `This Tile` teleport destination to use `Random Within`, `Centered` and `Relative`

Removing debug statement

## Version 11.20

Fixed issue with pan canvas to player token, will now pan for individual players rather than panning to every player.

Reset the drag ruler movement history when teleporting within the same scene.

Added the option to reset tile history for everything or for a specific token.

Fixed warning for conditional effect using label instead of name.

Fixed issue with checking values in case the name, through handlebars, returns as blank.

Added the option to stop all remaining triggers.

Fixed issue with DFreds Convenient Effects filtering by conditions.

Fixed issue with triggering a Tile that is scaled.

Fixed an issue with the `movement` trigger.  It was incorrectly triggering on an enter and an exit.  `movement` triggers when movement *starts* in a Tile.

Sorting triggers by "distance to effect", "trigger type", and "z-index" so you can now set a Tile on top of another tile and choose which one gets triggered first.  This changes how the `Stop Token Movement` works.  Before, tokens were stopped regardless of if the action was processed.  For example if the stop was within a landing that wasn't called, then the movement was stopped regardless.  You'll no longer need to use this, as the token should stop now when it reaches the trigger point.  If the stop is within a landing, you may see a bit of a hiccup where the token reverses movement back to the triggering point.

## Version 11.19

Changed the quantity field when adding items to allow for dice notation

Fixed issue with dice roll notation.

## Version 11.18

Fixed issue with delay time not using fractions of seconds.

Fixed issues with pan canvas waiting until the gm was finished before starting the players panning.

Fixed issue with teleport wash colour not happening when an owner of a tile changes scenes.

Fixed issue with creating a token on a scene the GM is currently not on

Fixed label for Play sound action.

Fixed issue when changing wall type from proximity to normal.

Fixed issue using polyglot with chatmessage.

Fixed issue when adding and removing effects in PF2e.

Added the option to change permissions for a Journal Page.

Hopefully fixed issue where having two attacks in the same action list would overwrite the first attack with the second attacks data.

Hopefully fixed some of the issues with transitions.

Fixed an issue with close dialog not firing for all users.

Added the options to append a line, or prepend a line when writing to a journal.

Added the option to insert text into a journal, at a specific character spot, with the option to replace a certain number of characters.

Added polyglot support when adding text to a journal entry.

Added the `datetime` handlebar value when appending to journal entries, if you have the simple calendar module active.  To be able to write the current game time to a journal.

Changed all the `Find` text to `Filter` to make it clearer what actions are being performed.

Added handlebar support when redirecting based on player type

Updated the landing action to default to stop when reached.

Fixed issues with how DnD5e is now listing their languages.

Automatically closes Action edits when you close the Tile edit window.

Fixed issue where image files weren't saving when the Tile was first created.

Added the option to add tile images by picking a folder.

Added the option to edit the Tile data in the Tile Template browser.

Added the option to use `!=` when comparing values

Fixed issue when finding tagger entities across scenes.

Fixed issues with DnD5e enrichers.

Fixed issue with right clicking on a door triggering it twice.

Fixed issue when correcting who to show the action for, for both chat messages and dialogs.

Updated the inline link for Tiles to be more flexible and not need to specify the scene.

Fixed issue with running the fade action not finding the correct users to fade for.

Fixed issue with Scrolling Text not finding the correct center of the entity.

Fixed issue with running a transition for a tile that shouldn't be visible

Fixed issue with redirecting tokens from a jump to landing.

Fixed issue with order of operations when updating a token.  Made sure that MATT comes last in the list.

Fixed issue with the stop within tile trigger

## Version 11.17

Fixed issue with Activate/Deactivate action

Fixed issue with teleporting not respecting the players scene

Added the option to use the current token when using the Create action

Fixed issue introduced with the latest DnD5e patch when trying to use the Chat Message with languages

Fixed issue with an abnormally long delay in activating a scene

Fixed issue with saving buttons when creating a custom dialog

Added the option to set a landing when creating a Tile trigger link in a Journal Entry

Fixed issue where removing a target was not in fact removing a target

## Version 11.16

Fixed issue with Hurt/Heal

Fixed issue with Rolltables and Scenes not linking any more.

Fixed issue with dialog action not having the correct show to value.

Possibly fixed sporatic issues with cooldown not working.

Fixed issue with a deactivated Tile continuing to trigger remaining actions

## Version 11.15

Fixing code that was supposed to fix changes, but ended up not fixing things, and actually broke stuff

## Version 11.14

Fixed issue with changing the scene not figuring out which users it's supposed to change the scene for

Added the option to use Speed for the move token action and not just Duration.

Fixed issue with move token using the GMs scene to calculate grid size instead of the token's scene.

Fixed issues with setting permissions.

Added an action to set the Game time.

Added an action to shuffle a collection.

Fixed issue when changing the scene to the active scene.

Fixed issues with opening a journal entry that the players don't have permissions to view.

Fixed issue with opening a Monk's Enhanced Journal entry.

Fixed issue with opening the journal entry as an image.

Fixed issue with looping through entities.

Fixed issue with Monk's Sound Enhancement integration.

## Version 11.12

Removed references to allowDelay, it hasn't been used for a very long while.

Added the option to select specific players for any of the actions that are shown to players.

Revamped the code and standardised all the actions that use the show to option.

Fixed issue with the pan to action

Added a new action to ping the canvas at a specific location.

Added current tile support for the teleport action, so you can add a click action to teleport to the tile that's clicked.

Fixed issue with positioning dropdown for teleport to correctly identify what location will allow positioning.

Added the option, under duress, to temporarily change the image of a Tile.  So the image will only affect spcific users.

Changed the Roll Table action to be consistent with other action and selecting an entity by clicking on the directory item rather than selecting from a dropdown.

Added the option to set the offset to play from when playing tile animations.

Added the option to reset the tile animation to the start since Foundry likes to set a random location for an animated Tile to start from.

Fixed issue with the play tile animation code not really correctly identifying when a tile should be played.

Fixed issue with the scene activation code, trying to change the scene multiple times.

Added the option to show a Journal Entry as an Image.

Fixed issue with goto landing action when using dice notation in the fields.

Fixed issues when looping using a landing running extra actions that it really shouldn't be.

Fixed issues with adding and removing Tagger tags not waiting before carrying on with other actions.

Changed the Scene selection to pick from the scenes directory instead of from a dropdown list.

Updated the action configuration to use actual JSON data instead of a stringified version.

Fixed issue when action has no controls.

Fixed issue when an action has no values.

Added the option to set the default restricted and controlled for new Tiles in the settings.

Updated the location edit dialog to allow for multiple locations.

Fixed issue that could potentially cause all Tiles to be triggered on the scene.

Fixed issue that was clearing out tokens when jumping between landings.

Added the option to drag and drop a Macro onto the canvas to create a Tile that would run the Macro when clicked.

Fixed issue when updating a Scene having an error and not recognising the scene tiles.

Added help message to inform users that Stop Token Movement only works On Enter and On Exit.

Fixed the Alter code to still work in case `system` is added to the attribute.

Added option to delay remaining actions until a sound file has finished playing.

Fixed issue with the play sound action not respecting the correct volume level

Added the option to clear all Active Effects

Added a collection drop down to the permissions action so when using current collection, you can select which one to use.

Added support for OSE when attacking with an attack

Preventing a scene change if the scene is already on that scene

Removed the old Image Cycle and Image Cycle Set actions, they've been deprecated and un-usable for awhile now.

Fixed issue witht he Global Volume Change action, you can now specify who gets the volume change, so it's not just changing the GMs volume

Fixed issue with displayng Scrolling Text

Updated the `Set Current Collection` action to allow appending additional entities, removing specific entities, or clearing the collection.  This should allow you to build specifc lists of users or entites that might have more complex ways of determining each one.

Fixed issues with using dice notation when using the Random Change action

Added the option to only trigger the tile if a player has vision on the Tile

Added code to make sure tabs and buttons aren't added twice to the Tile config

Updated Japanese language transations, thank you doumaku

Added Polish language translations, thank you nexusmrsep

Foundry also fixed an issue that was causing scene changes to lock the mouse out of making any changes to the canvas.

## Version 11.11

Added the option to select tiles by tags when stopping a sound from playing

Fixed issues with scene change.

Fixed text when setting the current collection

Added the option to select token roll results when selecting an item from a position.

Added the option to reset the current collection when selecting an item from a position.

Added the option to use `min` and `max` when selecting items from a position in a collection.

Added handlebar support when generating a random chance to trigger.

## Version 11.10

Fixed panning when teleporting on the same scene.

Fixed timing issue when using transparent as the wash colour.

Between those two now you should be able to teleport seamlessly on the same scene without the player detecting that they've teleported.

Fixed issue with filter by item not checking the name properly.

Added darkness and time to the standard set of values passed around.  So you can now automatically check those values when using handlebar notation.

Fixed issue where hover over wasn't working on scenes where a token's vision isn't limited.

## Version 11.09

Somehow some code got lost.  Adding it back.

## Version 11.08

Fixed issue with changing scenes.

Added option to use wildcards when filtering by inventory.

Fixed issue with turn data being send when turn starts.

## Version 11.07

Added the tagger option as a location for Pan Canvas action.

Added double right click trigger.

Attempted to fix the move token action, again for the 100th time.  Maybe it'll work properly this time... but I'm not holding my breath.

Added playlists to the collection of current objects to use witht he Alter action.

Added the option to move to the next and previous track when using the Playlist action.

Removed support for Better Roll Tables since Active Tiles handles the functionality that it previously added and prevents an error that the recent release was causing.

Fixed issue with toggling an active effect that wasn't using the most up to date code.

Fixed issue with playing Tile animation if the entity selected didn't have an attached object.

Fixed issue with playing a Tile animation if the Tile animation is already playing.

Added the option to tell the player to add an item to their character sheet instead of using the GM to help with automated animations.

Fixed issue with Attack action if the damage roll had no results.

Fixed issue with Triggering a Tile that's disabled even if you've allow disabled Tiles to be triggered.

Added the option to use the triggering token when using the Change Scene action to bring other tokens to the triggering scene.

Added an option for who gets the Scene Changed, just the triggering player, All Players, or Everyone.

Added the player list to the values sent to the Dialog action.

Fixed issue with using a Dialog html file that exists at a remote URL.

Fixed issue with getting a variable from the entity in question rather than the triggering Tile.

Fixed issue with setting current collection when the collection doesn't contain ownership information.

Added a warning and confirmation when using the Open URL action to make sure the players know they are leaving the Foundry site.

Added users tot he list of entities to use when checking for entity count.

Updated Check Variable to use handlebar notation when setting the fail landing.

Added a new action to check vale information.  Value information is the current state of all the values Active Tiles is tracking.  This can be used to check and see if a Click Trigger had the shift, Ctrl, or Alt keys pressed when triggered.

Added action to check the data of the Triggering Tile.

Removed the Select Entity option when looping over entities.

Fixed issues with FXMaster actions

Correcting issue with switching tabs when selecting an entity.

Removed the delay property completely from the code.  If you're still using that and not the Delay action, apologies, but it should be updated.

Fixed issue with defaulting a value in the action config, when the value is allowed to be blank.

Fixed issue with getting the folder information correctly in the Tile Templates interface.

Fixed some code and clarified some of the code int he KeyPad Dialog example.

Fixed issue when trying to set a variable to a boolean.  You'll now have to use `= true` notation to specify the boolean if it's not working as expected.

Added the option to use handlebar notaion with tagger tags

Fixed issue where using tagger while the GM was on a different scene was causing it to incorrectly identiy the active scene.

Fixed issues with the dialog buttons being stretched too tall.

Added additional overrides to be ignored.

Made sure that wall data was being sent when a door was triggering a Tile.

Fixed an issue where using a hover over cursor would show even if the Tile was hidden in the fog of war.

Added the option to set a cooldaown before a Tile becomes active again.

Fixed an issue where going to a landing was losing colelcted value information.

Fixed an issue where players were trying to update a Tile they had no access to.

Fixed an issue where right clickign on the canvas was triggering twice.

Fixed an issue where right clickign on the canvas was triggering a click action.

Fixed an issue were the stop within tile trigger wasn't triggering appropriately.

Fixed an issue getting end points if there was no triggering point.

Added additional information to indicate what round and turn was activated with the combat triggers.

Moved the Array prototype function for picking a random entry to it's own function.

Fixed function that gets a random entry from an array.

## Version 11.06

Fixed Dialog showing to players

## Version 11.05

Fixed closing alert dialog

## Version 11.04

Fixed default entity of Set Value

Compensated for Mass Edit when saving the tile sheet.

Compensated for Foundry not setting up Dialog buttons properly in css.

Fixed issue with opening an Alert Dialog.

## Version 11.03

Fixing issue where moving to a token wasn't defaulting to the token collection

Fixed issue with the display name of the Create Entity, Alter, Entity Count, Filter by Inventory, Filter by Condition action.  It will now default to the correct collection.

Fixed issue with getting the correct data to pass to handlebars in the Hurt Heal action.

Added additional options when using the Change Wall/Door action to actually be able to change wall details and not just door details.

Added the option to select current users to send a chant message to in case you want to customise who gets the chat message.

Fixed issue with rendering the icon on roll table requests when the item rolled comes from a compendium

Added a new action Close Dialog, to be used to close dialogs opend using the Open Dialog action.

Added the option to use wildcards when setting variable values.

Added the option to delete variables

Added the option to set the current collection based on users.

Added an action to open an external url.

Fixed issue with Entity Count filter not setting the collection correctly.

Added users to the collections that can be filteres by attribute

Fixed issue with filter by attribute that was actually setting a value instead of just checking it.

Added an action to simplify checking a variable value

Added the option to use handlebar notation in the limit field for the Jump to Landing action.

Added the entity field to the Loop action, so you can specify what collection to loop through.

Added rotation, darkness and time to the list of typeahead landings.

Fixed issue with the Tile config when attempting to drag somewhere on the dialog that wasn't in the actions list.

Fixed issue with trying to compare a boolean value vs when it should be assigning to a boolean value.

Added additional error checking for animating image changes to make sure that the images selected are valid.

Preventing a scene change if the scene is in the middle of changing.

Added auto anchor for specifying an elevation to trigger on.

Changed canvas clicks to use a pointerdown event instead of a click, because the click was registering where the mouse ended up, not where the click started.  And to support touch screens.

Fixed the Stop Within Tile trigger to fire whenever a token stops within the Tile, not just when it comes in from the outside.

Fixed issue with selecting an actor from the PF2E compendium search.

Fixed v11 deprecation warning with Tile Templates when creating a new tile.

## Version 11.02

Fixing issue with getting the original destination of a token.

Fixed movement issues when using relative distances

Added additional help messages to the Alter action

Fixed issue when using wildcards for multiple Play Sound actions in the same Tile.

Fixed issue when using html tag in a chat message when it displays in the action editor.

Added finer control of the darkness level when using the Change Scene Lighting action.

Added new action flow to redirect based ot he current trigger method.

Added the option to right click and insert an action above or below another action.

Fixed issue where clicking on a Tile to change the scene, would lock up the canvas and prevent further interactions with the canvas.

Fixed issues showing a Journal Entry if the player doesn't have permission.

## Version 11.01

Adding support for v11

Fixed issue that was preventing tokens from teleporting between scenes.

Fixed issue creating a Note from a compendium journal

Fixed issue when trying to stop a sound from playing.

Fixed issue when sorting active effects and displaying the text in the drop down list.

Added a new conditional help to an action to provide dynamic help when selecting certain options.

Fixed issues with the Tile Templates, making sure folders stay expanded when refreshing the directory, and that folders are sorted as requested.

Fixed issues with altering values if the value is an object but the value is null.

Added a trigger when the darkness level changes.

Added a trigger when the world time changes.

Fixed issue when triggering a door if the tile document attached is no longer valid.

## Version 10.21

Added support for using handlebars with destination values

Fixed isses with finding the appropriate teleport and move location when using randome within or relative

Fixed issues with how the anchor links are slugified when opening a journal entry.

Fixed issue when increasing or decreasing a variable, if the variable hasn't been set yet.

Fixed issue with the custom Dialog adding a button will no longer fill with the old values.

Fixed issue with dragging and dropping actions between tiles when there are no actions on the rdestinatin tile.

Fixed issue with the Tile Directory, when importing a tile to a tile within a directory.

Fixed issue with using the modulus operator in values.

Fixed warning about deprecation of the toObject function.

Fixed issues with animating the movement of Tiles.

Added the option to click on Macros on the hotbar to use when selecting as an entity for running a macro.

Fixed issues that v11 was having with tabs.  This may cause issues with other modules in v10 unfortunately.

## Version 10.20

Fixed issue if Hurt/Heal action is run against a Token that isn't linked to an Actor.

Fixed issue with Hurt Heal, when dice roll has a space between the +/- and the dice roll.  It technically shouldn't have one, but for legacy sake it will work for now but will warn that it should be changed.

Changed the Attack action so you can choose how to "Attack" either by attacking, using, or just displaying a chat message.

Fixed issue with showing help text when a field is hidden due to conditional fields.

Added width and height properties to the show dialog action to make it a little easier to set the most common attributes.

Added the loop action so you can loop through a collection of entities and run code individually against each.

Fixed issue with adding a new button trying to edit an older button.

Added the option to drag and drop an action from one Tile to a different Tile.

Added an example of how to set up a custom dialog that displays a keypad.

Fixed issue with Image Popout not showing the caption to players.

Fixed issue with finding entities within a Tile.

Fixed issue with jumpt to landing triggering with an undefined landing.

## Version 10.19

Fixed issue with teleport and move to a random location within a tile.

Fixed issue with snap to grid, instead of snapping tot he closest point, it will snap to the grid square the point is in.

Fixed issue with positioning of tokens when moving and teleporting

Fixed issues with the Attack action, and added the option to fast forward the roll, and to rolldamage after the attack.

Fixed issue where a 0 value wasn't returnign the correct value.

Fixed issue with showing a custom dialog for players.

Added the option to drag and drop a scene onto the canvas to create an active tile that will change to that scene.

## Version 10.18

Fixed issues with all the filter actions.

Fixed issues with true and false properties

Tried to make it a little easier for altering values that should be strings.

## Version 10.17

Fixed issue with Move not adding entities to the values properly.

Fixed issues with animated placement of entities using the Move action.

Fixed issues with he display name when settign the current collection or collections within.

Added the option to set the current collection with the Activate action.  This will now also set the collection that gets used when selecting entities within the tile.

Fixed issue when setting the tile image if the position is a number.

Fixed issue with the list of available global volumes.

Fixed issue with additional text being dislayed with the Set Currect Collection action.

Removing the Visibility filter until I can figure out a way around things that Foundry is doing.

Fixed issues with landing colours not quite lining up properly.

## Version 10.16

Moved the delay action from Action Flow to an actual action instead.

Changed all value fields to have a consistant way of getting the data.  What this means is that each field now should allow you to use handlebars, dice notation, or +/- notation.

If the teleport destination can't be found, then the token won't stop, but will continue on to the original destination.

Fixed teleport using relative positioning if the trigger wasn't on enter or on exit.

Fixed teleport wash for owners of a token that aren't the user triggering the teleport.

Added positioning to creating a token, so it can be created relative to where the character entered the tile.

Fixed issue with creating multiple tokens overwriting the original destination location.

Added the option with the activate action to target lights and sounds within the Tile.  And use the current lights and sounds.

Monks Sound Enhancements has added a global volume slider for sound effects, and Active Tiles will use that value for any sounds being played.  Otherwise it will default back to the ambient slider.

Fixed issues with sound effects not stopping properly for users.

Monks Sound Enhancements also gives the option to show sounds playing on the sounds tab, and Active Tile has the option to hook into that to display sound effects being played.

Fixed issues with whispering a chat message to tokens owners.

Fixed issues with chat bubble, chat message sbeing displayed to everyone.

Fixed issue with chat bubble icon always showing up, for chat messages in the action listing.

Fixed the run macro action to default to macros instead of tiles.

Fixed issues with roll table results when setting the chat text.

Added code to filter out duplicate conditions in case a system adds multiple conditions.

Fixed issue with play animation not playing again in Firefox.

Removed the page and subsetion options when opening journal entries if the journal in question is an Enhanced Journal entry.

Fixed Active Tiles part in opening journals to a specific anchor.  Enhanced Journals will still need to updated for it to work properly.

Added Sound Effects volume to the options when settign the global volume levels, if Monks Sound Enhancements is installed.

Added the option to handle closing the dialog as a 'no' when using the show dialog action.

Added the option to load a file for the dialog content instead of having to type all the html into a text field.  This way you can share Dialog content.

Added the option to send options to the dialog.

Added the feature to add custom buttons for a dialog.  You can also have no buttons, providing your own custom button within the html for submitting the dialog.

Fixed issue where a Journal with no entries wasn't able to have text added to it.

Added a new action to be able to set the current collection.  For the most part, you could do this within the actions themselves, but this action allows you to do it outside of other actions.

Fixed issue with changes to the FX Master module.

Fixed issue with DFreds convenient effects filter list.

Removed familiar, hazard, and loot from type to include when selecting player tokens.

Fixed issue with rotation reversing and rotating the opposite direction.

Fixed issue with inline roll notation within Active Tile actions.

Added code to support adding current players to the value list.

Fixed issue where having multiple GMs was causing actions to happen more than once.

Fixed issue where tiles that were created before Active Tiles was activated were causing errors due to lacking Active Tile flags.

Added the option to only run inline links to Tiles if the tile is active.  Use `@Tile[Scene.F3Ga2w0WNGBxfhij.Tile.Rj6HLBoqiXYSFYHi actve:true]{Display Text}` to make sure the tile is active when triggering.

Added the option to use `_failedlanding` if you have a call to a landing and that landing doesn't exist, then it will jump to _failedlanding.

Fixed issue where inline tile links weren't formatting correctly in items.

Added new macro to support PF2E DCs, thank you Exhile of Broken Sky.

Removed the legacy delay field from the action config.  You should be using the delay action instead.

Added the option to highlight the actions that are within landings.

## Version 10.15

Fixing issue with players clicking to activate tiles.

Fixed issues with multiple tokens being the speaker for chat message, only speaking from one of them.

Fixed Polyglot display issue in Pathfinder 2E.

Fixed error when showing chatmessage with polyglot.

## Version 10.14

Changed all internal random rolls to return both the value and the roll so additional details can be passed to the actions.

Fixed issues with finding teleport and move locations.

Fixed issues with teleporting to a scene that has a different scale.

Fixed issues with the movement actions crossing the triggering Tile after being triggered.

Fixed issue where Terrain was no longer an option for the Alter action and Attribute filter.

Added collection option when using the alter action.

Fixed issue with alter when the attribute is dynamic.

Restricting Hurt/Heal to only apply to Tokens.

Added the option to show dice when rolling for Hurt/Heal.

Added flavor to the Hurt/Heal message to indicate what character it applied to.

Fixed issue with playing sounds when the current sound list is unexpectedly empty.

Fixed issue with playing sounds when the sound file doesn't actually exist.

Allow the volume to be blank when playing a playlist so that it doesn't change the current volume levels.

Added Tagger support for chat message speaker.

Added the option with Chat Message to display them as a Chat Message, Chat Bubble, or both.

Added error checking with opening a journal entry to make sure it is a journal entry being opened.

Added error checking when opening an Actor to make sure it is an Actor being opened.

Added Tagger support for the attack action.

Tried to clear up what the checkbox does with the Attack action.

Fixed issue when trying to use the attack action to attack multiple characters.

Added the option to check if a Tile is deactivated when calling it via the Trigger action.

Fixed issues when displaying the scene name in the Scene change action.

Fixed the Start combat action to only start the combat once all characters have been added, and to automatically roll initiative.

Fixed the display name for the combat action to show when it's removing characters from the combat.

Fixed issues with the elevation action so you can use the equals operator and added error catching so it exits gracefully if there's an issue.

Added the Measured Template type to objects that can be selected for the Delete action.

Added the option to remove targets from the Target action rather than clearing all targets.

Fixed issues with the actor and tile data being sent to the Scrolling Text and Set Value action.

Added Previous and Tagger option for the entity to Add/Remove values from.

Added the option to use handlebars for the Check entity count filter.

Added Tiles to the attriute filter.

Fixed issues with the attribute filter when the property is a Set instead fo an array.

Added Wall as a type of entity that can be selected to alter a Tagger tag.

Fixed issues with DFreds Convenient effect list.

Added error checking when getting a dynamic list from actions.

Added error checking to only clear out old data from actions that have data.

Updated the tile sounds to only show sounds that have a sound source.

Fixed issues with Multiple Document Selection and the Tile Directory.

Fixed issues with Tile Templates not returning a tiles uuid properly.

Fixed issues with moving multiple tiles within the Tile Directory.

Fixed issues with the trigger dropdown in the Call of Cthulu system.

Fixed issues with resuming a paused play list.

Added error checking when getting a tagger reference that references a scene that doesn't exist.

Added the event property to the values passed to a Macro.

Fixed issue with the double click action releasing tokens before the actual action ran.

Fixed issue with triggering a wall when it's checking if the door is locked while using the Arms Reach module.

Fixing issue with finding a point within a tile when the tile object doesn't exist.

Fixed point within so that edge cases aren't triggered incorrectly.

Added error checkign to make sure that a texture polygon exists before trying to reference it.

Fixed issues with finding tokens within a tile.

Fixed issue where elevation and rotation changes were triggering outside of the Tile.

## Version 10.12

Fixed issues with teleporting multiple tokens

Fixed issues with teleporting a token, using relative whent he token hasn't entered a tile.

Added the option to create player tokens, only using the currently active players.

Fixed issues with creating tokens from a journal entry.

Updated hurt/heal to work in PF2E.

Fixed issues with the stop sound display text.

Fixed issues with opening the actor sheet.

Fixed issues with adding items to PF2E.

Fixed issues with the attack action in PF2E.

Fixed change scene display text when using the previous scene value.

Added the option to select video files for the scene background.

Added the option, when using the Filter by distance, to measure the distance from the edge of the Tile, or the center of the Tile.

Added the option to use handlebar notation for the attribute name in the alter action.

Fixed issue with filter by item count when checking for quantity = 0.

Added an action to jump to landings based on a random number.

Added error checking when triggering a tile using a wall.

Fixed issue where a tile that triggered a cursor change, wouldn't revert once disabled.

Fixed issue when activating a Tile from a Journal Link, if the Journal Link is improperly formed, or the link doesn't point to a Tile.

Fixed issue where clicking the Tile link in a Journal Entry would trigger the Tile twice.

Added user and character to data passed to the Macro when running the macro as a player.

Fixed issue with auto anchor using the combat turn start.

Updated the Tile config tab updates to ignore footers when making changes.

Added the option to control the size of the item when dropped on the canvas.  And fixed where the item is dropped to line up with the mouse better.

Added the option to use playlist as a current object.

Added another action to set variable data on the Tile.  You can use the value in the variable anywhere you can use handlebar notation.

## Version 10.11

Fixed issue with teleporting into a Tile using Random within, and Relative to entry.

Fixed default value for a handful of actions.

Update the stop sound action to remove playlist, because playlist now handles it.

Updated the playlist action to allow stopping the currently playing track, or to use the playlists from previous values.

Updated the playlist to allow it to pause a playlist.

Added a show image action, that will allow you to pop out an image from a file.

Fixed issue with PF2E conditions when trying to increase by multiple numbers if the condition doesn't previously exist.

Updated add item to use the character sheet so that it can increase the quantities in piles.

Updated Reset History action to reflect that it's a token that needs selecting.

Fixed Reset History when no token is selected.

Fixed Scrolling Text action to work correctly for who it's been selected to show for.

Fixed issues when setting attributes for the triggered Tile.

Added support for handlebars in the Tagger alter tag action.

Fixed issue with DFred's Convenient Effects when trying to add or remove.

Fixed issue with getting location of player tokens.

Fixed issue when triggering a Tile using a Wall, when selecting the Tile using tagger.

Fixed issue reseting the history for a Token, if the token didn't have a history yet.

## Version 10.10

Fixed issue with the alter action when multiple entities have been selected.  This is the one that's been affecting using tagger.

Added the option to select a specific token when reseting a tile history.

## Version 10.9

Fixing issues with opening a Journal

Making sure the journal name is required when creating a new journal entry

Fixed issue with triggering a Tile from a door.

Clarified the tool tip when selecting a tile with a door.

Added the ability to trigger a Tile from a Journal Entry link. Using the format `@Tile[Tile.JkCzb5wPecQet5IL]{Tile Trigger}` you can also add `Scene` with its identifier in front of the Tile id if you want to trigger a tile from a different scene.  Otherwise it will attempt to find the Tile on the current scene.

## Version 10.8

Fixed issue with pan canvas when detecting if the co-ordinates are strings.

Fixed issue with who gets to see the pan canvas effect.

Added the option to choose how teleport and move token positions the tokens when teleporting or creating a token in an area (eg.  Tile) you can have it pick a spot randomly within the area, in the center, or relative to how the token entered the Tile that triggered the teleport.

Added the option to specify the teleport wash for individual teleports.

Fixed issue with teleport when detecting if the co-ordinates are strings.

Clarified the action being taken with toggling visibility or activation.  As they both used the same text.

Added the option to create the currently active player tokens when using the Create Token action.

Removed the option to alter multiple values by separating them via a semi-colon.  Since MATT now batches together similar actions, this is no longer needed and makes things confusing.

Allowed users to filter arrays when using the filter by attribute action.

Fixed issue with who gets to hear the play sound action.

Fixed issue with changing PF2E conditions.

Added the option to toggle playing a Tile animation.

Fixed issue with who gets shown a journal entry.

Fixed issues when opening a Journal Entry that the player doesn't have permissions to view.

Added consumable type to items that can be used for an attack.

Added the option to go to a landing when triggering another Tile.

Fixed warning message when transitioning images with no effect.

Added the option to add horizontal lines to the action config.  And added the option to add a colorpicker.

Moved the action to append text to a Journal to MATT instead of MEJ.  And added the option to add a timestamp using `{{timestamp}}`

Added a filter by condition.

Fixed issue with DFred's Convenient Effects when toggling an effect.

Fixed issue with editing a Tile Template opening multiple dialogs.

Fixed issue with Tile Templates, deleting, and creating documents.

Fixed issue with creating documents within folders.

Fixed the cube image used in Tile Templates.

Added trigger based on rotating a Token.

Added door trigger, so if your Tile contains a door, and the door changes, it will trigger the Tile.

Fixed warning message with DF Scene Enhanced

Fixed bug when trying to fix older Tiles.

Switched to using ambient volume settings instead of interface volume.

Allowed Tile Templates to be able to use Multiple Document Selection to delete.

## Version 10.7

Fixing issue with filter by distance

Still fixing issues with the delay action.

## Version 10.6

Fixed issue with moving a token

Fixed issue with delay action

## Version 10.5

Fixed issue where a delay timer would still fire even after the stop all actions was triggered.

Fixed move token action so that it measured from the center of the token, rather than the corner.

Added the option with movetoken to either set the duration, or leave it blank so that it calculates using Foundry's token move speed.

Fixed issue with creating token when finding the correct location.

Added the option to create token at a location determined by a dice roll.

Added the option to create a Note at the location of another note.  And the option to use a location from multiple Tiles, or from a dice roll.

Fixed issue with adding newly created Notes to the current values.

Adding the tagger option to the hurt/heal action

Fixed issue with chat message when the token selected doesn't have an attached actor.

Added the option to use handlebars int he chatmessage's flavor text

Added the option to roll any dice required in the results of a RollTable roll.  So if the result would have been, for example, currency... you can have the result rolled and added as currency rather than just text.

Fixed issue displaying the action, if the rolltable no longer exists.

Fixing issues when animating the Tile image

Fixing issues when open a Journal Entry from a Compendium.

Fixing opening a Journal Entry to a subsection on a Page.

Added the option to add currency when using the add item action.

Fixed issue with a ping appearing when activating a tile that changes the scene via a click.

Added the option to set who the target action is applied to, and to set if adding additional targets or replacing the targets.

Added the option to filter items by quantity in dnd5e.

Fixed padding on button icons on the action config screen.

Added typeahead for auto anchors.

Fixed searching Tile Templates.

Fixed deleting a Folder in the Tile Templates.

Fixed editing a Folde in Tile Templates.

Fixed issue when adding actors to the current values.

Fixed issue with hover in and hover out overwriting Tile changes.

Added the option to select multiple triggers for a Tile.

Added the option to use the Tile's alpha image when using On Enter and On Exit.

## Version 10.4

Fixed issue with creating a token set to hidden, when revealed, the opacity is set to 0.5

Fixed issue with resetting a Roll Table when all items are used

Switched changing the permissions action to require a GM to run.

Fixed issue with permissions action changing permission on an unlinked actor.

Tried to fix issues with transition animation.

Added the option to show the dialog to the GM, not just the triggering player.

Added actions to support DFred's Convenient Effects.

Fixed issue selecting an Actor for the attack action

Fixed issue with the context menu position on the action list.

Fixed issue stopping sound that's already been stopped.

Fixed issue with folders in the Tile Templates

Fixed image issues when a tile in the Tile Templates has an animated image.

Fixed issue with the function that fixed the image cycle.

Fixed issue with the wall config

## Version 10.3

Fixed issue with teleport an invalid co-ordinates for the destination.

Fixed an issue with teleporting tokens that don't belong to an actor.

Updated the move action to integrate a bit better with Foundry's move functions.

Fixed issues with restricting a sound to a scene not being respected when it's the GM.

Fixed issue with playing the animation for a tile.

Added the option to open a Journal to a page.  Thank you wickermoon for a good base of code to work with.

Fixed an issue when an image transition was called, when a transition was currently happening.  I've had to block the second one from happening until the first has completed, so you might need to delay that second action to make sure the transition happens.

Added the attribute as a value that can be used with the alter action when using handlebars.

Also discontinuing the use of multiple attributes separated by a ; since batch manager handles it now.

Removed the option of using 'or' or 'and' in the valeu statement for the alter action.  It caused strange issues.

Added integration for the Party Inventory module.

Added Tile Templates.  So you can save your favorite tile configuration, export the data to a file, import from a file.  Drag and drop templates to the canvas.

Fixed issues using tagger and finding tags from all scenes.

Fixed issues with running a Macro when it's passed to the player to run.

Fixed issues opening up a Journal Entry that's from Monks' Enhanced Journal.

Fixed issues with dragging an Item onto the canvas creating a collectable item.

Fixed Macros so that they're v10 compliant.

Add a function to open a specific FQL quest

## Version 10.2

Fixed issue with show/hide when no animation is called for

Fixed issue with rotation

## Version 10.1

Fixed issue with snap to grid when teleporting to a different scene.

Fixed issue with removing tokens when teleporting to a new scene.

Added duration to the Move action.

Fixed issue with the move action assuming the movement is always outside the bounded area.

Added the rotation action so you can animate the rotation of an object

Added collection to the Delete Action so you can use current when deleting.

Fixed issues with Alter not able to find the correct property to change

Fixed issues with dragging and dropping newly created actions.

Fixed issue with excluding transparent background

Fixed issues with Levels.

Fixed issue with synchronization with token movement and where it meets the Tile.

Fixed issue with combat triggers.

Fixed issues with Wall triggers.

## Version 1.0.91

Adding v10 support

## Version 1.0.90

Fixing issues with Show/Hide

Fixing issues with Fading show/hide

## Version 1.0.89

Fixed issues with automatically assigning tagger tags in the tagger dialog.  There's now a button to do it.

Fixed issue with use player destination icon when selecting the previous token destination for a location.

Fixed the strikethorugh effect following a deactivation of the tile to respect that a landing can bypass this.

Fixed issue with wall config showing html instead of the tagger icon.

Added a batch manager to run actions as a batch instead of trying to process each one individually.  So multiple calls to alter will add each change together and run them all at once in the end.

Added an action to run all the current batch commands.  Active Tiles will do it automatically, but if you needed to run any actions before other actions, you can use this to execute alll the batch actions.

Tried to fix some issues with the fading of tiles when using show/hide

Fixed issues when using "current" journal entries.

Stopped Show/Hide from activating/deactivating an ambient light or sound when found using tagger.

Added blur effect when transitioning between Tile Images.

Updated the find item to ignore case and to trim leading and trailing spaces.

Fixed issue where clicking a tile and requesting a location destination from the triggering token was having issues.

Fixed issue with Tile Image change when the tile is rotated.

Updated door triggers and hover over to respect the pause settign when preventing actions from happening.

Fixed issues with create token trigger triggering on enter as well.

Fixed issues with directional auto triggers.  And changed the auto anchors to better reflect the intended directions.  So top has been replaced with up and bottom replaced by down.

Added support for FXMaster

## Version 1.0.88

Added the option to use Tagger tag rules when setting an entities tag name.

Added disabled highlight to actions that are no longer available.

Fixed issues with selecting the Tile image.

Added the option to perform loops when switching the Tile image.

Removed the slot machine option from Switch Tile Image.

Fixed issues with triggering when players check a locked door.

Fixed issues with fading out a token image.

## Version 1.0.87

Fixing issue with Levels compatibility

Fixing issues with editing newly added images

Fixed issues with finding a random location within a Tile.

## Version 1.0.85

Fixed issue with editing the tag used for locations

Changed the name Anchor to Landing and Got to Anchor to Jump to Landing to hopefully make a little more sense.

Added the option to use a dire roll for the amount of time delayed.

Changed how the create token action finds a location.  You can now have it randomly add to multiple locations, rather than randomly pick one location to add all tokens to.

Changed how the create token action find a location within a Tile.  Instead of starting at the center and workign outwards, it will randomly pick a location somewhere within the Tile.

Added the door change information to any action that allows handlebars and to the macro arguments.

Fixed the compendium labelling for macro actions

Added the option to add or not add the returned data from a triggered Tile to the current information.

Added transitions to the Image Cycle action.

Added compendium icon to entity names that come from a compendium.

Fixed issue with items returned from a RollTable

Added the option to trigger when a locked door is checked.

Fixed issues with auto anchors based on direction a token enters or exits.

Updated the trigger interface.  So instead of having all the setup and actions on the same page, I've split them into three tabs.  The third one os for a list of images available to change this tile into.

BREAKING CHANGE:  Images have been pulled out of the Image Cycle action, and will be added to the images for the Tile itself.  This will give greater flexibility into changing the Tiles images, but will deprecate the Image Cycle action, and the Set Image Cycle action.  They're changing to Switch Tile Image.  Active Tiles should convert your Tiles the first time it loads, but will leave the Image Cycle action, in case you wanted to retain the iformation.  The action will not produce any effect though, and is safe to leave in the list.  Or can be removed in order to clean up the information.

ANY TILES THAT USE THESE ACTIONS NEED TO BE LOOKED INTO.	

## Version 1.0.84

Fixed issue with show/hide fade.

Fixed issue with directional auto anchors.

## Version 1.0.83

Added error checking if trying to teleport to a destination that doesn't exist.

Added the option to fade when using the show/hide action

Fixed issue when creating a chat message and the token in question doesn't have an associated actor.

Changed the filter by item to allow for checking for a specific quantity of item.

Fixed issue when getting a location based on a tag from any scene.

Added support for Sidebar Macro Directory.

Fixed issue with rotated Tiles.  Apparently Foundry doesn't use angles the same way everyone else does.

Added directional auto anchors, so _top-right will trigger if the token enters from the top right corner.

## Version 1.0.82

Fixing issues with Levels

## Version 1.0.81

Fixed issue with adding tagger

## Version 1.0.80

Fixed an issue where choosing a sound file for a play sound action that had already had a file saved would open up the FilePicker twice.

Updated the tagger interface to allow for the matching and scenes to search.

Fixed the context menu for actions so it wouldn't be mis positioned in Firefox.

Added styling for Warhammer so you can read the action list.

Added a check to make sure the entity exists when using the activate action.

Changed the run macro action to use the fine entity interface, which will let Active Tiles to run macros from a roll table.

Upadates active effects to allow Pathfinder to use effects that have degrees.

Updated image cycle to only activate when a GM is present

Updated the check entity count to also check for macros, scenes and tiles.

Updated anchors, check entity count, and trigger count to allow for handlebars in the goto tag

Updated the entity at position to check for macros

Fixed issue with getting entities when the value returne is undefined.

Fixed up the Dialog interface so you no longer have to supply a goto if you override it with a control field.

Added the option for the Dialog alert to return data from the dialog.

Fixed issue where Smart Doors wasn't allowing Active Tiles to trigger a tile.

Updated the triggering code to rely less on the canvas.

## Version 1.0.78

Fixed issues with Macros not loading since the update to being able to use them from compendiums.

## Version 1.0.77

Fixed an issue with creating encounter using a journal entry from rolltables.

Fixed an issue playing sounds when on the Forge

Fixed issue with the show Dialog box action.  The new code was interfering with the old code.

Updated the action config dialog so that if you resize a textarea field, the dialog will resize to fit.

## Version 1.0.76

Added the option to run Macros from a Compendium

Fixed issue with internationalization and the placeholder from entity selection fields

Prevented the textarea fields in the action config from being resized horizontally.

Added the option to allow some Tiles to be triggered even if the game is paused.

Fixed issues with moving an object when using offset measurments.

Added the option to select a collection when creating a token, so you can use journals created from a rolltable.

Added the option to create a token from a Note.

Cleaned up the text displayed when setting the quantity to blank when rolling a rolltable.  Even though the value will still reset when you edit the action again.

Tried to fix an issue when assigning items using the GURPS system, and a handful of other ones.

Added the option to select the currently activated scene, or current scene when changing the scene.

Prevented selecting entities that should be restricted.  Mostly so you can't select an Actor with the add to Combat Action.

Added the option to use HTML when writing the content of a dialog box.  Any field added to the dialog, with the name attribute will get added to the current array of values passed to further actions.

Fixed some issues with the function that calculated points based on Tile rotation.

Added additional collections to use with the filter by positon filter.

Added tagger support when triggering tiles using a door.

Fixed issue with hover over and tiles that are restricted to specific users.  So if it's a GM only Tile, hover over will only show for the GM.

Added auto anchors for door triggers.

Added auto anchors for specific players.

Fixed issues with wall config when it re-renders.

## Version 1.0.75

Fixed issues with action inputs that need to be parsed.

Fixed issues with defaulting the location information.

Added setting to allow any clicks that click on the door to be pass through to any tiles underneath.

Added tagger support for triggers from a door.

Fixed issues when a token's width or height is set to a negative value.

Updated Show/Hide action to use collection when selecting current values, so you can use the action with more than just tokens.

Fixed issues when setting location from Quick Encounters

Added support for using the alter action with arrays

Added the option to fade a sound being played

Added the option to prevent a sound from starting again if it's already playing.  This way multiple triggers of the same sound effect won't set it back tot he beginning.

Removed the value/percent option for playlists

Rolltable rolls will no longer be shown to the players if the rollmode is not roll.

Fixed issue with the exists filter that was still checking if the entity cound was zero instead of what the logic was set to.

Added the option to use entity collections when using the current values witht he position in list filter.  This means you can now use it to filter tiles or drawings.

Fixed issues with attribute filters and arrays

Added auto anchors.  So if you name you anchor `_gm` it will automatically go to that anchor first if you are the GM, and the same with `_player`.  You can also use the name of a trigger so `_click`, `_enter`, and `_exit` will all work.  This should eliminate the use of a Macro.

** Breaking Change **
Changed how the trigger method is being passed.  Instead of text, it needs to be the id of the trigger.  This will break any code or macros that trigger a Tile manually.

## Version 1.0.74

Fixed the double-click for entities and location to show the currenct values, and to save the values properly.

Fixed number fields to allow min, max and step values.

Fixed the right-click menu for actions, so that it doesn't disappear off the dialog.

Updated the record history and per token check boxes so that if you click on per token it will also turn on record history, and if you turn off record history it will turn off the per token.

Fix issues with cloning an action if the Tile hasn't been saved yet.

Fixed the pan canvas animate checkbox to show/hide the duration field properly.

Fixed the pan canvas action so that it will save properly.

Fixed the pan canvas duration field.

Fixed the move animation for things other than tokens.  Realized that it wouldn't animate for players properly.

Added array support for the alter action.  So if the field you're editing is an array, using + notaion will add to the array, - will remove and = will set the array.  items for the array are separated by a comma.

Fixed issues with the volume and play sound action.  Didn't realise how Foundry handled the volume property and I was doing it incorrectly.

Added the option to prevent the sound from starting again if the sound is currently playing.  Otherwise the sound will stop and start from the beginning again.

Updated the play sound action so that changes to the Interface volume will affect sounds currently playing.

Updated the Check tile triggered flter, so that you can get the unique triggers.  So you can check number of triggres vs number of individual tokens that have triggered the tile.

Updated the First in List filter to be Position in List.  So you can specify where in the list to draw from, or use "first", "last", or "random" respectively.

Added a new action to check for the player type, so you can have one set of code run for the GM and a different set run for the player.

Fixed issue looking for a flag, if Tiles were created before the Levels module was installed.

Added a setting to prevent Players from activating Tiles if the game is currently paused.

## Version 1.0.73

Added the option to edit the location field.  By double clicking on the field you can manually edit the location.  This will now allow you to enter `-100` for example, in the x or y field and have the location be relative to the token.

Added a list of the currently playing sounds so that if your Tile starts playing the sound and you have it looped there is a way to stop it from laying.

Also added the option for a Tile to play more than one sound effect at a time.

Fixed some colour styling that was causing Cyberpunk Red Core to have unreadable labels.

Added the option to trigger at the end of a token's turn in combat

Added the option to set the duration of how long a pan to a canvas spot takes.

Fixed issues with the Pan Canvas action not respecting who the pan canvas was meant for.

Fixed issues with tokens created using Quick Encounters not using the location originally specified when they were created.

Fixed issue where a GM only chatmessage was also being sent to the triggering token's owner.

Fixed an issue where setting the image cycle to the last image wasn't working.

Fixed issue with the way Set Image Cycle was being displayed.

Updated the First filter, to allow you to select "first", "last", or any spot in between.

Updated the Filter by Item to allow you to select tokens that *don't* have the item.

Added the Remove Item action.

Added the option to set the quantity of items to roll from a roll table.

Set how to distribute items to entities.

## Version 1.0.72

Updated the trigger action to use the current tiles.

Updated the function that gets the previous entities to use, so that it can use ids instead.  So if you're using a Macro to return data, you can have it pass an array of ids instead of an array of objects.

Fixed issue when using player token location.

## Version 1.0.71

Fixed the field length in the action config, so long names won't change the size of the field.

Added the option to pan the canvas to the players token

Fixed issues with who the pan canvas is directed towards

Added the option to create Tokens from Enhanced Journal Encounter Entries or Quick Encounter entries

Added the option to avoid other tokens when creating tokens

Added the option to set who the scrolling text gets displayed to.

Fixed issues with the scrolling text labels, and the scrolling text settings

Added the preload action, so you can control when you preload scenes.

Removed automatic preloading of scenes for teleport and scene changes because it was causing conflicts.

Fixed issues with a lot of the player commands not finding the correct player to run the command for.

Fixed issues with the confetti settings.

## Version 1.0.70

Added the method that gets passed to the actions.  This will allow you to hide and show things based on hover over.  So if you want to use a "tooltip" with a Tile, you can create a Text Drawing and alter the hidden property based on the method.

Updated the chat action to only show ellipses if the text overflows.

Updated the add item action to set the quantity to add.

Added the option to set what tokens get sent to the trigger action.

Added the option to display cycle images like a slot machine.

Updated the dialog action to require the content property to be filled.

Added a scrolling text action.

Fixed issue with dialog, if a button is pressed and there is no related anchor to go to, then actions should stop.

Fixed issue related to Levels and tokens within the Tile.

Added Confetti Module support.

Added the option to cycle images like a slot machine.

## Version 1.0.69

Fixed issues with finding tokens within Tile.

Added option to use filter by attribute with walls and terrain

## Version 1.0.68

Fixed issues with required fields not eing required.

Added error checking for action names.  This should make sure that any errors won't prevent the Tile config from opening.

Fixed issue with getting location not knowing what the reference Tile is.

Added error checking for alter action to make sure the attributes match the values properly.

Fixed issue with RollTables resetting every time a roll is made.  Also added the option to reset the rolls when all have been rolled.

Split Open Journal and Open Actor sheet as there was enough additions that they needed their own space.

Added the option to delete a Terrain entity.

Added the option to Stop Remaining Actions on a selected Tile.  So if you have a Tile running through actions, you can now stop it from looping.

Fixed issue with random destination targeting itself.

Added the option to specify what kind of door action will trigger the Tile.

Fixed issues with hovering on a Tile and switching scenes.

Fixed issue with clicking on the canvas when the type is not the type requested.

Fixed issue with Kandashi's Fluid Canvas heartbeat not working

Added macro to generate a macro to setup a Tile from a Tile.

## Version 1.0.65

Fixed issues with getting token attributes and tile attributes.

Added help strings for various actions properties.

Added right click and elevation as triggers.

Added the option to alter multiple attributes at the same time by separating them by semi-colons.

Added the option to control chat messages when rolling from the roll table.

Fixed permissions with Scenes so that it will only add Observer roll.

Added the action to change the Scene background.

Added the action to set an image cycle's image at.

Removed the option to select a Tile when selecting an attack Target

Added the option to only respond to clicks within the actual image instead of the entire Tile.  So clicks will ignore the Tiles transparency.

## Version 1.0.64

Fixed the icon for using the original location for a token.

Added the option to use Current Tokens when running the move token action.

Fixed an issue with Hurt/Heal that was introduced when fixing the issue with PF2E.

Added the option to alter a Wall segment

Added the option to clear targets instead of just selecting targets.

Fixed an issue where players weren't selecting any targets.

Fixed an issue when trying to select entities from a Compendium

Fixed an issue where hovering wasn't workign any more.

Fixed an issue where changing scenes with a pointer cursor showing wasn't clearing the pointer cursor.

Fixed an issue where an array of gotos weren't stopping if the tile was no longer active.

## Version 1.0.63

Added the option to drag and drop entities onto the action config dialog.  So if you want to add an Item to an Actor, you can now drag the item onto the action config instead of having to select it with the selection tool.

Added the option to double click the entity field to allow copy and pasting of the entity id.

Fixed an issue that multiline text areas weren't being registered correctly and it was defaulting back to a text box

Added a macro example to the Compendium, Teleport to a random location

Added the option to set the default trigger.  So if you use a lock of Click Tiles, you can have it default to that instead of Enter.

Defaulting to allow player to use the action while a GM isn't available.

Defaulting the Tiles to be active when created.

Added the option to not record the Tiles history.  It can get pretty large at times and if it's not cleaned out regularily could cause performance issues.  Especially for menu type displays.  If it's not needed then you can remove it.

Added the option to allow turn on the pointer cursor whenever you hover over the Tile.  So if you're using the Tile like a button, this will give feedback to the user that it's clickable.

Fixed an issue where trying to unpause a game was just toggling the pause state.  Technically this is a Foundry bug, but I'm compensating for it.

Removed the conditional fields for teleport that had a bad habit of always disappearing.

Fixed an issue where applying damage in PF2E was causing issues

Changed the playlist action so that it will control playing and stopping a playlist or a play list sound.

Moved the flavor field of a chatmessage to above the text, since that's where it will exist on the chat card.

Display a fragment of the text being displayed by a chat message.

Added the option to add a quantity of items instead of just 1

Added Scene and Actor as valid entity types to change permissions for.

Fixed some issues with adding tokens to combat.

Fixed an error with finding the location name if the Scene was blank.

Fixed an issue when trying to control a door.

Added the Target action, the triggering player will target the selected entities.

Added the Global Volume action, so you can set the global volume level.

Added the Dialog action, so you can prompt the triggering user for either a Yes/No response, or just display a message then need to click to confirm.

## Version 1.0.62

Fixed issue with Levels 3D and the wall config.

Added the option to select Journal Entries based on Tagger, Current journals, tokens within the triggering tile, and players.  Players is a unique one though.  What it will do, is show the first Journal Entry that the player owns.  So you can have one trigger open up the current player's own journal entry.

## Version 1.0.61

Fixed issue with selecting a Wall as a target.

Allow macros to use arguments if not using the core macros and Advanced Macros isn't installed.

Allow the show Journal/Actor entry to use a token.

Allow the filter by attribute to use strings

Fixed issue with Levels, where it was overwriting the tabs being added to Wall Config.

## Version 1.0.60

Allow the Token move action use the original destination of the token, in case an action tries to stop movement.

Fixed an issue where getting the location name of a location on a different Scene wouldn't return the proper name until the Scene returned back to the original scene.

Fixed issues with mergeObject and arrays when it comes to classes being added to the tile config dialog

Added Canvas Ready trigger.

Changed the delete source and preserve settings checkboxes to only show when the teleport location is on a different Scene.

Added a timeout of 2 seconds in change teleporting locks the movement of a token.

Added the option to remove a token from combat.

Added change scene lighting action.

Added the option to allow selecting an entity other than a Token for attribute filters.

Added a filter that checks if the token has an item in inventory.

Fixed an issue with 'Enter/Exit' not snapping to the correct location.

Fixed an issue that Paralaxia was causing with styling the Tile Config window.

## Version 1.0.59

Yep, still fixing the issue teleporting to other scenes.

## Version 1.0.58

Still fixing the issue teleporting to other scenes.

## Version 1.0.57

Fixing issue with teleporting to other scenes.

## Version 1.0.56

Added a flag for teleporting so the token won't be moved mid-teleport.  I believe this was causing a sync issue between the GM and players.

Added more verbose debug statements that can be truned on when debugging.

Added a `Hover` trigger that will combine both Hover In and Hover Out.

Fixed the `Enter/Exit` trigger so that it returns which of the two actually got triggered, so the history will show Enter or Exit properly.

Made sure that the cool down period for key presses only affects the actual Stop Movement action.

Added the wait spinner cursor tot he canvas when a cooldown period has been activated so that the player knows something is happening and Foundry isn't just eating key presses.

Fixed an issue adding information tot he history.

Added a macro to help with redirecting On Enter and On Exit triggers.  So with a Macro and soem Anchors you can have an On Enter action and an On Exit action happen for the same Tile.  No need to overlay two Tiles over top of each other for the same effect.

Added option to change the colour used for the screen wash when teleporting a token, as well as the option to turn it off.

## Version 1.0.55

Fixing an errors with sending selected tokens from the player to the GM.

Added option to move a token to another tokens location.

## Version 1.0.54

Fixed issue with allowing tags to be added to entities other than token.

## Version 1.0.53

Fixing issue with missing Wall Height controls.

## Version 1.0.52

Added the option to pan canvas just for the GM.

Added option to use tagger or current location to create tokens.

Added scene data to context when altering an entity, or sending a notification, or sending a chat message, or changing elevation.

Changed Hurt/Heal to be able to roll a dice without having to use square brackets.

Allow roll tables use tables in compendiums.

Fixed some really messed up code when rolling from the roll table.

Fixed issues with sending token data to tiles triggered by other tiles.

Changed the Stop if doesn't exist filter to now check for a count of entities.  Before it was set to > 0, now you can have it check to see if the are more than 3 tokens.  You can also now check other collections.  So you can check the count of tiles, or walls, or items that are currently being tracked, and not just tokens.

Added a filter Tile triggered, that will now check the number of times the Tile has been triggered.  So you can stop remaining actions depending on how many times the tile has been triggered.  And with the addition of this filter, the Min. Required field has been removed.  Since this filter essentially takes its place, with greater flexibility.  As with other changes, if your Tile already uses this feature it will still function, and remain on the Tile sheet, but for any furture Tiles, or ones that never had that set, the field won't appear and you'll need to switch to using the filter.

Added a filter Token triggered, that will check the number of times a token has triggered the Tile.  So you can now have the trap only trigger the thrird time a token enters the area.

Updated the attribute filter to be able to check on attributes from other collections than just tokens.

Added the option to add `and` and `or` when using the attribute filter.

Fixed issues with getting entities from within the Tile if the GM is not on the same scene as the players.

Fixed an issue when getting location from a tagger tag.

Also added the option to have a door trigger a tile.  You know... no biggie.

Added Levels support when determining if a token is within a Tile. thank you rinnocenti.

## Version 1.0.51

Added two new triggers, On Combat Start and On Combat End.

Fixed an issue with alter that it wouldn't alter the Actor data even though it would find the actor information.

Updated the audio settings so you can play the audio clip for the triggering player, or for the player that owns the Token.  So the GM can trigger sounds for the players now.

And cleared up the text description so it makes mroe sense what the setting is refering to.

Clamped the volume settings so that it can't exceed 1.

Fixed an issue in PF2E where clicking on a Tile was broken.

Fixed an issue with passing the action id properly.

Fixed the Multiple Anchors based on DC macro.

Added the option to cycle through images randomly.

Fixed an issue with how other modules can add their actions to Monks Active Tiles.  To avoid duplication of action names.  This will require all Tiles within your world be adjusted... but it should be handled automatically by Active Tiles.

## Version 1.0.50

Added the option when changing Door state to change from regular to secret door.

Added two new When options, On Combat Round start, and On Combat Turn start

Allow movement for Ambient Light and Ambient Sound.  Although it's a little weird and won't actually update until it reaches its destination.

Added error checking to make sure Hurt/Heal evaluates to a number.  Thsi should prevent the action from setting the actors HP to 0.

Allow the Delete action to delete Ambient Light and Ambient Sound

Added the option to select by tag when filtering by first entity and filtering by attribute.

Added the option to go to an achor if the Check if tokens exist filter returns no actors.

Fixed issues with running a chat macro instead of a script macro

Added support for adding/deleting a Tagger tag to an object

## Version 1.0.49

Fixed issues with long names not being properly clipped when using the Cycle Images action.

Added the option to select previous or tagger for location destinations.

Added a Hook for declaring a trigger group, so that modules can set themselves up as their own group.

Added a new action to create a Journal Note on the canvas

Fixed an issue with sound effects being restricted to a scene.

Fixed an issue where selecting a Token instead of an Actor for the attack action was resulting in not being able to find the Item.

Updated the filters so you can set what tokens to use if they're the first ones in the list.

Fixed an issue where resetting the history was clearing out changes made due to a refresh of the Dialog.

Fixed an issue where having Item Piles and Active Tile both active would cause multiple item lists to appear on the canvas.  It will now set the option to off if Item Piles is detected.

Added support for Kandashi's Fluid Canvas.  So those commands can be called directly from Active Tiles.

Fixed an issue where items dropped from a Compendium onto the map were causing errors.

## Version 1.0.48

When using teleport, if the GM teleports a token it will now change scenes for the player if that's the player's character.

Added the option to trigger other Tiles while performing a Move Token action.

Fixed issues with Alter action not being able to find if the property exists.

Allow players to open a journal if the GM isn't logging in.

Added a Filter to get tokens with specific attributes.  You can use operators like `=, >, <, <=, >=, !=` in front of the value to check for.

Fixed an issue where a blank entity id was causing an error

Added Character to the properties sent to a Macro.

Fixed an issue with goto logic and how it gets a copy of the context information.

Also fixed an issue with going to an anchor.  It was failing if a stop was requested.

Added setting for dropping an item on the canvas.

Removed the Within Reach macro from the compendium since there's a filter that covers it.

Japanese translations, thank you tonishi

## Version 1.0.47

Fixed an issue with normalizing a Tile when it's created.

Fixed issue with assigning an Item, then name wasn't dynamic.

Fixed an issue where an item deleted from an actor was causing errors with the Attack action.

Added the Delete action.

Added the First filter, so you can select the first item in the list.

Wrapped the tile refresh function properly.

Fixed an issue with the reported point that caused the Tile to trigger

Added the option to drop an item on the Canvas an have it create a Tile with the same image, and actions setup so that a player can click the item and put it in inventory.

Added a macro to setup a Tile so that it can be moved around by a token. And a macro to do the work.

## Version 1.0.46

Fixing an issue finding a location name

## Version 1.0.45

Fixing an issue with the `=` in alter action

## Version 1.0.44

Added the feature of changing the sidebar tab or canvas tool to match the default entity type needed for the select entity field.  And changing it back once done selecting.

Updated the function that grabs the entity name so that it's dynamic rather than relying on the last value collected whent he entity was selected.

Added the feature of selecting the current canvas position

Added Tagger support so you can now refer to entities by their tag.

Added Cycle image list action, you can select individual files or use wildcards

Added checking for required fields

Added conditional fields that will show/hide depending on what's been selected in other fields.

Fixed an issue with action re-ordering

Fixed an issue with action deleting

Added the feature of default values when creating brand new actions

Tidied up some styling, gave the actions more room and standardised the button sizes.

Added syntax highlighting and reviewed all the action names to make sure what was happening was a bit clearer.

Added a new macro so people can do multiple actions depending on the value of a request roll rather than just pass and fail.

Standardized how the location is retrieved.

Added scaling for panning the canvas

Added option to preserve setting when teleporting a token to a new scene.  Just in case you have tokens already set up on that scene and want to use the properties already set up.

Added the option to use the alter action value with an `=` so Active Tiles will try and evaluate whatever is in that field.

Updated the play sound action to have a dropdown for either percent of value, and changed the number to a slider.

Updated the stop sound action to work on multiple Tiles.

Updated the change door state to work with multiple Walls.

Fixed issue with languages drop down not showing

Added option to open a Journal Entry using Enhanced Journals if it's installed

Fixed an issue with changing the permissions of an object erasing all the flag data

Updated the distance check to respect a Tiles rotation, and give you more flexibility it what you want in terms of distance.  So you can have within the Tile, within a certain distance formt he Tile, and greater than a certain distance from the Tile.  It will now also respect the edge of the Tile rather than working off the center, so if you have an odd shaped Tile it will check from the closest edge.  Also added a dropdow so you can select distinct pixels or use the scenes grid size.

Added the option to have anchors stop the current flow of actions.  This should trim down the need for a whole bunch of Stop actions.

Fixed up issue with rotated Tiles

## Version 1.0.43

Fixed an issue with attacks not rolling correctly.  v9 changed rolls to being async and I forgot that I did use that function.

## Version 1.0.42

Fixed issue with not being able to create new actions

Started to add fixes for actions that can't be run without a GM.

Integrated with Enhanced Journal a little better.

Hopefully fixed an issue with PF1 and attacks

## Version 1.0.40

Fixing an error with creating a new Tile.

Fixing issues missed with v9 changes.

## Version 1.0.39

Updates to support v9

Fixed an issue with the delay action if it's a proper number rather than a strings

Fixed an issue with checking if a Tile can be triggered.  Some of the new triggers were firing even when they shouldn't have been.

Fixed an issue with how the history was being saved

## Version 1.0.38

Added context menu to action list so you can now clone an action.

Fixed an issue when altering a flags property.  A previous fix was set to ignore anything that was null, but flags are commonly undefined.

Added the option to limit the number of loops the jump to anchor will take, and added the option to end after the loop is done, or resume the remaining actions.

Fixed an issue on hover if the Tile has no trigger data

Added the point that triggered the Tile to the values being sent.  So Macros now know a bit more about where ont he Tile the click happened.

Moved the click function to it's own code attached to the Tile.  This will let other modules send a click even directly to a Tile.

## Version 1.0.37

Fixed an issue with re-ordering a newly created action.

Added option to add action controls as numbers and not just text

Changed how delay works now.  I wasn't able to do it previously but now that Active Tiles can save a state and resume later, I've changed the delay to it's own action.  This means that actions needing to be delayed will stay in the action list.  Previously they'd be put in their own loop to complete and caused some strange issues.  It should not affect current actions that have delay set.  The control for delay will still show up for the old action but won't be available for newly created actions.

This also gives some greater flexibility with how long you delay.  Using `1-5` will delay randomly between 1 to 5 seconds.  And using `1,4,8,12` will randomly pick between 1, 4, 8, or 12 seconds.  And they can be used together.

Added Triggering Tile to the Move action.  You could always select it as the entity to use, but now there's a convenient button to click to select it.

Added error checking to make sure an audiofile exists before trying to play it.

Updated the Attack option to select either a Token or an Actor.  Previously you needed to select an Actor, but that was causing confusion.  If you select a Token instead it will then find the related Actor.

Added option to start a combat after adding tokens to it.

Added the option to call macros with extra data.  The core macro call wasn't sending everything that would be needed.  I was relying on Advanced Macros to provide the extra data, but if Advanced Macros aren't available I added code to handle it the same way.

Added correct code fo Hover In and Hover Out.  I can't remember who provided the code as it's been awhile, but thank you!  I appreciate it.

Added two new ways to trigger, On Stop when the token stops within the Tile, and On Double Click, same as click but more of it.

Fixed issues with players calling Active TIles when the GM is away.

Fixing an issue with clearing the save state.

Fixed an issue where altering a null value was failing

Added a filter to make sure that tokens exist.  This is because requesting a roll will default to the current party if no tokens are selecting.  This could cause issues.

## Version 1.0.36

Added option to play playlist track.

Added option to run chat commands using the chat action

Fixed issue with how chat messages are sent, and who is shown to have sent them.

Added option to reset history after a delay, so there can be a cooldown period.

Revamped the run macro action so that running as GM or Player is now an option from Active Tiles and doesn't need additional modules.

Macros run by players can now return results to the GM and stay in sync with the remaining actions.

Added Hook so that other modules can add options to the actions list.

Added support for Levels 3D so that tokens can be clicked while using that module.

Corrected French tanslations, thank you Sasmira

Fixed issues with rotated Tiles not activating correctly.

Added the option to pause remaining actions while an action completes.  This means that Tokenbar requests can now be rolled by players... provided Tokenbar is updated.

## Version 1.0.35

Added chat buttle checkbox for Chat Messages, just in case you don't want the chat bubble to appear.

Change the functionality of the in character checkbox to better match what Foundry uses.  I think it was using the players name too soon.

Fixed an issue with Manually Triggering the tile.

## Version 1.0.34

There is now a filter to remove Tokens that aren't within a specific distance to the Tile.

There is some rudimentary logic now, you can set anchor points, jumpt to those anchor points, or stop any remaining actions.

You can now pause or unpause the game using an action

You can now activate Difficult Terrain from the Enhanced Terrain Layer

Changed the tile trigger action so that it can now trigger the original tile.  This was originally put in place to stop infinte loops... but with it removed you can now do repetative tasks.

It will now stop any remaining tasks if the Tile is deactivated and it was in the middle of processing tasks.

Added the method that the tile was triggered to the information sent to a macro.

Manually triggering a Tile will now select the currently controlled tokens.  So when a Tile is set to maually trigger and another Tile triggers it, you can use tokens.

## Version 1.0.31

Changed the Action config so that the autofill for Tokens will populate with token attributes and Tiles will populate with tile attributes.

Added HoverIn and HoverOut as ways to trigger a Tile.  Unfortunately it only works if the Tile layer is active.  Working on providing it for the Token layer aswell.

Added french translation

Added macro packs with a Macro to set all Active Tiles to active.

Added option to select what tokens are teleported rather than just relying on the triggering token.

Fixed up teleport so that if the the player is on a different scene than the GM the token can still be moved.

Added integration with Better Tables

Added option to check permissions for opening Journal Entries.

Added option to activate the scene when switching scenes.

BREAKING CHANGE
Changed to using continue as the value to alter if yuo want actions to continue.  This will unfortunately have an effect on any Macros that currently return {result: false}, this will need to be changed to {continue:false}

I've also updated the way that tokens are passed between actions.  It will start with the triggering Tokens, but the currently viewed Tokens can be changed.  So if you request a saving roll, you can now set the current tokens to be the ones that passed or failed, and then further actions can switch the current tokens back to the triggering tokens.  What this means is you can now have a trap, that takes the tokens that failed and apply an active effect to them, then teleport all the tokens to a new location if any of them failed.

## Version 1.0.30

Fixed issue with the tile history saving.

Added option to open journal entry just for the GM.

## Version 1.0.29

Added option to use the previous value for Activate.  So if module returns {activate: Boolean} you can use that value for Activate/Deactivate.

Fixed an issue with sound effects stopping.  Instead of using the requested entity, it was just using the Tile.

Fixed an issue with Chat Message where it was failing if there were no system languages.

Changed "Open Journal Entry" to "Open Entity Sheet" to allow the option to open up both Journal Entries and Actor sheets.

Fixed an issue with lighting effects that would disappear when walking over a Tile.  It's a bit of a patch though as I think there's an issue with Foundry code.

## Version 1.0.28

Fixed issue with getHistory not returning to correct countTriggered

Fixed issue with resetHistory when deleting token history when multiple tokens have history.

## Version 1.0.27

Added option for triggering with a minimum number of tokens.  So if you want the entire party to walk across a Tile before it triggers you can now do that.

Per Token has now changed to keeping a history of all the triggereing events that have happened to the Tile.  That way I can, in the future, improve upon what conditions trigger the Tile.

In line with changing from Per Token information to keeping a history, I've change the interface to using hasTriggered(tokenid, method, userid), countTriggered(), addHistory(tokenid, method, userid), removeHistory(id), and getHistory(tokenid)

Added the Hurt/Heal action to make it easier to alter HP while still respecting temporary hitpoints

Added the Reset Trigger History action, so you can reset the triggering history of a Tile.

Updated the stop sound action so that it can stop playing all ambient sounds and not just the Tile sounds.

Removed libRuler patching, since the module has now been patched with updates.  Thank you very much caewok!

## Version 1.0.26

Allow sound files to use wildcard when selecting.  So the Play Sound action can be randomized.

Added entity and current values to the Alter action.  Entity could be different than the triggering token, and current value will let you alter something based on the returned results of a previous action.

Added looping the the play sound action

Added Stop sound action, so you can now stop the looping sound of a Tile.

Added current values to the notification handlebars context, so you can use returned results in notifications.

Added the same to the chat message, and also added the current entity which might differ from the triggering token.

Fixed issue with polyglot language not being set.

Added option to only animate a Tile for the triggering player, instead of for everyone.

Fixed issue with setting permissions.  And prevented the canvas from panning to a random token.

Fixed issue where once per token was not being set by the On Click action.

Fixed issue where actions that were delayed by some time weren't firing.

Added API to support macros adding, checking, and reseting the once per token data.

Added elevation action, which is pretty much just a shorthand for alter.

## Version 1.0.25

Changes the way the trigger functions are called.  This isn't really visible to the players/GM but should make it easier behind the scenes to pass variables.

Added option to Pan Canvas to choose who the canvas pans for.

Fixed an issue with Canvas pan that was preventing the panning from being animated.

Added option of "From Previous" for Create Token, and Add Item actions.  What this will allow, is if a Roll Table is immediately above the Create or Add Item action, it will take the values from the Roll Table and use them.  So you can automatically create a monster from a rolltable, or automatically add an item from a Roll Table.

Activate can now be passed multiple entities.

On Click will now use the currently controlled Tokens.

Macros will get passed all the results from previous actions in the values property.  Accessed via arguments[0].values.

Added option to set the volume ofa Play Sound action.  If you want to set it to a specific volume, use a floating point number for percentage.  If you want to set ti as a percentage of the Core Ambient volume, use actual percent.  So 0.5 will set it to 50% volume.  And 50% will set it to 50% of the Foundry Ambient volume.

Updated the Chat Message so that it will use the correct TOken.  And can even be used to specify what Token does the Chat Message.  Along with allowing in character chat bubbles.

Fixing the Chat Message resulting from a Roll Table roll.  Before it was always from the GM, now if a Player activates it, it will show as coming from the player.

Updated the permissions action so that setting the permissions for everyone will set the default permission.

Repositioned the set target code in the attack action so that target are added before the attack happens.

## Version 1.0.24

Add option for teleport to delete the source Token instead of just making it invisible.

Allow both Tiles and Drawing to be moved.

Allow Drawings to be shown/hidden.

Update the attack action for PF2 and PF1

Add option to roll the attack instead of just displaying the chat card of the attack.

Added an action, You can now change the scene for a player.

Added another action, Add to combat, so you can add tokens to a combat.

BREAKING CHANGE, Updated the macro execution, thank you tposney, so that it should handle arguments the same way that Trigger Happy does.

Removed some debug information that was constantly being added.

## Version 1.0.23

Added a new action, trigger another Tile.  So now one Tile can trigger a different one

Added spells to the Attack action.

Added roll mode option tot he Attack action.

## Version 1.0.22

Fixed issue with the action config if there aren't any actors added to the world yet.

Added info if there's no token to teleport when a teleport action is triggered.

Allow Move Token action to move to a Tile and not just a location.

Removed the try catch blocks from individual actions and put it up one level, so that if any actions have an error it can be reported.

Creating a token can now use a Tile instead of just a location as a destination for the Token.

Added Attack action.  You'll need to set up an actor with the attack you wish to use but this can be used to calculate the damage of a trap.

Changed how macros are executed.  Before I was passing it back to the player to run the full macro, changed the code so the player runs a previously calculated version.  Means I don't have to recalculate arguments and hopefully I've fixed a bug where the macro won't run.

Fixed up issues with stopping the Token from moving.  Make it integrate with libRuler a little better and not require as many saves to the database.

Added cool down period for movement so if the player spams the movement key, and the Tile requests a stop, that it will briefly halt the movement of that Token even if more movement keys are pressed.

Added option to restrict a sound to a scene.  So only the players viewing the scene will hear it, GM's will still hear the sound though so they know what's happening.

## Version 1.0.21

Added typeahead to the Alter action Attribute field to make it a bit easier to know what goes there.

Fixed an issue with Handle bar support if the Tile is manually Clicked and there's no Token to add to the context properly.

Fixed issue when creating a chat message with no Token present.  It didn't know who to whisper to.

Added Permissions action. So you can now change the permissions of an entity when a Tile is triggered.

Fixed an issue with On Click and who's allowed to control the triggering.  It will now only trigger for the role that's been selected.

possibly BREAKING CHANGE, I had mis-labelled the variable name for who gets to control the trigger.  It's fixed now, but if you had a Tile that you set Controlled By, you'll need to change it back.  On the plus side, it should respect that now, whereas it wasn't working at all for previous versions.

Fixed an issue with a player manually triggering a Tile.

## Version 1.0.20

Removing debug information

Fixing small issue when a player tries to trigger a Tile.

## Version 1.0.19

Fixed issue when changing action, it would retain information for the previous action, and some of that data was incompatible with the next action.

Fixed issue where updating the action, wasn't using localization for the name.

Fixed issue where the delayed seconds weren't showing up on the action list.

Added the much asked for "On Click" trigger, so if you're on the token layer and the tile is set to On Click, it will trigger when clicked.

Updated the Action Config screen to use decimal seconds

Fixed issue where the display for 'pan canvas' was displaying snap information rather than location information.

Teleport will now let you avoid other tokens at the destination.  It will do its best to find the closest available spot to the destination, but it can get a little weird if transporting to a different scene.

Teleport should center your screen so the token is still under your mouse... but when switching to a different scene I can't figure out how to calculate it properly.

Increased the fade time when switching to a new scene so that it has time to load the scene in the background.

Fixed an issue where a teleported token was no longer the token being referenced in further actions because it was essentially a new token.  Updated the code so it will reference the new token from that point on.

Creating a token action will now also use a Tile for a drop location.  And you can set the token to be created as invisible.

Alter will now accept dice rolls using the [[1d4]] notation, and can be rolled to a chat message, and have the roll mode set properly.

Fixed an error in the code with Alter action and parcing it as a float properly.

Updated the Play Sound action to allow for sound to be played for everyone, gm only, and triggering token.

Fixed an issue with Play Sound so that it will respect who it's supposed to play for.

Fixed an issue with Play Sound that the label wasn't using localization.

Added toggle option to the Change Door State.  If the door is locked it will not toggle, but if open or closed it will toggle between the two.

Added the option to notification to set who it should be shown to.

Fixed an issue with notification so that handle bar replacements are done properly.

Fixed an issue with notification so that the label is created properly.

Fixed an issue with Chat Message so that it gets the speaker properly.

Fixed an issue with Chat Message so that handle bar replacements are done properly.

Added option for flavor text to the Chat Message.

Added option for roll mode to Roll Table.

Fixed issue that prevented Reset Fog action from working.

Fixed issue of who the journal is displayed to.  Previously it was just showing to the GM, now you can have it show to everyone, players, or the triggering token.

Added the "Add Item" action.  So when the Tile is triggered it will add the specific item to the token's inventory.

Fixed issue with teleporting preloading a scene.

BREAKING CHANGES!!!

I've updated how I pass tiles and tokens to functions, this will break Monk's TokenBar.  It's fixed, but TokenBar will need to be released and updated for it to work.

## Version 1.0.18

Added option to choose all Tokens currently within the Tile, to go along with "Current Tile", "Triggering Token", and "Player Tokens"

Added option to teleport to a Tile instead of an x/y location.  This way you can move to destination of the teleport easier.

Added additional trigger modes, On Movement, On Enter/Exit, and On Click.  Movement will trigger if the Token moves at all within the Tile (this includes entering and exiting the Tile).  On Enter/Exit will fire on both entering and exiting (be aware this can cause the Tile to trigger twice if the Token moves across it).  And On Click makes it so the Tile will not trigger at all unless you manually click it.

Added option to trigger based on who is controlling the token.  Currently it's restricted to the type of token, but if a GM moves a player token, you might not want the Tile to trigger.  The text has been changed to make it a little clearer what's meant by each setting.

Removed the option to add an animation when teleporting.  It was a bit silly and can be replaced using actual animations via a macro.

Teleport will flash an overlay over the screen when teleporting begins to make the transition a little less jarring, and will pan the canvas so that the token is in approximately the same spot it was relative to the screen.  The overlay and canvas pan only affect the player.

The GM will now receive a notification if a token has teleported to a different scene.

If the teleport is to a different scene it will detect a scene shift and begin preloading it.

Alter will now check the actor of a token to see if it can apply the changes there if it can't find the attribute on the token itself.  If the property being referenced is an object it will try and use the .value property.  The value part now supports handlebar substitutions.

Notification, and Chat Message now support handlebar substitutions.  actor, tile, token, and user can be used for related property names.

Active Effects should now be supported on PF2E

Fixed issues with playing an animated Tile wasn't being shown to players.

Executing a macro has hopefully gone through it's last change in awhile, sorry for changing the arguments around all the time.  I think I've settled on the proper order now.  Unfortunately due to the way Active Tiles is called I need to include the token, tile, and actor information within the arguments.  So the actual arguments passed from Active Tiles will be included in an args property.  This is a little weird as you now have to reference it using args[0].args[0] for the first property.  The data added to the args field will be split on spaces, but strings can be quote delimited.  And it will also support handlebar substitution.

Overridden functions are now using libWrapper

## Version 1.0.17

Adding action, Open journal

Fixing macros so they'll run as the correct user.

## Version 1.0.16

Fixing minor issue with determining what entity the action is being applied to.

Adding another action, you can start or stop an animation on a Tile.

## Version 1.0.15

Fixing support for Levels

## Version 1.0.14

Sorted the list of actions that could be taken.

Cleaned up the display for setting up actions.

Added option for action controls to have a default value

Added movement action, so you can move a token along a path.  Add multiple moves for the same token and set the first ones to wait, and you can add a complex path.

Added the create token action, so you can create a Token on the scene when a tile is triggered.

Added active effect action, so you can add an effect to a token.

Added support for Levels, to make sure the Tile is on the same level as the triggering token.

## Version 1.0.12

Fixed issue with displaying the delay by text box

Added ability to reorder actions

Added option to stop with the remining actions if the function called returns false.  Helpful for macros and requsting a roll.

Added ability to trigger the tile manually.

Added Reset Fog of War action.

Switched from overriding the Tile HUD to just adding the controls to the Tile HUD.  This should make it easier to maintain in case Foundry changes the Tile HUD.

## Version 1.0.11

Fixed issue when adding actions to a new Tile.

Fixed issue with localization when appending actions.

Fixed issue with Delete Action icon

Fixed issue when teleporting tokens not saving position.

## Version 1.0.10

Fixed issue with multiple walls being changed at the same time.

Fixed issue with secret doors not being updated.

Fixed display name so that it includes the wall id

adding advanced macro execution.

Added polyglot support with chat messages

Changed how actions are saved.  BE AWARE that instead of svaing when you update the action, the action won't save unless you save the Tile.

## Version 1.0.9

Added support to activate/deactivate lights and sounds

## Version 1.0.8

Fixed issue with tokens sneaking into the tile by stopping right on the edge of the tile.

Fixed conflict with Window Control module.  The module didn't support maximizing multiple windows all at the same time.

Fixed issue with data not saving to the database when multiple triggers fire at once.

Fixed issue when selecting an entity, it was displaying as if it were a location.

Added option to animate the canvas pan on teleport

## Version 1.0.7

Fixed libWrapper support

Updated the code that checks on cancelling the remaining animation.

## Version 1.0.6

Added libWrapper support

Overrode Ruler moveToken so that I can easily cancel pending movements.

## Version 1.0.5

Added localization text

Fixing issues with the standard ruler.

Trying to fix issues with cancelling the rest of a multi-part path.

## Version 1.0.4

Getting close to releasing!! Yayy!!

Added changes to support players firing a trigger.

Restricted which actions can be delayed

Added more localization updates

Started adding localization

Prevented the scene from changing if a player has triggered a teleport, working on code to send the scene change back down to the player.




