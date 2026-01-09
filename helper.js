class FileManager {
    constructor() {
        this.files = [];
        this.listeners = [];
    }

    addFiles(newFiles, mode = 'image') {
        newFiles.forEach(file => {
            const fileData = {
                file: file,
                id: Math.random().toString(36).substr(2, 9),
                name: file.name,
                size: file.size,
                sizeFormatted: this.formatFileSize(file.size),
                type: file.type,
                preview: mode === 'image' ? URL.createObjectURL(file) : null,
                timestamp: Date.now()
            };
            this.files.push(fileData);
        });
        this.notifyListeners();
    }

    removeFile(id) {
        const file = this.files.find(f => f.id === id);
        if (file && file.preview) {
            URL.revokeObjectURL(file.preview);
        }
        this.files = this.files.filter(f => f.id !== id);
        this.notifyListeners();
    }

    clearAll() {
        this.files.forEach(f => f.preview && URL.revokeObjectURL(f.preview));
        this.files = [];
        this.notifyListeners();
    }

    getAll() {
        return this.files;
    }

    getById(id) {
        return this.files.find(f => f.id === id);
    }

    onChange(callback) {
        this.listeners.push(callback);
    }

    notifyListeners() {
        this.listeners.forEach(callback => callback(this.files));
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
    }
}

class UploadHandler {
    constructor(fileInput, uploadArea, options = {}) {
        this.fileInput = fileInput;
        this.uploadArea = uploadArea;
        this.options = {
            accept: options.accept || 'image/*',
            multiple: options.multiple !== false,
            onFilesSelected: options.onFilesSelected || (() => {}),
            onError: options.onError || console.error
        };
        
        this.init();
    }

    init() {
        this.uploadArea.addEventListener('click', (e) => {
            if (e.target === this.fileInput) return;
            e.preventDefault();
            this.fileInput.click();
        });

        this.fileInput.addEventListener('change', (e) => {
            this.handleFiles(Array.from(e.target.files));
            this.fileInput.value = '';
        });

        this.uploadArea.addEventListener('dragover', (e) => this.handleDragOver(e));
        this.uploadArea.addEventListener('dragleave', (e) => this.handleDragLeave(e));
        this.uploadArea.addEventListener('drop', (e) => this.handleDrop(e));

        this.fileInput.accept = this.options.accept;
        this.fileInput.multiple = this.options.multiple;
    }

    handleDragOver(e) {
        e.preventDefault();
        e.stopPropagation();
        this.uploadArea.style.borderColor = '#a855f7';
        this.uploadArea.style.background = '#faf5ff';
    }

    handleDragLeave(e) {
        e.preventDefault();
        e.stopPropagation();
        this.uploadArea.style.borderColor = '';
        this.uploadArea.style.background = '';
    }

    handleDrop(e) {
        e.preventDefault();
        e.stopPropagation();
        this.uploadArea.style.borderColor = '';
        this.uploadArea.style.background = '';
        
        const files = Array.from(e.dataTransfer.files);
        this.handleFiles(files);
    }

    handleFiles(files) {
        const validFiles = this.validateFiles(files);
        
        if (validFiles.length === 0) {
            this.options.onError('No valid files selected');
            return;
        }

        this.options.onFilesSelected(validFiles);
    }

    validateFiles(files) {
        const acceptTypes = this.options.accept.split(',').map(t => t.trim());
        
        return files.filter(file => {
            if (this.options.accept === '*' || this.options.accept === '*/*') {
                return true;
            }

            for (let acceptType of acceptTypes) {
                if (acceptType.endsWith('/*')) {
                    const category = acceptType.split('/')[0];
                    if (file.type.startsWith(category + '/')) {
                        return true;
                    }
                } else if (acceptType === file.type) {
                    return true;
                }
            }
            return false;
        });
    }

    setAccept(accept) {
        this.options.accept = accept;
        this.fileInput.accept = accept;
    }
}

const UIHelper = {
    show(element) {
        if (element) element.classList.remove('hidden');
    },

    hide(element) {
        if (element) element.classList.add('hidden');
    },

    toggle(element) {
        if (element) element.classList.toggle('hidden');
    },

    setText(element, text) {
        if (element) element.textContent = text;
    },

    setHTML(element, html) {
        if (element) element.innerHTML = html;
    },

    addClass(element, className) {
        if (element) element.classList.add(className);
    },

    removeClass(element, className) {
        if (element) element.classList.remove(className);
    },

    showLoading(button, loadingText = 'Processing...') {
        if (!button) return;
        button.disabled = true;
        button.dataset.originalText = button.textContent;
        button.innerHTML = `
            <svg class="spinner" width="20" height="20" viewBox="0 0 24 24" style="display: inline-block; margin-right: 8px;">
                <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none" opacity="0.25"/>
                <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" stroke-width="4" fill="none"/>
            </svg>
            ${loadingText}
        `;
    },

    hideLoading(button) {
        if (!button) return;
        button.disabled = false;
        if (button.dataset.originalText) {
            button.textContent = button.dataset.originalText;
        }
    }
};

const ImageHelper = {
    loadImage(file) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error('Failed to load image'));
            img.src = URL.createObjectURL(file);
        });
    },

    createCanvas(img, width, height) {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        return canvas;
    },

    canvasToBlob(canvas, mimeType = 'image/png', quality = 0.95) {
        return new Promise((resolve, reject) => {
            canvas.toBlob(
                (blob) => {
                    if (blob) resolve(blob);
                    else reject(new Error('Failed to create blob'));
                },
                mimeType,
                quality
            );
        });
    },

    async getImageDimensions(file) {
        const img = await this.loadImage(file);
        return { width: img.width, height: img.height };
    },

    calculateAspectRatioFit(srcWidth, srcHeight, maxWidth, maxHeight) {
        const ratio = Math.min(maxWidth / srcWidth, maxHeight / srcHeight);
        return {
            width: Math.round(srcWidth * ratio),
            height: Math.round(srcHeight * ratio)
        };
    }
};

const DownloadHelper = {
    downloadFile(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 100);
    },

    downloadMultiple(files, delay = 200) {
        files.forEach((file, index) => {
            setTimeout(() => {
                this.downloadFile(file.blob, file.name);
            }, index * delay);
        });
    }
};

const NotificationHelper = {
    show(message, type = 'info', duration = 3000) {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 16px 24px;
            background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
            color: white;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 10000;
            font-weight: 600;
            animation: slideIn 0.3s ease;
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => document.body.removeChild(notification), 300);
        }, duration);
    },

    success(message, duration) {
        this.show(message, 'success', duration);
    },

    error(message, duration) {
        this.show(message, 'error', duration);
    },

    info(message, duration) {
        this.show(message, 'info', duration);
    }
};

const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(400px);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(400px);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        FileManager,
        UploadHandler,
        UIHelper,
        ImageHelper,
        DownloadHelper,
        NotificationHelper
    };
}