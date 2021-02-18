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
    }
}

class UserLevelList {
    constructor (ulElem, clickCb) {
        this.clickCb = clickCb;
        this.ulElem = ulElem;
        this.levels = [];
        myLevelsRef.on("value", snapshot => this.onLevels(snapshot));
    }

    destroy () {
        myLevelsRef.off("value", this.onLevels);
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
                this.clickCb(levelName);
                for (const otherLi of this.ulElem.children) {
                    otherLi.classList.remove("selected");
                }
                liElem.classList.add("selected");
            });

            this.ulElem.appendChild(liFragment);
        }
    }

    haveLevelCalled (name) {
        return encodeURIComponent(name) in this.levels;
    }
}
