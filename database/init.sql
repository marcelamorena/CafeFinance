CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS categorias (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NULL REFERENCES users(id) ON DELETE CASCADE,
    nome VARCHAR(80) NOT NULL,
    tipo VARCHAR(10) NOT NULL CHECK (tipo IN ('entrada', 'saida')),
    icone VARCHAR(40),
    cor VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS categorias_padrao_unique
    ON categorias (nome, tipo)
    WHERE user_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS categorias_usuario_unique
    ON categorias (user_id, nome, tipo)
    WHERE user_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS parcelamentos (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    categoria_id INTEGER REFERENCES categorias(id) ON DELETE SET NULL,
    descricao TEXT,
    valor_total NUMERIC(12, 2) NOT NULL CHECK (valor_total > 0),
    valor_parcela NUMERIC(12, 2) NOT NULL CHECK (valor_parcela > 0),
    quantidade_parcelas INTEGER NOT NULL CHECK (quantidade_parcelas BETWEEN 2 AND 60),
    data_primeira_parcela DATE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'quitado', 'cancelado')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS parcelamentos_user_idx
    ON parcelamentos (user_id);

CREATE TABLE IF NOT EXISTS movimentacoes (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    categoria_id INTEGER REFERENCES categorias(id) ON DELETE SET NULL,
    parcelamento_id INTEGER REFERENCES parcelamentos(id) ON DELETE SET NULL,
    parcela_numero INTEGER CHECK (parcela_numero IS NULL OR parcela_numero > 0),
    total_parcelas INTEGER CHECK (total_parcelas IS NULL OR total_parcelas > 0),
    tipo VARCHAR(10) NOT NULL CHECK (tipo IN ('entrada', 'saida')),
    valor NUMERIC(12, 2) NOT NULL CHECK (valor > 0),
    data_movimentacao DATE NOT NULL,
    descricao TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS movimentacoes_user_data_idx
    ON movimentacoes (user_id, data_movimentacao);

CREATE INDEX IF NOT EXISTS movimentacoes_user_tipo_idx
    ON movimentacoes (user_id, tipo);

CREATE INDEX IF NOT EXISTS movimentacoes_categoria_idx
    ON movimentacoes (categoria_id);

CREATE INDEX IF NOT EXISTS movimentacoes_parcelamento_idx
    ON movimentacoes (parcelamento_id);

CREATE TABLE IF NOT EXISTS metas_economia (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    nome VARCHAR(100) NOT NULL,
    valor_meta NUMERIC(12, 2) NOT NULL CHECK (valor_meta > 0),
    valor_atual NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (valor_atual >= 0),
    data_limite DATE,
    status VARCHAR(20) NOT NULL DEFAULT 'ativa' CHECK (status IN ('ativa', 'concluida', 'pausada', 'cancelada')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS metas_economia_user_status_idx
    ON metas_economia (user_id, status);

CREATE TABLE IF NOT EXISTS economias (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    meta_id INTEGER REFERENCES metas_economia(id) ON DELETE SET NULL,
    valor NUMERIC(12, 2) NOT NULL CHECK (valor > 0),
    data_economia DATE NOT NULL,
    descricao TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS economias_user_data_idx
    ON economias (user_id, data_economia);

CREATE INDEX IF NOT EXISTS economias_meta_idx
    ON economias (meta_id);

INSERT INTO categorias (nome, tipo, icone, cor)
VALUES
    ('Mercado', 'saida', '&#128722;', '#6e3517'),
    ('Alimentacao', 'saida', '&#127860;', '#8c4c22'),
    ('Transporte', 'saida', '&#128652;', '#c3894a'),
    ('Aluguel', 'saida', '&#127968;', '#7b573f'),
    ('Contas', 'saida', '&#128161;', '#9b6a3a'),
    ('Saude', 'saida', '&#128138;', '#5f7f4f'),
    ('Lazer', 'saida', '&#127918;', '#b06b2f'),
    ('Educacao', 'saida', '&#127891;', '#4f6f8f'),
    ('Assinaturas', 'saida', '&#128240;', '#8b5a44'),
    ('Investimentos', 'saida', '&#128201;', '#2f6f4e'),
    ('Economia', 'saida', '&#128176;', '#557a35'),
    ('Imprevistos', 'saida', '&#9888;', '#a34a2a'),
    ('Outro', 'saida', '...', '#8a7a68'),
    ('Salario', 'entrada', '&#128188;', '#2f6f4e'),
    ('Freelance', 'entrada', '&#128187;', '#4f6f8f'),
    ('Pix', 'entrada', '&#128179;', '#557a35'),
    ('Reembolso', 'entrada', '&#128260;', '#6e8f52'),
    ('Rendimento', 'entrada', '&#128200;', '#3f7f5a'),
    ('Presente', 'entrada', '&#127873;', '#a66a44'),
    ('Venda', 'entrada', '&#128176;', '#6e3517'),
    ('Outro', 'entrada', '...', '#8a7a68')
ON CONFLICT DO NOTHING;
