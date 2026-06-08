<?php

require_once __DIR__ . '/../model/Movimentacao.php';

class MovimentacaoController
{
    private Movimentacao $movimentacaoModel;

    public function __construct()
    {
        $this->movimentacaoModel = new Movimentacao();
    }

    public function index(): void
    {
        $userId = $this->requireAuth();

        try {
            $this->respond(200, [
                'success' => true,
                'message' => 'Movimentacoes carregadas com sucesso.',
                'movimentacoes' => $this->movimentacaoModel->listarPorUsuario($userId)
            ]);
        } catch (Throwable $erro) {
            $this->respond(500, [
                'success' => false,
                'message' => 'Erro ao carregar movimentacoes.'
            ]);
        }
    }

    public function store(): void
    {
        $userId = $this->requireAuth();
        $body = json_decode(file_get_contents('php://input'), true);

        if (!is_array($body)) {
            $this->respond(400, [
                'success' => false,
                'message' => 'JSON invalido.'
            ]);
        }

        $tipo = trim($body['tipo'] ?? '');
        $valor = $this->normalizarValor($body['valor'] ?? null);
        $dataMovimentacao = trim($body['data_movimentacao'] ?? '');
        $categoria = trim($body['categoria'] ?? '');
        $descricao = trim($body['descricao'] ?? '');

        if (!in_array($tipo, ['entrada', 'saida'], true)) {
            $this->respond(400, [
                'success' => false,
                'message' => 'Tipo de movimentacao invalido.'
            ]);
        }

        if ($valor === null || $valor <= 0) {
            $this->respond(400, [
                'success' => false,
                'message' => 'Informe um valor maior que zero.'
            ]);
        }

        if (!$this->dataValida($dataMovimentacao)) {
            $this->respond(400, [
                'success' => false,
                'message' => 'Informe uma data valida.'
            ]);
        }

        if ($categoria === '') {
            $this->respond(400, [
                'success' => false,
                'message' => 'Escolha uma categoria.'
            ]);
        }

        try {
            $movimentacao = $this->movimentacaoModel->create(
                $userId,
                $tipo,
                $valor,
                $dataMovimentacao,
                $categoria,
                $descricao !== '' ? $descricao : null
            );

            $this->respond(201, [
                'success' => true,
                'message' => 'Registro salvo com sucesso.',
                'movimentacao' => $movimentacao
            ]);
        } catch (Throwable $erro) {
            $this->respond(500, [
                'success' => false,
                'message' => 'Erro ao salvar registro.'
            ]);
        }
    }

    public function resumo(): void
    {
        $userId = $this->requireAuth();

        try {
            $this->respond(200, [
                'success' => true,
                'message' => 'Resumo carregado com sucesso.',
                'dashboard' => $this->movimentacaoModel->dashboardResumo($userId)
            ]);
        } catch (Throwable $erro) {
            $this->respond(500, [
                'success' => false,
                'message' => 'Erro ao carregar resumo.'
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
                'message' => 'Usuario nao autenticado.'
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
