browser.tabs.query({
    active: true,
    currentWindow: true
}).then(async (tabs) => {

    const currentTab = tabs[0];

    if (!currentTab) {
        return;
    }

    // Mostra a URL atual.
    document.getElementById("page-url").textContent =
        currentTab.url || "URL indisponível";

    // Solicita os dados coletados pelo background.
    const data = await browser.runtime.sendMessage({
        action: "getTabData",
        tabId: currentTab.id
    });

    const domains = Object.values(
        data.thirdPartyDomains || {}
    );

    // Quantidade de domínios diferentes encontrados.
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

        return;
    }

    // Ordena pelos domínios com mais requisições.
    domains.sort(
        (a, b) => b.requests - a.requests
    );

    domains.forEach((domain) => {

        const item = document.createElement("li");

        item.textContent =
            `${domain.domain} (${domain.requests} requisições)`;

        list.appendChild(item);
    });
});