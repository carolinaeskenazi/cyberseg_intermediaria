browser.tabs.query({
    active: true,
    currentWindow: true
}).then(async (tabs) => {

    const currentTab = tabs[0];

    if (!currentTab) {
        return;
    }

    // URL atual
    document.getElementById("page-url").textContent =
        currentTab.url || "URL indisponível";


    // =========================================
    // DOMÍNIOS DE TERCEIRA PARTE
    // =========================================

    const data = await browser.runtime.sendMessage({
        action: "getTabData",
        tabId: currentTab.id
    });

    const domains = Object.values(
        data.thirdPartyDomains || {}
    );

    document.getElementById(
        "third-party-count"
    ).textContent = domains.length;

    const list =
        document.getElementById("third-party-list");

    list.innerHTML = "";

    if (domains.length === 0) {

        const item = document.createElement("li");

        item.textContent =
            "Nenhum domínio de terceira parte detectado.";

        list.appendChild(item);

    } else {

        domains.sort(
            (a, b) => b.requests - a.requests
        );

        domains.forEach((domain) => {

            const item = document.createElement("li");

            item.textContent =
                `${domain.domain} (${domain.requests} requisições)`;

            list.appendChild(item);
        });
    }


    // =========================================
    // COOKIES
    // =========================================

    const cookieData =
        await browser.runtime.sendMessage({
            action: "getCookies",
            tabId: currentTab.id
        });

    document.getElementById(
        "cookie-total"
    ).textContent = cookieData.total;

    document.getElementById(
        "cookie-first-party"
    ).textContent = cookieData.firstParty;

    document.getElementById(
        "cookie-third-party"
    ).textContent = cookieData.thirdParty;

    document.getElementById(
        "cookie-session"
    ).textContent = cookieData.session;

    document.getElementById(
        "cookie-persistent"
    ).textContent = cookieData.persistent;

    // =========================================
    // STORAGE HTML5
    // =========================================

    try {

        const storageData =
            await browser.tabs.sendMessage(
                currentTab.id,
                {
                    action: "getStorageData"
                }
            );

        const hasStorage =
            storageData.localStorage.detected ||
            storageData.sessionStorage.detected ||
            storageData.indexedDB.detected;


        document.getElementById(
            "storage-status"
        ).textContent = hasStorage
            ? "Detectado"
            : "Não detectado";


        // LOCAL STORAGE

        document.getElementById(
            "local-storage"
        ).textContent =
            storageData.localStorage.detected
                ? `${storageData.localStorage.count} item(ns)`
                : "Não detectado";


        // SESSION STORAGE

        document.getElementById(
            "session-storage"
        ).textContent =
            storageData.sessionStorage.detected
                ? `${storageData.sessionStorage.count} item(ns)`
                : "Não detectado";


        // INDEXEDDB

        document.getElementById(
            "indexed-db"
        ).textContent =
            storageData.indexedDB.detected
                ? `${storageData.indexedDB.count} banco(s)`
                : "Não detectado";


    } catch (error) {

        console.error(
            "[Privacy Guard] Erro obtendo storage:",
            error
        );

        document.getElementById(
            "storage-status"
        ).textContent = "Indisponível";
    }

});