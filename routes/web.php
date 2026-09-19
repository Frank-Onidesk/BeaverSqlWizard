<?php

/**
 * Rotas do plugin SqlWizard.
 *
 * @var \Beaver\Http\Router                          $router
 * @var \Beaver\Plugins\SqlWizard\SqlWizardPlugin   $plugin
 */

use Beaver\Http\Response;
use Beaver\Plugins\SqlWizard\Http\DraftsController;
use Beaver\Plugins\SqlWizard\Http\ConnectionsController;

// ─────────────────────────────────────────────────────────────
// UI
// ─────────────────────────────────────────────────────────────

$router->get('/sqlwizard', function () use ($plugin) {
    ob_start();
    require $plugin->path . '/resources/views/index.php';
    return Response::html(ob_get_clean());
});

// ─────────────────────────────────────────────────────────────
// Assets (CSS, JS) — servidos a partir do plugin
// ─────────────────────────────────────────────────────────────

$router->get('/plugins/sqlwizard/resources/ui/{file}', function ($req, $file) use ($plugin) {
    $path = $plugin->path . '/resources/ui/' . basename((string) $file);

    if (!is_file($path)) {
        return Response::text('Not found', 404);
    }

    $ext  = pathinfo($path, PATHINFO_EXTENSION);
    $mime = match ($ext) {
        'css'   => 'text/css',
        'js'    => 'application/javascript',
        'html'  => 'text/html',
        'svg'   => 'image/svg+xml',
        default => 'application/octet-stream',
    };

    return (new Response(file_get_contents($path)))
        ->withHeader('Content-Type', $mime);
});

// ─────────────────────────────────────────────────────────────
// API — drafts
// ─────────────────────────────────────────────────────────────

$router->get('/api/sqlwizard/drafts', function () {
    return (new DraftsController())->index();
});

$router->get('/api/sqlwizard/drafts/{id}', function ($req, $id) {
    return (new DraftsController())->show((string) $id);
});

$router->put('/api/sqlwizard/drafts/{id}', function ($req, $id) {
    return (new DraftsController())->update((string) $id, $req);
});

$router->post('/api/sqlwizard/drafts', function ($req) {
    return (new DraftsController())->store($req);
});

$router->delete('/api/sqlwizard/drafts/{id}', function ($req, $id) {
    return (new DraftsController())->delete((string) $id);
});


// ─────────────────────────────────────────────────────────────
// API — connections
// ─────────────────────────────────────────────────────────────

$router->post('/api/sqlwizard/connections/test', function ($req) {
    return (new \Beaver\Plugins\SqlWizard\Http\ConnectionsController())->test($req);
});




// ligações
$router->get('/api/sqlwizard/connections', function () {
    return (new ConnectionsController())->index();
});

$router->post('/api/sqlwizard/connections', function ($req) {
    return (new ConnectionsController())->store($req);
});

$router->put('/api/sqlwizard/connections/{id}', function ($req, $id) {
    return (new ConnectionsController())->update((string) $id, $req);
});

$router->delete('/api/sqlwizard/connections/{id}', function ($req, $id) {
    return (new ConnectionsController())->delete((string) $id);
});


// ========================= listar base de dados e tabelas

$router->get('/api/sqlwizard/connections/{id}/databases', function ($req, $id) {
    return (new ConnectionsController())->databases((string) $id);
});

$router->get('/api/sqlwizard/connections/{id}/databases/{db}/tables', function ($req, $id, $db) {
    return (new ConnectionsController())->tables((string) $id, (string) $db);
});


// importar tabelas
$router->post('/api/sqlwizard/connections/{id}/databases/{db}/tables/{table}/import', function ($req, $id, $db, $table) {
    return (new ConnectionsController())->importTable((string) $id, (string) $db, (string) $table);
});

$router->put('/api/sqlwizard/drafts/{id}/full', function ($req, $id) {
    return (new DraftsController())->updateFull((string) $id, $req);
});


// localstorage
$router->get('/api/sqlwizard/connections/{id}/databases/{db}/tables/{table}/rows', function ($req, $id, $db, $table) {
    return (new ConnectionsController())->rows((string) $id, (string) $db, (string) $table, $req);
});



// ─────────────────────────────────────────────────────────────
// API — sandbox SQL
// ─────────────────────────────────────────────────────────────

$router->post('/api/sqlwizard/drafts/{id}/sandbox', function ($req, $id) {
    return (new ConnectionsController())->sandboxCreate((string) $id, $req);
});

$router->get('/api/sqlwizard/drafts/{id}/sandbox', function ($req, $id) {
    return (new ConnectionsController())->sandboxInfo((string) $id);
});

$router->delete('/api/sqlwizard/drafts/{id}/sandbox', function ($req, $id) {
    return (new ConnectionsController())->sandboxDelete((string) $id);
});

$router->post('/api/sqlwizard/drafts/{id}/query', function ($req, $id) {
    return (new ConnectionsController())->sandboxQuery((string) $id, $req);
});
