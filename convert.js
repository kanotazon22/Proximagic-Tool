let convertedFiles = [];
let currentMode = 'image';
let ffmpeg = null;
let ffmpegLoaded = false;

const fileManager = new FileManager();

const magicCompressor = new MagicImageCompressor();

const imageMode = document.getElementById('imageMode');
const audioMode = document.getElementById('audioMode');
const magicMode = document.getElementById('magicMode');
const imageSettings = document.getElementById('imageSettings');
const audioSettings = document.getElementById('audioSettings');
const magicSettings = document.getElementById('magicSettings');
const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const fileList = document.getElementById('fileList');
const emptyState = document.getElementById('emptyState');
const fileCount = document.getElementById('fileCount');
const clearAll = document.getElementById('clearAll');
const convertSection = document.getElementById('convertSection');
const convertBtn = document.getElementById('convertBtn');
const convertCount = document.getElementById('convertCount');
const convertedSection = document.getElementById('convertedSection');
const convertedList = document.getElementById('convertedList');
const convertedCount = document.getElementById('convertedCount');
const downloadAll = document.getElementById('downloadAll');
const resetBtn = document.getElementById('resetBtn');
const resizeOption = document.getElementById('resizeOption');
const customSize = document.getElementById('customSize');
const fileType = document.getElementById('fileType');

const uploadHandler = new UploadHandler(fileInput, uploadArea, {
    accept: 'image/*',
    multiple: true,
    onFilesSelected: (files) => {
        fileManager.addFiles(files, currentMode === 'audio' ? 'audio' : 'image');
        NotificationHelper.success(`Added ${files.length} file(s)`);
    },
    onError: (message) => {
        NotificationHelper.error(message);
    }
});

imageMode.addEventListener('click', () => switchMode('image'));
audioMode.addEventListener('click', () => switchMode('audio'));
magicMode.addEventListener('click', () => switchMode('magic'));
clearAll.addEventListener('click', () => fileManager.clearAll());
convertBtn.addEventListener('click', handleConvert);
downloadAll.addEventListener('click', downloadAllFiles);
resetBtn.addEventListener('click', reset);
resizeOption.addEventListener('change', toggleCustomSize);

fileManager.onChange((files) => {
    updateFileList(files);
});

async function loadFFmpeg() {
    if (ffmpegLoaded) return true;
    
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    if (isMobile) {
        NotificationHelper.error('Audio conversion is not supported on mobile devices. Please use desktop browser.');
        return false;
    }
    
    if (typeof SharedArrayBuffer === 'undefined') {
        NotificationHelper.error('Your browser does not support audio conversion. Try Chrome/Firefox on desktop.');
        return false;
    }
    
    try {
        if (typeof FFmpeg === 'undefined') {
            throw new Error('FFmpeg library not loaded');
        }
        
        ffmpeg = new FFmpeg.FFmpeg();
        
        ffmpeg.on('log', ({ message }) => {
            console.log(message);
        });
        
        await ffmpeg.load({
            coreURL: 'libs/ffmpeg-core.js',
            wasmURL: 'libs/ffmpeg-core.wasm'
        });
        
        ffmpegLoaded = true;
        NotificationHelper.success('Audio converter loaded successfully');
        return true;
    } catch (error) {
        console.error('Failed to load FFmpeg:', error);
        NotificationHelper.error('Failed to load audio converter. Please check your browser compatibility.');
        return false;
    }
}

function switchMode(mode) {
    if (mode === 'audio') {
        NotificationHelper.info('Audio Converter is coming soon in v1.1.0!');
        return;
    }
    
    currentMode = mode;
    
    UIHelper.removeClass(imageMode, 'active');
    UIHelper.removeClass(imageMode, 'audio-active');
    UIHelper.removeClass(audioMode, 'active');
    UIHelper.removeClass(audioMode, 'audio-active');
    UIHelper.removeClass(magicMode, 'active');
    UIHelper.removeClass(magicMode, 'magic-active');
    
    UIHelper.hide(imageSettings);
    UIHelper.hide(audioSettings);
    UIHelper.hide(magicSettings);
    
    if (mode === 'image') {
        UIHelper.addClass(imageMode, 'active');
        UIHelper.show(imageSettings);
        uploadHandler.setAccept('image/*');
        UIHelper.setText(fileType, 'images');
    } else if (mode === 'magic') {
        UIHelper.addClass(magicMode, 'active');
        UIHelper.addClass(magicMode, 'magic-active');
        UIHelper.show(magicSettings);
        uploadHandler.setAccept('image/*');
        UIHelper.setText(fileType, 'images');
    }
    
    fileManager.clearAll();
}

function toggleCustomSize() {
    if (resizeOption.value === 'custom') {
        UIHelper.show(customSize);
    } else {
        UIHelper.hide(customSize);
    }
}

function updateFileList(files) {
    UIHelper.setText(fileCount, files.length);
    
    if (files.length === 0) {
        UIHelper.setHTML(fileList, '');
        UIHelper.show(emptyState);
        UIHelper.hide(clearAll);
        UIHelper.hide(convertSection);
    } else {
        UIHelper.hide(emptyState);
        UIHelper.show(clearAll);
        UIHelper.show(convertSection);
        UIHelper.setText(convertCount, files.length);
        
        const html = files.map(file => `
            <div class="file-item" data-id="${file.id}">
                ${file.preview ? 
                    `<img src="${file.preview}" alt="" class="file-preview">` :
                    `<div class="file-icon">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M9 18V5l12-2v13"></path>
                            <circle cx="6" cy="18" r="3"></circle>
                            <circle cx="18" cy="16" r="3"></circle>
                        </svg>
                    </div>`
                }
                <div class="file-info">
                    <div class="file-name">${file.name}</div>
                    <div class="file-size">${file.sizeFormatted}</div>
                </div>
                <button class="remove-btn" onclick="removeFile('${file.id}')">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
            </div>
        `).join('');
        
        UIHelper.setHTML(fileList, html);
    }
}

function removeFile(id) {
    fileManager.removeFile(id);
}

async function handleConvert() {
    const files = fileManager.getAll();
    if (files.length === 0) return;
    
    if (currentMode === 'audio') {
        NotificationHelper.error('Audio Converter is coming soon in v1.1.0!');
        return;
    }
    
    UIHelper.showLoading(convertBtn, 'Processing...');
    convertedFiles = [];
    
    for (let i = 0; i < files.length; i++) {
        const fileData = files[i];
        try {
            let blob;
            let outputFormat;
            let info = null;
            
            if (currentMode === 'magic') {
                const targetSize = parseInt(document.getElementById('targetSize').value) || 50;
                const format = document.getElementById('magicFormat').value;
                
                magicCompressor.options.targetSizeKB = targetSize;
                magicCompressor.options.format = format;
                
                const result = await magicCompressor.compress(fileData.file);
                blob = result.blob;
                info = result.info;
                
                if (info.format === 'image/jpeg') {
                    outputFormat = 'jpg';
                } else if (info.format === 'image/webp') {
                    outputFormat = 'webp';
                } else if (info.format === 'image/png') {
                    outputFormat = 'png';
                } else {
                    outputFormat = 'jpg';
                }
            } else if (currentMode === 'image') {
                const format = document.getElementById('imageFormat').value;
                const resize = resizeOption.value;
                blob = await convertImage(fileData.file, format, resize);
                outputFormat = format;
            }
            
            const originalName = fileData.name.substring(0, fileData.name.lastIndexOf('.'));
            const newFileName = `${originalName}_${currentMode === 'magic' ? 'magic' : 'converted'}.${outputFormat}`;
            
            convertedFiles.push({
                id: fileData.id,
                name: newFileName,
                blob: blob,
                url: URL.createObjectURL(blob),
                size: fileManager.formatFileSize(blob.size),
                info: info
            });
        } catch (error) {
            console.error('Conversion error:', error);
            NotificationHelper.error(`Error processing ${fileData.name}`);
        }
    }
    
    UIHelper.hideLoading(convertBtn);
    
    if (convertedFiles.length > 0) {
        const modeText = currentMode === 'magic' ? 'compressed' : 'converted';
        NotificationHelper.success(`Successfully ${modeText} ${convertedFiles.length} file(s)`);
        showConvertedFiles();
    } else {
        NotificationHelper.error('No files were processed successfully');
    }
}

async function convertImage(file, targetFormat, targetSize) {
    const img = await ImageHelper.loadImage(file);
    
    let width = img.width;
    let height = img.height;
    
    if (targetSize !== 'original') {
        if (targetSize === 'custom') {
            const customW = parseInt(document.getElementById('customWidth').value);
            const customH = parseInt(document.getElementById('customHeight').value);
            width = customW || img.width;
            height = customH || img.height;
        } else {
            const [w, h] = targetSize.split('x').map(Number);
            width = w;
            height = h;
        }
    }
    
    const canvas = ImageHelper.createCanvas(img, width, height);
    const mimeType = targetFormat === 'jpg' || targetFormat === 'jpeg' ? 'image/jpeg' : `image/${targetFormat}`;
    return await ImageHelper.canvasToBlob(canvas, mimeType, 0.95);
}

function showConvertedFiles() {
    UIHelper.setText(convertedCount, convertedFiles.length);
    
    const html = convertedFiles.map(file => {
        let extraInfo = '';
        if (file.info && currentMode === 'magic') {
            extraInfo = `<div class="magic-info">
                <small>📊 ${file.info.originalSize.toFixed(2)} KB → ${file.info.compressedSize.toFixed(2)} KB</small>
                <small>💾 Reduced ${file.info.compressionRatio}%</small>
            </div>`;
        }
        
        return `
            <div class="converted-item ${currentMode === 'magic' ? 'magic-item' : ''}">
                <div class="converted-info">
                    <div class="file-name">${file.name}</div>
                    <div class="file-size">${file.size}</div>
                    ${extraInfo}
                </div>
                <button class="download-btn" onclick="downloadFile('${file.id}')">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="7 10 12 15 17 10"></polyline>
                        <line x1="12" y1="15" x2="12" y2="3"></line>
                    </svg>
                    Download
                </button>
            </div>
        `;
    }).join('');
    
    UIHelper.setHTML(convertedList, html);
    UIHelper.hide(convertSection);
    UIHelper.show(convertedSection);
}

function downloadFile(id) {
    const file = convertedFiles.find(f => f.id === id);
    if (file) {
        DownloadHelper.downloadFile(file.blob, file.name);
    }
}

function downloadAllFiles() {
    DownloadHelper.downloadMultiple(convertedFiles);
    NotificationHelper.success('Downloading all files...');
}

function reset() {
    convertedFiles.forEach(f => URL.revokeObjectURL(f.url));
    fileManager.clearAll();
    convertedFiles = [];
    UIHelper.hide(convertedSection);
    NotificationHelper.info('Reset');
}