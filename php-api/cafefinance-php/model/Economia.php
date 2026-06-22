<?php

require_once __DIR__ . '/../config/Database.php';

class Economia
{
    private PDO $connection;

    public function __construct()
    {
        $this->connection = Database::getConnection();
    }

    public function criarMeta(int $userId, string $nome, float $valorMeta, ?string $dataLimite): array
    {
        $stmt = $this->connection->prepare(
            'INSERT INTO metas_economia (user_id, nome, valor_meta, data_limite)
            VALUES (:user_id, :nome, :valor_meta, :data_limite)
            RETURNING id, user_id, nome, valor_meta, valor_atual, data_limite, status, created_at'
        );

        $stmt->execute([
            'user_id' => $userId,
            'nome' => $nome,
            'valor_meta' => $valorMeta,
            'data_limite' => $dataLimite,
        ]);

        return $this->formatarMeta($stmt->fetch());
    }

    public function nomeMetaExiste(int $userId, string $nome, ?int $ignorarId = null): bool
    {
        $sql = "SELECT 1
            FROM metas_economia
            WHERE user_id = :user_id
              AND LOWER(nome) = LOWER(:nome)
              AND status IN ('ativa', 'concluida', 'pausada')";

        $params = [
            'user_id' => $userId,
            'nome' => $nome,
        ];

        if ($ignorarId !== null) {
            $sql .= ' AND id <> :ignorar_id';
            $params['ignorar_id'] = $ignorarId;
        }

        $sql .= ' LIMIT 1';

        $stmt = $this->connection->prepare($sql);
        $stmt->execute($params);

        return (bool) $stmt->fetchColumn();
    }

    public function atualizarMeta(
        int $id,
        int $userId,
        string $nome,
        float $valorMeta,
        ?string $dataLimite,
        ?float $valorAtualDesejado = null
    ): array
    {
        $meta = $this->buscarMetaDoUsuario($id, $userId);

        if (!$meta) {
            return [];
        }

        $valorAtualFinal = $valorAtualDesejado ?? $this->totalEconomizadoNaMeta($id);

        if ($this->valorPassaDoLimiteDaMeta($valorAtualFinal, $valorMeta)) {
            throw new DomainException('O valor guardado nao pode passar do valor delimitado na meta.');
        }

        try {
            $this->connection->beginTransaction();

            if ($valorAtualDesejado !== null) {
                $this->ajustarTotalEconomizadoNaMeta($id, $userId, $valorAtualDesejado, $nome);
            }

            $total = $this->totalEconomizadoNaMeta($id);
            $status = $total >= $valorMeta ? 'concluida' : 'ativa';

            $stmt = $this->connection->prepare(
                'UPDATE metas_economia
                SET nome = :nome,
                    valor_meta = :valor_meta,
                    valor_atual = :valor_atual,
                    data_limite = :data_limite,
                    status = :status,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = :id
                  AND user_id = :user_id
                  AND status IN (\'ativa\', \'concluida\', \'pausada\')
                RETURNING id, user_id, nome, valor_meta, valor_atual, data_limite, status, created_at'
            );

            $stmt->execute([
                'nome' => $nome,
                'valor_meta' => $valorMeta,
                'valor_atual' => $total,
                'data_limite' => $dataLimite,
                'status' => $status,
                'id' => $id,
                'user_id' => $userId,
            ]);

            $metaAtualizada = $stmt->fetch();

            $this->connection->commit();

            return $metaAtualizada ? $this->formatarMeta($metaAtualizada) : [];
        } catch (Throwable $erro) {
            if ($this->connection->inTransaction()) {
                $this->connection->rollBack();
            }

            throw $erro;
        }
    }

    public function excluirMeta(int $id, int $userId): bool
    {
        try {
            $this->connection->beginTransaction();

            $stmt = $this->connection->prepare(
                "UPDATE metas_economia
                SET status = 'cancelada', updated_at = CURRENT_TIMESTAMP
                WHERE id = :id
                  AND user_id = :user_id
                  AND status IN ('ativa', 'concluida', 'pausada')"
            );

            $stmt->execute([
                'id' => $id,
                'user_id' => $userId,
            ]);

            $excluida = $stmt->rowCount() > 0;

            if (!$excluida) {
                $this->connection->rollBack();
                return false;
            }

            $stmt = $this->connection->prepare(
                'DELETE FROM movimentacoes m
                USING economias e
                WHERE m.id = e.movimentacao_id
                  AND e.meta_id = :meta_id
                  AND e.user_id = :economia_user_id
                  AND m.user_id = :movimentacao_user_id'
            );

            $stmt->execute([
                'meta_id' => $id,
                'economia_user_id' => $userId,
                'movimentacao_user_id' => $userId,
            ]);

            $this->connection->commit();

            return true;
        } catch (Throwable $erro) {
            if ($this->connection->inTransaction()) {
                $this->connection->rollBack();
            }

            throw $erro;
        }
    }

    public function guardar(int $userId, int $metaId, float $valor, string $dataEconomia, ?string $descricao): array
    {
        $meta = $this->buscarMetaDoUsuario($metaId, $userId);

        if (!$meta) {
            return [];
        }

        $totalProjetado = $this->totalEconomizadoNaMeta($metaId) + $valor;

        if ($this->valorPassaDoLimiteDaMeta($totalProjetado, (float) $meta['valor_meta'])) {
            throw new DomainException('Nao e possivel guardar mais dinheiro do que o valor delimitado na meta.');
        }

        try {
            $this->connection->beginTransaction();

            $movimentacaoId = $this->registrarMovimentacaoEconomia(
                $userId,
                $valor,
                $dataEconomia,
                $meta['nome'],
                $descricao
            );

            $stmt = $this->connection->prepare(
                'INSERT INTO economias (user_id, meta_id, movimentacao_id, valor, data_economia, descricao)
                VALUES (:user_id, :meta_id, :movimentacao_id, :valor, :data_economia, :descricao)
                RETURNING id, user_id, meta_id, movimentacao_id, valor, data_economia, descricao, created_at'
            );

            $stmt->execute([
                'user_id' => $userId,
                'meta_id' => $metaId,
                'movimentacao_id' => $movimentacaoId,
                'valor' => $valor,
                'data_economia' => $dataEconomia,
                'descricao' => $descricao,
            ]);

            $economia = $stmt->fetch();
            $total = $this->totalEconomizadoNaMeta($metaId);
            $status = $total >= (float) $meta['valor_meta'] ? 'concluida' : 'ativa';

            $update = $this->connection->prepare(
                'UPDATE metas_economia
                SET valor_atual = :valor_atual, status = :status, updated_at = CURRENT_TIMESTAMP
                WHERE id = :id AND user_id = :user_id'
            );

            $update->execute([
                'valor_atual' => $total,
                'status' => $status,
                'id' => $metaId,
                'user_id' => $userId,
            ]);

            $this->connection->commit();

            $metaAtualizada = $this->buscarMetaDoUsuario($metaId, $userId);

            return [
                'economia' => $this->formatarEconomia($economia, $meta['nome']),
                'meta' => $metaAtualizada ? $this->formatarMeta($metaAtualizada) : [],
                'total_economizado' => $this->totalEconomizadoDoUsuario($userId),
            ];
        } catch (Throwable $erro) {
            if ($this->connection->inTransaction()) {
                $this->connection->rollBack();
            }

            throw $erro;
        }
    }

    public function atualizarEconomia(
        int $id,
        int $userId,
        int $metaId,
        float $valor,
        string $dataEconomia,
        ?string $descricao
    ): array {
        $economiaAtual = $this->buscarEconomiaDoUsuario($id, $userId);
        $metaNova = $this->buscarMetaDoUsuario($metaId, $userId);

        if (!$economiaAtual || !$metaNova) {
            return [];
        }

        $metaAnteriorId = (int) $economiaAtual['meta_id'];
        $totalProjetado = $this->totalEconomizadoNaMetaIgnorandoEconomia($metaId, $id) + $valor;

        if ($this->valorPassaDoLimiteDaMeta($totalProjetado, (float) $metaNova['valor_meta'])) {
            throw new DomainException('Nao e possivel deixar a meta com mais dinheiro do que o valor delimitado.');
        }

        try {
            $this->connection->beginTransaction();

            $movimentacaoId = isset($economiaAtual['movimentacao_id']) && $economiaAtual['movimentacao_id'] !== null
                ? (int) $economiaAtual['movimentacao_id']
                : null;

            if ($movimentacaoId !== null) {
                $movimentacaoId = $this->atualizarMovimentacaoEconomia(
                    $movimentacaoId,
                    $userId,
                    $valor,
                    $dataEconomia,
                    $metaNova['nome'],
                    $descricao
                );
            } else {
                $movimentacaoId = $this->registrarMovimentacaoEconomia(
                    $userId,
                    $valor,
                    $dataEconomia,
                    $metaNova['nome'],
                    $descricao
                );
            }

            $stmt = $this->connection->prepare(
                'UPDATE economias
                SET meta_id = :meta_id,
                    movimentacao_id = :movimentacao_id,
                    valor = :valor,
                    data_economia = :data_economia,
                    descricao = :descricao
                WHERE id = :id
                  AND user_id = :user_id
                RETURNING id, user_id, meta_id, movimentacao_id, valor, data_economia, descricao, created_at'
            );

            $stmt->execute([
                'id' => $id,
                'user_id' => $userId,
                'meta_id' => $metaId,
                'movimentacao_id' => $movimentacaoId,
                'valor' => $valor,
                'data_economia' => $dataEconomia,
                'descricao' => $descricao,
            ]);

            $economiaAtualizada = $stmt->fetch();
            $metasAtualizadas = [];

            $metaAnteriorAtualizada = $this->atualizarResumoMeta($metaAnteriorId, $userId);
            if ($metaAnteriorAtualizada) {
                $metasAtualizadas[$metaAnteriorAtualizada['id']] = $metaAnteriorAtualizada;
            }

            if ($metaAnteriorId !== $metaId) {
                $metaNovaAtualizada = $this->atualizarResumoMeta($metaId, $userId);
                if ($metaNovaAtualizada) {
                    $metasAtualizadas[$metaNovaAtualizada['id']] = $metaNovaAtualizada;
                }
            }

            $this->connection->commit();

            return [
                'economia' => $this->formatarEconomia($economiaAtualizada, $metaNova['nome']),
                'metas' => array_values($metasAtualizadas),
                'total_economizado' => $this->totalEconomizadoDoUsuario($userId),
            ];
        } catch (Throwable $erro) {
            if ($this->connection->inTransaction()) {
                $this->connection->rollBack();
            }

            throw $erro;
        }
    }

    public function excluirEconomia(int $id, int $userId): array
    {
        $economia = $this->buscarEconomiaDoUsuario($id, $userId);

        if (!$economia) {
            return [];
        }

        $metaId = (int) $economia['meta_id'];
        $movimentacaoId = isset($economia['movimentacao_id']) && $economia['movimentacao_id'] !== null
            ? (int) $economia['movimentacao_id']
            : null;

        try {
            $this->connection->beginTransaction();

            $this->removerEconomiaComMovimentacao($id, $userId, $movimentacaoId);
            $metaAtualizada = $this->atualizarResumoMeta($metaId, $userId);

            $this->connection->commit();

            return [
                'id' => $id,
                'meta' => $metaAtualizada,
                'total_economizado' => $this->totalEconomizadoDoUsuario($userId),
            ];
        } catch (Throwable $erro) {
            if ($this->connection->inTransaction()) {
                $this->connection->rollBack();
            }

            throw $erro;
        }
    }

    public function resumo(int $userId): array
    {
        $metas = $this->listarMetas($userId);
        $principal = $metas[0] ?? null;

        return [
            'total_economizado' => array_reduce(
                $metas,
                fn (float $total, array $meta) => $total + $meta['valor_atual'],
                0.0
            ),
            'meta_principal' => $principal,
            'metas' => $metas,
            'historico_recente' => $this->listarHistoricoRecente($userId),
        ];
    }

    private function listarMetas(int $userId): array
    {
        $stmt = $this->connection->prepare(
            "SELECT
                m.id,
                m.user_id,
                m.nome,
                m.valor_meta,
                COALESCE(SUM(e.valor), 0) AS valor_atual,
                m.data_limite,
                CASE
                    WHEN COALESCE(SUM(e.valor), 0) >= m.valor_meta THEN 'concluida'
                    ELSE m.status
                END AS status,
                m.created_at
            FROM metas_economia m
            LEFT JOIN economias e ON e.meta_id = m.id
            WHERE m.user_id = :user_id
              AND m.status IN ('ativa', 'concluida', 'pausada')
            GROUP BY m.id
            ORDER BY
                CASE WHEN m.status = 'ativa' THEN 0 ELSE 1 END,
                m.created_at DESC"
        );

        $stmt->execute(['user_id' => $userId]);

        return array_map(
            fn (array $meta) => $this->formatarMeta($meta),
            $stmt->fetchAll()
        );
    }

    private function listarHistoricoRecente(int $userId): array
    {
        $stmt = $this->connection->prepare(
            "SELECT
                e.id,
                e.user_id,
                e.meta_id,
                e.movimentacao_id,
                e.valor,
                e.data_economia,
                e.descricao,
                e.created_at,
                m.nome AS meta_nome
            FROM economias e
            JOIN metas_economia m ON m.id = e.meta_id
            WHERE e.user_id = :user_id
              AND m.status IN ('ativa', 'concluida', 'pausada')
            ORDER BY e.data_economia DESC, e.created_at DESC
            LIMIT 5"
        );

        $stmt->execute(['user_id' => $userId]);

        return array_map(
            fn (array $economia) => $this->formatarEconomia($economia, $economia['meta_nome']),
            $stmt->fetchAll()
        );
    }

    private function buscarMetaDoUsuario(int $metaId, int $userId): ?array
    {
        $stmt = $this->connection->prepare(
            "SELECT id, user_id, nome, valor_meta, valor_atual, data_limite, status, created_at
            FROM metas_economia
            WHERE id = :id AND user_id = :user_id AND status IN ('ativa', 'pausada', 'concluida')"
        );

        $stmt->execute([
            'id' => $metaId,
            'user_id' => $userId,
        ]);

        $meta = $stmt->fetch();

        return $meta ?: null;
    }

    private function buscarEconomiaDoUsuario(int $id, int $userId): ?array
    {
        $stmt = $this->connection->prepare(
            "SELECT
                e.id,
                e.user_id,
                e.meta_id,
                e.movimentacao_id,
                e.valor,
                e.data_economia,
                e.descricao,
                e.created_at,
                m.nome AS meta_nome
            FROM economias e
            JOIN metas_economia m ON m.id = e.meta_id
            WHERE e.id = :id
              AND e.user_id = :user_id
              AND m.status IN ('ativa', 'concluida', 'pausada')
            LIMIT 1"
        );

        $stmt->execute([
            'id' => $id,
            'user_id' => $userId,
        ]);

        $economia = $stmt->fetch();

        return $economia ?: null;
    }

    private function ajustarTotalEconomizadoNaMeta(int $metaId, int $userId, float $valorDesejado, string $metaNome): void
    {
        $valorAtualCentavos = (int) round($this->totalEconomizadoNaMeta($metaId) * 100);
        $valorDesejadoCentavos = max(0, (int) round($valorDesejado * 100));
        $diferencaCentavos = $valorDesejadoCentavos - $valorAtualCentavos;

        if ($diferencaCentavos === 0) {
            return;
        }

        if ($diferencaCentavos > 0) {
            $valorAjuste = $diferencaCentavos / 100;
            $movimentacaoId = $this->registrarMovimentacaoEconomia(
                $userId,
                $valorAjuste,
                date('Y-m-d'),
                $metaNome,
                'Ajuste da meta: ' . $metaNome
            );

            $stmt = $this->connection->prepare(
                'INSERT INTO economias (user_id, meta_id, movimentacao_id, valor, data_economia, descricao)
                VALUES (:user_id, :meta_id, :movimentacao_id, :valor, :data_economia, :descricao)'
            );

            $stmt->execute([
                'user_id' => $userId,
                'meta_id' => $metaId,
                'movimentacao_id' => $movimentacaoId,
                'valor' => $valorAjuste,
                'data_economia' => date('Y-m-d'),
                'descricao' => 'Ajuste da meta',
            ]);

            return;
        }

        $this->reduzirEconomiasDaMeta($metaId, $userId, abs($diferencaCentavos));
    }

    private function reduzirEconomiasDaMeta(int $metaId, int $userId, int $valorReducaoCentavos): void
    {
        $stmt = $this->connection->prepare(
            'SELECT id, movimentacao_id, valor
            FROM economias
            WHERE meta_id = :meta_id
              AND user_id = :user_id
            ORDER BY data_economia DESC, created_at DESC, id DESC'
        );

        $stmt->execute([
            'meta_id' => $metaId,
            'user_id' => $userId,
        ]);

        foreach ($stmt->fetchAll() as $economia) {
            if ($valorReducaoCentavos <= 0) {
                break;
            }

            $valorEconomiaCentavos = (int) round(((float) $economia['valor']) * 100);
            $economiaId = (int) $economia['id'];
            $movimentacaoId = isset($economia['movimentacao_id']) && $economia['movimentacao_id'] !== null
                ? (int) $economia['movimentacao_id']
                : null;

            if ($valorEconomiaCentavos <= $valorReducaoCentavos) {
                $this->removerEconomiaComMovimentacao($economiaId, $userId, $movimentacaoId);
                $valorReducaoCentavos -= $valorEconomiaCentavos;
                continue;
            }

            $novoValor = ($valorEconomiaCentavos - $valorReducaoCentavos) / 100;
            $this->atualizarValorEconomiaComMovimentacao($economiaId, $userId, $movimentacaoId, $novoValor);
            $valorReducaoCentavos = 0;
        }
    }

    private function removerEconomiaComMovimentacao(int $economiaId, int $userId, ?int $movimentacaoId): void
    {
        if ($movimentacaoId !== null) {
            $stmt = $this->connection->prepare(
                'DELETE FROM movimentacoes
                WHERE id = :id
                  AND user_id = :user_id'
            );

            $stmt->execute([
                'id' => $movimentacaoId,
                'user_id' => $userId,
            ]);
        }

        $stmt = $this->connection->prepare(
            'DELETE FROM economias
            WHERE id = :id
              AND user_id = :user_id'
        );

        $stmt->execute([
            'id' => $economiaId,
            'user_id' => $userId,
        ]);
    }

    private function atualizarValorEconomiaComMovimentacao(int $economiaId, int $userId, ?int $movimentacaoId, float $novoValor): void
    {
        $stmt = $this->connection->prepare(
            'UPDATE economias
            SET valor = :valor
            WHERE id = :id
              AND user_id = :user_id'
        );

        $stmt->execute([
            'valor' => $novoValor,
            'id' => $economiaId,
            'user_id' => $userId,
        ]);

        if ($movimentacaoId === null) {
            return;
        }

        $stmt = $this->connection->prepare(
            'UPDATE movimentacoes
            SET valor = :valor,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = :id
              AND user_id = :user_id'
        );

        $stmt->execute([
            'valor' => $novoValor,
            'id' => $movimentacaoId,
            'user_id' => $userId,
        ]);
    }

    private function atualizarResumoMeta(int $metaId, int $userId): ?array
    {
        $meta = $this->buscarMetaDoUsuario($metaId, $userId);

        if (!$meta) {
            return null;
        }

        $total = $this->totalEconomizadoNaMeta($metaId);
        $status = $total >= (float) $meta['valor_meta'] ? 'concluida' : 'ativa';

        $stmt = $this->connection->prepare(
            'UPDATE metas_economia
            SET valor_atual = :valor_atual,
                status = :status,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = :id
              AND user_id = :user_id
              AND status IN (\'ativa\', \'concluida\', \'pausada\')
            RETURNING id, user_id, nome, valor_meta, valor_atual, data_limite, status, created_at'
        );

        $stmt->execute([
            'valor_atual' => $total,
            'status' => $status,
            'id' => $metaId,
            'user_id' => $userId,
        ]);

        $metaAtualizada = $stmt->fetch();

        return $metaAtualizada ? $this->formatarMeta($metaAtualizada) : null;
    }

    private function totalEconomizadoNaMeta(int $metaId): float
    {
        $stmt = $this->connection->prepare(
            'SELECT COALESCE(SUM(valor), 0) AS total FROM economias WHERE meta_id = :meta_id'
        );

        $stmt->execute(['meta_id' => $metaId]);

        return (float) $stmt->fetch()['total'];
    }

    private function totalEconomizadoNaMetaIgnorandoEconomia(int $metaId, int $economiaIgnoradaId): float
    {
        $stmt = $this->connection->prepare(
            'SELECT COALESCE(SUM(valor), 0) AS total
            FROM economias
            WHERE meta_id = :meta_id
              AND id <> :economia_id'
        );

        $stmt->execute([
            'meta_id' => $metaId,
            'economia_id' => $economiaIgnoradaId,
        ]);

        return (float) $stmt->fetch()['total'];
    }

    private function totalEconomizadoDoUsuario(int $userId): float
    {
        $stmt = $this->connection->prepare(
            "SELECT COALESCE(SUM(e.valor), 0) AS total
            FROM economias e
            JOIN metas_economia m ON m.id = e.meta_id
            WHERE e.user_id = :user_id
              AND m.status IN ('ativa', 'concluida', 'pausada')"
        );

        $stmt->execute(['user_id' => $userId]);

        return (float) $stmt->fetch()['total'];
    }

    private function registrarMovimentacaoEconomia(
        int $userId,
        float $valor,
        string $dataEconomia,
        string $metaNome,
        ?string $descricao
    ): int {
        $categoriaId = $this->buscarOuCriarCategoriaEconomia($userId);
        $descricaoMovimentacao = $descricao ?: 'Economia: ' . $metaNome;

        $stmt = $this->connection->prepare(
            'INSERT INTO movimentacoes (user_id, categoria_id, tipo, valor, data_movimentacao, descricao)
            VALUES (:user_id, :categoria_id, :tipo, :valor, :data_movimentacao, :descricao)
            RETURNING id'
        );

        $stmt->execute([
            'user_id' => $userId,
            'categoria_id' => $categoriaId,
            'tipo' => 'saida',
            'valor' => $valor,
            'data_movimentacao' => $dataEconomia,
            'descricao' => $descricaoMovimentacao,
        ]);

        return (int) $stmt->fetch()['id'];
    }

    private function atualizarMovimentacaoEconomia(
        int $id,
        int $userId,
        float $valor,
        string $dataEconomia,
        string $metaNome,
        ?string $descricao
    ): int {
        $categoriaId = $this->buscarOuCriarCategoriaEconomia($userId);
        $descricaoMovimentacao = $descricao ?: 'Economia: ' . $metaNome;

        $stmt = $this->connection->prepare(
            "UPDATE movimentacoes
            SET categoria_id = :categoria_id,
                tipo = 'saida',
                valor = :valor,
                data_movimentacao = :data_movimentacao,
                descricao = :descricao,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = :id
              AND user_id = :user_id
            RETURNING id"
        );

        $stmt->execute([
            'id' => $id,
            'user_id' => $userId,
            'categoria_id' => $categoriaId,
            'valor' => $valor,
            'data_movimentacao' => $dataEconomia,
            'descricao' => $descricaoMovimentacao,
        ]);

        $movimentacao = $stmt->fetch();

        if ($movimentacao) {
            return (int) $movimentacao['id'];
        }

        return $this->registrarMovimentacaoEconomia($userId, $valor, $dataEconomia, $metaNome, $descricao);
    }

    private function buscarOuCriarCategoriaEconomia(int $userId): int
    {
        $stmt = $this->connection->prepare(
            "SELECT id
            FROM categorias
            WHERE nome = 'Economia'
              AND tipo = 'saida'
              AND (user_id = :user_id OR user_id IS NULL)
            ORDER BY CASE WHEN user_id = :order_user_id THEN 0 ELSE 1 END
            LIMIT 1"
        );

        $stmt->execute([
            'user_id' => $userId,
            'order_user_id' => $userId,
        ]);
        $categoriaId = $stmt->fetchColumn();

        if ($categoriaId) {
            return (int) $categoriaId;
        }

        $insert = $this->connection->prepare(
            "INSERT INTO categorias (user_id, nome, tipo, icone, cor)
            VALUES (:user_id, 'Economia', 'saida', '&#128176;', '#557a35')
            RETURNING id"
        );

        $insert->execute(['user_id' => $userId]);

        return (int) $insert->fetch()['id'];
    }

    private function valorPassaDoLimiteDaMeta(float $valorAtual, float $valorMeta): bool
    {
        return (int) round($valorAtual * 100) > (int) round($valorMeta * 100);
    }

    private function formatarMeta(array $meta): array
    {
        $valorMeta = (float) $meta['valor_meta'];
        $valorAtual = (float) $meta['valor_atual'];

        return [
            'id' => (int) $meta['id'],
            'nome' => $meta['nome'],
            'valor_meta' => $valorMeta,
            'valor_atual' => $valorAtual,
            'percentual' => $valorMeta > 0 ? min(100, round(($valorAtual / $valorMeta) * 100, 2)) : 0,
            'data_limite' => $meta['data_limite'] ?? null,
            'status' => $meta['status'],
            'created_at' => $meta['created_at'] ?? null,
        ];
    }

    private function formatarEconomia(array $economia, string $metaNome): array
    {
        return [
            'id' => (int) $economia['id'],
            'meta_id' => (int) $economia['meta_id'],
            'movimentacao_id' => isset($economia['movimentacao_id']) ? (int) $economia['movimentacao_id'] : null,
            'meta_nome' => $metaNome,
            'valor' => (float) $economia['valor'],
            'data_economia' => $economia['data_economia'],
            'descricao' => $economia['descricao'] ?? null,
            'created_at' => $economia['created_at'] ?? null,
        ];
    }
}
