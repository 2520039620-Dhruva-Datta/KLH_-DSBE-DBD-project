-- Preserve existing audit triggers while extending the React lifecycle.
DROP TRIGGER application_before_update;
DELIMITER $$
CREATE TRIGGER application_before_update BEFORE UPDATE ON applications FOR EACH ROW
BEGIN
  DECLARE actor_role VARCHAR(32);
  DECLARE actor_department BIGINT UNSIGNED;
  DECLARE actor_active BOOLEAN;
  SELECT role,department_id,active INTO actor_role,actor_department,actor_active FROM users WHERE id=NEW.last_actor_id;
  IF actor_role IS NULL OR NOT actor_active THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='An active authenticated actor is required'; END IF;
  IF CHAR_LENGTH(TRIM(NEW.last_remarks)) < 20 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Meaningful remarks of at least 20 characters are required'; END IF;
  IF actor_role='officer' AND NOT (actor_department <=> OLD.department_id) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Officer is outside application department'; END IF;
  IF NEW.citizen_id<>OLD.citizen_id OR NEW.service_id<>OLD.service_id OR NEW.created_at<>OLD.created_at OR NEW.reference<>OLD.reference OR NEW.sla_days<>OLD.sla_days OR NEW.fee<>OLD.fee THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Application identity and service snapshots are immutable'; END IF;
  IF NEW.status<>OLD.status THEN
    IF NOT ((OLD.status='SUBMITTED' AND NEW.status IN ('UNDER_REVIEW','WITHDRAWN')) OR (OLD.status='UNDER_REVIEW' AND NEW.status IN ('APPROVED','REJECTED','NEEDS_INFO','FORWARDED','WITHDRAWN')) OR (OLD.status IN ('NEEDS_INFO','FORWARDED') AND NEW.status IN ('UNDER_REVIEW','WITHDRAWN'))) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Invalid application status transition'; END IF;
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
DELIMITER ;
