<?php

namespace Beaver\Plugins\SqlWizard\Storage;

/**
 * Persistência de ligações em JSON.
 *
 * Guarda as ligações em storage/connections.local.json.
 * Este ficheiro NÃO é versionado (contém passwords).
 */
class ConnectionStore
{
    private string $file;

    public function __construct(string $pluginPath)
    {
        $this->file = rtrim($pluginPath, '/') . '/storage/connections.local.json';
    }

    /**
     * Lista todas as ligações.
     *
     * @return array<int, array<string, mixed>>
     */
    public function all(): array
    {
        $data = $this->read();
        return $data['connections'] ?? [];
    }

    /**
     * Encontra uma ligação pelo ID.
     */
    public function find(string $id): ?array
    {
        foreach ($this->all() as $conn) {
            if (($conn['id'] ?? '') === $id) {
                return $conn;
            }
        }
        return null;
    }

    /**
     * Verifica se já existe uma ligação com este nome (exceto opcionalmente um ID).
     */
    public function nameExists(string $name, ?string $exceptId = null): bool
    {
        $name = mb_strtolower(trim($name));

        foreach ($this->all() as $conn) {
            if ($exceptId !== null && ($conn['id'] ?? '') === $exceptId) {
                continue;
            }
            if (mb_strtolower(trim($conn['name'] ?? '')) === $name) {
                return true;
            }
        }
        return false;
    }

    /**
     * Cria uma nova ligação. Devolve o registo criado.
     *
     * @param array<string, mixed> $data
     * @return array<string, mixed>
     */
    public function create(array $data): array
    {
        $conn = [
            'id'         => 'conn_' . bin2hex(random_bytes(6)),
            'name'       => trim((string) ($data['name'] ?? '')),
            'driver'     => trim((string) ($data['driver'] ?? 'mysql')),
            'host'       => trim((string) ($data['host'] ?? '')),
            'port'       => trim((string) ($data['port'] ?? '')),
            'database'   => trim((string) ($data['database'] ?? '')),
            'username'   => trim((string) ($data['username'] ?? '')),
            'password'   => (string) ($data['password'] ?? ''),
            'created_at' => date('c'),
        ];

        $all = $this->all();
        $all[] = $conn;
        $this->write(['connections' => $all]);

        return $conn;
    }

    /**
     * Atualiza uma ligação existente.
     *
     * @param array<string, mixed> $data
     * @return array<string, mixed>|null  null se não existir
     */
    public function update(string $id, array $data): ?array
    {
        $all = $this->all();
        $found = false;

        foreach ($all as &$conn) {
            if (($conn['id'] ?? '') !== $id) {
                continue;
            }

            $conn['name']       = trim((string) ($data['name'] ?? $conn['name']));
            $conn['driver']     = trim((string) ($data['driver'] ?? $conn['driver']));
            $conn['host']       = trim((string) ($data['host'] ?? $conn['host']));
            $conn['port']       = trim((string) ($data['port'] ?? $conn['port']));
            $conn['database']   = trim((string) ($data['database'] ?? $conn['database']));
            $conn['username']   = trim((string) ($data['username'] ?? $conn['username']));
            $conn['password']   = (string) ($data['password'] ?? $conn['password']);
            $conn['updated_at'] = date('c');

            $found = true;
            $result = $conn;
            break;
        }
        unset($conn);

        if (!$found) {
            return null;
        }

        $this->write(['connections' => $all]);

        return $result ?? null;
    }

    /**
     * Apaga uma ligação. Devolve true se apagou algo.
     */
    public function delete(string $id): bool
    {
        $all = $this->all();
        $before = count($all);

        $all = array_values(array_filter($all, function ($conn) use ($id) {
            return ($conn['id'] ?? '') !== $id;
        }));

        if (count($all) === $before) {
            return false;
        }

        $this->write(['connections' => $all]);
        return true;
    }

    /* ----------------------------------------------------------
     * Internos
     * ---------------------------------------------------------- */

    /**
     * @return array<string, mixed>
     */
    private function read(): array
    {
        if (!is_file($this->file)) {
            return ['connections' => []];
        }

        $raw = file_get_contents($this->file);
        $data = json_decode((string) $raw, true);

        if (!is_array($data)) {
            return ['connections' => []];
        }

        if (!isset($data['connections']) || !is_array($data['connections'])) {
            $data['connections'] = [];
        }

        return $data;
    }

    /**
     * @param array<string, mixed> $data
     */
    private function write(array $data): void
    {
        $dir = dirname($this->file);

        if (!is_dir($dir) && !mkdir($dir, 0775, true) && !is_dir($dir)) {
            throw new \RuntimeException("Não foi possível criar: {$dir}");
        }

        $json = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

        if ($json === false) {
            throw new \RuntimeException('Falha a codificar JSON.');
        }

        if (file_put_contents($this->file, $json . "\n") === false) {
            throw new \RuntimeException("Não foi possível escrever: {$this->file}");
        }

        // Proteger o ficheiro (contém passwords)
        @chmod($this->file, 0600);
    }
}
