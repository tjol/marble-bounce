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
}

function setUpUI(level) {
    // name the things and put them in the list
    const ulObjList = document.getElementById("object-list");
    while (ulObjList.firstChild) {
        ulObjList.removeChild(ulObjList.firstChild);
    }

    function newListItem(name, onClick) {
        const li = document.createElement("li");
        li.textContent = name;
        ulObjList.appendChild(li);
        li.addEventListener("click", onClick);
        return li;
    }

    const counters = {};

    newListItem ("Level");

    for (const thing of level.objects) {
        const className = thing.constructor.name;
        if (counters[className] == undefined) {
            counters[className] = 0;
        }
        const objName = className + " " + (++counters[className]);
        thing.name = objName;
        thing.liElem = newListItem(objName, ev => selectThing(level, thing));
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
        li.className = "";
    }
    thing.liElem.className = "selected";
    thing.liElem.scrollIntoView({behavior: "smooth", block: "nearest"});

    if (level.svgSelectionBorder != undefined) {
        level.svgSelectionBorder.remove();
    }

    level.selectedThing = thing;

    const svgElem = thing.elemForSelection;
    const svgGrp = svgElem.parentElement;
    const svgSelBorder = document.createElementNS(SVGNS, "rect");
    const bbox = svgElem.getBBox();
    svgSelBorder.setAttributeNS(null, "x", bbox.x - 0.02);
    svgSelBorder.setAttributeNS(null, "y", bbox.y - 0.02);
    svgSelBorder.setAttributeNS(null, "width", bbox.width + 0.04);
    svgSelBorder.setAttributeNS(null, "height", bbox.height + 0.04);
    svgSelBorder.setAttributeNS(null, "stroke", "#ffcd17");
    svgSelBorder.setAttributeNS(null, "stroke-width", "0.02");
    svgSelBorder.setAttributeNS(null, "stroke-dasharray", "0.05,0.05");
    svgSelBorder.setAttributeNS(null, "fill", "#ffcd17");
    svgSelBorder.setAttributeNS(null, "fill-opacity", "0.1")
    svgGrp.appendChild(svgSelBorder);

    level.svgSelectionBorder = svgSelBorder;

    updatePropsList(level, thing);

    setUpSelectionDrag(svgSelBorder, level, thing);
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
    }

    function onMouseUp (ev) {
        if (ev.button === 0) {
            document.body.removeEventListener("mousemove", onMouseMove);
            document.body.removeEventListener("mouseup", onMouseUp);
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
                level.redoStack.unshift(redo);
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
                level.undoStack.unshift(undo);
                updateToolbar(level);
            }
        }
        level.undoStack.unshift(undo);
        updateToolbar(level);
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

        const newSvgX = svgDelta.x + initialSvgCoords.x;
        const newSvgY = svgDelta.y + initialSvgCoords.y;
        svgSelBorder.setAttributeNS(null, "x", newSvgX);
        svgSelBorder.setAttributeNS(null, "y", newSvgY);

        thing.moveTo({x: initialThingPos.x + svgDelta.x,
                      y: initialThingPos.y + svgDelta.y});
        updatePropsList(level, thing, true);
    }

    svgSelBorder.addEventListener("mousedown", onMouseDown);
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

    for (const attrName of thing.attrs) {
        // Add the attribute to the list!
        const tr = document.createElement("tr");
        const th = document.createElement("th");
        const td = document.createElement("td");
        const input = document.createElement("input");
        th.textContent = attrName;
        const origValue = thing[attrName];
        input.value = origValue;
        input.type = "text";
        td.appendChild(input);
        tr.appendChild(th);
        tr.appendChild(td);
        propsTable.appendChild(tr);

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
            undo = {
                name: `Change ${thing.name}::${attrName}`,
                undoCallback: () => {
                    thing.updateAttrs({[attrName]: origValue});
                    if (propsTable.currentThing === thing)
                        selectThing(level, thing);

                    level.redoStack.unshift(redo);
                    updateToolbar(level);
                }
            };
            redo = {
                name: `Change ${thing.name}::${attrName}`,
                redoCallback: () => {
                    thing.updateAttrs({[attrName]: newValue});
                    if (propsTable.currentThing === thing)
                        selectThing(level, thing);

                    level.undoStack.unshift(undo);
                    updateToolbar(level);
                }
            };

            level.undoStack.unshift(undo);
            updateToolbar(level);
        });
    }
}

function level2xml(level) {
    const xmlDoc = document.implementation.createDocument(null, "level", null);
    const lvElem = xmlDoc.documentElement;
    lvElem.setAttribute("width", level.width);
    lvElem.setAttribute("height", level.height);
    lvElem.setAttribute("left", level.left);
    lvElem.setAttribute("bottom", level.bottom);

    for (const thing of level.objects) {
        lvElem.appendChild(thing.toXml(xmlDoc));
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

            this.redBit = document.createElementNS(SVGNS, "path");
            this.redBit.setAttributeNS(null, "fill", "red");
            this.redBit.setAttributeNS(null, "stroke", "none");

            this.elem.appendChild(this.blackBit);
            this.elem.appendChild(this.redBit);

            this.refreshUI ();

            return this.elem;
        }
        refreshUI () {
            this.blackBit.setAttributeNS(null, "cx", this.x);
            this.blackBit.setAttributeNS(null, "cy", this.y);
            this.blackBit.setAttributeNS(null, "r", 0.1);
            this.redBit.setAttributeNS(null, "d",
                `M${this.x - 0.1},${this.y} a0.1,0.1 0 0 1 0.2 0 z`);
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
            for (const nodeXml of xml.children) {
                this.nodes.push({
                    x: getFloatAttr(nodeXml, "x"),
                    y: getFloatAttr(nodeXml, "y")
                });
            }
            this.attrs = [];
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
    // Crtl+Z = undo
    if (ev.ctrlKey && !ev.altKey && !ev.shiftKey &&
            (ev.key == "z" || ev.key == "Z")) {
        // Capture
        ev.stopPropagation();
        // Handle
        actions.undo();
    }
}

const actions = {
    undo () {
        if (level.undoStack.length > 0) {
            level.undoStack.shift().undoCallback();
        }
    },
    redo () {
        if (level.redoStack.length > 0) {
            level.redoStack.shift().redoCallback();
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
