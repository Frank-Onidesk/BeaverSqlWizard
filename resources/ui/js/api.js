window.SqlWizardApi = (function () {
    'use strict';

    var BASE = '/api/sqlwizard';

    function request(method, path, body) {
        var opts = {
            method: method,
            headers: { 'Accept': 'application/json' }
        };

        if (body !== undefined) {
            opts.headers['Content-Type'] = 'application/json';
            opts.body = JSON.stringify(body);
        }

        return fetch(BASE + path, opts).then(function (res) {
            return res.json().catch(function () { return null; }).then(function (data) {
                if (!res.ok) {
                    var msg = (data && data.error) || ('HTTP ' + res.status);
                    var err = new Error(msg);
                    err.status = res.status;
                    err.data = data;
                    throw err;
                }
                return data;
            });
        });
    }

    return {
        listDrafts: function () {
            return request('GET', '/drafts');
        },
        getDraft: function (id) {
            return request('GET', '/drafts/' + encodeURIComponent(id));
        },
        updateDraftSql: function (id, sql) {
            return request('PUT', '/drafts/' + encodeURIComponent(id), { sql: sql });
        },
        deleteDraft: function (id) {
            return request('DELETE', '/drafts/' + encodeURIComponent(id));
        },
        createDraft: function (payload) {
            return request('POST', '/drafts', payload);
        },
        testConnection: function (payload) {
            return request('POST', '/connections/test', payload);
        },
        listConnections: function () {
            return request('GET', '/connections');
        },
        createConnection: function (payload) {
            return request('POST', '/connections', payload);
        },
        updateConnection: function (id, payload) {
            return request('PUT', '/connections/' + encodeURIComponent(id), payload);
        },
        deleteConnection: function (id) {
            return request('DELETE', '/connections/' + encodeURIComponent(id));
        },
        getDatabases: function (connId) {
            return request('GET', '/connections/' + encodeURIComponent(connId) + '/databases');
        },
        getTables: function (connId, db) {
            return request('GET', '/connections/' + encodeURIComponent(connId)
                + '/databases/' + encodeURIComponent(db) + '/tables');
        },
        importTable: function (connId, db, table) {
            return request('POST',
                '/connections/' + encodeURIComponent(connId)
                + '/databases/' + encodeURIComponent(db)
                + '/tables/' + encodeURIComponent(table)
                + '/import'
            );
        },
        updateDraftFull: function (id, payload) {
            return request('PUT', '/drafts/' + encodeURIComponent(id) + '/full', payload);
        },
        getRows: function (connId, db, table, page, perPage) {
            page = page || 1;
            perPage = perPage || 50;

            var url = '/connections/' + encodeURIComponent(connId)
                + '/databases/' + encodeURIComponent(db)
                + '/tables/' + encodeURIComponent(table)
                + '/rows'
                + '?page=' + page + '&per_page=' + perPage;

            return request('GET', url);
        },

        // sandbox
        sandboxCreate: function (draftId, rows) {
            return request('POST', '/drafts/' + encodeURIComponent(draftId) + '/sandbox', { rows: rows || 10 });
        },
        sandboxInfo: function (draftId) {
            return request('GET', '/drafts/' + encodeURIComponent(draftId) + '/sandbox');
        },
        sandboxDelete: function (draftId) {
            return request('DELETE', '/drafts/' + encodeURIComponent(draftId) + '/sandbox');
        },
        sandboxQuery: function (draftId, sql) {
            return request('POST', '/drafts/' + encodeURIComponent(draftId) + '/query', { sql: sql });
        },
    };
})();