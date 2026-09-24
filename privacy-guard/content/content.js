console.log("[Privacy Guard] Content script carregado.");

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


//O popup solicita os dados ao content script.


browser.runtime.onMessage.addListener((message) => {

    if (message.action === "getStorageData") {
        return collectStorageData();
    }

});