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
        const x_px = ev.clientX;
        const y_px = ev.clientY;
        const x_coord = x_px / unit + (level.left - leftOffset);
        const y_coord = (sceneHeight - y_px) / unit +
                        (level.bottom - bottomOffset);
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

    const liElem = (thing === level) ? ulObjList.firstElementChild : thing.liElem;
    liElem.classList.add("selected");
    liElem.scrollIntoView({behavior: "smooth", block: "nearest"});

    if (level.svgSelectionBorder != undefined) {
        level.svgSelectionBorder.remove();
    }

    level.selectedThing = thing;

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
        svgSelBorder.setAttributeNS(null, "fill", "#ffcd17");
        svgSelBorder.setAttributeNS(null, "fill-opacity", "0.1")
    }

    svgSelBorder.setAttributeNS(null, "stroke", "#ffcd17");
    svgSelBorder.setAttributeNS(null, "stroke-width", "0.02");

    svgGrp.appendChild(svgSelBorder);

    level.svgSelectionBorder = svgSelBorder;

    updatePropsList(level, thing);

    if (thing !== level) setUpSelectionDrag(svgSelBorder, level, thing);
}

function deleteThing (level, thing) {
    if (thing === level.selectedThing) {
        selectThing(level, level);
    }

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
            thing.deleted = true;
            thing.elem.classList.add("deleted");
            thing.liElem.classList.add("deleted");
            level.undoStack.push(undo);
            updateToolbar(level);
        }
    }
    redo.redoCallback();
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
            let undo, redo;
            level.redoStack = [];
            undo = {
                name: `Move ${thing.name}`,
                undoCallback: () => {
                    thing.moveTo(initialThingPos);
                    if (level.selectedThing === thing) {
                        selectThing(level, thing);
                        updatePropsList(level, thing, true);
                    }
                    level.redoStack.push(redo);
                    updateToolbar(level);
                }
            };
            redo = {
                name: `Move ${thing.name}`,
                redoCallback: () => {
                    thing.moveTo({x: initialThingPos.x + svgDelta.x,
                                y: initialThingPos.y + svgDelta.y});
                    if (level.selectedThing === thing) {
                        selectThing(level, thing);
                        updatePropsList(level, thing, true);
                    }
                    level.undoStack.push(undo);
                    updateToolbar(level);
                }
            }
            level.undoStack.push(undo);
            updateToolbar(level);
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
    if (thing === level) {
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
            let undo, redo;
            level.redoStack = [];
            undo = {
                name: `Change ${thing.name}::${attrName}`,
                undoCallback: () => {
                    thing.updateAttrs({[attrName]: origValue});
                    if (level.selectedThing === thing) {
                        selectThing(level, thing);
                        updatePropsList(level, thing, true);
                    }

                    level.redoStack.push(redo);
                    updateToolbar(level);
                }
            };
            redo = {
                name: `Change ${thing.name}::${attrName}`,
                redoCallback: () => {
                    thing.updateAttrs({[attrName]: newValue});
                    if (level.selectedThing === thing) {
                        selectThing(level, thing);
                        updatePropsList(level, thing, true);
                    }

                    level.undoStack.push(undo);
                    updateToolbar(level);
                }
            };

            level.undoStack.push(undo);
            updateToolbar(level);
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
    line.setAttributeNS(null, "stroke", "#ffcd17");
    mainGrp.appendChild(line);

    if (level.svgSelectionBorder != undefined) {
        level.svgSelectionBorder.remove();
    }

    const onMouseMove = ev => {
        const x_px = ev.clientX;
        const y_px = ev.clientY;
        const x_coord = (x_px - svgClientBBox.left) / level.scaleUnit
                        + svg.viewBox.baseVal.x;
        const y_coord = (svgClientBBox.bottom - y_px) / level.scaleUnit
                        + svg.viewBox.baseVal.y;

        line.setAttributeNS(null, "x2", x_coord);
        line.setAttributeNS(null, "y2", y_coord);

    };
    const onClick = ev => {
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
            let undo, redo;
            level.redoStack = [];
            undo = {
                name: `Add Node`,
                undoCallback: () => {
                    thing.popNode();
                    thing.refreshUI();
                    if (level.selectedThing === thing) {
                        selectThing(level, thing);
                        updatePropsList(level, thing, true);
                    }
                    level.redoStack.push(redo);
                    updateToolbar(level);
                }
            };
            redo = {
                name: `Add Node`,
                redoCallback: () => {
                    thing.pushNode(newNode.x, newNode.y);
                    thing.refreshUI();
                    if (level.selectedThing === thing) {
                        selectThing(level, thing);
                        updatePropsList(level, thing, true);
                    }
                    level.undoStack.push(undo);
                    updateToolbar(level);
                }
            }
            level.undoStack.push(undo);
            updateToolbar(level);
        }

        doneCb(true);
    };
    const onKeyDown = ev => {
        if (ev.key == "Escape") {
            ev.stopPropagation();
            // Stop this madness
            line.remove();
            document.removeEventListener("keydown", onKeyDown, { capture: true });
            document.body.removeEventListener("mousemove", onMouseMove, { capture: true });
            document.body.removeEventListener("click", onClick, { capture: true });
            document.body.style.cursor = null;
            doneCb(false);
        }
    }

    document.body.addEventListener("mousemove", onMouseMove, { capture: true });
    document.body.addEventListener("click", onClick, { capture: true });
    document.addEventListener("keydown", onKeyDown, { capture: true });
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
            this.x = getFloatAttr(xml, "x");
            this.y = getFloatAttr(xml, "y");
            this.width = getFloatAttr(xml, "width");
            this.height = getFloatAttr(xml, "height");
            this.attrs = ["x", "y", "width", "height"];
        }
        createSvg () {
            this.elem = document.createElementNS(SVGNS, "g");
            this.refreshUI();
            return this.elem;
        }
        refreshUI () {
            while (this.elem.firstChild) this.elem.firstChild.remove();

            this.elem.setAttributeNS(null, "transform",
                `translate(${this.x - this.width/2},${this.y - this.height/2})`);
            // this.elem shouldn't be a <g> (for now (?))
            this.boxElem = document.createElementNS(SVGNS, "rect");
            this.boxElem.setAttributeNS(null, "x", "0");
            this.boxElem.setAttributeNS(null, "y", "0");
            this.boxElem.setAttributeNS(null, "width", this.width);
            this.boxElem.setAttributeNS(null, "height", this.height);
            this.elem.appendChild(this.boxElem);


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
            this.x = getFloatAttr(xml, "x");
            this.y = getFloatAttr(xml, "y");
            this.width = getFloatAttr(xml, "width");
            this.height = getFloatAttr(xml, "height");
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
            this.x = getFloatAttr(xml, "x");
            this.y = getFloatAttr(xml, "y");
            this.width = getFloatAttr(xml, "width");
            this.height = getFloatAttr(xml, "height");
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
            this.x = getFloatAttr(xml, "x");
            this.y = getFloatAttr(xml, "y");
            this.radius = getFloatAttr(xml, "r");
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
    "open-path": class OpenPath extends PlayThing {
        constructor (xml) {
            super(xml);
            this.nodes = [];
            this.attrs = [];
            for (const nodeXml of xml.children) {
                this.pushNode(getFloatAttr(nodeXml, "x"),
                              getFloatAttr(nodeXml, "y"));
            }
            this.canAddNode = true;
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
        createSvg () {
            this.elem = document.createElementNS(SVGNS, "polyline");
            this.refreshUI();
            return this.elem;
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
    }
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
    }
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
});
