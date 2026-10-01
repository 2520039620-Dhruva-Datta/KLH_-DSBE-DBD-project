-- Extends the service catalogue with identity documents (Aadhaar, PAN, voter ID,
-- passport, ration card) and other common citizen services that were missing.
-- Additive and idempotent: rows are matched by code, existing services and their
-- application history are never modified.
--
-- A brand-new database has an empty catalogue when migrations run, and the seed
-- fixture then inserts departments 1-8 and services 1-25 with fixed ids. These
-- statements therefore only act on a populated catalogue; scripts/seed-db.cjs
-- re-runs this file after seeding so fresh installs receive the same services.
-- All services are academic demonstrations: no real card or certificate is issued.

INSERT INTO departments(name,code,icon,description)
SELECT 'Identity & Citizen Documents','IDN','idCard','Identity cards, voter registration, passports and ration cards in one place.'
FROM DUAL
WHERE EXISTS (SELECT 1 FROM services) AND NOT EXISTS (SELECT 1 FROM departments WHERE code='IDN');

INSERT INTO services(department_id,code,name,description,fee,sla_days,required_documents)
SELECT d.id,v.code,v.name,v.description,v.fee,v.sla_days,v.docs
FROM (
  SELECT 'IDN' dept,'AADHAAR-NEW' code,'Aadhaar Enrolment' name,'Request a new Aadhaar enrolment. Biometrics are captured at an enrolment centre visit; this academic portal records and tracks the request only and issues no real Aadhaar number.' description,0 fee,30 sla_days,JSON_ARRAY('Identity proof','Address proof','Date of birth proof') docs
  UNION ALL SELECT 'IDN','AADHAAR-UPD','Aadhaar Update (Name, Address, Mobile)','Correct your name, address, date of birth or mobile number on Aadhaar. Supporting proof is checked before the update is approved. Demonstration only.',50,15,JSON_ARRAY('Identity proof','Address proof')
  UNION ALL SELECT 'IDN','PAN-NEW','PAN Card Application','Apply for a new Permanent Account Number card for income tax purposes. The request is reviewed and tracked here; no real PAN is allotted.',107,15,JSON_ARRAY('Identity proof','Address proof','Date of birth proof','Photograph')
  UNION ALL SELECT 'IDN','PAN-UPD','PAN Correction & Reprint','Correct details on an existing PAN card or request a reprint of a lost or damaged card. Demonstration only.',107,15,JSON_ARRAY('Identity proof','Address proof')
  UNION ALL SELECT 'IDN','VOTER-ID','Voter ID Card (EPIC) Registration','Register as a new voter or move your enrolment to a new constituency. Field verification of your address is simulated in this prototype.',0,30,JSON_ARRAY('Identity proof','Address proof','Date of birth proof','Photograph')
  UNION ALL SELECT 'IDN','PASSPORT','Passport Application Assistance','Prepare a fresh or re-issue passport application with document checks. Appointment and police verification steps are simulated; no passport is issued.',1500,30,JSON_ARRAY('Identity proof','Address proof','Date of birth proof','Photograph')
  UNION ALL SELECT 'IDN','RATION-CARD','Ration Card','Apply for a household ration card for subsidised food grains, or add family members to an existing card.',0,30,JSON_ARRAY('Identity proof','Address proof','Income proof','Photograph')
  UNION ALL SELECT 'REV','DEATH-CERT','Death Certificate','Register a death and obtain a death certificate for legal, pension and insurance purposes.',50,7,JSON_ARRAY('Identity proof','Medical certificate','Address proof')
  UNION ALL SELECT 'REV','MARRIAGE-CERT','Marriage Registration Certificate','Register a marriage and receive a certificate accepted for name changes, visas and joint accounts.',100,14,JSON_ARRAY('Identity proof','Address proof','Photograph','Relationship proof')
  UNION ALL SELECT 'REV','ENCUMBRANCE','Encumbrance Certificate','Check a property for registered sales, mortgages or other legal liabilities over a chosen period.',200,7,JSON_ARRAY('Identity proof','Property document')
  UNION ALL SELECT 'REV','LEGAL-HEIR','Legal Heir Certificate','Establish the legal heirs of a deceased person to claim pension, property or bank balances.',100,21,JSON_ARRAY('Identity proof','Death certificate','Relationship proof')
  UNION ALL SELECT 'REV','EWS-CERT','EWS Certificate','Certify Economically Weaker Section status for reservation in education and employment.',0,14,JSON_ARRAY('Identity proof','Income proof','Address proof')
  UNION ALL SELECT 'MUN','MUTATION','Property Mutation (Name Transfer)','Update municipal property records after a sale, gift or inheritance so tax notices reach the new owner.',300,30,JSON_ARRAY('Identity proof','Property document')
  UNION ALL SELECT 'TRN','LEARNER-LL','Learner''s Licence','Apply for a learner''s licence before your driving test. The online test slot is simulated.',200,7,JSON_ARRAY('Identity proof','Address proof','Date of birth proof','Photograph')
  UNION ALL SELECT 'TRN','DL-RENEW','Driving Licence Renewal','Renew a driving licence that is expiring or has expired within the grace period.',400,14,JSON_ARRAY('Identity proof','Medical certificate','Photograph')
  UNION ALL SELECT 'TRN','VEHICLE-TRANSFER','Vehicle Ownership Transfer','Transfer a registered vehicle to a new owner after a sale or inheritance.',300,21,JSON_ARRAY('Identity proof','Address proof','Vehicle documents')
  UNION ALL SELECT 'HLT','OLD-AGE-PENSION','Old Age Pension','Apply for a monthly social security pension for senior citizens from eligible households.',0,30,JSON_ARRAY('Identity proof','Date of birth proof','Income proof','Bank details')
  UNION ALL SELECT 'HLT','WIDOW-PENSION','Widow Pension','Apply for a monthly pension supporting widows from eligible households.',0,30,JSON_ARRAY('Identity proof','Death certificate','Income proof','Bank details')
  UNION ALL SELECT 'EDU','DUP-MARKSHEET','Duplicate Marksheet','Request a duplicate copy of a lost or damaged board marksheet or certificate.',200,21,JSON_ARRAY('Identity proof','Educational certificate')
  UNION ALL SELECT 'EDU','MIGRATION-CERT','Migration Certificate','Obtain a migration certificate to continue your studies at another board or university.',300,14,JSON_ARRAY('Identity proof','Educational certificate')
  UNION ALL SELECT 'WTR','ELECTRICITY','New Electricity Connection','Apply for a new domestic or commercial electricity connection, including load sanction.',500,14,JSON_ARRAY('Identity proof','Address proof','Property document')
  UNION ALL SELECT 'WTR','LPG-CONNECTION','LPG Gas Connection','Apply for a new domestic LPG cooking gas connection, with support for eligible low-income households.',0,15,JSON_ARRAY('Identity proof','Address proof','Income proof')
  UNION ALL SELECT 'BUS','UDYAM','MSME (Udyam) Registration','Register a micro, small or medium enterprise to access credit schemes and procurement benefits.',0,7,JSON_ARRAY('Identity proof','Business registration','Bank details')
  UNION ALL SELECT 'BUS','GST-REG','GST Registration Assistance','Prepare and track a Goods and Services Tax registration for a new or growing business.',0,7,JSON_ARRAY('Identity proof','Address proof','Business registration','Bank details')
  UNION ALL SELECT 'BUS','FSSAI','Food Business (FSSAI) Registration','Register a small food business, stall or home kitchen for food safety compliance.',100,7,JSON_ARRAY('Identity proof','Photograph','Business registration')
) v
JOIN departments d ON d.code=v.dept
WHERE NOT EXISTS (SELECT 1 FROM services s WHERE s.code=v.code);
