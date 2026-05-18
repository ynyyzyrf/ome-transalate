-- Migration 0004: Expand fileType enum for Visio, XMind, and legacy DOC support
ALTER TABLE `documents` MODIFY COLUMN `fileType` enum('pdf','docx','doc','xlsx','pptx','vsdx','xmind','jpg','png','other') NOT NULL;
