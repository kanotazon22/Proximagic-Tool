class SpritesheetGenerator {
    constructor(options = {}) {
        this.options = {
            layout: options.layout || 'auto', // 'horizontal', 'vertical', 'square', 'auto'
            padding: options.padding || 0,
            backgroundColor: options.backgroundColor || 'transparent',
            maxSize: options.maxSize || 4096,
            columns: options.columns || null,
            rows: options.rows || null
        };
    }

    async generate(files) {
        try {
            // Load tất cả images
            const images = await this.loadImages(files);
            
            if (images.length === 0) {
                throw new Error('No valid images to process');
            }

            // Tính toán layout
            const layout = this.calculateLayout(images);
            
            // Tạo canvas và vẽ spritesheet
            const canvas = this.createSpritesheet(images, layout);
            
            // Convert sang blob
            const blob = await this.canvasToBlob(canvas);
            
            // Tạo preview data
            const previewData = this.generatePreviewData(images, layout);
            
            return {
                blob: blob,
                canvas: canvas,
                layout: layout,
                preview: previewData,
                info: {
                    totalImages: images.length,
                    dimensions: {
                        width: canvas.width,
                        height: canvas.height
                    },
                    layout: this.options.layout,
                    padding: this.options.padding
                }
            };
        } catch (error) {
            console.error('Spritesheet generation error:', error);
            throw error;
        }
    }

    async loadImages(files) {
        const promises = files.map(file => this.loadImage(file));
        const results = await Promise.allSettled(promises);
        
        return results
            .filter(result => result.status === 'fulfilled')
            .map(result => result.value);
    }

    loadImage(file) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                resolve({
                    image: img,
                    width: img.width,
                    height: img.height,
                    name: file.name,
                    file: file
                });
                URL.revokeObjectURL(img.src);
            };
            img.onerror = () => {
                URL.revokeObjectURL(img.src);
                reject(new Error(`Failed to load ${file.name}`));
            };
            img.src = URL.createObjectURL(file);
        });
    }

    calculateLayout(images) {
        const layout = this.options.layout;
        const padding = this.options.padding;
        
        let columns, rows;
        let cellWidth = 0;
        let cellHeight = 0;

        // Tìm kích thước lớn nhất
        images.forEach(img => {
            cellWidth = Math.max(cellWidth, img.width);
            cellHeight = Math.max(cellHeight, img.height);
        });

        if (layout === 'horizontal') {
            columns = images.length;
            rows = 1;
        } else if (layout === 'vertical') {
            columns = 1;
            rows = images.length;
        } else if (layout === 'square' || layout === 'auto') {
            // Tính số cột/hàng để tạo hình vuông gần nhất
            if (this.options.columns) {
                columns = this.options.columns;
                rows = Math.ceil(images.length / columns);
            } else if (this.options.rows) {
                rows = this.options.rows;
                columns = Math.ceil(images.length / rows);
            } else {
                columns = Math.ceil(Math.sqrt(images.length));
                rows = Math.ceil(images.length / columns);
            }
        }

        const canvasWidth = (cellWidth * columns) + (padding * (columns + 1));
        const canvasHeight = (cellHeight * rows) + (padding * (rows + 1));

        // Kiểm tra giới hạn kích thước
        if (canvasWidth > this.options.maxSize || canvasHeight > this.options.maxSize) {
            throw new Error(`Spritesheet too large: ${canvasWidth}x${canvasHeight}. Max size: ${this.options.maxSize}`);
        }

        return {
            columns,
            rows,
            cellWidth,
            cellHeight,
            canvasWidth,
            canvasHeight,
            padding,
            positions: this.calculatePositions(images.length, columns, rows, cellWidth, cellHeight, padding)
        };
    }

    calculatePositions(count, columns, rows, cellWidth, cellHeight, padding) {
        const positions = [];
        
        for (let i = 0; i < count; i++) {
            const col = i % columns;
            const row = Math.floor(i / columns);
            
            positions.push({
                x: padding + (col * (cellWidth + padding)),
                y: padding + (row * (cellHeight + padding)),
                width: cellWidth,
                height: cellHeight,
                index: i
            });
        }
        
        return positions;
    }

    createSpritesheet(images, layout) {
        const canvas = document.createElement('canvas');
        canvas.width = layout.canvasWidth;
        canvas.height = layout.canvasHeight;
        
        const ctx = canvas.getContext('2d', {
            alpha: this.options.backgroundColor === 'transparent',
            willReadFrequently: false
        });

        // Vẽ background
        if (this.options.backgroundColor !== 'transparent') {
            ctx.fillStyle = this.options.backgroundColor;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        // Vẽ từng image vào vị trí tương ứng
        images.forEach((img, index) => {
            const pos = layout.positions[index];
            
            // Căn giữa image trong cell nếu image nhỏ hơn cell
            const offsetX = (layout.cellWidth - img.width) / 2;
            const offsetY = (layout.cellHeight - img.height) / 2;
            
            ctx.drawImage(
                img.image,
                pos.x + offsetX,
                pos.y + offsetY,
                img.width,
                img.height
            );
        });

        return canvas;
    }

    generatePreviewData(images, layout) {
        return {
            images: images.map((img, index) => ({
                name: img.name,
                position: layout.positions[index],
                dimensions: {
                    width: img.width,
                    height: img.height
                }
            })),
            grid: {
                columns: layout.columns,
                rows: layout.rows,
                cellWidth: layout.cellWidth,
                cellHeight: layout.cellHeight
            }
        };
    }

    canvasToBlob(canvas, format = 'image/png', quality = 1.0) {
        return new Promise((resolve, reject) => {
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

    // Generate JSON metadata cho spritesheet
    generateMetadata(images, layout, spritesheetName = 'spritesheet.png') {
        const frames = {};
        
        images.forEach((img, index) => {
            const pos = layout.positions[index];
            const frameName = img.name.replace(/\.[^/.]+$/, ''); // Remove extension
            
            frames[frameName] = {
                frame: {
                    x: pos.x,
                    y: pos.y,
                    w: img.width,
                    h: img.height
                },
                rotated: false,
                trimmed: false,
                spriteSourceSize: {
                    x: 0,
                    y: 0,
                    w: img.width,
                    h: img.height
                },
                sourceSize: {
                    w: img.width,
                    h: img.height
                }
            };
        });

        return {
            frames: frames,
            meta: {
                app: 'Proximagic Tool',
                version: '1.0.0',
                image: spritesheetName,
                format: 'RGBA8888',
                size: {
                    w: layout.canvasWidth,
                    h: layout.canvasHeight
                },
                scale: '1',
                layout: this.options.layout,
                padding: this.options.padding
            }
        };
    }

    // Export metadata as JSON file
    exportMetadata(images, layout, spritesheetName) {
        const metadata = this.generateMetadata(images, layout, spritesheetName);
        const json = JSON.stringify(metadata, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        return blob;
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = SpritesheetGenerator;
}