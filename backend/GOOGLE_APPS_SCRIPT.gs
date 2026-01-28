
/**
 * AURA PHARMA BACKEND - GOOGLE APPS SCRIPT
 * 
 * v2.6 - Enhanced Login Feedback
 */

// ----------------------------------------------------------------------------
// CONFIGURATION
// ----------------------------------------------------------------------------
const SPREADSHEET_ID = ""; 

// ----------------------------------------------------------------------------
// MAIN ENTRY POINT (API)
// ----------------------------------------------------------------------------
function doPost(e) {
  return handleRequest(e);
}

function doGet(e) {
  return ContentService.createTextOutput("Aura Backend is Online.");
}

function handleRequest(e) {
  const lock = LockService.getScriptLock();
  lock.tryLock(10000);

  try {
    const ss = SPREADSHEET_ID ? SpreadsheetApp.openById(SPREADSHEET_ID) : SpreadsheetApp.getActiveSpreadsheet();
    
    if (!e || !e.postData || !e.postData.contents) {
        throw new Error("No payload provided");
    }
    
    const params = JSON.parse(e.postData.contents);
    let result = { success: false, message: 'Invalid Action' };

    switch(params.action) {
      case 'login':
        result = handleLogin(ss, params.username, params.password);
        break;
      case 'refreshUser': 
        result = handleRefreshUser(ss, params.username);
        break;
      case 'getUsers':
         result = handleGetUsers(ss);
         break;
      case 'updateProfile':
         result = handleUpdateProfile(ss, params.personnelId, params.data);
         break;
      case 'getSystemConfig':
         result = handleGetSystemConfig(ss);
         break;
      case 'updateSystemConfig':
         result = handleUpdateSystemConfig(ss, params.config);
         break;
      case 'adminSaveUser':
         result = handleAdminSaveUser(ss, params.userData);
         break;
      case 'toggleUserStatus':
         result = handleToggleUserStatus(ss, params.username, params.status);
         break;
      case 'getFacilities':
         result = handleGetFacilities(ss);
         break;
      default:
         result = { success: false, message: "Unknown action: " + params.action };
    }

    return responseJSON(result);

  } catch (error) {
    return responseJSON({ success: false, message: error.toString() });
  } finally {
    lock.releaseLock();
  }
}

function responseJSON(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ----------------------------------------------------------------------------
// BUSINESS LOGIC
// ----------------------------------------------------------------------------

function handleLogin(ss, username, password) {
  const sheet = ss.getSheetByName('USERS');
  if (!sheet) return { success: false, message: "Error DB: Tabla USERS no encontrada." };
  
  const data = sheet.getDataRange().getValues(); 
  
  for (let i = 1; i < data.length; i++) {
    // Check username (case insensitive)
    if (String(data[i][0]).toLowerCase() === String(username).toLowerCase()) {
        // Check password (case sensitive)
        if (String(data[i][1]) === String(password)) {
             return buildUserResponse(ss, data[i]);
        } else {
             // User found, but wrong password
             return { success: false, message: 'Usuario o contraseña incorrectos.' };
        }
    }
  }
  // User not found
  return { success: false, message: 'Usuario o contraseña incorrectos.' };
}

function handleRefreshUser(ss, username) {
  const sheet = ss.getSheetByName('USERS');
  if (!sheet) return { success: false, message: "DB Error" };
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).toLowerCase() === String(username).toLowerCase()) {
        return buildUserResponse(ss, data[i]);
    }
  }
  return { success: false, message: 'Usuario no encontrado o eliminado' };
}

function buildUserResponse(ss, userRow) {
    // Check if Account is Active (Column Index 4)
    if (userRow[4] !== true && String(userRow[4]).toLowerCase() !== 'true') {
            return { success: false, message: 'Su cuenta ha sido desactivada. Contacte al administrador.' };
    }
    
    const personnelId = userRow[3];
    const personnelData = getPersonnelData(ss, personnelId);
    if (!personnelData) return { success: false, message: 'Error de integridad: Personal no encontrado' };
    const facilityData = getFacilityData(ss, personnelData.facilityCode);
    const rolePermissions = getRolePermissions(ss, userRow[2]);
    return {
        success: true,
        user: {
        username: userRow[0],
        role: userRow[2],
        personnelId: personnelId,
        isActive: true,
        personnelData: personnelData,
        facilityData: facilityData,
        permissions: rolePermissions
        }
    };
}

function handleGetUsers(ss) {
    const uSheet = ss.getSheetByName('USERS');
    const uData = uSheet.getDataRange().getValues();
    const users = [];
    for(let i=1; i<uData.length; i++){
        const pId = uData[i][3];
        const pData = getPersonnelData(ss, pId);
        users.push({
            username: uData[i][0],
            role: uData[i][2],
            isActive: uData[i][4],
            personnelId: pId,
            personnel: pData
        });
    }
    return { success: true, data: users };
}

function handleUpdateProfile(ss, personnelId, newData) {
    const pSheet = ss.getSheetByName('PERSONNEL');
    const uSheet = ss.getSheetByName('USERS');
    if (!pSheet || !uSheet) return { success: false, message: "Error DB" };

    const pData = pSheet.getDataRange().getValues();
    const uData = uSheet.getDataRange().getValues();
    let personnelUpdated = false;

    for(let i=1; i<pData.length; i++) {
        if(String(pData[i][0]) === String(personnelId)) {
            const row = i + 1;
            if (newData.firstName !== undefined) pSheet.getRange(row, 2).setValue(newData.firstName);
            if (newData.lastName !== undefined) pSheet.getRange(row, 3).setValue(newData.lastName);
            if (newData.dni !== undefined) pSheet.getRange(row, 4).setValue(newData.dni);
            if (newData.phone !== undefined) pSheet.getRange(row, 5).setValue(newData.phone);
            if (newData.email !== undefined) pSheet.getRange(row, 6).setValue(newData.email);
            if (newData.birthDate !== undefined) pSheet.getRange(row, 7).setValue(newData.birthDate);
            personnelUpdated = true;
            break;
        }
    }
    for(let i=1; i<uData.length; i++) {
        if(String(uData[i][3]) === String(personnelId)) {
            const row = i + 1;
            if (newData.username && String(newData.username).toLowerCase() !== String(uData[i][0]).toLowerCase()) {
                 const isTaken = uData.some((r, idx) => idx !== i && String(r[0]).toLowerCase() === String(newData.username).toLowerCase());
                 if (isTaken) return { success: false, message: "El nombre de usuario ya está en uso." };
                 uSheet.getRange(row, 1).setValue(newData.username);
            }
            if (newData.password) uSheet.getRange(row, 2).setValue(newData.password);
            break;
        }
    }
    return personnelUpdated ? { success: true } : { success: false, message: "Personal no encontrado" };
}

function handleAdminSaveUser(ss, userData) {
    const uSheet = ss.getSheetByName('USERS');
    const pSheet = ss.getSheetByName('PERSONNEL');
    
    if (userData.isNew) {
        const users = uSheet.getDataRange().getValues();
        const exists = users.some(u => String(u[0]).toLowerCase() === String(userData.username).toLowerCase());
        if (exists) return { success: false, message: "El nombre de usuario ya existe." };
        
        const newId = 'P' + new Date().getTime();
        
        pSheet.appendRow([
            newId, 
            userData.firstName, 
            userData.lastName, 
            userData.dni, 
            userData.phone || '', 
            userData.email || '', 
            userData.birthDate || '', 
            userData.facilityCode || '00001'
        ]);
        
        uSheet.appendRow([
            userData.username,
            userData.password,
            userData.role,
            newId,
            true
        ]);
        
    } else {
        const pData = pSheet.getDataRange().getValues();
        const uData = uSheet.getDataRange().getValues();
        
        for(let i=1; i<pData.length; i++) {
            if(String(pData[i][0]) === String(userData.personnelId)) {
                const row = i + 1;
                pSheet.getRange(row, 2).setValue(userData.firstName);
                pSheet.getRange(row, 3).setValue(userData.lastName);
                pSheet.getRange(row, 4).setValue(userData.dni);
                pSheet.getRange(row, 6).setValue(userData.email);
                pSheet.getRange(row, 8).setValue(userData.facilityCode);
                break;
            }
        }
        
        for(let i=1; i<uData.length; i++) {
            if(String(uData[i][3]) === String(userData.personnelId)) {
                const row = i + 1;
                uSheet.getRange(row, 3).setValue(userData.role);
                if (userData.password) {
                    uSheet.getRange(row, 2).setValue(userData.password);
                }
                break;
            }
        }
    }
    
    return { success: true };
}

function handleToggleUserStatus(ss, username, status) {
    const uSheet = ss.getSheetByName('USERS');
    const uData = uSheet.getDataRange().getValues();
    
    for(let i=1; i<uData.length; i++) {
        if(String(uData[i][0]) === String(username)) {
            const row = i + 1;
            uSheet.getRange(row, 5).setValue(status); // Column 5 is Active
            return { success: true };
        }
    }
    return { success: false, message: "Usuario no encontrado" };
}

function handleGetFacilities(ss) {
    const sheet = ss.getSheetByName('FACILITIES');
    if (!sheet) return { success: true, data: [] };
    const data = sheet.getDataRange().getValues();
    const list = [];
    for(let i=1; i<data.length; i++) {
        list.push({
            code: data[i][0],
            name: data[i][1],
            category: data[i][2]
        });
    }
    return { success: true, data: list };
}

function handleGetSystemConfig(ss) {
    const sheet = ss.getSheetByName('CONFIG');
    if (!sheet) return { success: true, data: { verificationDelaySeconds: 5 } };
    const data = sheet.getDataRange().getValues();
    const config = {};
    for(let i=1; i<data.length; i++) {
        config[data[i][0]] = data[i][1];
    }
    return { success: true, data: config };
}

function handleUpdateSystemConfig(ss, newConfig) {
    let sheet = ss.getSheetByName('CONFIG');
    if (!sheet) {
        createTableIfNotExists(ss, 'CONFIG', ['Key', 'Value'], []);
        sheet = ss.getSheetByName('CONFIG');
    }
    const data = sheet.getDataRange().getValues();
    const keys = Object.keys(newConfig);
    keys.forEach(key => {
        let found = false;
        for(let i=1; i<data.length; i++) {
            if(String(data[i][0]) === key) {
                sheet.getRange(i+1, 2).setValue(newConfig[key]);
                found = true;
                break;
            }
        }
        if (!found) sheet.appendRow([key, newConfig[key]]);
    });
    return { success: true, message: "Configuración guardada en nube." };
}

function getPersonnelData(ss, id) {
   const sheet = ss.getSheetByName('PERSONNEL');
   if (!sheet) return null;
   const data = sheet.getDataRange().getValues();
   for(let i=1; i<data.length; i++) {
     if(String(data[i][0]) === String(id)) {
       return {
         id: data[i][0],
         firstName: data[i][1],
         lastName: data[i][2],
         dni: data[i][3],
         phone: data[i][4],
         email: data[i][5],
         birthDate: data[i][6] instanceof Date ? data[i][6].toISOString().split('T')[0] : data[i][6],
         facilityCode: data[i][7]
       };
     }
   }
   return null;
}

function getFacilityData(ss, code) {
   const sheet = ss.getSheetByName('FACILITIES');
   if (!sheet) return null;
   const data = sheet.getDataRange().getValues();
   for(let i=1; i<data.length; i++) {
     if(String(data[i][0]) === String(code)) return { code: data[i][0], name: data[i][1], category: data[i][2] };
   }
   return { code: '000', name: 'Desconocido', category: '-' };
}

function getRolePermissions(ss, role) {
   const sheet = ss.getSheetByName('ROLES');
   if (!sheet) return [];
   const data = sheet.getDataRange().getValues();
   for(let i=1; i<data.length; i++) {
       if (String(data[i][0]) === String(role)) {
           const perms = data[i][2]; 
           return perms ? perms.split(',') : [];
       }
   }
   return [];
}

function setupDatabase() {
  const ss = SPREADSHEET_ID ? SpreadsheetApp.openById(SPREADSHEET_ID) : SpreadsheetApp.getActiveSpreadsheet();
  createTableIfNotExists(ss, 'FACILITIES', ['Code', 'Name', 'Category'], [['00001', 'DIRESA SEDE CENTRAL', 'ADM']]);
  createTableIfNotExists(ss, 'PERSONNEL', ['ID', 'FirstName', 'LastName', 'DNI', 'Phone', 'Email', 'BirthDate', 'FacilityCode'], [['P001', 'Admin', 'User', '0000', '000', 'admin@aura.pe', '1990-01-01', '00001']]);
  createTableIfNotExists(ss, 'ROLES', ['Role', 'Label', 'Modules'], [['ADMIN', 'Admin', 'DASHBOARD,ANALYSIS,ADMIN_USERS,ADMIN_ROLES,PROFILE']]);
  createTableIfNotExists(ss, 'USERS', ['Username', 'Password', 'Role', 'PersonnelID', 'Active'], [['admin', 'admin123', 'ADMIN', 'P001', true]]);
  createTableIfNotExists(ss, 'CONFIG', ['Key', 'Value'], [['verificationDelaySeconds', 5], ['apiUrl', '']]);
  Logger.log("Base de datos actualizada.");
}

function createTableIfNotExists(ss, sheetName, headers, defaultData) {
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#E6F4EA");
    if (defaultData && defaultData.length > 0) defaultData.forEach(row => sheet.appendRow(row));
  }
}
