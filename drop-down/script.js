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
  let hasGristRecord = false; // Flag to check if Grist supplied a record (e.g. via link)

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
    // If unloading, empty, or Grist already set a record from a link, do not restore
    if (isUnloading || hasGristRecord || allRecords.length === 0) return;

    const storageKey = getStorageKey();
    const selection = sessionStorage.getItem(storageKey);

    if (selection !== null && selection !== undefined) {
      const dropdown = document.getElementById('dropdown');
      if (dropdown.options[selection]) {
        dropdown.value = selection; // Update UI only; DO NOT call setCursorPos here
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

    setTimeout(restoreSelection, 50);
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
    
    // Defer session restore to give onRecord time to handle link selections first
    setTimeout(restoreSelection, 50);
  });

  grist.onRecord(function (record) {
    if (isUnloading || !record || !record.id) return;

    const index = allRecords.findIndex(r => r.id === record.id);
    if (index !== -1) {
      hasGristRecord = true; // Mark that link/Grist active cursor was received
      
      const dropdown = document.getElementById('dropdown');
      dropdown.value = String(index);

      // Link selection takes precedence AND updates session storage for subsequent pages
      const storageKey = getStorageKey();
      sessionStorage.setItem(storageKey, index);
    }
  });

  // Only trigger Grist cursor movement when the user manually changes the select dropdown
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
