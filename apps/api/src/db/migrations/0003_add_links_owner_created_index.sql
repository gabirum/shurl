ALTER TABLE links
  ADD INDEX idx_links_owner_created (owner, created_at DESC, code),
  DROP INDEX idx_links_owner;
