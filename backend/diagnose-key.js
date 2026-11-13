const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const rawInput = `-----BEGIN PRIVATE KEY-----\nMIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQDSkd40tdBSVMGn\nlKV+jqE4nQPIebZw4dkbHRCNgETs1i5WiqHXFs6MjFJV7xda7/4IjDNkUTEPrYET\nCpZoMkTiMG9l6uho1ugsoW8vEOicY5ATjbpEdRyV5IRD60OB9LmFESgJIxvEHCbj\nbVxDZWr3UL1qFqVQM52PHStxlKNO6VyKfE8vS2RJRf0FHZEmBJn+foiQG9J/Z3Jl\ngW56eej3KA110ctmErl3YzHGDNWU7PN4QdqxtMlMAdHxCLr+5+y3GbWtT1gUbhza\nrtgMQd3qTCucH86DFGIuFlbpv+I0PLdBbP5UQ+zN9Q4qgn8GrN5sbWeiyMf3tAfH\nlKGWpbbNAgMBAAECgf9W6d54jehuveKGSSoGEtkjhQEKvoePZak3MnKin/nTHT9Y\neTWpPMCvQpFkPEu85/zy35ZW0dcY9tn6rLloSKzQr9f15AAJ8KqPFr3Nr4JTtW9t\nTWfqLxdIHLUl/krfA87kyIVolWqLMmjay/OeiJNI1wqtFKvSGXvvQRsCxqyhj5vh\nE2nxMt1ryjnVQlFMy7ZOFhGlfQL7RDsqj8w3jHpiAhoahwdRZShgNIl9YIxKvIZu\nmjETNwCpAqvNsSmrDFR/HVzgTQChtgg88C1I4SxkHqlK6kvk4yjxYh9UG8xQsecV\nfYHrYf5IqE8DfE5DWf60zIG/yajqm1DD88OENeECgYEA721hwfs7sYXnJT+AG/Qq\nbpyVghWjztnuW2Ge860iZQKD5fejr6EX0KbhTLXjteSQqAjjZ4xYr5z7PVWB8E/Z\nmhnuBoChWpGbn91imZ910XtIlDIWitBZvwAhaDJrECWkMrK06bq90nFBr65ssV39\n2kKiEgXUkSY5OS86gk9hweUCgYEA4SUiuZN8YU/qmbHdstS0/eoSHO43bepAC3fe\nh3Orbx/hKaUIo9Df6i1Oa9vgWdQDGPUd8rdaTA5JnSJRkuV1sjPqnJ9cuDk4P7zD\nkRCY3o3MjLllg/VP6Dv8Ct8me22AkgOsJi5h+UB5Z1t5KyN1DbbPqeNOepA6cnAh\n7OGS8skCgYBlF0L6W3Bl0Qq6cGhP5TTxRQ3fQfHLCbsZPEuXyVdHXNuCAqBLLHJY\nt81SzU2a5CmruS0C8IAVjeuKhwr5A032QdJ9TlxSWD5kLl5OTMS7MRmA8PERpUzv\nV0fDrd4EkFAW09uNADrbmtRIMBZWgUAIoq+5elq4+nGY0ncaxBebfQKBgQCOwfBB\nwT3Fqlmz+K79XJgixE+V3opw/G59lxUXyAU04f7wW/+dd6zzHKU0COg5rRAFvC6w\nHwh3XzvYEdGtlidJxleF1hqBiW6cI4HRsrdrrne75zZyNJLlS1umPRZ2ftlePEvk\rdZbqEESg1LSQppPBtKoA0RYvKkCtQ0d2W5G2QKBgQCrIVmhoI8npeA1NA+sQdEX\nrmLqQ93aSttmbzAV2btuNmHhUgJg6cZn/1vlHpSJxCEmirq+QvTGlRcUDhATOmSO\nZe22K9+eJW4zKYHrh1w9Ty8Asw53bEr8TA7U5P4j7xZRWk137HlJm/rOb2/qfWxv\nyHtaAzb+De2+OZwOwRwPmQ==\n-----END PRIVATE KEY-----\n`;

function cleanKey(raw) {
    const body = raw.replace(/-----BEGIN PRIVATE KEY-----/, '')
                    .replace(/-----END PRIVATE KEY-----/, '')
                    .replace(/\\n/g, '')
                    .replace(/\s/g, '');
    return `-----BEGIN PRIVATE KEY-----\n${body}\n-----END PRIVATE KEY-----\n`;
}

const cleanedKey = cleanKey(rawInput);

try {
    crypto.createPrivateKey(cleanedKey);
    console.log('CLEAN_KEY_VALID');
    
    // Write JSON
    const keyData = {
      "type": "service_account",
      "project_id": "salon-bf846",
      "private_key_id": "d7597ef6c7ccff6e0540f92da15ab6cac1246196",
      "private_key": cleanedKey,
      "client_email": "firebase-adminsdk-fbsvc@salon-bf846.iam.gserviceaccount.com",
      "client_id": "107658369970634746504",
      "auth_uri": "https://accounts.google.com/o/oauth2/auth",
      "token_uri": "https://oauth2.googleapis.com/token",
      "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
      "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40salon-bf846.iam.gserviceaccount.com",
      "universe_domain": "googleapis.com"
    };
    
    fs.writeFileSync(path.join(__dirname, 'config', 'serviceAccountKey.json'), JSON.stringify(keyData, null, 2));
    
    // Also update .env with the cleaned one-line escaped version
    const dotEnvPath = path.join(__dirname, '.env');
    let dotEnvContent = fs.readFileSync(dotEnvPath, 'utf8');
    const escapedKey = cleanedKey.replace(/\n/g, '\\n');
    
    dotEnvContent = dotEnvContent.replace(/FIREBASE_PRIVATE_KEY=.*/, `FIREBASE_PRIVATE_KEY="${escapedKey}"`);
    fs.writeFileSync(dotEnvPath, dotEnvContent);
    
    console.log('FILES_SYNCED');
} catch (e) {
    console.error('CLEAN_KEY_INVALID:', e.message);
    // Let's try to remove only the \n and see if it works as a single line
    const singleLine = rawInput.replace(/\\n/g, '').replace(/\n/g, '');
    console.log('Trying single line version...');
}
