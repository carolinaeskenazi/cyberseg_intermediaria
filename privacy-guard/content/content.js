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

        // Contexto em que o storage foi observado
        context: {
            origin: window.location.origin,
            hostname: window.location.hostname,
            url: window.location.href,
            isTopFrame: window === window.top
        },

        localStorage: {
            detected: false,
            count: 0,
            accessible: false
        },

        sessionStorage: {
            detected: false,
            count: 0,
            accessible: false
        },

        indexedDB: {
            detected: false,
            count: 0,
            accessible: false,
            databases: []
        }
    };


    // =========================================
    // LOCAL STORAGE
    // =========================================

    try {

        const localCount =
            localStorage.length;

        storageData.localStorage.accessible =
            true;

        storageData.localStorage.count =
            localCount;

        storageData.localStorage.detected =
            localCount > 0;

    } catch (error) {

        storageData.localStorage.accessible =
            false;

        console.warn(
            "[Privacy Guard] localStorage bloqueado/indisponível:",
            error
        );
    }


    // =========================================
    // SESSION STORAGE
    // =========================================

    try {

        const sessionCount =
            sessionStorage.length;

        storageData.sessionStorage.accessible =
            true;

        storageData.sessionStorage.count =
            sessionCount;

        storageData.sessionStorage.detected =
            sessionCount > 0;

    } catch (error) {

        storageData.sessionStorage.accessible =
            false;

        console.warn(
            "[Privacy Guard] sessionStorage bloqueado/indisponível:",
            error
        );
    }


    // =========================================
    // INDEXED DB
    // =========================================

    try {

        if (indexedDB.databases) {

            const databases =
                await indexedDB.databases();

            storageData.indexedDB.accessible =
                true;

            storageData.indexedDB.count =
                databases.length;

            storageData.indexedDB.detected =
                databases.length > 0;

            storageData.indexedDB.databases =
                databases.map((database) => ({
                    name:
                        database.name || "Sem nome",

                    version:
                        database.version || null
                }));

        } else {

            /*
             * IndexedDB existe, mas databases()
             * não está disponível.
             */
            storageData.indexedDB.accessible =
                typeof indexedDB !== "undefined";
        }

    } catch (error) {

        storageData.indexedDB.accessible =
            false;

        console.warn(
            "[Privacy Guard] IndexedDB bloqueado/indisponível:",
            error
        );
    }


    return storageData;
}

async function reportStorageToBackground() {
    try {
        const storageData = await collectStorageData();

        await browser.runtime.sendMessage({
            action: "reportFrameStorage",
            storageData: storageData
        });

    } catch (error) {
        console.warn(
            "[Privacy Guard] Erro ao reportar storage do frame:",
            error
        );
    }
}

// =========================================
// REPORTA STORAGE DESTE FRAME AO BACKGROUND
// =========================================

if (document.readyState === "loading") {

    window.addEventListener(
        "DOMContentLoaded",
        () => {
            reportStorageToBackground();
        },
        { once: true }
    );

} else {

    reportStorageToBackground();
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