/* ============================================================
 * Beaver SqlWizard — toast.js
 * Notificações temporárias no canto inferior direito
 * ============================================================ */

window.SqlWizardToast = (function (window, document) {
    'use strict';

    var container = null;

    function ensureContainer() {
        if (container) return container;

        container = document.getElementById('toast-container');

        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            container.className = 'toast-container';
            document.body.appendChild(container);
        }

        return container;
    }

    /**
     * Mostra uma notificação.
     *
     * @param {string} message   Texto principal
     * @param {object} opts      { type: 'success'|'error'|'warning'|'info', title, duration }
     */
    function show(message, opts) {
        opts = opts || {};

        var type     = opts.type || 'info';
        var title    = opts.title || '';
        var duration = typeof opts.duration === 'number' ? opts.duration : 3000;

        var icons = {
            success: '✓',
            error:   '✗',
            warning: '!',
            info:    'ℹ'
        };

        var icon = icons[type] || '·';

        var el = document.createElement('div');
        el.className = 'toast is-' + type;

        el.innerHTML =
            '<span class="toast-icon">' + icon + '</span>' +
            '<div class="toast-body">' +
            (title ? '<div class="toast-title">' + escape(title) + '</div>' : '') +
            '<div class="toast-message">' + escape(message) + '</div>' +
            '</div>' +
            '<button class="toast-close" title="Fechar">×</button>';

        var box = ensureContainer();
        box.appendChild(el);

        var removed = false;

        function close() {
            if (removed) return;
            removed = true;

            el.classList.add('is-leaving');
            setTimeout(function () {
                if (el.parentNode) el.parentNode.removeChild(el);
            }, 160);
        }

        // Botão fechar
        el.querySelector('.toast-close').addEventListener('click', close);

        // Auto-fechar
        if (duration > 0) {
            setTimeout(close, duration);
        }

        return { close: close };
    }

    function escape(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    return {
        show:    show,
        success: function (msg, opts) { return show(msg, Object.assign({ type: 'success' }, opts || {})); },
        error:   function (msg, opts) { return show(msg, Object.assign({ type: 'error'   }, opts || {})); },
        warning: function (msg, opts) { return show(msg, Object.assign({ type: 'warning' }, opts || {})); },
        info:    function (msg, opts) { return show(msg, Object.assign({ type: 'info'    }, opts || {})); }
    };

})(window, document);