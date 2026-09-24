browser.tabs.query({
    active: true,
    currentWindow: true
}).then((tabs) => {

    const currentTab = tabs[0];

    document.getElementById("page-url").textContent =
        currentTab.url || "URL indisponível";

});