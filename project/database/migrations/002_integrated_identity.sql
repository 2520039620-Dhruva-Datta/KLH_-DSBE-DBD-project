-- Additive migration. Existing accounts, applications, audit and uploads remain.
ALTER TABLE users MODIFY role ENUM('citizen','officer','admin','verification_agent') NOT NULL DEFAULT 'citizen', ADD city VARCHAR(100) NOT NULL DEFAULT '', ADD id_last4 VARCHAR(4) NOT NULL DEFAULT '';
ALTER TABLE departments MODIFY code VARCHAR(16) NOT NULL, ADD head VARCHAR(100) NOT NULL DEFAULT '', ADD email VARCHAR(150) NOT NULL DEFAULT '', ADD phone VARCHAR(20) NOT NULL DEFAULT '';
ALTER TABLE services ADD code VARCHAR(32) NULL UNIQUE;
UPDATE services SET code=CONCAT('SVC-',id) WHERE code IS NULL;
ALTER TABLE applications ADD subject VARCHAR(200) NOT NULL DEFAULT '', ADD details TEXT NULL;
ALTER TABLE documents ADD verified BOOLEAN NOT NULL DEFAULT FALSE, ADD verified_by BIGINT UNSIGNED NULL, ADD CONSTRAINT fk_doc_verifier FOREIGN KEY(verified_by) REFERENCES users(id);
ALTER TABLE preferences ADD settings JSON NULL;
ALTER TABLE grievances ADD category VARCHAR(80) NOT NULL DEFAULT 'Service Delay', ADD location VARCHAR(300) NOT NULL DEFAULT '', ADD priority ENUM('normal','high','urgent') NOT NULL DEFAULT 'normal';
ALTER TABLE notifications ADD link VARCHAR(255) NOT NULL DEFAULT '', ADD tone VARCHAR(20) NOT NULL DEFAULT 'info';
CREATE INDEX idx_application_status_date ON applications(status,created_at,id);
CREATE INDEX idx_application_officer_date ON applications(officer_id,created_at,id);
CREATE INDEX idx_application_priority ON applications(priority,created_at,id);
CREATE INDEX idx_user_created ON users(created_at,id);

CREATE TABLE trusted_devices (
 id CHAR(36) PRIMARY KEY, user_id BIGINT UNSIGNED NOT NULL, token_hash CHAR(64) NOT NULL UNIQUE,
 browser VARCHAR(100) NOT NULL, platform VARCHAR(80) NOT NULL DEFAULT '', trusted BOOLEAN NOT NULL DEFAULT FALSE,
 first_seen DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), last_seen DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 revoked_at DATETIME(3) NULL, FOREIGN KEY(user_id) REFERENCES users(id), INDEX idx_device_user(user_id,trusted)
);
ALTER TABLE sessions ADD id CHAR(36) NULL UNIQUE, ADD device_id CHAR(36) NULL, ADD mfa_verified BOOLEAN NOT NULL DEFAULT FALSE, ADD reauthenticated_at DATETIME(3) NULL, ADD last_seen DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), ADD FOREIGN KEY(device_id) REFERENCES trusted_devices(id);
UPDATE sessions SET id=UUID() WHERE id IS NULL;
CREATE TABLE security_events (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, user_id BIGINT UNSIGNED NULL, actor_id BIGINT UNSIGNED NULL,
 event VARCHAR(64) NOT NULL, outcome VARCHAR(32) NOT NULL DEFAULT 'INFO', risk_level ENUM('LOW','MEDIUM','HIGH','CRITICAL') NOT NULL DEFAULT 'LOW',
 device_id CHAR(36) NULL, session_id CHAR(36) NULL, region VARCHAR(100) NULL, country VARCHAR(2) NULL, metadata JSON NULL,
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), FOREIGN KEY(user_id) REFERENCES users(id), FOREIGN KEY(actor_id) REFERENCES users(id),
 INDEX idx_security_user_time(user_id,created_at), INDEX idx_security_event_time(event,created_at)
);
CREATE TABLE auth_challenges (
 token_hash CHAR(64) PRIMARY KEY, user_id BIGINT UNSIGNED NOT NULL, purpose VARCHAR(32) NOT NULL,
 device_hash CHAR(64) NOT NULL, expires_at DATETIME(3) NOT NULL, attempts TINYINT NOT NULL DEFAULT 0, used_at DATETIME(3) NULL,
 FOREIGN KEY(user_id) REFERENCES users(id), INDEX idx_challenge_expiry(expires_at)
);
CREATE TABLE mfa_methods (
 user_id BIGINT UNSIGNED PRIMARY KEY, secret_cipher TEXT NOT NULL, pending_cipher TEXT NULL, enabled BOOLEAN NOT NULL DEFAULT FALSE,
 last_counter BIGINT NOT NULL DEFAULT -1, updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), FOREIGN KEY(user_id) REFERENCES users(id)
);
CREATE TABLE mfa_recovery_codes (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, user_id BIGINT UNSIGNED NOT NULL, code_hash CHAR(64) NOT NULL UNIQUE, used_at DATETIME(3) NULL,
 FOREIGN KEY(user_id) REFERENCES users(id), INDEX idx_mfa_codes_user(user_id,used_at)
);
CREATE TABLE identity_profiles (
 user_id BIGINT UNSIGNED PRIMARY KEY, provider VARCHAR(20) NOT NULL DEFAULT 'sandbox', sandbox_reference VARCHAR(50) NOT NULL UNIQUE,
 identity_cipher TEXT NOT NULL, masked_identity VARCHAR(30) NOT NULL, dob DATE NOT NULL,
 status VARCHAR(32) NOT NULL DEFAULT 'NOT_VERIFIED', last_verified_at DATETIME(3) NULL,
 FOREIGN KEY(user_id) REFERENCES users(id)
);
CREATE TABLE face_templates (
 user_id BIGINT UNSIGNED PRIMARY KEY, template_cipher MEDIUMTEXT NOT NULL, model VARCHAR(80) NOT NULL,
 enrolled_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), FOREIGN KEY(user_id) REFERENCES users(id)
);
CREATE TABLE consent_records (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, user_id BIGINT UNSIGNED NOT NULL, type VARCHAR(50) NOT NULL, policy_version VARCHAR(20) NOT NULL,
 accepted_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), revoked_at DATETIME(3) NULL,
 FOREIGN KEY(user_id) REFERENCES users(id), INDEX idx_consent_user(user_id,type,revoked_at)
);
CREATE TABLE identity_verification_sessions (
 id CHAR(36) PRIMARY KEY, token_hash CHAR(64) NOT NULL UNIQUE, user_id BIGINT UNSIGNED NULL, actor_id BIGINT UNSIGNED NULL,
 kind ENUM('ENROLLMENT','RECOVERY','VERIFICATION','ASSISTED') NOT NULL, state VARCHAR(48) NOT NULL DEFAULT 'CREATED',
 device_hash CHAR(64) NOT NULL, bound_session_hash CHAR(64) NULL, challenge JSON NOT NULL, evidence_cipher MEDIUMTEXT NULL,
 attempts TINYINT NOT NULL DEFAULT 0, expires_at DATETIME(3) NOT NULL, consumed_at DATETIME(3) NULL,
 risk_level ENUM('LOW','MEDIUM','HIGH','CRITICAL') NOT NULL DEFAULT 'MEDIUM', risk_reasons JSON NULL,
 quality_passed BOOLEAN NOT NULL DEFAULT FALSE, liveness_passed BOOLEAN NOT NULL DEFAULT FALSE, face_passed BOOLEAN NOT NULL DEFAULT FALSE,
 age_consistency VARCHAR(30) NOT NULL DEFAULT 'NOT_EVALUATED', mfa_passed BOOLEAN NOT NULL DEFAULT FALSE,
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
 FOREIGN KEY(user_id) REFERENCES users(id), FOREIGN KEY(actor_id) REFERENCES users(id),
 INDEX idx_identity_user_time(user_id,created_at), INDEX idx_identity_expiry(expires_at), INDEX idx_identity_state(state,created_at)
);
CREATE TABLE verification_agents (
 user_id BIGINT UNSIGNED PRIMARY KEY, agent_code VARCHAR(30) NOT NULL UNIQUE, status ENUM('PENDING','APPROVED','SUSPENDED','REVOKED') NOT NULL DEFAULT 'PENDING',
 certification VARCHAR(150) NOT NULL, authorized_until DATE NOT NULL, photo_url VARCHAR(255) NOT NULL DEFAULT '',
 FOREIGN KEY(user_id) REFERENCES users(id)
);
CREATE TABLE agent_devices (
 id CHAR(36) PRIMARY KEY, agent_id BIGINT UNSIGNED NOT NULL, device_hash CHAR(64) NOT NULL, label VARCHAR(100) NOT NULL,
 capabilities JSON NOT NULL, status ENUM('PENDING','APPROVED','REJECTED','REVOKED') NOT NULL DEFAULT 'PENDING', reviewed_by BIGINT UNSIGNED NULL,
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), FOREIGN KEY(agent_id) REFERENCES verification_agents(user_id), FOREIGN KEY(reviewed_by) REFERENCES users(id),
 UNIQUE KEY idx_agent_device(agent_id,device_hash)
);
CREATE TABLE verification_appointments (
 id CHAR(36) PRIMARY KEY, user_id BIGINT UNSIGNED NOT NULL, agent_id BIGINT UNSIGNED NULL, agent_device_id CHAR(36) NULL,
 recovery_session_id CHAR(36) NULL, verification_session_id CHAR(36) NULL,
 location_type ENUM('HOME','WORKPLACE','CENTER') NOT NULL, location_cipher TEXT NOT NULL, scheduled_date DATE NOT NULL, time_window VARCHAR(50) NOT NULL,
 status VARCHAR(48) NOT NULL DEFAULT 'REQUESTED', citizen_token_hash CHAR(64) NULL, agent_token_hash CHAR(64) NULL, token_expires_at DATETIME(3) NULL,
 citizen_confirmed_at DATETIME(3) NULL, agent_confirmed_at DATETIME(3) NULL, last_actor_id BIGINT UNSIGNED NOT NULL,
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
 FOREIGN KEY(user_id) REFERENCES users(id), FOREIGN KEY(agent_id) REFERENCES verification_agents(user_id), FOREIGN KEY(agent_device_id) REFERENCES agent_devices(id),
 FOREIGN KEY(recovery_session_id) REFERENCES identity_verification_sessions(id), FOREIGN KEY(verification_session_id) REFERENCES identity_verification_sessions(id), FOREIGN KEY(last_actor_id) REFERENCES users(id),
 INDEX idx_appointment_citizen(user_id,created_at), INDEX idx_appointment_agent(agent_id,status,scheduled_date), INDEX idx_appointment_status(status,scheduled_date)
);
ALTER TABLE status_logs DROP CHECK chk_log_target, MODIFY actor_id BIGINT UNSIGNED NULL, MODIFY from_status VARCHAR(48) NULL, MODIFY to_status VARCHAR(48) NOT NULL,
 ADD identity_session_id CHAR(36) NULL, ADD appointment_id CHAR(36) NULL,
 ADD FOREIGN KEY(identity_session_id) REFERENCES identity_verification_sessions(id), ADD FOREIGN KEY(appointment_id) REFERENCES verification_appointments(id),
 ADD CONSTRAINT chk_log_target CHECK((application_id IS NOT NULL)+(grievance_id IS NOT NULL)+(identity_session_id IS NOT NULL)+(appointment_id IS NOT NULL)=1),
 ADD INDEX idx_identity_log(identity_session_id,created_at), ADD INDEX idx_appointment_log(appointment_id,created_at);
DELIMITER $$
CREATE TRIGGER identity_after_insert AFTER INSERT ON identity_verification_sessions FOR EACH ROW
BEGIN
 INSERT INTO status_logs(identity_session_id,actor_id,from_status,to_status,remarks) VALUES(NEW.id,NEW.actor_id,NULL,NEW.state,'Identity workflow started.');
END$$
CREATE TRIGGER identity_after_update AFTER UPDATE ON identity_verification_sessions FOR EACH ROW
BEGIN
 IF NEW.state<>OLD.state THEN
  INSERT INTO status_logs(identity_session_id,actor_id,from_status,to_status,remarks) VALUES(NEW.id,NEW.actor_id,OLD.state,NEW.state,'Identity workflow advanced by server policy.');
 END IF;
END$$
CREATE TRIGGER appointment_after_insert AFTER INSERT ON verification_appointments FOR EACH ROW
BEGIN
 INSERT INTO status_logs(appointment_id,actor_id,from_status,to_status,remarks) VALUES(NEW.id,NEW.last_actor_id,NULL,NEW.status,'Assisted verification requested.');
END$$
CREATE TRIGGER appointment_after_update AFTER UPDATE ON verification_appointments FOR EACH ROW
BEGIN
 IF NEW.status<>OLD.status THEN
  INSERT INTO status_logs(appointment_id,actor_id,from_status,to_status,remarks) VALUES(NEW.id,NEW.last_actor_id,OLD.status,NEW.status,'Appointment state updated.');
 END IF;
END$$
DELIMITER ;
