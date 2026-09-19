window.SqlWizardModal = (function (window, document) {
    'use strict';

    var backdrop = null;
    var modalEl = null;
    var currentOnConfirm = null;

    function init() {
        backdrop = document.getElementById('modal-backdrop');
        modalEl = document.getElementById('modal');

        if (!backdrop || !modalEl) {
            console.warn('[modal] #modal-backdrop ou #modal nao encontrados');
            return;
        }

        backdrop.addEventListener('click', function (e) {
            if (e.target === backdrop) close();
        });

        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && !backdrop.hidden) close();
        });
    }

    function confirm(opts) {
        if (!backdrop || !modalEl) return;

        opts = opts || {};
        var title = opts.title || 'Confirmar';
        var body = opts.body || '';
        var confirmLbl = opts.confirmLabel || 'Confirmar';
        var cancelLbl = opts.cancelLabel || 'Cancelar';
        var danger = !!opts.danger;

        currentOnConfirm = opts.onConfirm || null;

        var icon = danger ? '⚠' : '?';
        var headerCls = danger ? 'modal-header is-danger' : 'modal-header';
        var btnCls = danger ? 'btn is-danger' : 'btn is-primary';

        modalEl.innerHTML =
            '<div class="' + headerCls + '">' +
            '  <span class="modal-icon">' + icon + '</span>' +
            '  <span>' + escape(title) + '</span>' +
            '</div>' +
            '<div class="modal-body">' + body + '</div>' +
            '<div class="modal-footer">' +
            '  <button class="btn" data-role="cancel">' + escape(cancelLbl) + '</button>' +
            '  <button class="' + btnCls + '" data-role="confirm">' + escape(confirmLbl) + '</button>' +
            '</div>';

        modalEl.querySelector('[data-role="cancel"]').addEventListener('click', close);
        modalEl.querySelector('[data-role="confirm"]').addEventListener('click', function () {
            var cb = currentOnConfirm;
            close();
            if (typeof cb === 'function') cb();
        });

        backdrop.hidden = false;

        setTimeout(function () {
            var b = modalEl.querySelector('[data-role="cancel"]');
            if (b) b.focus();
        }, 10);
    }

    function close() {
        if (!backdrop) return;
        backdrop.hidden = true;
        currentOnConfirm = null;
    }

    function escape(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function prompt(opts) {
        if (!backdrop || !modalEl) return;

        opts = opts || {};
        var title = opts.title || 'Introduzir valor';
        var body = opts.body || '';
        var label = opts.label || '';
        var defaultValue = opts.defaultValue || '';
        var placeholder = opts.placeholder || '';
        var confirmLbl = opts.confirmLabel || 'Confirmar';
        var cancelLbl = opts.cancelLabel || 'Cancelar';
        var danger = !!opts.danger;

        currentOnConfirm = opts.onConfirm || null;

        var icon = danger ? '⚠' : '✎';
        var headerCls = danger ? 'modal-header is-danger' : 'modal-header';
        var btnCls = danger ? 'btn is-danger' : 'btn is-primary';

        var inputId = 'modal-input-' + Date.now();

        modalEl.innerHTML =
            '<div class="' + headerCls + '">' +
            '  <span class="modal-icon">' + icon + '</span>' +
            '  <span>' + escape(title) + '</span>' +
            '</div>' +
            '<div class="modal-body">' +
            (body ? body : '') +
            (label ? '<p><label for="' + inputId + '">' + escape(label) + '</label></p>' : '') +
            '  <input type="text" id="' + inputId + '" class="modal-input"' +
            '         value="' + escape(defaultValue) + '"' +
            '         placeholder="' + escape(placeholder) + '">' +
            '</div>' +
            '<div class="modal-footer">' +
            '  <button class="btn" data-role="cancel">' + escape(cancelLbl) + '</button>' +
            '  <button class="' + btnCls + '" data-role="confirm">' + escape(confirmLbl) + '</button>' +
            '</div>';

        var inputEl = modalEl.querySelector('#' + inputId);

        function doConfirm() {
            var value = inputEl ? inputEl.value.trim() : '';
            var cb = currentOnConfirm;
            close();
            if (typeof cb === 'function') cb(value);
        }

        modalEl.querySelector('[data-role="cancel"]').addEventListener('click', close);
        modalEl.querySelector('[data-role="confirm"]').addEventListener('click', doConfirm);

        if (inputEl) {
            inputEl.addEventListener('keydown', function (e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    doConfirm();
                }
            });
        }

        backdrop.hidden = false;

        setTimeout(function () {
            if (inputEl) {
                inputEl.focus();
                inputEl.select();
            }
        }, 10);
    }

    function form(opts) {
        if (!backdrop || !modalEl) return;

        opts = opts || {};
        var title = opts.title || 'Formulário';
        var body = opts.body || '';
        var fields = opts.fields || [];
        var confirmLbl = opts.confirmLabel || 'Guardar';
        var cancelLbl = opts.cancelLabel || 'Cancelar';
        var danger = !!opts.danger;
        var extraButtons = opts.extraButtons || [];

        currentOnConfirm = opts.onConfirm || null;

        var icon = danger ? '⚠' : '✎';
        var headerCls = danger ? 'modal-header is-danger' : 'modal-header';
        var btnCls = danger ? 'btn is-danger' : 'btn is-primary';

        var fieldsHtml = fields.map(function (f) {
            var id = 'modal-field-' + f.name;
            var type = f.type || 'text';
            var value = f.value != null ? String(f.value) : '';
            var placeholder = f.placeholder || '';
            var required = f.required ? ' required' : '';
            var autocomplete = f.autocomplete || 'off';

            var input;
            if (type === 'select') {
                var optionsHtml = (f.options || []).map(function (o) {
                    var sel = String(o.value) === value ? ' selected' : '';
                    return '<option value="' + escape(o.value) + '"' + sel + '>' + escape(o.label) + '</option>';
                }).join('');
                input = '<select id="' + id + '" class="modal-input" data-name="' + f.name + '">' + optionsHtml + '</select>';
            } else {
                input = '<input type="' + type + '" id="' + id + '" class="modal-input"' +
                    ' data-name="' + escape(f.name) + '"' +
                    ' value="' + escape(value) + '"' +
                    ' placeholder="' + escape(placeholder) + '"' +
                    ' autocomplete="' + escape(autocomplete) + '"' +
                    required + '>';
            }

            var hintHtml = f.hint
                ? '<p class="modal-field-hint">' + escape(f.hint) + '</p>'
                : '';

            return '<div class="modal-field">' +
                '  <label class="modal-label" for="' + id + '">' + escape(f.label || f.name) + '</label>' +
                input +
                hintHtml +
                '</div>';
        }).join('');

        var extraHtml = extraButtons.map(function (b) {
            return '<button class="btn" data-role="extra" data-extra="' + escape(b.id || '') + '">' + escape(b.label) + '</button>';
        }).join('');

        modalEl.innerHTML =
            '<div class="' + headerCls + '">' +
            '  <span class="modal-icon">' + icon + '</span>' +
            '  <span>' + escape(title) + '</span>' +
            '</div>' +
            '<div class="modal-body">' +
            (body ? body : '') +
            '<div class="modal-form">' + fieldsHtml + '</div>' +
            '</div>' +
            '<div class="modal-footer">' +
            '  <div class="modal-footer-left">' + extraHtml + '</div>' +
            '  <div class="modal-footer-right">' +
            '    <button class="btn" data-role="cancel">' + escape(cancelLbl) + '</button>' +
            '    <button class="' + btnCls + '" data-role="confirm">' + escape(confirmLbl) + '</button>' +
            '  </div>' +
            '</div>';

        function collect() {
            var result = {};
            modalEl.querySelectorAll('[data-name]').forEach(function (el) {
                result[el.getAttribute('data-name')] = el.value;
            });
            return result;
        }

        function doConfirm() {
            var values = collect();
            var cb = currentOnConfirm;
            close();
            if (typeof cb === 'function') cb(values);
        }

        modalEl.querySelector('[data-role="cancel"]').addEventListener('click', close);
        modalEl.querySelector('[data-role="confirm"]').addEventListener('click', doConfirm);

        // Botões extra
        modalEl.querySelectorAll('[data-role="extra"]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var extraId = btn.getAttribute('data-extra');
                var values = collect();
                var cb = opts.onExtra || null;
                if (typeof cb === 'function') {
                    cb(extraId, values);
                }
            });
        });

        // Enter confirma (exceto em textarea)
        modalEl.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
                e.preventDefault();
                doConfirm();
            }
        });

        backdrop.hidden = false;

        // Foco no primeiro campo
        setTimeout(function () {
            var first = modalEl.querySelector('.modal-input');
            if (first) {
                first.focus();
                if (first.select) first.select();
            }
        }, 10);
    }
        function choose(opts) {
        if (!backdrop || !modalEl) return;

        opts = opts || {};
        var title = opts.title || 'Escolher';
        var body = opts.body || '';
        var options = opts.options || [];
        var cancelLbl = opts.cancelLabel || 'Cancelar';

        modalEl.innerHTML =
            '<div class="modal-header">' +
            '  <span class="modal-icon">☰</span>' +
            '  <span>' + escape(title) + '</span>' +
            '</div>' +
            '<div class="modal-body">' +
            (body ? body : '') +
            '<div class="modal-choices">' +
            options.map(function (o) {
                var cls = 'modal-choice';
                if (o.primary) cls += ' is-primary';
                if (o.danger)  cls += ' is-danger';

                return '<button class="' + cls + '" data-choice="' + escape(o.id) + '">' +
                    '  <span class="modal-choice-icon">' + (o.icon || '·') + '</span>' +
                    '  <span class="modal-choice-label">' + escape(o.label) + '</span>' +
                    (o.hint ? '  <span class="modal-choice-hint">' + escape(o.hint) + '</span>' : '') +
                    '</button>';
            }).join('') +
            '</div>' +
            '</div>' +
            '<div class="modal-footer">' +
            '  <div class="modal-footer-left"></div>' +
            '  <div class="modal-footer-right">' +
            '    <button class="btn" data-role="cancel">' + escape(cancelLbl) + '</button>' +
            '  </div>' +
            '</div>';

        // Cancelar
        modalEl.querySelector('[data-role="cancel"]').addEventListener('click', close);

        // Escolher uma opção
        modalEl.querySelectorAll('[data-choice]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var id = btn.getAttribute('data-choice');
                var cb = opts.onChoose;
                close();
                if (typeof cb === 'function') cb(id);
            });
        });

        backdrop.hidden = false;
    }

      return {
        init: init,
        confirm: confirm,
        prompt: prompt,
        form: form,
        choose: choose,
        close: close
    };

})(window, document);