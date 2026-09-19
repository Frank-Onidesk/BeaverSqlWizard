window.SqlWizardConnectionsForm = (function (window, document) {
    'use strict';

    var DRIVERS = [
        { value: 'mysql', label: 'MySQL / MariaDB' },
        { value: 'pgsql', label: 'PostgreSQL' },
        { value: 'sqlite', label: 'SQLite' }
    ];

    var PORTS = {
        mysql: '3306',
        pgsql: '5432',
        sqlite: ''
    };

    function open(connection) {
        var isEdit = !!connection;

        var defaults = {
            name: isEdit ? connection.name : '',
            driver: isEdit ? connection.driver : 'mysql',
            host: isEdit ? connection.host : 'localhost',
            port: isEdit ? connection.port : '3306',
            database: isEdit ? connection.database : '',
            username: isEdit ? connection.username : 'root',
            password: isEdit ? connection.password : ''
        };

        window.SqlWizardModal.form({
            title: isEdit ? 'Editar ligação' : 'Nova ligação',
            body: '<p class="is-muted" style="margin-bottom: 12px;">' +
                (isEdit
                    ? 'Edita os detalhes da ligação "' + escape(connection.name) + '".'
                    : 'Configura os detalhes da ligação. Ainda não é guardada — só testa.') +
                '</p>',
            confirmLabel: isEdit ? 'Guardar alterações' : 'Guardar',
            cancelLabel: 'Cancelar',
            extraButtons: [
                { id: 'test', label: 'Testar' }
            ],
            fields: [
                {
                    name: 'name',
                    label: 'Nome',
                    value: defaults.name,
                    placeholder: 'Local (dev)',
                    required: true
                },
                {
                    name: 'driver',
                    label: 'Driver',
                    type: 'select',
                    value: defaults.driver,
                    options: DRIVERS
                },
                {
                    name: 'host',
                    label: 'Host',
                    value: defaults.host,
                    placeholder: 'localhost'
                },
                {
                    name: 'port',
                    label: 'Porta',
                    value: defaults.port,
                    placeholder: '3306'
                },
                {
                    name: 'database',
                    label: 'Base de dados',
                    value: defaults.database,
                    placeholder: '(opcional)',
                    hint: 'Deixa vazio para ligar só ao servidor'
                },
                {
                    name: 'username',
                    label: 'Utilizador',
                    value: defaults.username,
                    placeholder: 'root'
                },
                {
                    name: 'password',
                    label: 'Password',
                    type: 'password',
                    value: defaults.password,
                    placeholder: '',
                    autocomplete: 'new-password'
                }

            ],
            onExtra: function (id, values) {
                if (id === 'test') {
                    testConnection(values);
                }
            },
            onConfirm: function (values) {
                saveConnection(values);
            }
        });

        // Autopreencher a porta quando muda o driver
        setTimeout(function () {
            bindDriverChange(isEdit);
        }, 20);
    }

    function bindDriverChange(skipPort) {
        var driverEl = document.querySelector('[data-name="driver"]');
        var portEl = document.querySelector('[data-name="port"]');
        var hostEl = document.querySelector('[data-name="host"]');
        var dbEl = document.querySelector('[data-name="database"]');

        if (!driverEl) return;

        driverEl.addEventListener('change', function () {
            var driver = driverEl.value;

            // Se skipPort, não reseta a porta (modo edição)
            if (!skipPort && portEl && PORTS[driver] !== undefined) {
                portEl.value = PORTS[driver];
            }

            var isSqlite = driver === 'sqlite';
            if (hostEl) hostEl.disabled = isSqlite;
            if (portEl) portEl.disabled = isSqlite;
            if (dbEl) {
                dbEl.placeholder = isSqlite ? '/caminho/para/database.sqlite' : '(opcional)';
            }
        });

        // Aplicar estado inicial (SQLite desativa host/porta)
        if (driverEl.value === 'sqlite') {
            if (hostEl) hostEl.disabled = true;
            if (portEl) portEl.disabled = true;
        }
    }

    function testConnection(values) {
        console.log('[connections] testar:', values);

        var errors = validate(values);

        if (errors.length) {
            alert('Erros:\n\n' + errors.join('\n'));
            return;
        }

        // Feedback imediato — o utilizador vê que algo está a acontecer
        var btn = document.querySelector('[data-role="extra"][data-extra="test"]');
        var originalLabel = btn ? btn.textContent : '';

        if (btn) {
            btn.disabled = true;
            btn.textContent = 'A testar...';
        }

        window.SqlWizardApi.testConnection(values)
            .then(function (res) {
                if (res && res.ok) {
                    var msg = '✓ ' + (res.message || 'Ligação OK');
                    if (res.elapsed_ms) {
                        msg += '\n\nTempo: ' + res.elapsed_ms + ' ms';
                    }
                    if (res.server_version) {
                        msg += '\nServidor: ' + res.server_version;
                    }
                    alert(msg);
                } else {
                    alert('✗ Erro\n\n' + ((res && res.error) || 'Erro desconhecido'));
                }
            })
            .catch(function (err) {
                alert('✗ Erro de rede\n\n' + err.message);
            })
            .finally(function () {
                if (btn) {
                    btn.disabled = false;
                    btn.textContent = originalLabel;
                }
            });
    }

       function saveConnection(values) {
        console.log('[connections] guardar:', values);

        var errors = validate(values);

        if (errors.length) {
            alert('Erros:\n\n' + errors.join('\n'));
            return;
        }

        // Enviar pedido de gravação para o Explorer
        // (que é quem gere a lista de ligações)
        window.dispatchEvent(new CustomEvent('sqlwizard:connection-save', {
            detail: { connection: values }
        }));
    }

    function validate(values) {
        var errors = [];

        if (!values.name || !values.name.trim()) {
            errors.push('• Nome é obrigatório');
        }

        var isSqlite = values.driver === 'sqlite';

        if (!isSqlite) {
            if (!values.host || !values.host.trim()) {
                errors.push('• Host é obrigatório');
            }
            if (!values.port || !values.port.trim()) {
                errors.push('• Porta é obrigatória');
            }
            if (!values.username || !values.username.trim()) {
                errors.push('• Utilizador é obrigatório');
            }
        } else {
            if (!values.database || !values.database.trim()) {
                errors.push('• Caminho do ficheiro SQLite é obrigatório');
            }
        }


        return errors;
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
        open: open
    };

})(window, document);