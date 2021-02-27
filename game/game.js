/*
Copyright (c) 2020-2021 Thomas Jollans

https://github.com/tjol/marble-bounce
*/

'use strict';

const pl = planck;

let haveNextLevel, nextLevel;

let world, worldSize, ball;

let HAVE_WON = false;
let PAUSED = true;
let GAME_STARTED = false;
let GAME_OVER = false;

let cv, ctx, scale;

function loadLevelFromXMLDocument(lvDoc, callback) {
    const floatAttr = (elem, attrName) => parseFloat(elem.getAttribute(attrName));

    const wallFixDef = {density: 0, friction: .09};

    const newWorld = new pl.World({
        gravity: pl.Vec2(0, 0)
    });

    // <level>
    const lvElem = lvDoc.documentElement;
    // set up the bounding box
    const w = floatAttr(lvElem, 'width');
    const h = floatAttr(lvElem, 'height');
    const x0 = floatAttr(lvElem, 'left');
    const y0 = floatAttr(lvElem, 'bottom');
    const box = newWorld.createBody({
        position: pl.Vec2(0, 0),
        type: 'static'
    });
    box.createFixture(pl.Edge(pl.Vec2(x0, y0 + h),
                                pl.Vec2(x0, y0)), wallFixDef);
    box.createFixture(pl.Edge(pl.Vec2(x0, y0),
                                pl.Vec2(x0 + w, y0)), wallFixDef);
    box.createFixture(pl.Edge(pl.Vec2(x0 + w, y0),
                                pl.Vec2(x0 + w, y0 + h)), wallFixDef);
    box.createFixture(pl.Edge(pl.Vec2(x0 + w, y0 + h),
                                pl.Vec2(x0, y0 + h)), wallFixDef);

    let ball;

    // handle the objects
    for (const elem of lvElem.children) {
        const attr = attrName => floatAttr(elem, attrName);
        ({
        "start": () => {
            ball = newWorld.createDynamicBody({
                position: pl.Vec2(attr("x"), attr("y"))
            });
            ball.createFixture(pl.Circle(0.1), {
                density: .5,
                friction: .04,
                restitution: 0.4,
                userData: 'ball'
            });
        },
        "cradle": () => {
            const cradle = newWorld.createBody({
                position: pl.Vec2(attr("x"), attr("y")),
            });
            const w = attr("width"), h = attr("height");
            cradle.createFixture(pl.Edge(pl.Vec2(-w/2, h), pl.Vec2(-w/2, 0)), wallFixDef);
            cradle.createFixture(pl.Edge(pl.Vec2(-w/2, 0), pl.Vec2(w/2, 0)), wallFixDef);
            cradle.createFixture(pl.Edge(pl.Vec2(w/2, 0), pl.Vec2(w/2, h)), wallFixDef);
        },
        "goal": () => {
            newWorld.createBody({
                position: pl.Vec2(attr("x"), attr("y"))
            }).createFixture(pl.Box(attr("width")/2, attr("height")/2), {
                isSensor: true,
                userData: 'goal'
            });
        },
        "box": () => {
            newWorld.createBody({
                position: pl.Vec2(attr("x"), attr("y"))
            }).createFixture(pl.Box(attr("width")/2, attr("height")/2), wallFixDef);
        },
        "circle": () => {
            newWorld.createBody({
                position: pl.Vec2(attr("x"), attr("y"))
            }).createFixture(pl.Circle(attr("r")), wallFixDef);
        },
        "open-path": () => {
            const body = newWorld.createBody({ position: pl.Vec2(0, 0) });
            const nodePositions = Array.from(elem.children,
                pathNodeElem => pl.Vec2(floatAttr(pathNodeElem, "x"),
                                        floatAttr(pathNodeElem, "y")));
            for (let i = 1; i < nodePositions.length; ++i) {
                body.createFixture(pl.Edge(nodePositions[i-1], nodePositions[i]), wallFixDef);
            }
        },
        "polygon": () => {
            const body = newWorld.createBody({ position: pl.Vec2(0, 0) });
            const nodePositions = Array.from(elem.children,
                pathNodeElem => pl.Vec2(floatAttr(pathNodeElem, "x"),
                                        floatAttr(pathNodeElem, "y")));
            let i;
            for (i = 1; i < nodePositions.length; ++i) {
                body.createFixture(pl.Edge(nodePositions[i-1], nodePositions[i]), wallFixDef);
            }
            body.createFixture(pl.Edge(nodePositions[i-1], nodePositions[0]), wallFixDef);
        },
        })[elem.tagName]();
    }

    newWorld.on('begin-contact', handleContact);
    callback(newWorld, {x0, y0, w, h}, ball);
}

function loadLevelFromString(xmlString, callback) {
    const parser = new DOMParser();
    const xmldoc = parser.parseFromString(xmlString, "application/xml");
    loadLevelFromXMLDocument(xmldoc, callback);
}

function loadLevel(levelName, callback) {
    return loadLevelFromUrl(`../levels/${levelName}.xml`, callback);
}

function loadLevelFromUrl(levelUrl, callback) {
    const xhr = new XMLHttpRequest();
    xhr.open("GET", levelUrl, true);
    xhr.onload = xhrEvt => {
        if (xhr.readyState === xhr.DONE && xhr.status === 200) {
            const lvDoc = xhr.responseXML;

            loadLevelFromXMLDocument(lvDoc, callback);
        }
    };
    xhr.send(null);
}

const setWorld = (newWorld, newWorldSize, newBall) => {
    // store the world in the nonlocal state variables
    world = newWorld;
    worldSize = newWorldSize;
    ball = newBall;
    HAVE_WON = false;
};

function handleContact(contact) {
    var fixtureA = contact.getFixtureA();
    var fixtureB = contact.getFixtureB();

    if ((fixtureA.m_userData === 'ball' && fixtureB.m_userData === 'goal') ||
        (fixtureA.m_userData === 'goal' && fixtureB.m_userData === 'ball')) {
        // Contact between ball and goal!
        winGame();
    }
}

function winGame() {
    HAVE_WON = true;
    setToast("WIN");
    ball.setAwake(false);

    if (haveNextLevel()) {
        let full_msg = "WIN..3..2..1..";
        let currentLength = 3;
        const on_timer = () => {
            setToast(full_msg.substr(0, ++currentLength));
            if (currentLength == full_msg.length)
                setTimeout(() => {
                    setToast(null);
                    nextLevel();
                }, 333);
            else
                setTimeout(on_timer, 333);
        };
        setTimeout(on_timer, 333);
    } else {
        setTimeout(() => {
            setToast("WIN (game over)");
        }, 1000);

        pauseGame();
        // releaseWakeLock();
    }
}

function pauseGame () {
    PAUSED = true;
    releaseWakeLock();
    _exitFullscreen();

    const pauseBtn = document.getElementById("pause-button");
    pauseBtn.style.display = "none";

    if (!HAVE_WON) showStartIfSensors();
}

function _exitFullscreen () {
    if ("exitFullscreen" in document) {
        document.exitFullscreen();
    } else if ("webkitExitFullscreen" in document) {
        document.webkitExitFullscreen();
    }
}

function _requestFullscreen (elem, options) {
    if ("requestFullscreen" in elem) {
        elem.requestFullscreen(options);
    } else if ("webkitRequestFullscreen" in elem) {
        elem.webkitRequestFullscreen(options);
    }
}

function _isFullscreen () {
    if ("fullscreenElement" in document) {
        return document.fullscreenElement != null;
    } else if ("webkitFullscreenElement" in document) {
        return document.webkitFullscreenElement != null;
    } else {
        return false;
    }
}

function _setOnFullscreenChange (handler) {
    if ("onfullscreenchange" in document) {
        document.onfullscreenchange = handler;
    } else if ("onwebkitfullscreenchange" in document) {
        document.onwebkitfullscreenchange = handler;
    }
}

function initGame () {
    window.requestAnimationFrame(drawFrame);

    showStartIfSensors ();
}

function showStartIfSensors () {
    if (sensors_work) {
        const startBtn = document.getElementById(
            GAME_STARTED ? "resume-button" : "start-button");
        if (startBtn.style.display != "none") return; // already showing!
        startBtn.style.display = null;
        startBtn.onclick = async ev => {
            // request full screen and all
            const mainElem = document.querySelector("main");
            try {
                await _requestFullscreen(mainElem, { navigationUI: "hide" });
                console.log("entered fullscreen");
                setTimeout(() => {
                    _setOnFullscreenChange(() => {
                        if (!_isFullscreen()) {
                            _setOnFullscreenChange(null);
                            pauseGame();
                        }
                    });
                }, 500);
            } catch {
                console.log("entering fullscreen failed");
            }
            try {
                await screen.orientation.lock("portrait-primary");
                console.log("orientation locked");
            } catch {
                console.log("locking orientation failed");
                setToast("please lock your screen orientation");
                setTimeout(() => setToast(null), 3000);
            }
            // TODO apply some hack to compensate for orientation changes
            startBtn.onclick = null;
            startBtn.style.display = "none";
            GAME_STARTED = true;
            PAUSED = false;

            const pauseBtn = document.getElementById("pause-button");
            pauseBtn.style.display = null;
            pauseBtn.onclick = pauseGame;
            requestWakeLock();
        };
    } else {
        setTimeout(showStartIfSensors, 200);
    }
}

let screenWakeLock = null;
let wakeLockVideo = null;
function requestWakeLock() {
    /*if ('wakeLock' in navigator) {
        // Native wakelock (only supported in chrome on android)
        navigator.wakeLock.request('screen').then((result) => {
            screenWakeLock = result;
        });
    } else */{
        // Video-based wakelock bodge
        wakeLockVideo = document.getElementById("wakelock-video");
        wakeLockVideo.play();

        const refreshLock = () => {
            if (wakeLockVideo !== null) {
                wakeLockVideo.play();
                setTimeout(refreshLock, 10000);
            }
        };
        setTimeout(refreshLock, 10000);
    }
}
function releaseWakeLock() {
    /*if (screenWakeLock !== null) {
        screenWakeLock.release();
        screenWakeLock = null;
    } else*/ if (wakeLockVideo !== null) {
        try {
            wakeLockVideo.pause();
        } catch {
            //pass
        }
        wakeLockVideo = null;
    }
}

let last_frame_time = Date.now(); // new Date().getTime()

function drawFrame() {
    const frame_time = Date.now(); // new Date().getTime()
    const dt = (frame_time - last_frame_time) / 1000.0;
    last_frame_time = frame_time;
    // in each frame call world.step(timeStep) with fixed timeStep
    if (!PAUSED)
        world.step(dt);

    // calculate the proper origin
    const viewPortWidth = cv.width / scale;
    const viewPortHeight = cv.height / scale;

    let origin_x, origin_y;
    if (worldSize.w < viewPortWidth) {
        // Put the middle of the world in the middle of the screen
        let middle_of_the_world = worldSize.w / 2 + worldSize.x0;
        let middle_of_the_screen = viewPortWidth / 2;
        origin_x = middle_of_the_screen - middle_of_the_world;
    } else {
        // Put the ball in the middle of the screen
        let middle_of_the_screen = viewPortWidth / 2;
        origin_x = middle_of_the_screen - ball.getPosition().x;
        // Unless that puts the left wall in the viewport
        if (origin_x + worldSize.x0 > 0)
            origin_x = - worldSize.x0;
        // Or that puts the right wall in the viewport
        else if (origin_x + worldSize.x0 + worldSize.w < viewPortWidth)
            origin_x = viewPortWidth -  worldSize.x0 - worldSize.w;
    }

    if (worldSize.h < viewPortHeight) {
        // Put the middle of the world in the middle of the screen
        let middle_of_the_world = worldSize.h / 2 + worldSize.y0;
        let middle_of_the_screen = viewPortHeight / 2;
        origin_y = middle_of_the_screen - middle_of_the_world;
    } else {
        // Put the ball in the middle of the screen
        let middle_of_the_screen = viewPortHeight / 2;
        origin_y = middle_of_the_screen - ball.getPosition().y;
        // Unless that puts the floor in the viewport
        if (origin_y + worldSize.y0 > 0)
            origin_y = - worldSize.y0;
        // Or that puts the ceiling in the viewport
        else if (origin_y + worldSize.y0 + worldSize.h < viewPortHeight)
            origin_y = viewPortHeight -  worldSize.y0 - worldSize.h;
    }

    origin_y -= viewPortHeight; // canvas has the origin at the top by default, we want the bottom

    ctx.save();
    ctx.clearRect(0, 0, cv.width, cv.height);


    // iterate over bodies and fixtures
    for (let b = world.getBodyList(); b; b = b.getNext()) {
        ctx.save();
        let body_pos = b.getPosition();
        let body_angle = b.getAngle();
        // Set up the coordinate system
        ctx.lineWidth = 2 / scale;
        ctx.scale(scale, -scale);
        ctx.translate(origin_x, origin_y);
        ctx.translate(body_pos.x, body_pos.y);
        ctx.rotate(body_angle);

        for (let f = b.getFixtureList(); f; f = f.getNext()) {
            // draw or update fixture
            let t = f.getType();
            let s = f.getShape();
            if (t == 'edge') {
                let v1 = s.m_vertex1;
                let v2 = s.m_vertex2;
                ctx.beginPath();
                ctx.moveTo(v1.x, v1.y);
                ctx.lineTo(v2.x, v2.y);
                ctx.stroke();
            } else if (t == 'circle') {
                let r = s.m_radius;
                let ctr = s.m_p;
                if (f.m_userData == 'ball') {
                    ctx.beginPath();
                    ctx.arc(ctr.x, ctr.y, r, 0, Math.PI);
                    ctx.fill();
                    ctx.fillStyle = "#ff0000";
                    ctx.beginPath();
                    ctx.arc(ctr.x, ctr.y, r, Math.PI, 2 * Math.PI);
                    ctx.fill();
                } else {
                    ctx.beginPath();
                    ctx.arc(ctr.x, ctr.y, r, 0, 2*Math.PI);
                    ctx.stroke();
                }
            } else if (t == 'polygon') {
                let vv = s.m_vertices;
                if (f.m_userData == 'goal') {
                    let minX = null;
                    let minY = null;
                    let maxX = null;
                    let maxY = null;
                    for (let v of vv) {
                        if (minX === null || minX > v.x) minX = v.x;
                        if (minY === null || minY > v.y) minY = v.y;
                        if (maxX === null || maxX < v.x) maxX = v.x;
                        if (maxY === null || maxY < v.y) maxY = v.y;
                    }
                    let h = maxY - minY;
                    let w = maxX - minX;
                    let sq_size = Math.min(h,w) / 2;
                    for (let y = minY; y < maxY; y += 2 * sq_size) {
                        for (let x = minX + sq_size; x < maxX; x += 2 * sq_size) {
                            ctx.fillRect(x, y, sq_size, sq_size);
                        }
                        for (let x = minX; x < maxX; x += 2 * sq_size) {
                            ctx.fillRect(x, y + sq_size, sq_size, sq_size);
                        }
                    }
                    // ctx.strokeStyle = "red";
                }
                ctx.beginPath();
                let started = false;
                for (let v of vv) {
                    if (started) {
                        ctx.lineTo(v.x, v.y);
                    } else {
                        ctx.moveTo(v.x, v.y);
                        started = true;
                    }
                }
                ctx.closePath();
                ctx.stroke();
            }
        }

        ctx.restore();

    }

    ctx.restore();
    // request a new frame
    window.requestAnimationFrame(drawFrame);

    if (!HAVE_WON) {
        // Make sure the simulation is still running...
        ball.setAwake(true);
    }
}

let sensors_work = false;
let init_a_x = null;
let init_a_y = null;
let has_moved = false;
let told_to_move = false;

const coordsInverted = !!(/iPhone|iPad|iPod/i.test(navigator.userAgent))

function handleDeviceMotion (event) {
    sensors_work = true;
    const accel = event.accelerationIncludingGravity;

    let a_x = accel.x;
    let a_y = - Math.sqrt(accel.y * accel.y + accel.z * accel.z);
    if ((accel.y < 0 && Math.abs(accel.y) > Math.abs(accel.z)) || (accel.z < 0 && Math.abs(accel.z) > Math.abs(accel.y)))
        a_y = -a_y;

    if (coordsInverted) {
        a_x = -a_x;
        a_y = -a_y;
    }

    const g = pl.Vec2(- a_x * 2, a_y * 2);
    if (typeof world !== 'undefined') world.setGravity(g);

    if (init_a_x === null) {
        init_a_x = a_x;
        init_a_y = a_y;
    } else if (!has_moved) {
        let dx = a_x - init_a_x;
        let dy = a_y - init_a_y;
        if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
            has_moved = true;
        } else if (!told_to_move) {
            told_to_move = true;
            setTimeout(function() {
                function unset_msg() {
                    if (has_moved) {
                        setToast(null);
                    } else {
                        setTimeout(unset_msg, 500);
                    }
                }
                if (!has_moved && !PAUSED) {
                    setToast("move your phone!");

                    unset_msg();
                }
            }, 1000);
        }
    }
}

function setToast (msg) {
    const toast = document.getElementById("toast");
    if (msg == null || msg == "") {
        toast.style.display = "none";
    } else {
        toast.textContent = msg;
        toast.style.display = null;
    }
}

window.addEventListener("load", function (event) {

    // Rendering bit

    cv = document.getElementById("gcnv");
    ctx = cv.getContext('2d');

    cv.height = window.innerHeight;
    cv.width = window.innerWidth;

    window.addEventListener("resize", ev => {
        cv.height = window.innerHeight;
        cv.width = window.innerWidth;
        scale = window.innerWidth / 3.8;
    });

    scale = window.innerWidth / 3.8;

    if (location.pathname.startsWith("/t/")) {
        // Load a test level
        haveNextLevel = () => false;
        nextLevel = () => null;

        let running = false;

        const testId = /^\/t\/([A-Za-z0-9_-]+)$/.exec(location.pathname)[1];
        const testRef = firebase.database().ref("/level-test/"+testId);

        testRef.child("xml").on("value", (snapshot) => {
            const levelXml = snapshot.val();

            loadLevelFromString(levelXml, (newWorld, newWorldSize, newBall) => {
                setWorld(newWorld, newWorldSize, newBall);
                setToast(null);
                if (PAUSED) showStartIfSensors();

                if (!running) {
                    initGame();
                    running = true;

                    const updateAccessed = () => {
                        testRef.child("accessed").set(Date.now()).then(() => {
                            setTimeout(updateAccessed, 30000);
                        });
                    };
                    updateAccessed();
                }
            });
        });
    } else if (location.pathname.startsWith("/l/")) {
        // Load a shared level
        haveNextLevel = () => false;
        nextLevel = () => null;

        let running = false;

        const fbDb = firebase.database();
        const shareId = /^\/l\/([A-Za-z0-9_-]+)$/.exec(location.pathname)[1];
        const shareRef = fbDb.ref("/shares/"+shareId);

        shareRef.once("value", async snapshot => {
            const shareInfo = snapshot.val();
            const lvlRef = fbDb.ref(`/levels/${shareInfo.uid}/${shareInfo.levelName}`);
            const path = (await lvlRef.child('path').once("value")).val();
            const fbStorageRef = firebase.storage().ref();
            const fileRef = fbStorageRef.child(path);
            const url = await fileRef.getDownloadURL();
            loadLevelFromUrl(url, (newWorld, newWorldSize, newBall) => {
                setWorld(newWorld, newWorldSize, newBall);

                initGame();
            });
        });

    } else {
        // Load the normal level set
        const levels = ["level1", "level2", "level3"];
        let levelIdx = 0;

        haveNextLevel = () => (levelIdx + 1) < levels.length;

        nextLevel = () => {
            if (haveNextLevel()) {
                ++levelIdx;
                loadLevel(levels[levelIdx], setWorld);
            }
        };

        loadLevel(levels[levelIdx], (newWorld, newWorldSize, newBall) => {
            setWorld(newWorld, newWorldSize, newBall);

            initGame();
        });
    }

    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            // requestWakeLock();
        } else {
            // releaseWakeLock();
            pauseGame();
        }
    });

    if ("DeviceMotionEvent" in window) {
        if (typeof(DeviceMotionEvent.requestPermission) === "function") {
            // This is probably mobile Safari
            sensors_work = true;

            setToast("this game needs sensors");
            DeviceMotionEvent.requestPermission().then( response => {
                if ( response == "granted" ) {

                    setToast(null);
                    window.addEventListener('devicemotion', handleDeviceMotion, true);
                }
            });
        } else {
            window.addEventListener('devicemotion', handleDeviceMotion, true);
            setTimeout(function() {
                if (!sensors_work) {
                    setToast("no data from sensors ☹");
                }
            }, 1000);
        }
    } else {
        setToast("no sensors detected!");
    }

});
