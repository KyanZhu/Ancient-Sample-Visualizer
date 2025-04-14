// Global variables
let map;
let markers = [];
let currentData = [];
let filteredData = [];
let loadedFiles = [];
let currentFileIndex = -1;
let minAge = 0;
let maxAge = 100000;
let isDarkTheme = false;
let currentLanguage = 'en'; // Default language

// Language pack
const translations = {
    zh: {
        title: '古代人类DNA数据可视化',
        uploadTitle: '上传数据文件',
        fileLabel: '选择 Excel 或 CSV 文件',
        fileFormatInfo: '支持的文件格式: .xlsx, .xls, .csv',
        fileRequirementInfo: '文件必须包含 Lat. 和 Long. 列以显示地理位置',
        loadedFiles: '已加载文件',
        records: '条记录',
        searchTitle: '搜索和过滤',
        searchPlaceholder: '搜索...',
        ageFilterTitle: '年代范围 (BP)',
        infoTitle: '个体信息',
        welcomeTitle: '欢迎使用古代人类DNA数据可视化工具',
        welcomeText: '请使用左侧面板上传Excel或CSV数据文件以开始可视化。',
        welcomeFormat: '支持的文件格式: .xlsx, .xls, .csv',
        geneticId: '基因ID',
        masterId: '主ID',
        groupId: '群体ID',
        locality: '地点',
        age: '年代 (BP)',
        publication: '出版物',
        loading: '加载中...'
    },
    en: {
        title: 'Ancient Sample Visualizer',
        uploadTitle: 'Upload Data File',
        fileLabel: 'Choose Excel or CSV File',
        fileFormatInfo: 'Supported formats: .xlsx, .xls, .csv',
        fileRequirementInfo: 'File must contain Lat. and Long. columns to display locations',
        loadedFiles: 'Loaded Files',
        records: 'records',
        searchTitle: 'Search and Filter',
        searchPlaceholder: 'Search...',
        ageFilterTitle: 'Age Range (BP)',
        infoTitle: 'Individual Information',
        welcomeTitle: 'Welcome to Ancient Sample Visualizer',
        welcomeText: 'Please use the left panel to upload Excel or CSV data files to start visualization.',
        welcomeFormat: 'Supported formats: .xlsx, .xls, .csv',
        geneticId: 'Genetic ID',
        masterId: 'Master ID',
        groupId: 'Group ID',
        locality: 'Locality',
        age: 'Age (BP)',
        publication: 'Publication',
        loading: 'Loading...'
    }
};

// Initialize function
document.addEventListener('DOMContentLoaded', function() {
    initMap();
    setupEventListeners();
    updateLanguage();
});

// Initialize map
function initMap() {
    map = L.map('map').setView([30, 20], 2);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);
    
    // Hide map and show welcome message
    document.getElementById('welcome-message').style.display = 'block';
}

// Set up event listeners
function setupEventListeners() {
    // File upload
    document.getElementById('file-input').addEventListener('change', handleFileUpload);
    
    // Sidebar toggle
    document.getElementById('sidebar-toggle').addEventListener('click', toggleSidebar);
    
    // Theme toggle
    document.getElementById('theme-toggle').addEventListener('click', toggleTheme);
    
    // Language toggle
    document.getElementById('lang-toggle').addEventListener('click', toggleLanguage);
    
    // Search box
    document.getElementById('search-input').addEventListener('input', handleSearch);
    
    // Age slider
    document.getElementById('min-age-slider').addEventListener('input', handleAgeFilter);
    document.getElementById('max-age-slider').addEventListener('input', handleAgeFilter);
    
    // Close individual info
    document.getElementById('close-info').addEventListener('click', closeIndividualInfo);
}

// Handle file upload
function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    // Show loading indicator
    showLoading();
    
    const fileName = file.name;
    const fileExtension = fileName.split('.').pop().toLowerCase();
    
    if (fileExtension === 'csv') {
        // Parse CSV file
        Papa.parse(file, {
            header: true,
            complete: function(results) {
                processData(results.data, fileName);
            }
        });
    } else if (['xlsx', 'xls'].includes(fileExtension)) {
        // Parse Excel file
        const reader = new FileReader();
        reader.onload = function(e) {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(firstSheet);
            processData(jsonData, fileName);
        };
        reader.readAsArrayBuffer(file);
    }
}

// Process data
function processData(data, fileName) {
    // Check if data contains required fields
    if (!data || data.length === 0) {
        hideLoading();
        alert('文件不包含有效数据');
        return;
    }
    
    // Check if data contains latitude and longitude fields
    const firstRow = data[0];
    const hasLatLong = (firstRow['Lat.'] !== undefined || firstRow['Lat'] !== undefined) && 
                      (firstRow['Long.'] !== undefined || firstRow['Long'] !== undefined);
    
    if (!hasLatLong) {
        hideLoading();
        alert('文件必须包含Lat.和Long.字段');
        return;
    }
    
    // Calculate age range
    const ageField = 'Date mean in BP in years before 1950 CE' in firstRow ? 
                    'Date mean in BP in years before 1950 CE' : 
                    'Date mean in BP in years before 1950 CE [OxCal mu for a direct radiocarbon date, and average of range for a contextual date]';
    
    let min = Number.MAX_VALUE;
    let max = 0;
    
    data.forEach(item => {
        const age = parseFloat(item[ageField] || 0);
        if (age > 0) {
            min = Math.min(min, age);
            max = Math.max(max, age);
        }
    });
    
    // Use default values if no valid age is found
    if (min === Number.MAX_VALUE) min = 0;
    if (max === 0) max = 100000;
    
    // Add to loaded files list
    const fileData = {
        name: fileName,
        data: data,
        minAge: min,
        maxAge: max
    };
    
    loadedFiles.push(fileData);
    currentFileIndex = loadedFiles.length - 1;
    
    // Update UI
    updateLoadedFilesList();
    updateAgeSliders(min, max);
    
    // Display data
    currentData = data;
    filteredData = data;
    displayData(data);
    
    // Hide welcome message and show search filter area
    document.getElementById('welcome-message').style.display = 'none';
    document.getElementById('search-filter').style.display = 'block';
    
    hideLoading();
}

// Update loaded files list
function updateLoadedFilesList() {
    const container = document.getElementById('loaded-files');
    container.innerHTML = '';
    
    if (loadedFiles.length > 0) {
        const title = document.createElement('h2');
        title.textContent = translations[currentLanguage].loadedFiles;
        container.appendChild(title);
        
        loadedFiles.forEach((file, index) => {
            const fileItem = document.createElement('div');
            fileItem.className = `file-item ${index === currentFileIndex ? 'active' : ''}`;
            fileItem.innerHTML = `
                <strong>${file.name}</strong>
                <p>${file.data.length} ${translations[currentLanguage].records} | ${Math.round(file.minAge)}-${Math.round(file.maxAge)} BP</p>
            `;
            fileItem.addEventListener('click', () => switchFile(index));
            container.appendChild(fileItem);
        });
    }
}

// Switch file
function switchFile(index) {
    if (index >= 0 && index < loadedFiles.length && index !== currentFileIndex) {
        currentFileIndex = index;
        const fileData = loadedFiles[index];
        
        // Update UI
        updateLoadedFilesList();
        updateAgeSliders(fileData.minAge, fileData.maxAge);
        
        // Display data
        currentData = fileData.data;
        filteredData = fileData.data;
        displayData(fileData.data);
        
        // Reset search box
        document.getElementById('search-input').value = '';
    }
}

// Update age sliders
function updateAgeSliders(min, max) {
    minAge = min;
    maxAge = max;
    
    const minSlider = document.getElementById('min-age-slider');
    const maxSlider = document.getElementById('max-age-slider');
    const minValue = document.getElementById('min-age-value');
    const maxValue = document.getElementById('max-age-value');
    
    minSlider.min = min;
    minSlider.max = max;
    minSlider.value = min;
    
    maxSlider.min = min;
    maxSlider.max = max;
    maxSlider.value = max;
    
    minValue.textContent = Math.round(min);
    maxValue.textContent = Math.round(max);
}

// Handle search
function handleSearch() {
    if (currentFileIndex === -1) return;
    
    const searchTerm = document.getElementById('search-input').value.toLowerCase();
    const minAgeValue = parseFloat(document.getElementById('min-age-slider').value);
    const maxAgeValue = parseFloat(document.getElementById('max-age-slider').value);
    
    filterData(searchTerm, minAgeValue, maxAgeValue);
}

// Handle age filter
function handleAgeFilter() {
    if (currentFileIndex === -1) return;
    
    const minAgeValue = parseFloat(document.getElementById('min-age-slider').value);
    const maxAgeValue = parseFloat(document.getElementById('max-age-slider').value);
    
    // Update displayed values
    document.getElementById('min-age-value').textContent = Math.round(minAgeValue);
    document.getElementById('max-age-value').textContent = Math.round(maxAgeValue);
    
    const searchTerm = document.getElementById('search-input').value.toLowerCase();
    
    filterData(searchTerm, minAgeValue, maxAgeValue);
}

// Filter data
function filterData(searchTerm, minAgeValue, maxAgeValue) {
    if (currentFileIndex === -1) return;
    
    const data = currentData;
    const ageField = 'Date mean in BP in years before 1950 CE' in data[0] ? 
                    'Date mean in BP in years before 1950 CE' : 
                    'Date mean in BP in years before 1950 CE [OxCal mu for a direct radiocarbon date, and average of range for a contextual date]';
    
    filteredData = data.filter(item => {
        // Age filter
        const age = parseFloat(item[ageField] || 0);
        const ageMatch = age >= minAgeValue && age <= maxAgeValue;
        
        // Search filter
        let searchMatch = true;
        if (searchTerm) {
            searchMatch = Object.values(item).some(value => 
                value && value.toString().toLowerCase().includes(searchTerm)
            );
        }
        
        return ageMatch && searchMatch;
    });
    
    displayData(filteredData);
}

// Display data
function displayData(data) {
    // Clear existing markers
    clearMarkers();
    
    // Add new markers
    data.forEach((item, index) => {
        // Handle different field names
        const lat = parseFloat(item['Lat.'] || item['Lat'] || 0);
        const lng = parseFloat(item['Long.'] || item['Long'] || 0);
        const ageField = 'Date mean in BP in years before 1950 CE' in item ? 
                        'Date mean in BP in years before 1950 CE' : 
                        'Date mean in BP in years before 1950 CE [OxCal mu for a direct radiocarbon date, and average of range for a contextual date]';
        const age = parseFloat(item[ageField] || 0);
        
        if (!lat || !lng || isNaN(lat) || isNaN(lng)) return;
        
        const markerColor = getColorByAge(age, minAge, maxAge);
        
        // Create custom icon
        const customIcon = L.divIcon({
            className: 'custom-div-icon',
            html: `<div style="background-color: ${markerColor}; width: 10px; height: 10px; border-radius: 50%; border: 1px solid #000;"></div>`,
            iconSize: [10, 10],
            iconAnchor: [5, 5]
        });
        
        // Handle different field names
        const geneticId = item['Genetic ID (suffixes: ".DG" is a high coverage shotgun genome with diploid genotype calls, ".AG" is shotgun data with each position in the genome represented by a randomly chosen sequence, ".HO" is Affymetrix Human Origins genotype data)'] || 
                         item['Genetic ID'] || 'Unknown';
        const masterId = item['Master ID'] || 'N/A';
        const groupId = item['Group ID'] || 'N/A';
        const locality = item['Locality'] || 'N/A';
        const publication = item['Publication abbreviation'] || 'N/A';
        
        // Create marker
        const marker = L.marker([lat, lng], { icon: customIcon }).addTo(map);
        
        // Add popup info
        marker.bindPopup(`
            <h3>${geneticId}</h3>
            <p><strong>${translations[currentLanguage].masterId}:</strong> ${masterId}</p>
            <p><strong>${translations[currentLanguage].groupId}:</strong> ${groupId}</p>
            <p><strong>${translations[currentLanguage].locality}:</strong> ${locality}</p>
            <p><strong>${translations[currentLanguage].age}:</strong> ${age || 'N/A'}</p>
            <p><strong>${translations[currentLanguage].publication}:</strong> ${publication}</p>
        `);
        
        // Click event
        marker.on('click', function() {
            showIndividualInfo(item);
        });
        
        markers.push(marker);
    });
    
    // Adjust map view if there are markers
    if (markers.length > 0) {
        const group = new L.featureGroup(markers);
        map.fitBounds(group.getBounds());
    }
}

// Get color by age
function getColorByAge(age, minAge, maxAge, divisions = 5) {
    // Color gradient from green to red
    const colors = ['#1a9850', '#91cf60', '#d9ef8b', '#fee08b', '#fc8d59', '#d73027'];
    
    if (age <= 0) return '#808080'; // Use gray for samples with age 0 or negative
    
    // Calculate position of age in range
    const normalizedAge = (age - minAge) / (maxAge - minAge);
    const colorIndex = Math.min(Math.floor(normalizedAge * divisions), divisions - 1);
    
    return colors[colorIndex];
}

// Clear markers
function clearMarkers() {
    markers.forEach(marker => map.removeLayer(marker));
    markers = [];
}

// Show individual info
function showIndividualInfo(individual) {
    const infoContent = document.getElementById('info-content');
    infoContent.innerHTML = '';
    
    // Handle different field names
    const geneticId = individual['Genetic ID (suffixes: ".DG" is a high coverage shotgun genome with diploid genotype calls, ".AG" is shotgun data with each position in the genome represented by a randomly chosen sequence, ".HO" is Affymetrix Human Origins genotype data)'] || 
                     individual['Genetic ID'] || 'Unknown';
    const ageField = 'Date mean in BP in years before 1950 CE' in individual ? 
                    'Date mean in BP in years before 1950 CE' : 
                    'Date mean in BP in years before 1950 CE [OxCal mu for a direct radiocarbon date, and average of range for a contextual date]';
    
    // Add basic information
    addInfoItem(infoContent, translations[currentLanguage].geneticId, geneticId);
    addInfoItem(infoContent, translations[currentLanguage].masterId, individual['Master ID'] || 'N/A');
    addInfoItem(infoContent, translations[currentLanguage].groupId, individual['Group ID'] || 'N/A');
    addInfoItem(infoContent, translations[currentLanguage].locality, individual['Locality'] || 'N/A');
    addInfoItem(infoContent, translations[currentLanguage].age, individual[ageField] || 'N/A');
    addInfoItem(infoContent, translations[currentLanguage].publication, individual['Publication abbreviation'] || 'N/A');
    
    // Add other possible fields
    for (const key in individual) {
        if (['Lat.', 'Lat', 'Long.', 'Long', 'Master ID', 'Group ID', 'Locality', 'Publication abbreviation'].includes(key)) continue;
        if (key.includes('Genetic ID')) continue;
        if (key === ageField) continue;
        
        if (individual[key]) {
            addInfoItem(infoContent, key, individual[key]);
        }
    }
    
    // Show info panel
    document.getElementById('individual-info').style.display = 'block';
}

// Add info item
function addInfoItem(container, label, value) {
    const item = document.createElement('div');
    item.className = 'info-item';
    item.innerHTML = `
        <strong>${label}</strong>
        <span>${value}</span>
    `;
    container.appendChild(item);
}

// Close individual info
function closeIndividualInfo() {
    document.getElementById('individual-info').style.display = 'none';
}

// Toggle sidebar
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.toggle('collapsed');
    
    const button = document.getElementById('sidebar-toggle');
    button.textContent = sidebar.classList.contains('collapsed') ? '→' : '←';
}

// Toggle theme
function toggleTheme() {
    isDarkTheme = !isDarkTheme;
    document.body.classList.toggle('dark-theme', isDarkTheme);
    
    const button = document.getElementById('theme-toggle');
    button.textContent = isDarkTheme ? '☀️' : '🌙';
}

// Toggle language
function toggleLanguage() {
    currentLanguage = currentLanguage === 'zh' ? 'en' : 'zh';
    updateLanguage();
    
    const button = document.getElementById('lang-toggle');
    button.textContent = currentLanguage === 'zh' ? 'EN' : '中';
}

// Update language
function updateLanguage() {
    // Update title
    document.title = translations[currentLanguage].title;
    document.querySelector('.sidebar-header h1').textContent = translations[currentLanguage].title;
    
    // Update upload section
    document.getElementById('upload-title').textContent = translations[currentLanguage].uploadTitle;
    document.getElementById('file-label').textContent = translations[currentLanguage].fileLabel;
    document.getElementById('file-format-info').textContent = translations[currentLanguage].fileFormatInfo;
    document.getElementById('file-requirement-info').textContent = translations[currentLanguage].fileRequirementInfo;
    
    // Update search filter section
    document.getElementById('search-title').textContent = translations[currentLanguage].searchTitle;
    document.getElementById('search-input').placeholder = translations[currentLanguage].searchPlaceholder;
    document.getElementById('age-filter-title').textContent = translations[currentLanguage].ageFilterTitle;
    
    // Update individual info
    document.getElementById('info-title').textContent = translations[currentLanguage].infoTitle;
    
    // Update welcome message
    document.getElementById('welcome-title').textContent = translations[currentLanguage].welcomeTitle;
    document.getElementById('welcome-text').textContent = translations[currentLanguage].welcomeText;
    document.getElementById('welcome-format').textContent = translations[currentLanguage].welcomeFormat;
    
    // Update loaded files list
    updateLoadedFilesList();
    
    // Update markers if there is data
    if (filteredData.length > 0) {
        displayData(filteredData);
    }
}

// Show loading indicator
function showLoading() {
    const loading = document.createElement('div');
    loading.className = 'loading';
    loading.id = 'loading-indicator';
    loading.textContent = translations[currentLanguage].loading;
    document.body.appendChild(loading);
}

// Hide loading indicator
function hideLoading() {
    const loading = document.getElementById('loading-indicator');
    if (loading) {
        loading.remove();
    }
}
