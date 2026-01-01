
CREATE DATABASE IF NOT EXISTS thatsveryNAS DEFAULT CHARACTER SET utf8 COLLATE utf8_unicode_ci;
CREATE USER IF NOT EXISTS 'verynas'@'localhost' IDENTIFIED BY 'supernicenas';
GRANT SELECT,INSERT,UPDATE,DELETE,EXECUTE ON thatsveryNAS.* TO 'verynas'@'localhost';

USE thatsveryNAS;

-- main directories like /media/dcornewell/terabob/
CREATE TABLE IF NOT EXISTS paths (
   path_id INT UNSIGNED NOT NULL PRIMARY KEY AUTO_INCREMENT,
   path VARCHAR(1024) NOT NULL,
   status ENUM ('INACTIVE','ACTIVE') NOT NULL DEFAULT 'ACTIVE',
   FULLTEXT INDEX path (path)
);

-- Sub paths of directories we care about in paths like Pictures/ but maybe not backup/
CREATE TABLE IF NOT EXISTS subpaths (
   subpath_id INT UNSIGNED NOT NULL PRIMARY KEY AUTO_INCREMENT,
   path_id INT UNSIGNED NOT NULL,
   path VARCHAR(1024) NOT NULL,
   status ENUM ('INACTIVE','ACTIVE') NOT NULL DEFAULT 'ACTIVE',
   FULLTEXT INDEX path (path),
   INDEX path_id (path_id)
);

-- Patterns we want to exclude like *.log
CREATE TABLE IF NOT EXISTS exclusions (
   pattern VARCHAR(255) NOT NULL,
   subpath_id INT UNSIGNED NOT NULL,
   PRIMARY KEY pattern (pattern,subpath_id)
);

-- List of content types, their description, and what http_header to output. PDF, application/pdf for example
CREATE TABLE IF NOT EXISTS content_types (
   content_type INT UNSIGNED NOT NULL PRIMARY KEY AUTO_INCREMENT,
   regex_pattern VARCHAR(255) NOT NULL,
   description VARCHAR(100) NOT NULL,
   http_header VARCHAR(100) NOT NULL,
   KEY http_header (http_header)
);

-- Individual files
CREATE TABLE IF NOT EXISTS files (
   file_hash BINARY(32) NOT NULL PRIMARY KEY,
   subpath_id INT UNSIGNED NOT NULL,
   filename VARCHAR(512) NOT NULL,
   content_type INT UNSIGNED NOT NULL DEFAULT 0,
   modified_dt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
   size_bytes BIGINT UNSIGNED NOT NULL DEFAULT 0,
   status ENUM ('PENDING','TRACKED','REMOVED','UPDATED') NOT NULL DEFAULT 'TRACKED',
   INDEX path_file (subpath_id, filename),
   FULLTEXT INDEX filename (filename),
   INDEX status (status,content_type)
);

-- Duplicate files where the hash is the same, but file is location somewhere else
CREATE TABLE IF NOT EXISTS file_duplicates (
   file_hash BINARY(32) NOT NULL,
   subpath_id INT UNSIGNED NOT NULL,
   filename VARCHAR(512) NOT NULL,
   INDEX file_hash (file_hash),
   INDEX path_file (subpath_id, filename)
);

-- Information about images we index
CREATE TABLE IF NOT EXISTS file_image_metadata (
   file_hash BINARY(32) NOT NULL,
   image_metadata JSON,
   `taken_dt` DATETIME GENERATED ALWAYS AS (STR_TO_DATE((JSON_VALUE(image_metadata , '$.DateTime')), '%Y-%m-%d %T')) PERSISTENT, 
   INDEX taken_dt (taken_dt),
   KEY file_hash (file_hash)
);

CREATE TABLE IF NOT EXISTS people (
   people_id INT UNSIGNED NOT NULL PRIMARY KEY AUTO_INCREMENT,
   first_name VARCHAR(255) NOT NULL,
   middle_name VARCHAR(255) NOT NULL,
   last_name VARCHAR(255) NOT NULL,
   birth_date DATE NOT NULL,
   INDEX lnfn (last_name, first_name),
   INDEX fnln (first_name, last_name),
   INDEX bd (birth_date)
);

CREATE TABLE IF NOT EXISTS people_faces (
   face_id INT UNSIGNED NOT NULL PRIMARY KEY AUTO_INCREMENT,
   people_id INT UNSIGNED NOT NULL DEFAULT 0,
   face_data TEXT NOT NULL,
   INDEX people_id (people_id),
   UNIQUE INDEX face_data (face_data)
);

-- Binary data on faces
CREATE TABLE IF NOT EXISTS file_image_face (
   file_hash BINARY(32) NOT NULL,
   face_id INT UNSIGNED NOT NULL,
   face_box JSON COMMENT 'JSON holding top, left, bottom, right of the box around the face',
   PRIMARY KEY (face_id, file_hash),
   INDEX file_hash (file_hash)
);

-- Master list of tags we use
CREATE TABLE IF NOT EXISTS tags (
   tag_id INT UNSIGNED NOT NULL PRIMARY KEY AUTO_INCREMENT,
   tag VARCHAR(100) NOT NULL,
   INDEX tag (tag)
);

-- What tags files have on them
CREATE TABLE IF NOT EXISTS file_tags (
   file_hash BINARY(32) NOT NULL,
   tag_id INT UNSIGNED NOT NULL,
   INDEX tag_id (tag_id)
);

-- Archives of files and when they were made. Thinking offline BlueRay copies 
-- but maybe just TAR GZ files sent to the cloud too.
CREATE TABLE IF NOT EXISTS archives (
   archive_id INT UNSIGNED NOT NULL PRIMARY KEY AUTO_INCREMENT,
   archive_dt TIMESTAMP NOT NULL,
   size_bytes INT UNSIGNED NOT NULL
);

-- What files have been archived
CREATE TABLE IF NOT EXISTS archive_files (
   archive_id INT UNSIGNED NOT NULL,
   file_hash BINARY(32) NOT NULL,
   KEY file_hash (file_hash)
);

INSERT IGNORE INTO content_types (content_type,regex_pattern,description,http_header)
VALUES 
(1, 'PNG', 'PNG', 'image/png'),
(2, 'JP[E]?G', 'JPG', 'image/jpeg'),
(3, 'TIF[F]?', "TIFF", 'image/tiff'),
(4, 'PDF', 'PDF', 'application/pdf'),
(5, 'MP4', 'MP4', 'video/mp4'),
(6, 'DOC', 'OpenDocument spreadsheet document', 'application/vnd.oasis.opendocument.spreadsheet'),
(7, 'ODT', 'OpenDocument text document', 'application/vnd.oasis.opendocument.text'),
(8, 'TXT', 'Text', 'text/plain'),
(9, 'XLS', 'Microsoft Excel', 'application/vnd.ms-excel'),
(10, 'XLSX', 'Microsoft Excel (OpenXML)', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'),
(11, 'ZIP', 'ZIP archive', 'application/zip'),
(12, 'MOV', 'MOV video', 'video/quicktime'),
(13, 'AVI', 'AVI video', 'video/x-msvideo'),
(14, 'MKV', 'Matroska video', 'video/x-matroska'),
(15, 'MP3', 'MP3 audio', 'audio/mpeg'),
(16, 'ZIP', 'ZIP archive (alternate)', 'application/x-zip-compressed'),
(17, 'HEIC', 'HEIC image', 'image/heic'),
(18, 'BMP', 'BMP image', 'image/bmp'),
(19, '3GP', '3gp video', 'video/3gpp'),
(20, 'GIF', 'GIF image', 'image/gif'),
(21, 'HTML?', 'HTML document', 'text/html'),
(22, 'FLAC', 'FLAC audio', 'audio/flac'),
(23, 'WMA', 'WMA audio', 'audio/x-ms-wma'),
(24, 'WMV', 'WMV video', 'video/x-ms-wmv'),
(25, 'CSV', 'CSV text file', 'text/csv'),
(26, 'EPUB', 'EPUB document', 'application/epub+zip'),
(27, 'RTF', 'Rich Text Format', 'application/rtf'),
(28, 'SVG', 'SVG image', 'image/svg+xml'),
(29, 'WAV', 'WAV audio', 'audio/wav'),
(30, 'INI', 'INI configuration file', 'text/plain'),
(31, 'EXE', 'Windows executable', 'application/vnd.microsoft.portable-executable'),
(32, 'DLL', 'Windows DLL', 'application/vnd.microsoft.portable-executable');

-- Exclude some things from everywhere
INSERT IGNORE INTO exclusions
(pattern,subpath_id)
VALUES
('.*\.bif$', 0),
('.*\.DS_Store$', 0),
('.*\.log$', 0);
