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
