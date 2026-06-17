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

        return $this->inserirMovimentacao(
            $userId,
            $categoriaId,
            null,
            null,
            null,
            $tipo,
            $valor,
            $dataMovimentacao,
            $descricao
        );
    }

    public function createParcelado(
        int $userId,
        float $valorTotal,
        string $dataPrimeiraParcela,
        string $categoriaNome,
        ?string $descricao,
        int $quantidadeParcelas
    ): array {
        $categoriaId = $this->findCategoriaId($userId, 'saida', $categoriaNome);
        $valoresParcelas = $this->calcularValoresParcelas($valorTotal, $quantidadeParcelas);

        try {
            $this->connection->beginTransaction();

            $stmt = $this->connection->prepare(
                'INSERT INTO parcelamentos (
                    user_id, categoria_id, descricao, valor_total, valor_parcela, quantidade_parcelas, data_primeira_parcela
                )
                VALUES (
                    :user_id, :categoria_id, :descricao, :valor_total, :valor_parcela, :quantidade_parcelas, :data_primeira_parcela
                )
                RETURNING id, user_id, categoria_id, descricao, valor_total, valor_parcela, quantidade_parcelas, data_primeira_parcela, status, created_at'
            );

            $stmt->execute([
                'user_id' => $userId,
                'categoria_id' => $categoriaId,
                'descricao' => $descricao,
                'valor_total' => $valorTotal,
                'valor_parcela' => $valoresParcelas[0],
                'quantidade_parcelas' => $quantidadeParcelas,
                'data_primeira_parcela' => $dataPrimeiraParcela,
            ]);

            $parcelamento = $stmt->fetch();
            $movimentacoes = [];

            for ($parcela = 1; $parcela <= $quantidadeParcelas; $parcela++) {
                $movimentacoes[] = $this->inserirMovimentacao(
                    $userId,
                    $categoriaId,
                    (int) $parcelamento['id'],
                    $parcela,
                    $quantidadeParcelas,
                    'saida',
                    $valoresParcelas[$parcela - 1],
                    $this->adicionarMeses($dataPrimeiraParcela, $parcela - 1),
                    $descricao
                );
            }

            $this->connection->commit();

            return [
                'parcelamento' => $parcelamento,
                'movimentacoes' => $movimentacoes,
            ];
        } catch (Throwable $erro) {
            if ($this->connection->inTransaction()) {
                $this->connection->rollBack();
            }

            throw $erro;
        }
    }

    private function inserirMovimentacao(
        int $userId,
        ?int $categoriaId,
        ?int $parcelamentoId,
        ?int $parcelaNumero,
        ?int $totalParcelas,
        string $tipo,
        float $valor,
        string $dataMovimentacao,
        ?string $descricao
    ): array {
        $stmt = $this->connection->prepare(
            'INSERT INTO movimentacoes (
                user_id, categoria_id, parcelamento_id, parcela_numero, total_parcelas, tipo, valor, data_movimentacao, descricao
            )
            VALUES (
                :user_id, :categoria_id, :parcelamento_id, :parcela_numero, :total_parcelas, :tipo, :valor, :data_movimentacao, :descricao
            )
            RETURNING id, user_id, categoria_id, parcelamento_id, parcela_numero, total_parcelas, tipo, valor, data_movimentacao, descricao, created_at'
        );

        $stmt->execute([
            'user_id' => $userId,
            'categoria_id' => $categoriaId,
            'parcelamento_id' => $parcelamentoId,
            'parcela_numero' => $parcelaNumero,
            'total_parcelas' => $totalParcelas,
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
                m.parcelamento_id,
                m.parcela_numero,
                m.total_parcelas,
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

    public function update(
        int $id,
        int $userId,
        string $tipo,
        float $valor,
        string $dataMovimentacao,
        string $categoriaNome,
        ?string $descricao,
        ?int $quantidadeParcelas = null
    ): ?array {
        $registroAtual = $this->buscarMovimentacaoBase($id, $userId);

        if (!$registroAtual) {
            return null;
        }

        if ($registroAtual['parcelamento_id'] !== null) {
            return $this->updateParcelamento(
                $registroAtual,
                $userId,
                $valor,
                $dataMovimentacao,
                $categoriaNome,
                $descricao,
                $quantidadeParcelas
            );
        }

        $categoriaId = $this->findCategoriaId($userId, $tipo, $categoriaNome);

        $stmt = $this->connection->prepare(
            'UPDATE movimentacoes
            SET categoria_id = :categoria_id,
                tipo = :tipo,
                valor = :valor,
                data_movimentacao = :data_movimentacao,
                descricao = :descricao,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = :id
              AND user_id = :user_id'
        );

        $stmt->execute([
            'id' => $id,
            'user_id' => $userId,
            'categoria_id' => $categoriaId,
            'tipo' => $tipo,
            'valor' => $valor,
            'data_movimentacao' => $dataMovimentacao,
            'descricao' => $descricao,
        ]);

        return $this->buscarRegistroPorId($id, $userId);
    }

    public function delete(int $id, int $userId): ?array
    {
        $registroAtual = $this->buscarMovimentacaoBase($id, $userId);

        if (!$registroAtual) {
            return null;
        }

        if ($registroAtual['parcelamento_id'] !== null) {
            return $this->deleteParcelamento((int) $registroAtual['parcelamento_id'], $userId);
        }

        $stmt = $this->connection->prepare(
            'DELETE FROM movimentacoes
            WHERE id = :id
              AND user_id = :user_id'
        );

        $stmt->execute([
            'id' => $id,
            'user_id' => $userId,
        ]);

        return [
            'parcelamento' => false,
            'removidos' => $stmt->rowCount(),
        ];
    }

    private function updateParcelamento(
        array $registroAtual,
        int $userId,
        float $valorTotal,
        string $dataPrimeiraParcela,
        string $categoriaNome,
        ?string $descricao,
        ?int $quantidadeParcelas
    ): ?array {
        $parcelamentoId = (int) $registroAtual['parcelamento_id'];
        $parcelaReferencia = (int) $registroAtual['parcela_numero'];
        $totalParcelas = $quantidadeParcelas ?? (int) $registroAtual['total_parcelas'];
        $categoriaId = $this->findCategoriaId($userId, 'saida', $categoriaNome);
        $valoresParcelas = $this->calcularValoresParcelas($valorTotal, $totalParcelas);

        try {
            $this->connection->beginTransaction();

            $stmt = $this->connection->prepare(
                'UPDATE parcelamentos
                SET categoria_id = :categoria_id,
                    descricao = :descricao,
                    valor_total = :valor_total,
                    valor_parcela = :valor_parcela,
                    quantidade_parcelas = :quantidade_parcelas,
                    data_primeira_parcela = :data_primeira_parcela,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = :id
                  AND user_id = :user_id'
            );

            $stmt->execute([
                'id' => $parcelamentoId,
                'user_id' => $userId,
                'categoria_id' => $categoriaId,
                'descricao' => $descricao,
                'valor_total' => $valorTotal,
                'valor_parcela' => $valoresParcelas[0],
                'quantidade_parcelas' => $totalParcelas,
                'data_primeira_parcela' => $dataPrimeiraParcela,
            ]);

            $stmt = $this->connection->prepare(
                'SELECT id, parcela_numero
                FROM movimentacoes
                WHERE user_id = :user_id
                  AND parcelamento_id = :parcelamento_id
                ORDER BY parcela_numero ASC'
            );

            $stmt->execute([
                'user_id' => $userId,
                'parcelamento_id' => $parcelamentoId,
            ]);

            $parcelasExistentes = [];

            foreach ($stmt->fetchAll() as $parcela) {
                $parcelasExistentes[(int) $parcela['parcela_numero']] = (int) $parcela['id'];
            }

            for ($parcela = 1; $parcela <= $totalParcelas; $parcela++) {
                $valorParcela = $valoresParcelas[$parcela - 1];
                $dataParcela = $this->adicionarMeses($dataPrimeiraParcela, $parcela - 1);

                if (isset($parcelasExistentes[$parcela])) {
                    $this->atualizarParcela(
                        $parcelasExistentes[$parcela],
                        $userId,
                        $categoriaId,
                        $valorParcela,
                        $dataParcela,
                        $descricao,
                        $totalParcelas
                    );

                    continue;
                }

                $this->inserirMovimentacao(
                    $userId,
                    $categoriaId,
                    $parcelamentoId,
                    $parcela,
                    $totalParcelas,
                    'saida',
                    $valorParcela,
                    $dataParcela,
                    $descricao
                );
            }

            $stmt = $this->connection->prepare(
                'DELETE FROM movimentacoes
                WHERE user_id = :user_id
                  AND parcelamento_id = :parcelamento_id
                  AND parcela_numero > :total_parcelas'
            );

            $stmt->execute([
                'user_id' => $userId,
                'parcelamento_id' => $parcelamentoId,
                'total_parcelas' => $totalParcelas,
            ]);

            $this->connection->commit();

            return $this->buscarRegistroDoParcelamento(
                $parcelamentoId,
                $userId,
                min($parcelaReferencia, $totalParcelas)
            );
        } catch (Throwable $erro) {
            if ($this->connection->inTransaction()) {
                $this->connection->rollBack();
            }

            throw $erro;
        }
    }

    private function deleteParcelamento(int $parcelamentoId, int $userId): array
    {
        try {
            $this->connection->beginTransaction();

            $stmt = $this->connection->prepare(
                'DELETE FROM movimentacoes
                WHERE user_id = :user_id
                  AND parcelamento_id = :parcelamento_id'
            );

            $stmt->execute([
                'user_id' => $userId,
                'parcelamento_id' => $parcelamentoId,
            ]);

            $removidos = $stmt->rowCount();

            $stmt = $this->connection->prepare(
                'DELETE FROM parcelamentos
                WHERE id = :id
                  AND user_id = :user_id'
            );

            $stmt->execute([
                'id' => $parcelamentoId,
                'user_id' => $userId,
            ]);

            $this->connection->commit();

            return [
                'parcelamento' => true,
                'removidos' => $removidos,
            ];
        } catch (Throwable $erro) {
            if ($this->connection->inTransaction()) {
                $this->connection->rollBack();
            }

            throw $erro;
        }
    }

    private function atualizarParcela(
        int $id,
        int $userId,
        ?int $categoriaId,
        float $valor,
        string $dataMovimentacao,
        ?string $descricao,
        int $totalParcelas
    ): void {
        $stmt = $this->connection->prepare(
            "UPDATE movimentacoes
            SET categoria_id = :categoria_id,
                tipo = 'saida',
                valor = :valor,
                data_movimentacao = :data_movimentacao,
                descricao = :descricao,
                total_parcelas = :total_parcelas,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = :id
              AND user_id = :user_id"
        );

        $stmt->execute([
            'id' => $id,
            'user_id' => $userId,
            'categoria_id' => $categoriaId,
            'valor' => $valor,
            'data_movimentacao' => $dataMovimentacao,
            'descricao' => $descricao,
            'total_parcelas' => $totalParcelas,
        ]);
    }

    private function buscarMovimentacaoBase(int $id, int $userId): ?array
    {
        $stmt = $this->connection->prepare(
            'SELECT id, user_id, parcelamento_id, parcela_numero, total_parcelas
            FROM movimentacoes
            WHERE id = :id
              AND user_id = :user_id
            LIMIT 1'
        );

        $stmt->execute([
            'id' => $id,
            'user_id' => $userId,
        ]);

        $registro = $stmt->fetch();

        return $registro ?: null;
    }

    private function buscarRegistroPorId(int $id, int $userId): ?array
    {
        $stmt = $this->connection->prepare(
            "SELECT
                m.id,
                m.tipo,
                m.valor,
                m.data_movimentacao,
                m.descricao,
                m.parcelamento_id,
                m.parcela_numero,
                m.total_parcelas,
                COALESCE(NULLIF(m.descricao, ''), c.nome, 'Sem categoria') AS titulo,
                COALESCE(c.nome, 'Sem categoria') AS categoria,
                COALESCE(c.icone, '...') AS icone,
                m.created_at
            FROM movimentacoes m
            LEFT JOIN categorias c ON c.id = m.categoria_id
            WHERE m.id = :id
              AND m.user_id = :user_id
            LIMIT 1"
        );

        $stmt->execute([
            'id' => $id,
            'user_id' => $userId,
        ]);

        $registro = $stmt->fetch();

        return $registro ? $this->formatarRegistro($registro) : null;
    }

    private function buscarRegistroDoParcelamento(int $parcelamentoId, int $userId, int $parcelaNumero): ?array
    {
        $stmt = $this->connection->prepare(
            "SELECT
                m.id,
                m.tipo,
                m.valor,
                m.data_movimentacao,
                m.descricao,
                m.parcelamento_id,
                m.parcela_numero,
                m.total_parcelas,
                COALESCE(NULLIF(m.descricao, ''), c.nome, 'Sem categoria') AS titulo,
                COALESCE(c.nome, 'Sem categoria') AS categoria,
                COALESCE(c.icone, '...') AS icone,
                m.created_at
            FROM movimentacoes m
            LEFT JOIN categorias c ON c.id = m.categoria_id
            WHERE m.parcelamento_id = :parcelamento_id
              AND m.user_id = :user_id
              AND m.parcela_numero = :parcela_numero
            LIMIT 1"
        );

        $stmt->execute([
            'parcelamento_id' => $parcelamentoId,
            'user_id' => $userId,
            'parcela_numero' => $parcelaNumero,
        ]);

        $registro = $stmt->fetch();

        return $registro ? $this->formatarRegistro($registro) : null;
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
            "SELECT *
            FROM (
                SELECT DISTINCT ON (
                    CASE
                        WHEN m.parcelamento_id IS NULL THEN 'movimentacao-' || m.id::text
                        ELSE 'parcelamento-' || m.parcelamento_id::text
                    END
                )
                    m.id,
                    m.tipo,
                    m.valor,
                    m.data_movimentacao,
                    m.descricao,
                    m.parcelamento_id,
                    m.parcela_numero,
                    m.total_parcelas,
                    COALESCE(NULLIF(m.descricao, ''), c.nome, 'Sem categoria') AS titulo,
                    COALESCE(c.nome, 'Sem categoria') AS categoria,
                    COALESCE(c.icone, '...') AS icone,
                    m.created_at
                FROM movimentacoes m
                LEFT JOIN categorias c ON c.id = m.categoria_id
                WHERE m.user_id = :user_id
                ORDER BY
                    CASE
                        WHEN m.parcelamento_id IS NULL THEN 'movimentacao-' || m.id::text
                        ELSE 'parcelamento-' || m.parcelamento_id::text
                    END,
                    COALESCE(m.parcela_numero, 1) ASC,
                    m.id ASC
            ) recentes
            ORDER BY recentes.created_at DESC, recentes.id DESC
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
            'parcelamento_id' => isset($registro['parcelamento_id']) ? (int) $registro['parcelamento_id'] : null,
            'parcela_numero' => isset($registro['parcela_numero']) ? (int) $registro['parcela_numero'] : null,
            'total_parcelas' => isset($registro['total_parcelas']) ? (int) $registro['total_parcelas'] : null,
            'titulo' => $registro['titulo'],
            'categoria' => $registro['categoria'],
            'icone' => $registro['icone'],
            'created_at' => $registro['created_at'] ?? null,
        ];
    }

    private function calcularValoresParcelas(float $valorTotal, int $quantidadeParcelas): array
    {
        $centavosTotal = (int) round($valorTotal * 100);
        $centavosBase = intdiv($centavosTotal, $quantidadeParcelas);
        $centavosRestantes = $centavosTotal % $quantidadeParcelas;
        $parcelas = [];

        for ($parcela = 1; $parcela <= $quantidadeParcelas; $parcela++) {
            $centavosParcela = $centavosBase + ($parcela <= $centavosRestantes ? 1 : 0);
            $parcelas[] = $centavosParcela / 100;
        }

        return $parcelas;
    }

    private function adicionarMeses(string $data, int $meses): string
    {
        [$ano, $mes, $dia] = array_map('intval', explode('-', $data));
        $indiceMes = ($ano * 12) + ($mes - 1) + $meses;
        $novoAno = intdiv($indiceMes, 12);
        $novoMes = ($indiceMes % 12) + 1;
        $ultimoDia = (int) (new DateTimeImmutable(sprintf('%04d-%02d-01', $novoAno, $novoMes)))->format('t');
        $novoDia = min($dia, $ultimoDia);

        return sprintf('%04d-%02d-%02d', $novoAno, $novoMes, $novoDia);
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
