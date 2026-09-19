/* ============================================================
 * Beaver SqlWizard — explorer.js
 * Painel esquerdo: drafts + ligações (com introspeção)
 * ============================================================ */

(function (window, document) {
    'use strict';

    var currentView = 'drafts';

    var Explorer = {
        container: null,
        drafts: [],
        connections: [],
        selected: null,
        editingConnectionId: null,

        init: function () {
            this.container = document.getElementById('explorer');

            if (!this.container) {
                console.warn('[explorer] #explorer nao encontrado');
                return;
            }

            this.bindToggle();
            this.bindConnectionSave();
            this.load();
        },

        /* ── Drafts ─────────────────────────────────────────── */

        load: function () {
            var self = this;

            window.SqlWizardApi.listDrafts()
                .then(function (data) {
                    self.drafts = data.drafts || [];
                    if (currentView === 'drafts') self.render();
                })
                .catch(function (err) {
                    console.error('[explorer] erro ao carregar drafts:', err);
                });
        },

        render: function () {
            if (!this.drafts.length) {
                this.container.innerHTML =
                    '<p class="panel-empty">Nenhum draft.</p>' +
                    '<p class="panel-empty" style="font-size: 11px; margin-top: 4px;">' +
                    'Cria um com <code>php beaver table:wizard &lt;nome&gt;</code>' +
                    '</p>';
                return;
            }

            var self = this;

            var html = [
                '<div class="panel-section">',
                '  <div class="panel-section-title">Drafts</div>',
                '  <div class="panel-section-body">',
                '    <ul class="panel-list">',
                this.drafts.map(function (d) { return self.renderItem(d); }).join(''),
                '    </ul>',
                '  </div>',
                '</div>',
            ].join('\n');

            this.container.innerHTML = html;

            this.container.querySelectorAll('.panel-list-item').forEach(function (el) {
                el.addEventListener('click', function () {
                    self.select(el.getAttribute('data-id'));
                });
            });

            if (this.selected) this.highlight(this.selected);
        },

        renderItem: function (draft) {
            var isSelected = this.selected === draft.id;

            return [
                '<li class="panel-list-item' + (isSelected ? ' is-selected' : '') + '"',
                '    data-id="' + this.escape(draft.id) + '">',
                '  <span class="panel-list-icon">▦</span>',
                '  <span class="panel-list-label">' + this.escape(draft.table) + '</span>',
                '  <span class="panel-list-meta">' + (draft.fields ? draft.fields.length : 0) + '</span>',
                '</li>',
            ].join('');
        },

        select: function (id) {
            this.selected = id;
            this.highlight(id);

            var draft = null;
            for (var i = 0; i < this.drafts.length; i++) {
                if (this.drafts[i].id === id) { draft = this.drafts[i]; break; }
            }

            if (draft) {
                window.dispatchEvent(new CustomEvent('sqlwizard:draft-selected', {
                    detail: { draft: draft }
                }));
            }
        },

        highlight: function (id) {
            this.container.querySelectorAll('.panel-list-item').forEach(function (el) {
                el.classList.toggle('is-selected', el.getAttribute('data-id') === id);
            });
        },

        /* ── Toggle ─────────────────────────────────────────── */

        bindToggle: function () {
            var self = this;
            var tabs = document.querySelectorAll('.explorer-tab');

            tabs.forEach(function (btn) {
                btn.addEventListener('click', function () {
                    var view = btn.getAttribute('data-view');
                    if (!view || view === currentView) return;

                    currentView = view;

                    tabs.forEach(function (b) { b.classList.remove('is-active'); });
                    btn.classList.add('is-active');

                    self.renderCurrentView();
                });
            });
        },

        renderCurrentView: function () {
            if (currentView === 'connections') {
                this.loadConnections();
            } else if (currentView === 'local') {
                this.renderLocalStorage();
            } else {
                this.render();
            }
        },

        /* ── Ligações: carregar ─────────────────────────────── */

        loadConnections: function () {
            var self = this;

            this.container.innerHTML = '<p class="panel-empty">A carregar...</p>';

            window.SqlWizardApi.listConnections()
                .then(function (data) {
                    // Inicializar campos dinâmicos
                    self.connections = (data.connections || []).map(function (c) {
                        return self.initConnectionFields(c);
                    });
                    self.renderConnections();
                })
                .catch(function (err) {
                    console.error('[explorer] erro ao carregar ligações:', err);
                    self.container.innerHTML =
                        '<p class="panel-empty" style="color: var(--danger)">' +
                        'Erro: ' + self.escape(err.message) + '</p>';
                });
        },

        initConnectionFields: function (c) {
            if (typeof c.open === 'undefined') c.open = false;
            if (typeof c.databases === 'undefined') c.databases = null;
            if (typeof c.databasesLoading === 'undefined') c.databasesLoading = false;
            if (typeof c.selectedDb === 'undefined') c.selectedDb = null;
            if (typeof c.tables === 'undefined') c.tables = {};
            if (typeof c.tablesLoading === 'undefined') c.tablesLoading = null;
            if (typeof c.databasesError === 'undefined') c.databasesError = null;
            if (typeof c.tablesError === 'undefined') c.tablesError = {};
            return c;
        },

        /* ── Ligações: carregar BDs e tabelas ──────────────── */

        loadDatabases: function (connId) {
            var self = this;
            var conn = this.findConnection(connId);

            if (!conn) return;
            if (conn.databasesLoading) return;

            conn.databasesLoading = true;
            conn.databasesError = null;
            this.renderConnections();

            window.SqlWizardApi.getDatabases(connId)
                .then(function (res) {
                    conn.databases = res.databases || [];
                    conn.databasesLoading = false;
                    self.renderConnections();
                })
                .catch(function (err) {
                    conn.databasesLoading = false;
                    conn.databasesError = err.message || 'Erro';
                    conn.databases = [];
                    self.renderConnections();
                });
        },

        loadTables: function (connId, db) {
            var self = this;
            var conn = this.findConnection(connId);

            if (!conn) return;
            if (conn.tablesLoading === db) return;
            if (conn.tables[db]) return;   // já carregadas

            conn.tablesLoading = db;
            conn.tablesError[db] = null;
            this.renderConnections();

            window.SqlWizardApi.getTables(connId, db)
                .then(function (res) {
                    conn.tables[db] = res.tables || [];
                    conn.tablesLoading = null;
                    self.renderConnections();
                })
                .catch(function (err) {
                    conn.tablesLoading = null;
                    conn.tablesError[db] = err.message || 'Erro';
                    conn.tables[db] = [];
                    self.renderConnections();
                });
        },

        findConnection: function (id) {
            for (var i = 0; i < this.connections.length; i++) {
                if (this.connections[i].id === id) return this.connections[i];
            }
            return null;
        },

        /* ── Ligações: gravar ───────────────────────────────── */

        bindConnectionSave: function () {
            var self = this;

            window.addEventListener('sqlwizard:connection-save', function (e) {
                self.saveConnection(e.detail.connection);
            });
        },

        saveConnection: function (values) {
            var self = this;
            var editId = this.editingConnectionId;
            var promise = editId
                ? window.SqlWizardApi.updateConnection(editId, values)
                : window.SqlWizardApi.createConnection(values);

            promise
                .then(function () {
                    if (window.SqlWizardToast) {
                        window.SqlWizardToast.success(
                            editId ? 'Ligação atualizada' : 'Ligação criada',
                            { title: 'Ligações', duration: 2000 }
                        );
                    }

                    self.editingConnectionId = null;
                    self.loadConnections();
                })
                .catch(function (err) {
                    if (window.SqlWizardToast) {
                        if (err.status === 409) {
                            window.SqlWizardToast.warning(
                                'Já existe uma ligação com esse nome.',
                                { title: 'Nome duplicado', duration: 4000 }
                            );
                        } else {
                            window.SqlWizardToast.error(
                                err.message || 'Erro desconhecido',
                                { title: 'Erro ao guardar' }
                            );
                        }
                    } else {
                        alert(err.message || 'Erro desconhecido');
                    }
                });
        },

        /* ── Ligações: render ───────────────────────────────── */

        renderConnections: function () {
            if (!this.container) return;

            var conns = this.connections;

            var html = ['<div class="explorer-view">'];

            html.push(
                '<div class="connections-actions">' +
                '  <button class="connections-add" id="btn-new-connection">' +
                '    <span>+</span> Nova ligação' +
                '  </button>' +
                '</div>'
            );

            if (!conns.length) {
                html.push('<p class="connections-empty">Ainda sem ligações.</p>');
            } else {
                conns.forEach(function (c) {
                    html.push(Explorer.renderConnection(c));
                });
            }

            html.push('</div>');

            this.container.innerHTML = html.join('');

            this.bindConnectionEvents();
        },

        renderConnection: function (c) {
            var openCls = c.open ? ' is-open' : '';
            var statusCls = 'connection-status is-' + (c.status || 'ok');

            var body = '';

            if (c.open) {
                body = '<div class="connection-body">' +
                    '  <div class="connection-host">' +
                    '    ' + Explorer.escape((c.host || '') + (c.port ? ':' + c.port : '')) +
                    '  </div>' +
                    '  <div class="connection-actions">' +
                    '    <button class="connection-action" data-action="test">Testar</button>' +
                    '    <button class="connection-action" data-action="edit">Editar</button>' +
                    '    <button class="connection-action is-danger" data-action="delete">Apagar</button>' +
                    '  </div>' +
                    '  ' + Explorer.renderDatabases(c) +
                    '</div>';
            }

            return [
                '<div class="connection' + openCls + '" data-conn="' + c.id + '">',
                '  <div class="connection-header" data-conn="' + c.id + '">',
                '    <span class="connection-toggle">▶</span>',
                '    <span class="' + statusCls + '"></span>',
                '    <span class="connection-name">' + Explorer.escape(c.name) + '</span>',
                '    <span class="connection-driver">' + Explorer.escape(c.driver) + '</span>',
                '  </div>',
                '  ' + body,
                '</div>',
            ].join('');
        },

        renderDatabases: function (c) {
            // Ainda não carregou
            if (c.databases === null && !c.databasesLoading && !c.databasesError) {
                return '<p class="connection-loading">A carregar bases de dados...</p>';
            }

            // A carregar
            if (c.databasesLoading) {
                return '<p class="connection-loading">A carregar bases de dados...</p>';
            }

            // Erro
            if (c.databasesError) {
                return '<p class="connection-error">⚠ ' + Explorer.escape(c.databasesError) + '</p>';
            }

            // Vazio
            if (!c.databases || !c.databases.length) {
                return '<p class="connection-empty">Sem bases de dados.</p>';
            }

            var html = ['<ul class="connection-dbs">'];

            c.databases.forEach(function (db) {
                var isSelected = db === c.selectedDb;

                html.push(
                    '<li class="connection-db' + (isSelected ? ' is-selected' : '') + '"' +
                    '    data-conn="' + c.id + '" data-db="' + Explorer.escape(db) + '">' +
                    '  <span class="connection-db-icon">🗄</span>' +
                    '  <span class="connection-db-name">' + Explorer.escape(db) + '</span>' +
                    '</li>'
                );

                if (isSelected) {
                    html.push(Explorer.renderTables(c, db));
                }
            });

            html.push('</ul>');

            return html.join('');
        },

        renderTables: function (c, db) {
            if (c.tablesLoading === db) {
                return '<li class="connection-loading-inline">A carregar tabelas...</li>';
            }

            if (c.tablesError && c.tablesError[db]) {
                return '<li class="connection-error-inline">⚠ ' + Explorer.escape(c.tablesError[db]) + '</li>';
            }

            var tables = c.tables[db];

            if (!tables) {
                return '<li class="connection-loading-inline">A carregar tabelas...</li>';
            }

            if (!tables.length) {
                return '<li class="connection-empty-inline">Sem tabelas.</li>';
            }

            return '<ul class="connection-tables">' +
                tables.map(function (t) {
                    return '<li class="connection-table"' +
                        '    data-conn="' + c.id + '"' +
                        '    data-db="' + Explorer.escape(db) + '"' +
                        '    data-table="' + Explorer.escape(t) + '">' +
                        '  <span class="connection-table-icon">▦</span>' +
                        '  <span>' + Explorer.escape(t) + '</span>' +
                        '</li>';
                }).join('') +
                '</ul>';
        },

        /* ── Ligações: eventos ──────────────────────────────── */

        bindNewConnection: function () {
            var btn = document.getElementById('btn-new-connection');
            if (btn) {
                btn.addEventListener('click', function () {
                    Explorer.editingConnectionId = null;
                    if (window.SqlWizardConnectionsForm) {
                        window.SqlWizardConnectionsForm.open();
                    } else {
                        alert('Módulo de formulário não carregado.');
                    }
                });
            }
        },

        bindConnectionEvents: function () {
            var self = this;

            // Click no header → expande e carrega BDs
            this.container.querySelectorAll('.connection-header').forEach(function (h) {
                h.addEventListener('click', function (e) {
                    e.stopPropagation();
                    self.toggleConnection(h.getAttribute('data-conn'));
                });
            });

            // Click numa ação
            this.container.querySelectorAll('.connection-action').forEach(function (btn) {
                btn.addEventListener('click', function (e) {
                    e.stopPropagation();
                    var action = btn.getAttribute('data-action');
                    var parent = btn.closest('.connection');
                    var id = parent ? parent.getAttribute('data-conn') : null;

                    if (action === 'edit') self.editConnection(id);
                    else if (action === 'test') self.testConnection(id);
                    else if (action === 'delete') self.confirmDeleteConnection(id);
                });
            });

            // Click numa BD → seleciona e carrega tabelas
            this.container.querySelectorAll('.connection-db').forEach(function (el) {
                el.addEventListener('click', function (e) {
                    e.stopPropagation();
                    self.selectDatabase(el.getAttribute('data-conn'), el.getAttribute('data-db'));
                });
            });

            // Click numa tabela → modal com opções
            this.container.querySelectorAll('.connection-table').forEach(function (el) {
                el.addEventListener('click', function (e) {
                    e.stopPropagation();
                    var connId = el.getAttribute('data-conn');
                    var db = el.getAttribute('data-db');
                    var table = el.getAttribute('data-table');
                    self.showTableOptions(connId, db, table);
                });
            });

            this.bindNewConnection();
        },

        showTableOptions: function (connId, db, table) {
            var self = this;
            var fullName = db + '.' + table;

            if (!window.SqlWizardModal) {
                // Fallback: sem modal, importa logo
                self.importTable(connId, db, table);
                return;
            }

            window.SqlWizardModal.choose({
                title: table,
                body:
                    '<p class="is-muted" style="margin: 0 0 8px 0;">' +
                    'Base de dados: <code>' + this.escape(db) + '</code>' +
                    '</p>',
                cancelLabel: 'Cancelar',
                options: [
                    {
                        id: 'import',
                        icon: '📥',
                        label: 'Importar como draft',
                        primary: true,
                        hint: '→ canvas'
                    },
                    {
                        id: 'preview',
                        icon: '👁',
                        label: 'Pré-visualizar schema'
                    },
                    {
                        id: 'copy',
                        icon: '📋',
                        label: 'Copiar nome completo',
                        hint: fullName
                    }
                ],
                onChoose: function (id) {
                    if (id === 'import') {
                        self.importTable(connId, db, table);
                    } else if (id === 'preview') {
                        self.previewTableSchema(connId, db, table);
                    } else if (id === 'copy') {
                        self.copyToClipboard(fullName);
                    }
                }
            });
        },

        previewTableSchema: function (connId, db, table) {
            var self = this;

            window.SqlWizardApi.importTable(connId, db, table)
                .then(function (res) {
                    var draft = res.draft;

                    window.SqlWizardModal.confirm({
                        title: 'Schema: ' + table,
                        body:
                            '<p class="is-muted">Base de dados: <code>' + self.escape(db) + '</code></p>' +
                            '<pre class="modal-pre">' + self.escape(draft.sql) + '</pre>',
                        confirmLabel: 'Importar como draft',
                        cancelLabel: 'Fechar',
                        onConfirm: function () {
                            self.importTable(connId, db, table);
                        }
                    });
                })
                .catch(function (err) {
                    alert('Erro: ' + err.message);
                });
        },

        copyToClipboard: function (text) {
            var self = this;

            function onSuccess() {
                if (window.SqlWizardToast) {
                    window.SqlWizardToast.success(text, {
                        title: 'Copiado',
                        duration: 2000
                    });
                }
            }

            function onError() {
                if (window.SqlWizardToast) {
                    window.SqlWizardToast.error(
                        'Não consegui copiar. Copia manualmente: ' + text,
                        { title: 'Erro' }
                    );
                } else {
                    alert('Copiado: ' + text);
                }
            }

            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(text)
                    .then(onSuccess)
                    .catch(onError);
            } else {
                var ta = document.createElement('textarea');
                ta.value = text;
                document.body.appendChild(ta);
                ta.select();
                try {
                    document.execCommand('copy');
                    onSuccess();
                } catch (e) {
                    onError();
                }
                document.body.removeChild(ta);
            }
        },


        /* ── Ligações: ações ────────────────────────────────── */
        importTable: function (connId, db, table) {
            var self = this;

            console.log('[explorer] a importar:', db + '.' + table);

            window.SqlWizardApi.importTable(connId, db, table)
                .then(function (res) {
                    console.log('[explorer] draft importado:', res.draft.id);

                    if (window.SqlWizardToast) {
                        window.SqlWizardToast.success(
                            'Draft criado: ' + res.draft.id,
                            { title: 'Importar tabela', duration: 4000 }
                        );
                    }

                    // 1. Mudar para a vista Drafts
                    currentView = 'drafts';

                    var tabs = document.querySelectorAll('.explorer-tab');
                    tabs.forEach(function (b) {
                        b.classList.toggle('is-active', b.getAttribute('data-view') === 'drafts');
                    });

                    // 2. Recarregar a lista de drafts
                    return window.SqlWizardApi.listDrafts()
                        .then(function (data) {
                            self.drafts = data.drafts || [];
                            self.render();

                            // 3. Selecionar o draft novo
                            setTimeout(function () {
                                self.select(res.draft.id);
                            }, 100);
                        });
                })
                .catch(function (err) {
                    console.error('[explorer] erro a importar:', err);

                    if (window.SqlWizardToast) {
                        window.SqlWizardToast.error(
                            err.message || 'Erro desconhecido',
                            { title: 'Erro ao importar', duration: 5000 }
                        );
                    } else {
                        alert('Erro ao importar:\n\n' + (err.message || 'Erro desconhecido'));
                    }
                });
        },

        toggleConnection: function (id) {
            var conn = this.findConnection(id);
            if (!conn) return;

            conn.open = !conn.open;

            // Se abriu e ainda não carregou BDs, carrega agora
            if (conn.open && conn.databases === null) {
                this.loadDatabases(id);
            } else {
                this.renderConnections();
            }
        },

        selectDatabase: function (connId, db) {
            var conn = this.findConnection(connId);
            if (!conn) return;

            conn.selectedDb = db;
            conn.open = true;

            if (!conn.tables[db]) {
                this.loadTables(connId, db);
            } else {
                this.renderConnections();
            }
        },

        editConnection: function (id) {
            var conn = this.findConnection(id);
            if (!conn) return;
            if (!window.SqlWizardConnectionsForm) return;

            this.editingConnectionId = id;

            window.SqlWizardConnectionsForm.open({
                id: conn.id,
                name: conn.name,
                driver: conn.driver,
                host: conn.host || '',
                port: conn.port || '',
                database: conn.database || '',
                username: conn.username || '',
                password: conn.password || ''
            });
        },

        testConnection: function (id) {
            var conn = this.findConnection(id);
            if (!conn) return;

            window.SqlWizardApi.testConnection({
                driver: conn.driver,
                host: conn.host,
                port: conn.port,
                database: conn.database,
                username: conn.username,
                password: conn.password
            })
                .then(function (res) {
                    if (!window.SqlWizardToast) {
                        alert(res.ok ? '✓ ' + res.message : '✗ ' + res.error);
                        return;
                    }

                    if (res.ok) {
                        var msg = res.message || 'Ligação OK';
                        if (res.elapsed_ms) {
                            msg += ' (' + res.elapsed_ms + ' ms)';
                        }
                        window.SqlWizardToast.success(msg, {
                            title: 'Ligação: ' + conn.name,
                            duration: 3000
                        });
                    } else {
                        window.SqlWizardToast.error(res.error || 'Erro', {
                            title: 'Falha na ligação',
                            duration: 5000
                        });
                    }
                })
                .catch(function (err) {
                    if (window.SqlWizardToast) {
                        window.SqlWizardToast.error('Erro de rede: ' + err.message, {
                            title: 'Falha na ligação',
                            duration: 5000
                        });
                    } else {
                        alert('✗ Erro de rede: ' + err.message);
                    }
                });
        },

        confirmDeleteConnection: function (id) {
            var conn = this.findConnection(id);
            if (!conn) return;

            var self = this;

            if (!window.SqlWizardModal) {
                if (!confirm('Apagar a ligação "' + conn.name + '"?')) return;
                self.doDeleteConnection(id);
                return;
            }

            window.SqlWizardModal.confirm({
                title: 'Apagar ligação',
                body: '<p>Vais apagar a ligação <code>' + this.escape(conn.name) + '</code>.</p>' +
                    '<p class="is-muted">Esta ação não pode ser desfeita.</p>',
                confirmLabel: 'Apagar',
                cancelLabel: 'Cancelar',
                danger: true,
                onConfirm: function () { self.doDeleteConnection(id); }
            });
        },

        doDeleteConnection: function (id) {
            var self = this;

            window.SqlWizardApi.deleteConnection(id)
                .then(function () {
                    if (window.SqlWizardToast) {
                        window.SqlWizardToast.success('Ligação apagada', {
                            title: 'Ligações',
                            duration: 2000
                        });
                    }
                    self.loadConnections();
                })
                .catch(function (err) {
                    if (window.SqlWizardToast) {
                        window.SqlWizardToast.error(err.message || 'Erro', {
                            title: 'Erro ao apagar'
                        });
                    } else {
                        alert('Erro ao apagar: ' + err.message);
                    }
                });
        },



        //============================ LOCAL STORAGE ==================================

               /* ── LocalStorage ───────────────────────────────────── */

        renderLocalStorage: function () {
            if (!this.container) return;

            var self = this;
            var items = this.collectStorageItems();

            var html = ['<div class="explorer-view">'];

            html.push(
                '<div class="connections-actions">' +
                '  <button class="connections-add" id="btn-storage-refresh">' +
                '    <span>⟳</span> Atualizar' +
                '  </button>' +
                '</div>'
            );

            if (!items.length) {
                html.push('<p class="connections-empty">Sem chaves do SqlWizard.</p>');
            } else {
                html.push('<ul class="storage-list">');

                items.forEach(function (item) {
                    var preview = item.value;
                    if (preview.length > 80) {
                        preview = preview.substring(0, 80) + '…';
                    }

                    html.push(
                        '<li class="storage-item" data-key="' + self.escape(item.key) + '">',
                        '  <div class="storage-item-header">',
                        '    <span class="storage-item-key">' + self.escape(item.key) + '</span>',
                        '    <span class="storage-item-size">' + item.size + ' B</span>',
                        '    <button class="storage-item-delete" data-delete="' + self.escape(item.key) + '" title="Apagar">×</button>',
                        '  </div>',
                        '  <div class="storage-item-value">' + self.escape(preview) + '</div>',
                        '</li>'
                    );
                });

                html.push('</ul>');

                html.push(
                    '<div class="connections-actions" style="margin-top: 12px;">' +
                    '  <button class="connections-add is-danger" id="btn-storage-clear">' +
                    '    <span>🗑</span> Limpar tudo' +
                    '  </button>' +
                    '</div>'
                );
            }

            html.push('</div>');

            this.container.innerHTML = html.join('');

            this.bindStorageActions();
        },

        collectStorageItems: function () {
            var items = [];

            try {
                for (var i = 0; i < localStorage.length; i++) {
                    var key = localStorage.key(i);

                    if (!key || key.indexOf('sqlwizard:') !== 0) {
                        continue;
                    }

                    var value = localStorage.getItem(key) || '';

                    items.push({
                        key: key,
                        value: value,
                        size: new Blob([value]).size
                    });
                }
            } catch (e) {
                console.error('[explorer] erro a ler localStorage:', e);
            }

            items.sort(function (a, b) { return a.key.localeCompare(b.key); });

            return items;
        },

        bindStorageActions: function () {
            var self = this;

            var refresh = document.getElementById('btn-storage-refresh');
            if (refresh) {
                refresh.addEventListener('click', function () {
                    self.renderLocalStorage();
                });
            }

            var clear = document.getElementById('btn-storage-clear');
            if (clear) {
                clear.addEventListener('click', function () {
                    self.confirmClearStorage();
                });
            }

            this.container.querySelectorAll('.storage-item-delete').forEach(function (btn) {
                btn.addEventListener('click', function (e) {
                    e.stopPropagation();
                    self.deleteStorageKey(btn.getAttribute('data-delete'));
                });
            });

            this.container.querySelectorAll('.storage-item').forEach(function (el) {
                el.addEventListener('click', function (e) {
                    if (e.target.classList.contains('storage-item-delete')) return;
                    el.classList.toggle('is-expanded');
                });
            });
        },

        deleteStorageKey: function (key) {
            var self = this;

            if (!window.SqlWizardModal) {
                if (!confirm('Apagar "' + key + '"?')) return;
                localStorage.removeItem(key);
                self.renderLocalStorage();
                return;
            }

            window.SqlWizardModal.confirm({
                title: 'Apagar chave',
                body: '<p>Apagar <code>' + this.escape(key) + '</code>?</p>' +
                      '<p class="is-muted">Isto pode afetar o estado do SqlWizard.</p>',
                confirmLabel: 'Apagar',
                cancelLabel: 'Cancelar',
                danger: true,
                onConfirm: function () {
                    localStorage.removeItem(key);
                    self.renderLocalStorage();

                    if (window.SqlWizardToast) {
                        window.SqlWizardToast.success('Chave apagada', { duration: 2000 });
                    }
                }
            });
        },

        confirmClearStorage: function () {
            var self = this;

            var keys = this.collectStorageItems().map(function (i) { return i.key; });

            if (!keys.length) {
                if (window.SqlWizardToast) {
                    window.SqlWizardToast.warning('Não há chaves para apagar');
                }
                return;
            }

            if (!window.SqlWizardModal) {
                if (!confirm('Apagar ' + keys.length + ' chaves do SqlWizard?')) return;
                keys.forEach(function (k) { localStorage.removeItem(k); });
                self.renderLocalStorage();
                return;
            }

            window.SqlWizardModal.confirm({
                title: 'Limpar tudo',
                body: '<p>Apagar <strong>' + keys.length + '</strong> chaves do SqlWizard?</p>' +
                      '<p class="is-muted">Isto vai reiniciar o layout, posições dos cartões, etc.</p>',
                confirmLabel: 'Limpar',
                cancelLabel: 'Cancelar',
                danger: true,
                onConfirm: function () {
                    keys.forEach(function (k) { localStorage.removeItem(k); });
                    self.renderLocalStorage();

                    if (window.SqlWizardToast) {
                        window.SqlWizardToast.success('Chaves apagadas', { duration: 2000 });
                    }
                }
            });
        },



        /* ── Utilidades ─────────────────────────────────────── */

        escape: function (str) {
            return String(str)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        },

    };

    window.SqlWizardExplorer = Explorer;

})(window, document);