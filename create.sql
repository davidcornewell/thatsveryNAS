
CREATE DATABASE IF NOT EXISTS thatsveryNAS DEFAULT CHARACTER SET utf8 COLLATE utf8_unicode_ci;
GRANT SELECT,INSERT,UPDATE,DELETE,EXECUTE ON thatsveryNAS.* TO
'verynas'@localhost IDENTIFIED BY 'nastynas';

USE thatsveryNAS;

CREATE TABLE paths (
   path_id INT UNSIGNED NOT NULL PRIMARY KEY AUTO_INCREMENT,
   path VARCHAR(1024) NOT NULL,
   status ENUM ('INACTIVE','ACTIVE') NOT NULL DEFAULT 'ACTIVE',
   FULLTEXT INDEX path (path)
);

CREATE TABLE exclusions (
   pattern VARCHAR(255) NOT NULL,
   path_id INT UNSIGNED NOT NULL
);

CREATE TABLE content_type (
   content_type INT UNSIGNED NOT NULL PRIMARY KEY AUTO_INCREMENT,
   description VARCHAR(100) NOT NULL,
   http_header VARCHAR(100) NOT NULL
);

CREATE TABLE files (
   file_hash BINARY(32) NOT NULL PRIMARY KEY,
   path_id INT UNSIGNED NOT NULL,
   filename VARCHAR(512) NOT NULL,
   content_type INT UNSIGNED NOT NULL DEFAULT 0,
   modified_dt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
   status ENUM ('PENDING','TRACKED','REMOVED','UPDATED') NOT NULL DEFAULT 'TRACKED',
   INDEX path_file (path_id,filename)
   FULLTEXT INDEX filename (filename)
);

CREATE TABLE tags (
   tag_id INT UNSIGNED NOT NULL PRIMARY KEY AUTO_INCREMENT,
   tag VARCHAR(100) NOT NULL,
   INDEX tag (tag)
);

CREATE TABLE file_tags (
   file_hash BINARY(32) NOT NULL,
   tag_id INT UNSIGNED NOT NULL,
   INDEX tag_id (tag_id)
);

CREATE TABLE archives (
   archive_id INT UNSIGNED NOT NULL PRIMARY KEY AUTO_INCREMENT,
   archive_dt TIMESTAMP NOT NULL,
   size_bytes INT UNSIGNED NOT NULL
);

CREATE TABLE archive_files (
   archive_id INT UNSIGNED NOT NULL,
   file_hash BINARY(32) NOT NULL,
   KEY file_hash (file_hash)
);
