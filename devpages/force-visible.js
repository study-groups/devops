(function() {
    var panel = document.getElementById('floating-panel-system-diagnostics');
    if (!panel) {
        console.log("Panel doesn't exist!");
        return;
    }

    var computed = window.getComputedStyle(panel);
    console.log("All computed styles that might hide it:");
    console.log("display:", computed.display);
    console.log("visibility:", computed.visibility);
    console.log("opacity:", computed.opacity);
    console.log("clip:", computed.clip);
    console.log("clip-path:", computed.clipPath);
    console.log("overflow:", computed.overflow);
    console.log("transform:", computed.transform);
    console.log("width:", computed.width);
    console.log("height:", computed.height);
    console.log("z-index:", computed.zIndex);

    panel.style.display = 'block';
    panel.style.visibility = 'visible';
    panel.style.opacity = '1';
    panel.style.position = 'fixed';
    panel.style.top = '50px';
    panel.style.left = '50px';
    panel.style.width = '600px';
    panel.style.height = '400px';
    panel.style.zIndex = '9999999';
    panel.style.background = 'red';
    panel.style.border = '10px solid yellow';

    console.log("Forced all styles. If you still cannot see a red box at top-left, something else is wrong.");

    return panel;
})();
