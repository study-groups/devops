/**
 * vox-main.js - Initialization and message handlers
 */
window.Vox = window.Vox || {};

Vox.initVoxData = function() {
    var state = Vox.state;
    state.voxData = {
        openai: {
            models: {
                'tts-1': ['shimmer', 'alloy', 'ash', 'coral', 'echo', 'fable', 'nova', 'onyx', 'sage'],
                'tts-1-hd': ['shimmer', 'alloy', 'ash', 'coral', 'echo', 'fable', 'nova', 'onyx', 'sage']
            }
        },
        coqui: {
            models: {
                'vits': [],
                'tacotron': [],
                'xtts': [
                    'Claribel_Dervla', 'Daisy_Studious', 'Gracie_Wise',
                    'Tammie_Ema', 'Alison_Dietlinde', 'Ana_Florence',
                    'Annmarie_Nele', 'Asya_Anara', 'Brenda_Stern',
                    'Gitta_Nikolina', 'Henriette_Usha', 'Sofia_Hellen',
                    'Tammy_Grit', 'Tanja_Adelina', 'Vjollca_Johnnie',
                    'Andrew_Chipper', 'Badr_Odhiambo', 'Dionisio_Schuyler',
                    'Royston_Min', 'Viktor_Eka'
                ]
            }
        }
    };

    fetch(Vox.API + '/status').then(function(r) { return r.json(); }).then(function(data) {
        if (data.voxData) state.voxData = data.voxData;
        if (data.count !== undefined) state.count = data.count;
        if (data.dbPath) state.dbPath = data.dbPath;
        Vox.updateStorageLine();
        Vox.loadDefaults();
    }).catch(function() {
        Vox.loadDefaults();
    });
};

Vox.init = function() {
    Vox.initDropdownListeners();
    Vox.initSaveDefaultBtn();
    Vox.initGenerate();
    Vox.initFilters();
    Vox.initTrash();
    Vox.initVoxData();
    Vox.loadDb();
};

// Init via Terrain.Iframe
Terrain.Iframe.init({
    name: 'vox',
    onReady: Vox.init
});

// Message handler
window.addEventListener('message', function(e) {
    var msg = e.data;
    if (!msg || typeof msg !== 'object') return;
    if (msg.type === 'env-change') {
        Vox.loadDb();
    }
});
