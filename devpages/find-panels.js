(function findPanels() {
    console.log("=== FINDING ALL FLOATING PANELS ===");

    var panels = document.querySelectorAll('.floating-panel');
    console.log("Found", panels.length, "panels with .floating-panel class");

    panels.forEach(function(panel) {
        var rect = panel.getBoundingClientRect();
        var computed = window.getComputedStyle(panel);

        console.log("\nPanel:", panel.id);
        console.log("  Style left:", panel.style.left);
        console.log("  Style top:", panel.style.top);
        console.log("  Style display:", panel.style.display);
        console.log("  Style visibility:", panel.style.visibility);
        console.log("  Style zIndex:", panel.style.zIndex);
        console.log("  Computed display:", computed.display);
        console.log("  Computed visibility:", computed.visibility);
        console.log("  Computed opacity:", computed.opacity);
        console.log("  Computed position:", computed.position);
        console.log("  BoundingClientRect:", {
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
            right: rect.right,
            bottom: rect.bottom
        });
        console.log("  Is visible in viewport:",
            rect.top < window.innerHeight &&
            rect.bottom > 0 &&
            rect.left < window.innerWidth &&
            rect.right > 0
        );
    });

    console.log("\n=== CHECKING BODY ===");
    console.log("Body children count:", document.body.children.length);
    console.log("Floating panels in body:",
        Array.from(document.body.children).filter(el => el.classList.contains('floating-panel')).length
    );
})();
