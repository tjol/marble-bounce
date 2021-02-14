"use strict";

function checkMouse () {
    // Check for a mouse
    if (matchMedia('(pointer:fine)').matches) {
        document.getElementById("open-editor").classList.remove("hidden");
    }
}

function thisIsAPhone () {
    document.getElementById("play-game").classList.remove("hidden");
    document.getElementById("no-motion").classList.add("hidden");
    document.getElementById("not-mobile").classList.add("hidden");
    checkMouse();
}

function thisMayNotBeAPhone () {
    document.getElementById("play-game").classList.add("hidden");
    if (guessIfMobile()) {
        document.getElementById("no-motion").classList.remove("hidden");
        document.getElementById("not-mobile").classList.add("hidden");
    } else {
        document.getElementById("no-motion").classList.add("hidden");
        document.getElementById("not-mobile").classList.remove("hidden");
    }
    checkMouse();
}

function guessIfMobile () {
    return /Android|iPhone/i.test(navigator.userAgent);
}

window.addEventListener("load", ev => {
    // Do we have devicemotion?
    if ("DeviceMotionEvent" in window) {
        if (typeof (DeviceMotionEvent.requestPermission) === "function") {
            // Mobile Safari needs the user to give permission
            if (/iPhone|iPad/i.test(navigator.userAgent)) {
                // No need to request it now
                thisIsAPhone();
            }
        } else {
            window.ondevicemotion = ev => {
                thisIsAPhone();
            };
            setTimeout(() => {
                thisMayNotBeAPhone();
            }, 200);
        }
    } else {
        thisMayNotBeAPhone();
    }
});
