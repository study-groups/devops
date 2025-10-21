(function() {
    console.log("=== DEBUG PANEL STATE ===");

    var state = window.appStore && window.appStore.getState();
    if (!state) {
        console.error("No appStore found");
        return;
    }

    console.log("Redux panels state:", state.panels.panels);
    console.log("Redux sidebarPanels state:", state.panels.sidebarPanels);

    var panels = state.panels.panels || {};
    console.log("\nPanel details:");
    Object.keys(panels).forEach(function(panelId) {
        var p = panels[panelId];
        console.log("Panel:", panelId);
        console.log("  - isFloating:", p.isFloating);
        console.log("  - isDocked:", p.isDocked);
        console.log("  - visible:", p.visible);
        console.log("  - mounted:", p.mounted);
    });

    return { state: state };
})();
