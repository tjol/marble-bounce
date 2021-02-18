/*
Copyright (c) 2021 Thomas Jollans

https://github.com/tjol/marble-bounce
*/

'use strict';

function startAddNode (level, thing, doneCb, params) {
    // Right! We're taking over.
    const svg = document.getElementById("level-scene").querySelector("svg");
    const mainGrp = svg.querySelector("g");
    const svgClientBBox = svg.getBoundingClientRect();
    const lastNode = thing.nodes[thing.nodes.length - 1];

    document.body.style.cursor = "crosshair";
    const line = document.createElementNS(SVGNS, "line");
    line.setAttributeNS(null, "x1", lastNode.x);
    line.setAttributeNS(null, "y1", lastNode.y);
    line.setAttributeNS(null, "x2", lastNode.x);
    line.setAttributeNS(null, "y2", lastNode.y);
    line.setAttributeNS(null, "stroke", "var(--highlight-colour)");
    mainGrp.appendChild(line);

    if (level.svgSelectionBorder != undefined) {
        level.svgSelectionBorder.remove();
    }

    const onMouseMove = ev => {
        const { x, y } = coordsFromEvent (ev, svg);

        line.setAttributeNS(null, "x2", x);
        line.setAttributeNS(null, "y2", y);
    };
    const onClick = ev => {
        if (ev.button != 0) return;
        ev.stopPropagation();

        const newNode = { x: line.x2.baseVal.value,
                          y: line.y2.baseVal.value }

        thing.pushNode(newNode.x, newNode.y);
        thing.refreshUI();

        line.remove();
        document.removeEventListener("keydown", onKeyDown, { capture: true });
        document.body.removeEventListener("mousemove", onMouseMove, { capture: true });
        document.body.removeEventListener("click", onClick, { capture: true });
        document.body.style.cursor = null;

        if (params.registerUndoRedo) {
            registerEditUndoRedo(level, thing, "Add Node",
                () => {
                    thing.popNode();
                    thing.refreshUI();
                },
                () => {
                    thing.pushNode(newNode.x, newNode.y);
                    thing.refreshUI();
                });
        }

        doneCb(true);
    };
    const cancel = () => {
        line.remove();
        document.removeEventListener("keydown", onKeyDown, { capture: true });
        document.body.removeEventListener("mousemove", onMouseMove, { capture: true });
        document.body.removeEventListener("click", onClick, { capture: true });
        document.body.style.cursor = null;
        doneCb(false);
    }
    const onKeyDown = ev => {
        if (ev.key == "Escape") {
            ev.stopPropagation();
            // Stop this madness
            cancel();
        }
    }

    document.body.addEventListener("mousemove", onMouseMove, { capture: true });
    document.body.addEventListener("click", onClick, { capture: true });
    document.addEventListener("keydown", onKeyDown, { capture: true });

    return { cancel };
}

function startTwoClickAdd (level, name, btn) {
    const svg = document.getElementById("level-scene").querySelector("svg");
    const mainGrp = svg.querySelector("g");

    let pos1 = null;
    let clientPos1 = null;
    let thing = null;
    let pos1Time = null;

    const capturePosition1 = ev => {
        if (ev.button != 0) return;

        pos1Time = new Date();
        pos1 = coordsFromEvent(ev, svg);
        clientPos1 = { x: ev.clientX, y: ev.clientY };
        const Thing = thingTypes[name];
        thing = new Thing();
        thing.x = pos1.x;
        thing.y = pos1.y;
        switch (name) {
            case "goal":
                thing._mock = true; // TODO : fix goal rendering so this is not
                                    //        needed
            case "box":
            case "cradle":
                thing.width = 0;
                thing.height = 0;
                break;
            case "circle":
                thing.radius = 0;
                break;
            default:
                return;
        }
        const thingSvg = thing.createSvg();
        if (thingSvg != null) {
            mainGrp.appendChild(thingSvg);
        }
        document.body.removeEventListener("mousedown", capturePosition1,
                                          { capture: true });
        document.body.addEventListener("mousemove", trackPosition2,
                                       { capture: true });
        document.body.addEventListener("mouseup", capturePosition2,
                                       { capture: true });
        document.body.addEventListener("mousedown", capturePosition2,
                                       { capture: true });
        document.body.addEventListener("click", handleClick, { capture: true });
        document.addEventListener("keydown", handleKeyDown, { capture: true });

        ev.stopPropagation();
    };

    const trackPosition2 = ev => {
        const pos2 = coordsFromEvent(ev, svg);
        const dx = pos2.x - pos1.x;
        const dy = pos2.y - pos1.y;
        let width, height, x, y;
        // Set the thing's size
        switch (name) {
        case "box":
        case "goal":
            width = Math.abs(dx);
            height = Math.abs(dy);
            x = (pos1.x + pos2.x) / 2;
            y = (pos1.y + pos2.y) / 2;
            thing.updateAttrs({ x, y, width, height });
            break;
        case "cradle":
            width = Math.abs(dx);
            height = Math.abs(dy);
            x = (pos1.x + pos2.x) / 2;
            y = Math.min(pos1.y, pos2.y);
            thing.updateAttrs({ x, y, width, height });
            break;
        case "circle":
            const radius = Math.sqrt(dx*dx + dy*dy);
            thing.updateAttrs({ radius });
            break;
        }
        // Set the cursor
        if (dx > 0 && dy > 0) document.body.style.cursor = "ne-resize";
        else if (dx > 0 && dy < 0) document.body.style.cursor = "se-resize";
        else if (dx < 0 && dy < 0) document.body.style.cursor = "sw-resize";
        else if (dx < 0 && dy > 0) document.body.style.cursor = "nw-resize";
    };

    const capturePosition2 = ev => {
        // This event is fired on mouse release or press
        // we need to figure out if this is supposed to be the end of
        // the adding process, or not.
        ev.stopPropagation();

        const dx_px = ev.clientX - clientPos1.x;
        const dy_px = ev.clientY - clientPos1.y;
        const dr_px = Math.sqrt(dx_px*dx_px + dy_px*dy_px)
        const dt = (new Date()) - pos1Time;

        if (ev.type == "mouseup" && dt < 1000 && dr_px < 5) {
            // little time has passed and the mouse hasn't moved a lot
            // this is the end of the click.
            return;
        } else if (ev.type == "mousedown" && ev.button == 2) {
            // Right click, let's call that a cancel.
            cancelAddThing();
            return;
        } else if (ev.type == "mouseup" && ev.button != 0) {
            // Released the wrong button. Ignore.
            return;
        }

        // We're done, we can finalize the process of adding the thing
        level.objects.push(thing);
        if (name === "goal") {
            delete thing._mock;
            thing.refreshUI();
        }

        removeEventListeners();
        document.body.style.cursor = null;

        let undo, redo;
        level.redoStack = [];
        undo = {
            name: `Add ${name}`,
            undoCallback: () => {
                if (thing === level.selectedThing) {
                    selectThing(level, null);
                }
                thing.deleted = true;
                thing.elem.classList.add("deleted");
                thing.liElem.classList.add("deleted");
                level.redoStack.push(redo);
                autoSave(level);
                updateToolbar(level);
            }
        };
        redo = {
            name: `Add ${name}`,
            redoCallback: () => {
                thing.deleted = false;
                thing.elem.classList.remove("deleted");
                thing.liElem.classList.remove("deleted");
                level.undoStack.push(undo);
                autoSave(level);
                updateToolbar(level);
            }
        };
        autoSave(level);
        level.undoStack.push(undo);

        setUpUI(level);

        selectThing(level, thing);
        thing.elem.addEventListener("click", ev => selectThing(level, thing));
        btn.classList.remove("activated");
    };

    const handleKeyDown = ev => {
        if (ev.key === "Escape" || ev.key === "Delete" || ev.key === "Backspace") {
            ev.stopPropagation();
            cancelAddThing();
        }
    };

    const handleClick = ev => {
        // This is literally just to stop other event handlers from firing
        // on clicks
        ev.stopPropagation();
    };

    const removeEventListeners = () => {
        document.body.removeEventListener("mousemove", trackPosition2,
                                          { capture: true });
        document.body.removeEventListener("mouseup", capturePosition2,
                                          { capture: true });
        document.body.removeEventListener("mousedown", capturePosition2,
                                          { capture: true });
        document.body.removeEventListener("click", handleClick, { capture: true });
        document.removeEventListener("keydown", handleKeyDown, { capture: true });
    };

    const cancelAddThing = () => {
        removeEventListeners();
        thing.elem.remove();
        document.body.style.cursor = null;
        btn.classList.remove("activated");
    };

    document.body.style.cursor = "crosshair";
    document.body.addEventListener("mousedown", capturePosition1,
                                       { capture: true });
    btn.classList.add("activated");
}

function startAddPath (level, name, btn) {
    const svg = document.getElementById("level-scene").querySelector("svg");
    const mainGrp = svg.querySelector("g");

    let pos1 = null;
    let clientPos1 = null;
    let thing = null;
    let cancelAddNode = null;
    let done = false;

    const capturePosition1 = ev => {
        if (ev.button != 0) return;

        pos1 = coordsFromEvent(ev, svg);
        clientPos1 = { x: ev.clientX, y: ev.clientY };
        const Thing = thingTypes[name];
        thing = new Thing();
        thing.pushNode(pos1.x, pos1.y);
        const thingSvg = thing.createSvg();
        if (thingSvg != null) {
            mainGrp.appendChild(thingSvg);
        }
        document.body.removeEventListener("click", capturePosition1,
                                          { capture: true });
        document.body.addEventListener("contextmenu", handleRightClick,
                                       { capture: true });
        document.addEventListener("keydown", handleKeyDown, { capture: true });

        ev.stopPropagation();

        cancelAddNode = startAddNode(level, thing, onNodeAdded, {}).cancel;
    };

    const handleKeyDown = ev => {
        if (ev.key === "Enter") {
            ev.stopPropagation();
            done = true;
            cancelAddNode();
            finishAddThing();
        }
    };

    const handleRightClick = ev => {
        ev.stopPropagation();
        ev.preventDefault();
        done = true;
        cancelAddNode();
        finishAddThing();
    }

    const onNodeAdded = (nodeAdded) => {
        if (!nodeAdded) {
            if (!done) cancelAddThing();
        } else {
            cancelAddNode = startAddNode(level, thing, onNodeAdded, {}).cancel;
        }
    };

    const removeEventListeners = () => {
        document.removeEventListener("keydown", handleKeyDown, { capture: true });
        document.body.removeEventListener("contextmenu", handleRightClick,
                                          { capture: true });
    };

    const finishAddThing = () => {
        level.objects.push(thing);

        removeEventListeners();
        document.body.style.cursor = null;

        let undo, redo;
        level.redoStack = [];
        undo = {
            name: `Add ${name}`,
            undoCallback: () => {
                if (thing === level.selectedThing) {
                    selectThing(level, null);
                }
                thing.deleted = true;
                thing.elem.classList.add("deleted");
                thing.liElem.classList.add("deleted");
                level.redoStack.push(redo);
                autoSave(level);
                updateToolbar(level);
            }
        };
        redo = {
            name: `Add ${name}`,
            redoCallback: () => {
                thing.deleted = false;
                thing.elem.classList.remove("deleted");
                thing.liElem.classList.remove("deleted");
                level.undoStack.push(undo);
                autoSave(level);
                updateToolbar(level);
            }
        };
        level.undoStack.push(undo);
        autoSave(level);

        setUpUI(level);

        selectThing(level, thing);
        thing.elem.addEventListener("click", ev => selectThing(level, thing));
        btn.classList.remove("activated");
    };

    const cancelAddThing = () => {
        removeEventListeners();
        thing.elem.remove();
        document.body.style.cursor = null;
        btn.classList.remove("activated");
    };

    document.body.style.cursor = "crosshair";
    document.body.addEventListener("click", capturePosition1,
                                   { capture: true });
    btn.classList.add("activated");
}

window.addEventListener("load", ev => {

    for (const name of ["box", "circle", "cradle", "goal"]) {
        document.getElementById(`btn-add-${name}`).addEventListener("click",
            function (ev) {
                startTwoClickAdd(level, name, this);
            });
    }
    for (const name of ["open-path", "polygon"]) {
        document.getElementById(`btn-add-${name}`).addEventListener("click",
            function (ev) {
                startAddPath(level, name, this);
            });
    }

});
