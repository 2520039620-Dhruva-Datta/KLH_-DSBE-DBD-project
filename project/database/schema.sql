-- Civic Desk · MySQL 8.0.16+ (CHECK constraints and JSON supported).
-- Fresh database only. This script creates objects without deleting existing data.
-- Live Phase 1 also requires migrations/001_live_backend.sql (sessions and
-- grievance audit). Prefer npm run setup:local for the complete demo fixture.
CREATE DATABASE IF NOT EXISTS civicdesk CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE civicdesk;

CREATE TABLE departments (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  code VARCHAR(8) NOT NULL UNIQUE,
  icon VARCHAR(40) NOT NULL DEFAULT 'building',
  description VARCHAR(500) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
);
CREATE TABLE users (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  department_id BIGINT UNSIGNED NULL,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('citizen','officer','admin') NOT NULL DEFAULT 'citizen',
  phone VARCHAR(20) NOT NULL DEFAULT '',
  address VARCHAR(300) NOT NULL DEFAULT '',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_user_department FOREIGN KEY(department_id) REFERENCES departments(id),
  CONSTRAINT chk_officer_department CHECK ((role = 'officer' AND department_id IS NOT NULL) OR (role <> 'officer' AND department_id IS NULL)),
  INDEX idx_users_role_department (role, department_id, active)
);
CREATE TABLE services (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  department_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(100) NOT NULL,
  description VARCHAR(1000) NOT NULL,
  fee DECIMAL(10,2) NOT NULL DEFAULT 0,
  sla_days SMALLINT UNSIGNED NOT NULL DEFAULT 14,
  required_documents JSON NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  CONSTRAINT fk_service_department FOREIGN KEY(department_id) REFERENCES departments(id),
  CONSTRAINT chk_fee CHECK(fee >= 0 AND fee <= 100000),
  CONSTRAINT chk_sla CHECK(sla_days BETWEEN 1 AND 365),
  CONSTRAINT chk_document_array CHECK(JSON_TYPE(required_documents) = 'ARRAY' AND JSON_LENGTH(required_documents) > 0),
  INDEX idx_services_department (department_id, active)
);
CREATE TABLE applications (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  reference VARCHAR(30) NOT NULL UNIQUE,
  citizen_id BIGINT UNSIGNED NOT NULL,
  service_id BIGINT UNSIGNED NOT NULL,
  department_id BIGINT UNSIGNED NOT NULL,
  officer_id BIGINT UNSIGNED NULL,
  status ENUM('SUBMITTED','UNDER_REVIEW','NEEDS_INFO','FORWARDED','APPROVED','REJECTED','WITHDRAWN') NOT NULL DEFAULT 'SUBMITTED',
  priority ENUM('normal','high','urgent') NOT NULL DEFAULT 'normal',
  form_data JSON NOT NULL,
  fee DECIMAL(10,2) NOT NULL,
  sla_days SMALLINT UNSIGNED NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  decided_at DATETIME(3) NULL,
  -- Authenticated backend sets actor and remarks on every transition/assignment.
  last_actor_id BIGINT UNSIGNED NOT NULL,
  last_remarks VARCHAR(2000) NOT NULL,
  revision INT UNSIGNED NOT NULL DEFAULT 1,
  CONSTRAINT fk_app_citizen FOREIGN KEY(citizen_id) REFERENCES users(id),
  CONSTRAINT fk_app_service FOREIGN KEY(service_id) REFERENCES services(id),
  CONSTRAINT fk_app_department FOREIGN KEY(department_id) REFERENCES departments(id),
  CONSTRAINT fk_app_officer FOREIGN KEY(officer_id) REFERENCES users(id),
  CONSTRAINT fk_app_actor FOREIGN KEY(last_actor_id) REFERENCES users(id),
  CONSTRAINT chk_app_sla CHECK(sla_days BETWEEN 1 AND 365),
  CONSTRAINT chk_app_fee CHECK(fee >= 0),
  CONSTRAINT chk_decision_date CHECK((status IN ('APPROVED','REJECTED','WITHDRAWN') AND decided_at IS NOT NULL) OR (status NOT IN ('APPROVED','REJECTED','WITHDRAWN') AND decided_at IS NULL)),
  INDEX idx_app_citizen (citizen_id, created_at),
  INDEX idx_app_queue (department_id, status, officer_id, created_at),
  INDEX idx_app_service (service_id, created_at),
  INDEX idx_app_dates (created_at, decided_at)
);
CREATE TABLE documents (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  application_id BIGINT UNSIGNED NOT NULL,
  label VARCHAR(100) NOT NULL,
  name VARCHAR(200) NOT NULL,
  mime VARCHAR(100) NOT NULL,
  size INT UNSIGNED NOT NULL,
  -- Store raw bytes here initially; return a data URL in the API contract.
  -- An object-storage key can replace content later behind the same endpoint.
  content MEDIUMBLOB NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_doc_application FOREIGN KEY(application_id) REFERENCES applications(id),
  CONSTRAINT chk_doc_size CHECK(size <= 1048576),
  INDEX idx_documents_application (application_id)
);
CREATE TABLE status_logs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  application_id BIGINT UNSIGNED NOT NULL,
  actor_id BIGINT UNSIGNED NOT NULL,
  from_status ENUM('SUBMITTED','UNDER_REVIEW','NEEDS_INFO','FORWARDED','APPROVED','REJECTED','WITHDRAWN') NULL,
  to_status ENUM('SUBMITTED','UNDER_REVIEW','NEEDS_INFO','FORWARDED','APPROVED','REJECTED','WITHDRAWN') NOT NULL,
  remarks VARCHAR(2000) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_log_application FOREIGN KEY(application_id) REFERENCES applications(id),
  CONSTRAINT fk_log_actor FOREIGN KEY(actor_id) REFERENCES users(id),
  INDEX idx_log_application_time (application_id, created_at)
);
CREATE TABLE grievances (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  reference VARCHAR(30) NOT NULL UNIQUE,
  application_id BIGINT UNSIGNED NULL,
  service_id BIGINT UNSIGNED NOT NULL,
  citizen_id BIGINT UNSIGNED NOT NULL,
  department_id BIGINT UNSIGNED NOT NULL,
  officer_id BIGINT UNSIGNED NULL,
  subject VARCHAR(150) NOT NULL,
  description VARCHAR(2000) NOT NULL,
  status ENUM('OPEN','IN_PROGRESS','RESOLVED') NOT NULL DEFAULT 'OPEN',
  resolution VARCHAR(2000) NOT NULL DEFAULT '',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  resolved_at DATETIME(3) NULL,
  CONSTRAINT fk_grievance_application FOREIGN KEY(application_id) REFERENCES applications(id),
  CONSTRAINT fk_grievance_service FOREIGN KEY(service_id) REFERENCES services(id),
  CONSTRAINT fk_grievance_citizen FOREIGN KEY(citizen_id) REFERENCES users(id),
  CONSTRAINT fk_grievance_department FOREIGN KEY(department_id) REFERENCES departments(id),
  CONSTRAINT fk_grievance_officer FOREIGN KEY(officer_id) REFERENCES users(id),
  CONSTRAINT chk_resolution CHECK(status <> 'RESOLVED' OR (CHAR_LENGTH(TRIM(resolution)) >= 20 AND resolved_at IS NOT NULL)),
  INDEX idx_grievance_queue (department_id, status, created_at)
);
CREATE TABLE notifications (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  application_id BIGINT UNSIGNED NULL,
  title VARCHAR(200) NOT NULL,
  message VARCHAR(2000) NOT NULL,
  `read` BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_notification_user FOREIGN KEY(user_id) REFERENCES users(id),
  CONSTRAINT fk_notification_application FOREIGN KEY(application_id) REFERENCES applications(id),
  INDEX idx_notifications_user (user_id, `read`, created_at)
);
CREATE TABLE preferences (
  user_id BIGINT UNSIGNED PRIMARY KEY,
  theme ENUM('system','light','dark') NOT NULL DEFAULT 'system',
  CONSTRAINT fk_preference_user FOREIGN KEY(user_id) REFERENCES users(id)
);

DELIMITER $$
CREATE TRIGGER application_before_update BEFORE UPDATE ON applications FOR EACH ROW
BEGIN
  DECLARE actor_role VARCHAR(10);
  DECLARE actor_department BIGINT UNSIGNED;
  DECLARE actor_active BOOLEAN;
  SELECT role,department_id,active INTO actor_role,actor_department,actor_active FROM users WHERE id=NEW.last_actor_id;
  IF actor_role IS NULL OR NOT actor_active THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='An active authenticated actor is required'; END IF;
  IF CHAR_LENGTH(TRIM(NEW.last_remarks)) < 20 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Meaningful remarks of at least 20 characters are required'; END IF;
  IF actor_role='officer' AND NOT (actor_department <=> OLD.department_id) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Officer is outside application department'; END IF;
  IF NEW.citizen_id<>OLD.citizen_id OR NEW.service_id<>OLD.service_id OR NEW.created_at<>OLD.created_at OR NEW.reference<>OLD.reference OR NEW.sla_days<>OLD.sla_days OR NEW.fee<>OLD.fee THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Application identity and service snapshots are immutable'; END IF;
  IF NEW.status<>OLD.status THEN
    IF NOT ((OLD.status='SUBMITTED' AND NEW.status IN ('UNDER_REVIEW','WITHDRAWN')) OR (OLD.status='UNDER_REVIEW' AND NEW.status IN ('APPROVED','REJECTED','NEEDS_INFO','FORWARDED','WITHDRAWN')) OR (OLD.status IN ('NEEDS_INFO','FORWARDED') AND NEW.status='UNDER_REVIEW')) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Invalid application status transition'; END IF;
    IF NEW.status='WITHDRAWN' OR OLD.status='NEEDS_INFO' THEN
      IF actor_role<>'citizen' OR NEW.last_actor_id<>OLD.citizen_id THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Only the applicant can withdraw or respond'; END IF;
    ELSE
      IF actor_role NOT IN ('officer','admin') THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Officer or admin decision required'; END IF;
      IF actor_role='officer' AND OLD.officer_id IS NOT NULL AND OLD.officer_id<>NEW.last_actor_id THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Assign this application to yourself before reviewing'; END IF;
    END IF;
    IF NEW.status IN ('APPROVED','REJECTED','WITHDRAWN') THEN SET NEW.decided_at=CURRENT_TIMESTAMP(3); ELSE SET NEW.decided_at=NULL; END IF;
  ELSE
    IF OLD.status IN ('APPROVED','REJECTED','WITHDRAWN') THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Closed applications are immutable'; END IF;
    IF actor_role NOT IN ('officer','admin') THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Only staff can reassign open records'; END IF;
  END IF;
  IF NEW.department_id<>OLD.department_id AND NEW.status<>'FORWARDED' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Department changes require forwarding'; END IF;
  IF NEW.officer_id IS NOT NULL AND actor_role<>'admin' AND actor_role='officer' AND NEW.status<>'FORWARDED' AND NEW.officer_id<>NEW.last_actor_id THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Officers may only assign to themselves'; END IF;
  IF NEW.officer_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.officer_id AND role='officer' AND active=TRUE AND department_id=NEW.department_id) THEN
    -- Admin decisions use last_actor_id, retaining a department officer assignment.
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Assigned officer must be active in the destination department';
  END IF;
  SET NEW.revision=OLD.revision+1;
END$$

-- The audit trail is written automatically, including same-status reassignments.
CREATE TRIGGER application_after_update AFTER UPDATE ON applications FOR EACH ROW
BEGIN
  INSERT INTO status_logs(application_id,actor_id,from_status,to_status,remarks,created_at)
  VALUES(NEW.id,NEW.last_actor_id,OLD.status,NEW.status,NEW.last_remarks,CURRENT_TIMESTAMP(3));
  INSERT INTO notifications(user_id,application_id,title,message)
  VALUES(NEW.citizen_id,NEW.id,CONCAT(NEW.reference,' · ',REPLACE(LOWER(NEW.status),'_',' ')),NEW.last_remarks);
END$$

CREATE TRIGGER application_after_insert AFTER INSERT ON applications FOR EACH ROW
BEGIN
  INSERT INTO status_logs(application_id,actor_id,from_status,to_status,remarks)
  VALUES(NEW.id,NEW.citizen_id,NULL,NEW.status,NEW.last_remarks);
  INSERT INTO notifications(user_id,application_id,title,message)
  VALUES(NEW.citizen_id,NEW.id,CONCAT(NEW.reference,' · submitted'),NEW.last_remarks);
END$$
DELIMITER ;

CREATE VIEW v_applications_full AS
SELECT a.*,u.name AS citizen_name,u.email AS citizen_email,u.phone AS citizen_phone,
  s.name AS service_name,d.name AS department_name,d.icon AS department_icon,
  COALESCE(o.name,'Unassigned') AS officer_name,
  GREATEST(0,TIMESTAMPDIFF(DAY,a.created_at,CURRENT_TIMESTAMP)) AS ageDays,
  GREATEST(0,TIMESTAMPDIFF(SECOND,a.created_at,COALESCE(a.decided_at,CURRENT_TIMESTAMP))/86400.0) AS processingDays,
  (a.status IN ('SUBMITTED','UNDER_REVIEW','NEEDS_INFO','FORWARDED') AND CURRENT_TIMESTAMP>DATE_ADD(a.created_at,INTERVAL a.sla_days DAY)) AS isOverdue,
  CEIL(a.sla_days - TIMESTAMPDIFF(SECOND,a.created_at,CURRENT_TIMESTAMP)/86400.0) AS daysRemaining
FROM applications a JOIN users u ON u.id=a.citizen_id JOIN services s ON s.id=a.service_id
JOIN departments d ON d.id=a.department_id LEFT JOIN users o ON o.id=a.officer_id;

CREATE VIEW v_department_performance AS
SELECT d.id,d.name,COUNT(a.id) AS total,
  COALESCE(SUM(a.status IN ('SUBMITTED','UNDER_REVIEW','NEEDS_INFO','FORWARDED')),0) AS open,
  COALESCE(SUM(a.status='APPROVED'),0) AS approved,
  COALESCE(SUM(a.status='REJECTED'),0) AS rejected,
  COALESCE(SUM(a.status IN ('APPROVED','REJECTED')),0) AS decided,
  COALESCE(SUM(a.isOverdue),0) AS overdue,
  COALESCE(100*SUM(a.status='APPROVED')/NULLIF(SUM(a.status IN ('APPROVED','REJECTED')),0),0) AS approvalRate,
  COALESCE(AVG(CASE WHEN a.status IN ('APPROVED','REJECTED') THEN a.processingDays END),0) AS avgProcessing,
  COALESCE(100*SUM(a.status IN ('APPROVED','REJECTED') AND a.processingDays<=a.sla_days)/NULLIF(SUM(a.status IN ('APPROVED','REJECTED')),0),0) AS slaCompliance
FROM departments d LEFT JOIN v_applications_full a ON a.department_id=d.id GROUP BY d.id,d.name;

CREATE VIEW v_monthly_volume AS
SELECT DATE_FORMAT(created_at,'%Y-%m') AS month,department_id,COUNT(*) AS submitted
FROM applications GROUP BY DATE_FORMAT(created_at,'%Y-%m'),department_id;

CREATE VIEW v_daily_decisions AS
SELECT DATE(decided_at) AS day,department_id,SUM(status='APPROVED') AS approved,SUM(status='REJECTED') AS rejected
FROM applications WHERE status IN ('APPROVED','REJECTED') GROUP BY DATE(decided_at),department_id;

CREATE VIEW v_status_split AS
SELECT department_id,status,COUNT(*) AS value FROM applications GROUP BY department_id,status;

CREATE VIEW v_officer_performance AS
SELECT u.id,u.name,d.name AS department_name,COUNT(a.id) AS total,
  COALESCE(SUM(a.status IN ('APPROVED','REJECTED')),0) AS decided,
  COALESCE(SUM(a.status IN ('SUBMITTED','UNDER_REVIEW','NEEDS_INFO','FORWARDED')),0) AS open,
  COALESCE(100*SUM(a.status='APPROVED')/NULLIF(SUM(a.status IN ('APPROVED','REJECTED')),0),0) AS approvalRate,
  COALESCE(AVG(CASE WHEN a.status IN ('APPROVED','REJECTED') THEN a.processingDays END),0) AS avgProcessing,
  COALESCE(100*SUM(a.status IN ('APPROVED','REJECTED') AND a.processingDays<=a.sla_days)/NULLIF(SUM(a.status IN ('APPROVED','REJECTED')),0),0) AS slaCompliance
FROM users u JOIN departments d ON d.id=u.department_id LEFT JOIN v_applications_full a ON a.officer_id=u.id
WHERE u.role='officer' GROUP BY u.id,u.name,d.name;

CREATE VIEW v_top_services AS
SELECT s.id,s.name,s.department_id,COUNT(a.id) AS total,
  COALESCE(SUM(a.status='APPROVED'),0) AS approved,
  COALESCE(AVG(CASE WHEN a.status IN ('APPROVED','REJECTED') THEN a.processingDays END),0) AS avgProcessing
FROM services s LEFT JOIN v_applications_full a ON a.service_id=s.id GROUP BY s.id,s.name,s.department_id;

CREATE VIEW v_sla_distribution AS
SELECT department_id,
  CASE WHEN processingDays<=3 THEN '0–3 days' WHEN processingDays<=7 THEN '4–7 days'
       WHEN processingDays<=14 THEN '8–14 days' WHEN processingDays<=30 THEN '15–30 days' ELSE '31+ days' END AS label,
  COUNT(*) AS value
FROM v_applications_full WHERE status IN ('APPROVED','REJECTED') GROUP BY department_id,label;

INSERT INTO departments(id,name,code,icon,description) VALUES
(1,'Revenue & Certificates','REV','certificate','Certificates and records for every milestone.'),
(2,'Municipal Services','MUN','building','Better neighborhoods, thoughtfully managed.'),
(3,'Transport','TRN','transport','Keeping people and communities moving.'),
(4,'Health & Welfare','HLT','health','Accessible care and support for everyone.'),
(5,'Education','EDU','education','Opportunity through education and learning.'),
(6,'Water & Utilities','WTR','water','Reliable connections for everyday essentials.'),
(7,'Environment','ENV','leaf','A cleaner, greener shared future.'),
(8,'Business & Labour','BUS','briefcase','Helping enterprise and livelihoods thrive.');

-- Salted scrypt demo hashes (Node crypto defaults N=16384, r=8, p=1, keylen=64).
-- Format: scrypt:salt:hex. Production registrations must generate fresh random salts.
INSERT INTO users(id,name,email,password_hash,role,department_id,phone,address) VALUES
(1,'Aarav Sharma','citizen@demo.gov','scrypt:civicdesk-demo-citizen:e3f16f0b4849b52c7a45d3b7ad955cb799c712b291bc02bc48c789f794cc6899c04c871190f7760bce8f6410435caa5ff8e25b4eb7ae0dbe67e6a755f4415d35','citizen',NULL,'9810012345','1 Lakeview Road, Hyderabad'),
(2,'Priya Reddy','officer@demo.gov','scrypt:civicdesk-demo-officer:b9c129e77f342938d97def9f50b5f9a2011eef98a2042e40f56c3fc7418c6709ffd785b3f0ffec8fd5a4018696a27129a516fde338de9f0504b8b138f103a156','officer',1,'9810024690','2 Lakeview Road, Hyderabad'),
(3,'Dhruv Kumar','admin@demo.gov','scrypt:civicdesk-demo-admin:ef4748f1f681d64cd1c404592460d60e539738e656aac151d799c66dd50c187d66792dfad8caec4dd9524c706502c631112435e11909ca328f26bd574efd49b0','admin',NULL,'9810037035','3 Lakeview Road, Hyderabad');
INSERT INTO services(id,department_id,name,description,fee,sla_days,required_documents) VALUES
(1,1,'Income Certificate','Verify your household income for eligible public services.',0,7,JSON_ARRAY('Identity proof','Address proof')),
(2,1,'Residence Certificate','Request an official record of your residential address.',50,10,JSON_ARRAY('Identity proof','Photograph')),
(3,1,'Birth Certificate','Request a verified birth certificate for your records.',100,14,JSON_ARRAY('Identity proof')),
(4,1,'Caste Certificate','Apply for a verified caste certificate.',250,21,JSON_ARRAY('Identity proof'));

-- Endpoint-to-SQL examples. :name indicates a bound parameter, never string interpolation.
-- All protected queries add citizen_id=:session_user for citizens, or
-- department_id=:session_department for officers. Administrators have global scope.
-- GET /api/departments: SELECT * FROM departments ORDER BY id;
-- POST /api/departments: INSERT INTO departments(name,code,icon,description) VALUES(:name,:code,:icon,:description);
-- PATCH /api/departments/:id: UPDATE departments SET name=:name,code=:code,icon=:icon,description=:description WHERE id=:id;
-- DELETE /api/departments/:id: DELETE FROM departments WHERE id=:id; -- FK RESTRICT preserves history.
-- GET /api/services: SELECT * FROM services WHERE (:department IS NULL OR department_id=:department);
-- POST /api/services: INSERT INTO services(department_id,name,description,fee,sla_days,required_documents) VALUES(:department,:name,:description,:fee,:sla,:documents_json);
-- PATCH /api/services/:id: UPDATE services SET name=:name,description=:description,fee=:fee,sla_days=:sla,required_documents=:documents_json WHERE id=:id;
-- DELETE /api/services/:id: DELETE FROM services WHERE id=:id;
-- POST /api/auth/login: SELECT * FROM users WHERE email=:email AND role=:role AND active=TRUE; -- Verify hash in Node, set HttpOnly session cookie.
-- POST /api/auth/register: INSERT INTO users(name,email,password_hash,phone,address,role) VALUES(:name,:email,:secure_hash,:phone,:address,'citizen');
-- GET /api/auth/me: SELECT id,name,email,role,department_id,phone,address,active,created_at FROM users WHERE id=:session_user AND active=TRUE;
-- POST /api/auth/logout: invalidate the server-side session and expire its cookie (session store operation).
-- POST /api/auth/password: UPDATE users SET password_hash=:secure_hash WHERE id=:session_user; -- First verify current password.
-- GET /api/users: SELECT id,name,email,role,department_id,active,created_at FROM users WHERE (:role IS NULL OR role=:role);
-- POST /api/users: INSERT INTO users(name,email,password_hash,role,department_id) VALUES(:name,:email,:secure_hash,:role,:department);
-- PATCH /api/users/:id: UPDATE users SET name=:name,phone=:phone,address=:address,active=:active WHERE id=:id; -- Whitelist fields by role.
-- GET /api/preferences: SELECT theme FROM preferences WHERE user_id=:session_user; -- Anonymous preference uses a cookie.
-- PATCH /api/preferences: INSERT INTO preferences(user_id,theme) VALUES(:session_user,:theme) ON DUPLICATE KEY UPDATE theme=:theme;
-- GET /api/applications: SELECT * FROM v_applications_full WHERE (:status IS NULL OR status=:status) AND (:department IS NULL OR department_id=:department) AND (:from IS NULL OR created_at>=:from) AND (:to IS NULL OR created_at<DATE_ADD(:to,INTERVAL 1 DAY)) ORDER BY created_at DESC;
-- GET /api/applications/:id: SELECT * FROM v_applications_full WHERE id=:id; then documents without content and logs joined to actor names.
-- GET /api/track/:reference: SELECT reference,status,service_name,department_name,created_at,decided_at,sla_days,isOverdue,citizen_name,citizen_email FROM v_applications_full WHERE reference=:reference; -- MASK name/email server-side, redact logs, and return only the documented public projection.
-- POST /api/applications: BEGIN; INSERT applications with service fee/SLA snapshots, then INSERT documents; COMMIT. Generate unique reference atomically, never MAX(id)+1 in a concurrent backend.
-- POST /api/applications/:id/transitions:
--   BEGIN; SELECT * FROM applications WHERE id=:id FOR UPDATE;
--   UPDATE applications SET status=:status,department_id=:department,officer_id=:officer,last_actor_id=:session_user,last_remarks=:remarks WHERE id=:id AND revision=:revision;
--   INSERT additional documents for a citizen response in this transaction; COMMIT.
--   Trigger writes log/notification; do not duplicate these inserts in Express.
-- POST /api/applications/assign: BEGIN; SELECT * FROM applications WHERE id IN (:ids) FOR UPDATE; UPDATE applications SET officer_id=:officer,last_actor_id=:session_user,last_remarks=:assignment_remarks WHERE id IN (:ids); COMMIT; -- Validate entire batch first.
-- GET /api/documents/:id: SELECT d.* FROM documents d JOIN applications a ON a.id=d.application_id WHERE d.id=:id; -- Apply application ownership check, encode bytes as data URL.
-- GET /api/grievances: SELECT g.*,u.name AS citizen_name,d.name AS department_name,s.name AS service_name,a.reference AS application_reference FROM grievances g JOIN users u ON u.id=g.citizen_id JOIN departments d ON d.id=g.department_id JOIN services s ON s.id=g.service_id LEFT JOIN applications a ON a.id=g.application_id; -- Apply role/status/department scope.
-- POST /api/grievances: INSERT INTO grievances(reference,application_id,service_id,citizen_id,department_id,subject,description) VALUES(:reference,:application,:service,:session_user,:department,:subject,:description); -- Notify citizen in same transaction.
-- PATCH /api/grievances/:id: UPDATE grievances SET status=:status,officer_id=:session_user,resolution=:resolution,resolved_at=:resolved_at WHERE id=:id AND status=:expected_status; -- OPEN -> IN_PROGRESS -> RESOLVED; notify in transaction.
-- GET /api/notifications: SELECT * FROM notifications WHERE user_id=:session_user ORDER BY created_at DESC;
-- PATCH /api/notifications/:id: UPDATE notifications SET `read`=TRUE WHERE user_id=:session_user AND (:id='all' OR id=:id);
-- GET /api/analytics/public: SELECT COUNT(*) AS applications FROM applications; -- Also COUNT users(citizen), departments, services; no personal records.
-- GET /api/analytics/kpis: SELECT COUNT(*) AS total,SUM(status IN ('SUBMITTED','UNDER_REVIEW','NEEDS_INFO','FORWARDED')) AS open,SUM(status='APPROVED') AS approved,SUM(status='REJECTED') AS rejected,SUM(isOverdue) AS overdue,AVG(CASE WHEN status IN ('APPROVED','REJECTED') THEN processingDays END) AS avgProcessing FROM v_applications_full; -- Include the same submission-date and access filters.
-- GET /api/analytics/monthly: SELECT * FROM v_monthly_volume; -- Join separately aggregated decision months, zero-fill the inclusive UTC months of the selected scope (12 by default), scope both by submission date.
-- GET /api/analytics/daily: SELECT * FROM v_daily_decisions; -- Zero-fill 14 UTC days ending on :to (or today), add submission counts, preserve submission scope.
-- GET /api/analytics/status: SELECT * FROM v_status_split; -- Zero-fill the seven enum statuses.
-- GET /api/analytics/departments: SELECT * FROM v_department_performance;
-- GET /api/analytics/services: SELECT * FROM v_top_services ORDER BY total DESC;
-- GET /api/analytics/officers: SELECT * FROM v_officer_performance ORDER BY decided DESC;
-- GET /api/analytics/sla: SELECT * FROM v_sla_distribution; -- Also return KPI and department compliance.
-- GET /api/analytics/activity: SELECT l.*,u.name AS actor_name,a.reference FROM status_logs l JOIN users u ON u.id=l.actor_id JOIN applications a ON a.id=l.application_id ORDER BY l.created_at DESC,l.id DESC LIMIT 30;
-- GET /api/analytics/dashboard: compose the nine protected analytics results above in one consistent read transaction.
-- POST /api/demo/reset: guarded but disabled for live databases; offline Store reset remains available.
-- Scoped analytics must aggregate filtered base rows BEFORE GROUP BY. Do not filter
-- all-time aggregate views by a date after aggregation. Views above are all-time
-- examples; use their SELECT bodies with WHERE submission/access filters for reports.
-- Use UTC database sessions and ISO-8601 timestamps with Z in every API response.
-- Grant the application DB user SELECT on status_logs, never UPDATE or DELETE;
-- trigger DEFINER owns INSERT permission so application code cannot bypass history.
