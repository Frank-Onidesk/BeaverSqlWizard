/* beaver-framework/plugins/sqlwizard/resources/ui/js/bottom.js */

window.SqlWizardBottom = (function (window, document) {
    'use strict';

    var PER_PAGE = 50;

    var Bottom = {
        activeTab: 'sql',
        currentDraft: null,
        rows: null,          // { columns, rows, total, page, per_page, total_pages }
        loading: false,
        error: null,


        // Sandbox SQL
        sandbox: null,
        sql: '',
        result: null,
        sqlLoading: false,
        sqlError: null,

        /* ── Tabs ───────────────────────────────────────────── */

        setActiveTab: function (name) {
            this.activeTab = name;

            // Se entra na tab SQL e há draft mas ainda não carregámos a sandbox
            if (name === 'sql' && this.currentDraft && this.sandbox === null && !this.sqlLoading) {
                this.loadSandbox(this.currentDraft);
                return;
            }

            this.render();
        },

        /* ── Dados ──────────────────────────────────────────── */

        loadData: function (draft) {
            this.currentDraft = draft;
            this.error = null;
            this.rows = null;

            // Reset do estado SQL
            this.sandbox = null;
            this.sql = '';
            this.result = null;
            this.sqlError = null;
            this.sqlLoading = false;

            if (!draft || !draft.source || !draft.source.connection_id) {
                this.loading = false;
                // Só re-renderiza se estamos na tab Dados
                if (this.activeTab === 'dados') this.render();
                return;
            }

            this.loading = true;
            if (this.activeTab === 'dados') this.render();

            var src = draft.source;
            var self = this;

            window.SqlWizardApi.getRows(
                src.connection_id,
                src.database,
                src.table,
                1,
                PER_PAGE
            )
                .then(function (data) {
                    self.rows = data;
                    self.loading = false;
                    if (self.activeTab === 'dados') self.render();
                })
                .catch(function (err) {
                    self.rows = null;
                    self.loading = false;
                    self.error = err.message || 'Erro';
                    if (self.activeTab === 'dados') self.render();
                });
        },

        goToPage: function (page) {
            if (!this.currentDraft || !this.currentDraft.source) return;

            var src = this.currentDraft.source;
            var self = this;

            this.loading = true;
            this.render();

            window.SqlWizardApi.getRows(
                src.connection_id,
                src.database,
                src.table,
                page,
                PER_PAGE
            )
                .then(function (data) {
                    self.rows = data;
                    self.loading = false;
                    self.render();
                })
                .catch(function (err) {
                    self.loading = false;
                    self.error = err.message || 'Erro';
                    self.render();
                });
        },

        /* ── SQL / Sandbox ─────────────────────────────────── */

        loadSandbox: function (draft) {
            this.currentDraft = draft;
            this.sqlError = null;
            this.result = null;
            this.sandbox = null;

            if (!draft || !draft.source || !draft.source.connection_id) {
                if (this.activeTab === 'sql') this.render();
                return;
            }

            var self = this;

            window.SqlWizardApi.sandboxInfo(draft.id)
                .then(function (res) {
                    self.sandbox = res.exists ? res.sandbox : null;
                    if (self.activeTab === 'sql') self.render();
                })
                .catch(function () {
                    self.sandbox = null;
                    if (self.activeTab === 'sql') self.render();
                });
        },

        createSandbox: function (rows) {
            if (!this.currentDraft) return;

            var self = this;
            this.sqlLoading = true;
            this.sqlError = null;
            this.render();

            window.SqlWizardApi.sandboxCreate(this.currentDraft.id, rows)
                .then(function (res) {
                    self.sandbox = res.sandbox;
                    self.sqlLoading = false;
                    self.render();
                    if (window.SqlWizardToast) {
                        window.SqlWizardToast.success(
                            'Sandbox criada com ' + res.sandbox.rows_copied + ' registos',
                            { duration: 2000 }
                        );
                    }
                })
                .catch(function (err) {
                    self.sqlLoading = false;
                    self.sqlError = err.message || 'Erro';
                    self.render();
                });
        },

        deleteSandbox: function () {
            if (!this.currentDraft) return;

            var self = this;

            if (!window.SqlWizardModal) {
                if (!confirm('Apagar a sandbox?')) return;
                self.doDeleteSandbox();
                return;
            }

            window.SqlWizardModal.confirm({
                title: 'Apagar sandbox',
                body: '<p>Apagar a sandbox SQLite?</p>' +
                    '<p class="is-muted">Os dados temporários serão perdidos.</p>',
                confirmLabel: 'Apagar',
                cancelLabel: 'Cancelar',
                danger: true,
                onConfirm: function () { self.doDeleteSandbox(); }
            });
        },

        doDeleteSandbox: function () {
            var self = this;
            this.sqlLoading = true;
            this.render();

            window.SqlWizardApi.sandboxDelete(this.currentDraft.id)
                .then(function () {
                    self.sandbox = null;
                    self.sqlLoading = false;
                    self.result = null;
                    self.render();
                    if (window.SqlWizardToast) {
                        window.SqlWizardToast.success('Sandbox apagada', { duration: 2000 });
                    }
                })
                .catch(function (err) {
                    self.sqlLoading = false;
                    self.sqlError = err.message || 'Erro';
                    self.render();
                });
        },

        runQuery: function () {
            if (!this.currentDraft || !this.sandbox) return;

            var self = this;
            var ta = document.getElementById('bottom-sql-input');
            var sql = ta ? ta.value.trim() : '';

            if (sql === '') {
                this.sqlError = 'Escreve uma query primeiro.';
                this.render();
                return;
            }

            this.sql = sql;
            this.sqlLoading = true;
            this.sqlError = null;
            this.result = null;
            this.render();

            window.SqlWizardApi.sandboxQuery(this.currentDraft.id, sql)
                .then(function (res) {
                    self.sqlLoading = false;
                    self.result = res;
                    self.render();
                })
                .catch(function (err) {
                    self.sqlLoading = false;
                    self.sqlError = err.message || 'Erro';
                    self.render();
                });
        },

        clearQuery: function () {
            this.sql = '';
            this.result = null;
            this.sqlError = null;
            this.render();
        },

        renderSql: function () {
            var html = [];

            if (!this.currentDraft) {
                return '<p class="bottom-empty">Seleciona uma tabela no canvas</p>';
            }

            if (!this.currentDraft.source || !this.currentDraft.source.connection_id) {
                return '<p class="bottom-empty">Este draft não tem tabela de origem.</p>' +
                    '<p class="bottom-empty" style="font-size: 11px;">' +
                    'Só drafts importados de uma ligação podem ter sandbox SQL.</p>';
            }

            var src = this.currentDraft.source;

            html.push('<div class="bottom-sql-bar">');

            if (this.sandbox) {
                var expires = this.sandbox.expires_at || '';
                var expiresShort = expires ? expires.substring(0, 10) : '—';

                html.push(
                    '<span class="bottom-sql-badge">Sandbox: ' + this.escape(src.table) + '</span>',
                    '<span class="bottom-sql-meta">' +
                    this.sandbox.rows_copied + '/' + this.sandbox.original_total +
                    ' registos · expira ' + this.escape(expiresShort) +
                    '</span>'
                );

                html.push('<span class="bottom-sql-spacer"></span>');

                html.push(
                    '<button class="bottom-sql-btn" data-rows="10">🔄 10</button>',
                    '<button class="bottom-sql-btn" data-rows="50">🔄 50</button>',
                    '<button class="bottom-sql-btn" data-rows="100">🔄 100</button>',
                    '<button class="bottom-sql-btn is-danger" data-action="delete-sandbox">🗑</button>'
                );
            } else {
                html.push(
                    '<span class="bottom-sql-meta">Sem sandbox. Cria uma para executar SQL.</span>',
                    '<span class="bottom-sql-spacer"></span>',
                    '<button class="bottom-sql-btn is-primary" data-rows="10">+ Criar (10)</button>',
                    '<button class="bottom-sql-btn" data-rows="50">+ Criar (50)</button>',
                    '<button class="bottom-sql-btn" data-rows="100">+ Criar (100)</button>'
                );
            }

            html.push('</div>');

            if (this.sqlLoading) {
                html.push('<p class="bottom-empty">A executar...</p>');
                return html.join('');
            }

            if (!this.sandbox) {
                if (this.sqlError) {
                    html.push('<p class="bottom-error">⚠ ' + this.escape(this.sqlError) + '</p>');
                }
                return html.join('');
            }

            html.push(
                '<div class="bottom-sql-editor">',
                '  <textarea id="bottom-sql-input" class="bottom-sql-textarea" ' +
                'placeholder="SELECT * FROM ' + this.escape(src.table) + ' LIMIT 10;">' +
                this.escape(this.sql) +
                '</textarea>',
                '</div>'
            );

            html.push(
                '<div class="bottom-sql-actions">',
                '  <button class="bottom-sql-btn is-primary" data-action="run">▶ Executar</button>',
                '  <button class="bottom-sql-btn" data-action="clear">⌫ Limpar</button>',
                '</div>'
            );

            if (this.sqlError) {
                html.push('<p class="bottom-error">⚠ ' + this.escape(this.sqlError) + '</p>');
            }

            if (this.result) {
                html.push(this.renderSqlResult(this.result));
            }

            return html.join('');
        },

        renderSqlResult: function (res) {
            if (!res.ok) {
                return '<p class="bottom-error">⚠ ' + this.escape(res.error || 'Erro') + '</p>';
            }

            var html = [];

            if (res.type === 'write') {
                html.push(
                    '<div class="bottom-sql-info">',
                    '  ✓ ' + res.affected + ' linha' + (res.affected === 1 ? '' : 's') +
                    ' afetada' + (res.affected === 1 ? '' : 's') +
                    ' · ' + res.elapsed_ms + ' ms',
                    '</div>'
                );
                return html.join('');
            }

            if (!res.rows || !res.rows.length) {
                html.push(
                    '<div class="bottom-sql-info">Sem resultados · ' + res.elapsed_ms + ' ms</div>'
                );
                return html.join('');
            }

            html.push('<div class="bottom-data-table-wrap">');
            html.push('<table class="bottom-data-table">');

            html.push('<thead><tr>');
            res.columns.forEach(function (c) {
                html.push('<th>' + this.escape(c) + '</th>');
            }, this);
            html.push('</tr></thead>');

            html.push('<tbody>');
            res.rows.forEach(function (row) {
                html.push('<tr>');
                res.columns.forEach(function (c) {
                    var val = row[c];
                    var isNull = (val === null || val === undefined);
                    var display = isNull ? '—' : String(val);

                    html.push('<td' + (isNull ? ' class="is-null"' : '') + '>' +
                        this.escape(display) + '</td>');
                }, this);
                html.push('</tr>');
            }, this);
            html.push('</tbody>');

            html.push('</table>');
            html.push('</div>');

            html.push(
                '<div class="bottom-sql-info">' +
                res.rowcount + ' linha' + (res.rowcount === 1 ? '' : 's') +
                ' · ' + res.elapsed_ms + ' ms' +
                '</div>'
            );

            return html.join('');
        },

        bindSqlEvents: function () {
            var self = this;
            var container = document.getElementById('bottom-body');
            if (!container) return;

            container.querySelectorAll('[data-rows]').forEach(function (btn) {
                btn.addEventListener('click', function () {
                    var rows = parseInt(btn.getAttribute('data-rows'), 10);
                    self.createSandbox(rows);
                });
            });

            var del = container.querySelector('[data-action="delete-sandbox"]');
            if (del) {
                del.addEventListener('click', function () { self.deleteSandbox(); });
            }

            var run = container.querySelector('[data-action="run"]');
            if (run) {
                run.addEventListener('click', function () { self.runQuery(); });
            }

            var clear = container.querySelector('[data-action="clear"]');
            if (clear) {
                clear.addEventListener('click', function () { self.clearQuery(); });
            }

            var ta = document.getElementById('bottom-sql-input');
            if (ta) {
                ta.addEventListener('keydown', function (e) {
                    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                        e.preventDefault();
                        self.runQuery();
                    }
                    self.sql = ta.value;
                });
            }
        },


        /* ── Render ─────────────────────────────────────────── */

        render: function () {
            var container = document.getElementById('bottom-body');
            if (!container) return;

            if (this.activeTab === 'dados') {
                container.innerHTML = this.renderData();
                this.bindDataEvents();
            } else if (this.activeTab === 'sql') {
                container.innerHTML = this.renderSql();
                this.bindSqlEvents();
            } else {
                container.innerHTML =
                    '<pre class="bottom-pre">-- ' + this.escape(this.activeTab) + '</pre>';
            }
        },

        renderData: function () {
            var html = [];

            // Sem draft selecionado
            if (!this.currentDraft) {
                return '<p class="bottom-empty">Seleciona uma tabela no canvas</p>';
            }

            // Sem source
            if (!this.currentDraft.source || !this.currentDraft.source.connection_id) {
                return '<p class="bottom-empty">Este draft não tem tabela de origem.</p>' +
                    '<p class="bottom-empty" style="font-size: 11px;">' +
                    'Só drafts importados de uma ligação têm dados.</p>';
            }

            var src = this.currentDraft.source;

            // ── Header com info da origem + paginação (topo) ──
            html.push('<div class="bottom-data-header">');

            html.push(
                '<span class="bottom-data-source">' +
                this.escape(src.database + '.' + src.table) +
                '</span>'
            );

            html.push(
                '<span class="bottom-data-conn">' +
                '· ' + this.escape(src.driver) +
                '</span>'
            );

            html.push('<span class="bottom-data-spacer"></span>');

            // Paginação topo (só se houver dados)
            if (this.rows && !this.loading && !this.error) {
                html.push(this.renderPagination(this.rows, 'top'));
            }

            html.push('</div>');

            // Loading
            if (this.loading) {
                html.push('<p class="bottom-empty">A carregar...</p>');
                return html.join('');
            }

            // Erro
            if (this.error) {
                html.push('<p class="bottom-error">⚠ ' + this.escape(this.error) + '</p>');
                return html.join('');
            }

            // Sem dados
            if (!this.rows) {
                html.push('<p class="bottom-empty">Sem dados.</p>');
                return html.join('');
            }

            var data = this.rows;

            // Tabela vazia
            if (!data.rows || !data.rows.length) {
                html.push('<p class="bottom-empty">Tabela vazia.</p>');

                html.push('<div class="bottom-pagination-bottom">');
                html.push(this.renderPagination(data, 'bottom'));
                html.push('</div>');

                return html.join('');
            }

            // ── Grelha ──
            html.push('<div class="bottom-data-table-wrap">');
            html.push('<table class="bottom-data-table">');

            // Header
            html.push('<thead><tr>');
            data.columns.forEach(function (c) {
                html.push('<th>' + this.escape(c) + '</th>');
            }, this);
            html.push('</tr></thead>');

            // Body
            html.push('<tbody>');
            data.rows.forEach(function (row) {
                html.push('<tr>');
                data.columns.forEach(function (c) {
                    var val = row[c];
                    var display = (val === null || val === undefined) ? '—' : String(val);
                    var isNull = (val === null || val === undefined);

                    html.push('<td' + (isNull ? ' class="is-null"' : '') + '>' +
                        this.escape(display) + '</td>');
                }, this);
                html.push('</tr>');
            }, this);
            html.push('</tbody>');

            html.push('</table>');
            html.push('</div>');

            // ── Paginação (fundo) ──
            html.push('<div class="bottom-pagination-bottom">');
            html.push(this.renderPagination(data, 'bottom'));
            html.push('</div>');

            return html.join('');
        },
        renderPagination: function (data, position) {
            position = position || 'top';

            if (!data) {
                return '';
            }

            // Só 1 página → mostra "Página 1 de 1" + total
            if (data.total_pages <= 1) {
                var label = data.total_pages === 1 ? 'Página 1 de 1' : 'Sem páginas';
                return '<span class="bottom-pagination-info">' +
                    label + ' · ' + data.total + ' registo' + (data.total === 1 ? '' : 's') +
                    '</span>';
            }
            if (!data || data.total_pages <= 1) {
                return '<div class="bottom-pagination">' +
                    '<span class="bottom-pagination-info">' +
                    data.total + ' registo' + (data.total === 1 ? '' : 's') +
                    '</span></div>';
            }



            var page = data.page;
            var totalPages = data.total_pages;
            var from = (page - 1) * data.per_page + 1;
            var to = Math.min(page * data.per_page, data.total);

            var html = ['<div class="bottom-pagination">'];

            // Info
            html.push('<span class="bottom-pagination-info">' +
                from + '-' + to + ' de ' + data.total + '</span>');

            // Botões
            html.push('<span class="bottom-pagination-buttons">');

            // Anterior
            html.push('<button class="bottom-page-btn" data-page="' + (page - 1) + '"' +
                (page === 1 ? ' disabled' : '') + '>◀</button>');

            // Números
            var start = Math.max(1, page - 2);
            var end = Math.min(totalPages, page + 2);

            if (start > 1) {
                html.push('<button class="bottom-page-btn" data-page="1">1</button>');
                if (start > 2) html.push('<span class="bottom-page-ellipsis">…</span>');
            }

            for (var i = start; i <= end; i++) {
                var cls = 'bottom-page-btn' + (i === page ? ' is-active' : '');
                html.push('<button class="' + cls + '" data-page="' + i + '">' + i + '</button>');
            }

            if (end < totalPages) {
                if (end < totalPages - 1) html.push('<span class="bottom-page-ellipsis">…</span>');
                html.push('<button class="bottom-page-btn" data-page="' + totalPages + '">' + totalPages + '</button>');
            }

            // Próxima
            html.push('<button class="bottom-page-btn" data-page="' + (page + 1) + '"' +
                (page === totalPages ? ' disabled' : '') + '>▶</button>');

            html.push('</span>');

            html.push('</div>');

            return html.join('');
        },

        bindDataEvents: function () {
            var self = this;

            var container = document.getElementById('bottom-body');
            if (!container) return;

            container.querySelectorAll('[data-page]').forEach(function (btn) {
                btn.addEventListener('click', function () {
                    if (btn.disabled) return;
                    var page = parseInt(btn.getAttribute('data-page'), 10);
                    if (page < 1) return;
                    self.goToPage(page);
                });
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

    return Bottom;

})(window, document);
