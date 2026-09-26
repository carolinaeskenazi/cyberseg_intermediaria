console.log("[Privacy Guard] Content script carregado.");

// =========================================
// CANVAS MONITOR
// =========================================

const canvasScript = document.createElement("script");

canvasScript.src =
    browser.runtime.getURL(
        "content/canvas-monitor.js"
    );

canvasScript.onload = function () {
    this.remove();
};

(document.head || document.documentElement)
    .appendChild(canvasScript);


//Coleta informações sobre armazenamento HTML5 da página.

async function collectStorageData() {
    const storageData = {
        localStorage: {
            detected: false,
            count: 0
        },

        sessionStorage: {
            detected: false,
            count: 0
        },

        indexedDB: {
            detected: false,
            count: 0,
            databases: []
        }
    };

    // =========================================
    // LOCAL STORAGE
    // =========================================

    try {
        const localCount = localStorage.length;

        storageData.localStorage.count = localCount;
        storageData.localStorage.detected = localCount > 0;

    } catch (error) {
        console.warn(
            "[Privacy Guard] Não foi possível acessar localStorage:",
            error
        );
    }


    // =========================================
    // SESSION STORAGE
    // =========================================

    try {
        const sessionCount = sessionStorage.length;

        storageData.sessionStorage.count = sessionCount;
        storageData.sessionStorage.detected =
            sessionCount > 0;

    } catch (error) {
        console.warn(
            "[Privacy Guard] Não foi possível acessar sessionStorage:",
            error
        );
    }


    // =========================================
    // INDEXEDDB
    // =========================================

    try {

       
        if (indexedDB.databases) {

            const databases =
                await indexedDB.databases();

            storageData.indexedDB.count =
                databases.length;

            storageData.indexedDB.detected =
                databases.length > 0;

            storageData.indexedDB.databases =
                databases.map((database) => ({
                    name: database.name || "Sem nome",
                    version: database.version || null
                }));
        }

    } catch (error) {

        console.warn(
            "[Privacy Guard] Não foi possível consultar IndexedDB:",
            error
        );
    }

    return storageData;
}

const canvasEvents = {
    toDataURL: 0,
    toBlob: 0,
    getImageData: 0,
    events: []
};


window.addEventListener("message", (event) => {

    if (event.source !== window) {
        return;
    }

    const data = event.data;

    if (
        !data ||
        data.source !== "privacy-guard" ||
        data.type !== "canvas-operation"
    ) {
        return;
    }

    if (
        Object.prototype.hasOwnProperty.call(
            canvasEvents,
            data.operation
        )
    ) {

        canvasEvents[data.operation]++;

        canvasEvents.events.push({
            operation: data.operation,
            timestamp: data.timestamp,
            stack: data.stack
        });

        console.log(
            "[Privacy Guard] Canvas:",
            data.operation
        );
    }

});

//O popup solicita os dados ao content script.


browser.runtime.onMessage.addListener((message) => {

    if (message.action === "getStorageData") {
        return collectStorageData();
    }


    if (message.action === "getCanvasData") {

        const total =
            canvasEvents.toDataURL +
            canvasEvents.toBlob +
            canvasEvents.getImageData;

        return Promise.resolve({

            detected: total > 0,

            total: total,

            operations: {
                toDataURL: canvasEvents.toDataURL,
                toBlob: canvasEvents.toBlob,
                getImageData: canvasEvents.getImageData
            },

            events: canvasEvents.events
        });
    }

});