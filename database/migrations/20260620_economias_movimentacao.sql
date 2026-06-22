ALTER TABLE economias
ADD COLUMN IF NOT EXISTS movimentacao_id INTEGER REFERENCES movimentacoes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS economias_user_meta_idx
    ON economias (user_id, meta_id);

CREATE INDEX IF NOT EXISTS economias_movimentacao_idx
    ON economias (movimentacao_id);

CREATE INDEX IF NOT EXISTS metas_economia_user_nome_lower_idx
    ON metas_economia (user_id, LOWER(nome));
