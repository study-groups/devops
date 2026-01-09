(function() {
    console.log("=== APPLYING DRAG-OUT-TO-FLOAT FIX ===");

    var sidebarManager = window.APP && window.APP.services && window.APP.services.sidebarManager;
    if (!sidebarManager) {
        console.error("SidebarManager not found");
        return;
    }

    var panelsContainer = document.querySelector(".panels-container");
    if (!panelsContainer) {
        console.error("No .panels-container found");
        return;
    }

    console.log("Found panels container, setting up drag-out-to-float...");

    var dragState = null;

    // Handle mousedown on panel headers
    panelsContainer.addEventListener("mousedown", function(e) {
        var target = e.target;
        var panelHeader = target.closest(".panel-header");
        var controlBtn = target.closest(".panel-control-btn");

        if (controlBtn || !panelHeader) return;

        var panelItem = panelHeader.closest(".panel-item");
        if (!panelItem) return;

        var panelId = panelItem.dataset.panelId;
        var sidebar = document.querySelector(".sidebar");
        if (!sidebar) sidebar = document.querySelector(".sidebar-content");
        var sidebarRect = sidebar ? sidebar.getBoundingClientRect() : {right: 300};

        console.log("Mouse down on panel header:", panelId);

        dragState = {
            panelId: panelId,
            panelItem: panelItem,
            startX: e.clientX,
            startY: e.clientY,
            isDragging: false,
            sidebarRect: sidebarRect,
            dragClone: null
        };
    }, true);

    // Handle mousemove
    document.addEventListener("mousemove", function(e) {
        if (!dragState) return;

        var deltaX = e.clientX - dragState.startX;
        var deltaY = e.clientY - dragState.startY;
        var distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

        if (!dragState.isDragging && distance > 10) {
            dragState.isDragging = true;
            console.log("Started dragging panel:", dragState.panelId);

            var clone = dragState.panelItem.cloneNode(true);
            clone.style.position = "fixed";
            clone.style.width = dragState.panelItem.offsetWidth + "px";
            clone.style.pointerEvents = "none";
            clone.style.opacity = "0.8";
            clone.style.zIndex = "10000";
            clone.style.left = e.clientX + "px";
            clone.style.top = e.clientY + "px";
            document.body.appendChild(clone);
            dragState.dragClone = clone;

            dragState.panelItem.style.opacity = "0.3";
        }

        if (dragState.isDragging && dragState.dragClone) {
            dragState.dragClone.style.left = e.clientX + "px";
            dragState.dragClone.style.top = e.clientY + "px";
        }
    }, true);

    // Handle mouseup
    document.addEventListener("mouseup", function(e) {
        if (!dragState) return;

        var wasDragging = dragState.isDragging;
        var droppedOutsideSidebar = e.clientX > dragState.sidebarRect.right + 50;

        console.log("Mouse up - wasDragging:", wasDragging, "droppedOutside:", droppedOutsideSidebar, "clientX:", e.clientX, "sidebarRight:", dragState.sidebarRect.right);

        if (dragState.dragClone) {
            dragState.dragClone.remove();
        }

        if (dragState.panelItem) {
            dragState.panelItem.style.opacity = "1";
        }

        if (wasDragging && droppedOutsideSidebar) {
            console.log("Converting panel to floating:", dragState.panelId);
            sidebarManager.createFloatingPanel(dragState.panelId);
        }

        dragState = null;
    }, true);

    console.log("=== DRAG-OUT-TO-FLOAT FIX APPLIED ===");
    console.log("Now try dragging a panel header to the right (>50px past sidebar edge)");
})();
