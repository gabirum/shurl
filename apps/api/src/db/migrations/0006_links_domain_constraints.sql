ALTER TABLE links
  MODIFY domain_id INT UNSIGNED NOT NULL,
  ADD UNIQUE KEY uq_links_domain_code (domain_id, code),
  ADD CONSTRAINT fk_links_domain FOREIGN KEY (domain_id) REFERENCES domains (id) ON DELETE RESTRICT;
