/**
 * client/store/connect.js
 * A simplified "connect" utility for vanilla JS components.
 * It subscribes a component to the Redux store and injects state and dispatch
 * functions as props. This approach mimics the behavior of `react-redux`.
 */
import { appStore } from '/client/appState.js';

/**
 * Performs a shallow comparison between two objects to see if they are equivalent.
 * @param {object} objA
 * @param {object} objB
 * @returns {boolean}
 */
export function shallowEqual(objA, objB) {
    if (objA === objB) return true;
    if (!objA || !objB) return false;

    const keysA = Object.keys(objA);
    const keysB = Object.keys(objB);

    if (keysA.length !== keysB.length) return false;

    for (let i = 0; i < keysA.length; i++) {
        if (!objB.hasOwnProperty(keysA[i]) || objA[keysA[i]] !== objB[keysA[i]]) {
            return false;
        }
    }
    return true;
}

/**
 * A simplified "connect" utility for vanilla JS components.
 * @param {Function} mapStateToProps - Maps store state to component props.
 * @param {Function} mapDispatchToProps - Maps dispatch to component props.
 * @returns {Function} A function that takes a component factory and returns
 * a "connected" component factory.
 */
export function connect(mapStateToProps, mapDispatchToProps) {
    return function(Component) {
        return function(targetElementId, props = {}) {
            const component = Component(targetElementId, props);
            let lastMappedState = null;

            const handleChange = () => {
                const state = appStore.getState();
                const mappedState = mapStateToProps(state);

                if (lastMappedState && shallowEqual(lastMappedState, mappedState)) {
                    return; // Don't re-render if state is the same
                }
                lastMappedState = mappedState;

                const mappedDispatch = mapDispatchToProps(appStore.dispatch);

                component.update({
                    ...props,
                    ...mappedState,
                    ...mappedDispatch,
                });
            };

            const unsubscribe = appStore.subscribe(handleChange);
            handleChange(); // Initial call to set state

            // Enhance the component's destroy method to include unsubscribing
            const originalDestroy = component.destroy;
            component.destroy = () => {
                unsubscribe();
                if (originalDestroy) {
                    originalDestroy();
                }
            };
            
            return component;
        };
    };
}
