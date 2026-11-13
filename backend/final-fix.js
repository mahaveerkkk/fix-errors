const fs = require('fs');
const path = require('path');

const b64 = `MIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQDSkd40tdBSVMGnlKV+jqE4nQPIebZw4dkbHRCNgETs1i5WiqHXFs6MjFJV7xda7/4IjDNkUTEPrYETCpZoMkTiMG9l6uho1ugsoW8vEOicY5ATjbpEdRyV5IRD60OB9LmFESgJIxvEHCbjbVxDZWr3UL1qFqVQM52PHStxlKNO6VyKfE8vS2RJRf0FHZEmBJn+foiQG9J/Z3JlgW56eej3KA110ctmErl3YzHGDNWU7PN4QdqxtMlMAdHxCLr+5+y3GbWtT1gUbhzartgMQd3qTCucH86DFGIuFlbpv+I0PLdBbP5UQ+zN9Q4qgn8GrN5sbWeiyMf3tAfHlKGWpbbNAgMBAAECgf9W6d54jehuveKGSSoGEtkjhQEKvoePZak3MnKin/nTHT9YeTWpPMCvQpFkPEu85/zy35ZW0dcY9tn6rLloSKzQr9f15AAJ8KqPFr3Nr4JTtW9tTWfqLxdIHLUl/krfA87kyIVolWqLMmjay/OeiJNI1wqtFKvSGXvvQRsCxqyhj5vhE2nxMt1ryjnVQlFMy7ZOFhGlfQL7RDsqj8w3jHpiAhoahwdRZShgNIl9YIxKvIZumjETNwCpAqvNsSmrDFR/HVzgTQChtgg88C1I4SxkHqlK6kvk4yjxYh9UG8xQsecVfYHrYf5IqE8DfE5DWf60zIG/yajqm1DD88OENeECgYEA721hwfs7sYXnJT+AG/QqbpyVghWjztnuW2Ge860iZQKD5fejr6EX0KbhTLXjteSQqAjjZ4xYr5z7PVWB8E/ZmhnuBoChWpGbn91imZ910XtIlDIWitBZvwAhaDJrECWkMrK06bq90nFBr65ssV392kKiEgXUkSY5OS86gk9hweUCgYEA4SUiuZN8YU/qmbHdstS0/eoSHO43bepAC3feh3Orbx/hKaUIo9Df6i1Oa9vgWdQDGPUd8rdaTA5JnSJRkuV1sjPqnJ9cuDk4P7zDkRCY3o3MjLllg/VP6Dv8Ct8me22AkgOsJi5h+UB5Z1t5KyN1DbbPqeNOepA6cnAh7OGS8skCgYBlF0L6W3Bl0Qq6cGhP5TTxRQ3fQfHLCbsZPEuXyVdHXNuCAqBLLHJYt81SzU2a5CmruS0C8IAVjeuKhwr5A032QdJ9TlxSWD5kLl5OTMS7MRmA8PERpUzvV0fDrd4EkFAW09uNADrbmtRIMBZWgUAIoq+5elq4+nGY0ncaxBebfQKBgQCOwfBBwT3Fqlmz+K79XJgixE+V3opw/G59lxUXyAU04f7wW/+dd6zzHKU0COg5rRAFvC6wHwh3XzvYEdGtlidJxleF1hqBiW6cI4HRsrdrrne75zZyNJLlS1umPRZ2ftlePEvkrdZbqEESg1LSQppPBtKoA0RYvKkCtQ0d2W5G2QKBgQCrIVmhoI8npeA1NA+sQdEXrmLqQ93aSttmbzAV2btuNmHhUgJg6cZn/1vlHpSJxCEmirq+QvTGlRcUDhATOmSOZe22K9+eJW4zKYHrh1w9Ty8Asw53bEr8TA7U5P4j7xZRWk137HlJm/rOb2/qfWvvyHtaAzb+De2+OZwOwRwPmQ==`;

const pem = `-----BEGIN PRIVATE KEY-----\n${b64}\n-----END PRIVATE KEY-----\n`;

const fullKey = {
  "type": "service_account",
  "project_id": "salon-bf846",
  "private_key_id": "d7597ef6c7ccff6e0540f92da15ab6cac1246196",
  "private_key": pem,
  "client_email": "firebase-adminsdk-fbsvc@salon-bf846.iam.gserviceaccount.com",
  "client_id": "107658369970634746504",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40salon-bf846.iam.gserviceaccount.com",
  "universe_domain": "googleapis.com"
};

fs.writeFileSync(path.join(__dirname, 'config', 'serviceAccountKey.json'), JSON.stringify(fullKey, null, 2));

// Update .env
const dotEnvPath = path.join(__dirname, '.env');
let dotEnvContent = fs.readFileSync(dotEnvPath, 'utf8');
const escapedPem = pem.replace(/\n/g, '\\n');
dotEnvContent = dotEnvContent.replace(/FIREBASE_PROJECT_ID=.*/, `FIREBASE_PROJECT_ID=salon-bf846`);
dotEnvContent = dotEnvContent.replace(/FIREBASE_CLIENT_EMAIL=.*/, `FIREBASE_CLIENT_EMAIL=firebase-adminsdk-fbsvc@salon-bf846.iam.gserviceaccount.com`);
dotEnvContent = dotEnvContent.replace(/FIREBASE_PRIVATE_KEY=.*/, `FIREBASE_PRIVATE_KEY="${escapedPem}"`);
fs.writeFileSync(dotEnvPath, dotEnvContent);

console.log('ALL_FILES_UPDATED_SUCCESSFULLY');
