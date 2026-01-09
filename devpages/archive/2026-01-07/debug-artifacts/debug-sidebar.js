(function() {
    console.log("=== SIDEBAR DEBUG DIAGNOSTIC ===");
    var sidebarManager = window.APP && window.APP.services && window.APP.services.sidebarManager;
    console.log("1. SidebarManager exists:", !!sidebarManager);
    if (!sidebarManager) {
        console.error("SidebarManager not found");
        return;
    }
    console.log("2. Panel configs loaded:", !!sidebarManager.panelConfigs);
    console.log("   Available panels:", sidebarManager.panelConfigs ? Object.keys(sidebarManager.panelConfigs) : "none");
    var state = window.appStore && window.appStore.getState();
    console.log("3. Redux state:");
    console.log("   - Sidebar panels:", state && state.panels && state.panels.sidebarPanels);
    console.log("   - Floating panels:", state && state.panels && state.panels.panels);
    var sidebar = document.querySelector(".sidebar-content");
    var panelsList = document.querySelector("#panels-list");
    var panelsContainer = document.querySelector(".panels-container");
    console.log("4. DOM structure:");
    console.log("   - Sidebar content:", !!sidebar);
    console.log("   - Panels list:", !!panelsList);
    console.log("   - Panels container:", !!panelsContainer);
    if (panelsContainer) {
        var panelItems = panelsContainer.querySelectorAll(".panel-item");
        console.log("   - Panel items found:", panelItems.length);
        panelItems.forEach(function(item, i) {
            var panelId = item.dataset.panelId;
            var header = item.querySelector(".panel-header");
            var floatBtn = item.querySelector('[data-action="float-panel"]');
            console.log("   - Panel " + i + ': id="' + panelId + '", hasHeader=' + !!header + ", hasFloatBtn=" + !!floatBtn);
        });
    }
    console.log("5. Testing float button behavior:");
    var firstFloatBtn = document.querySelector('[data-action="float-panel"]');
    if (firstFloatBtn) {
        console.log("   Found float button:", firstFloatBtn);
        console.log("   Button panelId:", firstFloatBtn.dataset.panelId);
        console.log("   Button is visible:", firstFloatBtn.offsetParent !== null);
        var testListener = function(e) {
            console.log("   CLICK DETECTED on float button!", e.target.dataset.panelId);
            e.stopPropagation();
            e.preventDefault();
        };
        firstFloatBtn.addEventListener("click", testListener, true);
        console.log("   Added test listener. Try clicking the float button now.");
        setTimeout(function() {
            firstFloatBtn.removeEventListener("click", testListener, true);
            console.log("   Test listener removed.");
        }, 30000);
    } else {
        console.log("   No float button found in DOM");
    }
    console.log("6. SidebarManager methods:");
    console.log("   - createFloatingPanel exists:", typeof sidebarManager.createFloatingPanel);
    console.log("   - togglePanel exists:", typeof sidebarManager.togglePanel);
    console.log("   - setupEventListeners exists:", typeof sidebarManager.setupEventListeners);
    console.log("=== END DIAGNOSTIC ===");
    console.log("Now try clicking the float button on a panel.");
    return {
        sidebarManager: sidebarManager,
        state: state,
        testFloat: function(panelId) {
            console.log("Manually calling createFloatingPanel('" + panelId + "')");
            sidebarManager.createFloatingPanel(panelId);
        }
    };
})();
