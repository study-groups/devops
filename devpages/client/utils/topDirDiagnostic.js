/**
 * Top Directory Diagnostic Utility
 * Simple function to debug why topLevelDirs is empty
 * v2: topLevelDirs are now in path slice, not file slice
 */
import { appStore } from '/client/appState.js';
import { storageService } from '../services/storageService.js';

export function diagnoseTopDirIssue() {
    console.log('🔍 TOP DIR DIAGNOSTIC - Starting analysis...');

    // Check if store is available
    if (!appStore) {
        console.log('❌ appStore is not available');
        return;
    }

    try {
        const state = appStore.getState();
        console.log('✅ Store state retrieved successfully');
        console.log('📊 Available state slices:', Object.keys(state));

        // Check path state (v2: topLevelDirs are here)
        const pathState = state.path || {};
        console.log('🛤️ Path state (v2):', {
            keys: Object.keys(pathState),
            'current.pathname': pathState.current?.pathname,
            'current.type': pathState.current?.type,
            isDirectorySelected: pathState.current?.type === 'directory',
            status: pathState.status,
            currentListing: pathState.currentListing ? 'present' : 'null',
            topLevelDirs: pathState.topLevelDirs,
            topLevelDirsLength: pathState.topLevelDirs?.length || 0,
            topLevelDirsType: typeof pathState.topLevelDirs
        });

        // Check if topLevelDirs is actually empty or undefined
        if (!pathState.topLevelDirs) {
            console.log('❌ topLevelDirs is', pathState.topLevelDirs);
        } else if (Array.isArray(pathState.topLevelDirs)) {
            if (pathState.topLevelDirs.length === 0) {
                console.log('❌ topLevelDirs is empty array []');
            } else {
                console.log('✅ topLevelDirs has items:', pathState.topLevelDirs);
            }
        } else {
            console.log('❌ topLevelDirs is not an array:', typeof pathState.topLevelDirs);
        }

        // Check file state
        const fileState = state.file || {};
        console.log('📁 File state:', {
            keys: Object.keys(fileState),
            isInitialized: fileState.isInitialized,
            isLoading: fileState.isLoading,
            'currentFile.pathname': fileState.currentFile?.pathname,
            hasContent: !!fileState.content
        });

        // Check auth state
        const authState = state.auth || {};
        console.log('🔐 Auth state:', {
            isAuthenticated: authState.isAuthenticated,
            isInitializing: authState.isInitializing,
            authChecked: authState.authChecked,
            user: authState.user?.username || 'none'
        });

        // Check if bootloader completed
        console.log('🚀 Bootloader info:', {
            hasWorkspace: typeof window.APP.workspace !== 'undefined',
            hasEventBus: typeof window.APP.eventBus !== 'undefined',
            eventBusType: typeof window.APP.eventBus
        });

        // Check localStorage for any persisted state
        try {
            const lastOpened = storageService.getItem('last_opened_file');
            console.log('💾 LocalStorage last opened file:', lastOpened);
        } catch (e) {
            console.log('❌ Could not read localStorage:', e.message);
        }

        // Check if pathThunks are available
        import('/client/store/slices/pathSlice.js').then(module => {
            console.log('📦 PathThunks module available:', !!module.pathThunks);
            console.log('📦 Available thunks:', Object.keys(module.pathThunks || {}));
        }).catch(error => {
            console.log('❌ PathThunks module not available:', error.message);
        });

        // Provide recommendations
        console.log('🔧 RECOMMENDATIONS:');
        if (!authState.isAuthenticated) {
            console.log('   - User is not authenticated - topDirs won\'t load');
        }
        if (pathState.status === 'idle' || !pathState.topLevelDirs?.length) {
            console.log('   - Path state not initialized - may need to call pathThunks.fetchListingByPath({ pathname: "", isDirectory: true })');
        }
        if (pathState.status === 'loading') {
            console.log('   - Path state is currently loading - wait for completion');
        }
        if (authState.isAuthenticated && pathState.status === 'succeeded' && !pathState.topLevelDirs?.length) {
            console.log('   - Auth is good, path state loaded, but no topDirs - there may be a server issue');
        }

    } catch (error) {
        console.log('❌ Error accessing store state:', error.message);
        console.log('❌ Error stack:', error.stack);
    }

    console.log('🔍 TOP DIR DIAGNOSTIC - Analysis complete');
}
