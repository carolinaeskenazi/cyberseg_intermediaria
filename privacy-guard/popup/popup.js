browser.tabs.query({
    active: true,
    currentWindow: true
}).then(async (tabs) => {

    const currentTab = tabs[0];

    const scoreInput = {
        thirdPartyDomains: 0,

        thirdPartyCookies: 0,
        persistentCookies: 0,

        localStorage: false,
        sessionStorage: false,
        indexedDB: false,

        canvas: false,
        cookieSync: false,
        bounce: false,
        hook: false
    };

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

    scoreInput.thirdPartyDomains =
        domains.length;

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

    scoreInput.thirdPartyCookies =
        cookieData.thirdParty;

    scoreInput.persistentCookies =
        cookieData.persistent;

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
    // STORAGE POR FRAME / ORIGEM
    // =========================================

    try {

        const frameStorage =
            await browser.runtime.sendMessage({
                action: "getFrameStorageData",
                tabId: currentTab.id
            });

        const frameList =
            document.getElementById(
                "frame-storage-list"
            );

        frameList.innerHTML = "";

        const frames =
            Object.values(frameStorage);

        const topFrame =
            frames.find(
                (frame) =>
                    frame.context &&
                    frame.context.isTopFrame
            );

        if (topFrame) {

            scoreInput.localStorage =
                topFrame.localStorage.detected;

            scoreInput.sessionStorage =
                topFrame.sessionStorage.detected;

            scoreInput.indexedDB =
                topFrame.indexedDB.detected;
        }

        if (frames.length === 0) {

            const item =
                document.createElement("li");

            item.textContent =
                "Nenhum contexto adicional observado.";

            frameList.appendChild(item);

        } else {

            frames.sort(
                (a, b) =>
                    a.frameId - b.frameId
            );

            frames.forEach((frame) => {

                const item =
                    document.createElement("li");

                const context =
                    frame.context || {};

                const frameType =
                    context.isTopFrame
                        ? "TOP"
                        : "IFRAME";

                const localStatus =
                    frame.localStorage.accessible
                        ? `${frame.localStorage.count} item(ns)`
                        : "bloqueado/indisponível";

                const sessionStatus =
                    frame.sessionStorage.accessible
                        ? `${frame.sessionStorage.count} item(ns)`
                        : "bloqueado/indisponível";

                const indexedStatus =
                    frame.indexedDB.accessible
                        ? `${frame.indexedDB.count} banco(s)`
                        : "bloqueado/indisponível";


                item.textContent =
                    `${frameType} — ` +
                    `${context.hostname || "origem desconhecida"} | ` +
                    `localStorage: ${localStatus} | ` +
                    `sessionStorage: ${sessionStatus} | ` +
                    `IndexedDB: ${indexedStatus}`;

                frameList.appendChild(item);
            });
        }

    } catch (error) {

        console.error(
            "[Privacy Guard] Erro obtendo storage dos frames:",
            error
        );
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

        
        
        scoreInput.canvas =
            canvasData.detected;


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


        scoreInput.cookieSync =
            trackingData.cookieSyncDetected;

        scoreInput.bounce =
            trackingData.bounceDetected;



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



    // =========================================
    // HIJACKING / HOOK
    // =========================================

    try {

        const hookData =
            await browser.tabs.sendMessage(
                currentTab.id,
                {
                    action: "getHookData"
                }
            );


        scoreInput.hook =
            hookData.thirdPartyWebSocketCount > 0;


        document.getElementById(
            "hook-status"
        ).textContent =
            hookData.detected
                ? "Possível"
                : "Não detectado";


        document.getElementById(
            "websocket-count"
        ).textContent =
            hookData.websocketCount;


        document.getElementById(
            "third-party-websocket-count"
        ).textContent =
            hookData.thirdPartyWebSocketCount;


        const hookList =
            document.getElementById(
                "hook-events"
            );


        hookList.innerHTML = "";


        hookData.websockets.forEach(
            (event) => {

                const item =
                    document.createElement("li");


                const classification =
                    event.thirdParty
                        ? "TERCEIRO"
                        : "mesma origem";


                item.textContent =
                    `WebSocket: ${event.domain || event.url} ` +
                    `(${classification})`;


                if (event.stack) {
                    item.title =
                        event.stack;
                }


                hookList.appendChild(
                    item
                );
            }
        );


        if (!hookList.children.length) {

            const item =
                document.createElement("li");

            item.textContent =
                "Nenhum indicador detectado.";

            hookList.appendChild(
                item
            );
        }


    } catch (error) {

        console.error(
            "[Privacy Guard] Erro obtendo indicadores de hook:",
            error
        );


        document.getElementById(
            "hook-status"
        ).textContent =
            "Indisponível";
    }




    // =========================================
    // PRIVACY SCORE
    // =========================================

    const scoreResult =
        calculatePrivacyScore(
            scoreInput
        );


    document.getElementById(
        "privacy-score"
    ).textContent =
        `${scoreResult.score} / 100`;


    const scoreBreakdown =
        document.getElementById(
            "score-breakdown"
        );


    scoreBreakdown.innerHTML = "";


    if (
        scoreResult.breakdown.length === 0
    ) {

        const item =
            document.createElement("li");

        item.textContent =
            "Nenhuma penalidade aplicada.";

        scoreBreakdown.appendChild(item);

    } else {

        scoreResult.breakdown.forEach(
            (penalty) => {

                const item =
                    document.createElement("li");

                item.textContent =
                    `${penalty.label}: -${penalty.points}`;

                scoreBreakdown.appendChild(
                    item
                );
            }
        );
    }

});

function calculatePrivacyScore(data) {

    let score = 100;

    const breakdown = [];


    function penalize(label, points) {

        if (points <= 0) {
            return;
        }

        score -= points;

        breakdown.push({
            label: label,
            points: points
        });
    }


    // =====================================
    // DOMÍNIOS DE TERCEIRA PARTE
    // Máximo: -20
    // =====================================

    let thirdPartyPenalty = 0;

    if (data.thirdPartyDomains >= 21) {
        thirdPartyPenalty = 20;
    } else if (data.thirdPartyDomains >= 11) {
        thirdPartyPenalty = 15;
    } else if (data.thirdPartyDomains >= 6) {
        thirdPartyPenalty = 10;
    } else if (data.thirdPartyDomains >= 1) {
        thirdPartyPenalty = 5;
    }

    penalize(
        "Domínios de terceira parte",
        thirdPartyPenalty
    );


    // =====================================
    // COOKIES DE TERCEIRA PARTE
    // Máximo: -15
    // =====================================

    let thirdPartyCookiePenalty = 0;

    if (data.thirdPartyCookies >= 6) {
        thirdPartyCookiePenalty = 15;
    } else if (data.thirdPartyCookies >= 3) {
        thirdPartyCookiePenalty = 10;
    } else if (data.thirdPartyCookies >= 1) {
        thirdPartyCookiePenalty = 5;
    }

    penalize(
        "Cookies de terceira parte",
        thirdPartyCookiePenalty
    );


    // =====================================
    // COOKIES PERSISTENTES
    // Máximo: -10
    // =====================================

    let persistentPenalty = 0;

    if (data.persistentCookies >= 31) {
        persistentPenalty = 10;
    } else if (data.persistentCookies >= 11) {
        persistentPenalty = 6;
    } else if (data.persistentCookies >= 1) {
        persistentPenalty = 3;
    }

    penalize(
        "Cookies persistentes",
        persistentPenalty
    );


    // =====================================
    // STORAGE HTML5
    // Máximo: -10
    // =====================================

    let storagePenalty = 0;

    if (data.localStorage) {
        storagePenalty += 4;
    }

    if (data.sessionStorage) {
        storagePenalty += 2;
    }

    if (data.indexedDB) {
        storagePenalty += 4;
    }

    penalize(
        "Storage HTML5",
        storagePenalty
    );


    // =====================================
    // CANVAS
    // =====================================

    if (data.canvas) {
        penalize(
            "Canvas fingerprinting",
            15
        );
    }


    // =====================================
    // COOKIE SYNC
    // =====================================

    if (data.cookieSync) {
        penalize(
            "Cookie sync",
            15
        );
    }


    // =====================================
    // BOUNCE TRACKING
    // =====================================

    if (data.bounce) {
        penalize(
            "Bounce tracking",
            10
        );
    }


    // =====================================
    // HIJACKING / HOOK
    // =====================================

    if (data.hook) {
        penalize(
            "WebSocket terceiro / Hook",
            5
        );
    }


    score =
        Math.max(
            0,
            Math.min(100, score)
        );


    return {
        score: score,
        breakdown: breakdown
    };
}