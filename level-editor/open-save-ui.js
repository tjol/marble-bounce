/*
Copyright (c) 2021 Thomas Jollans

https://github.com/tjol/marble-bounce
*/

'use strict';

function doUploadLevel (level) {
    if (level == null) return;

    // Are we logged in?
    if (!userLoggedIn()) {
        msgBox("You need to sign in to upload levels.", {
            "Cancel": () => null,
            "Continue": () => {
                backEndActions.login().then(() => doUploadLevel(level));
            }
        });
        return;
    }

    const saveWindow = document.getElementById("level-save-window");
    const fileNameInput = document.getElementById("level-save-level-name");
    const existingFileList = document.getElementById("level-save-file-list");
    const errorMsgElem = saveWindow.querySelector(".error-message");

    const cancelBtn = document.getElementById("cancel-save-btn");
    const saveBtn = document.getElementById("save-level-btn");

    cancelBtn.onclick = closeSaveWindow;
    saveBtn.onclick = ev => {
        const levelName = fileNameInput.value;
        if (levelName == "") {
            errorMsgElem.style.display = null;
            errorMsgElem.textContent = "Name cannot be empty.";
        } else {
            const doUpload = () => {
                const levelXml = level2xml(level);
                uploadLevel(levelName, levelXml);
                closeSaveWindow();
            };
            if (fileListObj.haveLevelCalled(levelName)) {
                msgBox("A level with that name already exists. Are you sure?", {
                    No: () => {},
                    Yes: doUpload
                });
            } else {
                doUpload();
            }
        }
    };

    const fileListObj = new UserLevelList(existingFileList, levelName => {
        fileNameInput.value = levelName;
    });

    fileNameInput.value = "";
    errorMsgElem.style.display = "none";
    saveWindow.classList.remove("hidden-modal");

    function closeSaveWindow () {
        cancelBtn.onclick = null;
        saveBtn.onclick = null;
        saveWindow.classList.add("hidden-modal");
        fileListObj.destroy();
    }
}

function doOpenLevel () {
    // Set up the dialog
    const dialog = document.getElementById("level-open-window");
    dialog.classList.remove("hidden-modal");

    const cancelBtn = document.getElementById("cancel-open-btn");
    const openBtn = document.getElementById("open-level-btn");
    const fileList = document.getElementById("level-open-file-list");
    const fileInput = dialog.querySelector("input[type=file]");
    fileInput.value = "";

    const cloudTabBtn = document.getElementById("level-open-tab-cloud");
    const localTabBtn = document.getElementById("level-open-tab-local");
    const cloudPage = document.getElementById("level-open-page-cloud");
    const localPage = document.getElementById("level-open-page-local");

    openBtn.disabled = true;

    let fileListObj = null;

    const closeDialog = () => {
        cancelBtn.onclick = null;
        openBtn.onclick = null;
        if (fileListObj != null) fileListObj.destroy();
        fileInput.onchange = null;
        cloudTabBtn.onchange = localTabBtn.onchange = null;
        dialog.classList.add("hidden-modal");
    }

    cancelBtn.onclick = closeDialog;

    cloudTabBtn.onchange = localTabBtn.onchange = () => {
        cloudPage.style.display = cloudTabBtn.checked ? "block" : "none";
        localPage.style.display = localTabBtn.checked ? "block" : "none";
    };

    if (userInfo != null) {
        cloudTabBtn.disabled = false;
        fileListObj = new UserLevelList(fileList, () => { openBtn.disabled = false; });
        cloudTabBtn.click();
    } else {
        cloudTabBtn.disabled = true;
        localTabBtn.click();
    }

    openBtn.onclick = () => {
        if (cloudTabBtn.checked) {
            if (fileListObj.selectedLevel != null) {
                closeDialog();
                openCloud();
            }
        } else {
            if (fileInput.files.length > 0) {
                closeDialog();
                openLocal();
            }
        }
    };

    const openLocal = async () => {
        const f = fileInput.files[0];
        const xmltext = await f.text();

        try {
            openLevelFromXmlString(xmltext);
        } catch {
            msgBox("Error loading level.", { "OK": () => null });
        }
    }

    const openCloud = async () => {
        const path = fileListObj.selectedLevelInfo.path;
        const ref = fbStorageRef.child(path);
        try {
            const url = await ref.getDownloadURL();
            openLevelFromURL(url);
        } catch {
            msgBox("Error loading level.", { "OK": () => null });
        }
    };

    fileInput.onchange = () => {
        if (fileInput.files.length > 0) {
            closeDialog();
            openLocal();
        }
    };

}

class UserLevelList {
    constructor (ulElem, clickCb) {
        this.clickCb = clickCb;
        this.ulElem = ulElem;
        this.levels = {};
        this.selectedLevel = null;
        this._onLevels2 = snapshot => this.onLevels(snapshot);
        myLevelsRef.on("value", this._onLevels2);
    }

    destroy () {
        myLevelsRef.off("value", this._onLevels2);
        while (this.ulElem.firstChild) {
            this.ulElem.firstChild.remove();
        }
    }

    onLevels (snapshot) {
        while (this.ulElem.firstChild) {
            this.ulElem.firstChild.remove();
        }

        this.levels = snapshot.val();

        const liTpl = document.getElementById("file-li-template");

        for (const encodedName in this.levels) {
            const levelName = decodeURIComponent(encodedName);
            const liFragment = liTpl.content.cloneNode(true);
            const liElem = liFragment.querySelector("li");
            liFragment.querySelector("p").textContent = levelName;
            // TODO: delete button

            liElem.addEventListener("click", ev => {
                if (this.clickCb != null) this.clickCb(levelName);
                for (const otherLi of this.ulElem.children) {
                    otherLi.classList.remove("selected");
                }
                liElem.classList.add("selected");
                this.selectedLevel = levelName;
            });

            this.ulElem.appendChild(liFragment);
        }
    }

    get selectedLevelInfo () {
        return this.levels[encodeURIComponent(this.selectedLevel)];
    }

    haveLevelCalled (name) {
        return encodeURIComponent(name) in this.levels;
    }
}
