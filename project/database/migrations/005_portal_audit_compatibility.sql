-- Keep legacy routes strict; support the React register's explicit final close.
ALTER TABLE grievances MODIFY status ENUM('OPEN','IN_PROGRESS','RESOLVED','CLOSED') NOT NULL DEFAULT 'OPEN';
DROP TRIGGER grievance_before_update;
DROP TRIGGER grievance_after_update;
DELIMITER $$
CREATE TRIGGER grievance_before_update BEFORE UPDATE ON grievances FOR EACH ROW
BEGIN
  DECLARE actor_role VARCHAR(32);
  DECLARE actor_department BIGINT UNSIGNED;
  DECLARE actor_active BOOLEAN;
  SELECT role,department_id,active INTO actor_role,actor_department,actor_active FROM users WHERE id=NEW.last_actor_id;
  IF actor_role IS NULL OR NOT actor_active OR actor_role NOT IN ('officer','admin') OR (actor_role='officer' AND NOT(actor_department <=> OLD.department_id)) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='An active department officer or administrator is required';
  END IF;
  IF NEW.reference<>OLD.reference OR NOT(NEW.application_id <=> OLD.application_id) OR NEW.citizen_id<>OLD.citizen_id OR NEW.service_id<>OLD.service_id OR NEW.department_id<>OLD.department_id OR NEW.created_at<>OLD.created_at OR NEW.subject<>OLD.subject OR NEW.description<>OLD.description OR NEW.category<>OLD.category OR NEW.location<>OLD.location OR NEW.priority<>OLD.priority THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Submitted grievance details are immutable';
  END IF;
  IF NOT((OLD.status='OPEN' AND NEW.status='IN_PROGRESS') OR (OLD.status='IN_PROGRESS' AND NEW.status='RESOLVED') OR (OLD.status='RESOLVED' AND NEW.status='CLOSED')) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Invalid grievance transition';
  END IF;
  IF NEW.status='RESOLVED' THEN
    IF CHAR_LENGTH(TRIM(NEW.resolution))<20 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='A resolution needs at least 20 characters'; END IF;
    SET NEW.resolved_at=CURRENT_TIMESTAMP(3);
  ELSEIF NEW.status='CLOSED' THEN SET NEW.resolution=OLD.resolution; SET NEW.resolved_at=OLD.resolved_at;
  ELSE SET NEW.resolution=''; SET NEW.resolved_at=NULL;
  END IF;
  SET NEW.officer_id=NEW.last_actor_id;
END$$
CREATE TRIGGER grievance_after_update AFTER UPDATE ON grievances FOR EACH ROW
BEGIN
  DECLARE note TEXT;
  SET note=CASE NEW.status WHEN 'RESOLVED' THEN NEW.resolution WHEN 'CLOSED' THEN 'Resolved grievance closed by department staff.' ELSE 'An officer has started investigating your grievance.' END;
  INSERT INTO status_logs(grievance_id,actor_id,from_status,to_status,remarks) VALUES(NEW.id,NEW.last_actor_id,OLD.status,NEW.status,note);
  INSERT INTO notifications(user_id,application_id,title,message) VALUES(NEW.citizen_id,NEW.application_id,CONCAT(NEW.reference,' - ',REPLACE(LOWER(NEW.status),'_',' ')),note);
END$$
CREATE TRIGGER document_after_insert AFTER INSERT ON documents FOR EACH ROW
BEGIN
  INSERT INTO status_logs(application_id,actor_id,from_status,to_status,remarks)
  SELECT a.id,a.citizen_id,a.status,a.status,'Supporting document attached by applicant.' FROM applications a WHERE a.id=NEW.application_id;
END$$
DELIMITER ;
