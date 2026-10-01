-- Blink liveness: how many blinks the server measured in a session's blink step.
-- NULL means the session had no blink step (older sessions, or no blink model).
ALTER TABLE identity_verification_sessions
 ADD COLUMN blink_count TINYINT UNSIGNED NULL AFTER liveness_passed;
