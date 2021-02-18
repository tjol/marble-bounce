/*
Copyright (c) 2021 Thomas Jollans

https://github.com/tjol/marble-bounce
*/

'use strict';

let level = null;

function createNewLevel () {
    unAutoSave();

    const ball = new (thingTypes.start)();
    ball.x = 1.75;
    ball.y = 3.5;
    const cradle = new (thingTypes.cradle)();
    cradle.x = 1.75;
    cradle.y = 3;
    cradle.width = 0.6;
    cradle.height = 0.5;
    const goal = new (thingTypes.goal)();
    goal.x = 1.75;
    goal.y = 0.5;
    goal.width = 1.5;
    goal.height = 0.25;

    level = {
        width: 3.5,
        height: 4.8,
        left: 0,
        bottom: 0,

        objects: [ ball, cradle, goal ],
        undoStack: [],
        redoStack: []
    };

    drawLevel(level);
    setUpUI(level);
    selectThing(level, null);

    return level;
}

function loadLevelFromDocument (dom_doc) {
    unAutoSave();

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

    try {
        for (const elem of lvElem.children) {
            const Thing = thingTypes[elem.tagName];
            newLevel.objects.push(new Thing(elem));
        }
    } catch {
        return null;
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
        mainGrp.setAttributeNS(null, "transform",
            `translate(0,${level.height + 2 * level.bottom}) scale(1,-1)`);
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
    if (level == null) {
        document.getElementById("btn-upload").disabled = true;
        document.getElementById("btn-download").disabled = true;
        document.getElementById("btn-undo").disabled = true;
        document.getElementById("btn-redo").disabled = true;
    } else {
        document.getElementById("btn-upload").disabled = false;
        document.getElementById("btn-download").disabled = false;
        document.getElementById("btn-undo").disabled = (level.undoStack.length === 0);
        document.getElementById("btn-redo").disabled = (level.redoStack.length === 0);
    }
}

function openLevelFromXmlString (xmlString) {
    const parser = new DOMParser();
    const xmldoc = parser.parseFromString(xmlString, "application/xml");
    level = loadLevelFromDocument(xmldoc);
    drawLevel(level);
    setUpUI(level);
    selectThing(level, null);
}

function openLevelFromURL (url) {
    const xhr = new XMLHttpRequest();
    xhr.open("GET", url, true);
    xhr.onload = () => {
        if (xhr.readyState === xhr.DONE && xhr.status === 200) {
            level = loadLevelFromDocument(xhr.responseXML);
            drawLevel(level);
            setUpUI(level);
            selectThing(level, null);
        }
    };
    xhr.send(null);
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

function autoSave (level) {
    const xml = level2xml(level);
    window.localStorage.setItem('levelEditorAutoSave', xml);
}

function unAutoSave () {
    window.localStorage.removeItem('levelEditorAutoSave');
}

function getAutoSave () {
    return window.localStorage.getItem('levelEditorAutoSave');
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
            if (xml instanceof Element) {
                this.x = getFloatAttr(xml, "x");
                this.y = getFloatAttr(xml, "y");
            }
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
            elem.setAttribute("x", to3Decimals(this.x));
            elem.setAttribute("y", to3Decimals(this.y));
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
            elem.setAttribute("x", to3Decimals(this.x));
            elem.setAttribute("y", to3Decimals(this.y));
            elem.setAttribute("width", to3Decimals(this.width));
            elem.setAttribute("height", to3Decimals(this.height));
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
            elem.setAttribute("x", to3Decimals(this.x));
            elem.setAttribute("y", to3Decimals(this.y));
            elem.setAttribute("width", to3Decimals(this.width));
            elem.setAttribute("height", to3Decimals(this.height));
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
            elem.setAttribute("x", to3Decimals(this.x));
            elem.setAttribute("y", to3Decimals(this.y));
            elem.setAttribute("width", to3Decimals(this.width));
            elem.setAttribute("height", to3Decimals(this.height));
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
            elem.setAttribute("x", to3Decimals(this.x));
            elem.setAttribute("y", to3Decimals(this.y));
            elem.setAttribute("r", to3Decimals(this.radius));
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
                nodeElem.setAttribute("x", to3Decimals(node.x));
                nodeElem.setAttribute("y", to3Decimals(node.y));
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
                nodeElem.setAttribute("x", to3Decimals(node.x));
                nodeElem.setAttribute("y", to3Decimals(node.y));
                pathElem.appendChild(nodeElem)
            }
            return pathElem;
        }
    },
}

function onKeyDown (ev) {
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

        if (level.undoStack.length == 0) {
            level.saved = null;
        } else {
            level.saved = level.undoStack[level.undoStack.length - 1];
        }
        unAutoSave();
    },
    deleteThing () {
        if (level.selectedThing.canBeDeleted) {
            deleteThing(level, level.selectedThing);
        }
    },
    new () {
        if (level == null
                || (level.undoStack.length == 0 && level.saved == null)
                || (level.saved === level.undoStack[level.undoStack.length-1])) {
            createNewLevel();
        } else {
            msgBox("You have not saved your work.<br>"
                   + "Are you sure you want to create a new level?",
                   {"Cancel": () => null,
                    "New Level": createNewLevel});
        }
    },
    open () {
        if (level == null
                || (level.undoStack.length == 0 && level.saved == null)
                || (level.saved === level.undoStack[level.undoStack.length-1])) {
            doOpenLevel();
        } else {
            msgBox("You have not saved your work.<br>"
                   + "Are you sure?",
                   {"Cancel": () => null,
                    "Open Level": doOpenLevel});
        }
    }
}

window.addEventListener("load", ev => {
    document.addEventListener("keydown", onKeyDown);
    updateToolbar(null);

    const autoSavedXml = getAutoSave();
    if (autoSavedXml != null) {
        try {
            openLevelFromXmlString(autoSavedXml);
            autoSave(level);
        } catch { }
    }
});
