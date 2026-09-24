console.log("[Privacy Guard] Background iniciado.");

// Guarda os dados separadamente para cada aba.
const tabData = {};


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

    return hostname.replace(/^www\./, "");
}


function initializeTab(tabId) {
    if (!tabData[tabId]) {
        tabData[tabId] = {
            pageDomain: null,
            thirdPartyDomains: {}
        };
    }
}


browser.webRequest.onBeforeRequest.addListener(
    (details) => {

        if (details.tabId < 0) {
            return;
        }

        initializeTab(details.tabId);

        if (details.type === "main_frame") {

            const hostname = normalizeHostname(
                getHostname(details.url)
            );

            // Nova navegação = limpa dados anteriores da aba.
            tabData[details.tabId] = {
                pageDomain: hostname,
                thirdPartyDomains: {}
            };

            console.log(
                "[Privacy Guard] Página principal:",
                hostname
            );
        }
    },
    {
        urls: ["<all_urls>"]
    }
);

// Observa todas as requisições feitas pela página.

browser.webRequest.onBeforeRequest.addListener(
    (details) => {

        if (details.tabId < 0) {
            return;
        }

        initializeTab(details.tabId);

        const data = tabData[details.tabId];

        if (!data.pageDomain) {
            return;
        }

        const requestDomain = normalizeHostname(
            getHostname(details.url)
        );

        if (!requestDomain) {
            return;
        }

       
        const isThirdParty =
            requestDomain !== data.pageDomain &&
            !requestDomain.endsWith("." + data.pageDomain);

        if (!isThirdParty) {
            return;
        }

        if (!data.thirdPartyDomains[requestDomain]) {

            data.thirdPartyDomains[requestDomain] = {
                domain: requestDomain,
                requests: 0,
                types: {}
            };
        }

        const domainData =
            data.thirdPartyDomains[requestDomain];

        domainData.requests++;

        if (!domainData.types[details.type]) {
            domainData.types[details.type] = 0;
        }

        domainData.types[details.type]++;
    },
    {
        urls: ["<all_urls>"]
    }
);


browser.runtime.onMessage.addListener((message) => {

    if (message.action === "getTabData") {

        const data = tabData[message.tabId];

        return Promise.resolve(
            data || {
                pageDomain: null,
                thirdPartyDomains: {}
            }
        );
    }

    if (message.action === "getCookies") {
        return getCookiesForTab(message.tabId);
    }
});


browser.tabs.onRemoved.addListener((tabId) => {
    delete tabData[tabId];
});

//Coleta e classifica os cookies associados à aba.
 
async function getCookiesForTab(tabId) {
    try {
        const tab = await browser.tabs.get(tabId);

        if (!tab.url || !tab.url.startsWith("http")) {
            return {
                total: 0,
                firstParty: 0,
                thirdParty: 0,
                session: 0,
                persistent: 0,
                cookies: []
            };
        }

        const pageHostname = normalizeHostname(
            getHostname(tab.url)
        );

        // Cookies associados à URL principal.
         
        const firstPartyCookies =
            await browser.cookies.getAll({
                url: tab.url
            });

        // Verifica os domínios de terceira parte
        
        const data = tabData[tabId];

        const thirdPartyDomains = data
            ? Object.keys(data.thirdPartyDomains)
            : [];

        const cookieMap = new Map();

        // Adiciona os cookies da página principal.
        firstPartyCookies.forEach((cookie) => {

            const key =
                `${cookie.name}|${cookie.domain}|${cookie.path}`;

            cookieMap.set(key, cookie);
        });

        // Procura cookies associados aos domínios externos.
        for (const domain of thirdPartyDomains) {

            try {
                const cookies =
                    await browser.cookies.getAll({
                        domain: domain
                    });

                cookies.forEach((cookie) => {

                    const key =
                        `${cookie.name}|${cookie.domain}|${cookie.path}`;

                    cookieMap.set(key, cookie);
                });

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

        for (const cookie of cookieMap.values()) {

            const cookieDomain =
                normalizeHostname(
                    cookie.domain.replace(/^\./, "")
                );

            const isFirstParty =
                cookieDomain === pageHostname ||
                pageHostname.endsWith("." + cookieDomain) ||
                cookieDomain.endsWith("." + pageHostname);

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
                name: cookie.name,
                domain: cookie.domain,
                firstParty: isFirstParty,
                session: isSession
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