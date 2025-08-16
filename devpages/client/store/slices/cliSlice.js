// Action Types
const CLI_READY = 'cli/ready';
const COMMAND_EXECUTED = 'cli/commandExecuted';

const initialState = {
    isReady: false,
    lastCommand: null,
};

// Action Creators
export const cliReady = () => ({
    type: CLI_READY,
});

export const commandExecuted = (command) => ({
    type: COMMAND_EXECUTED,
    payload: command,
});

// Reducer
export const cliReducer = (state = initialState, action) => {
    switch (action.type) {
        case CLI_READY:
            return {
                ...state,
                isReady: true,
            };
        case COMMAND_EXECUTED:
            return {
                ...state,
                lastCommand: action.payload,
            };
        default:
            return state;
    }
};
