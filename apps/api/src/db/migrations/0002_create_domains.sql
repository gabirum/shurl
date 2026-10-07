CREATE TABLE IF NOT EXISTS domains (
  id         INT UNSIGNED        NOT NULL AUTO_INCREMENT PRIMARY KEY,
  host       VARCHAR(255)        NOT NULL,
  scheme     ENUM('http','https') NOT NULL DEFAULT 'https',
  created_at TIMESTAMP           NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_domains_host (host)
);
