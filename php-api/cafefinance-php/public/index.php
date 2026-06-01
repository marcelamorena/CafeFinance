<?php

// Entrada unica da API: todas as requisicoes passam por este arquivo.
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');

// Responde a preflight requests do navegador antes de POST/PUT/etc.
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// Depois dos headers, entregamos a decisao de rota para routes/api.php.
require_once __DIR__ . '/../routes/api.php';
