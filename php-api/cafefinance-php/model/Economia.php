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

    public function guardar(int $userId, int $metaId, float $valor, string $dataEconomia, ?string $descricao): array
    {
        $meta = $this->buscarMetaDoUsuario($metaId, $userId);

        if (!$meta) {
            return [];
        }

        try {
            $this->connection->beginTransaction();

            $stmt = $this->connection->prepare(
                'INSERT INTO economias (user_id, meta_id, valor, data_economia, descricao)
                VALUES (:user_id, :meta_id, :valor, :data_economia, :descricao)
                RETURNING id, user_id, meta_id, valor, data_economia, descricao, created_at'
            );

            $stmt->execute([
                'user_id' => $userId,
                'meta_id' => $metaId,
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

            return $this->formatarEconomia($economia, $meta['nome']);
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
                e.valor,
                e.data_economia,
                e.descricao,
                e.created_at,
                m.nome AS meta_nome
            FROM economias e
            JOIN metas_economia m ON m.id = e.meta_id
            WHERE e.user_id = :user_id
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

    private function totalEconomizadoNaMeta(int $metaId): float
    {
        $stmt = $this->connection->prepare(
            'SELECT COALESCE(SUM(valor), 0) AS total FROM economias WHERE meta_id = :meta_id'
        );

        $stmt->execute(['meta_id' => $metaId]);

        return (float) $stmt->fetch()['total'];
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
            'meta_nome' => $metaNome,
            'valor' => (float) $economia['valor'],
            'data_economia' => $economia['data_economia'],
            'descricao' => $economia['descricao'] ?? null,
            'created_at' => $economia['created_at'] ?? null,
        ];
    }
}
