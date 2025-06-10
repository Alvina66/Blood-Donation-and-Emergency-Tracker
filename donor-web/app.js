
const tables = [
    'blood_donation_campaigns',
    'blood_inventory',
    'blood_tests',
    'bloodbanks',
    'donations',
    'donor_eligibility',
    'donors',
    'emergency_requests',
    'hospitals',
    'request_fulfillments',
    'staff',
    'users'
];


const API_BASE_URL = 'http://localhost:5001';


const primaryKeyMap = {
    'blood_donation_campaigns': 'campaign_id',
    'blood_inventory': 'inventory_id',
    'blood_tests': 'test_id',
    'bloodbanks': 'bloodbank_id',
    'donations': 'donation_id',
    'donor_eligibility': 'eligibility_id',
    'donors': 'donor_id',
    'emergency_requests': 'request_id',
    'hospitals': 'hospital_id',
    'request_fulfillments': 'fulfillment_id',
    'staff': 'staff_id',
    'users': 'user_id'
};


document.addEventListener('DOMContentLoaded', function () {
    renderTableCards();


    const modal = document.getElementById('dataModal');
    modal.addEventListener('hidden.bs.modal', function () {
        document.getElementById('dataTable').innerHTML = '';
        document.getElementById('modalTitle').textContent = 'Table Data';
        const chartContainer = document.getElementById('chartContainer');
        if (window.myChart) {
            window.myChart.destroy();
        }
        chartContainer.innerHTML = '';
    });
});


function renderTableCards() {
    const container = document.getElementById('tables-container');

    tables.forEach(table => {
        const col = document.createElement('div');
        col.className = 'col-md-4 mb-4';

        const card = document.createElement('div');
        card.className = 'card table-card';
        card.innerHTML = `
            <div class="card-body text-center">
                <h5 class="card-title">${formatTableName(table)}</h5>
                <p class="card-text">Click to view and manage data</p>
            </div>
        `;

        card.addEventListener('click', () => loadTableData(table));

        col.appendChild(card);
        container.appendChild(col);
    });
}

// Format table name for display
function formatTableName(table) {
    return table.split('_').map(word =>
        word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
}


async function loadTableData(tableName) {
    try {
        showLoadingSpinner();
        const response = await fetch(`${API_BASE_URL}/${tableName}`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        const data = await response.json();
        displayTableData(tableName, data);
        renderChart(tableName, data);


        const modal = new bootstrap.Modal(document.getElementById('dataModal'));
        modal.show();
    } catch (error) {
        console.error('Error fetching table data:', error);
        alert(`Error loading table data: ${error.message}`);
    } finally {
        hideLoadingSpinner();
    }
}

function displayTableData(tableName, data) {
    document.getElementById('modalTitle').textContent = formatTableName(tableName);

    if (data.length === 0) {
        document.getElementById('dataTable').innerHTML = '<p class="text-center">No data available</p>';
        return;
    }

    const table = document.getElementById('dataTable');
    table.innerHTML = '';
    table.className = 'table table-striped table-hover';


    const thead = document.createElement('thead');
    thead.className = 'table-dark';
    const headerRow = document.createElement('tr');

    const columns = Object.keys(data[0]);
    columns.forEach(key => {
        const th = document.createElement('th');
        th.textContent = formatHeader(key);
        headerRow.appendChild(th);
    });

    const actionTh = document.createElement('th');
    actionTh.textContent = 'Actions';
    headerRow.appendChild(actionTh);

    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');

    data.forEach(row => {
        const tr = document.createElement('tr');
        tr.dataset.tableName = tableName;

        columns.forEach(column => {
            const td = document.createElement('td');
            td.textContent = row[column] !== null ? row[column] : 'NULL';
            td.dataset.column = column;
            tr.appendChild(td);
        });

        const actionTd = document.createElement('td');
        actionTd.innerHTML = `
            <button class="btn btn-sm btn-warning me-1 edit-btn" title="Edit">
                <i class="fas fa-edit"></i> Edit
            </button>
            <button class="btn btn-sm btn-danger delete-btn" title="Delete">
                <i class="fas fa-trash"></i> Delete
            </button>
        `;
        tr.appendChild(actionTd);

        tbody.appendChild(tr);
    });

    table.appendChild(tbody);

    attachActionListeners(tableName);

    document.getElementById('addNewBtn').onclick = function () {
        addNewRow(tableName, columns);
    };
}

function attachActionListeners(tableName) {
    document.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', function () {
            const row = this.closest('tr');
            editRow(tableName, row);
        });
    });

    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', function () {
            const row = this.closest('tr');
            deleteRow(tableName, row);
        });
    });
}

// Format header names
function formatHeader(header) {
    return header.split('_').map(word =>
        word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
}

function getPrimaryKeyColumn(tableName) {
    return primaryKeyMap[tableName] || `${tableName.slice(0, -1)}_id`;
}

function getPrimaryKeyValue(tableName, row) {
    const primaryKeyColumn = getPrimaryKeyColumn(tableName);
    const cells = row.querySelectorAll('td[data-column]');

    for (let cell of cells) {
        if (cell.dataset.column === primaryKeyColumn) {
            return cell.textContent === 'NULL' ? null : cell.textContent;
        }
    }

    return cells[0]?.textContent;
}

// Edit row function
function editRow(tableName, row) {
    const cells = row.querySelectorAll('td:not(:last-child)');
    const originalValues = Array.from(cells).map(cell => cell.textContent);
    const columns = Array.from(cells).map(cell => cell.dataset.column);

    // Replace cells with input fields
    cells.forEach((cell, index) => {
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'form-control form-control-sm';
        input.value = originalValues[index] === 'NULL' ? '' : originalValues[index];
        input.dataset.column = columns[index];
        cell.innerHTML = '';
        cell.appendChild(input);
    });

    // Replace action buttons with save/cancel
    const actionCell = row.querySelector('td:last-child');
    actionCell.innerHTML = `
        <button class="btn btn-sm btn-success me-1 save-btn">
            <i class="fas fa-save"></i> Save
        </button>
        <button class="btn btn-sm btn-secondary cancel-btn">
            <i class="fas fa-times"></i> Cancel
        </button>
    `;

    // Save button handler
    actionCell.querySelector('.save-btn').addEventListener('click', async function () {
        try {
            showLoadingSpinner();

            // Get the primary key value
            const primaryKeyColumn = getPrimaryKeyColumn(tableName);
            let primaryKeyValue = null;

            // Build updated data object
            const updatedData = {};
            cells.forEach(cell => {
                const input = cell.querySelector('input');
                const column = input.dataset.column;
                const value = input.value.trim() || null;

                updatedData[column] = value;

                if (column === primaryKeyColumn) {
                    primaryKeyValue = value;
                }
            });

            if (!primaryKeyValue) {
                throw new Error('Primary key value not found');
            }

            console.log(`Updating ${tableName} with ID: ${primaryKeyValue}`, updatedData);

            const updateResponse = await fetch(`${API_BASE_URL}/${tableName}/${primaryKeyValue}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(updatedData)
            });

            if (!updateResponse.ok) {
                const error = await updateResponse.json();
                throw new Error(error.Error || 'Update failed');
            }

            // Reload table data
            loadTableData(tableName);
            alert('Record updated successfully!');
        } catch (error) {
            console.error('Error updating row:', error);
            alert(`Error updating record: ${error.message}`);

            // Restore original values on error
            cells.forEach((cell, index) => {
                cell.textContent = originalValues[index];
                cell.dataset.column = columns[index];
            });
            restoreActionButtons(tableName, row);
        } finally {
            hideLoadingSpinner();
        }
    });

    // Cancel button handler
    actionCell.querySelector('.cancel-btn').addEventListener('click', function () {
        cells.forEach((cell, index) => {
            cell.textContent = originalValues[index];
            cell.dataset.column = columns[index];
        });
        restoreActionButtons(tableName, row);
    });
}

// Restore action buttons
function restoreActionButtons(tableName, row) {
    const actionCell = row.querySelector('td:last-child');
    actionCell.innerHTML = `
        <button class="btn btn-sm btn-warning me-1 edit-btn" title="Edit">
            <i class="fas fa-edit"></i> Edit
        </button>
        <button class="btn btn-sm btn-danger delete-btn" title="Delete">
            <i class="fas fa-trash"></i> Delete
        </button>
    `;

    // Reattach event listeners
    actionCell.querySelector('.edit-btn').addEventListener('click', function () {
        editRow(tableName, row);
    });

    actionCell.querySelector('.delete-btn').addEventListener('click', function () {
        deleteRow(tableName, row);
    });
}

// Delete row function
async function deleteRow(tableName, row) {
    if (!confirm('Are you sure you want to delete this record?')) return;

    try {
        showLoadingSpinner();

        const primaryKeyValue = getPrimaryKeyValue(tableName, row);

        if (!primaryKeyValue || primaryKeyValue === 'NULL') {
            throw new Error('Primary key value not found');
        }

        console.log(`Deleting from ${tableName} with ID: ${primaryKeyValue}`);

        const response = await fetch(`${API_BASE_URL}/${tableName}/${primaryKeyValue}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.Error || 'Delete failed');
        }

        // Reload table data
        loadTableData(tableName);
        alert('Record deleted successfully!');
    } catch (error) {
        console.error('Error deleting row:', error);
        alert(`Error deleting record: ${error.message}`);
    } finally {
        hideLoadingSpinner();
    }
}

// Add new row function
function addNewRow(tableName, columns) {
    const table = document.getElementById('dataTable');

    // Create a form for new record
    const form = document.createElement('form');
    form.id = 'addForm';
    form.className = 'mb-3 p-3 border rounded bg-light';

    const formTitle = document.createElement('h5');
    formTitle.textContent = `Add New ${formatTableName(tableName)} Record`;
    formTitle.className = 'mb-3';
    form.appendChild(formTitle);

    const row = document.createElement('div');
    row.className = 'row';

    const primaryKeyColumn = getPrimaryKeyColumn(tableName);

    columns.forEach((column, index) => {
        // Skip primary key columns as they're usually auto-generated
        if (column === primaryKeyColumn && index === 0) return;

        const colDiv = document.createElement('div');
        colDiv.className = 'col-md-6 mb-3';

        const label = document.createElement('label');
        label.className = 'form-label';
        label.textContent = formatHeader(column);

        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'form-control';
        input.name = column;
        input.placeholder = `Enter ${formatHeader(column)}`;

        colDiv.appendChild(label);
        colDiv.appendChild(input);
        row.appendChild(colDiv);
    });

    form.appendChild(row);

    const buttonDiv = document.createElement('div');
    buttonDiv.className = 'mt-3';

    const submitBtn = document.createElement('button');
    submitBtn.type = 'submit';
    submitBtn.className = 'btn btn-primary me-2';
    submitBtn.innerHTML = '<i class="fas fa-plus"></i> Add Record';

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'btn btn-secondary';
    cancelBtn.innerHTML = '<i class="fas fa-times"></i> Cancel';

    buttonDiv.appendChild(submitBtn);
    buttonDiv.appendChild(cancelBtn);
    form.appendChild(buttonDiv);

    // Insert form above the table
    table.parentNode.insertBefore(form, table);
    table.style.display = 'none';

    // Form submit handler
    form.addEventListener('submit', async function (e) {
        e.preventDefault();

        try {
            showLoadingSpinner();

            const formData = new FormData(this);
            const newRecord = {};

            formData.forEach((value, key) => {
                newRecord[key] = value.trim() || null;
            });

            console.log(`Adding new record to ${tableName}:`, newRecord);

            const response = await fetch(`${API_BASE_URL}/${tableName}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(newRecord)
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.Error || 'Add failed');
            }

            // Remove form and show table
            form.remove();
            table.style.display = '';

            // Reload table data
            loadTableData(tableName);
            alert('Record added successfully!');
        } catch (error) {
            console.error('Error adding new row:', error);
            alert(`Error adding new record: ${error.message}`);
        } finally {
            hideLoadingSpinner();
        }
    });

    // Cancel button handler
    cancelBtn.addEventListener('click', function () {
        form.remove();
        table.style.display = '';
    });
}


function renderChart(tableName, data) {
    if (data.length === 0) return;

    const chartContainer = document.getElementById('chartContainer');
    chartContainer.innerHTML = '<canvas id="dataChart"></canvas>';
    const ctx = document.getElementById('dataChart').getContext('2d');

    let chartData = {
        labels: [],
        datasets: []
    };

    // Customize charts based on table type
    if (tableName === 'donations') {
        // Group by date
        const dateGroups = {};
        data.forEach(item => {
            const date = item.donation_date || 'Unknown';
            dateGroups[date] = (dateGroups[date] || 0) + 1;
        });

        chartData.labels = Object.keys(dateGroups);
        chartData.datasets.push({
            label: 'Donations per day',
            data: Object.values(dateGroups),
            backgroundColor: 'rgba(220, 53, 69, 0.5)',
            borderColor: 'rgba(220, 53, 69, 1)',
            borderWidth: 2
        });
    } else if (tableName === 'blood_inventory') {
        // Group by blood type
        const bloodTypeGroups = {};
        data.forEach(item => {
            const bloodType = item.blood_type || 'Unknown';
            bloodTypeGroups[bloodType] = (bloodTypeGroups[bloodType] || 0) + (item.quantity || 0);
        });

        chartData.labels = Object.keys(bloodTypeGroups);
        chartData.datasets.push({
            label: 'Blood Inventory by Type',
            data: Object.values(bloodTypeGroups),
            backgroundColor: [
                'rgba(255, 99, 132, 0.5)',
                'rgba(54, 162, 235, 0.5)',
                'rgba(255, 206, 86, 0.5)',
                'rgba(75, 192, 192, 0.5)',
                'rgba(153, 102, 255, 0.5)',
                'rgba(255, 159, 64, 0.5)'
            ],
            borderColor: [
                'rgba(255, 99, 132, 1)',
                'rgba(54, 162, 235, 1)',
                'rgba(255, 206, 86, 1)',
                'rgba(75, 192, 192, 1)',
                'rgba(153, 102, 255, 1)',
                'rgba(255, 159, 64, 1)'
            ],
            borderWidth: 2
        });
    } else {
        // Generic chart - show count by first text column
        const firstTextColumn = Object.keys(data[0]).find(key =>
            typeof data[0][key] === 'string' && key !== 'id'
        );

        if (firstTextColumn) {
            const groups = {};
            data.forEach(item => {
                const value = item[firstTextColumn] || 'Unknown';
                groups[value] = (groups[value] || 0) + 1;
            });

            chartData.labels = Object.keys(groups);
            chartData.datasets.push({
                label: `Count by ${formatHeader(firstTextColumn)}`,
                data: Object.values(groups),
                backgroundColor: 'rgba(13, 110, 253, 0.5)',
                borderColor: 'rgba(13, 110, 253, 1)',
                borderWidth: 2
            });
        }
    }

    if (window.myChart) {
        window.myChart.destroy();
    }

    if (chartData.labels.length > 0) {
        window.myChart = new Chart(ctx, {
            type: 'bar',
            data: chartData,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: `${formatTableName(tableName)} Overview`
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    }
}

// Loading spinner functions
function showLoadingSpinner() {
    document.body.style.cursor = 'wait';
}

function hideLoadingSpinner() {
    document.body.style.cursor = 'default';
}