CREATE TABLE IF NOT EXISTS links (
  code            VARCHAR(32)       NOT NULL PRIMARY KEY,
  target_url      TEXT              NOT NULL,
  redirect_status SMALLINT UNSIGNED NOT NULL,
  owner           VARCHAR(255)      NOT NULL,
  owner_username  VARCHAR(255)      NULL,
  access_count    BIGINT UNSIGNED   NOT NULL DEFAULT 0,
  created_at      TIMESTAMP         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_links_owner_created (owner, created_at DESC, code),
  CONSTRAINT chk_links_redirect_status CHECK (redirect_status IN (302, 307, 308)),
  CONSTRAINT chk_links_target_url CHECK (target_url LIKE 'http%')
);
