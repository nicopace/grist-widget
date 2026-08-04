function showError(msg) {
  let el = document.getElementById('error');
  if (!msg) {
    el.style.display = 'none';
  } else {
    el.innerHTML = msg;
    el.style.display = 'block';
  }
}

function updateDropdown(options) {
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
  grist.widgetApi.setOption('sessionid', sid);
}

function initGrist() {
  let allRecords = [];
  let sessionID = "";
  let currentMappings = null;
  let isUnloading = false;
  let hasRecordFromGrist = false; // Tracks if a link/external Grist selection occurred

  window.addEventListener('beforeunload', () => { isUnloading = true; });
  window.addEventListener('pagehide', () => { isUnloading = true; });

  function getStorageKey() {
    if (sessionID && sessionID.length > 0) {
      return sessionID + "_Dropdown_Item";
    }
    const mappingHash = currentMappings ? JSON.stringify(currentMappings) : "default";
    return `auto_${window.location.pathname}_${mappingHash}_Dropdown_Item`;
  }

  function restoreSelection() {
    if (isUnloading || allRecords.length === 0) return;

    // If Grist already supplied a record via link/onRecord, do not overwrite it with old session state
    if (hasRecordFromGrist) return;

    const storageKey = getStorageKey();
    const selection = sessionStorage.getItem(storageKey);

    if (selection !== null && selection !== undefined) {
      const dropdown = document.getElementById('dropdown');
      if (dropdown.options[selection]) {
        dropdown.value = selection;
        const selectedRecord = allRecords[parseInt(selection)];
        if (selectedRecord) {
          grist.setCursorPos({ rowId: selectedRecord.id });
        }
      }
    }
  }

  grist.ready({
    columns: [{ name: "OptionsToSelect", title: 'Options to select', type: 'Any' }],
    requiredAccess: 'read table',
    allowSelectBy: true,
    onEditOptions() {
      document.getElementById("container").style.display = 'none';
      document.getElementById("config").style.display = '';
      document.getElementById("sessionid").value = sessionID;
    },
  });

  grist.onOptions((customOptions, _) => {
    if (isUnloading) return;
    customOptions = customOptions || {};
    sessionID = customOptions.sessionid || "";   

    document.getElementById("container").style.display = '';
    document.getElementById("config").style.display = 'none';

    restoreSelection();
  });

  grist.onRecords(function (records, mappings) {
    if (isUnloading) return;
    
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
    restoreSelection();
  });

  grist.onRecord(function (record) {
    if (isUnloading || !record || !record.id) return;

    const index = allRecords.findIndex(r => r.id === record.id);
    if (index !== -1) {
      hasRecordFromGrist = true; // Mark that link/Grist selection took precedence
      
      const dropdown = document.getElementById('dropdown');
      dropdown.value = String(index);

      // Link selection overwrites and updates the session storage
      const storageKey = getStorageKey();
      sessionStorage.setItem(storageKey, index);
    }
  });

  document.getElementById('dropdown').addEventListener('change', function(event) {    
    if (isUnloading) return;
    
    const selectedIndex = parseInt(event.target.value);
    const selectedRecord = allRecords[selectedIndex];
    
    if (selectedRecord) {
      grist.setCursorPos({ rowId: selectedRecord.id });
      const storageKey = getStorageKey();
      sessionStorage.setItem(storageKey, selectedIndex);
    }
  });
}

document.addEventListener('DOMContentLoaded', initGrist);
