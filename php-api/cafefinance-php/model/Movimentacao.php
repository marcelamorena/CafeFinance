<?php

require_once __DIR__ . '/../config/Database.php';

class Movimentacao
{
    private PDO $connection;

    public function __construct()
    {
        $this->connection = Database::getConnection();
    }

    public function create(
        int $userId,
        string $tipo,
        float $valor,
        string $dataMovimentacao,
        string $categoriaNome,
        ?string $descricao
    ): array {
        $categoriaId = $this->findCategoriaId($userId, $tipo, $categoriaNome);

        $stmt = $this->connection->prepare(
            'INSERT INTO movimentacoes (user_id, categoria_id, tipo, valor, data_movimentacao, descricao)
            VALUES (:user_id, :categoria_id, :tipo, :valor, :data_movimentacao, :descricao)
            RETURNING id, user_id, categoria_id, tipo, valor, data_movimentacao, descricao, created_at'
        );

        $stmt->execute([
            'user_id' => $userId,
            'categoria_id' => $categoriaId,
            'tipo' => $tipo,
            'valor' => $valor,
            'data_movimentacao' => $dataMovimentacao,
            'descricao' => $descricao,
        ]);

        return $stmt->fetch();
    }

    public function dashboardResumo(int $userId): array
    {
        $totais = $this->buscarTotais($userId);
        $registrosRecentes = $this->buscarRegistrosRecentes($userId);
        $gastosPorCategoria = $this->buscarGastosPorCategoria($userId, $totais['total_saidas']);

        return [
            'saldo' => $totais['saldo'],
            'total_entradas' => $totais['total_entradas'],
            'total_saidas' => $totais['total_saidas'],
            'registros_recentes' => $registrosRecentes,
            'gastos_por_categoria' => $gastosPorCategoria,
        ];
    }

    public function listarPorUsuario(int $userId): array
    {
        $stmt = $this->connection->prepare(
            "SELECT
                m.id,
                m.tipo,
                m.valor,
                m.data_movimentacao,
                m.descricao,
                COALESCE(NULLIF(m.descricao, ''), c.nome, 'Sem categoria') AS titulo,
                COALESCE(c.nome, 'Sem categoria') AS categoria,
                COALESCE(c.icone, '...') AS icone,
                m.created_at
            FROM movimentacoes m
            LEFT JOIN categorias c ON c.id = m.categoria_id
            WHERE m.user_id = :user_id
            ORDER BY m.data_movimentacao DESC, m.created_at DESC"
        );

        $stmt->execute(['user_id' => $userId]);

        return array_map(
            fn (array $registro) => $this->formatarRegistro($registro),
            $stmt->fetchAll()
        );
    }

    private function findCategoriaId(int $userId, string $tipo, string $categoriaNome): ?int
    {
        $stmt = $this->connection->prepare(
            'SELECT id
            FROM categorias
            WHERE nome = :nome
              AND tipo = :tipo
              AND (user_id IS NULL OR user_id = :user_id)
            ORDER BY CASE WHEN user_id = :user_id THEN 0 ELSE 1 END
            LIMIT 1'
        );

        $stmt->execute([
            'nome' => $categoriaNome,
            'tipo' => $tipo,
            'user_id' => $userId,
        ]);

        $categoria = $stmt->fetch();

        return $categoria ? (int) $categoria['id'] : null;
    }

    private function buscarTotais(int $userId): array
    {
        $stmt = $this->connection->prepare(
            "SELECT
                COALESCE(SUM(CASE WHEN tipo = 'entrada' THEN valor ELSE 0 END), 0) AS total_entradas,
                COALESCE(SUM(CASE WHEN tipo = 'saida' THEN valor ELSE 0 END), 0) AS total_saidas
            FROM movimentacoes
            WHERE user_id = :user_id"
        );

        $stmt->execute(['user_id' => $userId]);
        $totais = $stmt->fetch() ?: ['total_entradas' => 0, 'total_saidas' => 0];

        $totalEntradas = (float) $totais['total_entradas'];
        $totalSaidas = (float) $totais['total_saidas'];

        return [
            'total_entradas' => $totalEntradas,
            'total_saidas' => $totalSaidas,
            'saldo' => $totalEntradas - $totalSaidas,
        ];
    }

    private function buscarRegistrosRecentes(int $userId): array
    {
        $stmt = $this->connection->prepare(
            "SELECT
                m.id,
                m.tipo,
                m.valor,
                m.data_movimentacao,
                m.descricao,
                COALESCE(NULLIF(m.descricao, ''), c.nome, 'Sem categoria') AS titulo,
                COALESCE(c.nome, 'Sem categoria') AS categoria,
                COALESCE(c.icone, '...') AS icone,
                m.created_at
            FROM movimentacoes m
            LEFT JOIN categorias c ON c.id = m.categoria_id
            WHERE m.user_id = :user_id
            ORDER BY m.data_movimentacao DESC, m.created_at DESC
            LIMIT 5"
        );

        $stmt->execute(['user_id' => $userId]);

        return array_map(
            fn (array $registro) => $this->formatarRegistro($registro),
            $stmt->fetchAll()
        );
    }

    private function formatarRegistro(array $registro): array
    {
        return [
            'id' => (int) $registro['id'],
            'tipo' => $registro['tipo'],
            'valor' => (float) $registro['valor'],
            'data_movimentacao' => $registro['data_movimentacao'],
            'descricao' => $registro['descricao'] ?? null,
            'titulo' => $registro['titulo'],
            'categoria' => $registro['categoria'],
            'icone' => $registro['icone'],
            'created_at' => $registro['created_at'] ?? null,
        ];
    }

    private function buscarGastosPorCategoria(int $userId, float $totalSaidas): array
    {
        $stmt = $this->connection->prepare(
            "SELECT
                COALESCE(c.nome, 'Sem categoria') AS nome,
                SUM(m.valor) AS total
            FROM movimentacoes m
            LEFT JOIN categorias c ON c.id = m.categoria_id
            WHERE m.user_id = :user_id
              AND m.tipo = 'saida'
            GROUP BY COALESCE(c.nome, 'Sem categoria')
            ORDER BY total DESC
            LIMIT 5"
        );

        $stmt->execute(['user_id' => $userId]);

        return array_map(
            fn (array $gasto) => [
                'nome' => $gasto['nome'],
                'total' => (float) $gasto['total'],
                'percentual' => $totalSaidas > 0 ? round(((float) $gasto['total'] / $totalSaidas) * 100) : 0,
            ],
            $stmt->fetchAll()
        );
    }
}
