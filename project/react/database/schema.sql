-- =============================================================================
--  Application Management & Analytics Portal for Government & Public Services
--  MySQL schema — matches the front-end data model in js/seed.js one-for-one
--
--  Run:  mysql -u root -p < schema.sql
-- =============================================================================

DROP DATABASE IF EXISTS amap_portal;
CREATE DATABASE amap_portal
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
USE amap_portal;

-- -----------------------------------------------------------------------------
-- 1. DEPARTMENTS
-- -----------------------------------------------------------------------------
CREATE TABLE departments (
  department_id   INT AUTO_INCREMENT PRIMARY KEY,
  code            VARCHAR(8)   NOT NULL UNIQUE,
  name            VARCHAR(120) NOT NULL,
  description     VARCHAR(500) NOT NULL,
  head_name       VARCHAR(120),
  contact_email   VARCHAR(120),
  contact_phone   VARCHAR(20),
  icon            VARCHAR(40)  DEFAULT 'building',
  is_active       TINYINT(1)   NOT NULL DEFAULT 1,
  created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_dept_code (code)
) ENGINE=InnoDB;

-- -----------------------------------------------------------------------------
-- 2. USERS  (citizens, department officers, administrators)
-- -----------------------------------------------------------------------------
CREATE TABLE users (
  user_id         INT AUTO_INCREMENT PRIMARY KEY,
  full_name       VARCHAR(120) NOT NULL,
  email           VARCHAR(150) NOT NULL UNIQUE,
  password_hash   VARCHAR(255) NOT NULL,          -- store a bcrypt/argon2 hash, never plaintext
  phone           VARCHAR(20),
  role            ENUM('CITIZEN','OFFICER','ADMIN') NOT NULL DEFAULT 'CITIZEN',
  department_id   INT NULL,                        -- officers only
  designation     VARCHAR(80),
  address         VARCHAR(300),
  city            VARCHAR(80),
  id_last4        CHAR(4),                         -- last four digits only
  status          ENUM('ACTIVE','INACTIVE') NOT NULL DEFAULT 'ACTIVE',
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_user_department
    FOREIGN KEY (department_id) REFERENCES departments(department_id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  INDEX idx_user_role (role),
  INDEX idx_user_dept (department_id),
  INDEX idx_user_email (email)
) ENGINE=InnoDB;

-- -----------------------------------------------------------------------------
-- 3. SERVICES  (what a department publishes for citizens to apply for)
-- -----------------------------------------------------------------------------
CREATE TABLE services (
  service_id      INT AUTO_INCREMENT PRIMARY KEY,
  department_id   INT NOT NULL,
  code            VARCHAR(16)  NOT NULL UNIQUE,
  name            VARCHAR(140) NOT NULL,
  description     VARCHAR(500),
  fee             DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  sla_days        SMALLINT      NOT NULL DEFAULT 15,   -- published turnaround
  required_docs   JSON,                                -- ["Aadhaar / Photo ID", ...]
  is_active       TINYINT(1)    NOT NULL DEFAULT 1,
  created_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_service_department
    FOREIGN KEY (department_id) REFERENCES departments(department_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  INDEX idx_service_dept (department_id),
  INDEX idx_service_active (is_active)
) ENGINE=InnoDB;

-- -----------------------------------------------------------------------------
-- 4. APPLICATIONS  (the heart of the portal)
-- -----------------------------------------------------------------------------
CREATE TABLE applications (
  application_id  INT AUTO_INCREMENT PRIMARY KEY,
  reference_no    VARCHAR(24)  NOT NULL UNIQUE,        -- AMP-2026-00042
  user_id         INT NOT NULL,                        -- the applicant
  service_id      INT NOT NULL,
  department_id   INT NOT NULL,                        -- denormalised: changes when forwarded
  officer_id      INT NULL,                            -- assigned reviewer
  subject         VARCHAR(200) NOT NULL,
  details         TEXT,
  priority        ENUM('NORMAL','HIGH','URGENT') NOT NULL DEFAULT 'NORMAL',
  status          ENUM('SUBMITTED','UNDER_REVIEW','NEEDS_INFO','FORWARDED',
                       'APPROVED','REJECTED','WITHDRAWN') NOT NULL DEFAULT 'SUBMITTED',
  remarks         VARCHAR(600),                        -- latest officer remarks
  fee_paid        DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  sla_days        SMALLINT      NOT NULL DEFAULT 15,   -- snapshot at submission time
  submitted_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  decided_at      TIMESTAMP     NULL,
  CONSTRAINT fk_app_user       FOREIGN KEY (user_id)       REFERENCES users(user_id)             ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_app_service    FOREIGN KEY (service_id)    REFERENCES services(service_id)       ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_app_department FOREIGN KEY (department_id) REFERENCES departments(department_id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_app_officer    FOREIGN KEY (officer_id)    REFERENCES users(user_id)             ON DELETE SET NULL ON UPDATE CASCADE,
  INDEX idx_app_user     (user_id),
  INDEX idx_app_dept     (department_id),
  INDEX idx_app_status   (status),
  INDEX idx_app_officer  (officer_id),
  INDEX idx_app_date     (submitted_at),
  INDEX idx_app_ref      (reference_no)
) ENGINE=InnoDB;

-- -----------------------------------------------------------------------------
-- 5. DOCUMENTS  (supporting files attached to an application)
-- -----------------------------------------------------------------------------
CREATE TABLE documents (
  document_id     INT AUTO_INCREMENT PRIMARY KEY,
  application_id  INT NOT NULL,
  doc_name        VARCHAR(120) NOT NULL,               -- "Address Proof"
  file_name       VARCHAR(255) NOT NULL,
  file_path       VARCHAR(500),                        -- where the blob is stored on disk / S3
  mime_type       VARCHAR(100),
  size_kb         INT,
  verified        TINYINT(1) NOT NULL DEFAULT 0,
  uploaded_at     TIMESTAMP  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_doc_application
    FOREIGN KEY (application_id) REFERENCES applications(application_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  INDEX idx_doc_app (application_id)
) ENGINE=InnoDB;

-- -----------------------------------------------------------------------------
-- 6. STATUS_LOGS  (the audit trail — one row per transition, never updated)
-- -----------------------------------------------------------------------------
CREATE TABLE status_logs (
  log_id          INT AUTO_INCREMENT PRIMARY KEY,
  application_id  INT NOT NULL,
  from_status     VARCHAR(20) NULL,                    -- NULL on the first entry
  to_status       VARCHAR(20) NOT NULL,
  actor_id        INT NULL,
  actor_role      ENUM('CITIZEN','OFFICER','ADMIN','SYSTEM') NOT NULL DEFAULT 'SYSTEM',
  remarks         VARCHAR(600),
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_log_application
    FOREIGN KEY (application_id) REFERENCES applications(application_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_log_actor
    FOREIGN KEY (actor_id) REFERENCES users(user_id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  INDEX idx_log_app  (application_id),
  INDEX idx_log_date (created_at),
  INDEX idx_log_to   (to_status)
) ENGINE=InnoDB;

-- -----------------------------------------------------------------------------
-- 7. GRIEVANCES
-- -----------------------------------------------------------------------------
CREATE TABLE grievances (
  grievance_id    INT AUTO_INCREMENT PRIMARY KEY,
  reference_no    VARCHAR(24) NOT NULL UNIQUE,         -- GRV-2026-0042
  user_id         INT NOT NULL,
  department_id   INT NOT NULL,
  officer_id      INT NULL,
  category        VARCHAR(60)  NOT NULL,
  subject         VARCHAR(200) NOT NULL,
  description     TEXT         NOT NULL,
  location        VARCHAR(300),
  priority        ENUM('NORMAL','HIGH') NOT NULL DEFAULT 'NORMAL',
  status          ENUM('OPEN','IN_PROGRESS','RESOLVED','CLOSED') NOT NULL DEFAULT 'OPEN',
  resolution      VARCHAR(600),
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_grv_user       FOREIGN KEY (user_id)       REFERENCES users(user_id)             ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_grv_department FOREIGN KEY (department_id) REFERENCES departments(department_id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_grv_officer    FOREIGN KEY (officer_id)    REFERENCES users(user_id)             ON DELETE SET NULL ON UPDATE CASCADE,
  INDEX idx_grv_user   (user_id),
  INDEX idx_grv_dept   (department_id),
  INDEX idx_grv_status (status)
) ENGINE=InnoDB;

-- -----------------------------------------------------------------------------
-- 8. NOTIFICATIONS
-- -----------------------------------------------------------------------------
CREATE TABLE notifications (
  notification_id INT AUTO_INCREMENT PRIMARY KEY,
  user_id         INT NOT NULL,
  title           VARCHAR(140) NOT NULL,
  message         VARCHAR(500) NOT NULL,
  type            ENUM('info','success','warning','danger') NOT NULL DEFAULT 'info',
  link            VARCHAR(255),
  is_read         TINYINT(1) NOT NULL DEFAULT 0,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_notif_user
    FOREIGN KEY (user_id) REFERENCES users(user_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  INDEX idx_notif_user (user_id, is_read)
) ENGINE=InnoDB;


-- =============================================================================
--  ANALYTICS VIEWS — what the admin dashboard reads
-- =============================================================================

-- Volume, load and speed per department
CREATE OR REPLACE VIEW v_department_performance AS
SELECT
  d.department_id,
  d.code,
  d.name,
  COUNT(a.application_id)                                                        AS total_applications,
  SUM(a.status = 'APPROVED')                                                     AS approved,
  SUM(a.status = 'REJECTED')                                                     AS rejected,
  SUM(a.status IN ('SUBMITTED','UNDER_REVIEW','NEEDS_INFO','FORWARDED'))         AS pending,
  SUM(a.status IN ('SUBMITTED','UNDER_REVIEW','NEEDS_INFO','FORWARDED')
      AND DATEDIFF(NOW(), a.submitted_at) > a.sla_days)                          AS overdue,
  ROUND(AVG(CASE WHEN a.decided_at IS NOT NULL
                 THEN TIMESTAMPDIFF(HOUR, a.submitted_at, a.decided_at) / 24 END), 1) AS avg_processing_days,
  ROUND(100 * SUM(a.status = 'APPROVED')
        / NULLIF(SUM(a.status IN ('APPROVED','REJECTED')), 0), 1)                AS approval_rate
FROM departments d
LEFT JOIN applications a ON a.department_id = d.department_id
GROUP BY d.department_id, d.code, d.name
ORDER BY total_applications DESC;

-- Applications received / decided per month
CREATE OR REPLACE VIEW v_monthly_volume AS
SELECT
  DATE_FORMAT(a.submitted_at, '%Y-%m') AS period,
  COUNT(*)                             AS received,
  SUM(a.status = 'APPROVED')           AS approved,
  SUM(a.status = 'REJECTED')           AS rejected
FROM applications a
GROUP BY DATE_FORMAT(a.submitted_at, '%Y-%m')
ORDER BY period;

-- Current status split
CREATE OR REPLACE VIEW v_status_split AS
SELECT status, COUNT(*) AS total
FROM applications
GROUP BY status;

-- Officer workload and speed
CREATE OR REPLACE VIEW v_officer_performance AS
SELECT
  u.user_id,
  u.full_name,
  u.designation,
  d.code AS department_code,
  COUNT(a.application_id)                                                AS handled,
  SUM(a.status = 'APPROVED')                                             AS approved,
  SUM(a.status = 'REJECTED')                                             AS rejected,
  SUM(a.status IN ('SUBMITTED','UNDER_REVIEW','NEEDS_INFO','FORWARDED')) AS still_open,
  ROUND(AVG(CASE WHEN a.decided_at IS NOT NULL
                 THEN TIMESTAMPDIFF(HOUR, a.submitted_at, a.decided_at) / 24 END), 1) AS avg_days
FROM users u
LEFT JOIN applications a ON a.officer_id = u.user_id
LEFT JOIN departments d  ON d.department_id = u.department_id
WHERE u.role = 'OFFICER'
GROUP BY u.user_id, u.full_name, u.designation, d.code
ORDER BY handled DESC;

-- Most requested services
CREATE OR REPLACE VIEW v_top_services AS
SELECT
  s.service_id, s.name AS service_name, d.code AS department_code,
  COUNT(a.application_id) AS total
FROM services s
JOIN departments d  ON d.department_id = s.department_id
LEFT JOIN applications a ON a.service_id = s.service_id
GROUP BY s.service_id, s.name, d.code
ORDER BY total DESC;

-- Everything the "track by reference" screen needs, in one row
CREATE OR REPLACE VIEW v_application_full AS
SELECT
  a.application_id, a.reference_no, a.subject, a.details, a.status, a.priority,
  a.remarks, a.fee_paid, a.sla_days, a.submitted_at, a.updated_at, a.decided_at,
  DATEDIFF(NOW(), a.submitted_at) AS age_days,
  (a.status IN ('SUBMITTED','UNDER_REVIEW','NEEDS_INFO','FORWARDED')
   AND DATEDIFF(NOW(), a.submitted_at) > a.sla_days) AS is_overdue,
  c.user_id AS citizen_id, c.full_name AS citizen_name, c.email AS citizen_email, c.phone AS citizen_phone,
  o.user_id AS officer_id, o.full_name AS officer_name,
  s.service_id, s.name AS service_name, s.code AS service_code,
  d.department_id, d.name AS department_name, d.code AS department_code,
  (SELECT COUNT(*) FROM documents dc WHERE dc.application_id = a.application_id) AS document_count
FROM applications a
JOIN users c        ON c.user_id = a.user_id
LEFT JOIN users o   ON o.user_id = a.officer_id
JOIN services s     ON s.service_id = a.service_id
JOIN departments d  ON d.department_id = a.department_id;


-- =============================================================================
--  TRIGGER — keep the audit trail honest without trusting the application layer
-- =============================================================================
DELIMITER $$

CREATE TRIGGER trg_application_status_log
AFTER UPDATE ON applications
FOR EACH ROW
BEGIN
  IF NEW.status <> OLD.status THEN
    INSERT INTO status_logs (application_id, from_status, to_status, actor_id, actor_role, remarks)
    VALUES (NEW.application_id, OLD.status, NEW.status, NEW.officer_id, 'SYSTEM', NEW.remarks);
  END IF;
END$$

DELIMITER ;


-- =============================================================================
--  SEED — a minimal starting set (the front end ships a much larger demo set
--  in js/seed.js; this is what a fresh production install would start from)
-- =============================================================================

INSERT INTO departments (code, name, description, head_name, contact_email, contact_phone, icon) VALUES
('REV','Revenue Department',     'Certificates of income, domicile, nativity and related revenue records.', 'Smt. Lakshmi Prasad',  'revenue@egov.in',   '0891-2540011','scroll'),
('TRN','Transport Department',   'Driving licences, vehicle registration, permits and fitness certificates.','Sri. Vikram Naidu',    'transport@egov.in', '0891-2540022','truck'),
('MUN','Municipal Services',     'Building approvals, trade licences, water and sanitation connections.',   'Sri. Ramesh Chowdary', 'municipal@egov.in', '0891-2540033','building'),
('SWF','Social Welfare',         'Pensions, scholarships, housing subsidies and welfare scheme enrolment.',  'Smt. Anjali Menon',    'welfare@egov.in',   '0891-2540044','heart'),
('HLT','Health Department',      'Health cards, clinical establishment and food safety licensing.',         'Dr. Suresh Iyer',      'health@egov.in',    '0891-2540055','droplet'),
('EDU','Education Department',   'Transfer certificates, duplicate marksheets and institution recognition.', 'Smt. Kavya Sinha',     'education@egov.in', '0891-2540066','book'),
('LND','Land Records',           'Mutation, encumbrance certificates and survey record copies.',            'Sri. Manish Bhat',     'land@egov.in',      '0891-2540077','mapPin'),
('GRV','Public Grievances Cell', 'Citizen complaints, service failures and redressal escalation.',          'Sri. Kiran Pillai',    'grievance@egov.in', '0891-2540088','megaphone');

INSERT INTO services (department_id, code, name, description, fee, sla_days, required_docs) VALUES
(1,'REV-INC','Income Certificate',            'Certified statement of annual family income for scheme eligibility.', 30.00, 15, '["Aadhaar / Photo ID","Address Proof","Income Proof"]'),
(1,'REV-DOM','Domicile / Residence Certificate','Proof of continuous residence within the state.',                   30.00, 15, '["Aadhaar / Photo ID","Address Proof","Ration Card"]'),
(2,'TRN-LLR','Learner''s Licence',             'Apply for a learner''s driving licence and book a slot test.',      200.00,  7, '["Aadhaar / Photo ID","Address Proof","Medical Fitness Report"]'),
(3,'MUN-TRD','Trade Licence',                  'Licence to operate a trade or commercial establishment.',          1200.00, 21, '["Aadhaar / Photo ID","Address Proof","Property Tax Receipt"]'),
(4,'SWF-OAP','Old Age Pension',                'Monthly pension for eligible senior citizens.',                       0.00, 25, '["Aadhaar / Photo ID","Address Proof","Bank Passbook (first page)"]'),
(7,'LND-ENC','Encumbrance Certificate',        'Statement of registered transactions against a property.',           200.00, 12, '["Aadhaar / Photo ID","Land Document"]');

-- Demo accounts. Replace the hashes with real bcrypt output before going live —
-- these placeholders correspond to the demo passwords documented in README.md.
INSERT INTO users (full_name, email, password_hash, phone, role, department_id, designation, city, address, id_last4) VALUES
('Ananya Sharma',        'citizen@demo.gov', '$2y$10$REPLACE_WITH_BCRYPT_OF_citizen123', '9876543210', 'CITIZEN', NULL, NULL,                   'Visakhapatnam', '12-4/7, MVP Colony, Visakhapatnam', '4821'),
('Rakesh Menon',         'officer@demo.gov', '$2y$10$REPLACE_WITH_BCRYPT_OF_officer123', '9845012345', 'OFFICER', 1,    'Deputy Tahsildar',     'Visakhapatnam', 'Revenue Bhavan, Visakhapatnam',     '7712'),
('Dr. R. Sateesh Kumar', 'admin@demo.gov',   '$2y$10$REPLACE_WITH_BCRYPT_OF_admin123',   '9812345670', 'ADMIN',   NULL, 'Portal Administrator', 'Visakhapatnam', 'Secretariat Annexe, Visakhapatnam', '1009');


-- =============================================================================
--  QUERIES THE BACKEND WILL RUN MOST OFTEN
-- =============================================================================

-- Citizen dashboard: my applications
-- SELECT * FROM v_application_full WHERE citizen_id = ? ORDER BY submitted_at DESC;

-- Officer queue: everything open in my department, oldest first
-- SELECT * FROM v_application_full
--  WHERE department_id = ? AND status IN ('SUBMITTED','UNDER_REVIEW','NEEDS_INFO','FORWARDED')
--  ORDER BY submitted_at ASC;

-- Public tracking by reference number
-- SELECT * FROM v_application_full WHERE reference_no = ?;

-- Audit trail for one application
-- SELECT l.*, u.full_name AS actor_name
--   FROM status_logs l LEFT JOIN users u ON u.user_id = l.actor_id
--  WHERE l.application_id = ? ORDER BY l.created_at ASC;

-- Admin KPI strip
-- SELECT COUNT(*)                                                            AS total,
--        SUM(status IN ('SUBMITTED','UNDER_REVIEW','NEEDS_INFO','FORWARDED')) AS pending,
--        SUM(status = 'APPROVED')                                             AS approved,
--        SUM(status = 'REJECTED')                                             AS rejected,
--        ROUND(AVG(CASE WHEN decided_at IS NOT NULL
--             THEN TIMESTAMPDIFF(HOUR, submitted_at, decided_at)/24 END), 1)  AS avg_days
--   FROM applications
--  WHERE submitted_at >= ?;


-- PHASE 2: additive scale and audit extensions
-- Phase 2 additions. Run ONCE after the original Phase 1 schema, on a disposable
-- academic database. schema.sql already includes these statements at its end.
USE amap_portal;
ALTER TABLE departments MODIFY code VARCHAR(16) NOT NULL;

-- Composite indexes follow the register's equality filters, range and order.
ALTER TABLE applications
  ADD INDEX idx_app_department_status_date (department_id, status, submitted_at, application_id),
  ADD INDEX idx_app_citizen_date (user_id, submitted_at, application_id),
  ADD INDEX idx_app_officer_date (officer_id, submitted_at, application_id),
  ADD INDEX idx_app_status_date (status, submitted_at, application_id),
  ADD INDEX idx_app_priority_date (priority, submitted_at, application_id),
  ADD INDEX idx_app_service_date (service_id, submitted_at, application_id),
  ADD INDEX idx_app_decided_date (decided_at),
  ADD COLUMN form_data JSON NULL COMMENT 'Applicant details snapshotted on submission';
ALTER TABLE users
  ADD INDEX idx_user_role_department_status (role, department_id, status),
  ADD INDEX idx_user_status_date (status, created_at, user_id),
  ADD INDEX idx_user_name (full_name),
  ADD INDEX idx_user_created (created_at, user_id);
ALTER TABLE services ADD INDEX idx_service_department_name (department_id, name);
ALTER TABLE grievances
  ADD INDEX idx_grievance_department_status_date (department_id, status, created_at, grievance_id),
  ADD INDEX idx_grievance_citizen_date (user_id, created_at, grievance_id),
  ADD INDEX idx_grievance_category_date (category, created_at, grievance_id);
ALTER TABLE status_logs
  MODIFY application_id INT NULL,
  ADD COLUMN grievance_id INT NULL,
  ADD CONSTRAINT fk_log_grievance FOREIGN KEY (grievance_id) REFERENCES grievances(grievance_id) ON DELETE CASCADE,
  ADD CONSTRAINT chk_log_one_subject CHECK ((application_id IS NOT NULL) + (grievance_id IS NOT NULL) = 1),
  ADD INDEX idx_log_application_time (application_id, created_at, log_id),
  ADD INDEX idx_log_grievance_time (grievance_id, created_at, log_id),
  ADD INDEX idx_log_actor_time (actor_id, created_at, log_id);
ALTER TABLE notifications ADD INDEX idx_notification_user_date (user_id, created_at, notification_id);

-- The same audit table serves both workflows; there is no parallel log table.
-- The backend must set @actor_id and @actor_role from the authenticated session
-- inside the transaction, clear them before releasing the pooled connection,
-- and insert the initial OPEN/SUBMITTED entry when creating each record.
DELIMITER $$
DROP TRIGGER IF EXISTS trg_application_status_log$$
CREATE TRIGGER trg_application_status_log AFTER UPDATE ON applications
FOR EACH ROW
BEGIN
  IF OLD.status <> NEW.status THEN
    INSERT INTO status_logs(application_id, from_status, to_status, actor_id, actor_role, remarks)
    VALUES(NEW.application_id, OLD.status, NEW.status, @actor_id, COALESCE(@actor_role,'SYSTEM'), NEW.remarks);
  END IF;
END$$
CREATE TRIGGER trg_grievance_status_log AFTER UPDATE ON grievances
FOR EACH ROW
BEGIN
  IF OLD.status <> NEW.status THEN
    INSERT INTO status_logs(application_id, grievance_id, from_status, to_status, actor_id, actor_role, remarks)
    VALUES(NULL, NEW.grievance_id, OLD.status, NEW.status, @actor_id, COALESCE(@actor_role,'SYSTEM'), NEW.resolution);
  END IF;
END$$
DELIMITER ;

-- Example paged query; placeholders are bound, never concatenated user input.
-- SELECT * FROM applications
-- WHERE department_id = ? AND status = ?
-- AND submitted_at >= ? AND submitted_at < DATE_ADD(?, INTERVAL 1 DAY)
-- ORDER BY submitted_at DESC, application_id DESC LIMIT ? OFFSET ?;
-- SELECT COUNT(*) FROM applications WHERE department_id = ? AND status = ?;
-- Name/reference substring search may use LIKE with escaped wildcard parameters;
-- leading-wildcard LIKE cannot use a B-tree index. Keep scoped predicates first,
-- and measure EXPLAIN before introducing full-text search with different semantics.
-- SLA remaining is derived from submitted_at + sla_days, not mutable service SLA.
