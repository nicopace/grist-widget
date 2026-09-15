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
  let displayRecords = [];
  let sessionID = "";
  let currentMappings = null;
  let isUnloading = false;
  let latestRecordId = null;
  let initialSelectionApplied = false;
  let pendingRestoreId = null;
  let pendingTimer = null;

  window.addEventListener('beforeunload', () => { isUnloading = true; });
  window.addEventListener('pagehide', () => { isUnloading = true; });

  function clearPendingRestore() {
    pendingRestoreId = null;
    if (pendingTimer) {
      clearTimeout(pendingTimer);
      pendingTimer = null;
    }
  }

  function getStorageKey() {
    if (sessionID && sessionID.length > 0) {
      return sessionID + "_Dropdown_Item";
    }
    const mappingHash = currentMappings ? JSON.stringify(currentMappings) : "default";
    return `auto_${window.location.pathname}_${mappingHash}_Dropdown_Item`;
  }

  function getStoredIndex() {
    try {
      const storageKey = getStorageKey();
      const selection = sessionStorage.getItem(storageKey);
      if (selection === null || selection === undefined || selection === "") return -1;
      const index = parseInt(selection, 10);
      if (Number.isNaN(index) || index < 0 || index >= displayRecords.length) return -1;
      return index;
    } catch (e) {
      return -1;
    }
  }

  function setDropdownIndex(index) {
    const dropdown = document.getElementById('dropdown');
    if (dropdown.options[index]) {
      dropdown.value = String(index);
    }
  }

  function syncToGristRecord() {
    if (latestRecordId === null || displayRecords.length === 0) return false;

    const index = displayRecords.findIndex(r => r.id === latestRecordId);
    if (index !== -1) {
      setDropdownIndex(index);

      try {
        const storageKey = getStorageKey();
        sessionStorage.setItem(storageKey, String(index));
      } catch (e) {}
      return true;
    }
    return false;
  }

  function restoreFromSession() {
    if (isUnloading || displayRecords.length === 0) return false;

    const storedIndex = getStoredIndex();
    if (storedIndex === -1) return false;

    const selectedRecord = displayRecords[storedIndex];
    if (!selectedRecord) return false;

    setDropdownIndex(storedIndex);
    latestRecordId = selectedRecord.id;
    pendingRestoreId = selectedRecord.id;
    initialSelectionApplied = true;

    // Safety: don't ignore cursor updates forever if Grist never echoes back.
    if (pendingTimer) clearTimeout(pendingTimer);
    pendingTimer = setTimeout(() => {
      pendingTimer = null;
      pendingRestoreId = null;
    }, 2000);

    try {
      grist.setCursorPos({ rowId: selectedRecord.id });
    } catch (e) {}
    return true;
  }

  function applySelectionLogic() {
    if (isUnloading || displayRecords.length === 0) return;

    // On first load, the stored value wins over the initial Grist cursor.
    // Only fall back to the Grist cursor when there is nothing stored.
    if (!initialSelectionApplied) {
      if (restoreFromSession()) {
        return;
      }
      if (syncToGristRecord()) {
        initialSelectionApplied = true;
      }
      return;
    }

    syncToGristRecord();
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

    applySelectionLogic();
  });

  grist.onRecords(function (records, mappings) {
    if (isUnloading) return;
    
    if (!records || records.length === 0) {
      showError("No records received");
      updateDropdown([]);
      allRecords = [];
      displayRecords = [];
      return;
    }
    
    allRecords = records;
    currentMappings = mappings;
    
    const mapped = grist.mapColumnNames(records);
    showError("");
    // Keep records aligned with dropdown indices (skip null/undefined options).
    displayRecords = [];
    const options = [];
    mapped.forEach((mappedRecord, i) => {
      const option = mappedRecord.OptionsToSelect;
      if (option !== null && option !== undefined) {
        options.push(option);
        displayRecords.push(records[i]);
      }
    });
    
    if (options.length === 0) {
      showError("No valid options found");
    }
    updateDropdown(options);
    
    applySelectionLogic();
  });

  grist.onRecord(function (record) {
    if (isUnloading || !record || !record.id) return;

    // Ignore the stale initial cursor that arrives before/after our restore
    // echoes back. Once Grist confirms our restored cursor, resume following it.
    if (pendingRestoreId !== null) {
      if (record.id === pendingRestoreId) {
        latestRecordId = record.id;
        clearPendingRestore();
        syncToGristRecord();
      }
      return;
    }

    // Before the initial selection is applied, stash the cursor but don't let
    // it clobber a stored value. onRecords will prefer the stored value.
    if (!initialSelectionApplied) {
      latestRecordId = record.id;
      if (displayRecords.length > 0) {
        applySelectionLogic();
      }
      return;
    }

    latestRecordId = record.id;

    if (displayRecords.length > 0) {
      syncToGristRecord();
    }
  });

  document.getElementById('dropdown').addEventListener('change', function(event) {    
    if (isUnloading) return;
    
    const selectedIndex = parseInt(event.target.value, 10);
    const selectedRecord = displayRecords[selectedIndex];
    
    if (selectedRecord) {
      latestRecordId = selectedRecord.id;
      clearPendingRestore();
      initialSelectionApplied = true;

      grist.setCursorPos({ rowId: selectedRecord.id });
      try {
        const storageKey = getStorageKey();
        sessionStorage.setItem(storageKey, String(selectedIndex));
      } catch (e) {}
    }
  });
}

document.addEventListener('DOMContentLoaded', initGrist);
