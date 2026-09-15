# Grist "Last Seen" Activity Tracker Widget

A lightweight Custom Widget for Grist that automatically records when a user views a document page by updating a `Last_Seen` DateTime column in your user directory table.

---

## How It Works

Client-side JavaScript inside Grist Custom Widgets cannot access the logged-in user's identity directly.
To safely detect who is viewing the page, this widget uses a **server-side ping pattern**:

1. **Creates a ping record:** Inserts a temporary row into a helper table (`UserPing`).
2. **Triggers backend evaluation:** Grist’s backend evaluates a trigger formula (`$user.Email`) on the new row.
3. **Reads the user email:** The widget fetches the generated email using `grist.docApi.fetchTable`.
4. **Cleans up:** Immediately deletes the temporary row from `UserPing`.
5. **Updates timestamp:** Matches the email against your target User table and updates that row’s `Last Seen` timestamp with the current epoch timestamp.

---

## Setup Guide

### 1. Create the `UserPing` Helper Table

1. In your Grist document, create a new table named **`UserPing`**.
2. Add a column named **`User_Email`**.
3. Open the right panel for **`User_Email`** and configure its settings:
* **Formula / Trigger:** Set to `user.Email` (no `$` prefix — `$user` fails with `AttributeError` on recent Grist)
* **Apply on:** Select **New Records**



---

### 2. Prepare Your Target Users Table

Ensure your primary User table contains:

* A **Text** column for the user's email address (e.g., `Email`).
* A **DateTime** column to record the last view time (e.g., `Last_Seen`).

---

### 3. Add and Configure the Custom Widget

1. On any page where you want to track views, click **Add New -> Add Widget to Page**.
2. Select **Custom** as the widget type and set its data source to your **Users** table.
3. Open the **Widget** configuration panel in the right sidebar:
* **Access Level:** Change to **Full Document Access** *(Required to execute create, delete, and table fetch operations)*.
* **Custom URL:** Enter the hosted URL containing the widget HTML code.


4. Under **Column Mapping**, map the fields:
* **User Email Field:** Map to your user email column.
* **Last Seen Field:** Map to your `Last_Seen` DateTime column.



---

## Troubleshooting

| Issue | Cause | Solution |
| --- | --- | --- |
| **`Access level 'full' required`** | The widget permission is set to Read-only or None. | In the right sidebar under **Widget -> Access Level**, select **Full Document Access**. |
| **`Could not resolve user email`** | The helper table name or column name is incorrect, or the formula uses `$user`. | Ensure the helper table is named exactly `UserPing` and contains a column named `User_Email` with the trigger formula `user.Email`. |
| **`No row found...`** | The logged-in user's email does not exist in the main User table. | Verify that the user's email address in Grist matches an entry in your user table. |
