import { chromium } from 'playwright';

(async () => {
    const url = 'https://www.pixeljamarcade.com/play/grid-ranger';
    const elementSelector = 'div';

    const browser = await chromium.launch();
    const page = await browser.newPage();

    await page.goto(url);

    // Extract DOM with metadata
    const domTree = await page.evaluate((selector) => {
        const getStyles = (element) => {
            const computed = window.getComputedStyle(element);
            const defaultStyles = document.createElement(element.tagName).style;
            const styles = {};

            for (let prop of computed) {
                const value = computed.getPropertyValue(prop);
                if (
                    !prop.startsWith('animation') &&
                    !prop.startsWith('-webkit-') &&
                    !prop.startsWith('view-timeline-') &&
                    !prop.startsWith('caret-color') &&
                    !prop.startsWith('user-select') &&
                    !prop.startsWith('outline') &&
                    !prop.startsWith('pointer-events') &&
                    !prop.startsWith('list-style') &&
                    !prop.startsWith('font-variant') &&
                    !prop.startsWith('border') &&
                    !prop.startsWith('outline') &&
                    !prop.startsWith('math') &&
                    !prop.startsWith('transition') &&
                    value !== 'auto' &&
                    value !== 'none' &&
                    value !== defaultStyles.getPropertyValue(prop)
                ) {
                    styles[prop] = value;
                }
            }

            return {
                tagName: element.tagName,
                id: element.id,
                classList: [...element.classList],
                styles,
            };
        };

        const getContext = (element) => {
            const context = [];
            let currentElement = element.parentElement;
            while (currentElement) {
                context.push({
                    tagName: currentElement.tagName,
                    id: currentElement.id,
                    classList: [...currentElement.classList],
                });
                currentElement = currentElement.parentElement;
            }
            return context.reverse(); // From root to direct parent
        };

        const getXPath = (element) => {
            if (element.id) {
                return `//*[@id="${element.id}"]`;
            }
            const parts = [];
            while (element && element.nodeType === Node.ELEMENT_NODE) {
                let index = 0;
                let sibling = element.previousSibling;
                while (sibling) {
                    if (sibling.nodeType === Node.ELEMENT_NODE && sibling.nodeName === element.nodeName) {
                        index++;
                    }
                    sibling = sibling.previousSibling;
                }
                const tagName = element.nodeName.toLowerCase();
                const pathIndex = (index ? `[${index + 1}]` : '');
                parts.unshift(`${tagName}${pathIndex}`);
                element = element.parentNode;
            }
            return parts.length ? `/${parts.join('/')}` : null;
        };

        const getSingleNode = (element) => {
            const styles = getStyles(element);
            const context = getContext(element);
            const xpath = getXPath(element);
            return { ...styles, context, xpath };
        };

        const root = document.querySelector(selector);
        if (!root) {
            console.warn(`Element not found for selector: ${selector}`);
            return null;
        }
        return getSingleNode(root);
    }, elementSelector);

    if (domTree) {
        const output = {
            url: url,
            selector: elementSelector,
            ...domTree
        };
        console.log(JSON.stringify(output, null, 2));
    } else {
        console.error('Failed to extract DOM tree. Please check your selector.');
    }

    await browser.close();
})();
