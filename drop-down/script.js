function showError(msg) {
  let el = document.getElementById('error');
  if (!msg) {
    el.style.display = 'none';
  } else {
    console.error(`[Grist Widget] Error displayed to user: ${msg}`);
    el.innerHTML = msg;
    el.style.display = 'block';
  }
}

function updateDropdown(options) {
  console.log(`[Grist Widget] Updating dropdown with ${options.length} options.`, options);
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
  console.log(`[Grist Widget] Saving sessionid option to Grist settings: "${sid}"`);
  grist.widgetApi.setOption('sessionid', sid);
}

function initGrist() {
  console.log("[Grist Widget] Script initialized. Setting up listeners...");
  let allRecords = [];
  let sessionID = "";

  function restoreSelection() {
    console.log(`[Grist Widget] restoreSelection triggered. Current state -> sessionID: "${sessionID}", totalRecords: ${allRecords.length}`);
    
    if (!sessionID) {
      console.warn("[Grist Widget] restoreSelection skipped: sessionID is not set yet.");
      return;
    }
    if (allRecords.length === 0) {
      console.warn("[Grist Widget] restoreSelection skipped: allRecords array is empty.");
      return;
    }

    const storageKey = sessionID + "_Dropdown_Item";
    const selection = sessionStorage.getItem(storageKey);
    console.log(`[Grist Widget] Checking sessionStorage for key "${storageKey}". Found value:`, selection);

    if (selection !== null && selection !== undefined) {
      const dropdown = document.getElementById('dropdown');
      
      // Check if the stored index actually exists in the current dropdown options
      if (dropdown.options[selection]) {
        console.log(`[Grist Widget] Restoring dropdown selection to index: ${selection} (${dropdown.options[selection].textContent})`);
        dropdown.value = selection;
        dropdown.dispatchEvent(new Event('change'));
      } else {
        console.warn(`[Grist Widget] Cached index ${selection} targets an out-of-bounds or missing option.`);
      }
    } else {
      console.log("[Grist Widget] No previously saved selection found in sessionStorage for this sessionID.");
    }
  }

  console.log("[Grist Widget] Calling grist.ready()...");
  grist.ready({
    columns: [{ name: "OptionsToSelect", title: 'Options to select', type: 'Any' }],
    requiredAccess: 'read table',
    allowSelectBy: true,
    onEditOptions() {
      console.log("[Grist Widget] Grist triggered onEditOptions (Config panel opened)");
      document.getElementById("container").style.display = 'none';
      document.getElementById("config").style.display = '';
      document.getElementById("sessionid").value = sessionID;
    },
  });

  grist.onOptions((customOptions, _) => {
    console.log("[Grist Widget] grist.onOptions event received raw payload:", customOptions);
    customOptions = customOptions || {};
    sessionID = customOptions.sessionid || "";   
    console.log(`[Grist Widget] Parsed sessionID set to: "${sessionID}"`);

    document.getElementById("container").style.display = '';
    document.getElementById("config").style.display = 'none';

    restoreSelection();
  });

  grist.onRecords(function (records, mappings) {
    console.log(`[Grist Widget] grist.onRecords event received. Total raw records: ${records ? records.length : 0}`);
    
    if (!records || records.length === 0) {
      showError("No records received");
      updateDropdown([]);
      return;
    }
    
    allRecords = records;
    
    try {
      const mapped = grist.mapColumnNames(records);
      console.log("[Grist Widget] Successfully mapped records via grist.mapColumnNames. Sample:", mapped[0]);

      showError("");
      const options = mapped.map(record => record.OptionsToSelect).filter(option => option !== null && option !== undefined);
      console.log("[Grist Widget] Extracted non-null 'OptionsToSelect' values:", options);
      
      if (options.length === 0) {
        showError("No valid options found");
      }
      updateDropdown(options);
    } catch (err) {
      console.error("[Grist Widget] Fatal parsing error inside onRecords mapping:", err);
    }

    restoreSelection();
  });

  grist.onRecord(function (record) {
    console.log("[Grist Widget] grist.onRecord event received with payload:", record);
    
    if (!record) {
      console.log("[Grist Widget] Received null/empty record from grist.onRecord (likely page/teardown event). Safely skipping mapping logic.");
      return;
    }

    if (!record.id) {
      console.warn("[Grist Widget] Received a record object, but it contains no 'id property.", record);
      return;
    }

    try {
      const mapped = grist.mapColumnNames(record);
      const dropdown = document.getElementById('dropdown');
      const index = allRecords.findIndex(r => r.id === record.id);
      
      console.log(`[Grist Widget] Match lookup for record ID ${record.id} yielded index: ${index}`);
      if (index !== -1) {
        dropdown.value = String(index);
      }
    } catch (err) {
      console.error("[Grist Widget] Error parsing single record inside onRecord:", err);
    }
  });

  document.getElementById('dropdown').addEventListener('change', function(event) {    
    const selectedIndex = parseInt(event.target.value);
    const selectedRecord = allRecords[selectedIndex];
    console.log(`[Grist Widget] UI Dropdown change event triggered manually. Selected Index: ${selectedIndex}`, selectedRecord);
    
    if (selectedRecord) {
      console.log(`[Grist Widget] Updating Grist cursor position to rowId: ${selectedRecord.id}`);
      grist.setCursorPos({rowId: selectedRecord.id});
      
      if (sessionID.length > 0) {
        const storageKey = sessionID + "_Dropdown_Item";
        console.log(`[Grist Widget] Saving index ${selectedIndex} to sessionStorage key "${storageKey}"`);
        sessionStorage.setItem(storageKey, selectedIndex);
      } else {
        console.warn("[Grist Widget] Cannot cache selection to sessionStorage because sessionID is empty.");
      }
    }
  });
}

document.addEventListener('DOMContentLoaded', initGrist);
