<?php

namespace Beaver\Plugins\SqlWizard;

use Beaver\Plugin\PluginBase;

/**
 * SqlWizard — editor visual de schema para o Beaver.
 *
 * Este plugin acrescenta ao Beaver:
 *   - Uma UI web (canvas) para desenhar tabelas visualmente
 *   - Endpoints HTTP para ler/gravar drafts
 *   - (futuro) comandos CLI
 *
 * Estrutura:
 *   - routes/web.php     → rotas HTTP
 *   - resources/views/   → views PHP
 *   - resources/ui/      → frontend (JS, CSS, HTML)
 *   - src/Http/          → controladores HTTP
 *   - lang/              → traduções
 *
 * O plugin é carregado pelo PluginManager via plugin.json.
 */
class SqlWizardPlugin extends PluginBase
{
    /**
     * Arranca o plugin.
     *
     * Chamado pelo PluginManager depois de instanciar o plugin.
     * Aqui registamos tudo o que o plugin expõe ao Beaver:
     * rotas, views, traduções e (se houver) migrations.
     */
    public function boot(): void
    {
        $this->loadRoutes();
        $this->loadViews();
        $this->loadTranslations();
    }
}
