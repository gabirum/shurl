ALTER TABLE links ADD CONSTRAINT chk_links_target_url CHECK (target_url LIKE 'http%');
