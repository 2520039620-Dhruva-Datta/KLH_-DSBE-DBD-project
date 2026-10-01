-- The React wizard supports 5 MB documents. Legacy routes keep their lower limit.
ALTER TABLE documents DROP CHECK chk_doc_size, ADD CONSTRAINT chk_doc_size CHECK(size<=5242880);
