<?php

require_once __DIR__ . '/../model/Economia.php';

class EconomiaController
{
    private const LIMITE_PALAVRAS_DESCRICAO = 12;

    private Economia $economiaModel;

    public function __construct()
    {
        $this->economiaModel = new Economia();
    }

    public function resumo(): void
    {
        $userId = $this->requireAuth();

        try {
            $this->respond(200, [
                'success' => true,
                'message' => 'Economias carregadas com sucesso.',
                'dashboard' => $this->economiaModel->resumo($userId),
            ]);
        } catch (Throwable $erro) {
            $this->respond(500, [
                'success' => false,
                'message' => 'Erro ao carregar economias.',
            ]);
        }
    }

    public function criarMeta(): void
    {
        $userId = $this->requireAuth();
        $body = json_decode(file_get_contents('php://input'), true);

        if (!is_array($body)) {
            $this->respond(400, [
                'success' => false,
                'message' => 'JSON invalido.',
            ]);
        }

        $nome = trim((string) ($body['nome'] ?? ''));
        $valorMeta = $this->normalizarValor($body['valor_meta'] ?? null);
        $dataLimite = trim((string) ($body['data_limite'] ?? ''));

        if ($nome === '') {
            $this->respond(400, [
                'success' => false,
                'message' => 'Informe o nome da meta.',
            ]);
        }

        if ($valorMeta === null || $valorMeta <= 0) {
            $this->respond(400, [
                'success' => false,
                'message' => 'Informe uma meta maior que zero.',
            ]);
        }

        if ($dataLimite !== '' && !$this->dataValida($dataLimite)) {
            $this->respond(400, [
                'success' => false,
                'message' => 'Informe uma data valida.',
            ]);
        }

        try {
            if ($this->economiaModel->nomeMetaExiste($userId, $nome)) {
                $this->respond(409, [
                    'success' => false,
                    'message' => 'Ja existe uma meta com esse nome.',
                ]);
            }

            $meta = $this->economiaModel->criarMeta($userId, $nome, $valorMeta, $dataLimite !== '' ? $dataLimite : null);

            $this->respond(201, [
                'success' => true,
                'message' => 'Meta criada com sucesso.',
                'meta' => $meta,
            ]);
        } catch (Throwable $erro) {
            $this->respond(500, [
                'success' => false,
                'message' => 'Erro ao criar meta.',
            ]);
        }
    }

    public function guardar(): void
    {
        $userId = $this->requireAuth();
        $body = json_decode(file_get_contents('php://input'), true);

        if (!is_array($body)) {
            $this->respond(400, [
                'success' => false,
                'message' => 'JSON invalido.',
            ]);
        }

        $metaId = (int) ($body['meta_id'] ?? 0);
        $valor = $this->normalizarValor($body['valor'] ?? null);
        $dataEconomia = trim((string) ($body['data_economia'] ?? ''));
        $descricao = $this->normalizarDescricao($body['descricao'] ?? '');

        if ($metaId <= 0) {
            $this->respond(400, [
                'success' => false,
                'message' => 'Escolha uma meta para guardar.',
            ]);
        }

        if ($valor === null || $valor <= 0) {
            $this->respond(400, [
                'success' => false,
                'message' => 'Informe um valor maior que zero.',
            ]);
        }

        if (!$this->dataValida($dataEconomia)) {
            $this->respond(400, [
                'success' => false,
                'message' => 'Informe uma data valida.',
            ]);
        }

        if ($descricao !== '' && $this->contarPalavras($descricao) > self::LIMITE_PALAVRAS_DESCRICAO) {
            $this->respond(400, [
                'success' => false,
                'message' => 'A descricao deve ter no maximo 12 palavras.',
            ]);
        }

        try {
            $resultado = $this->economiaModel->guardar(
                $userId,
                $metaId,
                $valor,
                $dataEconomia,
                $descricao !== '' ? $descricao : null
            );

            if (!$resultado) {
                $this->respond(404, [
                    'success' => false,
                    'message' => 'Meta nao encontrada.',
                ]);
            }

            $this->respond(201, [
                'success' => true,
                'message' => 'Economia guardada com sucesso.',
                'economia' => $resultado['economia'],
                'meta' => $resultado['meta'],
                'total_economizado' => $resultado['total_economizado'],
            ]);
        } catch (DomainException $erro) {
            $this->respond(400, [
                'success' => false,
                'message' => $erro->getMessage(),
            ]);
        } catch (Throwable $erro) {
            $this->respond(500, [
                'success' => false,
                'message' => 'Erro ao guardar economia.',
            ]);
        }
    }

    public function atualizarEconomia(int $id): void
    {
        $userId = $this->requireAuth();
        $body = json_decode(file_get_contents('php://input'), true);

        if (!is_array($body)) {
            $this->respond(400, [
                'success' => false,
                'message' => 'JSON invalido.',
            ]);
        }

        $metaId = (int) ($body['meta_id'] ?? 0);
        $valor = $this->normalizarValor($body['valor'] ?? null);
        $dataEconomia = trim((string) ($body['data_economia'] ?? ''));
        $descricao = $this->normalizarDescricao($body['descricao'] ?? '');

        if ($metaId <= 0) {
            $this->respond(400, [
                'success' => false,
                'message' => 'Escolha uma meta para editar a economia.',
            ]);
        }

        if ($valor === null || $valor <= 0) {
            $this->respond(400, [
                'success' => false,
                'message' => 'Informe um valor maior que zero.',
            ]);
        }

        if (!$this->dataValida($dataEconomia)) {
            $this->respond(400, [
                'success' => false,
                'message' => 'Informe uma data valida.',
            ]);
        }

        if ($descricao !== '' && $this->contarPalavras($descricao) > self::LIMITE_PALAVRAS_DESCRICAO) {
            $this->respond(400, [
                'success' => false,
                'message' => 'A descricao deve ter no maximo 12 palavras.',
            ]);
        }

        try {
            $resultado = $this->economiaModel->atualizarEconomia(
                $id,
                $userId,
                $metaId,
                $valor,
                $dataEconomia,
                $descricao !== '' ? $descricao : null
            );

            if (!$resultado) {
                $this->respond(404, [
                    'success' => false,
                    'message' => 'Economia nao encontrada.',
                ]);
            }

            $this->respond(200, [
                'success' => true,
                'message' => 'Economia atualizada com sucesso.',
                'economia' => $resultado['economia'],
                'metas' => $resultado['metas'],
                'total_economizado' => $resultado['total_economizado'],
            ]);
        } catch (DomainException $erro) {
            $this->respond(400, [
                'success' => false,
                'message' => $erro->getMessage(),
            ]);
        } catch (Throwable $erro) {
            $this->respond(500, [
                'success' => false,
                'message' => 'Erro ao atualizar economia.',
            ]);
        }
    }

    public function atualizarMeta(int $id): void
    {
        $userId = $this->requireAuth();
        $body = json_decode(file_get_contents('php://input'), true);

        if (!is_array($body)) {
            $this->respond(400, [
                'success' => false,
                'message' => 'JSON invalido.',
            ]);
        }

        $nome = trim((string) ($body['nome'] ?? ''));
        $valorMeta = $this->normalizarValor($body['valor_meta'] ?? null);
        $valorAtual = array_key_exists('valor_atual', $body) ? $this->normalizarValor($body['valor_atual']) : null;
        $dataLimite = trim((string) ($body['data_limite'] ?? ''));

        if ($nome === '') {
            $this->respond(400, [
                'success' => false,
                'message' => 'Informe o nome da meta.',
            ]);
        }

        if ($valorMeta === null || $valorMeta <= 0) {
            $this->respond(400, [
                'success' => false,
                'message' => 'Informe uma meta maior que zero.',
            ]);
        }

        if ($valorAtual !== null && $valorAtual < 0) {
            $this->respond(400, [
                'success' => false,
                'message' => 'Informe um valor guardado valido.',
            ]);
        }

        if ($valorAtual !== null && $valorAtual > $valorMeta) {
            $this->respond(400, [
                'success' => false,
                'message' => 'O valor guardado nao pode passar do valor delimitado na meta.',
            ]);
        }

        if ($dataLimite !== '' && !$this->dataValida($dataLimite)) {
            $this->respond(400, [
                'success' => false,
                'message' => 'Informe uma data valida.',
            ]);
        }

        try {
            if ($this->economiaModel->nomeMetaExiste($userId, $nome, $id)) {
                $this->respond(409, [
                    'success' => false,
                    'message' => 'Ja existe uma meta com esse nome.',
                ]);
            }

            $meta = $this->economiaModel->atualizarMeta(
                $id,
                $userId,
                $nome,
                $valorMeta,
                $dataLimite !== '' ? $dataLimite : null,
                $valorAtual
            );

            if (!$meta) {
                $this->respond(404, [
                    'success' => false,
                    'message' => 'Meta nao encontrada.',
                ]);
            }

            $this->respond(200, [
                'success' => true,
                'message' => 'Meta atualizada com sucesso.',
                'meta' => $meta,
                'dashboard' => $this->economiaModel->resumo($userId),
            ]);
        } catch (DomainException $erro) {
            $this->respond(400, [
                'success' => false,
                'message' => $erro->getMessage(),
            ]);
        } catch (Throwable $erro) {
            $this->respond(500, [
                'success' => false,
                'message' => 'Erro ao atualizar meta.',
            ]);
        }
    }

    public function excluirMeta(int $id): void
    {
        $userId = $this->requireAuth();

        try {
            $excluida = $this->economiaModel->excluirMeta($id, $userId);

            if (!$excluida) {
                $this->respond(404, [
                    'success' => false,
                    'message' => 'Meta nao encontrada.',
                ]);
            }

            $this->respond(200, [
                'success' => true,
                'message' => 'Meta excluida com sucesso.',
                'id' => $id,
                'dashboard' => $this->economiaModel->resumo($userId),
            ]);
        } catch (Throwable $erro) {
            $this->respond(500, [
                'success' => false,
                'message' => 'Erro ao excluir meta.',
            ]);
        }
    }

    public function excluirEconomia(int $id): void
    {
        $userId = $this->requireAuth();

        try {
            $resultado = $this->economiaModel->excluirEconomia($id, $userId);

            if (!$resultado) {
                $this->respond(404, [
                    'success' => false,
                    'message' => 'Registro de economia nao encontrado.',
                ]);
            }

            $this->respond(200, [
                'success' => true,
                'message' => 'Registro excluido e valor devolvido ao saldo.',
                'id' => $resultado['id'],
                'meta' => $resultado['meta'],
                'total_economizado' => $resultado['total_economizado'],
                'dashboard' => $this->economiaModel->resumo($userId),
            ]);
        } catch (Throwable $erro) {
            $this->respond(500, [
                'success' => false,
                'message' => 'Erro ao excluir economia.',
            ]);
        }
    }

    private function normalizarValor(mixed $valor): ?float
    {
        if (is_int($valor) || is_float($valor)) {
            return (float) $valor;
        }

        if (!is_string($valor)) {
            return null;
        }

        $normalizado = preg_replace('/[^\d,.-]/', '', $valor);

        if ($normalizado === null || $normalizado === '') {
            return null;
        }

        if (str_contains($normalizado, ',')) {
            $normalizado = str_replace('.', '', $normalizado);
            $normalizado = str_replace(',', '.', $normalizado);
        }

        return is_numeric($normalizado) ? (float) $normalizado : null;
    }

    private function normalizarDescricao(mixed $descricao): string
    {
        if (!is_string($descricao)) {
            return '';
        }

        return trim((string) preg_replace('/\s+/', ' ', $descricao));
    }

    private function contarPalavras(string $texto): int
    {
        if ($texto === '') {
            return 0;
        }

        return count(preg_split('/\s+/', $texto, -1, PREG_SPLIT_NO_EMPTY));
    }

    private function dataValida(string $data): bool
    {
        $date = DateTime::createFromFormat('Y-m-d', $data);

        return $date && $date->format('Y-m-d') === $data;
    }

    private function requireAuth(): int
    {
        if (!isset($_SESSION['user_id'])) {
            $this->respond(401, [
                'success' => false,
                'message' => 'Usuario nao autenticado.',
            ]);
        }

        return (int) $_SESSION['user_id'];
    }

    private function respond(int $statusCode, array $data): void
    {
        http_response_code($statusCode);
        echo json_encode($data);
        exit;
    }
}
