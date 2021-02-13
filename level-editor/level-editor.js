'use strict';

const SVGNS = "http://www.w3.org/2000/svg";

function getFloatAttr (elem, attrName) {
    return parseFloat(elem.getAttribute(attrName));
}

let level = null;

function loadLevelFromDocument(dom_doc) {
    const lvElem = dom_doc.documentElement;
    if (lvElem.tagName !== "level") {
        throw new Error("Not a valid level");
    }
    let newLevel = {
        width: getFloatAttr(lvElem, "width"),
        height: getFloatAttr(lvElem, "height"),
        left: getFloatAttr(lvElem, "left"),
        bottom: getFloatAttr(lvElem, "bottom"),

        objects: [],
        undoStack: [],
        redoStack: []
    };

    for (const elem of lvElem.children) {
        const Thing = thingTypes[elem.tagName];
        newLevel.objects.push(new Thing(elem));
    }

    return newLevel;
}

function drawLevel(level)
{
    const scene = document.getElementById("level-scene");
    // empty the scene
    while (scene.firstChild) {
        scene.removeChild(scene.firstChild);
    }

    const PADDING = 50;

    // build it up!
    let sceneWidth, sceneHeight, sceneAspect;
    let unit = 1;
    let leftOffset, bottomOffset;
    let viewBox;

    const calcLevelSize = () => {
        sceneWidth = scene.clientWidth;
        sceneHeight = scene.clientHeight;
        sceneAspect = sceneWidth/sceneHeight;
        const lvAspect = level.width/level.height;
        if (lvAspect > sceneAspect) {
            // black bars above and below
            unit = (sceneWidth - 2*PADDING) / level.width;
        } else {
            // black bars on  the left and right
            unit = (sceneHeight - 2 * PADDING) / level.height;
        }
        level.scaleUnit = unit;

        // centre the level
        leftOffset = (sceneWidth / unit - level.width) / 2;
        bottomOffset = (sceneHeight / unit - level.height) / 2;

        viewBox = [level.left - leftOffset, level.bottom - bottomOffset,
                   sceneWidth / unit, sceneHeight / unit].join(' ')
    };

    calcLevelSize();

    const sceneSvg = document.createElementNS(SVGNS, "svg");
    sceneSvg.setAttributeNS(null, "width", sceneWidth);
    sceneSvg.setAttributeNS(null, "height", sceneHeight);
    sceneSvg.setAttributeNS(null, "viewBox",viewBox);

    const lvRect = document.createElementNS(SVGNS, "rect");
    lvRect.setAttributeNS(null, "width", level.width);
    lvRect.setAttributeNS(null, "height", level.height);
    lvRect.setAttributeNS(null, "x", level.left);
    lvRect.setAttributeNS(null, "y", level.bottom);
    lvRect.setAttributeNS(null, "fill", "white");
    lvRect.setAttributeNS(null, "stroke", "black");
    lvRect.setAttributeNS(null, "stroke-width", "0.015");

    level.lvRectSvg = lvRect;

    const mainGrp = document.createElementNS(SVGNS, "g");
    mainGrp.setAttributeNS(null, "fill", "none");
    mainGrp.setAttributeNS(null, "stroke", "black");
    mainGrp.setAttributeNS(null, "stroke-width", "0.015");
    mainGrp.setAttributeNS(null, "transform",
        `translate(0,${level.height + 2 * level.bottom}) scale(1,-1)`);


    for (const thing of level.objects) {
        const thingSvg = thing.createSvg();
        if (thingSvg != undefined) {
            mainGrp.appendChild(thingSvg);
            thingSvg.addEventListener("click", ev => selectThing(level, thing));
        }
    }

    sceneSvg.appendChild(lvRect);
    sceneSvg.appendChild(mainGrp);

    scene.appendChild(sceneSvg);

    const statusPara = document.getElementById("status-msg");
    sceneSvg.addEventListener("mousemove", ev => {
        const svgBBox =sceneSvg.getBoundingClientRect();
        const x_px = ev.clientX;
        const y_px = ev.clientY;
        const x_coord = (x_px - svgBBox.left) / unit + level.left - leftOffset;
        const y_coord = (svgBBox.bottom - y_px) / unit + level.bottom - bottomOffset;
        statusPara.textContent = `(${x_coord.toFixed(2)}, ${y_coord.toFixed(2)})`;
    });

    window.addEventListener("resize", ev => {
        calcLevelSize();
        sceneSvg.setAttributeNS(null, "width", sceneWidth);
        sceneSvg.setAttributeNS(null, "height", sceneHeight);
        sceneSvg.setAttributeNS(null, "viewBox",viewBox);
    });

    level.refreshUI = function () {
        calcLevelSize();
        sceneSvg.setAttributeNS(null, "width", sceneWidth);
        sceneSvg.setAttributeNS(null, "height", sceneHeight);
        sceneSvg.setAttributeNS(null, "viewBox",viewBox);
        lvRect.setAttributeNS(null, "width", level.width);
        lvRect.setAttributeNS(null, "height", level.height);
        lvRect.setAttributeNS(null, "x", level.left);
        lvRect.setAttributeNS(null, "y", level.bottom);
    }

    level.updateAttrs = PlayThing.prototype.updateAttrs;
}

function setUpUI(level) {
    // name the things and put them in the list
    const ulObjList = document.getElementById("object-list");
    while (ulObjList.firstChild) {
        ulObjList.removeChild(ulObjList.firstChild);
    }

    const liTpl = document.getElementById("object-li-template");

    function newListItem(name, onClick, onDeleteClick) {
        const liFragment = liTpl.content.cloneNode(true);
        const liElem = liFragment.querySelector("li");
        liFragment.querySelector("p").textContent = name;
        liElem.addEventListener("click", onClick);

        const deleteButton = liFragment.querySelector(".delete-button");

        if (onDeleteClick != null) {
            deleteButton.addEventListener("click", onDeleteClick);
        } else {
            deleteButton.disabled = true;
        }

        ulObjList.appendChild(liFragment);
        return ulObjList.lastElementChild; // JavaScript is CURSED. (and single-threaded)
    }

    const counters = {};

    newListItem("Level", ev => selectThing(level, level));

    for (const thing of level.objects) {
        const className = thing.constructor.name;
        if (counters[className] == undefined) {
            counters[className] = 0;
        }
        const objName = className + " " + (++counters[className]);
        const onClick = ev => selectThing(level, thing);
        const onDelete = thing.canBeDeleted
                         ? ev => {
                             ev.stopPropagation();
                             deleteThing(level, thing);
                         }
                         : null;
        thing.name = objName;
        thing.liElem = newListItem(objName, onClick, onDelete);
        if (thing.deleted) {
            thing.liElem.classList.add("deleted");
        }
    }

    updateToolbar(level);
}

function updateToolbar(level) {
    document.getElementById("btn-undo").disabled = (level.undoStack.length === 0);
    document.getElementById("btn-redo").disabled = (level.redoStack.length === 0);
}

function selectThing(level, thing) {
    const ulObjList = document.getElementById("object-list");
    for (const li of ulObjList.children) {
        li.classList.remove("selected");
    }

    if (level.svgSelectionBorder != undefined) {
        level.svgSelectionBorder.remove();
    }

    level.selectedThing = thing;

    if (thing != null) {
        const liElem = (thing === level) ? ulObjList.firstElementChild : thing.liElem;
        liElem.classList.add("selected");
        liElem.scrollIntoView({behavior: "smooth", block: "nearest"});

        const svgSelBorder = document.createElementNS(SVGNS, "rect");
        const svgElem = thing === level ? level.lvRectSvg : thing.elemForSelection;
        const svgGrp = svgElem.parentElement;

        if (thing === level) {
            svgSelBorder.setAttributeNS(null, "x", level.lvRectSvg.getAttribute("x"));
            svgSelBorder.setAttributeNS(null, "y", level.lvRectSvg.getAttribute("y"));
            svgSelBorder.setAttributeNS(null, "width", level.lvRectSvg.getAttribute("width"));
            svgSelBorder.setAttributeNS(null, "height", level.lvRectSvg.getAttribute("height"));
            svgSelBorder.setAttributeNS(null, "fill", "none");
        } else {
            const bbox = svgElem.getBBox();
            svgSelBorder.setAttributeNS(null, "x", bbox.x - 0.02);
            svgSelBorder.setAttributeNS(null, "y", bbox.y - 0.02);
            svgSelBorder.setAttributeNS(null, "width", bbox.width + 0.04);
            svgSelBorder.setAttributeNS(null, "height", bbox.height + 0.04);
            svgSelBorder.setAttributeNS(null, "stroke-dasharray", "0.05,0.05");
            svgSelBorder.setAttributeNS(null, "fill", "var(--highlight-colour)");
            svgSelBorder.setAttributeNS(null, "fill-opacity", "0.1")
        }

        svgSelBorder.setAttributeNS(null, "stroke", "var(--highlight-colour)");
        svgSelBorder.setAttributeNS(null, "stroke-width", "0.02");

        svgGrp.appendChild(svgSelBorder);

        level.svgSelectionBorder = svgSelBorder;

        if (thing !== level) setUpSelectionDrag(svgSelBorder, level, thing);
    }

    updatePropsList(level, thing);
}

function deleteThing (level, thing) {
    // Deleting is a lie

    let undo, redo;
    level.redoStack = [];
    undo = {
        name: `Delete ${thing.name}`,
        undoCallback: () => {
            thing.deleted = false;
            thing.elem.classList.remove("deleted");
            thing.liElem.classList.remove("deleted");
            level.redoStack.push(redo);
            updateToolbar(level);
        }
    };
    redo = {
        name: `Delete ${thing.name}`,
        redoCallback: () => {
            if (thing === level.selectedThing) {
                selectThing(level, null);
            }
            thing.deleted = true;
            thing.elem.classList.add("deleted");
            thing.liElem.classList.add("deleted");
            level.undoStack.push(undo);
            updateToolbar(level);
        }
    }
    redo.redoCallback();
}

function registerEditUndoRedo (level, thing, name, undoFn, redoFn, redoNow)
{
    let undo, redo;
    level.redoStack = [];
    undo = {
        name,
        undoCallback: () => {
            undoFn();
            if (level.selectedThing === thing) {
                selectThing(level, thing);
                updatePropsList(level, thing, true);
            }
            level.redoStack.push(redo);
            updateToolbar(level);
        }
    };
    redo = {
        name,
        redoCallback: () => {
            redoFn();
            if (level.selectedThing === thing) {
                selectThing(level, thing);
                updatePropsList(level, thing, true);
            }
            level.undoStack.push(undo);
            updateToolbar(level);
        }
    }
    if (redoNow) {
        redo.redoCallback();
    } else {
        level.undoStack.push(undo);
        updateToolbar(level);
    }
}

function setUpSelectionDrag (svgSelBorder, level, thing) {
    let initialScreenCoords = undefined;
    let initialSvgCoords = undefined;
    let initialThingPos = undefined;
    let svgDelta = undefined;

    function onMouseDown (ev) {
        if (ev.button === 0) {
            document.body.addEventListener("mousemove", onMouseMove);
            document.body.addEventListener("mouseup", onMouseUp);
        }
        initialScreenCoords = { x: ev.clientX, y: ev.clientY };
        initialSvgCoords = { x: svgSelBorder.x.baseVal.value,
                             y: svgSelBorder.y.baseVal.value };
        initialThingPos = thing.position;
        svgDelta = {x: 0, y: 0};
        svgSelBorder.style.cursor = "grabbing";
    }

    function onMouseUp (ev) {
        if (ev.button === 0) {
            document.body.removeEventListener("mousemove", onMouseMove);
            document.body.removeEventListener("mouseup", onMouseUp);

            svgSelBorder.style.cursor = null;

            if (level.selectedThing === thing) {
                selectThing(level, thing);
                updatePropsList(level, thing, true);
            }

            // Set up undo
            registerEditUndoRedo(level, thing, `Move ${thing.name}`,
                () => thing.moveTo(initialThingPos),
                () => thing.moveTo({x: initialThingPos.x + svgDelta.x,
                                    y: initialThingPos.y + svgDelta.y}));
        }
    }

    function onMouseMove (ev) {
        if ((ev.buttons & 1) === 0) {
            // The primary mouse button is not pressed!
            // (in this case we should NOT be getting the event...)
            onMouseUp({ button: 0, fakeEvent: true });
            return;
        }

        const newScreenX = ev.clientX;
        const newScreenY = ev.clientY;
        const deltaScreenX = newScreenX - initialScreenCoords.x
        const deltaScreenY = newScreenY - initialScreenCoords.y

        svgDelta = { x: deltaScreenX / level.scaleUnit,
                     y: - deltaScreenY / level.scaleUnit };

        if (!thing.elem.contains(svgSelBorder)) {
        // things rendered as <g> elements kinda-sorta take ownership of the
        // selection border.
            const newSvgX = svgDelta.x + initialSvgCoords.x;
            const newSvgY = svgDelta.y + initialSvgCoords.y;
            svgSelBorder.setAttributeNS(null, "x", newSvgX);
            svgSelBorder.setAttributeNS(null, "y", newSvgY);
        }

        thing.moveTo({x: initialThingPos.x + svgDelta.x,
                      y: initialThingPos.y + svgDelta.y});
        updatePropsList(level, thing, true);
    }

    svgSelBorder.addEventListener("mousedown", onMouseDown);
    svgSelBorder.style.cursor = "grab";
}

function updatePropsList(level, thing, force_refresh=false) {
    const propsTable = document.getElementById("properties-table");

    if (!force_refresh && (propsTable.currentThing === thing)) {
        return;
    } else {
        propsTable.currentThing = thing;
    }

    // Empty!
    while (propsTable.firstChild) {
        propsTable.removeChild(propsTable.firstChild);
    }

    let attrList;
    if (thing == null) {
        return;
    } else if (thing === level) {
        attrList = ["width", "height", "left", "bottom"];
    } else {
        attrList = thing.attrs;
    }

    const rowTpl = document.getElementById("property-row-template");
    for (const attrName of attrList) {
        // Add the attribute to the list!
        const row = rowTpl.content.cloneNode(true);
        const th = row.querySelector("th");
        const input = row.querySelector("input");
        th.textContent = attrName;
        const origValue = thing[attrName];
        input.value = origValue;

        input.addEventListener("input", ev => {
            let newValue = undefined;
            if ((typeof origValue) === "number") {
                newValue = parseFloat(input.value);
                if (isNaN(newValue)) {
                    return;
                }
            } else {
                newValue = input.value;
            }
            // DAMN THEE ECMASCRIPT AND THY INSATIABLE NEED FOR INEXPLICABLE
            // SQUARE BRACKETS
            thing.updateAttrs({[attrName]: newValue});
            selectThing(level, thing);
        });

        input.addEventListener("change", ev => {
            const newValue = thing[attrName];
            registerEditUndoRedo(level, thing, `Change ${thing.name}::${attrName}`,
                () => thing.updateAttrs({[attrName]: origValue}),
                () => thing.updateAttrs({[attrName]: newValue}));
        });

        propsTable.appendChild(row);
    }

    if (thing.canAddNode) {
        const addBtnRowTpl = document.getElementById("add-node-row-template");
        const row = addBtnRowTpl.content.cloneNode(true);
        const btn = row.querySelector("button");
        btn.addEventListener("click", ev => startAddNode(level, thing, () => {
            selectThing(level, thing);
            updatePropsList(level, thing, true);
        }, { registerUndoRedo: true }));
        propsTable.appendChild(row);
    }
}

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
                updateToolbar(level);
            }
        };
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
                updateToolbar(level);
            }
        };
        level.undoStack.push(undo);

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

function coordsFromEvent (ev, svg) {
    if (svg == null)
        svg = document.getElementById("level-scene").querySelector("svg");

    const svgClientBBox = svg.getBoundingClientRect();

    const x_px = ev.clientX;
    const y_px = ev.clientY;
    const x_coord = (x_px - svgClientBBox.left) / level.scaleUnit
                    + svg.viewBox.baseVal.x;
    const y_coord = (svgClientBBox.bottom - y_px) / level.scaleUnit
                    + svg.viewBox.baseVal.y;
    return { x: x_coord, y: y_coord };
}

function level2xml (level) {
    const xmlDoc = document.implementation.createDocument(null, "level", null);
    const lvElem = xmlDoc.documentElement;
    lvElem.setAttribute("width", level.width);
    lvElem.setAttribute("height", level.height);
    lvElem.setAttribute("left", level.left);
    lvElem.setAttribute("bottom", level.bottom);

    for (const thing of level.objects) {
        if (!thing.deleted) {
            lvElem.appendChild(thing.toXml(xmlDoc));
        }
    }

    const serializer = new XMLSerializer();
    return serializer.serializeToString(xmlDoc);
}

class PlayThing {
    get elemForSelection () {
        return this.elem;
    }
    updateAttrs (kwargs) {
        for (const argName in kwargs) {
            this[argName] = kwargs[argName];
        }
        this.refreshUI();
    }
    refreshUI () {
        // pass
    }
    get position () {
        return {x: this.x, y: this.y};
    }
    moveTo (pos) {
        this.x = pos.x;
        this.y = pos.y;
        this.refreshUI();
    }
    get canBeDeleted () {
        return true;
    }
}

class GenericPoly extends PlayThing {
    constructor (xml) {
        super(xml);
        this.nodes = [];
        this.attrs = [];
        if (xml instanceof Element) {
            for (const nodeXml of xml.children) {
                this.pushNode(getFloatAttr(nodeXml, "x"),
                              getFloatAttr(nodeXml, "y"));
            }
        }
    }
    pushNode(x, y) {
        const i = this.nodes.length;
        const n = { x, y };
        this.nodes.push(n);
        this.attrs.push(`x ${i+1}`, `y ${i+1}`)
        Object.defineProperties(this, {
            [`x ${i+1}`]: {
                get: () => n.x,
                set: (val) => n.x = val,
                configurable: true,
                enumerable: false
            },
            [`y ${i+1}`]: {
                get: () => n.y,
                set: (val) => n.y = val,
                configurable: true,
                enumerable: false
            },
        });
    }
    popNode() {
        const i = this.nodes.length - 1;
        this.nodes.pop();
        this.attrs.pop();
        this.attrs.pop();
        delete this[`x ${i+1}`];
        delete this[`y ${i+1}`];
    }
    refreshUI () {
        this.elem.setAttributeNS(null, "points",
            this.nodes.map(n => `${n.x},${n.y}`).join(' '));
    }
    get position () {
        return {...this.nodes[0]};
    }
    moveTo (pos0) {
        const deltaX = pos0.x - this.nodes[0].x;
        const deltaY = pos0.y - this.nodes[0].y;
        for (const node of this.nodes) {
            node.x += deltaX;
            node.y += deltaY;
        }
        this.refreshUI();
    }
}

const thingTypes = {
    "start": class StartBall extends PlayThing {
        constructor (xml) {
            super(xml);
            this.x = getFloatAttr(xml, "x");
            this.y = getFloatAttr(xml, "y");
            this.attrs = ["x", "y"];
        }
        createSvg () {
            this.elem = document.createElementNS(SVGNS, "g");

            this.blackBit = document.createElementNS(SVGNS, "circle");
            this.blackBit.setAttributeNS(null, "fill", "black");
            this.blackBit.setAttributeNS(null, "stroke", "none");
            this.blackBit.setAttributeNS(null, "cx", "0");
            this.blackBit.setAttributeNS(null, "cy", "0");
            this.blackBit.setAttributeNS(null, "r", 0.1);

            this.redBit = document.createElementNS(SVGNS, "path");
            this.redBit.setAttributeNS(null, "fill", "red");
            this.redBit.setAttributeNS(null, "stroke", "none");
            this.redBit.setAttributeNS(null, "d",
                `M-0.1,0 a0.1,0.1 0 0 1 0.2 0 z`);

            this.elem.appendChild(this.blackBit);
            this.elem.appendChild(this.redBit);

            this.refreshUI ();

            return this.elem;
        }
        refreshUI () {
            this.elem.setAttributeNS(null, "transform",
                `translate(${this.x},${this.y})`);
        }
        get elemForSelection () {
            return this.blackBit;
        }
        toXml (xmlDoc) {
            const elem = xmlDoc.createElement("start");
            elem.setAttribute("x", this.x);
            elem.setAttribute("y", this.y);
            return elem;
        }
        get canBeDeleted () {
            return false;
        }
    },
    "goal": class Goal extends PlayThing {
        constructor (xml) {
            super(xml);
            if (xml instanceof Element) {
                this.x = getFloatAttr(xml, "x");
                this.y = getFloatAttr(xml, "y");
                this.width = getFloatAttr(xml, "width");
                this.height = getFloatAttr(xml, "height");
            }
            this.attrs = ["x", "y", "width", "height"];
        }
        createSvg () {
            this.elem = document.createElementNS(SVGNS, "g");
            this.boxElem = document.createElementNS(SVGNS, "rect");
            this.boxElem.setAttributeNS(null, "x", "0");
            this.boxElem.setAttributeNS(null, "y", "0");
            this.elem.appendChild(this.boxElem);

            this.refreshUI();
            return this.elem;
        }
        refreshUI () {
            this.boxElem.setAttributeNS(null, "width", this.width);
            this.boxElem.setAttributeNS(null, "height", this.height);

            while (this.elem.children.length > 1)
                this.elem.children[1].remove();

            this.elem.setAttributeNS(null, "transform",
                `translate(${this.x - this.width/2},${this.y - this.height/2})`);
            // this.elem shouldn't be a <g> (for now (?))

            if (!this._mock) {
                const sq_size = Math.min(this.width, this.height) / 2;
                const drawBlackSq = (x, y) => {
                    const elem = document.createElementNS(SVGNS, "rect");
                    elem.setAttributeNS(null, "fill", "black");
                    elem.setAttributeNS(null, "stroke", "none");
                    elem.setAttributeNS(null, "x", x);
                    elem.setAttributeNS(null, "y", y);
                    elem.setAttributeNS(null, "width", sq_size);
                    elem.setAttributeNS(null, "height", sq_size);
                    this.elem.appendChild(elem);
                };
                // This bit is a bit buggy
                for (let y = 0; y <= this.height - sq_size; y += 2 * sq_size) {
                    for (let x = sq_size; x <= this.width - sq_size; x += 2 * sq_size) {
                        drawBlackSq(x, y);
                    }
                    if (y + 1.999 * sq_size <= this.height) {
                        for (let x = 0; x <= this.width - sq_size; x += 2 * sq_size) {
                            drawBlackSq(x, y + sq_size);
                        }
                    }
                }
            }
        }
        moveTo (pos) {
            this.x = pos.x;
            this.y = pos.y;
            this.elem.setAttributeNS(null, "transform",
                `translate(${this.x - this.width/2},${this.y - this.height/2})`);
        }
        updateAttrs (kwargs) {
            if (kwargs.width === 0 || kwargs.height === 0) {
                return;
            } else {
                super.updateAttrs(kwargs);
            }
        }
        get elemForSelection() {
            return this.boxElem;
        }
        toXml (xmlDoc) {
            const elem = xmlDoc.createElement("goal");
            elem.setAttribute("x", this.x);
            elem.setAttribute("y", this.y);
            elem.setAttribute("width", this.width);
            elem.setAttribute("height", this.height);
            return elem;
        }
    },
    "box": class Box extends PlayThing {
        constructor (xml) {
            super(xml);
            if (xml instanceof Element) {
                this.x = getFloatAttr(xml, "x");
                this.y = getFloatAttr(xml, "y");
                this.width = getFloatAttr(xml, "width");
                this.height = getFloatAttr(xml, "height");
            }
            this.attrs = ["x", "y", "width", "height"];
        }
        createSvg () {
            this.elem = document.createElementNS(SVGNS, "rect");
            this.refreshUI();
            return this.elem;
        }
        refreshUI () {
            this.elem.setAttributeNS(null, "x", this.x - this.width/2);
            this.elem.setAttributeNS(null, "y", this.y - this.height/2);
            this.elem.setAttributeNS(null, "width", this.width);
            this.elem.setAttributeNS(null, "height", this.height);
        }
        toXml (xmlDoc) {
            const elem = xmlDoc.createElement("box");
            elem.setAttribute("x", this.x);
            elem.setAttribute("y", this.y);
            elem.setAttribute("width", this.width);
            elem.setAttribute("height", this.height);
            return elem;
        }
    },
    "cradle": class Cradle extends PlayThing {
        constructor (xml) {
            super(xml);
            if (xml instanceof Element) {
                this.x = getFloatAttr(xml, "x");
                this.y = getFloatAttr(xml, "y");
                this.width = getFloatAttr(xml, "width");
                this.height = getFloatAttr(xml, "height");
            }
            this.attrs = ["x", "y", "width", "height"];
        }
        createSvg () {
            this.elem = document.createElementNS(SVGNS, "polyline");
            this.refreshUI();
            return this.elem;
        }
        refreshUI () {
            this.elem.setAttributeNS(null, "points",
                [[this.x - this.width/2, this.y + this.height],
                 [this.x - this.width/2, this.y],
                 [this.x + this.width/2, this.y],
                 [this.x + this.width/2, this.y + this.height]]
                .join(' '));
        }
        toXml (xmlDoc) {
            const elem = xmlDoc.createElement("cradle");
            elem.setAttribute("x", this.x);
            elem.setAttribute("y", this.y);
            elem.setAttribute("width", this.width);
            elem.setAttribute("height", this.height);
            return elem;
        }
    },
    "circle": class Circle extends PlayThing {
        constructor (xml) {
            super(xml);
            if (xml instanceof Element) {
                this.x = getFloatAttr(xml, "x");
                this.y = getFloatAttr(xml, "y");
                this.radius = getFloatAttr(xml, "r");
            }
            this.attrs = ["x", "y", "radius"];
        }
        createSvg () {
            this.elem = document.createElementNS(SVGNS, "circle");
            this.refreshUI();
            return this.elem;
        }
        refreshUI() {
            this.elem.setAttributeNS(null, "cx", this.x);
            this.elem.setAttributeNS(null, "cy", this.y);
            this.elem.setAttributeNS(null, "r", this.radius);
        }
        toXml (xmlDoc) {
            const elem = xmlDoc.createElement("circle");
            elem.setAttribute("x", this.x);
            elem.setAttribute("y", this.y);
            elem.setAttribute("r", this.radius);
            return elem;
        }
    },
    "open-path": class OpenPath extends GenericPoly {
        constructor (xml) {
            super(xml);
            this.canAddNode = true;
        }
        createSvg () {
            this.elem = document.createElementNS(SVGNS, "polyline");
            this.refreshUI();
            return this.elem;
        }
        toXml (xmlDoc) {
            const pathElem = xmlDoc.createElement("open-path");
            for (const node of this.nodes) {
                const nodeElem = xmlDoc.createElement("node");
                nodeElem.setAttribute("x", node.x);
                nodeElem.setAttribute("y", node.y);
                pathElem.appendChild(nodeElem)
            }
            return pathElem;
        }
    },
    "polygon": class Polygon extends GenericPoly {
        createSvg () {
            this.elem = document.createElementNS(SVGNS, "polygon");
            this.refreshUI();
            return this.elem;
        }
        toXml (xmlDoc) {
            const pathElem = xmlDoc.createElement("polygon");
            for (const node of this.nodes) {
                const nodeElem = xmlDoc.createElement("node");
                nodeElem.setAttribute("x", node.x);
                nodeElem.setAttribute("y", node.y);
                pathElem.appendChild(nodeElem)
            }
            return pathElem;
        }
    },
}

function onKeyDown(ev) {
    if (ev.ctrlKey && !ev.altKey && !ev.shiftKey && // Ctrl+Z
            (ev.key == "z" || ev.key == "Z")) {
        // Capture
        ev.stopPropagation();
        // Handle
        actions.undo();
    } else if ((ev.ctrlKey && !ev.altKey && ev.shiftKey && // Ctrl+Shift+Z
                (ev.key == "z" || ev.key == "Z"))
            || (ev.ctrlKey && !ev.altKey && !ev.shiftKey && // Ctrl+Y
                (ev.key == "y" || ev.key == "Y"))) {
        ev.stopPropagation();
        actions.redo();
    } else if (ev.key == "Delete") {
        ev.stopPropagation();
        actions.deleteThing();
    }
}

const actions = {
    undo () {
        if (level.undoStack.length > 0) {
            level.undoStack.pop().undoCallback();
        }
    },
    redo () {
        if (level.redoStack.length > 0) {
            level.redoStack.pop().redoCallback();
        }
    },
    download () {
        const levelXml = level2xml(level);
        const linkElem = document.createElement('a');
        linkElem.setAttribute('href', 'data:application/xml;charset=utf-8,'
                                      + encodeURIComponent(levelXml));
        linkElem.setAttribute('download', 'level.xml');

        linkElem.style.display = 'none';
        document.body.appendChild(linkElem);

        linkElem.click();

        document.body.removeChild(linkElem);
    },
    deleteThing () {
        if (level.selectedThing.canBeDeleted) {
            deleteThing(level, level.selectedThing);
        }
    },
}


window.addEventListener("load", ev => {
    const xhr = new XMLHttpRequest();
    xhr.open("GET", `../level2.xml`, true);
    xhr.onload = xhrEvt => {
        if (xhr.readyState === xhr.DONE && xhr.status === 200) {
            level = loadLevelFromDocument(xhr.responseXML);
            document.addEventListener("keydown", onKeyDown);
            drawLevel(level);
            setUpUI(level);
        }
    };
    xhr.send(null);

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
