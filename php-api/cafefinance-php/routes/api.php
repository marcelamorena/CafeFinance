<?php

require_once __DIR__ . '/../Controller/UserController.php';
require_once __DIR__ . '/../Controller/MovimentacaoController.php';

// Roteador simples: identifica caminho e metodo HTTP da requisicao.
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$method = $_SERVER['REQUEST_METHOD'];

// Healthcheck da API PHP.
if ($path === '/' && $method === 'GET') {
    echo json_encode([
        'success' => true,
        'message' => 'PHP API funcionando'
    ]);
    exit;
}

// Rota usada pelo Angular para cadastrar usuario.
if ($path === '/cadastro' && $method === 'POST') {
    (new UserController())->register();
}
if ($path === '/login' && $method === 'POST') {
    (new UserController())->login();
}

if ($path === '/perfil' && $method === 'GET') {
    (new UserController())->perfil();
}

if ($path === '/logout' && $method === 'POST') {
    (new UserController())->logout();
}

if ($path === '/movimentacoes' && $method === 'POST') {
    (new MovimentacaoController())->store();
}

if ($path === '/movimentacoes' && $method === 'GET') {
    (new MovimentacaoController())->index();
}

if ($path === '/movimentacoes/resumo' && $method === 'GET') {
    (new MovimentacaoController())->resumo();
}

// Qualquer rota nao mapeada cai aqui.
http_response_code(404);
echo json_encode([
    'success' => false,
    'message' => 'Rota nao encontrada.'
]);
