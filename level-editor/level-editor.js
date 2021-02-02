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

    };

    for (const elem of lvElem.children) {
        if (elem.tagName === "start") {
            newLevel.start = {x: getFloatAttr(elem, "x"),
                              y: getFloatAttr(elem, "y")};
        } else {
            const Thing = thingTypes[elem.tagName];
            newLevel.objects.push(new Thing(elem));
        }
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
    const sceneWidth = scene.clientWidth;
    const sceneHeight = scene.clientHeight;
    const sceneAspect = sceneWidth/sceneHeight;
    const lvAspect = level.width/level.height;
    let unit = 1;
    if (lvAspect > sceneAspect) {
        // black bars above and below
        unit = (sceneWidth - 2*PADDING) / level.width;
    } else {
        // black bars on  the left and right
        unit = (sceneHeight - 2 * PADDING) / level.height;
    }

    // centre the level
    const leftOffset = (sceneWidth / unit - level.width) / 2;
    const bottomOffset = (sceneHeight / unit - level.height) / 2;

    const sceneSvg = document.createElementNS(SVGNS, "svg");
    sceneSvg.setAttributeNS(null, "width", sceneWidth);
    sceneSvg.setAttributeNS(null, "height", sceneHeight);
    sceneSvg.setAttributeNS(null, "viewBox",
        [level.left - leftOffset, level.bottom - bottomOffset,
         sceneWidth / unit, sceneHeight / unit].join(' '));

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

    const startBall = document.createElementNS(SVGNS, "g");
    const startBallBlackBit = document.createElementNS(SVGNS, "path");
    startBallBlackBit.setAttributeNS(null, "fill", "black");
    startBallBlackBit.setAttributeNS(null, "stroke", "none");
    startBallBlackBit.setAttributeNS(null, "d",
        `M${level.start.x - 0.1},${level.start.y} a0.1,0.1 0 0 0 0.2 0 z`);
    const startBallRedBit = document.createElementNS(SVGNS, "path");
    startBallRedBit.setAttributeNS(null, "fill", "red");
    startBallRedBit.setAttributeNS(null, "stroke", "none");
    startBallRedBit.setAttributeNS(null, "d",
        `M${level.start.x - 0.1},${level.start.y} a0.1,0.1 0 0 1 0.2 0 z`);
    startBall.appendChild(startBallBlackBit);
    startBall.appendChild(startBallRedBit);
    
    mainGrp.appendChild(startBall);


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
    newListItem ("Start");

    for (const thing of level.objects) {
        const className = thing.constructor.name;
        if (counters[className] == undefined) {
            counters[className] = 0;
        }
        const objName = className + " " + (++counters[className]);
        thing.name = objName;
        thing.liElem = newListItem(objName, ev => selectThing(level, thing));
    }
}

function selectThing(level, thing) {
    const ulObjList = document.getElementById("object-list");
    for (const li of ulObjList.children) {
        li.className = "";
    }
    thing.liElem.className = "selected";

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
}

function updatePropsList(level, thing) {
    const propsTable = document.getElementById("properties-table");

    if (propsTable.currentThing === thing) return;
    else propsTable.currentThing = thing;

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
        input.value = thing[attrName];
        input.type = "text";
        td.appendChild(input);
        tr.appendChild(th);
        tr.appendChild(td);
        propsTable.appendChild(tr);

        input.addEventListener("input", ev => {
            let newValue = undefined;
            if ((typeof thing[attrName]) === "number") {
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
    }
}

class PlayThing {
    get elemForSelection() {
        return this.elem;
    }
    updateAttrs(kwargs) {
        for (const argName in kwargs) {
            this[argName] = kwargs[argName];
        }
        this.refreshUI();
    }
    refreshUI() {
        // pass
    }
}

const thingTypes = {
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
            this.elem.setAttributeNS(null, "points",
                this.nodes.map(n => `${n.x},${n.y}`).join(' '));
            return this.elem;
        }
    }
}


window.addEventListener("load", function (event) {
    const xhr = new XMLHttpRequest();
    xhr.open("GET", `../level2.xml`, true);
    xhr.onload = xhrEvt => {
        if (xhr.readyState === xhr.DONE && xhr.status === 200) {
            level = loadLevelFromDocument(xhr.responseXML);
            drawLevel(level);
            setUpUI(level);
        }
    };
    xhr.send(null);
});
