console.log("[Privacy Guard] Background iniciado.");


// ============================================================
// DADOS POR ABA
// ============================================================

const tabData = {};
const trackingData = {};


// ============================================================
// FUNÇÕES AUXILIARES
// ============================================================

function getHostname(url) {
    try {
        return new URL(url).hostname;
    } catch (error) {
        return null;
    }
}


function normalizeHostname(hostname) {
    if (!hostname) {
        return null;
    }

    return hostname
        .replace(/^www\./, "")
        .toLowerCase();
}


function initializeTab(tabId) {
    if (!tabData[tabId]) {
        tabData[tabId] = {
            pageDomain: null,
            thirdPartyDomains: {}
        };
    }
}


function initializeTracking(tabId) {
    if (!trackingData[tabId]) {
        trackingData[tabId] = {
            redirects: [],
            suspiciousParams: [],
            cookieSyncEvents: [],
            navigations: [],
            bounceEvents: [],
            bounceIdentifiers: [],
            bounceDetected: false
        };
    }
}


// ============================================================
// PARÂMETROS POTENCIALMENTE ASSOCIADOS A TRACKING
// ============================================================

const suspiciousParameterNames = [
    "uid",
    "user_id",
    "userid",
    "visitor_id",
    "visitorid",
    "client_id",
    "clientid",
    "click_id",
    "clickid",
    "fbclid",
    "gclid",
    "dclid",
    "msclkid",
    "ttclid",
    "twclid"
];


function analyzeURLParameters(url, tabId) {
    try {
        const parsedURL = new URL(url);

        initializeTracking(tabId);

        for (
            const [name, value]
            of parsedURL.searchParams.entries()
        ) {
            const normalizedName =
                name.toLowerCase();

            const suspicious =
                suspiciousParameterNames.includes(
                    normalizedName
                );

          
            const looksLikeHostname =
                /^[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)+$/.test(value);

            const identifierLike =
                value.length >= 16 &&
                /^[a-zA-Z0-9_-]+$/.test(value) &&
                !looksLikeHostname;

            if (!suspicious && !identifierLike) {
                continue;
            }

            const normalizedValue =
                value.substring(0, 80);

            const alreadyExists =
                trackingData[
                    tabId
                ].suspiciousParams.some(
                    (item) =>
                        item.domain === parsedURL.hostname &&
                        item.parameter === name &&
                        item.value === normalizedValue
                );

            if (!alreadyExists) {
                trackingData[
                    tabId
                ].suspiciousParams.push({
                    domain:
                        parsedURL.hostname,

                    parameter:
                        name,

                    value:
                        normalizedValue,

                    url:
                        url,

                    timestamp:
                        Date.now()
                });
            }
        }

    } catch (error) {
        // URL inválida ou protocolo não analisável.
    }
}


// ============================================================
// HISTÓRICO DE NAVEGAÇÃO / BOUNCE TRACKING
// ============================================================

function analyzeBounceIdentifiers(url, tabId) {
    try {
        const parsedURL = new URL(url);

        initializeTracking(tabId);

        const data = trackingData[tabId];

        for (
            const [name, value]
            of parsedURL.searchParams.entries()
        ) {
            const normalizedName =
                name.toLowerCase();

            let storageType = null;

            if (
                normalizedName.includes("bounceuid") &&
                normalizedName.includes("localstorage")
            ) {
                storageType = "localStorage";
            }

            if (
                normalizedName.includes("bounceuid") &&
                normalizedName.includes("cookie")
            ) {
                storageType = "cookie";
            }

            if (!storageType || !value) {
                continue;
            }

            const alreadyExists =
                data.bounceIdentifiers.some(
                    (item) =>
                        item.parameter === name &&
                        item.value === value &&
                        item.domain === parsedURL.hostname
                );

            if (!alreadyExists) {
                data.bounceIdentifiers.push({
                    parameter: name,
                    value: value.substring(0, 80),
                    storageType: storageType,
                    domain: parsedURL.hostname,
                    timestamp: Date.now()
                });
            }
        }

    } catch (error) {
        // URL não analisável.
    }
}

function registerMainFrameNavigation(tabId, url) {
    initializeTracking(tabId);

    const domain =
        normalizeHostname(
            getHostname(url)
        );

    if (!domain) {
        return;
    }

    const data =
        trackingData[tabId];

    const now =
        Date.now();

    const last =
        data.navigations[
            data.navigations.length - 1
        ];

    /*
     * Evita registrar exatamente a mesma navegação
     * duas vezes consecutivas.
     */
    if (
        last &&
        last.domain === domain &&
        last.url === url
    ) {
        return;
    }

    data.navigations.push({
        domain: domain,
        url: url,
        timestamp: now
    });

    /*
     * Para a heurística atual, somente navegações
     * ocorridas nos últimos 30 segundos interessam.
     */
    data.navigations =
        data.navigations.filter(
            (navigation) =>
                now - navigation.timestamp <= 30000
        );

    detectBouncePattern(tabId);
}


function detectBouncePattern(tabId) {
    initializeTracking(tabId);

    const data =
        trackingData[tabId];

    if (data.navigations.length < 3) {
        return;
    }

    /*
     * Procura o padrão:
     *
     * A -> B -> A
     *
     * Exemplo:
     *
     * publisher-company.site
     *          ↓
     * bad.third-party.site
     *          ↓
     * publisher-company.site
     */

    for (
        let i = 0;
        i <= data.navigations.length - 3;
        i++
    ) {
        const first =
            data.navigations[i];

        const middle =
            data.navigations[i + 1];

        const last =
            data.navigations[i + 2];

        const returnedToOrigin =
            first.domain === last.domain;

        const passedThroughOtherDomain =
            first.domain !== middle.domain;

        const duration =
            last.timestamp - first.timestamp;

        if (
            returnedToOrigin &&
            passedThroughOtherDomain &&
            duration <= 30000
        ) {
            const alreadyExists =
                data.bounceEvents.some(
                    (event) =>
                        event.from === first.domain &&
                        event.bounce === middle.domain &&
                        event.to === last.domain &&
                        event.start === first.timestamp
                );

            if (!alreadyExists) {
                data.bounceEvents.push({
                    from:
                        first.domain,

                    bounce:
                        middle.domain,

                    to:
                        last.domain,

                    start:
                        first.timestamp,

                    end:
                        last.timestamp
                });
            }

            data.bounceDetected = true;
        }
    }
}


// ============================================================
// MONITORAMENTO DAS REQUISIÇÕES
// ============================================================

browser.webRequest.onBeforeRequest.addListener(

    (details) => {

        if (details.tabId < 0) {
            return;
        }

        initializeTab(details.tabId);
        initializeTracking(details.tabId);

        analyzeBounceIdentifiers(
            details.url,
            details.tabId
        );

        const requestDomain =
            normalizeHostname(
                getHostname(details.url)
            );

        if (!requestDomain) {
            return;
        }


        // ====================================================
        // NAVEGAÇÃO PRINCIPAL
        // ====================================================

        if (details.type === "main_frame") {

            /*
             * Os dados de rede pertencem à página atual,
             * então são reiniciados.
             *
             * IMPORTANTE:
             * trackingData NÃO é apagado aqui, pois precisamos
             * preservar o histórico A -> B -> A.
             */
            tabData[details.tabId] = {
                pageDomain:
                    requestDomain,

                thirdPartyDomains:
                    {}
            };


            registerMainFrameNavigation(
                details.tabId,
                details.url
            );


            console.log(
                "[Privacy Guard] Página principal:",
                requestDomain
            );


            analyzeURLParameters(
                details.url,
                details.tabId
            );


            /*
             * O documento principal não é contado como
             * conexão third-party da própria página.
             */
            return;
        }


        // ====================================================
        // PARÂMETROS DA REQUISIÇÃO
        // ====================================================

        analyzeURLParameters(
            details.url,
            details.tabId
        );


        // ====================================================
        // DOMÍNIOS DE TERCEIRA PARTE
        // ====================================================

        const data =
            tabData[details.tabId];

        if (!data.pageDomain) {
            return;
        }


        const isThirdParty =
            requestDomain !==
                data.pageDomain &&

            !requestDomain.endsWith(
                "." + data.pageDomain
            );


        if (!isThirdParty) {
            return;
        }


        if (
            !data.thirdPartyDomains[
                requestDomain
            ]
        ) {
            data.thirdPartyDomains[
                requestDomain
            ] = {
                domain:
                    requestDomain,

                requests:
                    0,

                types:
                    {}
            };
        }


        const domainData =
            data.thirdPartyDomains[
                requestDomain
            ];


        domainData.requests++;


        if (
            !domainData.types[
                details.type
            ]
        ) {
            domainData.types[
                details.type
            ] = 0;
        }


        domainData.types[
            details.type
        ]++;
    },

    {
        urls: ["<all_urls>"]
    }
);


// ============================================================
// REDIRECIONAMENTOS HTTP
// ============================================================

browser.webRequest.onBeforeRedirect.addListener(

    (details) => {

        if (details.tabId < 0) {
            return;
        }


        initializeTracking(
            details.tabId
        );


        const fromDomain =
            normalizeHostname(
                getHostname(
                    details.url
                )
            );


        const toDomain =
            normalizeHostname(
                getHostname(
                    details.redirectUrl
                )
            );


        if (!fromDomain || !toDomain) {
            return;
        }


        /*
         * Não precisamos registrar redirect interno
         * para a heurística atual.
         */
        if (fromDomain === toDomain) {
            return;
        }


        const redirect = {
            from:
                fromDomain,

            to:
                toDomain,

            fromURL:
                details.url,

            toURL:
                details.redirectUrl,

            timestamp:
                Date.now()
        };


        trackingData[
            details.tabId
        ].redirects.push(
            redirect
        );


        /*
         * Um redirect HTTP do main_frame entre domínios
         * também é um indicador de possível bounce.
         *
         * O padrão A -> B -> A é analisado separadamente
         * pelo histórico de navegações.
         */
        if (
            details.type ===
            "main_frame"
        ) {
            trackingData[
                details.tabId
            ].bounceDetected = true;
        }


        analyzeURLParameters(
            details.redirectUrl,
            details.tabId
        );
    },

    {
        urls: ["<all_urls>"]
    }
);


// ============================================================
// COOKIES
// ============================================================

async function getCookiesForTab(tabId) {

    try {

        const tab =
            await browser.tabs.get(
                tabId
            );


        if (
            !tab.url ||
            !tab.url.startsWith("http")
        ) {
            return {
                total: 0,
                firstParty: 0,
                thirdParty: 0,
                session: 0,
                persistent: 0,
                cookies: []
            };
        }


        const pageHostname =
            normalizeHostname(
                getHostname(
                    tab.url
                )
            );


        // Cookies da URL principal
        const firstPartyCookies =
            await browser.cookies.getAll({
                url: tab.url
            });


        const data =
            tabData[tabId];


        const thirdPartyDomains =
            data
                ? Object.keys(
                    data.thirdPartyDomains
                )
                : [];


        /*
         * Evita contar exatamente o mesmo cookie
         * mais de uma vez.
         */
        const cookieMap =
            new Map();


        firstPartyCookies.forEach(
            (cookie) => {

                const key =
                    `${cookie.name}|` +
                    `${cookie.domain}|` +
                    `${cookie.path}`;


                cookieMap.set(
                    key,
                    cookie
                );
            }
        );


        // Cookies associados aos domínios externos
        for (
            const domain
            of thirdPartyDomains
        ) {
            try {

                const cookies =
                    await browser.cookies.getAll({
                        domain: domain
                    });


                cookies.forEach(
                    (cookie) => {

                        const key =
                            `${cookie.name}|` +
                            `${cookie.domain}|` +
                            `${cookie.path}`;


                        cookieMap.set(
                            key,
                            cookie
                        );
                    }
                );

            } catch (error) {

                console.warn(
                    "[Privacy Guard] Erro lendo cookies:",
                    domain,
                    error
                );
            }
        }


        const result = {
            total: 0,
            firstParty: 0,
            thirdParty: 0,
            session: 0,
            persistent: 0,
            cookies: []
        };


        for (
            const cookie
            of cookieMap.values()
        ) {

            const cookieDomain =
                normalizeHostname(
                    cookie.domain.replace(
                        /^\./,
                        ""
                    )
                );


            const isFirstParty =
                cookieDomain ===
                    pageHostname ||

                pageHostname.endsWith(
                    "." + cookieDomain
                ) ||

                cookieDomain.endsWith(
                    "." + pageHostname
                );


            const isSession =
                cookie.session === true;


            result.total++;


            if (isFirstParty) {
                result.firstParty++;
            } else {
                result.thirdParty++;
            }


            if (isSession) {
                result.session++;
            } else {
                result.persistent++;
            }


            result.cookies.push({
                name:
                    cookie.name,

                domain:
                    cookie.domain,

                firstParty:
                    isFirstParty,

                session:
                    isSession
            });
        }


        return result;


    } catch (error) {

        console.error(
            "[Privacy Guard] Erro ao coletar cookies:",
            error
        );


        return {
            total: 0,
            firstParty: 0,
            thirdParty: 0,
            session: 0,
            persistent: 0,
            cookies: []
        };
    }
}


// ============================================================
// COOKIE SYNC
// ============================================================

function detectCookieSync(tabId) {

    initializeTracking(
        tabId
    );


    const params =
        trackingData[
            tabId
        ].suspiciousParams;


    const events = [];


    /*
     * Procura o mesmo identificador sendo utilizado
     * em domínios diferentes.
     */
    for (
        let i = 0;
        i < params.length;
        i++
    ) {

        for (
            let j = i + 1;
            j < params.length;
            j++
        ) {

            const first =
                params[i];

            const second =
                params[j];


            if (
                first.domain !==
                    second.domain &&

                first.value ===
                    second.value &&

                first.value.length >= 8
            ) {
                events.push({
                    value:
                        first.value,

                    domainA:
                        first.domain,

                    domainB:
                        second.domain,

                    timestamp:
                        second.timestamp
                });
            }
        }
    }


    // Remove eventos duplicados
    const unique = [];

    const seen =
        new Set();


    for (
        const event
        of events
    ) {

        const domains = [
            event.domainA,
            event.domainB
        ].sort();


        const key =
            `${event.value}|` +
            `${domains[0]}|` +
            `${domains[1]}`;


        if (!seen.has(key)) {
            seen.add(key);
            unique.push(event);
        }
    }


    trackingData[
        tabId
    ].cookieSyncEvents =
        unique;


    return unique;
}


// ============================================================
// MENSAGENS DO POPUP
// ============================================================

browser.runtime.onMessage.addListener(

    (message) => {


        // ====================================================
        // DADOS DA ABA
        // ====================================================

        if (
            message.action ===
            "getTabData"
        ) {

            const data =
                tabData[
                    message.tabId
                ];


            return Promise.resolve(
                data || {
                    pageDomain:
                        null,

                    thirdPartyDomains:
                        {}
                }
            );
        }


        // ====================================================
        // COOKIES
        // ====================================================

        if (
            message.action ===
            "getCookies"
        ) {
            return getCookiesForTab(
                message.tabId
            );
        }


        // ====================================================
        // TRACKING
        // ====================================================

        if (
            message.action ===
            "getTrackingData"
        ) {

            initializeTracking(
                message.tabId
            );


            const cookieSync =
                detectCookieSync(
                    message.tabId
                );


            const data =
                trackingData[
                    message.tabId
                ];


            return Promise.resolve({

                bounceDetected:
                    data.bounceDetected,

                redirects:
                    data.redirects,

                suspiciousParams:
                    data.suspiciousParams,

                navigations:
                    data.navigations,

                bounceEvents:
                    data.bounceEvents,

                bounceIdentifiers:
                    data.bounceIdentifiers,

                cookieSyncDetected:
                    cookieSync.length > 0,

                cookieSyncEvents:
                    cookieSync
            });
        }
    }
);


// ============================================================
// LIMPEZA QUANDO A ABA É FECHADA
// ============================================================

browser.tabs.onRemoved.addListener(

    (tabId) => {

        delete tabData[
            tabId
        ];

        delete trackingData[
            tabId
        ];
    }
);