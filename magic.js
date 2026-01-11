class MagicImageCompressor {
    constructor(options = {}) {
        this.options = {
            targetSizeKB: options.targetSizeKB || 50,
            maxWidth: options.maxWidth || 4096,
            maxHeight: options.maxHeight || 4096,
            maintainAspectRatio: options.maintainAspectRatio !== false,
            minQuality: options.minQuality || 0.1,
            maxQuality: options.maxQuality || 0.92,
            stepQuality: options.stepQuality || 0.05,
            format: options.format || 'auto'
        };
    }

    async compress(file) {
        try {
            const img = await this.loadImage(file);
            const originalSize = file.size / 1024;

            // KIỂM TRA: Nếu file gốc đã nhỏ hơn target, GIỮ NGUYÊN
            if (originalSize <= this.options.targetSizeKB) {
                return {
                    blob: file,
                    info: {
                        originalSize: originalSize,
                        compressedSize: originalSize,
                        compressionRatio: '0.00',
                        originalDimensions: { width: img.width, height: img.height },
                        finalDimensions: { width: img.width, height: img.height },
                        quality: 'original',
                        format: file.type
                    }
                };
            }

            const format = this.selectOptimalFormat(file.type);
            
            const dimensions = this.calculateOptimalDimensions(
                img.width, 
                img.height,
                originalSize
            );

            const result = await this.compressWithBinarySearch(
                img,
                dimensions.width,
                dimensions.height,
                format
            );

            let finalResult = result;
            
            // Nếu vẫn lớn hơn target, thử nén mạnh hơn
            if (result.blob.size / 1024 > this.options.targetSizeKB) {
                finalResult = await this.advancedCompress(img, format);
            }

            // QUAN TRỌNG: Nếu file nén lớn hơn file gốc, TRẢ VỀ FILE GỐC
            if (finalResult.blob.size > file.size) {
                return {
                    blob: file,
                    info: {
                        originalSize: originalSize,
                        compressedSize: originalSize,
                        compressionRatio: '0.00',
                        originalDimensions: { width: img.width, height: img.height },
                        finalDimensions: { width: img.width, height: img.height },
                        quality: 'original',
                        format: file.type
                    }
                };
            }

            return {
                blob: finalResult.blob,
                info: {
                    originalSize: originalSize,
                    compressedSize: finalResult.blob.size / 1024,
                    compressionRatio: ((1 - (finalResult.blob.size / file.size)) * 100).toFixed(2),
                    originalDimensions: { width: img.width, height: img.height },
                    finalDimensions: finalResult.dimensions,
                    quality: finalResult.quality,
                    format: format
                }
            };
        } catch (error) {
            console.error('Magic compression error:', error);
            throw error;
        }
    }

    loadImage(file) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                URL.revokeObjectURL(img.src);
                resolve(img);
            };
            img.onerror = () => {
                URL.revokeObjectURL(img.src);
                reject(new Error('Failed to load image'));
            };
            img.src = URL.createObjectURL(file);
        });
    }

    selectOptimalFormat(originalType) {
        if (this.options.format !== 'auto') {
            return this.options.format;
        }

        // Ưu tiên JPEG cho nén tốt hơn
        if (originalType === 'image/png') {
            return 'image/jpeg';
        }

        return 'image/jpeg';
    }

    calculateOptimalDimensions(width, height, currentSizeKB) {
        const targetSizeKB = this.options.targetSizeKB;
        
        // Nếu gần target, giữ nguyên
        if (currentSizeKB <= targetSizeKB * 1.3) {
            return { width, height };
        }

        // Tính toán scale factor
        const scaleFactor = Math.sqrt(targetSizeKB / currentSizeKB) * 0.9;
        let newWidth = Math.floor(width * scaleFactor);
        let newHeight = Math.floor(height * scaleFactor);

        if (newWidth > this.options.maxWidth) {
            newWidth = this.options.maxWidth;
            newHeight = Math.floor((height * newWidth) / width);
        }
        if (newHeight > this.options.maxHeight) {
            newHeight = this.options.maxHeight;
            newWidth = Math.floor((width * newHeight) / height);
        }

        newWidth = Math.max(200, newWidth);
        newHeight = Math.max(200, newHeight);

        return { width: newWidth, height: newHeight };
    }

    async compressWithBinarySearch(img, width, height, format) {
        let minQuality = this.options.minQuality;
        let maxQuality = this.options.maxQuality;
        let bestBlob = null;
        let bestQuality = maxQuality;
        const targetSize = this.options.targetSizeKB * 1024;
        const tolerance = targetSize * 0.1;

        let iterations = 0;
        const maxIterations = 12;

        while (maxQuality - minQuality > 0.03 && iterations < maxIterations) {
            iterations++;
            const quality = (minQuality + maxQuality) / 2;
            const blob = await this.createBlob(img, width, height, format, quality);

            if (Math.abs(blob.size - targetSize) <= tolerance) {
                return {
                    blob: blob,
                    quality: quality,
                    dimensions: { width, height }
                };
            }

            if (blob.size <= targetSize) {
                bestBlob = blob;
                bestQuality = quality;
                minQuality = quality;
            } else {
                maxQuality = quality;
            }
        }

        if (!bestBlob) {
            bestBlob = await this.createBlob(img, width, height, format, minQuality);
            bestQuality = minQuality;
        }

        return {
            blob: bestBlob,
            quality: bestQuality,
            dimensions: { width, height }
        };
    }

    async advancedCompress(img, format) {
        const targetSize = this.options.targetSizeKB * 1024;
        let currentWidth = img.width;
        let currentHeight = img.height;
        
        const reductionSteps = [0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3];
        
        for (const scale of reductionSteps) {
            currentWidth = Math.floor(img.width * scale);
            currentHeight = Math.floor(img.height * scale);

            if (currentWidth < 150 || currentHeight < 150) {
                break;
            }

            const result = await this.compressWithBinarySearch(
                img,
                currentWidth,
                currentHeight,
                format
            );

            if (result.blob.size <= targetSize) {
                return result;
            }
        }

        // Fallback cuối cùng
        const minWidth = Math.max(150, currentWidth);
        const minHeight = Math.max(150, currentHeight);
        
        return {
            blob: await this.createBlob(img, minWidth, minHeight, format, 0.5),
            quality: 0.5,
            dimensions: { width: minWidth, height: minHeight }
        };
    }

    createBlob(img, width, height, format, quality) {
        return new Promise((resolve, reject) => {
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            
            const ctx = canvas.getContext('2d', {
                alpha: false,
                willReadFrequently: false
            });
            
            // Fill white background for JPEG
            if (format === 'image/jpeg') {
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, width, height);
            }
            
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            
            ctx.drawImage(img, 0, 0, width, height);

            canvas.toBlob(
                (blob) => {
                    if (blob) {
                        resolve(blob);
                    } else {
                        reject(new Error('Failed to create blob'));
                    }
                },
                format,
                quality
            );
        });
    }

    async compressMultiple(files, onProgress) {
        const results = [];
        
        for (let i = 0; i < files.length; i++) {
            try {
                const result = await this.compress(files[i]);
                results.push({
                    success: true,
                    fileName: files[i].name,
                    ...result
                });
            } catch (error) {
                results.push({
                    success: false,
                    fileName: files[i].name,
                    error: error.message
                });
            }
            
            if (onProgress) {
                onProgress((i + 1) / files.length * 100, i + 1, files.length);
            }
        }
        
        return results;
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = MagicImageCompressor;
}