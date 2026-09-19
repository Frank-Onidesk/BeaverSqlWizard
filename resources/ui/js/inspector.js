/* beaver-framework/plugins/sqlwizard/resources/ui/js/inspector.js */

window.SqlWizardInspector = (function (window, document) {
    'use strict';

    var TYPES = [
        { value: 'id',         label: 'id (PK auto)' },
        { value: 'str',        label: 'str (varchar)' },
        { value: 'text',       label: 'text' },
        { value: 'int',        label: 'int' },
        { value: 'dec',        label: 'dec (decimal)' },
        { value: 'float',      label: 'float' },
        { value: 'bool',       label: 'bool' },
        { value: 'date',       label: 'date' },
        { value: 'time',       label: 'time' },
        { value: 'datetime',   label: 'datetime' },
        { value: 'json',       label: 'json' },
        { value: 'uuid',       label: 'uuid' },
        { value: 'timestamps', label: 'timestamps' }
    ];

    var Inspector = {
        container: null,
        draft: null,
        fields: [],
        editing: false,
        tabs: [],              // [{ draft, expanded }]
        activeTabId: null,

        /* ── Inicialização ──────────────────────────────────── */

        init: function () {
            this.container = document.getElementById('inspector');
            if (!this.container) {
                console.warn('[inspector] #inspector nao encontrado');
                return;
            }

            this.renderTabs();
        },

        /* ── Tabs ───────────────────────────────────────────── */

        show: function (draft) {
            var existing = null;

            for (var i = 0; i < this.tabs.length; i++) {
                if (this.tabs[i].draft.id === draft.id) {
                    existing = this.tabs[i];
                    break;
                }
            }

            if (existing) {
                existing.draft = draft;
            } else {
                this.tabs.push({ draft: draft, expanded: true });
            }

            this.activeTabId = draft.id;
            this.draft = draft;
            this.editing = false;

            // Fecha as outras
            this.tabs.forEach(function (t) {
                t.expanded = (t.draft.id === draft.id);
            });

            this.renderTabs();
        },

        closeTab: function (draftId) {
            this.tabs = this.tabs.filter(function (t) {
                return t.draft.id !== draftId;
            });

            if (this.activeTabId === draftId) {
                this.activeTabId = this.tabs.length ? this.tabs[0].draft.id : null;
                this.tabs.forEach(function (t) {
                    t.expanded = (t.draft.id === this.activeTabId);
                }, this);
            }

            // Avisar o canvas para remover o cartão
            window.dispatchEvent(new CustomEvent('sqlwizard:tab-closed', {
                detail: { draftId: draftId }
            }));

            this.renderTabs();
        },

        toggleTab: function (draftId) {
            this.tabs.forEach(function (t) {
                if (t.draft.id === draftId) {
                    t.expanded = !t.expanded;
                } else {
                    t.expanded = false;
                }
            });

            this.activeTabId = draftId;

            for (var i = 0; i < this.tabs.length; i++) {
                if (this.tabs[i].draft.id === draftId) {
                    this.draft = this.tabs[i].draft;
                    break;
                }
            }

            this.editing = false;
            this.renderTabs();
        },

        renderTabs: function () {
            if (!this.container) return;

            var self = this;

            if (!this.tabs.length) {
                this.container.innerHTML = '<p class="is-muted" style="padding: 12px;">Seleciona uma tabela</p>';
                return;
            }

            var html = [];

            this.tabs.forEach(function (t) {
                var isActive = t.draft.id === self.activeTabId;
                var isExpanded = t.expanded && isActive;

                html.push(
                    '<div class="insp-tab' + (isActive ? ' is-active' : '') +
                    (isExpanded ? ' is-expanded' : '') + '"' +
                    ' data-id="' + self.escape(t.draft.id) + '">' +
                    '  <div class="insp-tab-header">' +
                    '    <span class="insp-tab-toggle">▶</span>' +
                    '    <span class="insp-tab-icon">▦</span>' +
                    '    <span class="insp-tab-title">' + self.escape(t.draft.table) + '</span>' +
                    '    <button class="insp-tab-close" data-close="' + self.escape(t.draft.id) + '" title="Fechar">×</button>' +
                    '  </div>'
                );

                if (isExpanded) {
                    html.push(self.renderTabBody(t.draft));
                }

                html.push('</div>');
            });

            this.container.innerHTML = html.join('');

            // Binds
            this.container.querySelectorAll('.insp-tab-header').forEach(function (h) {
                h.addEventListener('click', function (e) {
                    if (e.target.classList.contains('insp-tab-close')) return;
                    var id = h.parentElement.getAttribute('data-id');
                    self.toggleTab(id);
                });
            });

            this.container.querySelectorAll('.insp-tab-close').forEach(function (btn) {
                btn.addEventListener('click', function (e) {
                    e.stopPropagation();
                    var id = btn.getAttribute('data-close');
                    self.closeTab(id);
                });
            });

            this.bindTabBodies();
        },

        renderTabBody: function (draft) {
            if (this.editing && this.draft && this.draft.id === draft.id) {
                return this.renderEditorBody();
            }

            var fields = draft.fields || [];
            var self = this;

            var cols = fields.map(function (f) {
                return '<div style="padding: 2px 0; font-family: var(--font-mono); font-size: 12px;">' +
                    self.escape(f) +
                    '</div>';
            }).join('');

            return [
                '<div class="insp-tab-body">',
                '  <p class="is-muted" style="font-size: 11px; margin-bottom: 8px;">' + this.escape(draft.id) + '</p>',
                '  <div class="inspector-actions">',
                '    <button class="btn is-primary" data-action="edit" style="width:100%;">✎ Editar tabela</button>',
                '    <div class="inspector-actions-row">',
                '      <button class="btn" data-action="duplicate">⧉ Duplicar</button>',
                '      <button class="btn" data-action="export">⤓ Exportar</button>',
                '    </div>',
                '    <button class="btn is-danger" data-action="delete" style="width:100%;">⊗ Apagar</button>',
                '  </div>',
                '  <div class="panel-section" style="margin-top: 12px;">',
                '    <div class="panel-section-title">Colunas (' + fields.length + ')</div>',
                '    <div class="panel-section-body">' + cols + '</div>',
                '  </div>',
                '</div>',
            ].join('');
        },

        bindTabBodies: function () {
            var self = this;

            this.container.querySelectorAll('.insp-tab-body [data-action]').forEach(function (btn) {
                btn.addEventListener('click', function (e) {
                    e.stopPropagation();
                    var action = btn.getAttribute('data-action');
                    var draft = self.draft;

                    if (!draft) return;

                    if (action === 'edit') {
                        self.edit();
                        return;
                    }

                    var contextAction = {
                        duplicate: 'duplicate-table',
                        export:    'export-sql',
                        delete:    'delete-draft'
                    }[action];

                    if (!contextAction) return;

                    window.dispatchEvent(new CustomEvent('sqlwizard:context-action', {
                        detail: {
                            action: contextAction,
                            ctx: { draftId: draft.id, table: draft.table }
                        }
                    }));
                });
            });

            if (this.editing) {
                this.bindEditorEvents();
            }
        },

        /* ── Edição ─────────────────────────────────────────── */

        edit: function (draft) {
            if (draft) {
                this.draft = draft;
            }

            if (!this.draft) return;

            this.editing = true;

            this.fields = (this.draft.fields || []).map(function (f) {
                return Inspector.parseField(f);
            });

            this.renderTabs();
        },

        parseField: function (raw) {
            var info = { name: '', type: 'str', length: '', nullable: false, default: '' };
            var s = String(raw).trim();

            if (s === 'id' || s === 'timestamps') {
                info.name = s;
                info.type = s;
                return info;
            }

            if (s.indexOf('?') !== -1) {
                info.nullable = true;
                s = s.replace(/\?/g, '');
            }

            if (s.indexOf('=') !== -1) {
                var parts = s.split('=', 2);
                s = parts[0];
                info.default = parts[1];
            }

            var colon = s.indexOf(':');
            if (colon === -1) {
                info.name = s;
                return info;
            }

            info.name = s.substring(0, colon);
            var rest = s.substring(colon + 1);
            var paren = rest.indexOf('(');

            if (paren === -1) {
                info.type = rest;
            } else {
                info.type = rest.substring(0, paren);
                var close = rest.indexOf(')', paren);
                if (close !== -1) {
                    info.length = rest.substring(paren + 1, close);
                }
            }

            return info;
        },

        buildField: function (info) {
            if (info.type === 'id' || info.type === 'timestamps') {
                return info.type;
            }

            var s = info.name + ':' + info.type;

            if (info.length !== '' && info.length !== null && info.length !== undefined) {
                s += '(' + info.length + ')';
            }

            if (info.nullable) s += '?';
            if (info.default !== '' && info.default !== null && info.default !== undefined) {
                s += '=' + info.default;
            }

            return s;
        },

        renderEditorBody: function () {
            return [
                '<div class="insp-tab-body">',
                '  <label class="inspector-label">Nome da tabela</label>',
                '  <input type="text" class="inspector-input" id="insp-table" value="' +
                        this.escape(this.draft.table) + '">',
                '  <div class="panel-section" style="margin-top: 12px;">',
                '    <div class="panel-section-title">Colunas (' + this.fields.length + ')</div>',
                '    <div class="panel-section-body" id="insp-columns">',
                this.renderColumns(),
                '    </div>',
                '    <div style="padding: 8px 12px;">',
                '      <button class="btn" id="btn-add-column" style="width: 100%;">+ Adicionar coluna</button>',
                '    </div>',
                '  </div>',
                '  <div style="display: flex; gap: 8px; margin-top: 12px;">',
                '    <button class="btn" id="btn-cancel-edit" style="flex: 1;">Cancelar</button>',
                '    <button class="btn is-primary" id="btn-save-edit" style="flex: 1;">Guardar</button>',
                '  </div>',
                '</div>',
            ].join('');
        },

        renderColumns: function () {
            var self = this;
            return this.fields.map(function (f, i) {
                return self.renderColumn(f, i);
            }).join('');
        },

        renderColumn: function (f, index) {
            var typeOptions = TYPES.map(function (t) {
                var sel = t.value === f.type ? ' selected' : '';
                return '<option value="' + t.value + '"' + sel + '>' + t.label + '</option>';
            }).join('');

            var isSpecial = (f.type === 'id' || f.type === 'timestamps');

            return [
                '<div class="inspector-column" data-index="' + index + '">',
                '  <div class="inspector-column-row">',
                '    <input type="text" class="inspector-input inspector-col-name" value="' +
                        this.escape(f.name) + '" placeholder="nome" ' + (isSpecial ? 'readonly' : '') + '>',
                '    <button class="inspector-remove" data-remove="' + index + '" title="Remover">×</button>',
                '  </div>',
                '  <div class="inspector-column-row">',
                '    <select class="inspector-input inspector-col-type" data-index="' + index + '">' +
                        typeOptions +
                '    </select>',
                '    <input type="text" class="inspector-input inspector-col-length" value="' +
                        this.escape(f.length) + '" placeholder="tam." data-index="' + index + '">',
                '  </div>',
                '  <div class="inspector-column-row">',
                '    <label class="inspector-check">',
                '      <input type="checkbox" class="inspector-col-nullable" data-index="' + index + '"' +
                        (f.nullable ? ' checked' : '') + '> Nulo',
                '    </label>',
                '    <input type="text" class="inspector-input inspector-col-default" value="' +
                        this.escape(f.default) + '" placeholder="default" data-index="' + index + '">',
                '  </div>',
                '</div>'
            ].join('');
        },

        bindEditorEvents: function () {
            var self = this;

            var tableInput = document.getElementById('insp-table');
            if (tableInput) {
                tableInput.addEventListener('input', function () {
                    self.draft.table = tableInput.value;
                });
            }

            this.container.querySelectorAll('[data-remove]').forEach(function (btn) {
                btn.addEventListener('click', function () {
                    var i = parseInt(btn.getAttribute('data-remove'), 10);
                    self.removeColumn(i);
                });
            });

            var addBtn = document.getElementById('btn-add-column');
            if (addBtn) {
                addBtn.addEventListener('click', function () {
                    self.addColumn();
                });
            }

            this.container.querySelectorAll('.inspector-col-type').forEach(function (sel) {
                sel.addEventListener('change', function () {
                    var i = parseInt(sel.getAttribute('data-index'), 10);
                    self.fields[i].type = sel.value;
                    self.renderTabs();
                });
            });

            this.container.querySelectorAll('.inspector-col-name').forEach(function (inp) {
                inp.addEventListener('input', function () {
                    var idx = parseInt(inp.closest('.inspector-column').getAttribute('data-index'), 10);
                    self.fields[idx].name = inp.value;
                });
            });

            this.container.querySelectorAll('.inspector-col-length').forEach(function (inp) {
                inp.addEventListener('input', function () {
                    var idx = parseInt(inp.getAttribute('data-index'), 10);
                    self.fields[idx].length = inp.value;
                });
            });

            this.container.querySelectorAll('.inspector-col-default').forEach(function (inp) {
                inp.addEventListener('input', function () {
                    var idx = parseInt(inp.getAttribute('data-index'), 10);
                    self.fields[idx].default = inp.value;
                });
            });

            this.container.querySelectorAll('.inspector-col-nullable').forEach(function (chk) {
                chk.addEventListener('change', function () {
                    var idx = parseInt(chk.getAttribute('data-index'), 10);
                    self.fields[idx].nullable = chk.checked;
                });
            });

            var cancelBtn = document.getElementById('btn-cancel-edit');
            if (cancelBtn) {
                cancelBtn.addEventListener('click', function () {
                    self.editing = false;
                    self.fields = [];
                    self.renderTabs();
                });
            }

            var saveBtn = document.getElementById('btn-save-edit');
            if (saveBtn) {
                saveBtn.addEventListener('click', function () {
                    self.save();
                });
            }
        },

        addColumn: function () {
            this.fields.push({
                name: 'nova_coluna',
                type: 'str',
                length: '255',
                nullable: true,
                default: ''
            });
            this.renderTabs();
        },

        removeColumn: function (index) {
            this.fields.splice(index, 1);
            this.renderTabs();
        },

        save: function () {
            var self = this;

            if (!this.draft) return;

            var table = this.draft.table.trim();

            if (table === '') {
                if (window.SqlWizardToast) {
                    window.SqlWizardToast.error('Nome da tabela é obrigatório', { title: 'Erro' });
                }
                return;
            }

            var fields = this.fields.map(function (f) {
                return self.buildField(f);
            });

            var payload = {
                table: table,
                fields: fields
            };

            window.SqlWizardApi.updateDraftFull(this.draft.id, payload)
                .then(function (res) {
                    if (window.SqlWizardToast) {
                        window.SqlWizardToast.success('Draft atualizado', {
                            title: self.draft.table,
                            duration: 2000
                        });
                    }

                    self.draft = res.draft;
                    self.fields = [];
                    self.editing = false;

                    // Atualizar no array de tabs
                    for (var i = 0; i < self.tabs.length; i++) {
                        if (self.tabs[i].draft.id === self.draft.id) {
                            self.tabs[i].draft = self.draft;
                            break;
                        }
                    }

                    self.renderTabs();

                    window.dispatchEvent(new CustomEvent('sqlwizard:draft-selected', {
                        detail: { draft: self.draft }
                    }));

                    if (window.SqlWizardExplorer) {
                        window.SqlWizardExplorer.load();
                    }
                })
                .catch(function (err) {
                    console.error('[inspector] erro a guardar:', err);
                    if (window.SqlWizardToast) {
                        window.SqlWizardToast.error(err.message || 'Erro', {
                            title: 'Erro ao guardar'
                        });
                    }
                });
        },

        escape: function (str) {
            return String(str)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        }
    };

    return Inspector;

})(window, document);