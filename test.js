// Thêm vào đầu file, sau khai báo magicCompressor


// Thêm vào phần khai báo elements


// Thêm event listeners


// Cập nhật hàm switchMode


// Cập nhật hàm handleConvert

    
    // Existing code for image and magic modes...
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

// Thêm hàm xử lý spritesheet


// Cập nhật hàm showConvertedFiles để hiển thị spritesheet info
// Thêm vào phần tạo HTML trong showConvertedFiles():

