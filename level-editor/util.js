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

function getRandomIdUsingHash (data) {
    const hash = fnv1a(data);
    // Add 22 bits of randomness for a total of 54 = 9 * 6 bits
    // These are short-lived IDs should this should be enough
    return bi2b64((hash << 22n) | BigInt(Math.floor(0x3fffff *  Math.random())));
}

function getBaseUrl () {
    const beforeQuery = location.href.split("?")[0];
    const urlParts = beforeQuery.split("/");
    for (let i = urlParts.length-1; i >= 0; --i) {
        if (urlParts[i] === "level-editor") {
            return urlParts.slice(0, i).join("/") + "/";
        }
    }
    return "/";
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


const FNV_primes = {
    32: 16777619n,
    64: 1099511628211n,
    128: 309485009821345068724781371n,
    256: 374144419156711147060143317175368453031918731002211n,
    512: 35835915874844867368919076489095108449946327955754392558399825615420669938882575126094039892345713852759n,
    1024: 5016456510113118655434598811035278955030765345404790744303017523831112055108147451509157692220295382716162651878526895249385292291816524375083746691371804094271873160484737966720260389217684476157468082573n
}

const FNV_offset = {
    32: 2166136261n,
    64: 14695981039346656037n,
    128: 144066263297769815596495629667062367629n,
    256: 100029257958052580907070968620625704837092796014241193945225284501741471925557n,
    512: 9659303129496669498009435400716310466090418745672637896108374329434462657994582932197716438449813051892206539805784495328239340083876191928701583869517785n,
    1024: 14197795064947621068722070641403218320880622795441933960878474914617582723252296732303717722150864096521202355549365628174669108571814760471015076148029755969804077320157692458563003215304957150157403644460363550505412711285966361610267868082893823963790439336411086884584107735010676915n
}

function fnv1a (val, bits=32) {
    const fnvPrime = FNV_primes[bits];
    const mask = (1n << BigInt(bits)) - 1n;
    let result = FNV_offset[bits];
    for (let i = 0; i < val.length; ++i) {
        result ^= BigInt(val.charCodeAt(i));
        result *= fnvPrime;
        result &= mask;
    }
    return result;
}

// const BASE64ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
// const BASE64PADDING = "=";
const BASE64ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
// const BASE64PADDING = "";


/* These functions encode big integers as base 64 numbers, but this is NOT
   "Base64" - the bits are not aligned the same way as in the classic case
   of encoding an octet stream.
   The practical upshot of this is that the code here is simpler, and that
   e.g. a "32 bit" number can end up as 5 or 6 characters, depending on whether
   the top 2 bits are zero or not. */
function bi2b64 (i, alphabet=BASE64ALPHABET) {
    let result = "";
    while (i > 0) {
        result = alphabet[i & 0x3fn] + result;
        i >>= 6n;
    }
    return result;
}

function b642bi (b64s, alphabet=BASE64ALPHABET) {
    let result = 0n;
    for (const c of b64s) {
        result |= BigInt(alphabet.indexOf(c));
        result <<= 6n;
    }
    return result >> 6n;
}
