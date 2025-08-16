/**
 * Top Directory Diagnostic Utility
 * Simple function to debug why availableTopLevelDirs is empty
 */
import { appStore } from '/client/appState.js';
import { storageService } from '/client/services/storageService.js';

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
        
        // Check file state specifically
        const fileState = state.file || {};
        console.log('📁 File state structure:', {
            keys: Object.keys(fileState),
            isInitialized: fileState.isInitialized,
            isLoading: fileState.isLoading,
            availableTopLevelDirs: fileState.availableTopLevelDirs,
            availableTopLevelDirsLength: fileState.availableTopLevelDirs?.length || 0,
            availableTopLevelDirsType: typeof fileState.availableTopLevelDirs,
            currentPathname: fileState.currentPathname,
            isDirectorySelected: fileState.isDirectorySelected
        });
        
        // Check if availableTopLevelDirs is actually empty or undefined
        if (!fileState.availableTopLevelDirs) {
            console.log('❌ availableTopLevelDirs is', fileState.availableTopLevelDirs);
        } else if (Array.isArray(fileState.availableTopLevelDirs)) {
            if (fileState.availableTopLevelDirs.length === 0) {
                console.log('❌ availableTopLevelDirs is empty array []');
            } else {
                console.log('✅ availableTopLevelDirs has items:', fileState.availableTopLevelDirs);
            }
        } else {
            console.log('❌ availableTopLevelDirs is not an array:', typeof fileState.availableTopLevelDirs);
        }
        
        // Check auth state
        const authState = state.auth || {};
        console.log('🔐 Auth state:', {
            isAuthenticated: authState.isAuthenticated,
            isInitializing: authState.isInitializing,
            authChecked: authState.authChecked,
            user: authState.user?.username || 'none'
        });
        
        // Check path state
        const pathState = state.path || {};
        console.log('🛤️ Path state:', {
            currentPathname: pathState.currentPathname,
            isDirectorySelected: pathState.isDirectorySelected,
            status: pathState.status,
            currentListing: pathState.currentListing ? 'present' : 'null'
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
        
        // Check if fileThunks are available
        import('/client/store/slices/fileSlice.js').then(module => {
            console.log('📦 FileThunks module available:', !!module.fileThunks);
            console.log('📦 Available thunks:', Object.keys(module.fileThunks || {}));
        }).catch(error => {
            console.log('❌ FileThunks module not available:', error.message);
        });
        
        // Provide recommendations
        console.log('🔧 RECOMMENDATIONS:');
        if (!authState.isAuthenticated) {
            console.log('   - User is not authenticated - topDirs won\'t load');
        }
        if (!fileState.isInitialized) {
            console.log('   - File state not initialized - may need to call fileThunks.loadTopLevelDirectories()');
        }
        if (fileState.isLoading) {
            console.log('   - File state is currently loading - wait for completion');
        }
        if (authState.isAuthenticated && fileState.isInitialized && !fileState.availableTopLevelDirs?.length) {
            console.log('   - Auth is good, file state initialized, but no topDirs - there may be a server issue');
        }
        
    } catch (error) {
        console.log('❌ Error accessing store state:', error.message);
        console.log('❌ Error stack:', error.stack);
    }
    
    console.log('🔍 TOP DIR DIAGNOSTIC - Analysis complete');
} 