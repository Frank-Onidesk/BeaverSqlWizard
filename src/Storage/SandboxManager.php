<?php

namespace Beaver\Plugins\SqlWizard\Storage;

/**
 * Gestão de sandboxes SQLite.
 *
 * Cada draft com source pode ter uma sandbox — uma BD SQLite
 * que é uma cópia parcial da tabela original. SQL corre contra
 * esta sandbox, nunca contra a BD real.
 */
class SandboxManager
{
    private string $dir;

    public function __construct(string $pluginPath)
    {
        $this->dir = rtrim($pluginPath, '/') . '/storage/sandboxes';

        if (!is_dir($this->dir)) {
            mkdir($this->dir, 0775, true);
        }
    }

    /** Caminho do ficheiro .sqlite de um draft. */
    public function sqlitePath(string $draftId): string
    {
        return $this->dir . '/' . $this->safeId($draftId) . '.sqlite';
    }

    /** Caminho do ficheiro .meta.json de um draft. */
    public function metaPath(string $draftId): string
    {
        return $this->dir . '/' . $this->safeId($draftId) . '.meta.json';
    }

    /** Existe uma sandbox para este draft? */
    public function exists(string $draftId): bool
    {
        return is_file($this->sqlitePath($draftId));
    }

    /** Devolve a metadata (ou null). */
    public function meta(string $draftId): ?array
    {
        $file = $this->metaPath($draftId);

        if (!is_file($file)) {
            return null;
        }

        $data = json_decode((string) file_get_contents($file), true);

        return is_array($data) ? $data : null;
    }

    /**
     * Cria uma sandbox a partir de uma tabela real.
     *
     * @return array  metadata da sandbox criada
     */
    public function create(
        string $draftId,
        string $table,
        array $columns,
        array $rows,
        int $originalTotal
    ): array {
        // 1. Apagar sandbox antiga (se existir)
        $this->delete($draftId);

        // 2. Criar SQLite
        $pdo = new \PDO('sqlite:' . $this->sqlitePath($draftId));
        $pdo->setAttribute(\PDO::ATTR_ERRMODE, \PDO::ERRMODE_EXCEPTION);

        // 3. Criar a tabela (tudo TEXT — simples e rápido)
        $cols = [];
        foreach ($columns as $col) {
            $cols[] = '"' . str_replace('"', '""', $col) . '" TEXT';
        }

        $pdo->exec(
            'CREATE TABLE "' . str_replace('"', '""', $table) . '" (' .
            implode(', ', $cols) . ')'
        );

        // 4. Inserir as linhas
        if ($rows) {
            $placeholders = implode(', ', array_fill(0, count($columns), '?'));

            $stmt = $pdo->prepare(
                'INSERT INTO "' . str_replace('"', '""', $table) . '" (' .
                implode(', ', array_map(fn ($c) => '"' . str_replace('"', '""', $c) . '"', $columns)) .
                ') VALUES (' . $placeholders . ')'
            );

            foreach ($rows as $row) {
                $values = [];
                foreach ($columns as $col) {
                    $val = $row[$col] ?? null;

                    if (is_bool($val)) {
                        $val = $val ? '1' : '0';
                    } elseif (is_array($val) || is_object($val)) {
                        $val = json_encode($val);
                    }

                    $values[] = $val === null ? null : (string) $val;
                }

                $stmt->execute($values);
            }
        }

        // 5. Guardar metadata
        $meta = [
            'draft_id'      => $draftId,
            'table'         => $table,
            'columns'       => $columns,
            'rows_copied'   => count($rows),
            'original_total' => $originalTotal,
            'created_at'    => date('c'),
            'expires_at'    => date('c', strtotime('+3 days')),
        ];

        file_put_contents(
            $this->metaPath($draftId),
            json_encode($meta, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES)
        );

        return $meta;
    }

    /**
     * Abre uma ligação PDO à sandbox.
     */
    public function connect(string $draftId): \PDO
    {
        $pdo = new \PDO('sqlite:' . $this->sqlitePath($draftId));
        $pdo->setAttribute(\PDO::ATTR_ERRMODE, \PDO::ERRMODE_EXCEPTION);
        $pdo->setAttribute(\PDO::ATTR_DEFAULT_FETCH_MODE, \PDO::FETCH_ASSOC);

        return $pdo;
    }

    /**
     * Apaga a sandbox (sqlite + meta).
     */
    public function delete(string $draftId): void
    {
        @unlink($this->sqlitePath($draftId));
        @unlink($this->metaPath($draftId));
    }

    /**
     * Limpa sandboxes expiradas.
     */
    public function pruneExpired(): int
    {
        if (!is_dir($this->dir)) {
            return 0;
        }

        $count = 0;
        $now   = time();

        foreach (glob($this->dir . '/*.meta.json') ?: [] as $metaFile) {
            $data = json_decode((string) file_get_contents($metaFile), true);

            if (!is_array($data) || empty($data['expires_at'])) {
                continue;
            }

            $expires = strtotime($data['expires_at']);

            if ($expires !== false && $expires < $now) {
                $sqlite = str_replace('.meta.json', '.sqlite', $metaFile);
                @unlink($sqlite);
                @unlink($metaFile);
                $count++;
            }
        }

        return $count;
    }

    /**
     * Sanitiza o ID para uso como nome de ficheiro.
     */
    private function safeId(string $id): string
    {
        return preg_replace('/[^A-Za-z0-9_\-]/', '_', $id) ?? 'unknown';
    }
}
