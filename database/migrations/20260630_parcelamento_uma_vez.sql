ALTER TABLE parcelamentos
    DROP CONSTRAINT IF EXISTS parcelamentos_quantidade_parcelas_check;

ALTER TABLE parcelamentos
    ADD CONSTRAINT parcelamentos_quantidade_parcelas_check
    CHECK (quantidade_parcelas BETWEEN 1 AND 60);
