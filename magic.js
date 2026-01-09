class MagicImageCompressor {
    constructor(options = {}) {
        this.options = {
            targetSizeKB: options.targetSizeKB || 50,
            maxWidth: options.maxWidth || 4096,
            maxHeight: options.maxHeight || 4096,
            maintainAspectRatio: options.maintainAspectRatio !== false,
            minQuality: options.minQuality || 0.5,
            maxQuality: options.maxQuality || 0.95,
            stepQuality: options.stepQuality || 0.05,
            format: options.format || 'auto'
        };
    }

    async compress(file) {
        try {
            const img = await this.loadImage(file);
            const originalSize = file.size / 1024;

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
            if (result.blob.size / 1024 > this.options.targetSizeKB) {
                finalResult = await this.advancedCompress(img, format);
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
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error('Failed to load image'));
            img.src = URL.createObjectURL(file);
        });
    }

    selectOptimalFormat(originalType) {
        if (this.options.format !== 'auto') {
            return this.options.format;
        }

        if (originalType === 'image/png') {
            return 'image/webp';
        }

        return 'image/jpeg';
    }

    calculateOptimalDimensions(width, height, currentSizeKB) {
        const targetSizeKB = this.options.targetSizeKB;
        
        if (currentSizeKB <= targetSizeKB * 1.2) {
            return { width, height };
        }

        const sizeRatio = Math.sqrt(targetSizeKB / currentSizeKB);
        let newWidth = Math.round(width * sizeRatio);
        let newHeight = Math.round(height * sizeRatio);

        if (newWidth > this.options.maxWidth) {
            newWidth = this.options.maxWidth;
            newHeight = Math.round((height * newWidth) / width);
        }
        if (newHeight > this.options.maxHeight) {
            newHeight = this.options.maxHeight;
            newWidth = Math.round((width * newHeight) / height);
        }

        newWidth = Math.max(100, newWidth);
        newHeight = Math.max(100, newHeight);

        return { width: newWidth, height: newHeight };
    }

    async compressWithBinarySearch(img, width, height, format) {
        let minQuality = this.options.minQuality;
        let maxQuality = this.options.maxQuality;
        let bestBlob = null;
        let bestQuality = maxQuality;
        const targetSize = this.options.targetSizeKB * 1024;

        while (maxQuality - minQuality > 0.05) {
            const quality = (minQuality + maxQuality) / 2;
            const blob = await this.createBlob(img, width, height, format, quality);

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
        
        while (currentWidth > 100 && currentHeight > 100) {
            currentWidth = Math.round(currentWidth * 0.9);
            currentHeight = Math.round(currentHeight * 0.9);

            const blob = await this.createBlob(
                img, 
                currentWidth, 
                currentHeight, 
                format, 
                this.options.minQuality
            );

            if (blob.size <= targetSize) {
                return {
                    blob,
                    quality: this.options.minQuality,
                    dimensions: { width: currentWidth, height: currentHeight }
                };
            }
        }

        return {
            blob: await this.createBlob(img, currentWidth, currentHeight, format, 0.5),
            quality: 0.5,
            dimensions: { width: currentWidth, height: currentHeight }
        };
    }

    createBlob(img, width, height, format, quality) {
        return new Promise((resolve, reject) => {
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            
            const ctx = canvas.getContext('2d');
            
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            
            ctx.drawImage(img, 0, 0, width, height);

            if (width < img.width * 0.8) {
                this.applySharpen(ctx, width, height);
            }

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

    applySharpen(ctx, width, height) {
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;
        
        const weights = [0, -0.25, 0, -0.25, 2, -0.25, 0, -0.25, 0];
        const side = Math.round(Math.sqrt(weights.length));
        const halfSide = Math.floor(side / 2);
        
        const src = data.slice();
        
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const dstOff = (y * width + x) * 4;
                let r = 0, g = 0, b = 0;
                
                for (let cy = 0; cy < side; cy++) {
                    for (let cx = 0; cx < side; cx++) {
                        const scy = Math.min(height - 1, Math.max(0, y + cy - halfSide));
                        const scx = Math.min(width - 1, Math.max(0, x + cx - halfSide));
                        const srcOff = (scy * width + scx) * 4;
                        const wt = weights[cy * side + cx];
                        
                        r += src[srcOff] * wt;
                        g += src[srcOff + 1] * wt;
                        b += src[srcOff + 2] * wt;
                    }
                }
                
                data[dstOff] = Math.min(255, Math.max(0, r));
                data[dstOff + 1] = Math.min(255, Math.max(0, g));
                data[dstOff + 2] = Math.min(255, Math.max(0, b));
            }
        }
        
        ctx.putImageData(imageData, 0, 0);
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