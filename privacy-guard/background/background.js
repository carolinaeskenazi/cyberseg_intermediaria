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
});


browser.tabs.onRemoved.addListener((tabId) => {
    delete tabData[tabId];
});