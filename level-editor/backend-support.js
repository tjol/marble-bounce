/*
Copyright (c) 2021 Thomas Jollans

https://github.com/tjol/marble-bounce
*/

"use strict";

let userInfo = null;
let fbAuth;
let fbAuthUI;
let fbStorageRef;
let fbDb;

let myLevels = null;
let myLevelsRef = null;

window.addEventListener("load", ev => {
    // Initialize the FirebaseUI Widget using Firebase.
    fbAuth = firebase.auth();
    fbAuth.onAuthStateChanged(async user => {
        if (user) {
            // User is signed in.
            const displayName = user.displayName;
            const photoURL = user.photoURL;
            const uid = user.uid;
            const accessToken = await user.getIdToken();
            userInfo = { displayName, photoURL, uid, accessToken };

            const loginStatusElem = document.getElementById("login-status");
            loginStatusElem.style.display = null;
            document.getElementById("user-displayname").textContent = displayName;
            document.getElementById("user-photo").src = (photoURL == null
                ? "anonymous.png" : photoURL);

            document.getElementById("login-link").style.display = "none";

            subscribeToUserLevels();
        } else {
            // User is signed out.
            document.getElementById("login-status").style.display = "none";
            document.getElementById("login-link").style.display = null;
            userInfo = null;

            unsubscribeFromUserLevels()
        }
    }, error => {
        console.log(error);
    });
    fbAuthUI = new firebaseui.auth.AuthUI(fbAuth);
    fbStorageRef = firebase.storage().ref();
    fbDb = firebase.database();

    if (fbAuthUI.isPendingRedirect()) {
        backEndActions.login();
    }
});

function onLevels (snapshot) {
    myLevels = snapshot.val();
    for (const callback of onUserLevels._callbacks) {
        callback(myLevels);
    }
}

function subscribeToUserLevels () {
    myLevelsRef = fbDb.ref('levels/' + userInfo.uid);
    myLevelsRef.on('value', onLevels);
}

function unsubscribeFromUserLevels () {
    if (myLevelsRef == null) return;
    myLevelsRef.off('value', onLevels);
    myLevelsRef = null;
    myLevels = null;
    for (const callback of onUserLevels._callbacks) {
        callback(null);
    }
}

function userLoggedIn () {
    return userInfo != null;
}

class NotLoggedIn extends Error { }

const onUserLevels = {
    _callbacks: [],
    connect (callback) {
        if (userInfo == null || myLevelsRef == null) {
            // not logged in!
            throw new NotLoggedIn();
        }

        this._callbacks.push(callback);

        if (myLevels != null) {
            callback(myLevels);
        }
    },
    disconnect (callback) {
        this._callbacks.remove(callback);
    }
};

async function uploadLevel (name, xmlString) {
    const timestamp = Date.now();

    if (userInfo == null) throw new NotLoggedIn();

    const encodedName = encodeURIComponent(name);
    const levelDbRef = fbDb.ref(`levels/${userInfo.uid}/${encodedName}`);

    let path;
    if (encodedName in myLevels) {
        path = myLevelsRef[encodedName].path;
    } else {
        // Generate a file name
        const fileName = getNewId() + ".xml";
        path = `levels/${userInfo.uid}/${fileName}`;
    }

    const fileRef = fbStorageRef.child(path);
    await fileRef.putString(xmlString, "raw", { contentType: "application/xml" });

    await levelDbRef.set({ path, timestamp, isPublic: false });
}

const backEndActions = {
    login () {
        if (userLoggedIn()) {
            return new Promise((resolve, reject) => resolve());
        }

        // The "1" is supposed to be a kind of versioning scheme. Should the
        // old consent turn out to insufficient for whatever reason, it can
        // be invalidated here.
        if (getCookie("marblebouncegdprconsent") !== "1") {
            return new Promise((resolve, reject) => {
                const dialog = document.getElementById("cookie-consent-window");
                dialog.classList.remove("hidden-modal");

                const acceptBtn = document.getElementById("accept-cookie-btn");
                const rejectBtn = document.getElementById("reject-cookie-btn");

                const closeDialog = () => {
                    acceptBtn.removeEventListener("click", acceptCookie);
                    rejectBtn.removeEventListener("click", rejectCookie);
                    dialog.classList.add("hidden-modal");
                };

                const acceptCookie = ev => {
                    closeDialog();
                    setCookie("marblebouncegdprconsent", "1");
                    backEndActions.login().then(resolve, reject);
                };
                const rejectCookie = ev => {
                    closeDialog();
                    reject(new Error("GDPR rejection"));
                };

                acceptBtn.addEventListener("click", acceptCookie);
                rejectBtn.addEventListener("click", rejectCookie);
            });
        }

        return new Promise((resolve, reject) => {

            const dialog = document.getElementById("login-window");
            dialog.classList.remove("hidden-modal");
            fbAuthUI.start('#auth-container', {
                signInOptions: [
                firebase.auth.GoogleAuthProvider.PROVIDER_ID,
                firebase.auth.EmailAuthProvider.PROVIDER_ID,
                ],
                signInFlow: "popup",

                // tosUrl and privacyPolicyUrl accept either url string or a callback
                // function.
                // Terms of service url/callback.
                // tosUrl: '<your-tos-url>',
                // Privacy policy url/callback.
                // privacyPolicyUrl: function() {
                //   window.location.assign('<your-privacy-policy-url>');
                // }

                callbacks: {
                    // Called when the user has been successfully signed in.
                    signInSuccessWithAuthResult (authResult, redirectUrl) {
                        dialog.classList.add("hidden-modal");
                        resolve();
                        return false;
                    },
                    signInFailure (error) {
                        dialog.classList.add("hidden-modal");
                        reject(error);
                    }
                },
            });

            const cancelBtn = document.getElementById("cancel-login-btn");
            const cancelLogin = ev => {
                dialog.classList.add("hidden-modal");
                cancelBtn.removeEventListener("click", cancelLogin);
                reject(new Error("User cancelled"));
            };
            cancelBtn.addEventListener("click", cancelLogin);

        });
    },
    logout () {
        firebase.auth().signOut();
    },
    upload () {
        doUploadLevel(level);
    }
};
