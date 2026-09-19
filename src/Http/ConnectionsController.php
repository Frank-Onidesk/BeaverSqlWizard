<?php

namespace Beaver\Plugins\SqlWizard\Http;

use Beaver\Http\Request;
use Beaver\Http\Response;
use Beaver\Plugins\SqlWizard\Storage\ConnectionStore;
use Beaver\Plugins\SqlWizard\Storage\SandboxManager;

/**
 * Controller de ligações a bases de dados.
 *
 * - Testa ligações
 * - Lista bases de dados
 * - Lista tabelas
 * - CRUD de ligações (guardadas em storage/connections.local.json)
 */
class ConnectionsController
{
    private ConnectionStore $store;

    private \Beaver\Plugins\SqlWizard\Storage\SandboxManager $sandbox;

    public function __construct()
    {
        $basePath   = \Beaver\Foundation\Application::getInstance()->basePath;
        $pluginPath = $basePath . '/plugins/sqlwizard';

        $this->store = new ConnectionStore($pluginPath);

         $this->sandbox = new \Beaver\Plugins\SqlWizard\Storage\SandboxManager($pluginPath);

          // Limpeza automática de sandboxes expiradas
        try {
            $this->sandbox->pruneExpired();
        } catch (\Throwable) {
            // silencioso
        }
    }

    /* ==========================================================
     * Testar ligação
     * ========================================================== */

    public function test(Request $request): Response
    {
        $body = $request->body;

        $driver   = strtolower(trim((string) ($body['driver']   ?? 'mysql')));
        $host     = trim((string) ($body['host']     ?? 'localhost'));
        $port     = trim((string) ($body['port']     ?? ''));
        $database = trim((string) ($body['database'] ?? ''));
        $username = trim((string) ($body['username'] ?? ''));
        $password = (string) ($body['password'] ?? '');

        if (!in_array($driver, ['mysql', 'pgsql', 'sqlite'], true)) {
            return Response::json(['ok' => false, 'error' => "Driver não suportado: {$driver}"]);
        }

        if ($driver !== 'sqlite') {
            if ($host === '') {
                return Response::json(['ok' => false, 'error' => 'Host em falta']);
            }
            if ($port === '') {
                return Response::json(['ok' => false, 'error' => 'Porta em falta']);
            }
        } else {
            if ($database === '') {
                return Response::json(['ok' => false, 'error' => 'Caminho do ficheiro SQLite em falta']);
            }

            try {
                $database = $this->resolveSqlitePath($database);
            } catch (\Throwable $e) {
                return Response::json(['ok' => false, 'error' => $e->getMessage()]);
            }
        }

        $start = microtime(true);

        try {
            $dsn = $this->buildDsn($driver, $host, $port, $database);

            $pdo = new \PDO($dsn, $username, $password, [
                \PDO::ATTR_ERRMODE            => \PDO::ERRMODE_EXCEPTION,
                \PDO::ATTR_TIMEOUT            => 5,
                \PDO::ATTR_DEFAULT_FETCH_MODE => \PDO::FETCH_ASSOC,
            ]);

            $pdo->query('SELECT 1');

            $elapsed = (int) ((microtime(true) - $start) * 1000);

            $version = null;
            try {
                $version = $pdo->getAttribute(\PDO::ATTR_SERVER_VERSION);
            } catch (\Throwable) {
            }

            return Response::json([
                'ok'             => true,
                'message'        => 'Ligação estabelecida com sucesso',
                'elapsed_ms'     => $elapsed,
                'server_version' => $version,
            ]);
        } catch (\PDOException $e) {
            return Response::json(['ok' => false, 'error' => $this->friendlyError($e)]);
        } catch (\Throwable $e) {
            return Response::json(['ok' => false, 'error' => $e->getMessage()]);
        }
    }

    /* ==========================================================
     * Listar bases de dados
     * ========================================================== */

    public function databases(string $id): Response
    {
        $conn = $this->store->find($id);

        if ($conn === null) {
            return Response::json(['error' => 'Ligação não encontrada'], 404);
        }

        try {
            $pdo = $this->connect($conn, false);
            $list = $this->listDatabases($pdo, (string) $conn['driver']);
            return Response::json(['databases' => $list]);
        } catch (\PDOException $e) {
            return Response::json(['error' => $this->friendlyError($e)]);
        } catch (\Throwable $e) {
            return Response::json(['error' => $e->getMessage()]);
        }
    }

    /* ==========================================================
     * Listar tabelas
     * ========================================================== */

    public function tables(string $id, string $db): Response
    {
        $conn = $this->store->find($id);

        if ($conn === null) {
            return Response::json(['error' => 'Ligação não encontrada'], 404);
        }

        try {
            $pdo = $this->connect($conn, true, $db);
            $list = $this->listTables($pdo, (string) $conn['driver']);
            return Response::json(['tables' => $list]);
        } catch (\PDOException $e) {
            return Response::json(['error' => $this->friendlyError($e)]);
        } catch (\Throwable $e) {
            return Response::json(['error' => $e->getMessage()]);
        }
    }


        /**
     * GET /api/sqlwizard/connections/{id}/databases/{db}/tables/{table}/rows
     *
     * Devolve as primeiras N linhas de uma tabela real.
     *
     * Query params:
     *   page      (default 1)
     *   per_page  (default 50, máx 500)
     */
    public function rows(string $id, string $db, string $table, Request $request): Response
    {
        $conn = $this->store->find($id);

        if ($conn === null) {
            return Response::json(['error' => 'Ligação não encontrada'], 404);
        }

        $query  = $request->query ?? [];
        $page   = max(1, (int) ($query['page'] ?? 1));
        $perPage = min(500, max(1, (int) ($query['per_page'] ?? 50)));

        $driver = (string) ($conn['driver'] ?? 'mysql');

        // Validar nome da tabela (evitar SQL injection em identificadores)
        if (!preg_match('/^[A-Za-z0-9_]+$/', $table)) {
            return Response::json(['error' => 'Nome de tabela inválido'], 422);
        }

        try {
            $pdo = $this->connect($conn, true, $db);
        } catch (\PDOException $e) {
            return Response::json(['error' => $this->friendlyError($e)]);
        } catch (\Throwable $e) {
            return Response::json(['error' => $e->getMessage()]);
        }

        // Contar total
        try {
            $total = (int) $pdo->query("SELECT COUNT(*) FROM {$this->quoteIdent($table, $driver)}")->fetchColumn();
        } catch (\PDOException $e) {
            return Response::json(['error' => $this->friendlyError($e)]);
        }

        $totalPages = max(1, (int) ceil($total / $perPage));
        $offset     = ($page - 1) * $perPage;

        // Buscar linhas
        try {
            $sql = sprintf(
                'SELECT * FROM %s LIMIT %d OFFSET %d',
                $this->quoteIdent($table, $driver),
                $perPage,
                $offset
            );

            $stmt = $pdo->query($sql);
            $rows = $stmt->fetchAll(\PDO::FETCH_ASSOC);
        } catch (\PDOException $e) {
            return Response::json(['error' => $this->friendlyError($e)]);
        }

        // Extrair colunas (do primeiro row, ou do schema se vazio)
        $columns = $rows ? array_keys($rows[0]) : $this->getColumnNames($pdo, $table, $driver);

        return Response::json([
            'columns'     => $columns,
            'rows'        => $rows,
            'total'       => $total,
            'page'        => $page,
            'per_page'    => $perPage,
            'total_pages' => $totalPages,
        ]);
    }

    /**
     * Quoting de identificadores por driver.
     */
    private function quoteIdent(string $name, string $driver): string
    {
        return match ($driver) {
            'mysql'  => '`' . $name . '`',
            'pgsql'  => '"' . $name . '"',
            'sqlite' => '"' . $name . '"',
            default  => $name,
        };
    }

    /**
     * Devolve os nomes das colunas de uma tabela.
     *
     * @return string[]
     */
    private function getColumnNames(\PDO $pdo, string $table, string $driver): array
    {
        try {
            if ($driver === 'sqlite') {
                $stmt = $pdo->query("PRAGMA table_info(" . $this->quoteIdent($table, $driver) . ")");
                $rows = $stmt->fetchAll();
                return array_column($rows, 'name');
            }

            if ($driver === 'pgsql') {
                $stmt = $pdo->prepare(
                    "SELECT column_name FROM information_schema.columns
                     WHERE table_name = :t AND table_schema = 'public'
                     ORDER BY ordinal_position"
                );
                $stmt->execute([':t' => $table]);
                return array_column($stmt->fetchAll(), 'column_name');
            }

            // MySQL
            $stmt = $pdo->query("SHOW COLUMNS FROM " . $this->quoteIdent($table, $driver));
            $rows = $stmt->fetchAll(\PDO::FETCH_ASSOC);
            return array_column($rows, 'Field');
        } catch (\Throwable $e) {
            return [];
        }
    }



        /**
     * POST /api/sqlwizard/connections/{id}/databases/{db}/tables/{table}/import
     *
     * Importa uma tabela real como novo draft.
     */
    public function importTable(string $id, string $db, string $table): Response
    {
        $conn = $this->store->find($id);

        if ($conn === null) {
            return Response::json(['error' => 'Ligação não encontrada'], 404);
        }

        $driver = (string) ($conn['driver'] ?? 'mysql');

        try {
            $pdo = $this->connect($conn, true, $db);
            $schema = $this->readTableSchema($pdo, $driver, $table);
        } catch (\PDOException $e) {
            return Response::json(['error' => $this->friendlyError($e)]);
        } catch (\Throwable $e) {
            return Response::json(['error' => $e->getMessage()]);
        }

        if ($schema === null) {
            return Response::json(['error' => "Tabela não encontrada: {$table}"], 404);
        }

        $fields = $schema['fields'];
        $sql    = $schema['sql'];

        // ID do draft
        $draftId = 'import_' . $db . '_' . $table;

        // Gerar SQL com o Blueprint (a partir dos fields)
        try {
            $generatedSql = $this->buildSqlFromFields($table, $fields, $driver);
        } catch (\Throwable $e) {
            return Response::json(['error' => 'Erro a gerar SQL: ' . $e->getMessage()]);
        }

        // Criar draftmapMysqlTypeToBeaver
             $draft = new \Beaver\Draft\Draft(
                 id:        $draftId,
                 action:    'create_table',
                 table:     $table,
                 fields:    $fields,
                 sql:       $generatedSql,
                 createdAt: date('c'),
                 source: [
                 'connection_id' => $id,
                 'database'      => $db,
                 'table'         => $table,
                 'driver'        => $driver,
                 'imported_at'   => date('c'),
                 ],
             );

        // Store dos drafts
        $basePath   = \Beaver\Foundation\Application::getInstance()->basePath;
        $draftsPath = rtrim($basePath, '/') . '/database/drafts';

        $draftStore = new \Beaver\Draft\DraftStore($draftsPath);

        try {
            $draftStore->save($draft);
        } catch (\Throwable $e) {
            return Response::json(['error' => 'Erro ao gravar draft: ' . $e->getMessage()], 500);
        }

        return Response::json([
            'ok'    => true,
            'draft' => [
                'id'         => $draft->id,
                'action'     => $draft->action,
                'table'      => $draft->table,
                'fields'     => $draft->fields,
                'sql'        => $draft->sql,
                'created_at' => $draft->createdAt,
            ],
            'source' => [
                'database' => $db,
                'table'    => $table,
                'driver'   => $driver,
            ],
        ]);
    }

    /* ==========================================================
     * CRUD
     * ========================================================== */

    public function index(): Response
    {
        return Response::json(['connections' => $this->store->all()]);
    }

    public function store(Request $request): Response
    {
        $body = $request->body;
        $name = trim((string) ($body['name'] ?? ''));

        if ($name === '') {
            return Response::json(['error' => 'Nome é obrigatório'], 422);
        }

        if ($this->store->nameExists($name)) {
            return Response::json([
                'error' => "Já existe uma ligação com o nome \"{$name}\"",
            ], 409);
        }

        try {
            $conn = $this->store->create($body);
        } catch (\Throwable $e) {
            return Response::json(['error' => 'Erro ao guardar: ' . $e->getMessage()], 500);
        }

        return Response::json(['ok' => true, 'connection' => $conn], 201);
    }

    public function update(string $id, Request $request): Response
    {
        if ($this->store->find($id) === null) {
            return Response::json(['error' => 'Ligação não encontrada'], 404);
        }

        $body = $request->body;
        $name = trim((string) ($body['name'] ?? ''));

        if ($name === '') {
            return Response::json(['error' => 'Nome é obrigatório'], 422);
        }

        if ($this->store->nameExists($name, $id)) {
            return Response::json([
                'error' => "Já existe outra ligação com o nome \"{$name}\"",
            ], 409);
        }

        try {
            $conn = $this->store->update($id, $body);
        } catch (\Throwable $e) {
            return Response::json(['error' => 'Erro ao atualizar: ' . $e->getMessage()], 500);
        }

        if ($conn === null) {
            return Response::json(['error' => 'Ligação não encontrada'], 404);
        }

        return Response::json(['ok' => true, 'connection' => $conn]);
    }

    public function delete(string $id): Response
    {
        if (!$this->store->delete($id)) {
            return Response::json(['error' => 'Ligação não encontrada'], 404);
        }

        return Response::json(['ok' => true, 'id' => $id]);
    }

    /* ==========================================================
     * Helpers
     * ========================================================== */

    /**
     * Constrói um PDO a partir de um registo de ligação.
     *
     * @param array<string, mixed> $conn
     */
    private function connect(array $conn, bool $withDatabase = true, string $overrideDb = ''): \PDO
    {
        $driver = (string) ($conn['driver'] ?? 'mysql');
        $host   = (string) ($conn['host'] ?? '');
        $port   = (string) ($conn['port'] ?? '');
        $db     = $overrideDb !== '' ? $overrideDb : (string) ($conn['database'] ?? '');
        $user   = (string) ($conn['username'] ?? '');
        $pass   = (string) ($conn['password'] ?? '');

        if ($driver === 'sqlite') {
            $db  = $this->resolveSqlitePath($db);
            $dsn = "sqlite:{$db}";
        } else {
            $dsn = "{$driver}:host={$host}";

            if ($port !== '') {
                $dsn .= ";port={$port}";
            }

            if ($withDatabase && $db !== '') {
                $dsn .= ";dbname={$db}";
            }
        }

        return new \PDO($dsn, $user, $pass, [
            \PDO::ATTR_ERRMODE            => \PDO::ERRMODE_EXCEPTION,
            \PDO::ATTR_TIMEOUT            => 5,
            \PDO::ATTR_DEFAULT_FETCH_MODE => \PDO::FETCH_ASSOC,
        ]);
    }

        /**
     * Lê o schema de uma tabela real.
     *
     * @return array{fields: string[], sql: string}|null
     */
    private function readTableSchema(\PDO $pdo, string $driver, string $table): ?array
    {
        if ($driver === 'sqlite') {
            return $this->readTableSchemaSqlite($pdo, $table);
        }

        if ($driver === 'pgsql') {
            return $this->readTableSchemaPgsql($pdo, $table);
        }

        return $this->readTableSchemaMysql($pdo, $table);
    }

    /**
     * @return string[]
     */
    private function listDatabases(\PDO $pdo, string $driver): array
    {
        if ($driver === 'sqlite') {
            return ['main'];
        }

        if ($driver === 'pgsql') {
            $rows = $pdo->query("SELECT datname FROM pg_database WHERE datistemplate = false ORDER BY datname")->fetchAll();
            return array_column($rows, 'datname');
        }

        $rows = $pdo->query("SHOW DATABASES")->fetchAll(\PDO::FETCH_COLUMN);
        return $rows ?: [];
    }

    /**
     * @return string[]
     */
    private function listTables(\PDO $pdo, string $driver): array
    {
        if ($driver === 'sqlite') {
            $rows = $pdo->query("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")->fetchAll();
            return array_column($rows, 'name');
        }

        if ($driver === 'pgsql') {
            $rows = $pdo->query("SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename")->fetchAll();
            return array_column($rows, 'tablename');
        }

        $rows = $pdo->query("SHOW TABLES")->fetchAll(\PDO::FETCH_COLUMN);
        return $rows ?: [];
    }


        /**
     * @return array{fields: string[], sql: string}|null
     */
    private function readTableSchemaMysql(\PDO $pdo, string $table): ?array
    {
        // 1. Confirmar que a tabela existe
        $stmt = $pdo->prepare("SHOW TABLES LIKE :t");
        $stmt->execute([':t' => $table]);

        if (!$stmt->fetch()) {
            return null;
        }

        // 2. Ler colunas
        $stmt = $pdo->query("SHOW FULL COLUMNS FROM `{$table}`");
        $columns = $stmt->fetchAll();

        if (!$columns) {
            return null;
        }

        // 3. Ler chaves primárias
        $stmt = $pdo->query("SHOW KEYS FROM `{$table}` WHERE Key_name = 'PRIMARY'");
        $primaryKeys = [];
        foreach ($stmt->fetchAll() as $k) {
            $primaryKeys[$k['Column_name']] = true;
        }

        // 4. Converter para fields
        $fields = [];

        foreach ($columns as $col) {
            $field = $this->columnToField($col, isset($primaryKeys[$col['Field']]));
            if ($field !== null) {
                $fields[] = $field;
            }
        }

        // 5. SQL original (por curiosidade/preview)
        $stmt = $pdo->query("SHOW CREATE TABLE `{$table}`");
        $row  = $stmt->fetch();
        $sql  = $row['Create Table'] ?? '';

        return ['fields' => $fields, 'sql' => $sql];
    }


        /**
     * Converte uma coluna MySQL para sintaxe compacta do Beaver.
     *
     * @param array<string, mixed> $col  Linha de SHOW FULL COLUMNS
     */
    private function columnToField(array $col, bool $isPrimary): ?string
    {
        $name    = (string) $col['Field'];
        $type    = strtolower((string) $col['Type']);      // ex: "int(11)", "varchar(255)"
        $null    = strtoupper((string) $col['Null']) === 'YES';
        $default = $col['Default'];
        $extra   = strtolower((string) ($col['Extra'] ?? ''));   // ex: "auto_increment"

        // Coluna `id` com auto_increment → campo especial `id`
        if ($name === 'id' && $isPrimary && str_contains($extra, 'auto_increment')) {
            return 'id';
        }

        // Timestamps — converter created_at + updated_at em `timestamps`
        // (não aqui — tratamos no fim, na chamada)

        $field = $name . ':' . $this->mapMysqlTypeToBeaver($type);
        $args  = $this->extractTypeArgs($type);

        if ($args !== '') {
            $field .= '(' . $args . ')';
        }

        if ($null) {
            $field .= '?';
        }

        // Default
        if ($default !== null && !$this->isAutoDefault($default)) {
            $field .= '=' . $this->formatDefault($default, $type);
        }

        return $field;
    }

    /**
     * Mapeia tipo MySQL para tipo Beaver.
     */
    private function mapMysqlTypeToBeaver(string $type): string
    {
        // Remove "(...)" do tipo
        $base = preg_replace('/\(.*$/', '', $type);

        return match ($base) {
            'int', 'integer', 'bigint', 'smallint', 'mediumint', 'tinyint' => $this->isTinyintBool($type) ? 'bool' : 'int',
            'varchar', 'char'                                              => 'str',
            'text', 'mediumtext', 'longtext', 'tinytext'                   => 'text',
            'decimal', 'numeric'                                           => 'dec',
            'float', 'double', 'real'                                      => 'float',
            'boolean', 'bool'                                              => 'bool',
            'date'                                                         => 'date',
            'time'                                                         => 'time',
            'datetime', 'timestamp'                                        => 'datetime',
            'json'                                                         => 'json',
            'enum', 'set'                                                  => 'str',
            'uuid'                                                         => 'uuid',
            default                                                        => 'str',
        };
    }

    /**
     * tinyint(1) → bool em MySQL.
     */
    private function isTinyintBool(string $type): bool
    {
        return (bool) preg_match('/^tinyint\(1\)/', $type);
    }

    /**
     * Extrai argumentos do tipo: "varchar(255)" → "255", "decimal(10,2)" → "10,2".
     */
    private function extractTypeArgs(string $type): string
    {
        // ENUM e SET: os "args" são valores, não tamanhos.
        // Devolver o tamanho do maior valor, para uso como VARCHAR(n).
        if (preg_match('/^(enum|set)\((.*)\)$/i', $type, $m)) {
            $values = str_getcsv($m[2], ',', "'");

            $maxLen = 0;
            foreach ($values as $v) {
                $v = trim($v, "' \"");
                if (strlen($v) > $maxLen) {
                    $maxLen = strlen($v);
                }
            }

            // Arredondar para cima (com folga)
            return $maxLen > 0 ? (string) ($maxLen + 10) : '50';
        }

        if (preg_match('/\(([^)]+)\)/', $type, $m)) {
            $args = $m[1];

            // Inteiros com tamanho — ignorar (Beaver não usa)
            if (preg_match('/^(int|bigint|smallint|mediumint|tinyint)\(/', $type)) {
                if (!str_contains($args, ',')) {
                    return '';
                }
            }

            return $args;
        }

        return '';
    }

    /**
     * Ignora defaults gerados automaticamente (ex: CURRENT_TIMESTAMP, NULL).
     */
    private function isAutoDefault(mixed $default): bool
    {
        if ($default === null) {
            return true;
        }

        $d = strtoupper((string) $default);

        return str_contains($d, 'CURRENT_TIMESTAMP');
    }

    /**
     * Formata um default para sintaxe Beaver.
     */
    private function formatDefault(mixed $default, string $type): string
    {
        // Booleanos
        if ($type === 'tinyint(1)') {
            return $default ? 'true' : 'false';
        }

        // Numéricos
        if (is_numeric($default)) {
            return (string) $default;
        }

        // Strings — sem quotes (o parser do Beaver aceita)
        return (string) $default;
    }

        /**
     * Gera SQL de CREATE TABLE a partir dos fields.
     *
     * @param string[] $fields
     */
        /**
     * Gera SQL de CREATE TABLE a partir dos fields.
     *
     * @param string[] $fields
     * @param string   $driver  mysql | pgsql | sqlite
     */
    private function buildSqlFromFields(string $table, array $fields, string $driver = 'mysql'): string
    {
        $blueprint = new \Beaver\Database\Migrations\Blueprint($table);

        foreach ($fields as $field) {
            (new \Beaver\Database\Migrations\FieldParser($field))->applyTo($blueprint);
        }

        return $blueprint->toCreateSql($driver);
    }

    /**
     * Constrói o DSN para o PDO (modo simples, usado no test()).
     */
    private function buildDsn(string $driver, string $host, string $port, string $database): string
    {
        return match ($driver) {
            'mysql'  => "mysql:host={$host};port={$port}" . ($database !== '' ? ";dbname={$database}" : ''),
            'pgsql'  => "pgsql:host={$host};port={$port}" . ($database !== '' ? ";dbname={$database}" : ''),
            'sqlite' => "sqlite:{$database}",
            default  => throw new \RuntimeException("Driver não suportado: {$driver}"),
        };
    }

    /**
     * Normaliza e resolve um caminho SQLite (aceita Windows, WSL, relativo, absoluto).
     */
    private function resolveSqlitePath(string $path): string
    {
        $path = trim($path);

        if (preg_match('/^([A-Za-z]):[\\\\\/](.*)$/', $path, $m)) {
            $drive = strtolower($m[1]);
            $rest  = str_replace('\\', '/', $m[2]);
            $path  = '/mnt/' . $drive . '/' . ltrim($rest, '/');
        } else {
            $path = str_replace('\\', '/', $path);
        }

        if (!str_starts_with($path, '/')) {
            $basePath = \Beaver\Foundation\Application::getInstance()->basePath;
            $path     = rtrim($basePath, '/') . '/' . ltrim($path, '/');
        }

        $dir = dirname($path);

        if (!is_dir($dir)) {
            if (str_starts_with($path, '/mnt/')) {
                throw new \RuntimeException(
                    'O diretório não existe: ' . $dir . '. ' .
                    'Se o projeto NÃO está a correr em WSL, os caminhos /mnt/... não funcionam. ' .
                    'Usa um caminho Linux normal (ex: database/base.sqlite).'
                );
            }
            throw new \RuntimeException('O diretório não existe: ' . $dir);
        }

        if (!is_writable($dir)) {
            throw new \RuntimeException('O diretório não tem permissões de escrita: ' . $dir);
        }

        if (file_exists($path) && !is_readable($path)) {
            throw new \RuntimeException('O ficheiro existe mas não é legível: ' . $path);
        }

        return $path;
    }

    private function friendlyError(\PDOException $e): string
    {
        $msg = $e->getMessage();

        if (str_contains($msg, 'Access denied')) {
            return 'Utilizador ou password inválidos.';
        }
        if (str_contains($msg, 'Unknown database')) {
            return 'A base de dados não existe.';
        }
        if (str_contains($msg, 'Connection refused') || str_contains($msg, '2002')) {
            return 'Não foi possível ligar ao servidor. Verifica o host e a porta.';
        }
        if (str_contains($msg, 'getaddrinfo') || str_contains($msg, 'php_network_getaddresses')) {
            return 'Host não encontrado.';
        }
        if (str_contains($msg, 'timed out') || str_contains($msg, 'timeout')) {
            return 'A ligação demorou demasiado tempo.';
        }
        if (str_contains($msg, 'unable to open database file')) {
            return 'Não consegui abrir o ficheiro SQLite. Verifica o caminho e as permissões.';
        }

        return $msg;
    }


        /* ==========================================================
     * Sandbox SQL
     * ========================================================== */

    /**
     * POST /api/sqlwizard/drafts/{id}/sandbox
     *
     * Cria (ou recria) uma sandbox SQLite para um draft.
     *
     * Body (opcional):
     *   { "rows": 10 }   // 10, 50 ou 100
     */
    public function sandboxCreate(string $draftId, Request $request): Response
    {
        $draft = $this->loadDraft($draftId);

        if ($draft === null) {
            return Response::json(['error' => 'Draft não encontrado'], 404);
        }

        if (empty($draft['source']['connection_id'])) {
            return Response::json(['error' => 'Este draft não tem tabela de origem'], 422);
        }

        $body = $request->body;
        $rows = (int) ($body['rows'] ?? 10);
        $rows = max(1, min(100, $rows));   // 1 a 100

        $src = $draft['source'];

        // 1. Ligar à BD original
        $conn = $this->store->find($src['connection_id']);

        if ($conn === null) {
            return Response::json(['error' => 'Ligação não encontrada'], 404);
        }

        try {
            $pdo = $this->connect($conn, true, $src['database']);
        } catch (\PDOException $e) {
            return Response::json(['error' => $this->friendlyError($e)]);
        }

        // 2. Contar total
        try {
            $table   = $src['table'];
            $driver  = (string) $conn['driver'];
            $total   = (int) $pdo->query(
                'SELECT COUNT(*) FROM ' . $this->quoteIdent($table, $driver)
            )->fetchColumn();
        } catch (\PDOException $e) {
            return Response::json(['error' => $this->friendlyError($e)]);
        }

        // 3. Ler as N linhas
        try {
            $sql = sprintf(
                'SELECT * FROM %s LIMIT %d',
                $this->quoteIdent($table, $driver),
                $rows
            );

            $stmt = $pdo->query($sql);
            $data = $stmt->fetchAll(\PDO::FETCH_ASSOC);
        } catch (\PDOException $e) {
            return Response::json(['error' => $this->friendlyError($e)]);
        }

        // 4. Colunas
        $columns = $data ? array_keys($data[0]) : $this->getColumnNames($pdo, $table, $driver);

        // 5. Criar a sandbox
        try {
            $meta = $this->sandbox->create(
                $draftId,
                $table,
                $columns,
                $data,
                $total
            );
        } catch (\Throwable $e) {
            return Response::json(['error' => 'Erro a criar sandbox: ' . $e->getMessage()], 500);
        }

        return Response::json([
            'ok'      => true,
            'sandbox' => $meta,
        ]);
    }

    /**
     * GET /api/sqlwizard/drafts/{id}/sandbox
     *
     * Devolve metadata da sandbox (ou null).
     */
    public function sandboxInfo(string $draftId): Response
    {
        $meta = $this->sandbox->meta($draftId);

        return Response::json([
            'exists'  => $this->sandbox->exists($draftId),
            'sandbox' => $meta,
        ]);
    }

    /**
     * DELETE /api/sqlwizard/drafts/{id}/sandbox
     */
    public function sandboxDelete(string $draftId): Response
    {
        $this->sandbox->delete($draftId);

        return Response::json(['ok' => true]);
    }

    /**
     * POST /api/sqlwizard/drafts/{id}/query
     *
     * Executa SQL na sandbox.
     *
     * Body:
     *   { "sql": "SELECT * FROM ..." }
     */
    public function sandboxQuery(string $draftId, Request $request): Response
    {
        $body = $request->body;
        $sql  = trim((string) ($body['sql'] ?? ''));

        if ($sql === '') {
            return Response::json(['error' => 'SQL vazio'], 422);
        }

        // Existe sandbox?
        if (!$this->sandbox->exists($draftId)) {
            return Response::json([
                'error' => 'Sandbox não existe. Cria uma primeiro.',
            ], 409);
        }

        try {
            $pdo = $this->sandbox->connect($draftId);
        } catch (\Throwable $e) {
            return Response::json(['error' => 'Erro a abrir sandbox: ' . $e->getMessage()], 500);
        }

        $start = microtime(true);

        try {
            $stmt = $pdo->prepare($sql);
            $stmt->execute();

            // SELECT?
            $isSelect = (stripos(ltrim($sql), 'SELECT') === 0)
                     || (stripos(ltrim($sql), 'PRAGMA') === 0)
                     || (stripos(ltrim($sql), 'WITH') === 0);

            if ($isSelect) {
                $rows = $stmt->fetchAll(\PDO::FETCH_ASSOC);
                $columns = $rows ? array_keys($rows[0]) : [];

                $elapsed = (int) ((microtime(true) - $start) * 1000);

                return Response::json([
                    'ok'         => true,
                    'type'       => 'select',
                    'columns'    => $columns,
                    'rows'       => $rows,
                    'rowcount'   => count($rows),
                    'elapsed_ms' => $elapsed,
                ]);
            }

            // Escrita
            $affected = $stmt->rowCount();
            $elapsed  = (int) ((microtime(true) - $start) * 1000);

            return Response::json([
                'ok'         => true,
                'type'       => 'write',
                'affected'   => $affected,
                'elapsed_ms' => $elapsed,
            ]);
        } catch (\PDOException $e) {
            return Response::json([
                'ok'    => false,
                'error' => $e->getMessage(),
            ]);
        }
    }

    /**
     * Carrega um draft do disco.
     *
     * @return array<string,mixed>|null
     */
    private function loadDraft(string $draftId): ?array
    {
        $basePath = \Beaver\Foundation\Application::getInstance()->basePath;
        $path     = rtrim($basePath, '/') . '/database/drafts/' . $draftId . '/draft.json';

        if (!is_file($path)) {
            return null;
        }

        $data = json_decode((string) file_get_contents($path), true);

        return is_array($data) ? $data : null;
    }
}
