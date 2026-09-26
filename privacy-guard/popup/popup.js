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


    // =========================================
    // CANVAS FINGERPRINTING
    // =========================================

    try {

        const canvasData =
            await browser.tabs.sendMessage(
                currentTab.id,
                {
                    action: "getCanvasData"
                }
            );


        document.getElementById(
            "canvas-status"
        ).textContent =
            canvasData.detected
                ? "Possível"
                : "Não detectado";


        document.getElementById(
            "canvas-data-url"
        ).textContent =
            canvasData.operations.toDataURL;


        document.getElementById(
            "canvas-blob"
        ).textContent =
            canvasData.operations.toBlob;


        document.getElementById(
            "canvas-image-data"
        ).textContent =
            canvasData.operations.getImageData;

        
        const canvasEventsList =
            document.getElementById("canvas-events");

        canvasEventsList.innerHTML = "";

        if (
            canvasData.events &&
            canvasData.events.length > 0
        ) {

            canvasData.events.forEach((event, index) => {

                const item = document.createElement("li");

                const date = new Date(event.timestamp);

                const time =
                    date.toLocaleTimeString("pt-BR", {
                        hour12: false
                    }) +
                    "." +
                    String(date.getMilliseconds()).padStart(3, "0");

                item.textContent =
                    `${index + 1}. ${event.operation} — ${time}`;

                /*
                * Stack completo fica disponível no tooltip.
                */
                if (event.stack) {
                    item.title = event.stack;
                }

                canvasEventsList.appendChild(item);
            });

        } else {

            const item = document.createElement("li");

            item.textContent =
                "Nenhum evento de Canvas detectado.";

            canvasEventsList.appendChild(item);
        }


    } catch (error) {

        console.error(
            "[Privacy Guard] Erro obtendo Canvas:",
            error
        );

        document.getElementById(
            "canvas-status"
        ).textContent = "Indisponível";
    }

    // =========================================
    // COOKIE SYNC / BOUNCE TRACKING
    // =========================================

    try {

        const trackingData =
            await browser.runtime.sendMessage({
                action: "getTrackingData",
                tabId: currentTab.id
            });


        document.getElementById(
            "bounce-status"
        ).textContent =
            trackingData.bounceDetected
                ? "Possível"
                : "Não detectado";


        document.getElementById(
            "cookie-sync-status"
        ).textContent =
            trackingData.cookieSyncDetected
                ? "Possível"
                : "Não detectado";


        document.getElementById(
            "redirect-count"
        ).textContent =
            trackingData.redirects.length;


        document.getElementById(
            "tracking-param-count"
        ).textContent =
            trackingData.suspiciousParams.length;


        const list =
            document.getElementById(
                "tracking-events"
            );

        list.innerHTML = "";


        // Redirecionamentos

        trackingData.redirects.forEach(
            (redirect) => {

                const item =
                    document.createElement("li");

                item.textContent =
                    `Redirect: ${redirect.from} → ${redirect.to}`;

                list.appendChild(item);
            }
        );

        // Bounce tracking

        trackingData.bounceEvents.forEach(
            (event) => {

                const item =
                    document.createElement("li");

                item.textContent =
                    `Possível bounce: ${event.from} → ${event.bounce} → ${event.to}`;

                list.appendChild(item);
            }
        );

        // Identificadores observados no fluxo de bounce

        (trackingData.bounceIdentifiers || []).forEach(
            (identifier) => {

                const item =
                    document.createElement("li");

                item.textContent =
                    `UID via ${identifier.storageType}: ` +
                    `${identifier.value} (${identifier.domain})`;

                list.appendChild(item);
            }
        );


        // Cookie sync

        trackingData.cookieSyncEvents.forEach(
            (event) => {

                const item =
                    document.createElement("li");

                item.textContent =
                    `Possível sync: ${event.domainA} ↔ ${event.domainB}`;

                list.appendChild(item);
            }
        );

        // Parâmetros potencialmente associados a tracking

        trackingData.suspiciousParams.forEach(
            (param) => {

                const item =
                    document.createElement("li");

                let value = param.value;

                // Evita valores enormes no popup
                if (value.length > 30) {
                    value =
                        value.substring(0, 30) + "...";
                }

                item.textContent =
                    `Parâmetro: ${param.parameter}=${value} (${param.domain})`;

                list.appendChild(item);
            }
        );


        if (!list.children.length) {

            const item =
                document.createElement("li");

            item.textContent =
                "Nenhuma evidência detectada.";

            list.appendChild(item);
        }


    } catch (error) {

        console.error(
            "[Privacy Guard] Erro analisando tracking:",
            error
        );

    }

});