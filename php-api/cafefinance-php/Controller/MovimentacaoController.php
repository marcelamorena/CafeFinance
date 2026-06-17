<?php

require_once __DIR__ . '/../model/Movimentacao.php';

class MovimentacaoController
{
    private const LIMITE_PALAVRAS_DESCRICAO = 12;

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
        $descricao = $this->normalizarDescricao($body['descricao'] ?? '');
        $parcelado = filter_var($body['parcelado'] ?? false, FILTER_VALIDATE_BOOLEAN);
        $quantidadeParcelas = (int) ($body['quantidade_parcelas'] ?? 1);

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

        if ($descricao !== '' && $this->contarPalavras($descricao) > self::LIMITE_PALAVRAS_DESCRICAO) {
            $this->respond(400, [
                'success' => false,
                'message' => 'A descricao deve ter no maximo 12 palavras.'
            ]);
        }

        if ($parcelado && $tipo !== 'saida') {
            $this->respond(400, [
                'success' => false,
                'message' => 'Parcelamento esta disponivel apenas para saidas.'
            ]);
        }

        if ($parcelado && ($quantidadeParcelas < 2 || $quantidadeParcelas > 60)) {
            $this->respond(400, [
                'success' => false,
                'message' => 'Informe uma quantidade de parcelas entre 2 e 60.'
            ]);
        }

        try {
            if ($parcelado) {
                $parcelamento = $this->movimentacaoModel->createParcelado(
                    $userId,
                    $valor,
                    $dataMovimentacao,
                    $categoria,
                    $descricao !== '' ? $descricao : null,
                    $quantidadeParcelas
                );

                $this->respond(201, [
                    'success' => true,
                    'message' => "Compra parcelada salva em {$quantidadeParcelas} parcelas.",
                    'parcelamento' => $parcelamento['parcelamento'],
                    'movimentacoes' => $parcelamento['movimentacoes']
                ]);
            }

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

    public function update(int $id): void
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
        $descricao = $this->normalizarDescricao($body['descricao'] ?? '');
        $quantidadeParcelas = isset($body['quantidade_parcelas']) ? (int) $body['quantidade_parcelas'] : null;

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

        if ($descricao !== '' && $this->contarPalavras($descricao) > self::LIMITE_PALAVRAS_DESCRICAO) {
            $this->respond(400, [
                'success' => false,
                'message' => 'A descricao deve ter no maximo 12 palavras.'
            ]);
        }

        if ($quantidadeParcelas !== null && ($quantidadeParcelas < 2 || $quantidadeParcelas > 60)) {
            $this->respond(400, [
                'success' => false,
                'message' => 'Informe uma quantidade de parcelas entre 2 e 60.'
            ]);
        }

        try {
            $movimentacao = $this->movimentacaoModel->update(
                $id,
                $userId,
                $tipo,
                $valor,
                $dataMovimentacao,
                $categoria,
                $descricao !== '' ? $descricao : null,
                $quantidadeParcelas
            );

            if (!$movimentacao) {
                $this->respond(404, [
                    'success' => false,
                    'message' => 'Registro nao encontrado.'
                ]);
            }

            $this->respond(200, [
                'success' => true,
                'message' => 'Registro atualizado com sucesso.',
                'movimentacao' => $movimentacao
            ]);
        } catch (Throwable $erro) {
            $this->respond(500, [
                'success' => false,
                'message' => 'Erro ao atualizar registro.'
            ]);
        }
    }

    public function destroy(int $id): void
    {
        $userId = $this->requireAuth();

        try {
            $resultado = $this->movimentacaoModel->delete($id, $userId);

            if (!$resultado) {
                $this->respond(404, [
                    'success' => false,
                    'message' => 'Registro nao encontrado.'
                ]);
            }

            $mensagem = $resultado['parcelamento']
                ? 'Compra parcelada excluida com sucesso.'
                : 'Registro excluido com sucesso.';

            $this->respond(200, [
                'success' => true,
                'message' => $mensagem,
                'removidos' => $resultado['removidos']
            ]);
        } catch (Throwable $erro) {
            $this->respond(500, [
                'success' => false,
                'message' => 'Erro ao excluir registro.'
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
