window.SqlWizardContextMenu = (function (window, document) {
    'use strict';

    var menuEl = null;
    var current = null;

    var ITEMS = [
        { action: 'edit-table', icon: '✎', label: 'Editar tabela' },
        { action: 'add-column', icon: '+', label: 'Adicionar coluna' },
        { action: 'config-columns', icon: '⚙', label: 'Configurar colunas' },
        { type: 'sep' },
        { action: 'add-relation', icon: '↗', label: 'Adicionar relacao', disabled: true },
        { type: 'sep' },
        { action: 'duplicate-table', icon: '⧉', label: 'Duplicar tabela' },
        { action: 'export-sql', icon: '⤓', label: 'Exportar SQL' },
        { type: 'sep' },
        { action: 'delete-draft', icon: '⊗', label: 'Apagar draft', danger: true }
    ];

    function init() {
        menuEl = document.getElementById('context-menu');
        if (!menuEl) {
            console.warn('[ctx-menu] #context-menu nao encontrado');
            return;
        }

        // Fecha ao clicar fora
        document.addEventListener('pointerdown', function (e) {
            if (menuEl.hidden) return;
            if (!menuEl.contains(e.target)) {
                close();
            }
        });

        // Fecha com Escape
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && !menuEl.hidden) {
                close();
            }
        });

        // Fecha ao scroll/resize
        window.addEventListener('resize', close);
        window.addEventListener('scroll', close, true);
    }

    /**
     * Abre o menu nas coordenadas indicadas, para um contexto.
     *
     * @param {number} x   Coordenada X (clientX)
     * @param {number} y   Coordenada Y (clientY)
     * @param {object} ctx Contexto: { draftId, table, draft }
     */
    function open(x, y, ctx, items) {
        if (!menuEl) return;

        current = ctx || {};
        menuEl.innerHTML = renderItems(items || ITEMS);
        menuEl.hidden = false;

        // Binds
        menuEl.querySelectorAll('.context-menu-item').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var action = btn.getAttribute('data-action');
                var ctx = current;    // ← guardar ANTES de fechar
                close();
                dispatch(action, ctx);
            });
        });

        // Posicionar (com reposicionamento se sair do ecrã)
        position(x, y);
    }

    function close() {
        if (!menuEl) return;
        menuEl.hidden = true;
        current = null;
    }

    function renderItems(items) {
        return items.map(function (it) {
            if (it.type === 'sep') {
                return '<div class="context-menu-sep"></div>';
            }

            var cls = 'context-menu-item';
            if (it.danger) cls += ' is-danger';

            var dis = it.disabled ? ' disabled' : '';

            return '<button class="' + cls + '"' +
                ' data-action="' + it.action + '"' + dis + '>' +
                '<span class="context-menu-icon">' + it.icon + '</span>' +
                '<span class="context-menu-label">' + it.label + '</span>' +
                '</button>';
        }).join('');
    }

    function position(x, y) {
        // Primeiro põe no sítio para medir
        menuEl.style.left = x + 'px';
        menuEl.style.top = y + 'px';

        // Mede
        var rect = menuEl.getBoundingClientRect();
        var vw = window.innerWidth;
        var vh = window.innerHeight;
        var margin = 8;

        var left = x;
        var top = y;

        // Se sair pela direita, encosta à esquerda do cursor
        if (left + rect.width > vw - margin) {
            left = Math.max(margin, vw - rect.width - margin);
        }

        // Se sair por baixo, encosta por cima
        if (top + rect.height > vh - margin) {
            top = Math.max(margin, vh - rect.height - margin);
        }

        menuEl.style.left = left + 'px';
        menuEl.style.top = top + 'px';
    }

    function dispatch(action, ctx) {
        window.dispatchEvent(new CustomEvent('sqlwizard:context-action', {
            detail: { action: action, ctx: ctx }
        }));
    }

    return {
        init: init,
        open: open,
        close: close
    };

})(window, document);
