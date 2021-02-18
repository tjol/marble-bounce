/*
Copyright (c) 2021 Thomas Jollans

https://github.com/tjol/marble-bounce
*/

'use strict';

const SVGNS = "http://www.w3.org/2000/svg";

function getFloatAttr (elem, attrName) {
    return parseFloat(elem.getAttribute(attrName));
}

function to3Decimals (n) {
    return parseFloat(n.toFixed(3))
}

function getNewId () {
    return (Date.now().toString(36)
           + Math.floor(46656 *  Math.random()).toString(36));
}

function getCookie (name) {
    for (const s of document.cookie.split(";")) {
        const [ k, v ] = s.split("=");
        if (k === name) return decodeURIComponent(v);
    }
    return null;
}

function setCookie (name, value) {
    const expiryDate = new Date();
    expiryDate.setFullYear(expiryDate.getFullYear() + 5);
    let cookie = `${name}=${encodeURIComponent(value)}; `
    cookie += "SameSite=Lax; ";
    cookie += `expires=${expiryDate.toUTCString()}`;
    document.cookie = cookie;
}

function msgBox (message, actions) {
    // Set up the msgbox
    const msgbox = document.getElementById("msgbox");
    msgbox.querySelector("p").innerHTML = message;
    msgbox.classList.remove("hidden-modal");
    const buttonbar = msgbox.querySelector(".modal-window-buttons");
    while (buttonbar.firstChild) buttonbar.firstChild.remove();

    const close = (callback) => {
        msgbox.classList.add("hidden-modal");
        callback();
    };

    for (const action in actions) {
        const btn = document.createElement("button");
        btn.textContent = action;
        btn.onclick = ev => close(actions[action]);
        buttonbar.appendChild(btn);
    }
}
