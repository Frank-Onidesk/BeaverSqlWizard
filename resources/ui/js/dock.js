/* beaver-framework/plugins/sqlwizard/resources/ui/js/dock.js */

window.SqlWizardDock = (function (window, document, $) {
    'use strict';

    var STORAGE_KEY = 'sqlwizard:layout';
    var layout = null;



    var DEFAULT_CONFIG = {
        settings: {
            hasHeaders: true,
            constrainDragToContainer: false,
            reorderEnabled: true,
            showPopoutIcon: true,
            showMaximiseIcon: true,
            showCloseIcon: false
        },
        dimensions: {
            headerHeight: 28,
            borderWidth: 4
        },
        content: [{
            type: 'column',
            content: [
                {
                    type: 'row',
                    height: 70,
                    content: [
                        { type: 'component', componentName: 'explorer', title: '📁 Explorer', width: 20, isClosable: false },
                        { type: 'component', componentName: 'canvas', title: '▦ Canvas', width: 55, isClosable: false },
                        { type: 'component', componentName: 'inspector', title: '⚙ Inspector', width: 25, isClosable: false }
                    ]
                },
                {
                    type: 'component',
                    componentName: 'bottom',
                    title: '▤ SQL',
                    height: 30,
                    isClosable: false
                }
            ]
        }]
    };

    function init() {
        var container = document.getElementById('dock');
        if (!container) {
            console.warn('[dock] #dock nao encontrado');
            return;
        }

        var saved = loadLayout();
        var config = saved || DEFAULT_CONFIG;

        if (saved) {
            console.log('[dock] layout restaurado');
        }

        layout = new GoldenLayout(config, container);

        registerComponents();

        layout.init();

        // Só ligar o saveLayout DEPOIS do init estar completo
        setTimeout(function () {
            layout.on('stateChanged', saveLayout);
        }, 500);

        console.log('[dock] inicializado');
    }

    function registerComponents() {
        // Explorer
        layout.registerComponent('explorer', function (container) {
            container.getElement().html(
                '<aside class="panel-left">' +
                '  <div class="explorer-toggle">' +
                '    <button class="explorer-tab is-active" data-view="drafts">' +
                '      <span class="explorer-tab-icon">📁</span>' +
                '      <span>Drafts</span>' +
                '    </button>' +
                '    <button class="explorer-tab" data-view="connections">' +
                '      <span class="explorer-tab-icon">🔌</span>' +
                '      <span>Ligações</span>' +
                '    </button>' +
                '    <button class="explorer-tab" data-view="local">' +
                '      <span class="explorer-tab-icon">💾</span>' +
                '      <span>Local</span>' +
                '    </button>' +
                '  </div>' +
                '  </div>' +
                '  <div class="panel-body" id="explorer"></div>' +
                '</aside>'
            );

            setTimeout(function () {
                if (window.SqlWizardExplorer) {
                    window.SqlWizardExplorer.init();
                }
            }, 0);
        });

        // Canvas
        layout.registerComponent('canvas', function (container) {
            container.getElement().html(
                '<main class="canvas" id="canvas"></main>'
            );

            setTimeout(function () {
                if (window.SqlWizardCanvas) {
                    window.SqlWizardCanvas.init();
                }
            }, 0);
        });

        // Inspector
        layout.registerComponent('inspector', function (container) {
            container.getElement().html(
                '<aside class="panel-right">' +
                '  <div class="panel-body" id="inspector">' +
                '    <p class="is-muted">Seleciona uma tabela</p>' +
                '  </div>' +
                '</aside>'
            );

            setTimeout(function () {
                if (window.SqlWizardInspector) {
                    window.SqlWizardInspector.init();
                }
            }, 0);
        });
        layout.registerComponent('bottom', function (container) {
            var el = container.getElement();

            el.html(
                '<div class="bottom-panel">' +
                '  <div class="bottom-tabs">' +
                '    <button class="bottom-tab is-active" data-tab="sql">SQL</button>' +
                '    <button class="bottom-tab" data-tab="schema">Schema</button>' +
                '    <button class="bottom-tab" data-tab="dados">Dados</button>' +
                '    <button class="bottom-tab" data-tab="log">Log</button>' +
                '  </div>' +
                '  <div class="bottom-body" id="bottom-body">' +
                '    <pre class="bottom-pre" id="bottom-pre">-- SQL vai aparecer aqui</pre>' +
                '  </div>' +
                '</div>'
            );
        });


    }

    var saveTimer = null;

    function saveLayout() {
        if (!layout) return;

        // Debounce: só guarda 300ms depois da última mudança
        if (saveTimer) {
            clearTimeout(saveTimer);
        }

        saveTimer = setTimeout(function () {
            try {
                var json = layout.toConfig();
                localStorage.setItem(STORAGE_KEY, JSON.stringify(json));
            } catch (e) {
                console.warn('[dock] nao consegui guardar layout:', e);
            }
        }, 300);
    }

    function loadLayout() {
        try {
            var raw = localStorage.getItem(STORAGE_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch (e) {
            return null;
        }
    }

    function reset() {
        try {
            localStorage.removeItem(STORAGE_KEY);
        } catch (e) { }

        window.location.reload();
    }

    return {
        init: init,
        reset: reset
    };

})(window, document, window.jQuery);
