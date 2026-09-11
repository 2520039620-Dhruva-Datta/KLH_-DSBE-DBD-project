-- Phase 1 only: real sessions, atomic reference allocation, grievance audit.
CREATE TABLE sessions (
  token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  expires_at DATETIME(3) NOT NULL,
  CONSTRAINT fk_session_user FOREIGN KEY (user_id) REFERENCES users(id),
  INDEX idx_sessions_expiry (expires_at), INDEX idx_sessions_user (user_id)
);
CREATE TABLE reference_sequences (
  name VARCHAR(30) PRIMARY KEY,
  value BIGINT UNSIGNED NOT NULL
);
INSERT INTO reference_sequences(name,value) SELECT 'applications',COALESCE(MAX(id),0) FROM applications;
INSERT INTO reference_sequences(name,value) SELECT 'grievances',COALESCE(MAX(id),0) FROM grievances;
CREATE TABLE portal_metadata (
  name VARCHAR(50) PRIMARY KEY,
  value VARCHAR(255) NOT NULL
);

ALTER TABLE grievances ADD COLUMN last_actor_id BIGINT UNSIGNED NULL;
UPDATE grievances SET last_actor_id=COALESCE(officer_id,citizen_id);
ALTER TABLE grievances MODIFY last_actor_id BIGINT UNSIGNED NOT NULL,
  ADD CONSTRAINT fk_grievance_actor FOREIGN KEY(last_actor_id) REFERENCES users(id);
ALTER TABLE status_logs MODIFY application_id BIGINT UNSIGNED NULL,
  ADD COLUMN grievance_id BIGINT UNSIGNED NULL,
  MODIFY from_status ENUM('SUBMITTED','UNDER_REVIEW','NEEDS_INFO','FORWARDED','APPROVED','REJECTED','WITHDRAWN','OPEN','IN_PROGRESS','RESOLVED') NULL,
  MODIFY to_status ENUM('SUBMITTED','UNDER_REVIEW','NEEDS_INFO','FORWARDED','APPROVED','REJECTED','WITHDRAWN','OPEN','IN_PROGRESS','RESOLVED') NOT NULL,
  ADD CONSTRAINT fk_log_grievance FOREIGN KEY(grievance_id) REFERENCES grievances(id),
  ADD CONSTRAINT chk_log_target CHECK((application_id IS NOT NULL AND grievance_id IS NULL) OR (application_id IS NULL AND grievance_id IS NOT NULL)),
  ADD INDEX idx_log_grievance_time(grievance_id,created_at);

-- Existing records receive a truthful migration snapshot; earlier times are not invented.
INSERT INTO status_logs(grievance_id,actor_id,from_status,to_status,remarks)
SELECT id,last_actor_id,NULL,status,'Existing grievance imported at backend migration; earlier step timestamps are unavailable.' FROM grievances;

DELIMITER $$
CREATE TRIGGER grievance_before_insert BEFORE INSERT ON grievances FOR EACH ROW
BEGIN
  IF NEW.status <> 'OPEN' OR NEW.last_actor_id <> NEW.citizen_id OR NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.citizen_id AND role='citizen' AND active=TRUE) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='A citizen must file an open grievance';
  END IF;
END$$
CREATE TRIGGER grievance_before_update BEFORE UPDATE ON grievances FOR EACH ROW
BEGIN
  DECLARE actor_role VARCHAR(10);
  DECLARE actor_department BIGINT UNSIGNED;
  DECLARE actor_active BOOLEAN;
  SELECT role,department_id,active INTO actor_role,actor_department,actor_active FROM users WHERE id=NEW.last_actor_id;
  IF actor_role IS NULL OR NOT actor_active OR actor_role NOT IN ('officer','admin') OR (actor_role='officer' AND actor_department<>OLD.department_id) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='An active officer in this department or admin is required';
  END IF;
  IF NEW.reference<>OLD.reference OR NOT(NEW.application_id <=> OLD.application_id) OR NEW.citizen_id<>OLD.citizen_id OR NEW.service_id<>OLD.service_id OR NEW.department_id<>OLD.department_id OR NEW.created_at<>OLD.created_at OR NEW.subject<>OLD.subject OR NEW.description<>OLD.description THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Grievance identity and submitted details are immutable';
  END IF;
  IF NOT((OLD.status='OPEN' AND NEW.status='IN_PROGRESS') OR (OLD.status='IN_PROGRESS' AND NEW.status='RESOLVED')) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Take up the grievance before resolving it; closed grievances are immutable';
  END IF;
  IF NEW.status='RESOLVED' THEN
    IF CHAR_LENGTH(TRIM(NEW.resolution))<20 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='A resolution needs at least 20 characters'; END IF;
    SET NEW.resolved_at=CURRENT_TIMESTAMP(3);
  ELSE SET NEW.resolution=''; SET NEW.resolved_at=NULL;
  END IF;
  SET NEW.officer_id=NEW.last_actor_id;
END$$
CREATE TRIGGER grievance_after_insert AFTER INSERT ON grievances FOR EACH ROW
BEGIN
  INSERT INTO status_logs(grievance_id,actor_id,from_status,to_status,remarks,created_at)
  VALUES(NEW.id,NEW.last_actor_id,NULL,'OPEN','Grievance filed by applicant.',NEW.created_at);
  INSERT INTO notifications(user_id,application_id,title,message)
  VALUES(NEW.citizen_id,NEW.application_id,CONCAT(NEW.reference,' received'),'Your grievance has been sent to the relevant department.');
END$$
CREATE TRIGGER grievance_after_update AFTER UPDATE ON grievances FOR EACH ROW
BEGIN
  INSERT INTO status_logs(grievance_id,actor_id,from_status,to_status,remarks)
  VALUES(NEW.id,NEW.last_actor_id,OLD.status,NEW.status,IF(NEW.status='RESOLVED',NEW.resolution,'An officer has started investigating your grievance.'));
  INSERT INTO notifications(user_id,application_id,title,message)
  VALUES(NEW.citizen_id,NEW.application_id,CONCAT(NEW.reference,' · ',REPLACE(LOWER(NEW.status),'_',' ')),IF(NEW.status='RESOLVED',NEW.resolution,'An officer has started investigating your grievance.'));
END$$
DELIMITER ;
