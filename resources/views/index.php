<?php

/**
 * View principal do SqlWizard.
 */

$base = '/plugins/sqlwizard';

$layoutPath = __DIR__ . '/../ui/layout.html';
$layout = is_file($layoutPath)
    ? file_get_contents($layoutPath)
    : '<p>layout.html não encontrado</p>';
?>
<!DOCTYPE html>
<html lang="pt">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>SqlWizard · Beaver</title>
    <!-- Golden Layout CSS (primeiro, para os estilos base) -->
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/golden-layout/1.5.9/css/goldenlayout-base.css">
    <link rel="stylesheet" href="<?= $base ?>/css/dock.css">
    <link rel="stylesheet" href="<?= $base ?>/css/base.css">
    <link rel="stylesheet" href="<?= $base ?>/css/layout.css">
    <link rel="stylesheet" href="<?= $base ?>/css/menu.css">
    <link rel="stylesheet" href="<?= $base ?>/css/tabs.css">
    <link rel="stylesheet" href="<?= $base ?>/css/panels.css">
    <link rel="stylesheet" href="<?= $base ?>/css/canvas.css">
    <link rel="stylesheet" href="<?= $base ?>/css/cards.css">
    <link rel="stylesheet" href="<?= $base ?>/css/context-menu.css">
    <link rel="stylesheet" href="<?= $base ?>/css/modal.css">
    <link rel="stylesheet" href="<?= $base ?>/css/explorer.css">
    <link rel="stylesheet" href="<?= $base ?>/css/toast.css">
    
</head>
<body>

    <?= $layout ?>


            <!-- jQuery (só para o Golden Layout v1) -->
    <script src="https://code.jquery.com/jquery-3.7.1.min.js"></script>

    <!-- Golden Layout v1 -->
    <script src="https://cdnjs.cloudflare.com/ajax/libs/golden-layout/1.5.9/goldenlayout.min.js"></script>
    <script src="<?= $base ?>/js/api.js"></script>
    <script src="<?= $base ?>/js/toast.js"></script>              
    <script src="<?= $base ?>/js/explorer.js"></script>
    <script src="<?= $base ?>/js/canvas.js"></script>
    <script src="<?= $base ?>/js/context-menu.js"></script>
    <script src="<?= $base ?>/js/modal.js"></script>
    <script src="<?= $base ?>/js/connections-form.js"></script>
    <script src="<?= $base ?>/js/inspector.js"></script>
    <script src="<?= $base ?>/js/bottom.js"></script> 
     <script src="<?= $base ?>/js/dock.js"></script>  
    <script src="<?= $base ?>/js/app.js"></script>

</body>
</html>