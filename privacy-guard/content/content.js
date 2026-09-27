console.log(
    "[Privacy Guard] Content script carregado."
);


// =========================================
// INJETA MONITOR NO CONTEXTO DA PÁGINA
// =========================================

const canvasScript =
    document.createElement("script");


canvasScript.src =
    browser.runtime.getURL(
        "content/canvas-monitor.js"
    );


canvasScript.onload =
    function () {
        this.remove();
    };


(document.head || document.documentElement)
    .appendChild(canvasScript);


// =========================================
// STORAGE HTML5
// =========================================

async function collectStorageData() {

    const storageData = {

        context: {
            origin:
                window.location.origin,

            hostname:
                window.location.hostname,

            url:
                window.location.href,

            isTopFrame:
                window === window.top
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


    // =====================================
    // LOCAL STORAGE
    // =====================================

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


    // =====================================
    // SESSION STORAGE
    // =====================================

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


    // =====================================
    // INDEXEDDB
    // =====================================

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
                databases.map(
                    (database) => ({
                        name:
                            database.name ||
                            "Sem nome",

                        version:
                            database.version ||
                            null
                    })
                );

        } else {

            storageData.indexedDB.accessible =
                typeof indexedDB !==
                "undefined";
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


// =========================================
// ENVIA STORAGE DO FRAME AO BACKGROUND
// =========================================

async function reportStorageToBackground() {

    try {

        const storageData =
            await collectStorageData();


        await browser.runtime.sendMessage({
            action:
                "reportFrameStorage",

            storageData:
                storageData
        });

    } catch (error) {

        console.warn(
            "[Privacy Guard] Erro ao reportar storage do frame:",
            error
        );
    }
}


// =========================================
// REPORTA APÓS O DOM ESTAR DISPONÍVEL
// =========================================

if (document.readyState === "loading") {

    window.addEventListener(
        "DOMContentLoaded",

        () => {
            reportStorageToBackground();
        },

        {
            once: true
        }
    );

} else {

    reportStorageToBackground();
}


// =========================================
// EVENTOS DE CANVAS
// =========================================

const canvasEvents = {

    toDataURL: 0,

    toBlob: 0,

    getImageData: 0,

    events: []
};


// =========================================
// INDICADORES DE HOOK
// =========================================

const hookEvents = {
    websockets: []
};


// =========================================
// RECEBE EVENTOS DO SCRIPT INJETADO
// =========================================

window.addEventListener(
    "message",

    (event) => {

        if (event.source !== window) {
            return;
        }


        const data =
            event.data;


        if (
            !data ||
            data.source !== "privacy-guard"
        ) {
            return;
        }


        // =================================
        // CANVAS
        // =================================

        if (
            data.type ===
            "canvas-operation"
        ) {

            if (
                Object.prototype
                    .hasOwnProperty.call(
                        canvasEvents,
                        data.operation
                    )
            ) {

                canvasEvents[
                    data.operation
                ]++;


                canvasEvents.events.push({
                    operation:
                        data.operation,

                    timestamp:
                        data.timestamp,

                    stack:
                        data.stack
                });


                console.log(
                    "[Privacy Guard] Canvas:",
                    data.operation
                );
            }


            return;
        }


        // =================================
        // WEBSOCKET
        // =================================

        if (
            data.type ===
            "websocket-operation"
        ) {

            hookEvents.websockets.push({

                url:
                    data.url,

                timestamp:
                    data.timestamp,

                stack:
                    data.stack
            });


            console.log(
                "[Privacy Guard] WebSocket:",
                data.url
            );


            return;
        }
    }
);


// =========================================
// DOMÍNIO DE UM WEBSOCKET
// =========================================

function getDomainFromWebSocket(url) {

    try {

        return new URL(
            url
        ).hostname;

    } catch (error) {

        return null;
    }
}


// =========================================
// DADOS DE HOOK
// =========================================

function getHookData() {

    const pageDomain =
        window.location.hostname
            .replace(/^www\./, "")
            .toLowerCase();


    const websockets =
        hookEvents.websockets.map(
            (event) => {

                const domain =
                    getDomainFromWebSocket(
                        event.url
                    );


                const normalizedDomain =
                    domain
                        ? domain
                            .replace(
                                /^www\./,
                                ""
                            )
                            .toLowerCase()
                        : null;


                const thirdParty =
                    normalizedDomain &&
                    normalizedDomain !==
                        pageDomain &&
                    !normalizedDomain.endsWith(
                        "." + pageDomain
                    );


                return {
                    ...event,

                    domain:
                        normalizedDomain,

                    thirdParty:
                        Boolean(
                            thirdParty
                        )
                };
            }
        );


    const thirdPartyWebSockets =
        websockets.filter(
            (event) =>
                event.thirdParty
        );


    return {

        /*
         * WebSocket para domínio terceiro é
         * tratado como INDICADOR de possível
         * hook/hijacking, não como confirmação.
         */
        detected:
            thirdPartyWebSockets.length > 0,

        websocketCount:
            websockets.length,

        thirdPartyWebSocketCount:
            thirdPartyWebSockets.length,

        websockets:
            websockets
    };
}


// =========================================
// MENSAGENS DO POPUP
// =========================================

browser.runtime.onMessage.addListener(
    (message) => {


        // =================================
        // STORAGE
        // =================================

        if (
            message.action ===
            "getStorageData"
        ) {

            return collectStorageData();
        }


        // =================================
        // CANVAS
        // =================================

        if (
            message.action ===
            "getCanvasData"
        ) {

            const total =
                canvasEvents.toDataURL +
                canvasEvents.toBlob +
                canvasEvents.getImageData;


            return Promise.resolve({

                detected:
                    total > 0,

                total:
                    total,

                operations: {

                    toDataURL:
                        canvasEvents.toDataURL,

                    toBlob:
                        canvasEvents.toBlob,

                    getImageData:
                        canvasEvents.getImageData
                },

                events:
                    canvasEvents.events
            });
        }


        // =================================
        // HIJACKING / HOOK
        // =================================

        if (
            message.action ===
            "getHookData"
        ) {

            return Promise.resolve(
                getHookData()
            );
        }
    }
);