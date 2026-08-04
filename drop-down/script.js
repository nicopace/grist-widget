function showError(msg) {
  let el = document.getElementById('error');
  if (!msg) {
    el.style.display = 'none';
  } else {
    console.error(`[Dropdown Debug] Error: ${msg}`);
    el.innerHTML = msg;
    el.style.display = 'block';
  }
}

function updateDropdown(options) {
  console.log(`[Dropdown Debug] Actualizando opciones del select UI (${options.length} opciones):`, options);
  const dropdown = document.getElementById('dropdown');
  dropdown.innerHTML = '';
  if (options.length === 0) {
    const optionElement = document.createElement('option');
    optionElement.textContent = 'No options available';
    dropdown.appendChild(optionElement);
  } else {
    options.forEach((option, index) => {
      const optionElement = document.createElement('option');
      optionElement.value = String(index);
      optionElement.textContent = String(option);
      dropdown.appendChild(optionElement);
    });    
  }
}

function saveOption() {
  const sid = document.getElementById("sessionid").value;
  console.log(`[Dropdown Debug] Guardando nuevo sessionid en configuración de Grist: "${sid}"`);
  grist.widgetApi.setOption('sessionid', sid);
}

function initGrist() {
  console.log("[Dropdown Debug] Inicializando script e instalando listeners...");
  let allRecords = [];
  let sessionID = "";
  let currentMappings = null;
  let isUnloading = false;
  let latestRecordId = null;
  let restoreTimer = null;

  window.addEventListener('beforeunload', () => { 
    console.log("[Dropdown Debug] Evento beforeunload detectado. Bloqueando eventos futuros.");
    isUnloading = true; 
  });
  window.addEventListener('pagehide', () => { 
    console.log("[Dropdown Debug] Evento pagehide detectado. Bloqueando eventos futuros.");
    isUnloading = true; 
  });

  function getStorageKey() {
    if (sessionID && sessionID.length > 0) {
      return sessionID + "_Dropdown_Item";
    }
    const mappingHash = currentMappings ? JSON.stringify(currentMappings) : "default";
    return `auto_${window.location.pathname}_${mappingHash}_Dropdown_Item`;
  }

  function syncToGristRecord() {
    console.log(`[Dropdown Debug] syncToGristRecord() -> Buscando latestRecordId: ${latestRecordId} en ${allRecords.length} registros cargados.`);
    
    if (latestRecordId === null || allRecords.length === 0) {
      console.log("[Dropdown Debug] syncToGristRecord() omitido: latestRecordId es null o allRecords está vacío.");
      return false;
    }

    const index = allRecords.findIndex(r => r.id === latestRecordId);
    if (index !== -1) {
      console.log(`[Dropdown Debug] ¡Coincidencia de link/Grist encontrada! Indice: ${index} (ID: ${latestRecordId}). Sincronizando UI y sessionStorage.`);
      const dropdown = document.getElementById('dropdown');
      dropdown.value = String(index);

      const storageKey = getStorageKey();
      sessionStorage.setItem(storageKey, index);
      console.log(`[Dropdown Debug] sessionStorage actualizado -> Clave: "${storageKey}", Valor: ${index}`);
      return true;
    }
    
    console.warn(`[Dropdown Debug] latestRecordId ${latestRecordId} no fue encontrado dentro de allRecords.`);
    return false;
  }

  function restoreFromSession() {
    if (isUnloading || allRecords.length === 0 || latestRecordId !== null) {
      console.log(`[Dropdown Debug] restoreFromSession() omitido (isUnloading: ${isUnloading}, allRecords: ${allRecords.length}, latestRecordId: ${latestRecordId}).`);
      return;
    }

    const storageKey = getStorageKey();
    const selection = sessionStorage.getItem(storageKey);
    console.log(`[Dropdown Debug] restoreFromSession() -> Clave: "${storageKey}", Valor hallado en storage:`, selection);

    if (selection !== null && selection !== undefined) {
      const dropdown = document.getElementById('dropdown');
      if (dropdown.options[selection]) {
        console.log(`[Dropdown Debug] Restaurando selección guardada en UI -> Indice: ${selection}`);
        dropdown.value = selection;
        
        const selectedRecord = allRecords[parseInt(selection)];
        if (selectedRecord) {
          if (restoreTimer) {
            console.log("[Dropdown Debug] Cancelando restoreTimer existente previo a programar uno nuevo.");
            clearTimeout(restoreTimer);
          }

          console.log(`[Dropdown Debug] Programando restoreTimer (100ms) para rowId: ${selectedRecord.id}`);
          restoreTimer = setTimeout(() => {
            restoreTimer = null;
            if (!isUnloading && latestRecordId === null) {
              console.log(`[Dropdown Debug] Ejecutando grist.setCursorPos({ rowId: ${selectedRecord.id} }) desde sesión.`);
              grist.setCursorPos({ rowId: selectedRecord.id });
            } else {
              console.log(`[Dropdown Debug] Restablecimiento de cursor cancelado porque latestRecordId cambió a: ${latestRecordId}`);
            }
          }, 100);
        }
      } else {
        console.warn(`[Dropdown Debug] El índice de sesión ${selection} no existe entre las opciones del select actual.`);
      }
    } else {
      console.log("[Dropdown Debug] No hay ningún valor previo en sessionStorage para esta clave.");
    }
  }

  function applySelectionLogic() {
    console.log("[Dropdown Debug] Evaluando reglas de selección (applySelectionLogic)...");
    const synced = syncToGristRecord();
    
    if (!synced) {
      console.log("[Dropdown Debug] No se pudo sincronizar desde link/Grist active record. Recurriendo a sessionStorage.");
      restoreFromSession();
    } else {
      console.log("[Dropdown Debug] Sincronización desde link/Grist exitosa. Se omitió la restauración de sesión previa.");
    }
  }

  console.log("[Dropdown Debug] Llamando a grist.ready()...");
  grist.ready({
    columns: [{ name: "OptionsToSelect", title: 'Options to select', type: 'Any' }],
    requiredAccess: 'read table',
    allowSelectBy: true,
    onEditOptions() {
      console.log("[Dropdown Debug] Evento onEditOptions activado.");
      document.getElementById("container").style.display = 'none';
      document.getElementById("config").style.display = '';
      document.getElementById("sessionid").value = sessionID;
    },
  });

  grist.onOptions((customOptions, _) => {
    if (isUnloading) return;
    console.log("[Dropdown Debug] Evento grist.onOptions recibido:", customOptions);
    customOptions = customOptions || {};
    sessionID = customOptions.sessionid || "";   

    document.getElementById("container").style.display = '';
    document.getElementById("config").style.display = 'none';

    applySelectionLogic();
  });

  grist.onRecords(function (records, mappings) {
    if (isUnloading) return;
    console.log(`[Dropdown Debug] Evento grist.onRecords recibido (${records ? records.length : 0} registros).`);
    
    if (!records || records.length === 0) {
      showError("No records received");
      updateDropdown([]);
      return;
    }
    
    allRecords = records;
    currentMappings = mappings;
    
    const mapped = grist.mapColumnNames(records);
    showError("");
    const options = mapped.map(record => record.OptionsToSelect).filter(option => option !== null && option !== undefined);
    
    if (options.length === 0) {
      showError("No valid options found");
    }
    updateDropdown(options);
    
    applySelectionLogic();
  });

  grist.onRecord(function (record) {
    if (isUnloading) return;
    console.log("[Dropdown Debug] Evento grist.onRecord recibido con payload:", record);

    if (!record || !record.id) {
      console.log("[Dropdown Debug] Recibido record nulo o sin ID en onRecord.");
      return;
    }

    latestRecordId = record.id;
    console.log(`[Dropdown Debug] latestRecordId actualizado a: ${latestRecordId}`);

    if (restoreTimer) {
      console.log("[Dropdown Debug] ¡CANCELANDO restoreTimer pendiente porque onRecord entregó un enlace/registro activo de Grist!");
      clearTimeout(restoreTimer);
      restoreTimer = null;
    }

    if (allRecords.length > 0) {
      console.log("[Dropdown Debug] allRecords ya está cargado. Intentando syncToGristRecord() inmediato.");
      syncToGristRecord();
    } else {
      console.log("[Dropdown Debug] allRecords aún no está cargado. Se pospone la coincidencia hasta que onRecords responda.");
    }
  });

  document.getElementById('dropdown').addEventListener('change', function(event) {    
    if (isUnloading) return;
    
    const selectedIndex = parseInt(event.target.value);
    const selectedRecord = allRecords[selectedIndex];
    console.log(`[Dropdown Debug] Cambio manual por el usuario en la UI -> Indice: ${selectedIndex}`, selectedRecord);
    
    if (selectedRecord) {
      latestRecordId = selectedRecord.id;
      
      if (restoreTimer) {
        console.log("[Dropdown Debug] Cancelando restoreTimer pendiente por cambio manual en la UI.");
        clearTimeout(restoreTimer);
        restoreTimer = null;
      }

      console.log(`[Dropdown Debug] Enviando grist.setCursorPos({ rowId: ${selectedRecord.id} })`);
      grist.setCursorPos({ rowId: selectedRecord.id });
      
      const storageKey = getStorageKey();
      console.log(`[Dropdown Debug] Guardando selección manual en sessionStorage -> Clave: "${storageKey}", Indice: ${selectedIndex}`);
      sessionStorage.setItem(storageKey, selectedIndex);
    }
  });
}

document.addEventListener('DOMContentLoaded', initGrist);
