DROP TRIGGER document_after_insert;
DELIMITER $$
CREATE TRIGGER document_after_insert AFTER INSERT ON documents FOR EACH ROW
BEGIN
  -- A document is accepted separately only in these applicant-controlled states.
  -- Information responses also have their own audited status transition.
  INSERT INTO status_logs(application_id,actor_id,from_status,to_status,remarks,created_at)
  SELECT a.id,a.citizen_id,a.status,a.status,'Supporting document attached by applicant.',NEW.created_at
  FROM applications a WHERE a.id=NEW.application_id AND a.status IN ('SUBMITTED','NEEDS_INFO');
END$$
DELIMITER ;
