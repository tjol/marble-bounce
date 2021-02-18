/*
Copyright (c) 2021 Thomas Jollans

https://github.com/tjol/marble-bounce
*/

'use strict';

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
            autoSave(level);
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
            autoSave(level);
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
            autoSave(level);
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
            autoSave(level);
            updateToolbar(level);
        }
    }
    if (redoNow) {
        redo.redoCallback();
    } else {
        level.undoStack.push(undo);
        autoSave(level);
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
        let origValue = thing[attrName];
        if ((typeof origValue) === "number") {
            origValue = to3Decimals(origValue);
        }
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
