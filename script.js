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
let selectedMarkerInfo = 'none'; // 当前选择的标记信息
let markerCluster; // 添加 markerCluster 变量
let useCluster = true; // 是否使用 cluster 功能

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
        loading: '加载中...',
        markerDisplayInfo: '标记显示信息：',
        enableMarkerClustering: '启用标记聚合：'
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
        loading: 'Loading...',
        markerDisplayInfo: 'Marker Display Info:',
        enableMarkerClustering: 'Enable Marker Clustering:'
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
    
    // 初始化 markerCluster
    markerCluster = L.markerClusterGroup();
    map.addLayer(markerCluster);
    
    // 隐藏地图并显示欢迎信息
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
    
    // 添加打印按钮事件监听
    document.getElementById('print-button').addEventListener('click', showPrintSettings);
    
    // 打印设置面板事件监听
    const printSettings = document.getElementById('print-settings');
    const printSizeOptions = printSettings.querySelectorAll('.print-size-option');
    const printCancel = printSettings.querySelector('.print-cancel');
    const printConfirm = printSettings.querySelector('.print-confirm');
    
    printSizeOptions.forEach(option => {
        option.addEventListener('click', () => {
            printSizeOptions.forEach(opt => opt.classList.remove('active'));
            option.classList.add('active');
        });
    });
    
    printCancel.addEventListener('click', () => {
        printSettings.classList.remove('active');
    });
    
    printConfirm.addEventListener('click', () => {
        const selectedSize = printSettings.querySelector('.print-size-option.active')?.dataset.size || 'a4';
        handlePrint(selectedSize);
        printSettings.classList.remove('active');
    });
    
    // 添加标记信息选择事件监听
    document.getElementById('marker-info-select').addEventListener('change', function(e) {
        selectedMarkerInfo = e.target.value;
        updateMarkers();
    });
    
    // 添加 cluster 开关事件监听
    document.getElementById('cluster-toggle').addEventListener('change', function(e) {
        useCluster = e.target.checked;
        updateMarkers();
    });
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
    
    // 更新标记显示信息选项
    updateMarkerInfoOptions(data[0]);
    
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
    // 清除现有标记
    clearMarkers();
    
    // 如果使用 cluster，确保 cluster 图层已添加到地图
    if (useCluster) {
        if (!map.hasLayer(markerCluster)) {
            map.addLayer(markerCluster);
        }
    } else {
        if (map.hasLayer(markerCluster)) {
            map.removeLayer(markerCluster);
        }
    }
    
    // 添加新标记
    data.forEach((item, index) => {
        // 处理不同的字段名
        const lat = parseFloat(item['Lat.'] || item['Lat'] || 0);
        const lng = parseFloat(item['Long.'] || item['Long'] || 0);
        const ageField = 'Date mean in BP in years before 1950 CE' in item ? 
                        'Date mean in BP in years before 1950 CE' : 
                        'Date mean in BP in years before 1950 CE [OxCal mu for a direct radiocarbon date, and average of range for a contextual date]';
        const age = parseFloat(item[ageField] || 0);
        
        if (!lat || !lng || isNaN(lat) || isNaN(lng)) return;
        
        const markerColor = getColorByAge(age, minAge, maxAge);
        
        // 创建自定义图标，包含点和标签
        const markerLabelText = getMarkerLabelText(item);
        const customIcon = L.divIcon({
            className: 'custom-div-icon',
            html: `
                <div style="position: relative; display: inline-block; transform: translate(-50%, -50%);">
                    <div style="background-color: ${markerColor}; width: 10px; height: 10px; border-radius: 50%; border: 1px solid #000;"></div>
                    ${markerLabelText !== null ? `
                        <div class="marker-label" style="position: absolute; left: 15px; top: -5px; background-color: rgba(255, 255, 255, 0.8); padding: 2px 5px; border-radius: 3px; font-size: 12px; white-space: nowrap;">
                            ${markerLabelText}
                        </div>
                    ` : ''}
                </div>
            `,
            iconSize: [0, 0],
            iconAnchor: [0, 0]
        });
        
        // 处理不同的字段名
        const geneticId = item['Genetic ID (suffixes: ".DG" is a high coverage shotgun genome with diploid genotype calls, ".AG" is shotgun data with each position in the genome represented by a randomly chosen sequence, ".HO" is Affymetrix Human Origins genotype data)'] || 
                         item['Genetic ID'] || 'Unknown';
        const masterId = item['Master ID'] || 'N/A';
        const groupId = item['Group ID'] || 'N/A';
        const locality = item['Locality'] || 'N/A';
        const publication = item['Publication abbreviation'] || 'N/A';
        const country = item['Country'] || 'N/A';
        const culture = item['Culture'] || 'N/A';
        const sex = item['Sex'] || 'N/A';
        
        // 创建标记
        const marker = L.marker([lat, lng], { icon: customIcon });
        
        // 添加弹出信息
        marker.bindPopup(`
            <h3>${geneticId}</h3>
            <p><strong>${translations[currentLanguage].masterId}:</strong> ${masterId}</p>
            <p><strong>${translations[currentLanguage].groupId}:</strong> ${groupId}</p>
            <p><strong>${translations[currentLanguage].locality}:</strong> ${locality}</p>
            <p><strong>${translations[currentLanguage].age}:</strong> ${age || 'N/A'}</p>
            <p><strong>${translations[currentLanguage].publication}:</strong> ${publication}</p>
            <p><strong>国家:</strong> ${country}</p>
            <p><strong>文化:</strong> ${culture}</p>
            <p><strong>性别:</strong> ${sex}</p>
        `);
        
        // 点击事件
        marker.on('click', function() {
            showIndividualInfo(item);
        });
        
        // 根据设置决定是否使用 cluster
        if (useCluster) {
            markerCluster.addLayer(marker);
        } else {
            marker.addTo(map);
        }
        markers.push(marker);
    });
    
    // 调整地图视图
    if (markers.length > 0) {
        const group = new L.featureGroup(markers);
        map.fitBounds(group.getBounds());
    }
}

function getMarkerLabelText(item) {
    if (selectedMarkerInfo === 'none') return null;
    if (selectedMarkerInfo === 'latLng') {
        const lat = parseFloat(item['Lat.'] || item['Lat'] || 0);
        const lng = parseFloat(item['Long.'] || item['Long'] || 0);
        const latDir = lat >= 0 ? 'N' : 'S';
        const lngDir = lng >= 0 ? 'E' : 'W';
        return `${Math.abs(lat).toFixed(2)}°${latDir}, ${Math.abs(lng).toFixed(2)}°${lngDir}`;
    }
    return item[selectedMarkerInfo] || 'N/A';
}

function updateMarkers() {
    // 保存当前地图视图
    const currentCenter = map.getCenter();
    const currentZoom = map.getZoom();
    
    // 清除所有现有标记
    clearMarkers();
    
    // 如果使用 cluster，确保 cluster 图层已添加到地图
    if (useCluster) {
        if (!map.hasLayer(markerCluster)) {
            map.addLayer(markerCluster);
        }
    } else {
        if (map.hasLayer(markerCluster)) {
            map.removeLayer(markerCluster);
        }
    }
    
    // 重新显示数据
    if (currentFileIndex >= 0) {
        displayData(filteredData);
    }
    
    // 恢复地图视图
    map.setView(currentCenter, currentZoom);
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
    // 清除所有标记
    markers.forEach(marker => {
        map.removeLayer(marker);
        if (markerCluster) {
            markerCluster.removeLayer(marker);
        }
    });
    markers = [];
    
    // 确保清除所有图层
    if (markerCluster) {
        markerCluster.clearLayers();
    }
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
    
    // Add coordinates
    const lat = parseFloat(individual['Lat.'] || individual['Lat'] || 0);
    const lng = parseFloat(individual['Long.'] || individual['Long'] || 0);
    const latDir = lat >= 0 ? 'N' : 'S';
    const lngDir = lng >= 0 ? 'E' : 'W';
    addInfoItem(infoContent, 'Lat, Long', `${Math.abs(lat).toFixed(2)}°${latDir}, ${Math.abs(lng).toFixed(2)}°${lngDir}`);
    
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
    document.documentElement.lang = currentLanguage === 'zh' ? 'zh-CN' : 'en';
    
    // 更新所有带有 data-lang 属性的元素
    document.querySelectorAll('[data-lang]').forEach(element => {
        const lang = element.getAttribute('data-lang');
        element.style.display = (lang === currentLanguage) ? 'block' : 'none';
    });
    
    // 更新按钮文本
    document.getElementById('lang-toggle').textContent = currentLanguage === 'zh' ? 'EN' : '中';
    
    // Update language
    updateLanguage();
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
    
    // Update marker display info and clustering labels
    const markerInfoLabels = document.querySelectorAll('[for="marker-info-select"][data-lang]');
    const clusterLabels = document.querySelectorAll('[for="cluster-toggle"][data-lang]');
    
    markerInfoLabels.forEach(label => {
        label.style.display = label.getAttribute('data-lang') === currentLanguage ? 'block' : 'none';
    });
    
    clusterLabels.forEach(label => {
        label.style.display = label.getAttribute('data-lang') === currentLanguage ? 'block' : 'none';
    });
    
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

function handlePrint(size = 'a4') {
    // 隐藏打印设置面板
    const printSettings = document.getElementById('print-settings');
    printSettings.classList.remove('active');
    
    // 设置打印样式
    const style = document.createElement('style');
    style.textContent = `
        @page {
            size: ${size};
            margin: 0;
        }
        body {
            margin: 0;
            padding: 0;
        }
        #map {
            height: 100vh;
            width: 100%;
        }
        .print-settings {
            display: none !important;
        }
    `;
    document.head.appendChild(style);
    
    // 直接打印，不改变地图视图
    window.print();
    
    // 打印完成后移除样式
    setTimeout(() => {
        style.remove();
    }, 1000);
}

function showPrintSettings() {
    const printSettings = document.getElementById('print-settings');
    const defaultSize = printSettings.querySelector('.print-size-option[data-size="a4"]');
    printSettings.querySelectorAll('.print-size-option').forEach(opt => opt.classList.remove('active'));
    defaultSize.classList.add('active');
    printSettings.classList.add('active');
}

function updateMarkerInfoOptions(firstRow) {
    const select = document.getElementById('marker-info-select');
    // 清空现有选项，保留 "None" 选项
    select.innerHTML = '<option value="none">None</option>';
    
    // 添加经纬度复合选项
    const latLngOption = document.createElement('option');
    latLngOption.value = 'latLng';
    latLngOption.textContent = 'Lat, Long';
    select.appendChild(latLngOption);
    
    // 添加所有可用的列名作为选项
    Object.keys(firstRow).forEach(key => {
        // 跳过不需要显示的列
        if (['Lat.', 'Lat', 'Long.', 'Long'].includes(key)) return;
        
        // 创建选项
        const option = document.createElement('option');
        option.value = key;
        option.textContent = key;
        select.appendChild(option);
    });
}
