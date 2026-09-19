<?php

namespace Beaver\Plugins\SqlWizard\Http;

use Beaver\Draft\Draft;
use Beaver\Draft\DraftStore;
use Beaver\Foundation\Application;
use Beaver\Http\Request;
use Beaver\Http\Response;

/**
 * API HTTP para os drafts.
 *
 * Devolve sempre JSON. Não escreve na base de dados.
 * Lê e escreve rascunhos em database/drafts/ via DraftStore.
 */
class DraftsController
{
    private DraftStore $store;

    public function __construct()
    {
        $basePath = Application::getInstance()->basePath;

        $this->store = new DraftStore(rtrim($basePath, '/') . '/database/drafts');
    }

    /**
     * GET /api/sqlwizard/drafts
     */
    public function index(): Response
    {
        $drafts = $this->store->list();
        $out    = array_map(fn (Draft $d) => $this->serialize($d), $drafts);

        return Response::json([
            'drafts' => $out,
            'count'  => count($out),
        ]);
    }

    /**
     * GET /api/sqlwizard/drafts/{id}
     */
    public function show(string $id): Response
    {
        $draft = $this->store->find($id);

        if ($draft === null) {
            return Response::json([
                'error' => 'Draft não encontrado',
                'id'    => $id,
            ], 404);
        }

        return Response::json($this->serialize($draft));
    }

    /**
     * PUT /api/sqlwizard/drafts/{id}
     */
    public function update(string $id, Request $request): Response
    {
        $draft = $this->store->find($id);

        if ($draft === null) {
            return Response::json([
                'error' => 'Draft não encontrado',
                'id'    => $id,
            ], 404);
        }

        $sql = trim((string) ($request->body['sql'] ?? ''));

        if ($sql === '') {
            return Response::json([
                'error' => 'Campo `sql` em falta ou vazio',
            ], 422);
        }

        $updated = new Draft(
            id:        $draft->id,
            action:    $draft->action,
            table:     $draft->table,
            fields:    $draft->fields,
            sql:       $sql,
            createdAt: $draft->createdAt,
        );

        try {
            $this->store->save($updated);
        } catch (\Throwable $e) {
            return Response::json([
                'error' => 'Erro ao gravar: ' . $e->getMessage(),
            ], 500);
        }

        return Response::json([
            'ok'    => true,
            'draft' => $this->serialize($updated),
        ]);
    }

        /**
     * PUT /api/sqlwizard/drafts/{id}/full
     *
     * Atualização completa de um draft: tabela, ícone e fields.
     * Regenera o SQL.
     *
     * Body:
     *   {
     *     "table":  "utilizadores",
     *     "icon":   "👤",
     *     "fields": ["id", "nome:str(100)", "email:str?"]
     *   }
     */
    public function updateFull(string $id, Request $request): Response
    {
        $draft = $this->store->find($id);

        if ($draft === null) {
            return Response::json(['error' => 'Draft não encontrado', 'id' => $id], 404);
        }

        $body = $request->body;

        $table  = trim((string) ($body['table']  ?? $draft->table));
        $icon   = trim((string) ($body['icon']   ?? ''));
        $fields = $body['fields'] ?? $draft->fields;

        if ($table === '') {
            return Response::json(['error' => 'Nome da tabela é obrigatório'], 422);
        }

        if (!is_array($fields) || $fields === []) {
            return Response::json(['error' => 'Lista de campos vazia'], 422);
        }

        // Regenerar SQL a partir dos fields
        try {
            $sql = $this->buildSql($table, $fields);
        } catch (\Throwable $e) {
            return Response::json(['error' => 'Erro a gerar SQL: ' . $e->getMessage()], 500);
        }

        // Criar draft atualizado
        $updated = new \Beaver\Draft\Draft(
            id:        $draft->id,
            action:    $draft->action,
            table:     $table,
            fields:    $fields,
            sql:       $sql,
            createdAt: $draft->createdAt,
        );

        try {
            $this->store->save($updated);
        } catch (\Throwable $e) {
            return Response::json(['error' => 'Erro ao gravar: ' . $e->getMessage()], 500);
        }

        // Ícone: guardar num meta.json (opcional, para v2)
        // Por agora, o ícone é enviado de volta mas não persistido
        // (o draft.json não tem campo icon; ver nota abaixo)

        return Response::json([
            'ok'    => true,
            'draft' => $this->serialize($updated),
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function serialize(Draft $d): array
    {
        return [
         'id'         => $d->id,
         'action'     => $d->action,
         'table'      => $d->table,
         'fields'     => $d->fields,
         'sql'        => $d->sql,
         'created_at' => $d->createdAt,
         'source'     => $d->source,
        ];
    }

        /**
     * POST /api/sqlwizard/drafts
     *
     * Cria um novo draft a partir de um payload.
     *
     * Body esperado:
     *   {
     *     "table":  "demo_items_copy",
     *     "action": "create_table",         (opcional, default: create_table)
     *     "fields": ["id", "nome:str", ...] (obrigatório)
     *   }
     */
    public function store(Request $request): Response
    {
        $body = $request->body;

        $table  = trim((string) ($body['table']  ?? ''));
        $action = trim((string) ($body['action'] ?? 'create_table'));
        $fields = $body['fields'] ?? [];

        if ($table === '') {
            return Response::json(['error' => 'Campo `table` em falta'], 422);
        }

        if (!is_array($fields) || $fields === []) {
            return Response::json(['error' => 'Campo `fields` em falta ou vazio'], 422);
        }

        // Normalizar o nome da tabela
        $table = strtolower(trim($table));
        $table = preg_replace('/[^a-z0-9]+/', '_', $table) ?? '';
        $table = trim($table, '_');

        if ($table === '') {
            return Response::json(['error' => 'Nome de tabela inválido'], 422);
        }

        // Gerar o ID
        $id = \Beaver\Draft\Draft::makeId($table, 'create');

        // Verificar se já existe
        if ($this->store->exists($id)) {
            return Response::json(['error' => 'Já existe um draft com esse ID'], 409);
        }

        // Gerar SQL a partir dos fields
        try {
            $sql = $this->buildSql($table, $fields);
        } catch (\Throwable $e) {
            return Response::json(['error' => 'Erro a gerar SQL: ' . $e->getMessage()], 500);
        }

        // Criar o draft
        $draft = new \Beaver\Draft\Draft(
            id:        $id,
            action:    $action,
            table:     $table,
            fields:    $fields,
            sql:       $sql,
            createdAt: date('c'),
        );

        try {
            $this->store->save($draft);
        } catch (\Throwable $e) {
            return Response::json(['error' => 'Erro ao gravar: ' . $e->getMessage()], 500);
        }

        return Response::json([
            'ok'    => true,
            'draft' => $this->serialize($draft),
        ], 201);
    }

    /**
     * Gera SQL a partir de uma lista de fields.
     *
     * @param string[] $fields
     */
    private function buildSql(string $table, array $fields): string
    {
        $blueprint = new \Beaver\Database\Migrations\Blueprint($table);

        foreach ($fields as $field) {
            (new \Beaver\Database\Migrations\FieldParser($field))->applyTo($blueprint);
        }

        // Usar MySQL por omissão — a maioria dos drafts vem de MySQL.
        // v2: guardar o driver de origem no draft.
        return $blueprint->toCreateSql('mysql');
    }

        /**
     * DELETE /api/sqlwizard/drafts/{id}
     *
     * Apaga um draft.
     */
    public function delete(string $id): Response
    {
        if (!$this->store->exists($id)) {
            return Response::json([
                'error' => 'Draft não encontrado',
                'id'    => $id,
            ], 404);
        }

        try {
            $this->store->delete($id);
        } catch (\Throwable $e) {
            return Response::json([
                'error' => 'Erro ao apagar: ' . $e->getMessage(),
            ], 500);
        }

        return Response::json([
            'ok' => true,
            'id' => $id,
        ]);
    }
}
