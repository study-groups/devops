// client/thunks/fileThunks.js
import { fileActions } from '../store/reducers/fileReducer.js';

export const fileThunks = {
    loadFileContent: (pathname) => async (dispatch, getState) => {
        try {
            dispatch(fileActions.loadFilePending(pathname));
            const response = await fetch(`/api/files/content?pathname=${pathname}`);
            if (!response.ok) {
                throw new Error(`Failed to fetch file content: ${response.statusText}`);
            }
            const data = await response.json();
            dispatch(fileActions.loadFileSuccess({ pathname, content: data.content }));
        } catch (error) {
            dispatch(fileActions.loadFileFailure(error.toString()));
        }
    },

    saveFile: () => async (dispatch, getState) => {
        const { currentFile } = getState().file;
        if (!currentFile.isDirty) {
            return;
        }
        try {
            dispatch(fileActions.saveFilePending());
            const response = await fetch('/api/files/content', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    pathname: currentFile.pathname,
                    content: currentFile.content
                })
            });
            if (!response.ok) {
                throw new Error(`Failed to save file: ${response.statusText}`);
            }
            const data = await response.json();
            // Assuming the save is successful, we should probably re-set the original content
            // to prevent the file from being marked as dirty again.
            dispatch(fileActions.loadFileSuccess({ pathname: currentFile.pathname, content: currentFile.content }));
        } catch (error) {
            // We should probably have a saveFileFailure action as well.
            console.error(error);
        }
    }
};
